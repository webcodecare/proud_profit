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

    const { data: profile, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (dbError) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    return NextResponse.json({ profile })

  } catch (error) {
    console.error('Profile fetch error:', error)
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
    
    const { first_name, last_name, phone, timezone, notification_preferences } = await request.json()

    // Use secure RPC function for profile updates
    const { data: profile, error: updateError } = await supabase
      .rpc('update_user_profile', {
        user_id: user.id,
        p_first_name: first_name,
        p_last_name: last_name,
        p_phone: phone,
        p_timezone: timezone,
        p_notification_preferences: notification_preferences
      })

    if (updateError) {
      console.error('Profile update error:', updateError)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Profile updated successfully',
      profile 
    })

  } catch (error) {
    console.error('Profile update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}