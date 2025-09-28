import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const importData = await request.json()

    // Validate import data structure
    if (!importData || typeof importData !== 'object') {
      return NextResponse.json({ error: 'Invalid import data format' }, { status: 400 })
    }

    // Extract and validate settings
    const updates: any = {}
    let hasValidUpdates = false

    // Handle notification preferences
    if (importData.notificationEmail !== undefined || importData.notificationSms !== undefined) {
      updates.notification_preferences = {
        email_enabled: importData.notificationEmail ?? true,
        sms_enabled: importData.notificationSms ?? false,
        channels: ['app']
      }
      hasValidUpdates = true
    }

    // Handle direct settings fields
    const directFields = ['timezone', 'theme', 'language', 'currency']
    directFields.forEach(field => {
      if (importData[field] && typeof importData[field] === 'string') {
        if (field === 'theme' || field === 'language' || field === 'currency') {
          updates[field] = importData[field]
        } else {
          updates[field] = importData[field]
        }
        hasValidUpdates = true
      }
    })
    
    // Handle chart settings
    if (importData.defaultChartType && typeof importData.defaultChartType === 'string') {
      updates.default_chart_type = importData.defaultChartType
      hasValidUpdates = true
    }
    
    if (importData.defaultTimeframe && typeof importData.defaultTimeframe === 'string') {
      updates.default_timeframe = importData.defaultTimeframe
      hasValidUpdates = true
    }

    // Handle nested settings format (from export)
    if (importData.settings) {
      if (importData.settings.profile?.timezone) {
        updates.timezone = importData.settings.profile.timezone
        hasValidUpdates = true
      }
      if (importData.settings.notifications) {
        updates.notification_preferences = importData.settings.notifications
        hasValidUpdates = true
      }
      if (importData.settings.preferences) {
        const prefs = importData.settings.preferences
        if (prefs.theme) {
          updates.theme = prefs.theme
          hasValidUpdates = true
        }
        if (prefs.language) {
          updates.language = prefs.language
          hasValidUpdates = true
        }
        if (prefs.currency) {
          updates.currency = prefs.currency
          hasValidUpdates = true
        }
        if (prefs.defaultChartType) {
          updates.default_chart_type = prefs.defaultChartType
          hasValidUpdates = true
        }
        if (prefs.defaultTimeframe) {
          updates.default_timeframe = prefs.defaultTimeframe
          hasValidUpdates = true
        }
      }
    }

    if (!hasValidUpdates) {
      return NextResponse.json({ error: 'No valid settings found in import data' }, { status: 400 })
    }

    // Update user settings
    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id)

    if (error) {
      console.error('Settings import error:', error)
      return NextResponse.json({ error: 'Failed to import settings' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Settings imported successfully',
      imported_fields: Object.keys(updates)
    })

  } catch (error) {
    console.error('Settings import error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}