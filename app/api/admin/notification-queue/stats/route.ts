import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
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

    // Get notification queue statistics
    const { data: notifications } = await supabase
      .from('notifications')
      .select('status, created_at')
      .order('created_at', { ascending: false })

    const stats = {
      total: notifications?.length || 0,
      pending: notifications?.filter(n => n.status === 'pending').length || 0,
      sent: notifications?.filter(n => n.status === 'sent').length || 0,
      failed: notifications?.filter(n => n.status === 'failed').length || 0,
      processing: notifications?.filter(n => n.status === 'processing').length || 0,
      todayCount: notifications?.filter(n => {
        const today = new Date().toDateString()
        return new Date(n.created_at).toDateString() === today
      }).length || 0,
      timestamp: new Date().toISOString()
    }

    return NextResponse.json({ stats })

  } catch (error) {
    console.error('Notification queue stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}