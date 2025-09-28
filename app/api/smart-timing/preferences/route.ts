import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { data: preferences, error } = await supabase
      .from('smart_timing_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    if (error && error.code !== 'PGRST116') {
      console.error('Failed to fetch preferences:', error)
      return NextResponse.json(
        { error: 'Failed to fetch preferences' },
        { status: 500 }
      )
    }
    
    // If no preferences exist, return defaults
    if (!preferences) {
      const defaultPreferences = {
        enabled: false,
        timezone: 'UTC',
        quiet_hours_start: '22:00',
        quiet_hours_end: '08:00',
        preferred_frequency: 'daily',
        notification_types: ['signals', 'alerts', 'market_updates'],
        urgency_threshold: 'medium',
        learning_mode: true
      }
      
      return NextResponse.json({
        preferences: defaultPreferences,
        is_default: true
      })
    }
    
    return NextResponse.json({
      preferences,
      is_default: false
    })
    
  } catch (error) {
    console.error('Smart timing preferences error:', error)
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
    
    // Validate required fields
    const allowedFields = [
      'enabled',
      'timezone', 
      'quiet_hours_start',
      'quiet_hours_end',
      'preferred_frequency',
      'notification_types',
      'urgency_threshold',
      'learning_mode',
      'max_daily_notifications',
      'preferred_times'
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
    
    // Add metadata
    filteredData.updated_at = new Date().toISOString()
    
    const { data: preferences, error } = await supabase
      .from('smart_timing_preferences')
      .upsert({
        user_id: user.id,
        ...filteredData
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single()
    
    if (error) {
      console.error('Failed to update preferences:', error)
      return NextResponse.json(
        { error: 'Failed to update preferences' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      message: 'Smart timing preferences updated successfully',
      preferences
    })
    
  } catch (error) {
    console.error('Update preferences error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}