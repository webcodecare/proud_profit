import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      const requestText = await request.text()
      if (!requestText.trim()) {
        return NextResponse.json(
          { error: 'Empty request body' },
          { status: 400 }
        )
      }
      body = JSON.parse(requestText)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }
    const supabase = createClient()
    
    // Validate webhook data with Zod
    const { tradingViewWebhookSchema } = await import('../../../../lib/validation')
    const validationResult = tradingViewWebhookSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Validation failed', 
        details: validationResult.error.errors 
      }, { status: 422 })
    }

    const { symbol, action, price, timeframe, message, strategy } = validationResult.data

    // Log webhook receipt
    console.log('TradingView webhook received:', validationResult.data)

    // Create signal from TradingView webhook
    const { data: signal, error } = await supabase
      .from('signals')
      .insert({
        symbol: symbol.toUpperCase(),
        type: action, // buy, sell, hold
        price: price || 0,
        timeframe: timeframe || '1h',
        message: message || `TradingView ${action} signal for ${symbol}`,
        source: 'tradingview',
        strategy: strategy || 'default',
        confidence: 85,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating signal from webhook:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Send notifications to subscribed users
    const { data: users } = await supabase
      .from('alerts')
      .select(`
        user_id,
        users (*)
      `)
      .eq('symbol', symbol.toUpperCase())
      .eq('is_active', true)

    if (users && users.length > 0) {
      const notifications = users.map(alert => ({
        user_id: alert.user_id,
        message: `📈 TradingView ${action.toUpperCase()} signal for ${symbol} at $${price}`,
        type: 'trading_signal',
        read: false,
        created_at: new Date().toISOString()
      }))

      await supabase
        .from('notifications')
        .insert(notifications)
    }

    return NextResponse.json({
      success: true,
      signal,
      notified_users: users?.length || 0,
      processed_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('TradingView webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}