/**
 * Comprehensive Debugging Tools Service with Advanced Logging, Performance Monitoring, and Diagnostic Capabilities
 */

import { errorLogger } from '../utils/errorLogger'

export interface DebugLogEntry {
  id: string
  timestamp: number
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical'
  category: string
  message: string
  data?: any
  stack?: string
  context?: Record<string, any>
  sessionId: string
  userId?: string
  canvasId?: string
  objectId?: string
}

export interface PerformanceMetric {
  name: string
  value: number
  unit: string
  timestamp: number
  category: 'timing' | 'memory' | 'network' | 'rendering' | 'user_interaction'
  metadata?: Record<string, any>
}

export interface DebugSession {
  id: string
  startTime: number
  endTime?: number
  userId?: string
  canvasId?: string
  logEntries: DebugLogEntry[]
  performanceMetrics: PerformanceMetric[]
  errors: DebugLogEntry[]
  warnings: DebugLogEntry[]
  isActive: boolean
  metadata?: Record<string, any>
}

export interface DebugConfiguration {
  enableLogging: boolean
  enablePerformanceMonitoring: boolean
  enableErrorTracking: boolean
  enableUserInteractionTracking: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error' | 'critical'
  maxLogEntries: number
  maxSessionDuration: number
  enableRemoteLogging: boolean
  remoteLoggingEndpoint?: string
  enableConsoleIntegration: boolean
  enableMemoryMonitoring: boolean
  enableNetworkMonitoring: boolean
}

export interface DebugMetrics {
  totalSessions: number
  activeSessions: number
  totalLogEntries: number
  errorCount: number
  warningCount: number
  averageSessionDuration: number
  performanceMetrics: Array<{ name: string; average: number; min: number; max: number }>
  mostCommonErrors: Array<{ error: string; count: number }>
  logLevelDistribution: Array<{ level: string; count: number }>
}

class DebuggingToolsService {
  private currentSession: DebugSession | null = null
  private sessions: Map<string, DebugSession> = new Map()
  private logEntries: DebugLogEntry[] = []
  private performanceMetrics: PerformanceMetric[] = []
  private metrics: DebugMetrics = {
    totalSessions: 0,
    activeSessions: 0,
    totalLogEntries: 0,
    errorCount: 0,
    warningCount: 0,
    averageSessionDuration: 0,
    performanceMetrics: [],
    mostCommonErrors: [],
    logLevelDistribution: []
  }

  private config: DebugConfiguration = {
    enableLogging: true,
    enablePerformanceMonitoring: true,
    enableErrorTracking: true,
    enableUserInteractionTracking: true,
    logLevel: 'debug',
    maxLogEntries: 10000,
    maxSessionDuration: 3600000, // 1 hour
    enableRemoteLogging: false,
    enableConsoleIntegration: true,
    enableMemoryMonitoring: true,
    enableNetworkMonitoring: true
  }

  private performanceObserver: PerformanceObserver | null = null
  private memoryObserver: NodeJS.Timeout | null = null
  private networkObserver: PerformanceObserver | null = null

  constructor() {
    this.initializeDebugging()
  }

  /**
   * Initialize debugging tools
   */
  private initializeDebugging(): void {
    if (this.config.enableLogging) {
      this.startNewSession()
    }

    if (this.config.enablePerformanceMonitoring) {
      this.initializePerformanceMonitoring()
    }

    if (this.config.enableMemoryMonitoring) {
      this.initializeMemoryMonitoring()
    }

    if (this.config.enableNetworkMonitoring) {
      this.initializeNetworkMonitoring()
    }

    if (this.config.enableUserInteractionTracking) {
      this.initializeUserInteractionTracking()
    }

    if (this.config.enableConsoleIntegration) {
      this.initializeConsoleIntegration()
    }
  }

  /**
   * Start new debug session
   */
  public startNewSession(userId?: string, canvasId?: string): DebugSession {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const session: DebugSession = {
      id: sessionId,
      startTime: Date.now(),
      userId,
      canvasId,
      logEntries: [],
      performanceMetrics: [],
      errors: [],
      warnings: [],
      isActive: true,
      metadata: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      }
    }

    this.currentSession = session
    this.sessions.set(sessionId, session)
    this.metrics.totalSessions++
    this.metrics.activeSessions++

