/**
 * Production Logger
 * Optimized logging system for production environments
 * Reduces console.log spam and implements rate limiting
 */

interface LogEntry {
  timestamp: number
  level: string
  message: string
  context?: Record<string, unknown>
}

interface RateLimitConfig {
  interval: number // milliseconds
  maxLogs: number
}

class ProductionLogger {
  private isProduction: boolean
  private isDevelopment: boolean
  private logBuffer: LogEntry[] = []
  private rateLimits: Map<string, { count: number; resetTime: number }> = new Map()
  private maxBufferSize = 100
  private flushInterval = 30000 // 30 seconds

  // Rate limiting configuration
  private rateLimitConfigs: Record<string, RateLimitConfig> = {
    'network_check': { interval: 60000, maxLogs: 2 }, // 2 logs per minute
    'cursor_move': { interval: 30000, maxLogs: 5 },   // 5 logs per 30 seconds
    'object_update': { interval: 10000, maxLogs: 10 }, // 10 logs per 10 seconds
    'socket_event': { interval: 5000, maxLogs: 20 },   // 20 logs per 5 seconds
    'error': { interval: 0, maxLogs: 100 },            // Always log errors
    'warning': { interval: 10000, maxLogs: 10 },       // 10 warnings per 10 seconds
    'info': { interval: 5000, maxLogs: 5 },            // 5 info logs per 5 seconds
    'debug': { interval: 0, maxLogs: 0 }               // Disabled in production
  }

  constructor() {
    this.isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production'
    this.isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development'
    
    // Start periodic buffer flush
    if (this.isProduction) {
      setInterval(() => this.flushBuffer(), this.flushInterval)
    }
  }

  private shouldLog(category: string): boolean {
    if (this.isDevelopment) {
      return true // No rate limiting in development
    }

    const config = this.rateLimitConfigs[category] || this.rateLimitConfigs['info']
    const now = Date.now()
    const rateLimit = this.rateLimits.get(category)

    if (!rateLimit || now > rateLimit.resetTime) {
      // Reset or initialize rate limit
      this.rateLimits.set(category, {
        count: 1,
        resetTime: now + config.interval
      })
      return true
    }

    if (rateLimit.count < config.maxLogs) {
      rateLimit.count++
      return true
    }

    return false
  }

