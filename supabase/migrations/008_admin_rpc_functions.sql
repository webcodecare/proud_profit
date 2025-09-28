-- Administrative RPC functions for database management
-- These functions provide secure methods for database operations

-- Function to create achievements table if it doesn't exist
CREATE OR REPLACE FUNCTION create_achievements_table()
RETURNS TEXT AS $$
BEGIN
  -- Check if achievements table already exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'achievements') THEN
    RETURN 'Achievements table already exists';
  END IF;

  -- Create achievements table
  CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    icon TEXT DEFAULT '🏆',
    category TEXT DEFAULT 'general',
    rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
    points INTEGER DEFAULT 10 CHECK (points > 0),
    condition_type TEXT DEFAULT 'manual',
    condition_data JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Create indexes
  CREATE INDEX idx_achievements_category ON achievements(category);
  CREATE INDEX idx_achievements_rarity ON achievements(rarity);
  CREATE INDEX idx_achievements_active ON achievements(is_active);

  -- Enable RLS
  ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

  -- Create policies
  CREATE POLICY "Achievements are publicly readable" ON achievements
    FOR SELECT TO public USING (is_active = true);

  CREATE POLICY "Service role can manage achievements" ON achievements
    FOR ALL USING (auth.role() = 'service_role');

  -- Add updated_at trigger if the function exists
  IF EXISTS (SELECT FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE TRIGGER update_achievements_updated_at BEFORE UPDATE ON achievements
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  RETURN 'Achievements table created successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create market_data table if it doesn't exist
CREATE OR REPLACE FUNCTION create_market_data_table()
RETURNS TEXT AS $$
BEGIN
  -- Check if market_data table already exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'market_data') THEN
    RETURN 'Market data table already exists';
  END IF;

  -- Create market_data table
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

  -- Create indexes
  CREATE INDEX idx_market_data_symbol_timestamp ON market_data(symbol, timestamp DESC);
  CREATE INDEX idx_market_data_timestamp ON market_data(timestamp DESC);

  -- Enable RLS
  ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;

  -- Create policies
  CREATE POLICY "Market data is publicly readable" ON market_data
    FOR SELECT TO public USING (true);

  CREATE POLICY "Service role can manage market data" ON market_data
    FOR ALL USING (auth.role() = 'service_role');

  -- Add updated_at trigger if the function exists
  IF EXISTS (SELECT FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE TRIGGER update_market_data_updated_at BEFORE UPDATE ON market_data
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  RETURN 'Market data table created successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SECURITY NOTE: The following execute_sql function is intentionally restrictive
-- It only allows specific, safe operations and is limited to service role access
CREATE OR REPLACE FUNCTION execute_sql(sql_query TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
  allowed_operations TEXT[] := ARRAY['CREATE INDEX', 'CREATE POLICY', 'ALTER TABLE', 'GRANT', 'REVOKE'];
  operation_found BOOLEAN := FALSE;
  op TEXT;
BEGIN
  -- Security check: Only service role can execute
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: only service role can execute SQL';
  END IF;

  -- Sanitize and check for allowed operations
  sql_query := TRIM(sql_query);
  
  -- Check if the query starts with an allowed operation
  FOREACH op IN ARRAY allowed_operations LOOP
    IF UPPER(sql_query) LIKE UPPER(op) || '%' THEN
      operation_found := TRUE;
      EXIT;
    END IF;
  END LOOP;

  -- Block dangerous operations
  IF NOT operation_found OR 
     UPPER(sql_query) LIKE '%DROP%' OR 
     UPPER(sql_query) LIKE '%DELETE%' OR 
     UPPER(sql_query) LIKE '%TRUNCATE%' OR
     UPPER(sql_query) LIKE '%INSERT%' OR
     UPPER(sql_query) LIKE '%UPDATE%' THEN
    RAISE EXCEPTION 'Security violation: SQL operation not permitted - %', sql_query;
  END IF;

  -- Execute the safe query
  EXECUTE sql_query;
  
  RETURN 'SQL executed successfully: ' || LEFT(sql_query, 100);
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'SQL execution failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Alternative exec function for backward compatibility
CREATE OR REPLACE FUNCTION exec(sql TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN execute_sql(sql);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to safely execute SQL with parameter checking (more restrictive)
CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN execute_sql(sql_query);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions only to service role for security
GRANT EXECUTE ON FUNCTION create_achievements_table TO service_role;
GRANT EXECUTE ON FUNCTION create_market_data_table TO service_role;
GRANT EXECUTE ON FUNCTION execute_sql TO service_role;
GRANT EXECUTE ON FUNCTION exec TO service_role;
GRANT EXECUTE ON FUNCTION exec_sql TO service_role;

-- Grant public access to table creation functions for administrative scripts
GRANT EXECUTE ON FUNCTION create_achievements_table TO public;
GRANT EXECUTE ON FUNCTION create_market_data_table TO public;