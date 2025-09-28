import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { checkRateLimit } from '../../../../lib/next-rate-limiter'
import { apiLogger, perfLogger } from '../../../../lib/logger'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const clientIP = request.ip || request.headers.get('x-forwarded-for') || '127.0.0.1'
  
  // Apply rate limiting for auth endpoints
  const rateLimitResponse = checkRateLimit(request, 'auth')
  if (rateLimitResponse) {
    apiLogger.security('Rate limit exceeded', { 
      endpoint: '/api/auth/login',
      clientIP,
      action: 'rate_limit_exceeded'
    })
    return rateLimitResponse
  }

  apiLogger.request('POST', '/api/auth/login')
  const timer = perfLogger.startTimer('auth.login')

  try {
    const { email, password } = await request.json()
    
    if (!email || !password) {
      const duration = Date.now() - startTime
      apiLogger.response('POST', '/api/auth/login', 400, duration)
      apiLogger.security('Invalid login attempt', { 
        reason: 'missing_credentials',
        clientIP 
      })
      timer.end({ success: false, reason: 'missing_credentials' })
      
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const supabase = createClient()
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      const duration = Date.now() - startTime
      apiLogger.response('POST', '/api/auth/login', 401, duration)
      apiLogger.security('Failed login attempt', { 
        email: email.substring(0, 3) + '***', // Partially redact email
        clientIP,
        reason: 'invalid_credentials'
      })
      timer.end({ success: false, reason: 'invalid_credentials' })
      
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single()

    const duration = Date.now() - startTime
    apiLogger.response('POST', '/api/auth/login', 200, duration, data.user.id)
    apiLogger.security('Successful login', { 
      userId: data.user.id,
      email: email.substring(0, 3) + '***',
      clientIP
    })
    timer.end({ success: true, userId: data.user.id })

    return NextResponse.json({
      message: 'Login successful',
      user: profile,
      session: data.session
    })

  } catch (error) {
    const duration = Date.now() - startTime
    apiLogger.error('POST', '/api/auth/login', error as Error)
    timer.end({ success: false, error: true })
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}