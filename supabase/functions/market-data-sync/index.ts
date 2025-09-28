import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPPORTED_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOTUSDT', 'MATICUSDT', 'AVAXUSDT', 'ATOMUSDT'
]

interface BinanceTickerData {
  symbol: string
  lastPrice: string
  priceChange: string
  priceChangePercent: string
  volume: string
  highPrice: string
  lowPrice: string
}

async function fetchBinancePrices(): Promise<BinanceTickerData[]> {
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr')
    if (response.ok) {
      const data = await response.json()
      return data.filter((ticker: BinanceTickerData) => 
        SUPPORTED_SYMBOLS.includes(ticker.symbol)
      )
    }
  } catch (error) {
    console.error('Binance API error:', error)
  }
  return []
}

Deno.serve(async (req) => {
  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Fetch latest prices from Binance
    const binancePrices = await fetchBinancePrices()
    
    if (binancePrices.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No price data available' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Transform data for database storage
    const priceUpdates = binancePrices.map(ticker => ({
      symbol: ticker.symbol,
      price: parseFloat(ticker.lastPrice),
      change_24h: parseFloat(ticker.priceChange),
      change_percent_24h: parseFloat(ticker.priceChangePercent),
      volume_24h: parseFloat(ticker.volume),
      high_24h: parseFloat(ticker.highPrice),
      low_24h: parseFloat(ticker.lowPrice),
      source: 'binance',
      updated_at: new Date().toISOString()
    }))

    // Batch update prices in database
    const { error: priceError } = await supabase
      .from('market_prices')
      .upsert(priceUpdates, { onConflict: 'symbol' })

    if (priceError) {
      console.error('Price update error:', priceError)
      return new Response(
        JSON.stringify({ error: 'Failed to update prices' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check for price alerts
    let alertsTriggered = 0
    
    for (const priceData of priceUpdates) {
      // Get active alerts for this symbol
      const { data: alerts } = await supabase
        .from('user_alerts')
        .select(`
          *,
          users!inner(
            id,
            email,
            notification_preferences
          )
        `)
        .eq('ticker', priceData.symbol)
        .eq('is_active', true)

      if (alerts && alerts.length > 0) {
        for (const alert of alerts) {
          let triggered = false

          // Check alert conditions
          switch (alert.condition) {
            case 'price_above':
              triggered = priceData.price >= alert.target_price
              break
            case 'price_below':
              triggered = priceData.price <= alert.target_price
              break
            case 'change_above':
              triggered = priceData.change_percent_24h >= alert.target_price
              break
            case 'change_below':
              triggered = priceData.change_percent_24h <= alert.target_price
              break
          }

          if (triggered) {
            // Create notification
            await supabase
              .from('notifications')
              .insert({
                user_id: alert.user_id,
                type: 'price_alert',
                title: `Price Alert: ${priceData.symbol}`,
                message: `${priceData.symbol} is now $${priceData.price} (${priceData.change_percent_24h}% change)`,
                channels: alert.users.notification_preferences?.channels || ['app'],
                is_sent: false
              })

            // Disable the alert (one-time trigger)
            await supabase
              .from('user_alerts')
              .update({ is_active: false })
              .eq('id', alert.id)

            alertsTriggered++
          }
        }
      }
    }

    // Broadcast price updates to real-time subscribers
    const channel = supabase.channel('market_prices')
    
    try {
      const subscribeStatus = await channel.subscribe()
      
      if (subscribeStatus === 'SUBSCRIBED') {
        const broadcastResult = await channel.send({
          type: 'broadcast',
          event: 'price_update',
          payload: {
            prices: priceUpdates,
            timestamp: new Date().toISOString()
          }
        })

        if (broadcastResult !== 'ok') {
          console.error(`Failed to broadcast price updates: ${broadcastResult}`)
        }
      } else {
        console.error(`Failed to subscribe to channel: ${subscribeStatus}`)
      }
    } catch (error) {
      console.error('Realtime broadcast error:', error)
    } finally {
      // Cleanup channel to prevent connection leaks
      await channel.unsubscribe()
      supabase.removeChannel(channel)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Market data synchronized successfully',
        prices_updated: priceUpdates.length,
        alerts_triggered: alertsTriggered,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Market data sync error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})