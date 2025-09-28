import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'
import { safeLogger } from '../../../lib/logger'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()
    
    if (error) {
      safeLogger.logDbError('fetch_user_profile', error, { userId: user.id })
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      )
    }
    
    // Remove sensitive information
    const { password, ...safeProfile } = userProfile || {}
    
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        ...safeProfile
      }
    })
    
  } catch (error) {
    safeLogger.logError('User profile API error', error as Error)
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
    
    // Allowed fields for update
    const allowedFields = [
      'first_name',
      'last_name', 
      'display_name',
      'timezone',
      'phone',
      'notification_preferences',
      'trading_experience',
      'risk_tolerance'
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
    
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(filteredData)
      .eq('id', user.id)
      .select()
      .single()
    
    if (error) {
      safeLogger.logDbError('update_user_profile', error, { userId: user.id })
      return NextResponse.json(
        { error: 'Failed to update user profile' },
        { status: 500 }
      )
    }
    
    // Remove sensitive information
    const { password, ...safeProfile } = updatedUser
    
    return NextResponse.json({
      message: 'User profile updated successfully',
      user: safeProfile
    })
    
  } catch (error) {
    safeLogger.logError('Update user error', error as Error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}