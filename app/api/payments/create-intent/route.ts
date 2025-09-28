import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { plan_id, billing_interval = 'monthly' } = await request.json()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get plan details
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', plan_id)
      .single()

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Calculate amount based on billing interval
    const amount = billing_interval === 'yearly' ? plan.price * 10 : plan.price // 20% discount for yearly
    
    // In a real implementation, you would create a Stripe PaymentIntent here
    // const paymentIntent = await stripe.paymentIntents.create({
    //   amount: Math.round(amount * 100), // Convert to cents
    //   currency: 'usd',
    //   metadata: {
    //     user_id: user.id,
    //     plan_id: plan_id,
    //     billing_interval: billing_interval
    //   }
    // })

    // For now, return a mock payment intent
    const mockPaymentIntent = {
      id: `pi_${Date.now()}`,
      client_secret: `pi_${Date.now()}_secret_${Math.random().toString(36).substr(2, 9)}`,
      amount: Math.round(amount * 100),
      currency: 'usd',
      status: 'requires_payment_method'
    }

    // Log the payment intent creation
    await supabase
      .from('payment_intents')
      .insert({
        user_id: user.id,
        stripe_payment_intent_id: mockPaymentIntent.id,
        plan_id,
        amount,
        currency: 'usd',
        status: 'created',
        billing_interval,
        created_at: new Date().toISOString()
      })

    return NextResponse.json({
      payment_intent: mockPaymentIntent,
      plan,
      amount,
      billing_interval
    })

  } catch (error) {
    console.error('Create payment intent error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}