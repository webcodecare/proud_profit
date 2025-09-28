import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '../../../lib/supabase/server'
import { safeLogger } from '../../../lib/logger'
import { startPerformanceMonitoring } from '../../../lib/performance-monitor'
import { checkRateLimit } from '../../../lib/next-rate-limiter'

export async function GET(request: NextRequest) {
  // Apply rate limiting for public health endpoint
  const rateLimitResponse = checkRateLimit(request, 'public')
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  const perfMonitor = startPerformanceMonitoring('/api/health', 'GET')
  
  let databaseStatus = 'healthy'
  let databaseError = null

  try {
    // Use Supabase client for consistent database access
    const supabase = createServiceClient()
    
    // Test database connection with a simple query
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1)

    if (error) {
      databaseStatus = 'unhealthy'
      databaseError = error.message
    }

  } catch (error) {
    databaseStatus = 'unhealthy'
    databaseError = error instanceof Error ? error.message : 'Unknown database error'
    safeLogger.logDbError('health_check', error instanceof Error ? error : new Error(String(error)), { service: 'health' })
  }

  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: databaseStatus,
      api: 'healthy'
    },
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    ...(databaseError && { databaseError })
  }

  // Record performance metrics
  perfMonitor.finish(200)

  // Return 200 for API health even if database has issues
  return NextResponse.json(healthStatus, { status: 200 })
}