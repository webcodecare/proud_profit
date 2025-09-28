import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Reset user settings to defaults
    const defaultSettings = {
      timezone: 'UTC',
      theme: 'dark',
      language: 'en',
      currency: 'USD',
      default_chart_type: 'candlestick',
      default_timeframe: '1h',
      notification_preferences: {
        email_enabled: true,
        sms_enabled: false,
        channels: ['app']
      }
    }

    const { error } = await supabase
      .from('users')
      .update(defaultSettings)
      .eq('id', user.id)

    if (error) {
      console.error('Settings reset error:', error)
      return NextResponse.json({ error: 'Failed to reset settings' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Settings reset to defaults successfully',
      settings: {
        notificationEmail: true,
        notificationSms: false,
        theme: 'dark',
        language: 'en',
        timezone: 'UTC',
        currency: 'USD',
        defaultChartType: 'candlestick',
        defaultTimeframe: '1h'
      }
    })

  } catch (error) {
    console.error('Settings reset error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}