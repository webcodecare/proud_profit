import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

interface RouteContext {
  params: {
    orderId: string
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = createClient()
    const { orderId } = context.params
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the PayPal order from database
    const { data: order, error: orderError } = await supabase
      .from('paypal_orders')
      .select('*')
      .eq('paypal_order_id', orderId)
      .eq('user_id', user.id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.status !== 'created') {
      return NextResponse.json({ 
        error: 'Order cannot be captured', 
        current_status: order.status 
      }, { status: 400 })
    }

    // In production, capture the PayPal payment using PayPal SDK
    // For now, simulate successful capture
    const captureId = `CAPTURE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Update order status to captured
    const { error: updateError } = await supabase
      .from('paypal_orders')
      .update({
        status: 'captured',
        capture_id: captureId,
        captured_at: new Date().toISOString()
      })
      .eq('paypal_order_id', orderId)

    if (updateError) {
      console.error('Failed to update order status:', updateError)
      return NextResponse.json(
        { error: 'Failed to capture payment' },
        { status: 500 }
      )
    }

    // Create or update user subscription
    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + (order.billing_interval === 'yearly' ? 12 : 1))

    const { error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: user.id,
        plan_id: order.plan_id,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: expiresAt.toISOString(),
        payment_method: 'paypal',
        paypal_order_id: orderId,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })

    if (subscriptionError) {
      console.error('Failed to create/update subscription:', subscriptionError)
      // Note: In production, you might want to refund the PayPal payment here
    }

    // Log the successful payment
    await supabase
      .from('payment_logs')
      .insert({
        user_id: user.id,
        amount: order.amount,
        currency: 'USD',
        payment_method: 'paypal',
        paypal_order_id: orderId,
        capture_id: captureId,
        status: 'completed',
        created_at: new Date().toISOString()
      })

    return NextResponse.json({
      id: orderId,
      status: 'COMPLETED',
      capture_id: captureId,
      amount: {
        currency_code: 'USD',
        value: order.amount.toFixed(2)
      },
      create_time: order.created_at,
      update_time: new Date().toISOString()
    })

  } catch (error) {
    console.error('PayPal capture error:', error)
    return NextResponse.json(
      { error: 'Failed to capture PayPal payment' },
      { status: 500 }
    )
  }
}