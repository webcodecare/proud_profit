import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get user's security settings
    const { data: securitySettings, error } = await supabase
      .from('user_security_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    if (error && error.code !== 'PGRST116') {
      console.error('Failed to fetch security settings:', error)
      return NextResponse.json(
        { error: 'Failed to fetch security settings' },
        { status: 500 }
      )
    }
    
    // Get recent security events
    const { data: securityEvents } = await supabase
      .from('security_events')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
    
    // Default settings if none exist
    const defaultSettings = {
      two_factor_enabled: false,
      login_notifications: true,
      suspicious_activity_alerts: true,
      api_access_enabled: false,
      session_timeout: 3600, // 1 hour
      allowed_ip_ranges: [],
      last_password_change: null
    }
    
    return NextResponse.json({
      security_settings: securitySettings || defaultSettings,
      recent_events: securityEvents || [],
      is_default: !securitySettings
    })
    
  } catch (error) {
    console.error('Security settings API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const updateData = await request.json()
    
    const allowedFields = [
      'two_factor_enabled',
      'login_notifications',
      'suspicious_activity_alerts',
      'api_access_enabled',
      'session_timeout',
      'allowed_ip_ranges'
    ]
    
    const filteredData = Object.keys(updateData)
      .filter(key => allowedFields.includes(key))
      .reduce((obj: any, key) => {
        obj[key] = updateData[key]
        return obj
      }, {})
    
    if (Object.keys(filteredData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }
    
    filteredData.updated_at = new Date().toISOString()
    
    const { data: updatedSettings, error } = await supabase
      .from('user_security_settings')
      .upsert({
        user_id: user.id,
        ...filteredData
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single()
    
    if (error) {
      console.error('Failed to update security settings:', error)
      return NextResponse.json(
        { error: 'Failed to update security settings' },
        { status: 500 }
      )
    }
    
    // Log security settings change
    await supabase
      .from('security_events')
      .insert({
        user_id: user.id,
        event_type: 'settings_updated',
        description: 'Security settings updated',
        metadata: { updated_fields: Object.keys(filteredData) },
        created_at: new Date().toISOString()
      })
    
    return NextResponse.json({
      message: 'Security settings updated successfully',
      security_settings: updatedSettings
    })
    
  } catch (error) {
    console.error('Update security settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}