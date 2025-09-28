import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '../../../../lib/supabase/server'
import { requireAdminRole } from '../../../../lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication and role
    const { error: authError, status } = await requireAdminRole(request)
    if (authError) {
      return NextResponse.json({ error: authError }, { status })
    }
    
    const supabase = createServiceClient()
    
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const level = searchParams.get('level') // error, warn, info, debug
    const source = searchParams.get('source') // api, auth, payment, notification
    
    let query = supabase
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (level) {
      query = query.eq('level', level)
    }
    
    if (source) {
      query = query.eq('source', source)
    }
    
    const { data: logs, error: queryError } = await query
    
    if (queryError) {
      console.error('Failed to fetch logs:', queryError)
      return NextResponse.json(
        { error: 'Failed to fetch system logs' },
        { status: 500 }
      )
    }
    
    // Get total count for pagination
    let countQuery = supabase
      .from('system_logs')
      .select('*', { count: 'exact', head: true })
    
    if (level) countQuery = countQuery.eq('level', level)
    if (source) countQuery = countQuery.eq('source', source)
    
    const { count } = await countQuery
    
    return NextResponse.json({
      logs: logs || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      },
      filters: {
        level,
        source
      }
    })
    
  } catch (error) {
    console.error('Admin logs API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}