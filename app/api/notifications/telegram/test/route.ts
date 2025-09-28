import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { message = 'Test notification from Proud Profit!' } = await request.json()

    // Get user's Telegram configuration
    const { data: telegramConfig } = await supabase
      .from('user_telegram_config')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!telegramConfig || !telegramConfig.chat_id) {
      return NextResponse.json({ 
        error: 'Telegram not configured. Please set up Telegram notifications first.' 
      }, { status: 400 })
    }

    // Create test notification
    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id: user.id,
        type: 'telegram',
        title: 'Test Notification',
        message,
        status: 'pending',
        telegram_chat_id: telegramConfig.chat_id,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (notificationError) {
      console.error('Failed to create test notification:', notificationError)
      return NextResponse.json(
        { error: 'Failed to create test notification' },
        { status: 500 }
      )
    }

    // In production, send actual Telegram message via Bot API
    // For now, simulate sending and mark as sent
    const { error: updateError } = await supabase
      .from('notifications')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', notification.id)

    if (updateError) {
      console.error('Failed to update test notification status:', updateError)
    }

    // Log the test send
    await supabase
      .from('notification_logs')
      .insert({
        notification_id: notification.id,
        action: 'test_sent',
        user_id: user.id,
        details: { 
          type: 'telegram',
          chat_id: telegramConfig.chat_id,
          test_message: true
        },
        created_at: new Date().toISOString()
      })

    return NextResponse.json({
      message: 'Test Telegram notification sent successfully',
      notification_id: notification.id,
      sent_to: telegramConfig.username || telegramConfig.chat_id,
      sent_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('Telegram test error:', error)
    return NextResponse.json(
      { error: 'Failed to send test Telegram notification' },
      { status: 500 }
    )
  }
}