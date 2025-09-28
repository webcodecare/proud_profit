import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '../../../../lib/supabase/server'
import { requireAdminRole } from '../../../../lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication and role
    const { error, status } = await requireAdminRole(request)
    if (error) {
      return NextResponse.json({ error }, { status })
    }
    
    // Use service client for admin operations
    const serviceSupabase = createServiceClient()

    // Get analytics data
    const [
      { count: totalUsers },
      { count: totalSignals },
      { count: totalAlerts }
    ] = await Promise.all([
      serviceSupabase.from('users').select('*', { count: 'exact', head: true }),
      serviceSupabase.from('signals').select('*', { count: 'exact', head: true }),
      serviceSupabase.from('alerts').select('*', { count: 'exact', head: true })
    ])

    // Get recent activity
    const { data: recentUsers } = await serviceSupabase
      .from('users')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(30)

    return NextResponse.json({
      totalUsers,
      totalSignals,
      totalAlerts,
      recentUsers: recentUsers?.length || 0,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Admin analytics error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}