import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'
import { requireUserAuth } from '../../../../../lib/auth-utils'

interface RouteParams {
  params: {
    id: string
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Check user authentication
    const { user, error, status } = await requireUserAuth(request)
    if (error || !user) {
      return NextResponse.json({ error }, { status })
    }
    
    const supabase = createClient()

    const { id } = params

    const { error: deleteError } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Notification delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete notification' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Notification deleted successfully'
    })

  } catch (error) {
    console.error('Notification delete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}