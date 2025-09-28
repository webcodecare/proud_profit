import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { count = 10, role = 'user' } = await request.json()
    
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

    // Limit the number of test users for safety
    const userCount = Math.min(count, 100)
    
    const testUsers = []
    for (let i = 1; i <= userCount; i++) {
      const timestamp = Date.now()
      testUsers.push({
        email: `testuser${i}_${timestamp}@proudprofit.dev`,
        first_name: `Test`,
        last_name: `User ${i}`,
        role: role === 'admin' && i <= 2 ? 'admin' : 'user',
        subscription_tier: ['free', 'pro', 'premium'][Math.floor(Math.random() * 3)],
        created_at: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
        last_sign_in_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        is_test_user: true
      })
    }

    // Insert test users
    const { data: users, error } = await supabase
      .from('users')
      .insert(testUsers)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Create some test alerts for these users
    const testAlerts = []
    for (const testUser of users || []) {
      const alertCount = Math.floor(Math.random() * 5) + 1
      for (let j = 0; j < alertCount; j++) {
        testAlerts.push({
          user_id: testUser.id,
          symbol: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'][Math.floor(Math.random() * 3)],
          condition: Math.random() > 0.5 ? 'above' : 'below',
          target_price: Math.random() * 100000,
          message: `Test alert ${j + 1}`,
          is_active: Math.random() > 0.3,
          created_at: new Date().toISOString()
        })
      }
    }

    if (testAlerts.length > 0) {
      await supabase
        .from('alerts')
        .insert(testAlerts)
    }

    return NextResponse.json({
      success: true,
      users_created: users?.length || 0,
      alerts_created: testAlerts.length,
      users: users?.map(u => ({ id: u.id, email: u.email, role: u.role })) || []
    })

  } catch (error) {
    console.error('Create test users error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}