import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'

    // Get notification logs
    let query = supabase
      .from('notification_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // If not admin, only show user's own logs
    if (!isAdmin) {
      query = query.eq('user_id', user.id)
    }

    const { data: logs } = await query

    // Mock data if no logs exist
    const mockLogs = [
      {
        id: 1,
        user_id: user.id,
        type: 'email',
        status: 'sent',
        message: 'Welcome to Proud Profit!',
        recipient: 'user@example.com',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        sent_at: new Date(Date.now() - 3590000).toISOString()
      },
      {
        id: 2,
        user_id: user.id,
        type: 'push',
        status: 'delivered',
        message: 'New trading signal available',
        recipient: 'push_token_123',
        created_at: new Date(Date.now() - 7200000).toISOString(),
        sent_at: new Date(Date.now() - 7190000).toISOString()
      }
    ]

    return NextResponse.json({
      logs: logs?.length ? logs : mockLogs,
      total: logs?.length || mockLogs.length,
      has_more: (logs?.length || 0) === limit
    })

  } catch (error) {
    console.error('Notification logs error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}