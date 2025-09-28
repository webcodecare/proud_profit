import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

// Configure Next.js to provide raw body for webhook verification
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const sig = request.headers.get('stripe-signature')
    
    // Get raw body for signature verification
    const body = await request.text()
    
    // CRITICAL: Verify webhook signature for security
    if (!sig) {
      return NextResponse.json({ error: 'Missing stripe signature' }, { status: 400 })
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('STRIPE_WEBHOOK_SECRET not configured')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
    }

    // PRODUCTION: Proper Stripe webhook verification
    let event
    try {
      // Import Stripe dynamically if available
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '')
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
    }

    // Validate event structure (redundant after constructEvent but good practice)
    if (!event?.type || !event?.data?.object) {
      return NextResponse.json({ error: 'Invalid event structure' }, { status: 400 })
    }
    
    console.log('Stripe webhook received:', event.type)

    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object
        console.log('Payment succeeded:', paymentIntent.id)
        
        // Update user subscription or payment record
        // This would typically involve updating a payment record in your database
        break

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object
        console.log('Subscription updated:', subscription.id)
        
        // Update user subscription in database
        if (subscription.metadata?.user_id) {
          await supabase
            .from('user_subscriptions')
            .upsert({
              user_id: subscription.metadata.user_id,
              stripe_subscription_id: subscription.id,
              status: subscription.status,
              plan_id: subscription.items.data[0]?.price.id,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString()
            })
        }
        break

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object
        console.log('Subscription deleted:', deletedSubscription.id)
        
        // Update subscription status to cancelled
        await supabase
          .from('user_subscriptions')
          .update({ 
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', deletedSubscription.id)
        break

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('Stripe webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 400 }
    )
  }
}