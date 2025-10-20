/**
 * Socket.IO Client Configuration Optimizer
 * Optimizes frontend Socket.IO client configuration to prevent parse errors and improve connection stability.
 */

export interface SocketIOClientConfig {
  transports: string[]
  upgrade: boolean
  rememberUpgrade: boolean
  timeout: number
  forceNew: boolean
  reconnection: boolean
  reconnectionDelay: number
  reconnectionAttempts: number
  reconnectionDelayMax: number
  maxReconnectionAttempts: number
  compression: boolean
  compressionThreshold: number
  maxMessageSize: number
  pingTimeout: number
  pingInterval: number
}

export interface ParseErrorMetrics {
  parseErrorCount: number
  lastParseError: number | null
  parseErrorRate: number
  connectionDrops: number
  reconnectionSuccesses: number
  averageMessageSize: number
}

class SocketIOClientOptimizer {
  private parseErrorMetrics: ParseErrorMetrics = {
    parseErrorCount: 0,
    lastParseError: null,
    parseErrorRate: 0,
    connectionDrops: 0,
    reconnectionSuccesses: 0,
    averageMessageSize: 0
  }

  private messageSizeHistory: number[] = []
  private maxHistorySize = 100

  /**
   * Get optimized Socket.IO client configuration
   */
  getOptimizedConfig(): SocketIOClientConfig {
    const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production'
    const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development'

    if (isProduction) {
      return this.getProductionConfig()
    } else if (isDevelopment) {
      return this.getDevelopmentConfig()
    } else {
      return this.getDefaultConfig()
    }
  }

  /**
   * Production configuration optimized for stability
   * Note: Railway doesn't support WebSocket connections, so we use polling only
   */
  private getProductionConfig(): SocketIOClientConfig {
    return {
      transports: ['polling'], // Railway doesn't support WebSocket, use polling only
      upgrade: false, // Disable upgrade attempts since WebSocket doesn't work on Railway
      rememberUpgrade: false,
      timeout: 20000, // 20 seconds
      forceNew: false,
      reconnection: true,
      reconnectionDelay: 2000, // 2 seconds
      reconnectionAttempts: 3, // Match server configuration
      reconnectionDelayMax: 10000, // 10 seconds
      maxReconnectionAttempts: 3,
      compression: true, // Enable compression for better performance
      compressionThreshold: 512, // 512 bytes - match server configuration
      maxMessageSize: 500000, // 500KB - match server configuration
      pingTimeout: 60, // 60 seconds - increase timeout
      pingInterval: 25 // 25 seconds - match server configuration
    }
  }

  /**
   * Development configuration with more verbose logging
   */
  private getDevelopmentConfig(): SocketIOClientConfig {
    return {
      transports: ['polling', 'websocket'],
      upgrade: true,
      rememberUpgrade: true,
      timeout: 30000, // 30 seconds
      forceNew: true,
      reconnection: true,
      reconnectionDelay: 1000, // 1 second
      reconnectionAttempts: 10, // More attempts in development
      reconnectionDelayMax: 5000, // 5 seconds
      maxReconnectionAttempts: 10,
      compression: false, // Disable compression in development
      compressionThreshold: 1024,
      maxMessageSize: 2000000, // 2MB
      pingTimeout: 60, // 60 seconds
      pingInterval: 25 // 25 seconds
    }
  }

  /**
   * Default configuration
   */
  private getDefaultConfig(): SocketIOClientConfig {
    return {
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true,
      timeout: 20000,
      forceNew: false,
      reconnection: true,
      reconnectionDelay: 1500,
      reconnectionAttempts: 5,
      reconnectionDelayMax: 8000,
      maxReconnectionAttempts: 5,
      compression: true,
      compressionThreshold: 1024,
      maxMessageSize: 1000000, // 1MB
      pingTimeout: 45,
      pingInterval: 25
    }
  }

  /**
   * Validate message size to prevent parse errors
   */
  validateMessageSize(data: any, maxSize: number = 1000000): boolean {
    try {
      const messageStr = JSON.stringify(data)
      const messageSize = new Blob([messageStr]).size
      
      // Track message size for metrics
      this.trackMessageSize(messageSize)
      
      if (messageSize > maxSize) {
        console.warn(`Message too large: ${messageSize} bytes (max: ${maxSize})`)
        this.recordParseError()
        return false
      }
      
      return true
    } catch (error) {
      console.error('Message size validation failed:', error)
      this.recordParseError()
      return false
    }
  }

