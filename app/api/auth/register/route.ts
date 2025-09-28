import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '../../../../lib/supabase/server'
import { checkRateLimit } from '../../../../lib/next-rate-limiter'
import { safeLogger } from '../../../../lib/logger'

export async function POST(request: NextRequest) {
  // Apply strict rate limiting for registration
  const rateLimitResponse = checkRateLimit(request, 'auth')
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    const { email, password, firstName, lastName } = await request.json()
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    
    // Create user in Supabase Auth with proper confirmation
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName
      }
    })

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    // Create user profile in custom table
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        role: 'user',
        subscription_tier: 'free'
      })
      .select()
      .single()

    if (profileError) {
      // Clean up auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: 'Failed to create user profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'User registered successfully',
      user: {
        id: profile.id,
        email: profile.email,
        firstName: profile.first_name,
        lastName: profile.last_name
      }
    })

  } catch (error) {
    safeLogger.logError('POST /api/auth/register failed', error instanceof Error ? error : new Error(String(error)), { method: 'POST' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}