import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get enabled tickers from database
    const { data: tickers, error } = await supabase
      .from('available_tickers')
      .select('*')
      .eq('is_enabled', true)
      .order('symbol')

    if (error) {
      console.error('Database error:', error)
      // Fallback to static list of enabled tickers
      const fallbackTickers = [
        { symbol: 'BTCUSDT', name: 'Bitcoin', category: 'crypto', is_active: true },
        { symbol: 'ETHUSDT', name: 'Ethereum', category: 'crypto', is_active: true },
        { symbol: 'BNBUSDT', name: 'Binance Coin', category: 'crypto', is_active: true },
        { symbol: 'SOLUSDT', name: 'Solana', category: 'crypto', is_active: true },
        { symbol: 'XRPUSDT', name: 'XRP', category: 'crypto', is_active: true }
      ]
      return NextResponse.json({ tickers: fallbackTickers })
    }

    // Transform data to match expected format
    const transformedTickers = (tickers || []).map(ticker => ({
      symbol: ticker.symbol,
      description: ticker.description,
      category: ticker.category,
      is_active: ticker.is_enabled
    }))
    
    return NextResponse.json({ tickers: transformedTickers })

  } catch (error) {
    console.error('Enabled tickers API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch enabled tickers' },
      { status: 500 }
    )
  }
}