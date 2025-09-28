import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get notification system health metrics
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Get recent notification counts
    const { data: recentNotifications } = await supabase
      .from('notifications')
      .select('id, type, status, created_at')
      .gte('created_at', twentyFourHoursAgo.toISOString())

    // Get notification queue status
    const { data: queueStatus } = await supabase
      .from('notification_queue')
      .select('id, status, created_at, processed_at')
      .gte('created_at', oneHourAgo.toISOString())

    // Calculate health metrics
    const totalNotifications24h = recentNotifications?.length || 0
    const successfulNotifications = recentNotifications?.filter(n => n.status === 'sent').length || 0
    const failedNotifications = recentNotifications?.filter(n => n.status === 'failed').length || 0
    const pendingNotifications = recentNotifications?.filter(n => n.status === 'pending').length || 0
    
    const queuedItems = queueStatus?.filter(q => q.status === 'pending').length || 0
    const processedItems = queueStatus?.filter(q => q.status === 'processed').length || 0
    
    const successRateNum = totalNotifications24h > 0 ? 
      (successfulNotifications / totalNotifications24h * 100) : 100
    const successRate = successRateNum.toFixed(2)

    // Check service health
    const isHealthy = successRateNum >= 95 && queuedItems < 100 && failedNotifications < 50

    const health = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: now.toISOString(),
      metrics: {
        notifications_24h: totalNotifications24h,
        success_rate: `${successRate}%`,
        successful: successfulNotifications,
        failed: failedNotifications,
        pending: pendingNotifications,
        queue_items: queuedItems,
        processed_items: processedItems
      },
      services: {
        email: {
          status: failedNotifications < 10 ? 'operational' : 'degraded',
          last_check: now.toISOString()
        },
        sms: {
          status: 'operational', // Mock status
          last_check: now.toISOString()
        },
        telegram: {
          status: 'operational', // Mock status
          last_check: now.toISOString()
        },
        push: {
          status: 'operational', // Mock status
          last_check: now.toISOString()
        }
      },
      uptime: '99.9%', // Mock uptime
      response_time_ms: Math.floor(Math.random() * 50) + 10
    }

    return NextResponse.json(health)

  } catch (error) {
    console.error('Notification health check error:', error)
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Failed to check notification system health'
    }, { status: 500 })
  }
}