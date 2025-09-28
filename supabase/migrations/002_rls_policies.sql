-- Enable Row Level Security (RLS) for all tables

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE ohlc_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id 
    AND role = (SELECT role FROM users WHERE id = auth.uid()) 
    AND subscription_status = (SELECT subscription_status FROM users WHERE id = auth.uid())
    AND subscription_tier = (SELECT subscription_tier FROM users WHERE id = auth.uid())
    AND subscription_expires_at = (SELECT subscription_expires_at FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Tickers policies (public read)
CREATE POLICY "Tickers are publicly readable" ON tickers
  FOR SELECT TO public USING (true);

CREATE POLICY "Only admins can insert tickers" ON tickers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can update tickers" ON tickers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete tickers" ON tickers
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Market prices policies (public read)
CREATE POLICY "Market prices are publicly readable" ON market_prices
  FOR SELECT TO public USING (true);

CREATE POLICY "Only service role can insert market prices" ON market_prices
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only service role can update market prices" ON market_prices
  FOR UPDATE USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only service role can delete market prices" ON market_prices
  FOR DELETE USING (auth.role() = 'service_role');

-- OHLC data policies (public read)
CREATE POLICY "OHLC data is publicly readable" ON ohlc_data
  FOR SELECT TO public USING (true);

CREATE POLICY "Only service role can insert OHLC data" ON ohlc_data
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only service role can update OHLC data" ON ohlc_data
  FOR UPDATE USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only service role can delete OHLC data" ON ohlc_data
  FOR DELETE USING (auth.role() = 'service_role');

-- Signals policies (authentication and subscription-gated)
-- Only authenticated users can access signals
CREATE POLICY "Authenticated users can see signals based on subscription" ON signals
  FOR SELECT USING (
    -- Must be authenticated
    auth.uid() IS NOT NULL
    AND
    (
      -- Premium users can see all signals
      EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND subscription_tier IN ('basic', 'pro', 'premium')
        AND subscription_status = 'active'
      )
      OR
      -- Free tier users can see only 10 most recent signals
      (
        EXISTS (
          SELECT 1 FROM users 
          WHERE id = auth.uid() 
          AND (subscription_tier = 'free' OR subscription_status != 'active')
        )
        AND id IN (
          SELECT id FROM signals 
          WHERE is_active = true 
          ORDER BY timestamp DESC 
          LIMIT 10
        )
      )
    )
  );

CREATE POLICY "Only admins can create signals" ON signals
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only service role can insert signals" ON signals
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only service role can update signals" ON signals
  FOR UPDATE USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only service role can delete signals" ON signals
  FOR DELETE USING (auth.role() = 'service_role');

-- User alerts policies
CREATE POLICY "Users can view their own alerts" ON user_alerts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own alerts" ON user_alerts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alerts" ON user_alerts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alerts" ON user_alerts
  FOR DELETE USING (auth.uid() = user_id);

-- Notifications policies
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can insert notifications" ON notifications
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update notifications" ON notifications
  FOR UPDATE USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can delete notifications" ON notifications
  FOR DELETE USING (auth.role() = 'service_role');

-- Payments policies
CREATE POLICY "Users can view their own payments" ON payments
  FOR SELECT USING (auth.uid() = user_id);

-- Payments can only be created by service role (via webhooks)
-- Users cannot create payments directly to prevent forgery

CREATE POLICY "Admins can view all payments" ON payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create functions for RPC endpoints
CREATE OR REPLACE FUNCTION get_user_stats(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'alerts_count', (SELECT COUNT(*) FROM user_alerts WHERE user_id = user_uuid AND is_active = true),
    'notifications_count', (SELECT COUNT(*) FROM notifications WHERE user_id = user_uuid),
    'payments_count', (SELECT COUNT(*) FROM payments WHERE user_id = user_uuid),
    'subscription_tier', (SELECT subscription_tier FROM users WHERE id = user_uuid)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_market_summary()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_tickers', (SELECT COUNT(*) FROM tickers WHERE is_active = true),
    'total_signals', (SELECT COUNT(*) FROM signals WHERE is_active = true),
    'last_price_update', (SELECT MAX(updated_at) FROM market_prices),
    'top_movers', (
      SELECT json_agg(
        json_build_object(
          'symbol', symbol,
          'price', price,
          'change_percent', change_percent_24h
        )
      )
      FROM (
        SELECT symbol, price, change_percent_24h
        FROM market_prices
        ORDER BY ABS(change_percent_24h) DESC
        LIMIT 5
      ) top_movers_query
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;