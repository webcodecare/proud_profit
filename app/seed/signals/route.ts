import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    // Get user and verify admin role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { count = 50, days_back = 30 } = await request.json()

    const tickers = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOTUSDT', 'LINKUSDT', 'MATICUSDT', 'AVAXUSDT', 'UNIUSDT']
    const signalTypes = ['buy', 'sell', 'hold']
    const timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d']

    const signals = []
    
    for (let i = 0; i < count; i++) {
      const randomTicker = tickers[Math.floor(Math.random() * tickers.length)]
      const randomType = signalTypes[Math.floor(Math.random() * signalTypes.length)]
      const randomTimeframe = timeframes[Math.floor(Math.random() * timeframes.length)]
      
      // Generate random date within the specified days back
      const randomDate = new Date(Date.now() - Math.random() * days_back * 24 * 60 * 60 * 1000)
      
      // Generate realistic price based on ticker
      let basePrice = 50000 // Default for BTC
      if (randomTicker === 'ETHUSDT') basePrice = 3000
      else if (randomTicker === 'SOLUSDT') basePrice = 100
      else if (randomTicker === 'XRPUSDT') basePrice = 0.6
      else if (randomTicker === 'ADAUSDT') basePrice = 0.45
      
      const price = basePrice * (0.8 + Math.random() * 0.4) // ±20% variation
      
      signals.push({
        ticker: randomTicker,
        signal_type: randomType,
        price: Math.round(price * 100) / 100,
        confidence: Math.floor(Math.random() * 40) + 60, // 60-100% confidence
        timeframe: randomTimeframe,
        source: 'ai_analysis',
        message: `${randomType.toUpperCase()} signal for ${randomTicker} at ${price.toFixed(2)}`,
        metadata: {
          rsi: Math.floor(Math.random() * 100),
          macd: (Math.random() - 0.5) * 10,
          volume_ratio: Math.random() * 3 + 0.5
        },
        expires_at: new Date(randomDate.getTime() + 24 * 60 * 60 * 1000).toISOString(), // 24h expiry
        created_at: randomDate.toISOString()
      })
    }

    // Insert signals in batches
    const batchSize = 10
    let insertedCount = 0
    
    for (let i = 0; i < signals.length; i += batchSize) {
      const batch = signals.slice(i, i + batchSize)
      
      const { data: inserted, error } = await supabase
        .from('signals')
        .insert(batch)
        .select('id')

      if (error) {
        console.error('Failed to insert signal batch:', error)
        continue
      }
      
      insertedCount += inserted?.length || 0
    }

    return NextResponse.json({
      message: 'Trading signals seeded successfully',
      inserted_count: insertedCount,
      total_attempted: signals.length,
      tickers_used: tickers,
      date_range: {
        from: new Date(Date.now() - days_back * 24 * 60 * 60 * 1000).toISOString(),
        to: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Seed signals error:', error)
    return NextResponse.json(
      { error: 'Failed to seed trading signals' },
      { status: 500 }
    )
  }
}