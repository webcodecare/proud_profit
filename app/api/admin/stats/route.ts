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
    
    const supabase = createServiceClient()

    const now = new Date()
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Get all statistics in a single optimized query to minimize database round trips
    const { data: statsData, error: statsError } = await supabase.rpc('get_admin_stats', {
      week_start: lastWeek.toISOString(),
      month_start: lastMonth.toISOString()
    })

    if (statsError) {
      console.error('Failed to fetch admin stats:', statsError)
      // If RPC doesn't exist, fall back to individual queries but handle errors properly
      try {
        const [
          { count: totalUsers, error: usersError },
          { count: newUsersThisWeek, error: newUsersError },
          { count: activeUsers, error: activeUsersError },
          { count: freeUsers, error: freeUsersError },
          { count: premiumUsers, error: premiumUsersError },
          { count: eliteUsers, error: eliteUsersError },
          { count: totalSubscriptions, error: subsTotalError },
          { count: activeSubscriptions, error: subsActiveError },
          { count: signalsThisMonth, error: signalsError },
          { count: notificationsThisWeek, error: notificationsError },
          { count: successfulNotifications, error: successfulNotifError }
        ] = await Promise.all([
          supabase.from('users').select('*', { count: 'exact', head: true }),
          supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', lastWeek.toISOString()),
          supabase.from('users').select('*', { count: 'exact', head: true }).gte('last_sign_in_at', lastWeek.toISOString()),
          supabase.from('users').select('*', { count: 'exact', head: true }).eq('subscription_tier', 'free'),
          supabase.from('users').select('*', { count: 'exact', head: true }).eq('subscription_tier', 'premium'),
          supabase.from('users').select('*', { count: 'exact', head: true }).eq('subscription_tier', 'elite'),
          supabase.from('user_subscriptions').select('*', { count: 'exact', head: true }),
          supabase.from('user_subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('signals').select('*', { count: 'exact', head: true }).gte('created_at', lastMonth.toISOString()),
          supabase.from('notifications').select('*', { count: 'exact', head: true }).gte('created_at', lastWeek.toISOString()),
          supabase.from('notifications').select('*', { count: 'exact', head: true }).gte('created_at', lastWeek.toISOString()).eq('status', 'sent')
        ])

        // Check for any database errors
        const errors = [usersError, newUsersError, activeUsersError, freeUsersError, premiumUsersError, eliteUsersError, subsTotalError, subsActiveError, signalsError, notificationsError, successfulNotifError].filter(Boolean)
        if (errors.length > 0) {
          console.error('Database errors in admin stats:', errors)
          return NextResponse.json(
            { error: 'Failed to fetch some statistics', details: errors },
            { status: 500 }
          )
        }

        const totalRevenue = (totalSubscriptions || 0) * 29.99 // Mock calculation

        // System health metrics (mock data)
        const systemHealth = {
          cpu_usage: Math.floor(Math.random() * 30) + 20,
          memory_usage: Math.floor(Math.random() * 40) + 30,
          disk_usage: Math.floor(Math.random() * 20) + 10,
          uptime_hours: Math.floor(Math.random() * 168) + 24
        }

        return NextResponse.json({
          overview: {
            total_users: totalUsers || 0,
            new_users_this_week: newUsersThisWeek || 0,
            active_users: activeUsers || 0,
            active_subscriptions: activeSubscriptions || 0,
            total_revenue: totalRevenue,
            signals_this_month: signalsThisMonth || 0,
            notifications_this_week: notificationsThisWeek || 0
          },
          user_breakdown: {
            free_users: freeUsers || 0,
            premium_users: premiumUsers || 0,
            elite_users: eliteUsers || 0
          },
          system_health: systemHealth,
          notification_stats: {
            total_sent: notificationsThisWeek || 0,
            successful: successfulNotifications || 0,
            success_rate: (notificationsThisWeek || 0) > 0 ? 
              Math.round(((successfulNotifications || 0) / (notificationsThisWeek || 0)) * 100) : 100
          },
          growth_metrics: {
            user_growth_rate: (newUsersThisWeek || 0) > 0 && (totalUsers || 0) > 0 ? 
              Math.round(((newUsersThisWeek || 0) / (totalUsers || 0)) * 100) : 0,
            subscription_conversion: (totalUsers || 0) > 0 ? 
              Math.round(((activeSubscriptions || 0) / (totalUsers || 0)) * 100) : 0
          },
          generated_at: now.toISOString()
        })
      } catch (fallbackError) {
        console.error('Fallback query failed:', fallbackError)
        return NextResponse.json(
          { error: 'Failed to fetch admin statistics' },
          { status: 500 }
        )
      }
    }

    // If RPC succeeded, use its data
    return NextResponse.json({
      overview: {
        total_users: statsData?.total_users || 0,
        new_users_this_week: statsData?.new_users_this_week || 0,
        active_users: statsData?.active_users || 0,
        active_subscriptions: statsData?.active_subscriptions || 0,
        total_revenue: (statsData?.total_subscriptions || 0) * 29.99,
        signals_this_month: statsData?.signals_this_month || 0,
        notifications_this_week: statsData?.notifications_this_week || 0
      },
      user_breakdown: {
        free_users: statsData?.free_users || 0,
        premium_users: statsData?.premium_users || 0,
        elite_users: statsData?.elite_users || 0
      },
      system_health: {
        cpu_usage: Math.floor(Math.random() * 30) + 20,
        memory_usage: Math.floor(Math.random() * 40) + 30,
        disk_usage: Math.floor(Math.random() * 20) + 10,
        uptime_hours: Math.floor(Math.random() * 168) + 24
      },
      notification_stats: {
        total_sent: statsData?.notifications_this_week || 0,
        successful: statsData?.successful_notifications || 0,
        success_rate: (statsData?.notifications_this_week || 0) > 0 ? 
          Math.round(((statsData?.successful_notifications || 0) / (statsData?.notifications_this_week || 0)) * 100) : 100
      },
      growth_metrics: {
        user_growth_rate: (statsData?.new_users_this_week || 0) > 0 && (statsData?.total_users || 0) > 0 ? 
          Math.round(((statsData?.new_users_this_week || 0) / (statsData?.total_users || 0)) * 100) : 0,
        subscription_conversion: (statsData?.total_users || 0) > 0 ? 
          Math.round(((statsData?.active_subscriptions || 0) / (statsData?.total_users || 0)) * 100) : 0
      },
      generated_at: now.toISOString()
    })

  } catch (error) {
    console.error('Admin stats error:', error)
    return NextResponse.json(
      { error: 'Failed to get admin statistics' },
      { status: 500 }
    )
  }
}