import { createClient } from '../lib/supabase/server'

export default async function Home() {
  const supabase = createClient()
  
  let tickers = null
  let error = null
  
  try {
    // Test database connection and query available_tickers table
    const { data, error: queryError } = await supabase
      .from('available_tickers')
      .select('*')
      .eq('is_enabled', true)
      .limit(10)
    
    if (queryError) {
      error = queryError.message
    } else {
      tickers = data
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error occurred'
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Proud Profit Trading Platform</h1>
      <p>Next.js + Supabase Architecture</p>
      
      <div style={{ backgroundColor: '#f0f8ff', padding: '15px', marginBottom: '20px', borderRadius: '5px' }}>
        <h3>Database Connection Status</h3>
        {error ? (
          <div style={{ color: 'red' }}>
            <p><strong>Error:</strong> {error}</p>
            <p>This might be because the 'available_tickers' table doesn't exist or RLS policies are blocking access.</p>
          </div>
        ) : (
          <div style={{ color: 'green' }}>
            <p><strong>Success:</strong> Database connection working!</p>
          </div>
        )}
      </div>
      
      <h2>Available Tickers</h2>
      {error ? (
        <p style={{ color: 'orange' }}>Unable to load tickers due to database error above.</p>
      ) : (
        <ul>
          {tickers && tickers.length > 0 ? (
            tickers.map((ticker) => (
              <li key={ticker.id}>
                {ticker.symbol} - {ticker.name}
              </li>
            ))
          ) : (
            <p>No tickers found in database.</p>
          )}
        </ul>
      )}
      
      <div>
        <h3>API Endpoints Available:</h3>
        <ul>
          <li>GET /api/market/price/[ticker] - Live prices</li>
          <li>GET /api/market/ohlc/[ticker] - OHLC data</li>
          <li>GET /api/market/tickers - Available tickers</li>
          <li>POST /api/signals/webhook - TradingView webhooks</li>
          <li>GET /api/signals/alerts - User alerts</li>
          <li>POST /api/auth/register - User registration</li>
          <li>POST /api/auth/login - User login</li>
        </ul>
      </div>
    </div>
  )
}