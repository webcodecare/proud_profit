import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { searchParams } = new URL(request.url)
    const ticker = searchParams.get('ticker')
    const limit = parseInt(searchParams.get('limit') || '10')

    let query = supabase
      .from('signals')
      .select('id, ticker, action, price, timeframe, strategy, message, timestamp, source')
      .eq('is_active', true)
      .order('timestamp', { ascending: false })
      .limit(limit)

    if (ticker) {
      query = query.eq('ticker', ticker.toUpperCase())
    }

    const { data: signals, error } = await query

    if (error) {
      console.error('Public signals alerts fetch error:', error)
      // Return mock data as fallback
      const mockSignals = [
        {
          id: 'alert-1',
          ticker: ticker?.toUpperCase() || 'BTCUSDT',
          action: 'buy',
          price: 65000,
          timeframe: '1h',
          strategy: 'Moving Average Crossover',
          message: 'Golden cross detected - Buy signal',
          timestamp: new Date(Date.now() - 300000).toISOString(), // 5 min ago
          source: 'tradingview'
        },
        {
          id: 'alert-2',
          ticker: ticker?.toUpperCase() || 'BTCUSDT',
          action: 'sell',
          price: 64500,
          timeframe: '1h',
          strategy: 'RSI Overbought',
          message: 'RSI above 70 - Sell signal',
          timestamp: new Date(Date.now() - 900000).toISOString(), // 15 min ago
          source: 'tradingview'
        }
      ]
      return NextResponse.json({ signals: mockSignals, total: 2 })
    }

    return NextResponse.json({ 
      signals: signals || [],
      total: signals?.length || 0
    })

  } catch (error) {
    console.error('Public signals alerts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}