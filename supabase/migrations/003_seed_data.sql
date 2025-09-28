-- Seed initial data for Proud Profit Trading Platform

-- Insert supported cryptocurrency tickers
INSERT INTO tickers (symbol, name, category, is_active) VALUES
  ('BTCUSDT', 'Bitcoin', 'crypto', true),
  ('ETHUSDT', 'Ethereum', 'crypto', true),
  ('BNBUSDT', 'Binance Coin', 'crypto', true),
  ('SOLUSDT', 'Solana', 'crypto', true),
  ('XRPUSDT', 'XRP', 'crypto', true),
  ('ADAUSDT', 'Cardano', 'crypto', true),
  ('DOTUSDT', 'Polkadot', 'crypto', true),
  ('MATICUSDT', 'Polygon', 'crypto', true),
  ('AVAXUSDT', 'Avalanche', 'crypto', true),
  ('ATOMUSDT', 'Cosmos', 'crypto', true),
  ('NEARUSDT', 'NEAR Protocol', 'crypto', true),
  ('LINKUSDT', 'Chainlink', 'crypto', true),
  ('UNIUSDT', 'Uniswap', 'crypto', true),
  ('AAVEUSDT', 'Aave', 'crypto', true),
  ('LTCUSDT', 'Litecoin', 'crypto', true)
ON CONFLICT (symbol) DO NOTHING;

-- Insert initial market prices (mock data)
INSERT INTO market_prices (symbol, price, change_24h, change_percent_24h, volume_24h, high_24h, low_24h, source) VALUES
  ('BTCUSDT', 65000.00, 1200.50, 1.88, 1250000.00, 66500.00, 63800.00, 'mock'),
  ('ETHUSDT', 2500.00, -45.20, -1.78, 850000.00, 2580.00, 2450.00, 'mock'),
  ('BNBUSDT', 310.50, 8.75, 2.90, 420000.00, 318.00, 302.00, 'mock'),
  ('SOLUSDT', 85.30, -2.10, -2.40, 380000.00, 88.50, 83.20, 'mock'),
  ('XRPUSDT', 0.52, 0.008, 1.56, 920000.00, 0.53, 0.51, 'mock')
ON CONFLICT (symbol) DO UPDATE SET
  price = EXCLUDED.price,
  change_24h = EXCLUDED.change_24h,
  change_percent_24h = EXCLUDED.change_percent_24h,
  volume_24h = EXCLUDED.volume_24h,
  high_24h = EXCLUDED.high_24h,
  low_24h = EXCLUDED.low_24h,
  updated_at = NOW();

-- Insert sample trading signals
INSERT INTO signals (ticker, action, price, timeframe, strategy, message, source) VALUES
  ('BTCUSDT', 'buy', 64800.00, '1h', 'breakout', 'Bullish breakout above resistance', 'tradingview'),
  ('ETHUSDT', 'sell', 2520.00, '4h', 'reversal', 'Bearish reversal pattern detected', 'tradingview'),
  ('BNBUSDT', 'buy', 305.00, '1d', 'trend', 'Strong uptrend continuation', 'manual'),
  ('SOLUSDT', 'buy', 82.50, '2h', 'support', 'Bounce from key support level', 'tradingview'),
  ('XRPUSDT', 'sell', 0.525, '30m', 'overbought', 'RSI overbought signal', 'manual')
ON CONFLICT DO NOTHING;