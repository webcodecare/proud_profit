import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { planId, paymentMethod, billingInterval } = await request.json()

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      )
    }

    // Get the subscription plan
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Invalid or inactive plan' },
        { status: 400 }
      )
    }

    // Check if user already has an active subscription
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (existingSubscription) {
      return NextResponse.json(
        { error: 'User already has an active subscription' },
        { status: 400 }
      )
    }

    // Create subscription record
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: user.id,
        plan_id: planId,
        status: 'pending',
        payment_method: paymentMethod || 'stripe',
        billing_interval: billingInterval || plan.interval,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString(), // 30 days
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (subscriptionError) {
      console.error('Subscription creation error:', subscriptionError)
      return NextResponse.json(
        { error: 'Failed to create subscription' },
        { status: 500 }
      )
    }

    // Update user subscription tier
    await supabase
      .from('users')
      .update({
        subscription_tier: plan.name.toLowerCase(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    return NextResponse.json({
      message: 'Subscription created successfully',
      subscription: {
        id: subscription.id,
        plan: plan.name,
        status: subscription.status,
        billingInterval: subscription.billing_interval,
        currentPeriodEnd: subscription.current_period_end
      }
    })

  } catch (error) {
    console.error('Create subscription error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}