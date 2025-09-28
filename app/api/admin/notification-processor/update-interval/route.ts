import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get user and verify admin role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    const { interval_seconds } = await request.json()
    
    if (!interval_seconds || interval_seconds < 10 || interval_seconds > 3600) {
      return NextResponse.json(
        { error: 'Interval must be between 10 and 3600 seconds' },
        { status: 400 }
      )
    }
    
    // Store processor configuration
    const { error } = await supabase
      .from('system_config')
      .upsert({
        key: 'notification_processor_interval',
        value: interval_seconds.toString(),
        updated_at: new Date().toISOString(),
        updated_by: user.id
      }, {
        onConflict: 'key'
      })
    
    if (error) {
      console.error('Failed to update processor interval:', error)
      return NextResponse.json(
        { error: 'Failed to update processor interval' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      message: 'Notification processor interval updated successfully',
      new_interval: interval_seconds,
      updated_at: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Update interval error:', error)
    return NextResponse.json(
      { error: 'Failed to update processor interval' },
      { status: 500 }
    )
  }
}