import { perfLogger } from './logger'

// Performance metrics collection
interface PerformanceMetrics {
  endpoint: string
  method: string
  duration: number
  statusCode: number
  memoryUsage: NodeJS.MemoryUsage
  cpuTime: number
  timestamp: string
  userId?: string
  errorType?: string
}

// In-memory storage for performance metrics (in production, use Redis or similar)
class PerformanceStore {
  private metrics: PerformanceMetrics[] = []
  private readonly maxMetrics = 1000 // Keep last 1000 metrics in memory

  addMetric(metric: PerformanceMetrics) {
    this.metrics.push(metric)
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift() // Remove oldest metric
    }
  }

  getMetrics(limit = 50) {
    return this.metrics.slice(-limit)
  }

  getAverageResponseTime(endpoint?: string) {
    const filtered = endpoint 
      ? this.metrics.filter(m => m.endpoint === endpoint)
      : this.metrics

    if (filtered.length === 0) return 0
    
    const total = filtered.reduce((sum, m) => sum + m.duration, 0)
    return total / filtered.length
  }

  getErrorRate(endpoint?: string) {
    const filtered = endpoint 
      ? this.metrics.filter(m => m.endpoint === endpoint)
      : this.metrics

    if (filtered.length === 0) return 0

    const errors = filtered.filter(m => m.statusCode >= 400).length
    return (errors / filtered.length) * 100
  }

  getSlowestEndpoints(limit = 5) {
    const endpointStats = new Map<string, { total: number, count: number, avg: number }>()

    this.metrics.forEach(metric => {
      const key = `${metric.method} ${metric.endpoint}`
      const current = endpointStats.get(key) || { total: 0, count: 0, avg: 0 }
      current.total += metric.duration
      current.count += 1
      current.avg = current.total / current.count
      endpointStats.set(key, current)
    })

    return Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({ endpoint, ...stats }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, limit)
  }

  getMemoryTrend() {
    const recent = this.metrics.slice(-20) // Last 20 requests
    return {
      current: recent[recent.length - 1]?.memoryUsage || process.memoryUsage(),
      trend: recent.map(m => ({
        timestamp: m.timestamp,
        heapUsed: m.memoryUsage.heapUsed,
        rss: m.memoryUsage.rss
      }))
    }
  }

  clear() {
    this.metrics = []
  }
}

const performanceStore = new PerformanceStore()

// Enhanced performance monitoring middleware
export class PerformanceMonitor {
  private startTime: number
  private startCpuUsage: NodeJS.CpuUsage

  constructor(
    private endpoint: string,
    private method: string,
    private userId?: string
  ) {
    this.startTime = Date.now()
    this.startCpuUsage = process.cpuUsage()
  }

  finish(statusCode: number, errorType?: string) {
    const duration = Date.now() - this.startTime
    const cpuUsage = process.cpuUsage(this.startCpuUsage)
    const cpuTime = (cpuUsage.user + cpuUsage.system) / 1000 // Convert to milliseconds

    const metric: PerformanceMetrics = {
      endpoint: this.endpoint,
      method: this.method,
      duration,
      statusCode,
      memoryUsage: process.memoryUsage(),
      cpuTime,
      timestamp: new Date().toISOString(),
      userId: this.userId,
      errorType
    }

    performanceStore.addMetric(metric)

    // Log performance metric
    perfLogger.startTimer('api_request').end({
      endpoint: this.endpoint,
      method: this.method,
      duration,
      statusCode,
      memoryHeap: metric.memoryUsage.heapUsed,
      memoryRSS: metric.memoryUsage.rss,
      cpuTime,
      userId: this.userId,
      errorType
    })

    // Log warning for slow requests
    if (duration > 5000) { // 5 seconds
      perfLogger.startTimer('slow_request').end({
        endpoint: this.endpoint,
        method: this.method,
        duration,
        warning: 'Slow request detected',
        userId: this.userId
      })
    }

    // Log warning for high memory usage
    if (metric.memoryUsage.heapUsed > 100 * 1024 * 1024) { // 100MB
      perfLogger.startTimer('high_memory').end({
        endpoint: this.endpoint,
        heapUsed: metric.memoryUsage.heapUsed,
        warning: 'High memory usage detected'
      })
    }

    return metric
  }
}

// Helper functions for API routes
export function startPerformanceMonitoring(endpoint: string, method: string, userId?: string) {
  return new PerformanceMonitor(endpoint, method, userId)
}

export function getPerformanceStats() {
  return {
    recentMetrics: performanceStore.getMetrics(20),
    averageResponseTime: performanceStore.getAverageResponseTime(),
    errorRate: performanceStore.getErrorRate(),
    slowestEndpoints: performanceStore.getSlowestEndpoints(),
    memoryTrend: performanceStore.getMemoryTrend(),
    totalRequests: performanceStore.getMetrics(1000).length
  }
}

export function getEndpointStats(endpoint: string) {
  return {
    averageResponseTime: performanceStore.getAverageResponseTime(endpoint),
    errorRate: performanceStore.getErrorRate(endpoint),
    recentRequests: performanceStore.getMetrics().filter(m => m.endpoint === endpoint).slice(-10)
  }
}

// Database performance monitoring
export class DatabasePerformanceMonitor {
  private static queryStats = new Map<string, { total: number, count: number, errors: number }>()

  static recordQuery(operation: string, duration: number, error?: boolean) {
    const current = this.queryStats.get(operation) || { total: 0, count: 0, errors: 0 }
    current.total += duration
    current.count += 1
    if (error) current.errors += 1
    this.queryStats.set(operation, current)

    // Log slow queries
    if (duration > 1000) { // 1 second
      perfLogger.startTimer('slow_db_query').end({
        operation,
        duration,
        warning: 'Slow database query detected'
      })
    }
  }

  static getStats() {
    const stats = Array.from(this.queryStats.entries()).map(([operation, data]) => ({
      operation,
      averageTime: data.total / data.count,
      totalQueries: data.count,
      errorRate: (data.errors / data.count) * 100,
      totalTime: data.total
    }))

    return stats.sort((a, b) => b.averageTime - a.averageTime)
  }

  static getSlowestQueries(limit = 5) {
    return this.getStats().slice(0, limit)
  }
}

// External API performance monitoring
export class ExternalAPIMonitor {
  private static apiStats = new Map<string, { total: number, count: number, errors: number }>()

  static recordAPICall(service: string, duration: number, error?: boolean) {
    const current = this.apiStats.get(service) || { total: 0, count: 0, errors: 0 }
    current.total += duration
    current.count += 1
    if (error) current.errors += 1
    this.apiStats.set(service, current)

    perfLogger.startTimer('external_api_call').end({
      service,
      duration,
      error: !!error
    })
  }

  static getStats() {
    return Array.from(this.apiStats.entries()).map(([service, data]) => ({
      service,
      averageTime: data.total / data.count,
      totalCalls: data.count,
      errorRate: (data.errors / data.count) * 100
    }))
  }
}

export { performanceStore }