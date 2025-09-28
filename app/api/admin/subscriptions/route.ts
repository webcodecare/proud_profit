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
    const subscriptionStatus = searchParams.get('status')

    // Get subscriptions with user details
    let query = supabase
      .from('subscriptions')
      .select(`
        *,
        users (
          id,
          email,
          first_name,
          last_name
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (subscriptionStatus) {
      query = query.eq('status', subscriptionStatus)
    }

    const { data: subscriptions, error: queryError } = await query

    if (queryError) {
      throw queryError
    }

    // Get subscription stats
    const { count: totalCount } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact' })

    const { count: activeCount } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact' })
      .eq('status', 'active')

    return NextResponse.json({
      subscriptions: subscriptions || [],
      pagination: {
        total: totalCount || 0,
        offset,
        limit,
        has_more: (totalCount || 0) > offset + limit
      },
      stats: {
        total_subscriptions: totalCount || 0,
        active_subscriptions: activeCount || 0,
        inactive_subscriptions: (totalCount || 0) - (activeCount || 0)
      }
    })

  } catch (error) {
    console.error('Get subscriptions error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}