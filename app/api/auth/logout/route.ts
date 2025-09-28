import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { checkRateLimit } from '../../../../lib/next-rate-limiter'
import { safeLogger } from '../../../../lib/logger'

export async function POST(request: NextRequest) {
  // Apply rate limiting for auth endpoints
  const rateLimitResponse = checkRateLimit(request, 'auth')
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    const supabase = createClient()
    
    // Sign out the user
    const { error } = await supabase.auth.signOut()

    if (error) {
      safeLogger.logError('Logout error', error instanceof Error ? error : new Error(String(error)), { method: 'POST' })
      return NextResponse.json(
        { error: 'Failed to logout' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Logout successful'
    })

  } catch (error) {
    safeLogger.logError('POST /api/auth/logout failed', error instanceof Error ? error : new Error(String(error)), { method: 'POST' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}