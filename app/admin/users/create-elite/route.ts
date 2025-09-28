import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

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

    const { email, password, first_name, last_name } = await request.json()
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Create auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (authError) {
      console.error('Failed to create auth user:', authError)
      return NextResponse.json(
        { error: 'Failed to create user account' },
        { status: 400 }
      )
    }

    // Create elite user profile
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        id: authUser.user.id,
        email,
        first_name,
        last_name,
        role: 'elite',
        subscription_tier: 'elite',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (userError) {
      console.error('Failed to create user profile:', userError)
      // Clean up auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authUser.user.id)
      return NextResponse.json(
        { error: 'Failed to create elite user profile' },
        { status: 500 }
      )
    }

    // Create elite subscription
    const eliteExpiresAt = new Date()
    eliteExpiresAt.setFullYear(eliteExpiresAt.getFullYear() + 1) // 1 year elite access

    const { error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: authUser.user.id,
        plan_id: 'elite-plan', // Assuming elite plan ID
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: eliteExpiresAt.toISOString(),
        payment_method: 'admin_created',
        created_at: new Date().toISOString()
      })

    if (subscriptionError) {
      console.error('Failed to create elite subscription:', subscriptionError)
    }

    // Award elite achievements
    const { error: achievementError } = await supabase
      .from('user_achievements')
      .insert({
        user_id: authUser.user.id,
        achievement_id: 'elite-member',
        earned_at: new Date().toISOString(),
        awarded_by: user.id
      })

    if (achievementError) {
      console.error('Failed to award elite achievement:', achievementError)
    }

    return NextResponse.json({
      message: 'Elite user created successfully',
      user: {
        ...newUser,
        has_elite_subscription: true,
        subscription_expires: eliteExpiresAt.toISOString()
      }
    })

  } catch (error) {
    console.error('Admin elite user creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create elite user' },
      { status: 500 }
    )
  }
}