import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { notification_ids } = await request.json()
    
    if (!notification_ids || !Array.isArray(notification_ids)) {
      return NextResponse.json(
        { error: 'notification_ids array is required' },
        { status: 400 }
      )
    }
    
    const { data: updatedNotifications, error } = await supabase
      .from('notifications')
      .update({ 
        read: true, 
        read_at: new Date().toISOString() 
      })
      .eq('user_id', user.id)
      .in('id', notification_ids)
      .select()
    
    if (error) {
      console.error('Failed to mark notifications as read:', error)
      return NextResponse.json(
        { error: 'Failed to mark notifications as read' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      message: `${updatedNotifications?.length || 0} notifications marked as read`,
      updated_notifications: updatedNotifications
    })
    
  } catch (error) {
    console.error('Mark notifications read error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}