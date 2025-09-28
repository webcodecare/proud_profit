import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { type, recipient, subject, message } = await request.json()

    if (!type || !recipient || !message) {
      return NextResponse.json(
        { error: 'Type, recipient, and message are required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    
    // For testing, we'll just log the notification and store it
    const testNotification = {
      id: `test-${Date.now()}`,
      type,
      recipient,
      subject: subject || 'Test Notification',
      message,
      status: 'sent',
      timestamp: new Date().toISOString(),
      provider: type === 'email' ? 'sendgrid' : type === 'sms' ? 'twilio' : 'push'
    }

    console.log('Test notification:', testNotification)

    // If we have a user ID, store in notifications table
    if (recipient.includes('@')) {
      // Email-based lookup
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', recipient)
        .single()

      if (user) {
        const { data: notification } = await supabase
          .from('notifications')
          .insert({
            user_id: user.id,
            type: 'test_notification',
            title: subject || 'Test Notification',
            message,
            channels: [type],
            is_sent: true,
            sent_at: new Date().toISOString()
          })
          .select()
          .single()
      }
    }

    return NextResponse.json({
      message: 'Test notification sent successfully',
      notification: testNotification,
      note: 'This is a test notification and was not actually sent to external services'
    })

  } catch (error) {
    console.error('Test notification error:', error)
    return NextResponse.json(
      { error: 'Failed to send test notification' },
      { status: 500 }
    )
  }
}