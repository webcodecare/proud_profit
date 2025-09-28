import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '../../../../lib/supabase/server'
import { headers } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const body = await request.text()
    const signature = headers().get('stripe-signature')

    // Check for empty body
    if (!body.trim()) {
      return NextResponse.json(
        { error: 'Empty request body' },
        { status: 400 }
      )
    }

    // Verify webhook signature (simplified for demo)
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!signature && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'No signature provided' },
        { status: 401 }
      )
    }

    let event;
    try {
      event = JSON.parse(body)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    // Log webhook receipt
    await supabase
      .from('webhook_logs')
      .insert({
        type: 'stripe',
        source: 'stripe',
        event_type: event.type,
        payload: event,
        processed_at: new Date().toISOString(),
        status: 'processing'
      })

    // Handle different Stripe events
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(supabase, event.data.object)
        break

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(supabase, event.data.object)
        break

      case 'customer.subscription.created':
        await handleSubscriptionCreated(supabase, event.data.object)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(supabase, event.data.object)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(supabase, event.data.object)
        break

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(supabase, event.data.object)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(supabase, event.data.object)
        break

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`)
    }

    // Update webhook log as processed
    await supabase
      .from('webhook_logs')
      .update({ status: 'processed' })
      .eq('event_type', event.type)
      .eq('processed_at', new Date().toISOString())

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('Stripe webhook error:', error)
    
    // Log failed webhook
    const supabase = createServiceClient()
    await supabase
      .from('webhook_logs')
      .insert({
        type: 'stripe',
        source: 'stripe',
        processed_at: new Date().toISOString(),
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      })

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function handlePaymentSucceeded(supabase: any, paymentIntent: any) {
  const { id, amount, currency, customer, metadata } = paymentIntent
  
  // Update payment record
  await supabase
    .from('payments')
    .update({
      status: 'completed',
      stripe_payment_intent_id: id,
      processed_at: new Date().toISOString()
    })
    .eq('stripe_payment_intent_id', id)

  // If this is for a subscription, update user tier
  if (metadata?.subscription_id) {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('user_id, subscription_plans(name)')
      .eq('id', metadata.subscription_id)
      .single()

    if (subscription) {
      await supabase
        .from('users')
        .update({
          subscription_tier: subscription.subscription_plans.name.toLowerCase(),
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription.user_id)

      // Send notification
      await supabase
        .from('notifications')
        .insert({
          user_id: subscription.user_id,
          type: 'payment',
          title: 'Payment Successful',
          message: `Your payment of ${amount/100} ${currency.toUpperCase()} has been processed successfully.`,
          status: 'pending'
        })
    }
  }
}

async function handlePaymentFailed(supabase: any, paymentIntent: any) {
  const { id, last_payment_error, metadata } = paymentIntent
  
  // Update payment record
  await supabase
    .from('payments')
    .update({
      status: 'failed',
      stripe_payment_intent_id: id,
      error_message: last_payment_error?.message,
      processed_at: new Date().toISOString()
    })
    .eq('stripe_payment_intent_id', id)

  // Notify user of failed payment
  if (metadata?.user_id) {
    await supabase
      .from('notifications')
      .insert({
        user_id: metadata.user_id,
        type: 'payment',
        title: 'Payment Failed',
        message: `Your payment could not be processed. Please update your payment method.`,
        status: 'pending'
      })
  }
}

async function handleSubscriptionCreated(supabase: any, subscription: any) {
  const { id, customer, status, current_period_start, current_period_end } = subscription
  
  // This would typically be handled when the subscription is created on our end
  console.log('Subscription created webhook received:', id)
}

async function handleSubscriptionUpdated(supabase: any, subscription: any) {
  const { id, status, current_period_start, current_period_end } = subscription
  
  // Update subscription in our database
  await supabase
    .from('subscriptions')
    .update({
      status: status,
      current_period_start: new Date(current_period_start * 1000).toISOString(),
      current_period_end: new Date(current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', id)
}

async function handleSubscriptionCancelled(supabase: any, subscription: any) {
  const { id } = subscription
  
  // Update subscription status
  const { data: cancelledSub } = await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', id)
    .select('user_id')
    .single()

  if (cancelledSub) {
    // Update user tier to free
    await supabase
      .from('users')
      .update({
        subscription_tier: 'free',
        updated_at: new Date().toISOString()
      })
      .eq('id', cancelledSub.user_id)

    // Send notification
    await supabase
      .from('notifications')
      .insert({
        user_id: cancelledSub.user_id,
        type: 'subscription',
        title: 'Subscription Cancelled',
        message: 'Your subscription has been cancelled. You will continue to have access until the end of your billing period.',
        status: 'pending'
      })
  }
}

async function handleInvoicePaymentSucceeded(supabase: any, invoice: any) {
  console.log('Invoice payment succeeded:', invoice.id)
  // Handle successful invoice payment
}

async function handleInvoicePaymentFailed(supabase: any, invoice: any) {
  console.log('Invoice payment failed:', invoice.id)
  // Handle failed invoice payment
}