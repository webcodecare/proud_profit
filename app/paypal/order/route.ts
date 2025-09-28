import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { plan_id, billing_interval = 'monthly', return_url, cancel_url } = await request.json()
    
    if (!plan_id) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      )
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
    const amount = billing_interval === 'yearly' ? plan.price * 10 : plan.price

    // In production, create actual PayPal order using PayPal SDK
    // For now, return mock order data
    const mockOrderId = `PAYPAL_ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Store the pending order in database
    const { error: orderError } = await supabase
      .from('paypal_orders')
      .insert({
        paypal_order_id: mockOrderId,
        user_id: user.id,
        plan_id,
        amount,
        billing_interval,
        status: 'created',
        created_at: new Date().toISOString()
      })

    if (orderError) {
      console.error('Failed to store PayPal order:', orderError)
      return NextResponse.json(
        { error: 'Failed to create order' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      id: mockOrderId,
      status: 'CREATED',
      links: [
        {
          href: `${return_url}?order_id=${mockOrderId}`,
          rel: 'approve',
          method: 'GET'
        },
        {
          href: `${cancel_url}?order_id=${mockOrderId}`,
          rel: 'cancel',
          method: 'GET'
        }
      ],
      amount: {
        currency_code: 'USD',
        value: amount.toFixed(2)
      }
    })

  } catch (error) {
    console.error('PayPal order creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create PayPal order' },
      { status: 500 }
    )
  }
}