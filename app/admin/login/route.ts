import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const supabase = createClient()
    
    // Authenticate user
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Get user profile and check if admin (try ID first, fallback to email)
    // Use service client for admin user lookups
    const serviceSupabase = createServiceClient()
    let { data: profile } = await serviceSupabase
      .from('users')
      .select('id, email, role, first_name, last_name, is_active, subscription_tier, subscription_status, created_at, updated_at')
      .eq('id', data.user.id)
      .single()
    
    // If profile not found by ID, try email fallback
    if (!profile && data.user.email) {
      const { data: profileByEmail } = await serviceSupabase
        .from('users')
        .select('id, email, role, first_name, last_name, is_active, subscription_tier, subscription_status, created_at, updated_at')
        .eq('email', data.user.email)
        .single()
      profile = profileByEmail
    }

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      message: 'Admin login successful',
      user: profile,
      session: data.session,
      admin_permissions: {
        can_manage_users: true,
        can_view_analytics: true,
        can_manage_signals: true,
        can_access_logs: true
      }
    })

  } catch (error) {
    console.error('Admin login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}