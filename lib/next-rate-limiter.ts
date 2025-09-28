import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from './logger'

// In-memory store for rate limiting (use Redis in production)
class RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>()

  get(key: string) {
    return this.store.get(key)
  }

  set(key: string, value: { count: number; resetTime: number }) {
    this.store.set(key, value)
  }

  delete(key: string) {
    this.store.delete(key)
  }

  // Clean up expired entries
  cleanup() {
    const now = Date.now()
    const entries = Array.from(this.store.entries())
    for (const [key, value] of entries) {
      if (now > value.resetTime) {
        this.store.delete(key)
      }
    }
  }
}

const store = new RateLimitStore()

// Clean up expired entries every minute
setInterval(() => store.cleanup(), 60000)

// Rate limit configurations
export const rateLimitConfigs = {
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
    code: 'RATE_LIMIT_AUTH'
  },
  public: {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: 'Too many requests. Please try again in a minute.',
    code: 'RATE_LIMIT_PUBLIC'
  },
  user: {
    windowMs: 60 * 1000, // 1 minute
    max: 150, // 150 requests per minute
    message: 'Too many requests. Please try again in a minute.',
    code: 'RATE_LIMIT_USER'
  },
  admin: {
    windowMs: 60 * 1000, // 1 minute
    max: 200, // 200 requests per minute
    message: 'Too many admin requests. Please try again in a minute.',
    code: 'RATE_LIMIT_ADMIN'
  },
  webhook: {
    windowMs: 60 * 1000, // 1 minute
    max: 1000, // High limit for trusted sources
    message: 'Webhook rate limit exceeded.',
    code: 'RATE_LIMIT_WEBHOOK'
  }
}

// Get client IP from Next.js request
function getClientIP(request: NextRequest): string {
  return request.ip || 
         request.headers.get('x-forwarded-for')?.split(',')[0] || 
         request.headers.get('x-real-ip') || 
         '127.0.0.1'
}

// Rate limiting function
export function checkRateLimit(request: NextRequest, type: keyof typeof rateLimitConfigs, userId?: string): NextResponse | null {
  const config = rateLimitConfigs[type]
  const clientIP = getClientIP(request)
  
  // Create unique key based on IP and user (if authenticated)
  const key = userId ? `${type}:user:${userId}` : `${type}:ip:${clientIP}`
  
  const now = Date.now()
  const windowStart = now - config.windowMs
  
  const current = store.get(key)
  
  if (!current || now > current.resetTime) {
    // First request in window or window expired
    store.set(key, {
      count: 1,
      resetTime: now + config.windowMs
    })
    return null // Allow request
  }
  
  if (current.count >= config.max) {
    // Rate limit exceeded
    const remainingTime = Math.ceil((current.resetTime - now) / 1000)
    
    // Log rate limit violation
    apiLogger.security('Rate limit exceeded', {
      type,
      clientIP,
      userId,
      currentCount: current.count,
      maxAllowed: config.max,
      remainingTime
    })
    
    return NextResponse.json(
      {
        error: config.message,
        code: config.code,
        retryAfter: remainingTime
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': config.max.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil(current.resetTime / 1000).toString(),
          'Retry-After': remainingTime.toString()
        }
      }
    )
  }
  
  // Increment counter
  store.set(key, {
    count: current.count + 1,
    resetTime: current.resetTime
  })
  
  return null // Allow request
}

// Middleware wrapper for easy use in API routes
export function withRateLimit(type: keyof typeof rateLimitConfigs) {
  return function(handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>) {
    return async function(request: NextRequest, ...args: any[]): Promise<NextResponse> {
      // Check rate limit first
      const rateLimitResponse = checkRateLimit(request, type)
      if (rateLimitResponse) {
        return rateLimitResponse
      }
      
      // Continue to the actual handler
      return handler(request, ...args)
    }
  }
}

// User-specific rate limiting (for authenticated endpoints)
export function withUserRateLimit(type: keyof typeof rateLimitConfigs, getUserId: (request: NextRequest) => Promise<string | null>) {
  return function(handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>) {
    return async function(request: NextRequest, ...args: any[]): Promise<NextResponse> {
      // Get user ID for authenticated rate limiting
      const userId = await getUserId(request)
      
      // Check rate limit
      const rateLimitResponse = checkRateLimit(request, type, userId || undefined)
      if (rateLimitResponse) {
        return rateLimitResponse
      }
      
      // Continue to the actual handler
      return handler(request, ...args)
    }
  }
}

// Get current rate limit status for a client
export function getRateLimitStatus(request: NextRequest, type: keyof typeof rateLimitConfigs, userId?: string) {
  const config = rateLimitConfigs[type]
  const clientIP = getClientIP(request)
  const key = userId ? `${type}:user:${userId}` : `${type}:ip:${clientIP}`
  
  const current = store.get(key)
  const now = Date.now()
  
  if (!current || now > current.resetTime) {
    return {
      limit: config.max,
      remaining: config.max,
      reset: Math.ceil((now + config.windowMs) / 1000),
      retryAfter: 0
    }
  }
  
  return {
    limit: config.max,
    remaining: Math.max(0, config.max - current.count),
    reset: Math.ceil(current.resetTime / 1000),
    retryAfter: current.count >= config.max ? Math.ceil((current.resetTime - now) / 1000) : 0
  }
}