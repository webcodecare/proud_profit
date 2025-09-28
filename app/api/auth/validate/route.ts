import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { checkRateLimit } from '../../../../lib/next-rate-limiter'
import { safeLogger } from '../../../../lib/logger'

export async function GET(request: NextRequest) {
  // Apply rate limiting for auth validation
  const rateLimitResponse = checkRateLimit(request, 'auth')
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    const supabase = createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired token', valid: false },
        { status: 401 }
      )
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      valid: true,
      user: profile || {
        id: user.id,
        email: user.email
      }
    })

  } catch (error) {
    safeLogger.logError('GET /api/auth/validate failed', error instanceof Error ? error : new Error(String(error)), { method: 'GET' })
    return NextResponse.json(
      { error: 'Internal server error', valid: false },
      { status: 500 }
    )
  }
}