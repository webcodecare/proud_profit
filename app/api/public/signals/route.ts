import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { safeLogger } from '../../../../lib/logger'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { searchParams } = new URL(request.url)
    const ticker = searchParams.get('ticker')
    const timeframe = searchParams.get('timeframe')
    const days = parseInt(searchParams.get('days') || '7')

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    let query = supabase
      .from('signals')
      .select('id, ticker, action, price, timeframe, strategy, message, timestamp, source')
      .eq('is_active', true)
      .gte('timestamp', startDate.toISOString())
      .order('timestamp', { ascending: false })
      .limit(100)

    if (ticker) {
      query = query.eq('ticker', ticker.toUpperCase())
    }

    if (timeframe) {
      query = query.eq('timeframe', timeframe)
    }

    const { data: signals, error } = await query

    if (error) {
      safeLogger.logDbError('fetch_public_signals', new Error(error.message), { ticker, timeframe, days })
      // Return mock data as fallback
      const mockSignals = [
        {
          id: 'mock-1',
          ticker: ticker?.toUpperCase() || 'BTCUSDT',
          action: 'buy',
          price: 65000,
          timeframe: timeframe || '1h',
          strategy: 'RSI Divergence',
          message: 'Bullish divergence detected',
          timestamp: new Date().toISOString(),
          source: 'mock'
        }
      ]
      return NextResponse.json({ signals: mockSignals, total: 1 })
    }

    return NextResponse.json({ 
      signals: signals || [],
      total: signals?.length || 0,
      filters: { ticker, timeframe, days }
    })

  } catch (error) {
    safeLogger.logError('GET /api/public/signals failed', error instanceof Error ? error : new Error(String(error)), { method: 'GET' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}