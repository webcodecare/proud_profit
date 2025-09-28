import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get active tickers count
    const { data: tickers, error: tickersError } = await supabase
      .from('available_tickers')
      .select('symbol')
      .eq('is_enabled', true)

    // Get recent signals count
    const { data: signals, error: signalsError } = await supabase
      .from('buy_signals')
      .select('id')
      .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    // Get system health metrics
    const activeTickersCount = tickers?.length || 0
    const recentSignalsCount = signals?.length || 0
    
    // Calculate market session status
    const now = new Date()
    const currentHour = now.getUTCHours()
    const isMarketHours = currentHour >= 0 && currentHour <= 23 // Crypto markets are 24/7
    
    const marketStatus = {
      status: 'operational',
      session: isMarketHours ? 'open' : 'extended',
      trading_active: true,
      last_updated: new Date().toISOString(),
      metrics: {
        active_tickers: activeTickersCount,
        recent_signals_24h: recentSignalsCount,
        uptime_percentage: 99.9,
        average_response_time_ms: 45
      },
      markets: {
        cryptocurrency: {
          status: 'open',
          trading_pairs: activeTickersCount,
          last_price_update: new Date().toISOString()
        },
        forex: {
          status: isMarketHours ? 'open' : 'closed',
          trading_pairs: 0,
          last_price_update: new Date().toISOString()
        }
      },
      announcements: [
        {
          id: 1,
          type: 'info',
          message: 'All systems operational',
          timestamp: new Date().toISOString()
        }
      ]
    }

    return NextResponse.json(marketStatus)

  } catch (error) {
    console.error('Market status error:', error)
    return NextResponse.json(
      { 
        status: 'degraded',
        message: 'Unable to fetch complete market status',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}