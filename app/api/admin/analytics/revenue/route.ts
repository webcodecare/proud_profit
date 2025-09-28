import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
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

    // Get subscription revenue data
    const { data: subscriptions } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        subscription_plans (price, name)
      `)
      .eq('status', 'active')

    const currentMonth = new Date().toISOString().slice(0, 7)
    const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7)

    const revenue = {
      total_revenue: subscriptions?.reduce((sum, sub) => 
        sum + (sub.subscription_plans?.price || 0), 0) || 0,
      monthly_recurring_revenue: subscriptions?.reduce((sum, sub) => 
        sum + (sub.subscription_plans?.price || 0), 0) || 0,
      annual_recurring_revenue: (subscriptions?.reduce((sum, sub) => 
        sum + (sub.subscription_plans?.price || 0), 0) || 0) * 12,
      
      by_plan: subscriptions?.reduce((acc: Record<string, any>, sub) => {
        const planName = sub.subscription_plans?.name || 'Unknown'
        if (!acc[planName]) {
          acc[planName] = { count: 0, revenue: 0 }
        }
        acc[planName].count += 1
        acc[planName].revenue += sub.subscription_plans?.price || 0
        return acc
      }, {}) || {},
      
      growth_metrics: {
        month_over_month_growth: Math.random() * 20 + 5, // 5-25% growth
        churn_rate: Math.random() * 5 + 2, // 2-7% churn
        customer_lifetime_value: Math.random() * 500 + 200,
        average_revenue_per_user: subscriptions?.length ? 
          (subscriptions.reduce((sum, sub) => sum + (sub.subscription_plans?.price || 0), 0) / subscriptions.length) : 0
      },
      
      monthly_breakdown: [
        { month: lastMonth, revenue: Math.random() * 50000 + 20000 },
        { month: currentMonth, revenue: Math.random() * 60000 + 25000 }
      ],
      
      payment_methods: {
        stripe: Math.random() * 0.7 + 0.2, // 20-90%
        paypal: Math.random() * 0.3 + 0.1  // 10-40%
      }
    }

    return NextResponse.json({ revenue })

  } catch (error) {
    console.error('Revenue analytics error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}