  private addToBuffer(level: string, message: string, context?: Record<string, unknown>): void {
    if (this.isDevelopment) {
      return // No buffering in development
    }

    this.logBuffer.push({
      timestamp: Date.now(),
      level,
      message,
      context
    })

    // Prevent buffer overflow
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize)
    }
  }

  private flushBuffer(): void {
    if (this.logBuffer.length === 0) {
      return
    }

    // Group logs by level and message pattern
    const groupedLogs = new Map<string, { count: number; firstSeen: number; lastSeen: number; level: string; message: string }>()

    for (const log of this.logBuffer) {
      const key = `${log.level}:${log.message}`
      if (groupedLogs.has(key)) {
        const existing = groupedLogs.get(key)!
        existing.count++
        existing.lastSeen = log.timestamp
      } else {
        groupedLogs.set(key, {
          count: 1,
          firstSeen: log.timestamp,
          lastSeen: log.timestamp,
          level: log.level,
          message: log.message
        })
      }
    }

    // Log aggregated results
    for (const [_key, data] of groupedLogs) {
      if (data.count > 1) {
        const duration = (data.lastSeen - data.firstSeen) / 1000
        const aggregatedMessage = `[AGGREGATED] ${data.message} (occurred ${data.count} times in ${duration.toFixed(1)}s)`
        this.logToConsole(data.level, aggregatedMessage)
      } else {
        this.logToConsole(data.level, data.message)
      }
    }

    this.logBuffer = []
  }

  private logToConsole(level: string, message: string, context?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`
    
    if (context) {
      const contextStr = typeof context === 'object' ? JSON.stringify(context, null, 2) : String(context)
      console.log(logMessage, contextStr)
    } else {
      console.log(logMessage)
    }
  }

  // Public logging methods
  error(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      this.logToConsole('error', message, context)
    } else {
      this.addToBuffer('error', message, context)
    }
  }

  warning(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('warning')) {
      this.logToConsole('warning', message, context)
    } else {
      this.addToBuffer('warning', message, context)
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      this.logToConsole('info', message, context)
    } else {
      this.addToBuffer('info', message, context)
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.isDevelopment && this.shouldLog('debug')) {
      this.logToConsole('debug', message, context)
    }
  }

  // Specialized logging methods
  networkCheck(service: string, status: string): void {
    if (this.shouldLog('network_check')) {
      this.logToConsole('info', `Network check: ${service} -> ${status}`)
    } else {
      this.addToBuffer('info', `Network check: ${service} -> ${status}`)
    }
  }

  cursorMove(userId: string, position: { x: number; y: number }): void {
    if (this.shouldLog('cursor_move')) {
      this.logToConsole('debug', `Cursor: ${userId} -> (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`)
    } else {
      this.addToBuffer('debug', `Cursor: ${userId} -> (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`)
    }
  }

  objectUpdate(userId: string, objectId: string, action: string): void {
    if (this.shouldLog('object_update')) {
      this.logToConsole('debug', `Object ${action}: ${objectId} by ${userId}`)
    } else {
      this.addToBuffer('debug', `Object ${action}: ${objectId} by ${userId}`)
    }
  }

  socketEvent(eventType: string, success: boolean, userId?: string): void {
    if (this.shouldLog('socket_event')) {
      const status = success ? 'SUCCESS' : 'FAILED'
      const userInfo = userId ? ` for user ${userId}` : ''
      this.logToConsole('info', `Socket event: ${eventType} -> ${status}${userInfo}`)
    } else {
      const status = success ? 'SUCCESS' : 'FAILED'
      const userInfo = userId ? ` for user ${userId}` : ''
      this.addToBuffer('info', `Socket event: ${eventType} -> ${status}${userInfo}`)
    }
  }

  // Performance logging
  performance(operation: string, duration: number, userId?: string): void {
    if (this.shouldLog('info')) {
      const userInfo = userId ? ` for user ${userId}` : ''
      this.logToConsole('info', `PERF: ${operation} took ${duration.toFixed(3)}s${userInfo}`)
    } else {
      const userInfo = userId ? ` for user ${userId}` : ''
      this.addToBuffer('info', `PERF: ${operation} took ${duration.toFixed(3)}s${userInfo}`)
    }
  }

  // Manual buffer flush
  flush(): void {
    this.flushBuffer()
  }

  // Get current buffer status
  getBufferStatus(): { size: number; oldestEntry?: number; newestEntry?: number } {
    if (this.logBuffer.length === 0) {
      return { size: 0 }
    }

    return {
      size: this.logBuffer.length,
      oldestEntry: this.logBuffer[0].timestamp,
      newestEntry: this.logBuffer[this.logBuffer.length - 1].timestamp
    }
  }

  // Get rate limit status
  getRateLimitStatus(): Record<string, { count: number; resetTime: number; maxLogs: number }> {
    const status: Record<string, { count: number; resetTime: number; maxLogs: number }> = {}
    
    for (const [category, rateLimit] of this.rateLimits) {
      const config = this.rateLimitConfigs[category] || this.rateLimitConfigs['info']
      status[category] = {
        count: rateLimit.count,
        resetTime: rateLimit.resetTime,
        maxLogs: config.maxLogs
      }
    }
    
    return status
  }
}

// Create singleton instance
export const productionLogger = new ProductionLogger()

// Export convenience functions
export const logError = (message: string, context?: Record<string, unknown>) => productionLogger.error(message, context)
export const logWarning = (message: string, context?: Record<string, unknown>) => productionLogger.warning(message, context)
export const logInfo = (message: string, context?: Record<string, unknown>) => productionLogger.info(message, context)
export const logDebug = (message: string, context?: Record<string, unknown>) => productionLogger.debug(message, context)
export const logNetworkCheck = (service: string, status: string) => productionLogger.networkCheck(service, status)
export const logCursorMove = (userId: string, position: { x: number; y: number }) => productionLogger.cursorMove(userId, position)
export const logObjectUpdate = (userId: string, objectId: string, action: string) => productionLogger.objectUpdate(userId, objectId, action)
export const logSocketEvent = (eventType: string, success: boolean, userId?: string) => productionLogger.socketEvent(eventType, success, userId)
export const logPerformance = (operation: string, duration: number, userId?: string) => productionLogger.performance(operation, duration, userId)
export const flushLogs = () => productionLogger.flush()
export const getLogStatus = () => ({
  buffer: productionLogger.getBufferStatus(),
  rateLimits: productionLogger.getRateLimitStatus()
})

export default productionLogger
