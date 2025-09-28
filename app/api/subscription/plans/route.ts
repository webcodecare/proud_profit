import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get all subscription plans
    const { data: plans } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('price')

    // Default plans if none in database
    const defaultPlans = [
      {
        id: 'free',
        name: 'Free Plan',
        description: 'Basic features to get started',
        price: 0,
        interval: 'month',
        features: [
          'Up to 5 price alerts',
          'Basic trading signals',
          'Community access',
          'Mobile notifications'
        ],
        max_alerts: 5,
        max_signals: 10,
        is_popular: false
      },
      {
        id: 'pro',
        name: 'Pro Plan',
        description: 'Advanced features for serious traders',
        price: 29.99,
        interval: 'month',
        features: [
          'Unlimited price alerts',
          'Advanced trading signals',
          'Technical analysis tools',
          'Priority support',
          'SMS notifications',
          'API access'
        ],
        max_alerts: -1,
        max_signals: -1,
        is_popular: true
      },
      {
        id: 'premium',
        name: 'Premium Plan',
        description: 'Professional trading suite',
        price: 99.99,
        interval: 'month',
        features: [
          'All Pro features',
          'Custom indicators',
          'Portfolio analytics',
          'Telegram integration',
          'Personal advisor',
          'White-label access'
        ],
        max_alerts: -1,
        max_signals: -1,
        is_popular: false
      }
    ]

    return NextResponse.json({
      plans: plans?.length ? plans : defaultPlans
    })

  } catch (error) {
    console.error('Subscription plans error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}