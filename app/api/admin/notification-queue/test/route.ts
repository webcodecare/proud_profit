import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { message, type } = await request.json()

    // Create test notification
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: user.id,
        message: message || 'Test notification from admin panel',
        type: type || 'test',
        status: 'pending',
        is_test: true
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Simulate processing
    setTimeout(async () => {
      await supabase
        .from('notifications')
        .update({ status: 'sent' })
        .eq('id', notification.id)
    }, 1000)

    return NextResponse.json({ 
      message: 'Test notification created successfully',
      notification 
    })

  } catch (error) {
    console.error('Test notification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}