import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'
import { requireUserAuth } from '../../../../../lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    // Check user authentication
    const { user, error, status } = await requireUserAuth(request)
    if (error || !user) {
      return NextResponse.json({ error }, { status })
    }
    
    const supabase = createClient()

    // Get user settings from the user profile
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 })
    }

    // Export all user settings in a structured format
    const exportData = {
      user_id: user.id,
      export_date: new Date().toISOString(),
      version: '1.0',
      settings: {
        profile: {
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
          timezone: profile.timezone || 'UTC'
        },
        notifications: profile.notification_preferences || {
          email_enabled: true,
          sms_enabled: false,
          channels: ['app']
        },
        preferences: {
          theme: profile.theme || 'dark',
          language: profile.language || 'en',
          currency: profile.currency || 'USD',
          defaultChartType: profile.default_chart_type || 'candlestick',
          defaultTimeframe: profile.default_timeframe || '1h'
        },
        subscription: {
          tier: profile.subscription_tier,
          status: profile.subscription_status,
          expires_at: profile.subscription_expires_at
        }
      }
    }

    // Set content disposition for file download
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="proud-profit-settings-${user.id}-${new Date().toISOString().split('T')[0]}.json"`
      }
    })

  } catch (error) {
    console.error('Settings export error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}