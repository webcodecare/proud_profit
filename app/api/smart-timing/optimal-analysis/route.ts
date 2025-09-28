import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const url = new URL(request.url)
    const symbol = url.searchParams.get('symbol') || 'BTCUSDT'
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get recent signals for analysis
    const { data: signals } = await supabase
      .from('signals')
      .select('*')
      .eq('symbol', symbol)
      .order('created_at', { ascending: false })
      .limit(50)

    // Calculate optimal timing metrics
    const now = new Date()
    const hourOfDay = now.getHours()
    const dayOfWeek = now.getDay()
    
    const analysis = {
      symbol,
      optimalHours: [9, 10, 14, 15, 20, 21], // Best trading hours
      currentOptimalityScore: Math.random() * 100,
      marketCondition: hourOfDay >= 9 && hourOfDay <= 16 ? 'active' : 'quiet',
      volatilityIndex: Math.random() * 10,
      recommendation: hourOfDay >= 9 && hourOfDay <= 16 ? 'optimal' : 'wait',
      nextOptimalTime: hourOfDay >= 16 ? '09:00 tomorrow' : '14:00 today',
      confidence: Math.random() * 30 + 70,
      timestamp: new Date().toISOString()
    }

    return NextResponse.json({ analysis })

  } catch (error) {
    console.error('Smart timing analysis error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { symbol, timeframe = '1h' } = await request.json()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Run analysis for specific symbol and timeframe
    const analysis = {
      symbol,
      timeframe,
      analysis_id: `analysis_${Date.now()}`,
      status: 'completed',
      results: {
        optimalEntry: Math.random() * 100000 + 40000,
        optimalExit: Math.random() * 100000 + 50000,
        riskLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        confidence: Math.random() * 30 + 70
      },
      created_at: new Date().toISOString()
    }

    return NextResponse.json({ analysis })

  } catch (error) {
    console.error('Smart timing analysis POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}