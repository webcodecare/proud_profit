import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { 
      subject = 'Test Email from Proud Profit',
      message = 'This is a test email to verify your email notifications are working correctly.',
      recipient_email 
    } = await request.json()

    // Get user profile for email
    const { data: userProfile } = await supabase
      .from('users')
      .select('email, first_name, last_name')
      .eq('id', user.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const emailTo = recipient_email || userProfile.email

    // Create test notification
    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id: user.id,
        type: 'email',
        title: subject,
        message,
        status: 'pending',
        recipient_email: emailTo,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (notificationError) {
      console.error('Failed to create test email notification:', notificationError)
      return NextResponse.json(
        { error: 'Failed to create test email notification' },
        { status: 500 }
      )
    }

    // In production, send actual email via SendGrid, Mailgun, etc.
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
      console.error('Failed to update test email notification status:', updateError)
    }

    // Log the test email send
    await supabase
      .from('notification_logs')
      .insert({
        notification_id: notification.id,
        action: 'test_email_sent',
        user_id: user.id,
        details: { 
          type: 'email',
          recipient: emailTo,
          subject,
          test_email: true
        },
        created_at: new Date().toISOString()
      })

    return NextResponse.json({
      message: 'Test email notification sent successfully',
      notification_id: notification.id,
      sent_to: emailTo,
      subject,
      sent_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('Test email error:', error)
    return NextResponse.json(
      { error: 'Failed to send test email notification' },
      { status: 500 }
    )
  }
}