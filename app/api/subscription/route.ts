import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { data: subscription, error } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        subscription_plans (
          name,
          price,
          features,
          billing_interval
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()
    
    if (error && error.code !== 'PGRST116') {
      console.error('Failed to fetch subscription:', error)
      return NextResponse.json(
        { error: 'Failed to fetch subscription' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      subscription: subscription || null,
      has_active_subscription: !!subscription
    })
    
  } catch (error) {
    console.error('Subscription API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { plan_id, payment_method_id } = await request.json()
    
    if (!plan_id || !payment_method_id) {
      return NextResponse.json(
        { error: 'Plan ID and payment method ID are required' },
        { status: 400 }
      )
    }
    
    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', plan_id)
      .single()
    
    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Invalid plan ID' },
        { status: 400 }
      )
    }
    
    // Create subscription
    const subscriptionData = {
      user_id: user.id,
      plan_id,
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      payment_method_id,
      created_at: new Date().toISOString()
    }
    
    const { data: subscription, error } = await supabase
      .from('user_subscriptions')
      .insert(subscriptionData)
      .select()
      .single()
    
    if (error) {
      console.error('Failed to create subscription:', error)
      return NextResponse.json(
        { error: 'Failed to create subscription' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      message: 'Subscription created successfully',
      subscription
    }, { status: 201 })
    
  } catch (error) {
    console.error('Create subscription error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}