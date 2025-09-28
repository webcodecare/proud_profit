import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '../../../../lib/supabase/server'
import { requireUserAuth } from '../../../../lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
    // Check user authentication
    const { user, error: authError, status } = await requireUserAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: authError || 'Authentication failed' }, { status })
    }
    
    // Use service client for privileged operations
    const serviceClient = createServiceClient()

    // Check if user already exists
    const { data: existingUser } = await serviceClient
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (existingUser) {
      return NextResponse.json({ 
        message: 'User already exists',
        user: existingUser 
      })
    }

    // Create user profile from Supabase auth metadata with minimal fields
    const userData = {
      id: user.id,
      email: user.email,
      first_name: user.user_metadata?.first_name || 'Elite',
      last_name: user.user_metadata?.last_name || 'Trader',
      role: user.user_metadata?.role || 'user'
    }

    const { data: newUser, error: createError } = await serviceClient
      .from('users')
      .insert(userData)
      .select()
      .single()

    if (createError) {
      console.error('User creation error:', createError)
      return NextResponse.json({ 
        error: 'Failed to create user profile',
        details: createError.message 
      }, { status: 500 })
    }

    return NextResponse.json({
      message: 'User profile created successfully',
      user: newUser
    })

  } catch (error) {
    console.error('User initialization error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}