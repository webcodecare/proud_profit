-- Create the initial database schema for Proud Profit Trading Platform

-- Users table with authentication and subscription info
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'basic', 'pro', 'premium')),
  subscription_status TEXT DEFAULT 'inactive' CHECK (subscription_status IN ('inactive', 'active', 'cancelled', 'expired')),
  subscription_expires_at TIMESTAMPTZ,
  timezone TEXT DEFAULT 'UTC',
  notification_preferences JSONB DEFAULT '{"email_enabled": true, "sms_enabled": false, "channels": ["app"]}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tickers table for supported cryptocurrencies
CREATE TABLE tickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'crypto',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Market prices table for real-time price data
CREATE TABLE market_prices (
  symbol TEXT PRIMARY KEY,
  price DECIMAL(20, 8) NOT NULL,
  change_24h DECIMAL(20, 8),
  change_percent_24h DECIMAL(10, 4),
  volume_24h DECIMAL(20, 8),
  high_24h DECIMAL(20, 8),
  low_24h DECIMAL(20, 8),
  source TEXT DEFAULT 'binance',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- OHLC data for charts
CREATE TABLE ohlc_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  interval TEXT NOT NULL DEFAULT '1m',
  open DECIMAL(20, 8) NOT NULL,
  high DECIMAL(20, 8) NOT NULL,
  low DECIMAL(20, 8) NOT NULL,
  close DECIMAL(20, 8) NOT NULL,
  volume DECIMAL(20, 8),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, timestamp, interval)
);

-- Trading signals table
CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('buy', 'sell')),
  price DECIMAL(20, 8) NOT NULL,
  timeframe TEXT DEFAULT '1h',
  strategy TEXT DEFAULT 'manual',
  message TEXT,
  source TEXT DEFAULT 'manual',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User alerts for price notifications
CREATE TABLE user_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('price_above', 'price_below', 'change_above', 'change_below')),
  target_price DECIMAL(20, 8) NOT NULL,
  direction TEXT DEFAULT 'above' CHECK (direction IN ('above', 'below')),
  message TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications queue
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES signals(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  channels TEXT[] DEFAULT ARRAY['app'],
  is_sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments and subscriptions
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  payment_method TEXT NOT NULL,
  payment_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  subscription_tier TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_subscription ON users(subscription_tier, subscription_status);
CREATE INDEX idx_market_prices_symbol ON market_prices(symbol);
CREATE INDEX idx_ohlc_symbol_time ON ohlc_data(symbol, timestamp DESC);
CREATE INDEX idx_signals_ticker_time ON signals(ticker, timestamp DESC);
CREATE INDEX idx_user_alerts_user_ticker ON user_alerts(user_id, ticker);
CREATE INDEX idx_notifications_user_sent ON notifications(user_id, is_sent);
CREATE INDEX idx_payments_user ON payments(user_id);

-- Updated at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_market_prices_updated_at BEFORE UPDATE ON market_prices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();