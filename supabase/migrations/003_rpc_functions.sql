-- Additional RPC functions for API endpoints
-- This migration adds the missing RPC functions referenced in the API documentation

-- Function to update user profile securely
CREATE OR REPLACE FUNCTION update_user_profile(
  user_id UUID,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL, 
  p_phone TEXT DEFAULT NULL,
  p_timezone TEXT DEFAULT NULL,
  p_notification_preferences JSONB DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  timezone TEXT,
  notification_preferences JSONB,
  role TEXT,
  subscription_tier TEXT,
  subscription_status TEXT
) AS $$
BEGIN
  -- Security check: only allow users to update their own profile
  IF auth.uid() != user_id THEN
    RAISE EXCEPTION 'Access denied: cannot update other user profiles';
  END IF;

  -- Update the user profile
  UPDATE users SET
    first_name = COALESCE(p_first_name, users.first_name),
    last_name = COALESCE(p_last_name, users.last_name),
    phone = COALESCE(p_phone, users.phone),
    timezone = COALESCE(p_timezone, users.timezone),
    notification_preferences = COALESCE(p_notification_preferences, users.notification_preferences),
    updated_at = NOW()
  WHERE users.id = user_id;

  -- Return the updated profile
  RETURN QUERY
  SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.timezone, 
         u.notification_preferences, u.role, u.subscription_tier, u.subscription_status
  FROM users u
  WHERE u.id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get comprehensive user statistics
CREATE OR REPLACE FUNCTION get_user_stats(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
  user_subscription_tier TEXT;
  user_subscription_status TEXT;
BEGIN
  -- Security check: only allow users to get their own stats or admins to get any stats
  IF auth.uid() != user_uuid AND NOT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: cannot access other user statistics';
  END IF;

  -- Get user subscription info
  SELECT subscription_tier, subscription_status 
  INTO user_subscription_tier, user_subscription_status
  FROM users WHERE id = user_uuid;

  SELECT json_build_object(
    'user_id', user_uuid,
    'alerts_count', (SELECT COUNT(*) FROM user_alerts WHERE user_id = user_uuid AND is_active = true),
    'notifications_count', (SELECT COUNT(*) FROM notifications WHERE user_id = user_uuid),
    'unread_notifications_count', (SELECT COUNT(*) FROM notifications WHERE user_id = user_uuid AND is_sent = false),
    'payments_count', (SELECT COUNT(*) FROM payments WHERE user_id = user_uuid),
    'subscription_tier', user_subscription_tier,
    'subscription_status', user_subscription_status,
    'total_signals_accessible', (
      CASE 
        WHEN user_subscription_tier IN ('basic', 'pro', 'premium') AND user_subscription_status = 'active'
        THEN (SELECT COUNT(*) FROM signals WHERE is_active = true)
        ELSE 10  -- Free tier limit
      END
    ),
    'last_login', (SELECT MAX(created_at) FROM notifications WHERE user_id = user_uuid),
    'account_created', (SELECT created_at FROM users WHERE id = user_uuid)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get market summary (publicly accessible)
CREATE OR REPLACE FUNCTION get_market_summary()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_tickers', (SELECT COUNT(*) FROM tickers WHERE is_active = true),
    'total_signals', (SELECT COUNT(*) FROM signals WHERE is_active = true),
    'total_active_alerts', (SELECT COUNT(*) FROM user_alerts WHERE is_active = true),
    'last_price_update', (SELECT MAX(updated_at) FROM market_prices),
    'last_signal_time', (SELECT MAX(timestamp) FROM signals WHERE is_active = true),
    'top_movers', (
      SELECT json_agg(
        json_build_object(
          'symbol', symbol,
          'price', price,
          'change_percent', change_percent_24h,
          'volume', volume_24h
        )
      )
      FROM (
        SELECT symbol, price, change_percent_24h, volume_24h
        FROM market_prices
        WHERE change_percent_24h IS NOT NULL
        ORDER BY ABS(change_percent_24h) DESC
        LIMIT 5
      ) top_movers_query
    ),
    'market_status', (
      CASE 
        WHEN (SELECT MAX(updated_at) FROM market_prices) > NOW() - INTERVAL '10 minutes'
        THEN 'active'
        ELSE 'stale'
      END
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get accessible signals for a user (respects subscription tier)
CREATE OR REPLACE FUNCTION get_user_signals(
  p_ticker TEXT DEFAULT NULL,
  p_timeframe TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  ticker TEXT,
  action TEXT,
  price DECIMAL,
  timeframe TEXT,
  strategy TEXT,
  message TEXT,
  timestamp TIMESTAMPTZ,
  source TEXT
) AS $$
DECLARE
  user_tier TEXT;
  user_status TEXT;
  signal_limit INTEGER;
BEGIN
  -- Security check: Must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied: authentication required to access signals';
  END IF;

  -- Get user subscription info
  SELECT subscription_tier, subscription_status 
  INTO user_tier, user_status
  FROM users WHERE id = auth.uid();
  
  -- If user not found, treat as free tier
  IF user_tier IS NULL THEN
    user_tier := 'free';
    user_status := 'inactive';
  END IF;

  -- Return signals based on subscription tier
  IF user_tier IN ('basic', 'pro', 'premium') AND user_status = 'active' THEN
    -- Premium users get full access with filters and pagination
    RETURN QUERY
    SELECT s.id, s.ticker, s.action, s.price, s.timeframe, s.strategy, s.message, s.timestamp, s.source
    FROM signals s
    WHERE s.is_active = true
      AND (p_ticker IS NULL OR s.ticker = p_ticker)
      AND (p_timeframe IS NULL OR s.timeframe = p_timeframe)
    ORDER BY s.timestamp DESC
    LIMIT p_limit
    OFFSET p_offset;
  ELSE
    -- Free users get only the same fixed 10 most recent signals (no filters, no pagination)
    -- This matches the RLS policy to prevent filter-based data exfiltration
    RETURN QUERY
    SELECT s.id, s.ticker, s.action, s.price, s.timeframe, s.strategy, s.message, s.timestamp, s.source
    FROM signals s
    WHERE s.is_active = true
      AND s.id IN (
        SELECT id FROM signals 
        WHERE is_active = true 
        ORDER BY timestamp DESC 
        LIMIT 10
      )
    ORDER BY s.timestamp DESC;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_market_summary TO public, authenticated;
GRANT EXECUTE ON FUNCTION get_user_signals TO authenticated;  -- Only authenticated users