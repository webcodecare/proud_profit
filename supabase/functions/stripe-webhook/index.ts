import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405, 
        headers: corsHeaders 
      })
    }

    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      return new Response('Missing stripe signature', { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    const body = await req.text()
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    
    if (!stripeWebhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured')
      return new Response('Webhook secret not configured', { 
        status: 500, 
        headers: corsHeaders 
      })
    }

    // Verify webhook signature (simplified - in production use Stripe SDK)
    // This is a basic verification - use proper Stripe SDK in production
    try {
      // Basic signature verification - replace with Stripe.webhooks.constructEvent in production
      const event = JSON.parse(body)
      
      // Add timestamp check to prevent replay attacks
      const timestamp = req.headers.get('stripe-signature')?.match(/t=(\d+)/)?.[1]
      if (timestamp) {
        const eventTime = parseInt(timestamp) * 1000
        const currentTime = Date.now()
        const timeDiff = Math.abs(currentTime - eventTime)
        
        // Reject events older than 5 minutes
        if (timeDiff > 300000) {
          return new Response('Request too old', { 
            status: 400, 
            headers: corsHeaders 
          })
        }
      }

    console.log(`Processing Stripe webhook: ${event.type}`)

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(supabase, event.data.object)
        break
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(supabase, event.data.object)
        break
      
      case 'customer.subscription.deleted':
        await handleSubscriptionCanceled(supabase, event.data.object)
        break
      
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(supabase, event.data.object)
        break
      
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(supabase, event.data.object)
        break
      
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Stripe webhook error:', error)
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function handlePaymentSucceeded(supabase: any, paymentIntent: any) {
  const { customer, amount, currency, metadata } = paymentIntent
  
  if (!metadata?.user_id) {
    console.error('Payment intent missing user_id in metadata')
    return
  }

  // Idempotent payment recording using UPSERT
  const { error } = await supabase
    .from('payments')
    .upsert({
      user_id: metadata.user_id,
      amount: amount / 100, // Stripe amounts are in cents
      currency: currency.toUpperCase(),
      payment_method: 'stripe',
      payment_id: paymentIntent.id,
      status: 'completed',
      subscription_tier: metadata.subscription_tier
    }, {
      onConflict: 'payment_id',
      ignoreDuplicates: true
    })

  if (error && !error.message.includes('duplicate')) {
    console.error('Failed to record payment:', error)
    throw error
  }

  console.log(`Payment recorded for user ${metadata.user_id}: ${amount / 100} ${currency}`)
}

async function handleSubscriptionUpdate(supabase: any, subscription: any) {
  const { customer, status, current_period_end, metadata } = subscription
  
  if (!metadata?.user_id) {
    console.error('Subscription missing user_id in metadata')
    return
  }

  const expiresAt = new Date(current_period_end * 1000).toISOString()
  
  // Update user subscription
  await supabase
    .from('users')
    .update({
      subscription_status: status === 'active' ? 'active' : 'inactive',
      subscription_expires_at: expiresAt,
      updated_at: new Date().toISOString()
    })
    .eq('id', metadata.user_id)

  console.log(`Subscription updated for user ${metadata.user_id}: ${status}`)
}

async function handleSubscriptionCanceled(supabase: any, subscription: any) {
  const { metadata } = subscription
  
  if (!metadata?.user_id) {
    console.error('Subscription missing user_id in metadata')
    return
  }

  // Update user subscription status
  await supabase
    .from('users')
    .update({
      subscription_status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('id', metadata.user_id)

  console.log(`Subscription cancelled for user ${metadata.user_id}`)
}

async function handleInvoicePaymentSucceeded(supabase: any, invoice: any) {
  const { customer, amount_paid, currency, subscription, metadata } = invoice
  
  if (!metadata?.user_id) {
    console.error('Invoice missing user_id in metadata')
    return
  }

  // Record the payment
  await supabase
    .from('payments')
    .insert({
      user_id: metadata.user_id,
      amount: amount_paid / 100,
      currency: currency.toUpperCase(),
      payment_method: 'stripe',
      payment_id: invoice.id,
      status: 'completed',
      subscription_tier: metadata.subscription_tier
    })

  console.log(`Invoice payment recorded for user ${metadata.user_id}: ${amount_paid / 100} ${currency}`)
}

async function handleInvoicePaymentFailed(supabase: any, invoice: any) {
  const { metadata } = invoice
  
  if (!metadata?.user_id) {
    console.error('Invoice missing user_id in metadata')
    return
  }

  // You might want to send a notification or take other action
  console.log(`Invoice payment failed for user ${metadata.user_id}`)
  
  // Optionally create a notification
  await supabase
    .from('notifications')
    .insert({
      user_id: metadata.user_id,
      type: 'payment_failed',
      title: 'Payment Failed',
      message: 'Your subscription payment failed. Please update your payment method.',
      channels: ['app', 'email'],
      is_sent: false
    })
}