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

    // Get user settings from the user profile
    const { data: profile, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (dbError) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 })
    }

    // Format settings response from actual database fields
    const settings = {
      notificationEmail: profile.notification_preferences?.email_enabled ?? true,
      notificationSms: profile.notification_preferences?.sms_enabled ?? false,
      theme: profile.theme || 'dark',
      language: profile.language || 'en',
      timezone: profile.timezone || 'UTC',
      currency: profile.currency || 'USD',
      defaultChartType: profile.default_chart_type || 'candlestick',
      defaultTimeframe: profile.default_timeframe || '1h'
    }

    return NextResponse.json(settings)

  } catch (error) {
    console.error('Settings fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Check user authentication
    const { user, error: authError, status, supabase } = await requireUserAuth(request)
    if (authError) {
      return NextResponse.json({ error: authError }, { status })
    }
    
    if (!user || !supabase) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    const settings = await request.json()
    const { 
      notificationEmail, 
      notificationSms, 
      theme, 
      language, 
      timezone, 
      currency, 
      defaultChartType, 
      defaultTimeframe 
    } = settings

    // Update all user settings in database
    const { data: profile, error: updateError } = await supabase
      .from('users')
      .update({
        timezone: timezone,
        theme: theme,
        language: language,
        currency: currency,
        default_chart_type: defaultChartType,
        default_timeframe: defaultTimeframe,
        notification_preferences: {
          email_enabled: notificationEmail,
          sms_enabled: notificationSms,
          channels: ['app']
        }
      })
      .eq('id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Settings update error:', updateError)
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Settings updated successfully',
      settings: {
        notificationEmail,
        notificationSms,
        theme,
        language,
        timezone,
        currency,
        defaultChartType,
        defaultTimeframe
      }
    })

  } catch (error) {
    console.error('Settings update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Check user authentication
    const { user, error: authError, status, supabase } = await requireUserAuth(request)
    if (authError) {
      return NextResponse.json({ error: authError }, { status })
    }
    
    if (!user || !supabase) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    const partialSettings = await request.json()

    // Get current settings first
    const { data: currentProfile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!currentProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Merge with existing notification preferences
    const currentNotificationPrefs = currentProfile.notification_preferences || {}
    const updatedNotificationPrefs = { ...currentNotificationPrefs }

    if ('notificationEmail' in partialSettings) {
      updatedNotificationPrefs.email_enabled = partialSettings.notificationEmail
    }
    if ('notificationSms' in partialSettings) {
      updatedNotificationPrefs.sms_enabled = partialSettings.notificationSms
    }

    const updates: any = {}
    if ('timezone' in partialSettings) {
      updates.timezone = partialSettings.timezone
    }
    if ('theme' in partialSettings) {
      updates.theme = partialSettings.theme
    }
    if ('language' in partialSettings) {
      updates.language = partialSettings.language
    }
    if ('currency' in partialSettings) {
      updates.currency = partialSettings.currency
    }
    if ('defaultChartType' in partialSettings) {
      updates.default_chart_type = partialSettings.defaultChartType
    }
    if ('defaultTimeframe' in partialSettings) {
      updates.default_timeframe = partialSettings.defaultTimeframe
    }
    if ('notificationEmail' in partialSettings || 'notificationSms' in partialSettings) {
      updates.notification_preferences = updatedNotificationPrefs
    }

    // Update user settings
    const { error: patchError } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id)

    if (patchError) {
      console.error('Settings patch error:', patchError)
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Settings updated successfully',
      updated: partialSettings
    })

  } catch (error) {
    console.error('Settings patch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}