  /**
   * Sanitize message data to prevent parse errors
   */
  sanitizeMessageData(data: any): any {
    try {
      if (data === null || data === undefined) {
        return data
      }

      if (typeof data === 'string') {
        // Remove null bytes and control characters
        return data.replace(/\0/g, '').replace(/[\r\n]/g, ' ')
      }

      if (typeof data === 'number') {
        // Ensure finite numbers
        return isFinite(data) ? data : 0
      }

      if (typeof data === 'boolean') {
        return data
      }

      if (Array.isArray(data)) {
        return data.map(item => this.sanitizeMessageData(item))
      }

      if (typeof data === 'object') {
        const sanitized: any = {}
        for (const [key, value] of Object.entries(data)) {
          // Ensure keys are strings
          const sanitizedKey = typeof key === 'string' ? key : String(key)
          sanitized[sanitizedKey] = this.sanitizeMessageData(value)
        }
        return sanitized
      }

      // Convert other types to string
      return String(data)
    } catch (error) {
      console.error('Message sanitization failed:', error)
      return data
    }
  }

  /**
   * Track message size for metrics
   */
  private trackMessageSize(size: number): void {
    this.messageSizeHistory.push(size)
    
    // Keep only recent history
    if (this.messageSizeHistory.length > this.maxHistorySize) {
      this.messageSizeHistory.shift()
    }
    
    // Update average message size
    const sum = this.messageSizeHistory.reduce((acc, size) => acc + size, 0)
    this.parseErrorMetrics.averageMessageSize = sum / this.messageSizeHistory.length
  }

  /**
   * Record a parse error
   */
  recordParseError(): void {
    this.parseErrorMetrics.parseErrorCount++
    this.parseErrorMetrics.lastParseError = Date.now()
    
    // Calculate parse error rate (errors per minute)
    // This is a simplified calculation - in a real implementation,
    // you'd track errors over time windows
    this.parseErrorMetrics.parseErrorRate = this.parseErrorMetrics.parseErrorCount / 60
  }

  /**
   * Record connection drop
   */
  recordConnectionDrop(): void {
    this.parseErrorMetrics.connectionDrops++
  }

  /**
   * Record successful reconnection
   */
  recordReconnectionSuccess(): void {
    this.parseErrorMetrics.reconnectionSuccesses++
  }

  /**
   * Get current parse error metrics
   */
  getParseErrorMetrics(): ParseErrorMetrics {
    return { ...this.parseErrorMetrics }
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.parseErrorMetrics = {
      parseErrorCount: 0,
      lastParseError: null,
      parseErrorRate: 0,
      connectionDrops: 0,
      reconnectionSuccesses: 0,
      averageMessageSize: 0
    }
    this.messageSizeHistory = []
  }

  /**
   * Get connection quality based on metrics
   */
  getConnectionQuality(): 'excellent' | 'good' | 'poor' {
    const metrics = this.parseErrorMetrics
    
    // Excellent: No parse errors, low connection drops
    if (metrics.parseErrorCount === 0 && metrics.connectionDrops <= 1) {
      return 'excellent'
    }
    
    // Good: Few parse errors, some connection drops
    if (metrics.parseErrorCount <= 2 && metrics.connectionDrops <= 3) {
      return 'good'
    }
    
    // Poor: Many parse errors or connection drops
    return 'poor'
  }

  /**
   * Get recommended configuration adjustments based on metrics
   */
  getRecommendedAdjustments(): Partial<SocketIOClientConfig> {
    const quality = this.getConnectionQuality()
    
    const adjustments: Partial<SocketIOClientConfig> = {}
    
    if (quality === 'poor') {
      // Reduce message size limits
      adjustments.maxMessageSize = 250000 // 250KB
      adjustments.compressionThreshold = 256 // 256 bytes
      
      // Increase timeouts
      adjustments.pingTimeout = 45
      adjustments.pingInterval = 30
      
      // Reduce reconnection attempts
      adjustments.reconnectionAttempts = 2
      adjustments.reconnectionDelay = 3000
    } else if (quality === 'good') {
      // Moderate adjustments
      adjustments.maxMessageSize = 750000 // 750KB
      adjustments.compressionThreshold = 512
      adjustments.pingTimeout = 35
      adjustments.pingInterval = 25
    }
    
    return adjustments
  }
}

export const socketIOClientOptimizer = new SocketIOClientOptimizer()
