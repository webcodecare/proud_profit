import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

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

    // Get all subscription plans
    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('price', { ascending: true })

    if (error) {
      console.error('Failed to fetch plans:', error)
      return NextResponse.json(
        { error: 'Failed to fetch plans' },
        { status: 500 }
      )
    }

    // Get subscription statistics
    const { data: subscriptionStats } = await supabase
      .from('user_subscriptions')
      .select('plan_id, status')

    const stats = plans.map(plan => {
      const planSubs = subscriptionStats?.filter(sub => sub.plan_id === plan.id) || []
      return {
        ...plan,
        active_subscribers: planSubs.filter(sub => sub.status === 'active').length,
        total_subscribers: planSubs.length
      }
    })

    return NextResponse.json({
      plans: stats,
      total_plans: plans.length
    })

  } catch (error) {
    console.error('Admin plans error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch plans' },
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

    const { 
      name, 
      description, 
      price, 
      features = [], 
      tier = 'premium',
      is_popular = false,
      stripe_price_id,
      paypal_plan_id 
    } = await request.json()
    
    if (!name || !description || price === undefined) {
      return NextResponse.json(
        { error: 'Name, description, and price are required' },
        { status: 400 }
      )
    }

    const { data: newPlan, error } = await supabase
      .from('subscription_plans')
      .insert({
        name,
        description,
        price,
        features,
        tier,
        is_popular,
        stripe_price_id,
        paypal_plan_id,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create plan:', error)
      return NextResponse.json(
        { error: 'Failed to create subscription plan' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Subscription plan created successfully',
      plan: newPlan
    })

  } catch (error) {
    console.error('Admin plan creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create subscription plan' },
      { status: 500 }
    )
  }
}