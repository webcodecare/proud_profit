import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

const SUPPORTED_TICKERS = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', category: 'crypto' },
  { symbol: 'ETHUSDT', name: 'Ethereum', category: 'crypto' },
  { symbol: 'BNBUSDT', name: 'Binance Coin', category: 'crypto' },
  { symbol: 'SOLUSDT', name: 'Solana', category: 'crypto' },
  { symbol: 'XRPUSDT', name: 'XRP', category: 'crypto' },
  { symbol: 'ADAUSDT', name: 'Cardano', category: 'crypto' },
  { symbol: 'DOTUSDT', name: 'Polkadot', category: 'crypto' },
  { symbol: 'MATICUSDT', name: 'Polygon', category: 'crypto' },
  { symbol: 'AVAXUSDT', name: 'Avalanche', category: 'crypto' },
  { symbol: 'ATOMUSDT', name: 'Cosmos', category: 'crypto' }
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const isActive = searchParams.get('active')
    
    const supabase = createClient()
    
    // Get tickers from database with RLS
    let query = supabase
      .from('available_tickers')
      .select('*')
    
    if (category) {
      query = query.eq('category', category)
    }
    
    if (isActive !== null) {
      query = query.eq('is_enabled', isActive === 'true')
    }
    
    const { data: dbTickers, error } = await query.order('symbol')
    
    if (error) {
      console.error('Database error:', error)
      // Fallback to static list
      return NextResponse.json({
        tickers: SUPPORTED_TICKERS.filter(ticker => 
          !category || ticker.category === category
        )
      })
    }

    // If no tickers in DB, seed with default ones
    if (!dbTickers || dbTickers.length === 0) {
      const { error: insertError } = await supabase
        .from('available_tickers')
        .insert(SUPPORTED_TICKERS.map(ticker => ({
          symbol: ticker.symbol,
          description: ticker.name,
          category: ticker.category,
          is_enabled: true
        })))
      
      if (!insertError) {
        return NextResponse.json({ tickers: SUPPORTED_TICKERS })
      }
    }

    return NextResponse.json({ tickers: dbTickers || SUPPORTED_TICKERS })

  } catch (error) {
    console.error('Tickers API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tickers' },
      { status: 500 }
    )
  }
}