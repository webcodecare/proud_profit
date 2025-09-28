import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WebhookPayload {
  ticker: string
  action: 'buy' | 'sell'
  price: number
  time?: string
  timeframe?: string
  strategy?: string
  message?: string
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

    const payload: WebhookPayload = await req.json()
    
    // Validate required fields
    if (!payload.ticker || !payload.action || !payload.price) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: ticker, action, price' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Store the signal
    const { data: signal, error: signalError } = await supabase
      .from('signals')
      .insert({
        ticker: payload.ticker.toUpperCase(),
        action: payload.action.toLowerCase(),
        price: parseFloat(payload.price.toString()),
        timeframe: payload.timeframe || '1h',
        strategy: payload.strategy || 'tradingview',
        message: payload.message || `${payload.action.toUpperCase()} signal for ${payload.ticker}`,
        source: 'tradingview_webhook',
        timestamp: payload.time ? new Date(payload.time).toISOString() : new Date().toISOString(),
        is_active: true
      })
      .select()
      .single()

    if (signalError) {
      console.error('Signal storage error:', signalError)
      return new Response(
        JSON.stringify({ error: 'Failed to store signal' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get users with alerts for this ticker
    const { data: alerts } = await supabase
      .from('user_alerts')
      .select(`
        *,
        users!inner(
          id,
          email,
          phone,
          notification_preferences
        )
      `)
      .eq('ticker', payload.ticker.toUpperCase())
      .eq('is_active', true)

    // Queue notifications for matching alerts
    if (alerts && alerts.length > 0) {
      const notifications = alerts.map((alert: any) => ({
        user_id: alert.user_id,
        signal_id: signal.id,
        type: 'signal_alert',
        title: `${payload.action.toUpperCase()} Signal: ${payload.ticker}`,
        message: `${payload.message || 'New signal'} - Price: $${payload.price}`,
        channels: alert.users.notification_preferences?.channels || ['app'],
        is_sent: false
      }))

      await supabase
        .from('notifications')
        .insert(notifications)
    }

    // Broadcast to real-time subscribers
    await supabase
      .channel('signals')
      .send({
        type: 'broadcast',
        event: 'new_signal',
        payload: signal
      })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Signal processed successfully',
        signal: signal,
        notifications_queued: alerts?.length || 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})