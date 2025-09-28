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

    // Basic PayPal webhook verification
    const paypalWebhookId = Deno.env.get('PAYPAL_WEBHOOK_ID')
    const body = await req.text()
    
    if (!paypalWebhookId) {
      console.error('PAYPAL_WEBHOOK_ID not configured')
      return new Response('Webhook not configured', { 
        status: 500, 
        headers: corsHeaders 
      })
    }

    // In production, verify with PayPal's v2/notifications/verify-webhook-signature
    // For now, basic verification by checking headers
    const authAlgo = req.headers.get('paypal-auth-algo')
    const transmission_id = req.headers.get('paypal-transmission-id')
    const cert_id = req.headers.get('paypal-cert-id')
    const signature = req.headers.get('paypal-transmission-sig')
    
    if (!authAlgo || !transmission_id || !cert_id || !signature) {
      return new Response('Missing PayPal verification headers', { 
        status: 400, 
        headers: corsHeaders 
      })
    }
    
    const event = JSON.parse(body)
    console.log(`Processing PayPal webhook: ${event.event_type}`)

    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await handlePaymentCompleted(supabase, event.resource)
        break
      
      case 'BILLING.SUBSCRIPTION.CREATED':
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await handleSubscriptionActivated(supabase, event.resource)
        break
      
      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await handleSubscriptionCancelled(supabase, event.resource)
        break
      
      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        await handlePaymentFailed(supabase, event.resource)
        break
      
      default:
        console.log(`Unhandled PayPal event type: ${event.event_type}`)
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('PayPal webhook error:', error)
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function handlePaymentCompleted(supabase: any, payment: any) {
  const { amount, custom_id } = payment
  
  if (!custom_id) {
    console.error('PayPal payment missing custom_id (user_id)')
    return
  }

  // Idempotent payment recording using UPSERT
  const { error } = await supabase
    .from('payments')
    .upsert({
      user_id: custom_id,
      amount: parseFloat(amount.value),
      currency: amount.currency_code,
      payment_method: 'paypal',
      payment_id: payment.id,
      status: 'completed'
    }, {
      onConflict: 'payment_id',
      ignoreDuplicates: true
    })

  if (error && !error.message.includes('duplicate')) {
    console.error('Failed to record PayPal payment:', error)
    throw error
  }

  console.log(`PayPal payment recorded for user ${custom_id}: ${amount.value} ${amount.currency_code}`)
}

async function handleSubscriptionActivated(supabase: any, subscription: any) {
  const { custom_id, status } = subscription
  
  if (!custom_id) {
    console.error('PayPal subscription missing custom_id (user_id)')
    return
  }

  // Calculate expiry date (usually 30 days for monthly subscriptions)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30)

  // Update user subscription
  await supabase
    .from('users')
    .update({
      subscription_status: 'active',
      subscription_expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', custom_id)

  console.log(`PayPal subscription activated for user ${custom_id}`)
}

async function handleSubscriptionCancelled(supabase: any, subscription: any) {
  const { custom_id } = subscription
  
  if (!custom_id) {
    console.error('PayPal subscription missing custom_id (user_id)')
    return
  }

  // Update user subscription status
  await supabase
    .from('users')
    .update({
      subscription_status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('id', custom_id)

  console.log(`PayPal subscription cancelled for user ${custom_id}`)
}

async function handlePaymentFailed(supabase: any, resource: any) {
  const { custom_id } = resource
  
  if (!custom_id) {
    console.error('PayPal payment failure missing custom_id (user_id)')
    return
  }

  // Create notification for payment failure
  await supabase
    .from('notifications')
    .insert({
      user_id: custom_id,
      type: 'payment_failed',
      title: 'PayPal Payment Failed',
      message: 'Your PayPal subscription payment failed. Please check your PayPal account.',
      channels: ['app', 'email'],
      is_sent: false
    })

  console.log(`PayPal payment failed for user ${custom_id}`)
}