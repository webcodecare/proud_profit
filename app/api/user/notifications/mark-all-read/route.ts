import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'
import { requireUserAuth } from '../../../../../lib/auth-utils'

export async function PUT(request: NextRequest) {
  try {
    // Check user authentication
    const { user, error, status } = await requireUserAuth(request)
    if (error || !user) {
      return NextResponse.json({ error }, { status })
    }
    
    const supabase = createClient()

    const { data: notifications, error: supabaseError } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .select('id')

    if (supabaseError) {
      console.error('Mark all notifications read error:', supabaseError)
      return NextResponse.json({ error: 'Failed to mark all notifications as read' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: `Marked ${notifications?.length || 0} notifications as read`
    })

  } catch (error) {
    console.error('Mark all notifications read error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}