    this.log('info', 'session', 'Debug session started', { sessionId, userId, canvasId })
    
    return session
  }

  /**
   * End current debug session
   */
  public endCurrentSession(): void {
    if (!this.currentSession) return

    this.currentSession.endTime = Date.now()
    this.currentSession.isActive = false
    this.metrics.activeSessions--

    const duration = this.currentSession.endTime - this.currentSession.startTime
    this.updateAverageSessionDuration(duration)

    this.log('info', 'session', 'Debug session ended', { 
      sessionId: this.currentSession.id, 
      duration 
    })

    // Send session data to remote logging if enabled
    if (this.config.enableRemoteLogging && this.config.remoteLoggingEndpoint) {
      this.sendSessionToRemote(this.currentSession)
    }

    this.currentSession = null
  }

  /**
   * Log debug message
   */
  public log(
    level: DebugLogEntry['level'],
    category: string,
    message: string,
    data?: any,
    context?: Record<string, any>
  ): void {
    if (!this.config.enableLogging || !this.currentSession) return

    // Check log level filter
    const levelPriority = { debug: 0, info: 1, warn: 2, error: 3, critical: 4 }
    const configPriority = levelPriority[this.config.logLevel]
    const messagePriority = levelPriority[level]
    
    if (messagePriority < configPriority) return

    const logEntry: DebugLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
      stack: level === 'error' || level === 'critical' ? new Error().stack : undefined,
      context: {
        ...context,
        sessionId: this.currentSession.id,
        userId: this.currentSession.userId,
        canvasId: this.currentSession.canvasId
      },
      sessionId: this.currentSession.id,
      userId: this.currentSession.userId,
      canvasId: this.currentSession.canvasId
    }

    // Add to current session
    this.currentSession.logEntries.push(logEntry)
    this.logEntries.push(logEntry)

    // Categorize by level
    if (level === 'error' || level === 'critical') {
      this.currentSession.errors.push(logEntry)
      this.metrics.errorCount++
    } else if (level === 'warn') {
      this.currentSession.warnings.push(logEntry)
      this.metrics.warningCount++
    }

    // Update metrics
    this.metrics.totalLogEntries++
    this.updateLogLevelDistribution(level)
    this.updateMostCommonErrors(logEntry)

    // Console output
    if (this.config.enableConsoleIntegration) {
      this.outputToConsole(logEntry)
    }

    // Remote logging
    if (this.config.enableRemoteLogging && this.config.remoteLoggingEndpoint) {
      this.sendLogToRemote(logEntry)
    }

    // Cleanup old entries
    this.cleanupOldEntries()
  }

  /**
   * Record performance metric
   */
  public recordPerformanceMetric(
    name: string,
    value: number,
    unit: string,
    category: PerformanceMetric['category'],
    metadata?: Record<string, any>
  ): void {
    if (!this.config.enablePerformanceMonitoring || !this.currentSession) return

    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      category,
      metadata
    }

    this.currentSession.performanceMetrics.push(metric)
    this.performanceMetrics.push(metric)

    this.updatePerformanceMetrics(metric)
  }

  /**
   * Initialize performance monitoring
   */
  private initializePerformanceMonitoring(): void {
    if (!window.PerformanceObserver) return

    // Monitor navigation timing
    this.performanceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'navigation') {
          this.recordPerformanceMetric(
            'page_load_time',
            entry.duration,
            'ms',
            'timing',
            { entryType: entry.entryType }
          )
        } else if (entry.entryType === 'measure') {
          this.recordPerformanceMetric(
            entry.name,
            entry.duration,
            'ms',
            'timing',
            { entryType: entry.entryType }
          )
        }
      }
    })

    this.performanceObserver.observe({ entryTypes: ['navigation', 'measure'] })
  }

  /**
   * Initialize memory monitoring
   */
  private initializeMemoryMonitoring(): void {
    if (!(performance as any).memory) return

    this.memoryObserver = setInterval(() => {
      const memory = (performance as any).memory
      this.recordPerformanceMetric(
        'memory_used',
        memory.usedJSHeapSize,
        'bytes',
        'memory',
        {
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit
        }
      )
    }, 5000) // Every 5 seconds
  }

  /**
   * Initialize network monitoring
   */
  private initializeNetworkMonitoring(): void {
    if (!window.PerformanceObserver) return

    this.networkObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource') {
          this.recordPerformanceMetric(
            'network_request',
            entry.duration,
            'ms',
            'network',
            {
              name: entry.name,
              transferSize: (entry as any).transferSize,
              encodedBodySize: (entry as any).encodedBodySize,
              decodedBodySize: (entry as any).decodedBodySize
            }
          )
        }
      }
    })

    this.networkObserver.observe({ entryTypes: ['resource'] })
  }

  /**
   * Initialize user interaction tracking
   */
  private initializeUserInteractionTracking(): void {
    // Track clicks
    document.addEventListener('click', (event) => {
      this.recordPerformanceMetric(
        'user_click',
        Date.now(),
        'timestamp',
        'user_interaction',
        {
          target: (event.target as Element)?.tagName,
          x: event.clientX,
          y: event.clientY
        }
      )
    })

    // Track key presses
    document.addEventListener('keydown', (event) => {
      this.recordPerformanceMetric(
        'user_keypress',
        Date.now(),
        'timestamp',
        'user_interaction',
        {
          key: event.key,
          code: event.code,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey
        }
      )
    })

    // Track scroll events
    let scrollTimeout: NodeJS.Timeout
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        this.recordPerformanceMetric(
          'user_scroll',
          Date.now(),
          'timestamp',
          'user_interaction',
          {
            scrollX: window.scrollX,
            scrollY: window.scrollY
          }
        )
      }, 100)
    })
  }

  /**
   * Initialize console integration
   */
  private initializeConsoleIntegration(): void {
    // Override console methods to capture logs
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug
    }

    console.log = (...args) => {
      this.log('info', 'console', args.join(' '), args)
      originalConsole.log.apply(console, args)
    }

    console.warn = (...args) => {
      this.log('warn', 'console', args.join(' '), args)
      originalConsole.warn.apply(console, args)
    }

    console.error = (...args) => {
      this.log('error', 'console', args.join(' '), args)
      originalConsole.error.apply(console, args)
    }

    console.info = (...args) => {
      this.log('info', 'console', args.join(' '), args)
      originalConsole.info.apply(console, args)
    }

    console.debug = (...args) => {
      this.log('debug', 'console', args.join(' '), args)
      originalConsole.debug.apply(console, args)
    }
  }

  /**
   * Output log entry to console
   */
  private outputToConsole(logEntry: DebugLogEntry): void {
    const timestamp = new Date(logEntry.timestamp).toISOString()
    const prefix = `[${timestamp}] [${logEntry.level.toUpperCase()}] [${logEntry.category}]`
    
    const consoleMethod = logEntry.level === 'error' || logEntry.level === 'critical' ? 'error' :
                         logEntry.level === 'warn' ? 'warn' :
                         logEntry.level === 'info' ? 'info' : 'log'

    if (logEntry.data) {
      console[consoleMethod](prefix, logEntry.message, logEntry.data)
    } else {
      console[consoleMethod](prefix, logEntry.message)
    }
  }

  /**
   * Send log entry to remote logging
   */
  private async sendLogToRemote(logEntry: DebugLogEntry): Promise<void> {
    try {
      if (!this.config.remoteLoggingEndpoint) return

      await fetch(this.config.remoteLoggingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(logEntry)
      })
    } catch (error) {
      console.error('Failed to send log to remote:', error)
    }
  }

  /**
   * Send session data to remote logging
   */
  private async sendSessionToRemote(session: DebugSession): Promise<void> {
    try {
      if (!this.config.remoteLoggingEndpoint) return

      await fetch(`${this.config.remoteLoggingEndpoint}/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(session)
      })
    } catch (error) {
      console.error('Failed to send session to remote:', error)
    }
  }

  /**
   * Update log level distribution
   */
  private updateLogLevelDistribution(level: string): void {
    const existing = this.metrics.logLevelDistribution.find(l => l.level === level)
    if (existing) {
      existing.count++
    } else {
      this.metrics.logLevelDistribution.push({ level, count: 1 })
    }
  }

  /**
   * Update most common errors
   */
  private updateMostCommonErrors(logEntry: DebugLogEntry): void {
    if (logEntry.level !== 'error' && logEntry.level !== 'critical') return

    const errorKey = `${logEntry.category}:${logEntry.message}`
    const existing = this.metrics.mostCommonErrors.find(e => e.error === errorKey)
    if (existing) {
      existing.count++
    } else {
      this.metrics.mostCommonErrors.push({ error: errorKey, count: 1 })
    }

    // Sort by count
    this.metrics.mostCommonErrors.sort((a, b) => b.count - a.count)
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(metric: PerformanceMetric): void {
    const existing = this.metrics.performanceMetrics.find(m => m.name === metric.name)
    if (existing) {
      existing.average = (existing.average + metric.value) / 2
      existing.min = Math.min(existing.min, metric.value)
      existing.max = Math.max(existing.max, metric.value)
    } else {
      this.metrics.performanceMetrics.push({
        name: metric.name,
        average: metric.value,
        min: metric.value,
        max: metric.value
      })
    }
  }

  /**
   * Update average session duration
   */
  private updateAverageSessionDuration(duration: number): void {
    const alpha = 0.1 // Smoothing factor
    this.metrics.averageSessionDuration = 
      (alpha * duration) + ((1 - alpha) * this.metrics.averageSessionDuration)
  }

  /**
   * Cleanup old entries
   */
  private cleanupOldEntries(): void {
    // Cleanup log entries
    if (this.logEntries.length > this.config.maxLogEntries) {
      this.logEntries = this.logEntries.slice(-this.config.maxLogEntries)
    }

    // Cleanup performance metrics
    if (this.performanceMetrics.length > this.config.maxLogEntries) {
      this.performanceMetrics = this.performanceMetrics.slice(-this.config.maxLogEntries)
    }

    // Cleanup old sessions
    const now = Date.now()
    for (const [sessionId, session] of this.sessions.entries()) {
      if (!session.isActive && (now - session.startTime) > this.config.maxSessionDuration) {
        this.sessions.delete(sessionId)
      }
    }
  }

  /**
   * Get current session
   */
  public getCurrentSession(): DebugSession | null {
    return this.currentSession
  }

  /**
   * Get session by ID
   */
  public getSession(sessionId: string): DebugSession | null {
    return this.sessions.get(sessionId) || null
  }

  /**
   * Get all sessions
   */
  public getAllSessions(): DebugSession[] {
    return Array.from(this.sessions.values())
  }

  /**
   * Get log entries for current session
   */
  public getCurrentSessionLogs(): DebugLogEntry[] {
    return this.currentSession?.logEntries || []
  }

  /**
   * Get performance metrics for current session
   */
  public getCurrentSessionMetrics(): PerformanceMetric[] {
    return this.currentSession?.performanceMetrics || []
  }

  /**
   * Get debug metrics
   */
  public getMetrics(): DebugMetrics {
    return { ...this.metrics }
  }

  /**
   * Export session data
   */
  public exportSessionData(sessionId?: string): string {
    const session = sessionId ? this.getSession(sessionId) : this.currentSession
    if (!session) return ''

    return JSON.stringify({
      session,
      metrics: this.metrics,
      timestamp: new Date().toISOString()
    }, null, 2)
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<DebugConfiguration>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Get current configuration
   */
  public getConfig(): DebugConfiguration {
    return { ...this.config }
  }

  /**
   * Clear all data
   */
  public clearAllData(): void {
    this.logEntries = []
    this.performanceMetrics = []
    this.sessions.clear()
    this.currentSession = null
    this.resetMetrics()
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      totalSessions: 0,
      activeSessions: 0,
      totalLogEntries: 0,
      errorCount: 0,
      warningCount: 0,
      averageSessionDuration: 0,
      performanceMetrics: [],
      mostCommonErrors: [],
      logLevelDistribution: []
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.endCurrentSession()
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect()
    }
    
    if (this.memoryObserver) {
      clearInterval(this.memoryObserver)
    }
    
    if (this.networkObserver) {
      this.networkObserver.disconnect()
    }
  }
}

// Export singleton instance
export const debuggingToolsService = new DebuggingToolsService()

// Export types and service
export { DebuggingToolsService }
export type { DebugLogEntry, PerformanceMetric, DebugSession, DebugConfiguration, DebugMetrics }
