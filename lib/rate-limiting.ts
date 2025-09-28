import rateLimit from 'express-rate-limit'
import { NextRequest, NextResponse } from 'next/server'

// Rate limiting configurations for different endpoint types
export const rateLimitConfigs = {
  // Authentication endpoints - strict limits to prevent brute force
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: {
      error: 'Too many authentication attempts. Please try again in 15 minutes.',
      code: 'RATE_LIMIT_AUTH'
    },
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Public API endpoints - moderate limits
  public: {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: {
      error: 'Too many requests. Please try again in a minute.',
      code: 'RATE_LIMIT_PUBLIC'
    },
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Admin endpoints - higher limits for authenticated admin users
  admin: {
    windowMs: 60 * 1000, // 1 minute
    max: 200, // 200 requests per minute
    message: {
      error: 'Too many admin requests. Please try again in a minute.',
      code: 'RATE_LIMIT_ADMIN'
    },
    standardHeaders: true,
    legacyHeaders: false,
  },

  // User endpoints - standard limits for authenticated users
  user: {
    windowMs: 60 * 1000, // 1 minute
    max: 150, // 150 requests per minute
    message: {
      error: 'Too many requests. Please try again in a minute.',
      code: 'RATE_LIMIT_USER'
    },
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Webhook endpoints - special handling with signature verification
  webhook: {
    windowMs: 60 * 1000, // 1 minute
    max: 1000, // High limit since these are from trusted sources
    message: {
      error: 'Webhook rate limit exceeded.',
      code: 'RATE_LIMIT_WEBHOOK'
    },
    standardHeaders: true,
    legacyHeaders: false,
  }
}

// Create rate limiters for each endpoint type
export const authLimiter = rateLimit(rateLimitConfigs.auth)
export const publicLimiter = rateLimit(rateLimitConfigs.public)
export const adminLimiter = rateLimit(rateLimitConfigs.admin)
export const userLimiter = rateLimit(rateLimitConfigs.user)
export const webhookLimiter = rateLimit(rateLimitConfigs.webhook)

// Next.js middleware wrapper for rate limiting
export function withRateLimit(limiterType: 'auth' | 'public' | 'admin' | 'user' | 'webhook') {
  return async function rateLimitMiddleware(request: NextRequest) {
    return new Promise<NextResponse | null>((resolve) => {
      const limiter = {
        auth: authLimiter,
        public: publicLimiter,
        admin: adminLimiter,
        user: userLimiter,
        webhook: webhookLimiter
      }[limiterType]

      // Create a mock Express-like request/response for the rate limiter
      const mockReq = {
        ip: request.ip || request.headers.get('x-forwarded-for') || '127.0.0.1',
        method: request.method,
        url: request.url,
        headers: Object.fromEntries(request.headers.entries()),
      }

      const mockRes = {
        status: (code: number) => ({
          json: (data: any) => {
            resolve(NextResponse.json(data, { status: code }))
          }
        }),
        set: () => {},
        header: () => {},
      }

      const mockNext = () => {
        resolve(null) // No rate limit hit, continue to handler
      }

      limiter(mockReq as any, mockRes as any, mockNext)
    })
  }
}

// Helper function to get client IP from Next.js request
export function getClientIP(request: NextRequest): string {
  return request.ip || 
         request.headers.get('x-forwarded-for') || 
         request.headers.get('x-real-ip') || 
         '127.0.0.1'
}

// Rate limit status checker
export function checkRateLimit(request: NextRequest, limiterType: string) {
  const clientIP = getClientIP(request)
  const key = `${limiterType}:${clientIP}`
  
  // This would typically check against a Redis store in production
  // For now, return basic information
  return {
    key,
    clientIP,
    remaining: 'unknown',
    resetTime: 'unknown'
  }
}