import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { requireUserAuth } from '../../../../lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    // Check user authentication
    const { user, error: authError, status } = await requireUserAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: authError }, { status })
    }
    
    const supabase = createClient()

    const { data: profile, error } = await supabase
      .from('users')
      .select('notification_preferences')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Notification preferences fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch notification preferences' }, { status: 500 })
    }

    return NextResponse.json({ 
      preferences: profile?.notification_preferences || {
        emailAlerts: true,
        smsAlerts: false,
        pushAlerts: true,
        telegramAlerts: false,
        quietHoursEnabled: false,
        quietHoursStart: "22:00",
        quietHoursEnd: "08:00"
      }
    })

  } catch (error) {
    console.error('Notification preferences error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Check user authentication
    const { user, error: authError, status } = await requireUserAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: authError }, { status })
    }
    
    const supabase = createClient()

    const preferences = await request.json()

    const { data: updatedProfile, error } = await supabase
      .from('users')
      .update({
        notification_preferences: preferences,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select('notification_preferences')
      .single()

    if (error) {
      console.error('Notification preferences update error:', error)
      return NextResponse.json({ error: 'Failed to update notification preferences' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Notification preferences updated successfully',
      preferences: updatedProfile.notification_preferences
    })

  } catch (error) {
    console.error('Notification preferences update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}