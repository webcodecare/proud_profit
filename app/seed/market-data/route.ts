import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // CRITICAL: Require admin authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Additional server-side protection for production
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SEEDING) {
      return NextResponse.json({ error: 'Seeding disabled in production' }, { status: 403 })
    }
    
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT', 'DOTUSDT']
    
    const marketData = []
    const now = new Date()
    
    // Generate market data for the last 30 days
    for (const symbol of symbols) {
      for (let i = 30; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        const basePrice = symbol === 'BTCUSDT' ? 45000 : symbol === 'ETHUSDT' ? 2500 : 100
        const price = basePrice + (Math.random() - 0.5) * basePrice * 0.1
        
        marketData.push({
          symbol,
          price,
          volume: Math.random() * 1000000,
          market_cap: price * 19000000, // Approximate circulating supply
          price_change_24h: (Math.random() - 0.5) * 0.2,
          timestamp: date.toISOString()
        })
      }
    }

    // Insert market data
    const { data: inserted, error } = await supabase
      .from('market_data')
      .insert(marketData)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      records_created: inserted?.length || 0,
      symbols_populated: symbols,
      date_range: '30 days'
    })

  } catch (error) {
    console.error('Seed market data error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}