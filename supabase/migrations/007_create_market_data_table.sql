-- Create market_data table for historical market data and charting
CREATE TABLE market_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  price DECIMAL(20, 8) NOT NULL,
  volume DECIMAL(20, 8),
  market_cap DECIMAL(20, 8),
  change_24h DECIMAL(20, 8),
  change_percentage_24h DECIMAL(10, 4),
  high_24h DECIMAL(20, 8),
  low_24h DECIMAL(20, 8),
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_market_data_symbol_timestamp ON market_data(symbol, timestamp DESC);
CREATE INDEX idx_market_data_timestamp ON market_data(timestamp DESC);

-- Enable RLS for security
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Market data is publicly readable" ON market_data
  FOR SELECT TO public USING (true);

-- Create policy for service role to manage data
CREATE POLICY "Service role can manage market data" ON market_data
  FOR ALL USING (auth.role() = 'service_role');

-- Add updated_at trigger
CREATE TRIGGER update_market_data_updated_at BEFORE UPDATE ON market_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();