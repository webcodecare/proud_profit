import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get the webhook payload
    let payload;
    try {
      const requestText = await request.text()
      if (!requestText.trim()) {
        return NextResponse.json(
          { error: 'Empty request body' },
          { status: 400 }
        )
      }
      payload = JSON.parse(requestText)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }
    const webhookType = request.headers.get('x-webhook-type') || 'unknown'
    const signature = request.headers.get('x-signature')
    
    // Log webhook receipt
    const webhookLog = {
      webhook_type: webhookType,
      payload,
      signature: signature || null,
      received_at: new Date().toISOString(),
      processed: false,
      source_ip: request.headers.get('x-forwarded-for') || 'unknown'
    }
    
    const { data: logEntry, error: logError } = await supabase
      .from('webhook_logs')
      .insert(webhookLog)
      .select()
      .single()
    
    if (logError) {
      console.error('Failed to log webhook:', logError)
    }
    
    // Process webhook based on type
    let processingResult: any = { success: false }
    
    switch (webhookType) {
      case 'payment':
        processingResult = await processPaymentWebhook(payload, supabase)
        break
      case 'trading':
        processingResult = await processTradingWebhook(payload, supabase)
        break
      case 'notification':
        processingResult = await processNotificationWebhook(payload, supabase)
        break
      case 'market_data':
        processingResult = await processMarketDataWebhook(payload, supabase)
        break
      default:
        processingResult = { success: false, message: 'Unknown webhook type' }
    }
    
    // Update log with processing result
    if (logEntry) {
      await supabase
        .from('webhook_logs')
        .update({
          processed: processingResult.success,
          processing_result: processingResult,
          processed_at: new Date().toISOString()
        })
        .eq('id', logEntry.id)
    }
    
    return NextResponse.json({
      message: 'Webhook received and processed',
      webhook_id: logEntry?.id,
      processing_result: processingResult
    })
    
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function processPaymentWebhook(payload: any, supabase: any) {
  try {
    if (payload.event_type === 'payment.completed') {
      // Update payment status
      const { error } = await supabase
        .from('payments')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
          external_id: payload.payment_id
        })
        .eq('external_id', payload.payment_id)
      
      return { success: !error, message: error ? error.message : 'Payment updated' }
    }
    
    return { success: false, message: 'Unhandled payment event' }
  } catch (error) {
    return { success: false, message: `Payment processing error: ${error}` }
  }
}

async function processTradingWebhook(payload: any, supabase: any) {
  try {
    if (payload.event_type === 'trade.executed') {
      // Update trade status
      const { error } = await supabase
        .from('trades')
        .update({
          status: 'executed',
          executed_at: new Date().toISOString(),
          execution_price: payload.execution_price
        })
        .eq('trade_id', payload.trade_id)
      
      return { success: !error, message: error ? error.message : 'Trade updated' }
    }
    
    return { success: false, message: 'Unhandled trading event' }
  } catch (error) {
    return { success: false, message: `Trading processing error: ${error}` }
  }
}

async function processNotificationWebhook(payload: any, supabase: any) {
  try {
    if (payload.event_type === 'notification.delivered') {
      // Update notification delivery status
      const { error } = await supabase
        .from('notifications')
        .update({
          delivered: true,
          delivered_at: new Date().toISOString()
        })
        .eq('id', payload.notification_id)
      
      return { success: !error, message: error ? error.message : 'Notification updated' }
    }
    
    return { success: false, message: 'Unhandled notification event' }
  } catch (error) {
    return { success: false, message: `Notification processing error: ${error}` }
  }
}

async function processMarketDataWebhook(payload: any, supabase: any) {
  try {
    if (payload.event_type === 'price.updated') {
      // Update market data
      const { error } = await supabase
        .from('market_data')
        .upsert({
          symbol: payload.symbol,
          price: payload.price,
          volume: payload.volume,
          timestamp: new Date().toISOString()
        }, {
          onConflict: 'symbol'
        })
      
      return { success: !error, message: error ? error.message : 'Market data updated' }
    }
    
    return { success: false, message: 'Unhandled market data event' }
  } catch (error) {
    return { success: false, message: `Market data processing error: ${error}` }
  }
}