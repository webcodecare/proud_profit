import winston from 'winston'

// Comprehensive redaction patterns for sensitive data
const sensitivePatterns = [
  // Generic secret patterns
  /password['":\s]*['"]*[^'"\s]+['"]*\s*/gi,
  /token['":\s]*['"]*[^'"\s]+['"]*\s*/gi,
  /secret['":\s]*['"]*[^'"\s]+['"]*\s*/gi,
  /key['":\s]*['"]*[^'"\s]+['"]*\s*/gi,
  /credential['":\s]*['"]*[^'"\s]+['"]*\s*/gi,
  
  // Authorization headers
  /authorization[\s:]+bearer[\s]+[\w.-]+/gi,
  /authorization[\s:]+[\w.-]+/gi,
  /bearer[\s]+[\w.-]+/gi,
  
  // OAuth and API tokens
  /access_token['":\s]*['"]*[^'"\s]+['"]*\s*/gi,
  /refresh_token['":\s]*['"]*[^'"\s]+['"]*\s*/gi,
  /client_secret['":\s]*['"]*[^'"\s]+['"]*\s*/gi,
  /client_id['":\s]*['"]*[^'"\s]+['"]*\s*/gi,
  /oauth_code['":\s]*['"]*[^'"\s]+['"]*\s*/gi,
  /api_key['":\s]*['"]*[^'"\s]+['"]*\s*/gi,
  
  // Supabase specific tokens
  /sb-access-token['":\s]*['"]*[^'"\s]+['"]*\s*/gi,
  /sb-refresh-token['":\s]*['"]*[^'"\s]+['"]*\s*/gi,
  /supabase_url['":\s]*['"]*[^'"\s]+['"]*\s*/gi,
  /supabase_anon_key['":\s]*['"]*[^'"\s]+['"]*\s*/gi,
  /supabase_service_role_key['":\s]*['"]*[^'"\s]+['"]*\s*/gi,
  
  // Session and cookie data
  /session['":\s]*['"]*[^'"\s]+['"]*\s*/gi,
  /cookie['":\s]*['"]*[^'"\s]+['"]*\s*/gi,
  /sessionid['":\s]*['"]*[^'"\s]+['"]*\s*/gi,
  
  // Payment service tokens
  /sk_\w+/g, // Stripe secret keys
  /pk_\w+/g, // Stripe publishable keys  
  /whsec_\w+/g, // Webhook secrets
  /rk_\w+/g, // Stripe restricted keys
  
  // PayPal secrets
  /paypal_client_id['":\s]*['"]*[^'"\s]+['"]*\s*/gi,
  /paypal_client_secret['":\s]*['"]*[^'"\s]+['"]*\s*/gi,
  /paypal_secret['":\s]*['"]*[^'"\s]+['"]*\s*/gi,
  
  // Database connection strings
  /postgres:\/\/[^\s]+/gi,
  /postgresql:\/\/[^\s]+/gi,
  /database_url['":\s]*['"]*[^'"\s]+['"]*\s*/gi,
  
  // JWT tokens (expanded pattern)
  /eyJ[\w-]*\.[\w-]*\.[\w-]*/g,
  
  // Generic token patterns (32-128 char hex/base64)
  /\b[A-Fa-f0-9]{32,128}\b/g,
  /\b[A-Za-z0-9+\/]{40,}={0,2}\b/g,
  
  // Email and phone PII
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  /\b(?:\+?1[-\s.]?)?\(?[0-9]{3}\)?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4}\b/g,
  
  // URL query parameters with sensitive data
  /[?&](token|key|secret|password|auth|access_token|refresh_token|client_secret)=[^&\s]+/gi,
  
  // SQL parameter placeholders
  /\$\d+/g,
  
  // Common environment variable patterns
  /\b[A-Z_]+_KEY\s*=\s*[^\s]+/g,
  /\b[A-Z_]+_SECRET\s*=\s*[^\s]+/g,
  /\b[A-Z_]+_TOKEN\s*=\s*[^\s]+/g
]

// Function to redact sensitive information
function redactSensitive(message: string): string {
  let redacted = message
  sensitivePatterns.forEach(pattern => {
    redacted = redacted.replace(pattern, '[REDACTED]')
  })
  return redacted
}

// Enhanced format for redacting sensitive data from all log fields
const redactFormat = winston.format((info) => {
  // Redact message
  if (typeof info.message === 'string') {
    info.message = redactSensitive(info.message)
  }
  
  // Redact error message and stack
  if (info.error) {
    if (typeof info.error === 'string') {
      info.error = redactSensitive(info.error)
    } else if (typeof info.error === 'object' && info.error !== null) {
      const errorObj = info.error as any
      if (errorObj.message) {
        errorObj.message = redactSensitive(errorObj.message)
      }
      if (errorObj.stack) {
        errorObj.stack = redactSensitive(errorObj.stack)
      }
    }
  }
  
  // Redact stack trace
  if (info.stack && typeof info.stack === 'string') {
    info.stack = redactSensitive(info.stack)
  }
  
  // Redact any additional metadata
  if (info.meta && typeof info.meta === 'object') {
    info.meta = JSON.parse(redactSensitive(JSON.stringify(info.meta)))
  }
  
  // Redact any other object properties
  Object.keys(info).forEach(key => {
    if (typeof info[key] === 'string' && key !== 'level' && key !== 'timestamp' && key !== 'service') {
      info[key] = redactSensitive(info[key])
    } else if (typeof info[key] === 'object' && info[key] !== null && key !== 'error') {
      try {
        info[key] = JSON.parse(redactSensitive(JSON.stringify(info[key])))
      } catch (e) {
        // If JSON parsing fails, leave as is
      }
    }
  })
  
  return info
})

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    redactFormat(),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'proud-profit-api',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Write to all logs with level `info` and below
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
})

// If we're not in production, log to the console with the format
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.errors({ stack: true }),
      redactFormat(),
      winston.format.colorize(),
      winston.format.simple()
    )
  }))
}

// Add exception and rejection handlers with redaction
logger.exceptions.handle(
  new winston.transports.File({ 
    filename: 'logs/exceptions.log',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      redactFormat(),
      winston.format.json()
    )
  })
)

logger.rejections.handle(
  new winston.transports.File({ 
    filename: 'logs/rejections.log',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      redactFormat(),
      winston.format.json()
    )
  })
)

// Performance tracking helper
export const perfLogger = {
  startTimer: (operation: string) => {
    const start = Date.now()
    return {
      end: (metadata?: any) => {
        const duration = Date.now() - start
        logger.info('Performance metric', {
          operation,
          duration,
          ...metadata
        })
        return duration
      }
    }
  }
}

// API-specific logging helpers
export const apiLogger = {
  request: (method: string, path: string, userId?: string) => {
    logger.info('API Request', {
      method,
      path,
      userId: userId || 'anonymous',
      timestamp: new Date().toISOString()
    })
  },
  
  response: (method: string, path: string, statusCode: number, duration: number, userId?: string) => {
    logger.info('API Response', {
      method,
      path,
      statusCode,
      duration,
      userId: userId || 'anonymous',
      timestamp: new Date().toISOString()
    })
  },
  
  error: (method: string, path: string, error: Error, userId?: string) => {
    logger.error('API Error', {
      method,
      path,
      error: error.message,
      userId: userId || 'anonymous',
      timestamp: new Date().toISOString()
    })
  },
  
  security: (event: string, details: any, userId?: string) => {
    logger.warn('Security Event', {
      event,
      details: redactSensitive(JSON.stringify(details)),
      userId: userId || 'anonymous',
      timestamp: new Date().toISOString()
    })
  }
}

// Safe logging helpers to prevent sensitive data exposure
export const safeLogger = {
  // Safe error logging without stack traces in production
  logError: (message: string, error: Error, metadata?: any) => {
    const errorInfo = {
      message: error.message,
      name: error.name,
      ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
      ...metadata
    }
    logger.error(message, errorInfo)
  },

  // Safe request logging without body content
  logRequest: (req: any, metadata?: any) => {
    logger.info('Request', {
      method: req.method,
      path: req.path || req.url,
      userAgent: req.get?.('User-Agent'),
      ip: req.ip,
      ...metadata
    })
  },

  // Safe database error logging
  logDbError: (operation: string, error: Error, metadata?: any) => {
    logger.error('Database Error', {
      operation,
      error: error.message,
      code: (error as any).code,
      ...metadata
    })
  }
}

export default logger