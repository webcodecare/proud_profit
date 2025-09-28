import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const type = searchParams.get('type')

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (type) {
      query = query.eq('type', type)
    }

    const { data: notifications, error } = await query

    if (error) {
      console.error('Notification history fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch notification history' }, { status: 500 })
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (type) {
      countQuery = countQuery.eq('type', type)
    }

    const { count } = await countQuery

    return NextResponse.json({
      notifications: notifications || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      },
      summary: {
        totalNotifications: count || 0,
        unreadCount: notifications?.filter(n => !n.is_read).length || 0,
        lastNotification: notifications?.[0]?.created_at || null
      }
    })

  } catch (error) {
    console.error('Notification history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}