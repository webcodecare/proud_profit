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

    // Get the notification to verify ownership
    const { data: notification, error: fetchError } = await supabase
      .from('notifications')
      .select('id, user_id, status')
      .eq('id', notificationId)
      .single()

    if (fetchError || !notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    // Check if user owns the notification or is admin
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

    // Archive the notification
    const { error: archiveError } = await supabase
      .from('notifications')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', notificationId)

    if (archiveError) {
      console.error('Failed to archive notification:', archiveError)
      return NextResponse.json(
        { error: 'Failed to archive notification' },
        { status: 500 }
      )
    }

    // Log the archive action
    await supabase
      .from('notification_logs')
      .insert({
        notification_id: notificationId,
        action: 'archived',
        user_id: user.id,
        details: { archived_by: isAdmin ? 'admin' : 'user' },
        created_at: new Date().toISOString()
      })

    return NextResponse.json({
      message: 'Notification archived successfully',
      notification_id: notificationId,
      archived_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('Archive notification error:', error)
    return NextResponse.json(
      { error: 'Failed to archive notification' },
      { status: 500 }
    )
  }
}