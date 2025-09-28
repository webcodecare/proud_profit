import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get notification statistics for the user
    const { data: notifications } = await supabase
      .from('notifications')
      .select('type, read, created_at')
      .eq('user_id', user.id)

    if (!notifications) {
      return NextResponse.json({
        total: 0,
        unread: 0,
        by_type: {},
        recent_activity: []
      })
    }

    const stats = {
      total: notifications.length,
      unread: notifications.filter(n => !n.read).length,
      by_type: notifications.reduce((acc: Record<string, number>, n) => {
        acc[n.type] = (acc[n.type] || 0) + 1
        return acc
      }, {}),
      recent_activity: notifications
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10)
        .map(n => ({
          type: n.type,
          read: n.read,
          created_at: n.created_at
        })),
      read_rate: notifications.length > 0 ? 
        Math.round(((notifications.length - notifications.filter(n => !n.read).length) / notifications.length) * 100) : 0
    }

    return NextResponse.json({ stats })

  } catch (error) {
    console.error('Notification stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}