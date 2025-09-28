import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get subscription plans
    const { data: plans } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('price')

    if (!plans) {
      // Return default plans if none in database
      const defaultPlans = [
        {
          id: 'free',
          name: 'Free',
          price: 0,
          interval: 'month',
          features: ['Basic signals', 'Limited alerts'],
          max_alerts: 5,
          max_signals: 10
        },
        {
          id: 'pro',
          name: 'Pro',
          price: 29.99,
          interval: 'month',
          features: ['Unlimited signals', 'Advanced analytics', 'Priority support'],
          max_alerts: 100,
          max_signals: -1
        },
        {
          id: 'premium',
          name: 'Premium',
          price: 99.99,
          interval: 'month',
          features: ['All Pro features', 'Custom indicators', 'Personal advisor'],
          max_alerts: -1,
          max_signals: -1
        }
      ]
      
      return NextResponse.json({ plans: defaultPlans })
    }

    return NextResponse.json({ plans })

  } catch (error) {
    console.error('Payment plans error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}