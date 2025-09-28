import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { requireUserAuth } from '../../../../lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    // Check user authentication
    const { user, error: authError, status, supabase } = await requireUserAuth(request)
    if (authError) {
      return NextResponse.json({ error: authError }, { status })
    }
    
    if (!user || !supabase) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const read = searchParams.get('read')

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (read !== null) {
      query = query.eq('is_read', read === 'true')
    }

    const { data: notifications, error: dbError } = await query

    if (dbError) {
      console.error('Notifications fetch error:', dbError)
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
    }

    return NextResponse.json({ 
      notifications: notifications || [],
      pagination: {
        limit,
        offset,
        total: notifications?.length || 0
      }
    })

  } catch (error) {
    console.error('Notifications error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}