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
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        subscription_plans (*)
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    // Get usage statistics
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format

    const [
      { count: alertsUsed },
      { count: signalsUsed }
    ] = await Promise.all([
      supabase
        .from('alerts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', `${currentMonth}-01T00:00:00Z`),
      supabase
        .from('user_signals')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', `${currentMonth}-01T00:00:00Z`)
    ])

    const plan = subscription?.subscription_plans
    const maxAlerts = plan?.max_alerts || 5
    const maxSignals = plan?.max_signals || 10

    return NextResponse.json({
      subscription: subscription?.subscription_plans || { name: 'Free', max_alerts: 5, max_signals: 10 },
      usage: {
        alerts: {
          used: alertsUsed || 0,
          limit: maxAlerts === -1 ? 'unlimited' : maxAlerts,
          percentage: maxAlerts === -1 ? 0 : Math.round(((alertsUsed || 0) / maxAlerts) * 100)
        },
        signals: {
          used: signalsUsed || 0,
          limit: maxSignals === -1 ? 'unlimited' : maxSignals,
          percentage: maxSignals === -1 ? 0 : Math.round(((signalsUsed || 0) / maxSignals) * 100)
        }
      },
      period: currentMonth
    })

  } catch (error) {
    console.error('Subscription usage error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}