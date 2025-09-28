// Simple in-memory cache for performance optimization
class PerformanceCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>()

  set(key: string, data: any, ttlSeconds: number = 300) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000
    })
  }

  get(key: string): any | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  delete(key: string) {
    this.cache.delete(key)
  }

  clear() {
    this.cache.clear()
  }

  // Clean up expired entries
  cleanup() {
    const now = Date.now()
    const entries = Array.from(this.cache.entries())
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    }
  }
}

export const adminCache = new PerformanceCache()

// Clean up expired entries every 5 minutes
setInterval(() => adminCache.cleanup(), 5 * 60 * 1000)

// Cache helper functions
export function getCachedOrExecute<T>(
  key: string,
  executor: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  const cached = adminCache.get(key)
  if (cached) {
    return Promise.resolve(cached)
  }

  return executor().then(result => {
    adminCache.set(key, result, ttlSeconds)
    return result
  })
}

export function invalidateAdminCache(pattern?: string) {
  if (pattern) {
    // Delete keys that match pattern
    const keys = Array.from(adminCache['cache'].keys())
    keys.forEach(key => {
      if (key.includes(pattern)) {
        adminCache.delete(key)
      }
    })
  } else {
    adminCache.clear()
  }
}