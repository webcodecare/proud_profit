import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // CRITICAL: Require admin authentication for seeding
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
    
    console.log('Starting comprehensive database seeding...')
    
    // 1. Seed Users
    const testUsers = []
    for (let i = 1; i <= 20; i++) {
      testUsers.push({
        email: `user${i}@proudprofit.com`,
        first_name: `User`,
        last_name: `${i}`,
        role: i <= 3 ? 'admin' : 'user',
        subscription_tier: ['free', 'pro', 'premium'][Math.floor(Math.random() * 3)],
        created_at: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString()
      })
    }
    
    const { data: users } = await supabase
      .from('users')
      .insert(testUsers)
      .select()

    // 2. Seed Market Data
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT', 'DOTUSDT', 'LINKUSDT', 'AVAXUSDT']
    const marketData = []
    
    for (const symbol of symbols) {
      for (let i = 30; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        const basePrice = {
          'BTCUSDT': 45000,
          'ETHUSDT': 2500,
          'SOLUSDT': 100,
          'ADAUSDT': 0.5,
          'DOTUSDT': 8,
          'LINKUSDT': 15,
          'AVAXUSDT': 25
        }[symbol] || 100
        
        marketData.push({
          symbol,
          price: basePrice + (Math.random() - 0.5) * basePrice * 0.1,
          volume: Math.random() * 1000000,
          timestamp: date.toISOString()
        })
      }
    }
    
    const { data: market } = await supabase
      .from('market_data')
      .insert(marketData)
      .select()

    // 3. Seed Signals
    const signals = []
    for (let i = 0; i < 50; i++) {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)]
      signals.push({
        symbol,
        type: ['buy', 'sell', 'hold'][Math.floor(Math.random() * 3)],
        price: Math.random() * 50000,
        timeframe: ['1h', '4h', '1d'][Math.floor(Math.random() * 3)],
        confidence: Math.random() * 30 + 70,
        message: `AI signal for ${symbol}`,
        source: 'ai_model',
        created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      })
    }
    
    const { data: signalsData } = await supabase
      .from('signals')
      .insert(signals)
      .select()

    // 4. Seed Achievements
    const achievements = [
      { name: 'First Signal', description: 'Received your first trading signal', type: 'milestone', icon: '🎯', points: 10 },
      { name: 'Alert Master', description: 'Created 10 price alerts', type: 'trading', icon: '🔔', points: 25 },
      { name: 'Profit Maker', description: 'Achieved 10% portfolio growth', type: 'performance', icon: '💰', points: 50 },
      { name: 'Early Adopter', description: 'Joined in the first month', type: 'special', icon: '🌟', points: 100 }
    ]
    
    const { data: achievementsData } = await supabase
      .from('achievements')
      .insert(achievements)
      .select()

    return NextResponse.json({
      success: true,
      seeded: {
        users: users?.length || 0,
        market_data: market?.length || 0,
        signals: signalsData?.length || 0,
        achievements: achievementsData?.length || 0
      },
      message: 'Database seeded successfully with comprehensive test data'
    })

  } catch (error) {
    console.error('Seed all error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}