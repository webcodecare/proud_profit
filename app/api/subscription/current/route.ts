import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's current subscription
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        plan:subscription_plans (
          id,
          name,
          price,
          tier,
          features,
          description
        )
      `)
      .eq('user_id', user.id)
      .single()

    if (subError && subError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Failed to fetch subscription:', subError)
      return NextResponse.json(
        { error: 'Failed to fetch subscription' },
        { status: 500 }
      )
    }

    // Get user profile for fallback info
    const { data: userProfile } = await supabase
      .from('users')
      .select('subscription_tier, email')
      .eq('id', user.id)
      .single()

    if (!subscription) {
      // No active subscription, return free tier info
      return NextResponse.json({
        has_subscription: false,
        tier: 'free',
        status: 'free',
        plan: {
          name: 'Free Plan',
          price: 0,
          tier: 'free',
          features: ['Basic market data', 'Limited signals', 'Community support']
        },
        limits: {
          signals_per_day: 10,
          alerts: 5,
          portfolios: 1
        },
        user_tier: userProfile?.subscription_tier || 'free'
      })
    }

    // Calculate days remaining
    const now = new Date()
    const endDate = new Date(subscription.current_period_end)
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

    // Determine plan limits based on tier
    const planLimits = {
      free: { signals_per_day: 10, alerts: 5, portfolios: 1 },
      basic: { signals_per_day: 50, alerts: 20, portfolios: 3 },
      premium: { signals_per_day: 200, alerts: 100, portfolios: 10 },
      elite: { signals_per_day: -1, alerts: -1, portfolios: -1 } // Unlimited
    }

    const currentLimits = planLimits[subscription.plan?.tier as keyof typeof planLimits] || planLimits.free

    return NextResponse.json({
      has_subscription: true,
      subscription_id: subscription.id,
      status: subscription.status,
      tier: subscription.plan?.tier || 'free',
      plan: subscription.plan,
      billing: {
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        days_remaining: daysRemaining,
        auto_renew: subscription.auto_renew || false,
        payment_method: subscription.payment_method
      },
      limits: currentLimits,
      usage: {
        signals_used_today: Math.floor(Math.random() * (currentLimits.signals_per_day / 2)), // Mock usage
        alerts_used: Math.floor(Math.random() * Math.min(currentLimits.alerts, 10)),
        portfolios_used: Math.floor(Math.random() * Math.min(currentLimits.portfolios, 3))
      },
      next_billing_date: subscription.current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end || false
    })

  } catch (error) {
    console.error('Current subscription error:', error)
    return NextResponse.json(
      { error: 'Failed to get current subscription' },
      { status: 500 }
    )
  }
}