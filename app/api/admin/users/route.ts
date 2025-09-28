import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createClient } from '../../../../lib/supabase/server'
import { requireAdminRole } from '../../../../lib/auth-utils'
import { safeLogger } from '../../../../lib/logger'

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication and role
    const { error, status } = await requireAdminRole(request)
    if (error) {
      return NextResponse.json({ error }, { status })
    }
    
    // Use service client for admin operations
    const serviceSupabase = createServiceClient()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const role = searchParams.get('role')
    const subscription = searchParams.get('subscription')
    
    const offset = (page - 1) * limit

    let query = serviceSupabase
      .from('users')
      .select(`
        id, email, role, first_name, last_name, is_active,
        subscription_tier, subscription_status, subscription_ends_at,
        last_login_at, created_at, updated_at
      `)
    
    if (role) {
      query = query.eq('role', role)
    }
    
    if (subscription) {
      query = query.eq('subscription_tier', subscription)
    }

    const { data: users, error: queryError } = await query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })

    if (queryError) {
      console.error('Admin users fetch error:', queryError)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    // Get total count with same filters applied
    let countQuery = serviceSupabase
      .from('users')
      .select('id', { count: 'exact', head: true })
    
    if (role) {
      countQuery = countQuery.eq('role', role)
    }
    
    if (subscription) {
      countQuery = countQuery.eq('subscription_tier', subscription)
    }
    
    const { count, error: countError } = await countQuery
    
    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error) {
    console.error('Admin users error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Verify user authentication via session cookies
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin role (try ID first, fallback to email)
    // Use service client for admin user lookups
    const serviceSupabase = createServiceClient()
    let { data: profile } = await serviceSupabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    
    // If profile not found by ID, try email fallback
    if (!profile && user.email) {
      const { data: profileByEmail } = await serviceSupabase
        .from('users')
        .select('role')
        .eq('email', user.email)
        .single()
      profile = profileByEmail
    }
    
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin role required' }, { status: 403 })
    }
    
    const { id, role, subscription_tier, is_active } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const updates: any = {}
    if (role !== undefined) updates.role = role
    if (subscription_tier !== undefined) updates.subscription_tier = subscription_tier
    if (is_active !== undefined) updates.is_active = is_active
    updates.updated_at = new Date().toISOString()

    const { data: updatedUser, error: updateError } = await serviceSupabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('id, email, role, first_name, last_name, is_active, subscription_tier, subscription_status, updated_at')
      .single()

    if (updateError) {
      console.error('Admin user update error:', updateError)
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'User updated successfully',
      user: updatedUser
    })

  } catch (error) {
    console.error('Admin user update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Verify user authentication via session cookies
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin role (try ID first, fallback to email)
    // Use service client for admin user lookups
    const serviceSupabase = createServiceClient()
    let { data: profile } = await serviceSupabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    
    // If profile not found by ID, try email fallback
    if (!profile && user.email) {
      const { data: profileByEmail } = await serviceSupabase
        .from('users')
        .select('role')
        .eq('email', user.email)
        .single()
      profile = profileByEmail
    }
    
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin role required' }, { status: 403 })
    }
    
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Soft delete by setting is_active to false
    const { error } = await serviceSupabase
      .from('users')
      .update({ 
        is_active: false, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)

    if (error) {
      safeLogger.logDbError('admin_user_delete', error, { userId: id })
      return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'User deactivated successfully'
    })

  } catch (error) {
    safeLogger.logError('Admin user delete error', error as Error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}