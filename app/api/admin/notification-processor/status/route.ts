import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get user and verify admin role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    // Get notification processor status
    const { data: stats } = await supabase
      .from('notification_queue')
      .select('status')
      .order('created_at', { ascending: false })
      .limit(100)
    
    const totalNotifications = stats?.length || 0
    const pendingCount = stats?.filter(s => s.status === 'pending').length || 0
    const sentCount = stats?.filter(s => s.status === 'sent').length || 0
    const failedCount = stats?.filter(s => s.status === 'failed').length || 0
    
    return NextResponse.json({
      status: 'running',
      processor_active: true,
      last_processed: new Date().toISOString(),
      queue_stats: {
        total: totalNotifications,
        pending: pendingCount,
        sent: sentCount,
        failed: failedCount
      },
      processing_interval: 30, // seconds
      batch_size: 10
    })
    
  } catch (error) {
    console.error('Notification processor status error:', error)
    return NextResponse.json(
      { error: 'Failed to get processor status' },
      { status: 500 }
    )
  }
}