import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

interface RouteContext {
  params: {
    id: string
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = createClient()
    const { id: notificationId } = context.params
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the notification
    const { data: notification, error: fetchError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .single()

    if (fetchError || !notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    // Check permissions - only admin or notification owner can retry
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = userProfile?.role === 'admin'
    const isOwner = notification.user_id === user.id

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if notification can be retried
    if (notification.status === 'sent') {
      return NextResponse.json({ 
        error: 'Cannot retry successfully sent notification' 
      }, { status: 400 })
    }

    // Update notification status to pending for retry
    const { error: updateError } = await supabase
      .from('notifications')
      .update({
        status: 'pending',
        retry_count: (notification.retry_count || 0) + 1,
        last_retry_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', notificationId)

    if (updateError) {
      console.error('Failed to update notification for retry:', updateError)
      return NextResponse.json(
        { error: 'Failed to retry notification' },
        { status: 500 }
      )
    }

    // Add to notification queue for processing
    const { error: queueError } = await supabase
      .from('notification_queue')
      .insert({
        notification_id: notificationId,
        priority: 'high', // Retries get high priority
        scheduled_for: new Date().toISOString(),
        status: 'pending',
        created_at: new Date().toISOString()
      })

    if (queueError) {
      console.error('Failed to queue notification retry:', queueError)
      // Don't fail the request if queue insertion fails
    }

    // Log the retry action
    await supabase
      .from('notification_logs')
      .insert({
        notification_id: notificationId,
        action: 'retry_requested',
        user_id: user.id,
        details: { 
          retry_count: (notification.retry_count || 0) + 1,
          requested_by: isAdmin ? 'admin' : 'user'
        },
        created_at: new Date().toISOString()
      })

    return NextResponse.json({
      message: 'Notification queued for retry successfully',
      notification_id: notificationId,
      retry_count: (notification.retry_count || 0) + 1,
      queued_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('Retry notification error:', error)
    return NextResponse.json(
      { error: 'Failed to retry notification' },
      { status: 500 }
    )
  }
}