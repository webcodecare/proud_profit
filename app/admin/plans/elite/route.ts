import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
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

    // Get elite plan details
    const { data: elitePlan } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('tier', 'elite')
      .single()

    // Get elite subscribers
    const { data: eliteSubscribers } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        user:users (
          id,
          email,
          first_name,
          last_name,
          created_at
        )
      `)
      .eq('plan_id', elitePlan?.id || 'elite-plan')
      .eq('status', 'active')

    // Get elite user statistics
    const { data: eliteUsers } = await supabase
      .from('users')
      .select('id, created_at, last_sign_in_at')
      .eq('subscription_tier', 'elite')

    const now = new Date()
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const stats = {
      total_elite_users: eliteUsers?.length || 0,
      active_elite_subscriptions: eliteSubscribers?.length || 0,
      new_elite_this_month: eliteUsers?.filter(user => 
        new Date(user.created_at) >= thisMonth
      ).length || 0,
      elite_plan: elitePlan,
      recent_signups: eliteUsers?.slice(0, 10) || []
    }

    return NextResponse.json({
      message: 'Elite plan details',
      stats,
      subscribers: eliteSubscribers?.map(sub => ({
        user_id: sub.user_id,
        email: sub.user?.email,
        name: `${sub.user?.first_name || ''} ${sub.user?.last_name || ''}`.trim(),
        subscription_start: sub.current_period_start,
        subscription_end: sub.current_period_end,
        payment_method: sub.payment_method,
        created_at: sub.user?.created_at
      })) || []
    })

  } catch (error) {
    console.error('Admin elite plan error:', error)
    return NextResponse.json(
      { error: 'Failed to get elite plan details' },
      { status: 500 }
    )
  }
}

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

    const { action, user_id, duration_months = 12 } = await request.json()
    
    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      )
    }

    let result;

    switch (action) {
      case 'upgrade_to_elite':
        if (!user_id) {
          return NextResponse.json(
            { error: 'User ID is required for elite upgrade' },
            { status: 400 }
          )
        }

        // Update user to elite tier
        const { error: userUpdateError } = await supabase
          .from('users')
          .update({
            subscription_tier: 'elite',
            role: 'elite'
          })
          .eq('id', user_id)

        if (userUpdateError) {
          console.error('Failed to update user to elite:', userUpdateError)
          return NextResponse.json(
            { error: 'Failed to upgrade user to elite' },
            { status: 500 }
          )
        }

        // Create/update elite subscription
        const eliteExpiresAt = new Date()
        eliteExpiresAt.setMonth(eliteExpiresAt.getMonth() + duration_months)

        const { error: subscriptionError } = await supabase
          .from('user_subscriptions')
          .upsert({
            user_id,
            plan_id: 'elite-plan',
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: eliteExpiresAt.toISOString(),
            payment_method: 'admin_upgrade',
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          })

        if (subscriptionError) {
          console.error('Failed to create elite subscription:', subscriptionError)
          return NextResponse.json(
            { error: 'Failed to create elite subscription' },
            { status: 500 }
          )
        }

        result = { 
          message: 'User upgraded to elite successfully',
          expires_at: eliteExpiresAt.toISOString()
        }
        break

      case 'create_elite_plan':
        const { name, price, features } = await request.json()
        
        const { data: newElitePlan, error: planError } = await supabase
          .from('subscription_plans')
          .insert({
            name: name || 'Elite Plan',
            description: 'Premium elite access with all features',
            price: price || 199,
            tier: 'elite',
            features: features || [
              'All premium features',
              'Priority support', 
              'Advanced analytics',
              'Custom alerts',
              'API access',
              'White-label options'
            ],
            is_popular: false,
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (planError) {
          console.error('Failed to create elite plan:', planError)
          return NextResponse.json(
            { error: 'Failed to create elite plan' },
            { status: 500 }
          )
        }

        result = {
          message: 'Elite plan created successfully',
          plan: newElitePlan
        }
        break

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        )
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Admin elite plan action error:', error)
    return NextResponse.json(
      { error: 'Failed to execute elite plan action' },
      { status: 500 }
    )
  }
}