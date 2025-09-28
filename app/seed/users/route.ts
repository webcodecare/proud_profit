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
    
    const { count = 10 } = await request.json()
    
    // For security, limit the number of test users
    const userCount = Math.min(count, 50)
    
    const testUsers = []
    for (let i = 1; i <= userCount; i++) {
      testUsers.push({
        email: `testuser${i}@example.com`,
        first_name: `Test`,
        last_name: `User${i}`,
        role: i <= 2 ? 'admin' : 'user', // First 2 users are admins
        subscription_tier: ['free', 'pro', 'premium'][Math.floor(Math.random() * 3)],
        created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
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

    return NextResponse.json({
      success: true,
      users_created: users?.length || 0,
      users: users
    })

  } catch (error) {
    console.error('Seed users error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}