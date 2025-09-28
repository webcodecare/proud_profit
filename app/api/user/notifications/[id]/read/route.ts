import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../../lib/supabase/server'
import { requireUserAuth } from '../../../../../../lib/auth-utils'

interface RouteParams {
  params: {
    id: string
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Check user authentication
    const { user, error, status } = await requireUserAuth(request)
    if (error || !user) {
      return NextResponse.json({ error }, { status })
    }
    
    const supabase = createClient()

    const { id } = params

    const { data: notification, error: updateError } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Notification mark read error:', updateError)
      return NextResponse.json({ error: 'Failed to mark notification as read' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Notification marked as read',
      notification
    })

  } catch (error) {
    console.error('Notification mark read error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}