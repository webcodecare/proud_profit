import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { requireUserAuth } from '../../../../lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    // Check user authentication
    const { user, error: authError, status, supabase } = await requireUserAuth(request)
    if (authError) {
      return NextResponse.json({ error: authError }, { status })
    }
    
    if (!user || !supabase) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    // Get user's current subscriptions
    const { data: subscriptions } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        subscription_plans (*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Get current active subscription
    const activeSubscription = subscriptions?.find(sub => sub.status === 'active')

    return NextResponse.json({
      subscriptions: subscriptions || [],
      current_subscription: activeSubscription || {
        plan: 'free',
        status: 'active',
        subscription_plans: {
          name: 'Free Plan',
          max_alerts: 5,
          max_signals: 10
        }
      },
      has_active_subscription: !!activeSubscription
    })

  } catch (error) {
    console.error('User subscriptions error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}