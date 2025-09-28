import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    
    // Extract TradingView webhook data
    const {
      ticker,
      action, // 'buy' or 'sell'
      price,
      time,
      timeframe,
      strategy,
      message
    } = payload

    if (!ticker || !action || !price) {
      return NextResponse.json(
        { error: 'Missing required fields: ticker, action, price' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Store the signal
    const { data: signal, error: signalError } = await supabase
      .from('signals')
      .insert({
        ticker: ticker.toUpperCase(),
        action: action.toLowerCase(),
        price: parseFloat(price),
        timeframe: timeframe || '1h',
        strategy: strategy || 'tradingview',
        message: message || `${action.toUpperCase()} signal for ${ticker}`,
        source: 'tradingview_webhook',
        timestamp: time ? new Date(time).toISOString() : new Date().toISOString(),
        is_active: true
      })
      .select()
      .single()

    if (signalError) {
      console.error('Signal storage error:', signalError)
      return NextResponse.json(
        { error: 'Failed to store signal' },
        { status: 500 }
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
      .eq('ticker', ticker.toUpperCase())
      .eq('is_active', true)

    // Queue notifications for matching alerts
    if (alerts && alerts.length > 0) {
      const notifications = alerts.map((alert: any) => ({
        user_id: alert.user_id,
        signal_id: signal.id,
        type: 'signal_alert',
        title: `${action.toUpperCase()} Signal: ${ticker}`,
        message: `${message || 'New signal'} - Price: $${price}`,
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

    return NextResponse.json({
      success: true,
      message: 'Signal processed successfully',
      signal: signal,
      notifications_queued: alerts?.length || 0
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}