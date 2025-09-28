import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Test database connection using available_tickers table (which exists)
    const { data, error } = await supabase
      .from('available_tickers')
      .select('id')
      .limit(1)
    
    // Always return 200 for API availability, but indicate database status
    if (error) {
      console.error('Database health check failed:', error)
      return NextResponse.json({
        status: 'degraded',
        timestamp: new Date().toISOString(),
        services: {
          database: 'unhealthy',
          api: 'healthy'
        },
        error: 'Database connection failed',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      }, { status: 200 }) // Still 200 for API health
    }
    
    // Get additional metrics
    const { data: tickerCount } = await supabase
      .from('available_tickers')
      .select('id')
    
    const { data: signalCount } = await supabase
      .from('buy_signals')
      .select('id')
      .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'healthy',
        api: 'healthy'
      },
      metrics: {
        total_tickers: tickerCount?.length || 0,
        recent_signals_24h: signalCount?.length || 0,
        uptime: '100%'
      },
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    }, { status: 200 })
    
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: 'unknown',
        api: 'healthy'
      },
      error: 'Health check partially failed',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    }, { status: 200 }) // Still 200 for API availability
  }
}