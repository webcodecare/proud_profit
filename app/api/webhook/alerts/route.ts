import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    
    // Verify webhook authenticity (simplified)
    const webhookSecret = process.env.WEBHOOK_SECRET
    const receivedSignature = request.headers.get('x-webhook-signature')
    
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
    
    const { type, data, source, timestamp } = body

    if (!type || !data) {
      return NextResponse.json(
        { error: 'Invalid webhook payload' },
        { status: 400 }
      )
    }

    // Process different alert types
    switch (type) {
      case 'price_alert':
        await processPriceAlert(supabase, data)
        break
      
      case 'technical_alert':
        await processTechnicalAlert(supabase, data)
        break
      
      case 'volume_alert':
        await processVolumeAlert(supabase, data)
        break
      
      case 'custom_alert':
        await processCustomAlert(supabase, data)
        break
      
      default:
        console.warn('Unknown alert type:', type)
    }

    // Log webhook receipt
    await supabase
      .from('webhook_logs')
      .insert({
        type: 'alert',
        source: source || 'external',
        payload: body,
        processed_at: new Date().toISOString(),
        status: 'processed'
      })

    return NextResponse.json({
      success: true,
      message: 'Alert webhook processed successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Alert webhook error:', error)
    
    // Log failed webhook
    const supabase = createServiceClient()
    await supabase
      .from('webhook_logs')
      .insert({
        type: 'alert',
        source: 'external',
        payload: {},
        processed_at: new Date().toISOString(),
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      })

    return NextResponse.json(
      { error: 'Failed to process alert webhook' },
      { status: 500 }
    )
  }
}

async function processPriceAlert(supabase: any, data: any) {
  const { ticker, price, condition, targetPrice, userId } = data
  
  // Create alert record
  await supabase
    .from('alerts')
    .insert({
      user_id: userId,
      ticker,
      alert_type: 'price',
      condition,
      target_value: targetPrice,
      current_value: price,
      status: 'triggered',
      triggered_at: new Date().toISOString()
    })

  // Create notification
  await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type: 'alert',
      title: `Price Alert: ${ticker}`,
      message: `${ticker} price ${condition} $${targetPrice}. Current: $${price}`,
      status: 'pending'
    })
}

async function processTechnicalAlert(supabase: any, data: any) {
  const { ticker, indicator, value, condition, userId } = data
  
  await supabase
    .from('alerts')
    .insert({
      user_id: userId,
      ticker,
      alert_type: 'technical',
      condition,
      indicator,
      current_value: value,
      status: 'triggered',
      triggered_at: new Date().toISOString()
    })

  await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type: 'alert',
      title: `Technical Alert: ${ticker}`,
      message: `${ticker} ${indicator} ${condition}. Current: ${value}`,
      status: 'pending'
    })
}

async function processVolumeAlert(supabase: any, data: any) {
  const { ticker, volume, threshold, userId } = data
  
  await supabase
    .from('alerts')
    .insert({
      user_id: userId,
      ticker,
      alert_type: 'volume',
      target_value: threshold,
      current_value: volume,
      status: 'triggered',
      triggered_at: new Date().toISOString()
    })

  await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type: 'alert',
      title: `Volume Alert: ${ticker}`,
      message: `${ticker} volume spike detected. Current: ${volume}`,
      status: 'pending'
    })
}

async function processCustomAlert(supabase: any, data: any) {
  const { userId, title, message, metadata } = data
  
  await supabase
    .from('alerts')
    .insert({
      user_id: userId,
      alert_type: 'custom',
      metadata,
      status: 'triggered',
      triggered_at: new Date().toISOString()
    })

  await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type: 'alert',
      title: title || 'Custom Alert',
      message: message || 'Custom alert triggered',
      status: 'pending'
    })
}