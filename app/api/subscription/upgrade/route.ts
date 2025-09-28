import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { newPlanId, paymentMethod } = await request.json()

    if (!newPlanId) {
      return NextResponse.json(
        { error: 'New plan ID is required' },
        { status: 400 }
      )
    }

    // Get the new subscription plan
    const { data: newPlan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', newPlanId)
      .eq('is_active', true)
      .single()

    if (planError || !newPlan) {
      return NextResponse.json(
        { error: 'Invalid or inactive plan' },
        { status: 400 }
      )
    }

    // Get current subscription
    const { data: currentSubscription, error: subError } = await supabase
      .from('subscriptions')
      .select(`
        *,
        subscription_plans(*)
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (subError || !currentSubscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      )
    }

    // Check if it's actually an upgrade
    const currentPlan = currentSubscription.subscription_plans
    if (newPlan.price <= currentPlan.price) {
      return NextResponse.json(
        { error: 'New plan must be higher tier than current plan' },
        { status: 400 }
      )
    }

    // Calculate prorated amount
    const daysRemaining = Math.ceil(
      (new Date(currentSubscription.current_period_end).getTime() - Date.now()) 
      / (1000 * 60 * 60 * 24)
    )
    const proratedCredit = (currentPlan.price / 30) * daysRemaining
    const upgradeAmount = newPlan.price - proratedCredit

    // Update subscription
    const { data: updatedSubscription, error: updateError } = await supabase
      .from('subscriptions')
      .update({
        plan_id: newPlanId,
        payment_method: paymentMethod || currentSubscription.payment_method,
        updated_at: new Date().toISOString(),
        upgrade_date: new Date().toISOString()
      })
      .eq('id', currentSubscription.id)
      .select()
      .single()

    if (updateError) {
      console.error('Subscription upgrade error:', updateError)
      return NextResponse.json(
        { error: 'Failed to upgrade subscription' },
        { status: 500 }
      )
    }

    // Update user tier
    await supabase
      .from('users')
      .update({
        subscription_tier: newPlan.name.toLowerCase(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    // Create payment record for upgrade
    await supabase
      .from('payments')
      .insert({
        user_id: user.id,
        subscription_id: updatedSubscription.id,
        amount: upgradeAmount,
        currency: 'USD',
        status: 'completed',
        payment_method: paymentMethod || 'stripe',
        description: `Upgrade from ${currentPlan.name} to ${newPlan.name}`,
        created_at: new Date().toISOString()
      })

    return NextResponse.json({
      message: 'Subscription upgraded successfully',
      subscription: {
        id: updatedSubscription.id,
        fromPlan: currentPlan.name,
        toPlan: newPlan.name,
        upgradeAmount: upgradeAmount.toFixed(2),
        proratedCredit: proratedCredit.toFixed(2)
      }
    })

  } catch (error) {
    console.error('Subscription upgrade error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}