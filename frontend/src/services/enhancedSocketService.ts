/**
 * Enhanced Socket Service with Advanced Reliability and Auto-Reconnection
 */

import { io, Socket } from 'socket.io-client'
import { CursorData } from '../types'
import { errorLogger, ErrorContext } from '../utils/errorLogger'
import { socketEventOptimizer } from '../utils/socketOptimizer'
import { socketIOClientOptimizer } from '../utils/socketioClientOptimizer'
import { authService } from './authService'
import { 
  SocketConfig, 
  SocketConnectionState,
  SocketConnectionQuality
} from '../types/socket'

export interface ConnectionMetrics {
  totalConnections: number
  successfulConnections: number
  failedConnections: number
  reconnectionAttempts: number
  averageConnectionTime: number
  lastConnectionTime: number
  connectionStreak: number
  longestStreak: number
}

export interface ReconnectionStrategy {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  jitter: boolean
}

class EnhancedSocketService {
  private socket: Socket | null = null
  private listeners: Map<string, Function[]> = new Map()
  private debugMode = import.meta.env.VITE_DEBUG_SOCKET === 'true'
  private connectionState: SocketConnectionState = 'disconnected'
  private connectionQuality: SocketConnectionQuality = 'unknown'
  private connectionMetrics: ConnectionMetrics = {
    totalConnections: 0,
    successfulConnections: 0,
    failedConnections: 0,
    reconnectionAttempts: 0,
    averageConnectionTime: 0,
    lastConnectionTime: 0,
    connectionStreak: 0,
    longestStreak: 0
  }
  private reconnectionStrategy: ReconnectionStrategy = {
    maxAttempts: 10,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 1.5,
    jitter: true
  }
  private connectionStartTime: number = 0
  private healthCheckInterval: NodeJS.Timeout | null = null
  private reconnectionTimeout: NodeJS.Timeout | null = null
  private isManualDisconnect = false
  private pendingOperations: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map()

  constructor() {
    this.initializeHealthMonitoring()
    this.initializeVisibilityHandling()
  }

  /**
   * Initialize health monitoring
   */
  private initializeHealthMonitoring(): void {
    // Monitor page visibility for connection management
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.handlePageHidden()
      } else {
        this.handlePageVisible()
      }
    })

    // Monitor online/offline status
    window.addEventListener('online', () => {
      this.handleNetworkOnline()
    })

    window.addEventListener('offline', () => {
      this.handleNetworkOffline()
    })

    // Monitor focus events
    window.addEventListener('focus', () => {
      this.handleWindowFocus()
    })

    window.addEventListener('blur', () => {
      this.handleWindowBlur()
    })
  }

  /**
   * Initialize visibility handling
   */
  private initializeVisibilityHandling(): void {
    // Start health check interval
    this.startHealthCheck()
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck()
    }, 30000) // Check every 30 seconds
  }

  /**
   * Stop health check monitoring
   */
  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    if (!this.socket || this.connectionState !== 'connected') {
      return
    }

    try {
      // Send ping to check connection health
      const startTime = Date.now()
      await this.ping()
      const responseTime = Date.now() - startTime

      // Update connection quality based on response time
      if (responseTime < 100) {
        this.connectionQuality = 'excellent'
      } else if (responseTime < 500) {
        this.connectionQuality = 'good'
      } else if (responseTime < 1000) {
        this.connectionQuality = 'fair'
      } else {
        this.connectionQuality = 'poor'
      }

      this.emit('health_check', {
        responseTime,
        quality: this.connectionQuality,
        timestamp: Date.now()
      })

    } catch (error) {
      console.warn('Health check failed:', error)
      this.connectionQuality = 'poor'
      
      // If health check fails multiple times, trigger reconnection
      this.emit('health_check_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      })
    }
  }

  /**
   * Handle page becoming hidden
   */
  private handlePageHidden(): void {
    console.log('Page hidden - reducing connection activity')
    // Reduce health check frequency when page is hidden
    this.stopHealthCheck()
  }

  /**
   * Handle page becoming visible
   */
  private handlePageVisible(): void {
    console.log('Page visible - resuming connection activity')
    // Resume health checks and validate connection
    this.startHealthCheck()
    
    if (this.connectionState === 'connected') {
      this.performHealthCheck()
    } else if (this.connectionState === 'disconnected' && !this.isManualDisconnect) {
      this.attemptReconnection()
    }
  }

  /**
   * Handle network coming online
   */
  private handleNetworkOnline(): void {
    console.log('Network online - attempting reconnection')
    if (this.connectionState === 'disconnected' && !this.isManualDisconnect) {
      this.attemptReconnection()
    }
  }

  /**
   * Handle network going offline
   */
  private handleNetworkOffline(): void {
    console.log('Network offline - marking connection as poor quality')
    this.connectionQuality = 'poor'
    this.emit('network_offline', { timestamp: Date.now() })
  }

  /**
   * Handle window focus
   */
  private handleWindowFocus(): void {
    if (this.connectionState === 'connected') {
      this.performHealthCheck()
    }
  }

  /**
   * Handle window blur
   */
  private handleWindowBlur(): void {
    // Reduce activity when window loses focus
    console.log('Window blurred - reducing connection activity')
  }

  /**
   * Connect to socket with enhanced reliability
   */
  public async connect(idToken?: string): Promise<void> {
    const API_URL = (import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000') as string
    
    // Update connection state and metrics
    this.connectionState = 'connecting'
    this.connectionStartTime = Date.now()
    this.connectionMetrics.totalConnections++
    this.isManualDisconnect = false

    // Check if we're in development mode
    const isDevelopment = import.meta.env.DEV || 
                         import.meta.env.MODE === 'development' ||
                         import.meta.env.VITE_DEBUG_MODE === 'true' ||
                         window.location.hostname === 'localhost' ||
                         window.location.hostname === '127.0.0.1'

    if (this.debugMode) {
      console.log('=== Enhanced Socket Connection ===')
      console.log('API URL:', API_URL)
      console.log('Development mode:', isDevelopment)
      console.log('Connection metrics:', this.connectionMetrics)
    }

    try {
      // Get valid token if not provided
      if (!idToken && !isDevelopment) {
        idToken = await authService.getValidToken()
      }

      // Get optimized configuration
      const socketConfig = socketIOClientOptimizer.getOptimizedConfig()
      
      // Enhanced configuration with reliability features
      const enhancedConfig: SocketConfig = {
        ...socketConfig,
        forceNew: true, // Always create new connection
        withCredentials: true,
        extraHeaders: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        transports: ['polling', 'websocket'], // Try both transports
        timeout: 30000, // Increased timeout
        reconnection: true,
        reconnectionAttempts: this.reconnectionStrategy.maxAttempts,
        reconnectionDelay: this.reconnectionStrategy.baseDelay,
        reconnectionDelayMax: this.reconnectionStrategy.maxDelay,
        maxReconnectionAttempts: this.reconnectionStrategy.maxAttempts,
        randomizationFactor: this.reconnectionStrategy.jitter ? 0.5 : 0
      }

      // Add authentication if not in development mode
      if (!isDevelopment && idToken) {
        enhancedConfig.auth = { token: idToken }
      }

      // Create socket connection
      const config = {
        path: '/socket.io',
        ...enhancedConfig
      }

      this.socket = io(API_URL, config)
      this.setupSocketEventHandlers()

      // Wait for connection with timeout
      await this.waitForConnection(30000)

    } catch (error) {
      console.error('Socket connection failed:', error)
      this.connectionState = 'disconnected'
      this.connectionMetrics.failedConnections++
      this.connectionMetrics.connectionStreak = 0
      
      errorLogger.logError(error as Error, {
        operation: 'enhanced_socket_connection',
        timestamp: Date.now(),
        additionalData: { 
          connectionMetrics: this.connectionMetrics,
          isDevelopment
        }
      })

      throw error
    }
  }

  /**
   * Wait for connection with timeout
   */
  private waitForConnection(timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'))
        return
      }

      const timeoutId = setTimeout(() => {
        reject(new Error('Connection timeout'))
      }, timeout)

      const onConnect = () => {
        clearTimeout(timeoutId)
        this.socket?.off('connect', onConnect)
        this.socket?.off('connect_error', onError)
        resolve()
      }

      const onError = (error: Error) => {
        clearTimeout(timeoutId)
        this.socket?.off('connect', onConnect)
        this.socket?.off('connect_error', onError)
        reject(error)
      }

      this.socket.on('connect', onConnect)
      this.socket.on('connect_error', onError)

      // If already connected, resolve immediately
      if (this.socket.connected) {
        clearTimeout(timeoutId)
        this.socket.off('connect', onConnect)
        this.socket.off('connect_error', onError)
        resolve()
      }
    })
  }

  /**
   * Setup socket event handlers
   */
  private setupSocketEventHandlers(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      this.handleConnectionSuccess()
    })

    this.socket.on('disconnect', (reason) => {
      this.handleDisconnection(reason)
    })

    this.socket.on('connect_error', (error) => {
      this.handleConnectionError(error)
    })

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      this.handleReconnectionAttempt(attemptNumber)
    })

    this.socket.on('reconnect', (attemptNumber) => {
      this.handleReconnectionSuccess(attemptNumber)
    })

    this.socket.on('reconnect_error', (error) => {
      this.handleReconnectionError(error)
    })

    this.socket.on('reconnect_failed', () => {
      this.handleReconnectionFailed()
    })

    this.socket.on('error', (error) => {
      this.handleSocketError(error)
    })

    // Add ping/pong handlers for health monitoring
    this.socket.on('ping', () => {
      this.socket?.emit('pong')
    })

    this.socket.on('pong', () => {
      // Pong received - connection is healthy
    })
  }

  /**
   * Handle successful connection
   */
  private handleConnectionSuccess(): void {
    const connectionTime = Date.now() - this.connectionStartTime
    
    this.connectionState = 'connected'
    this.connectionQuality = 'excellent'
    this.connectionMetrics.successfulConnections++
    this.connectionMetrics.lastConnectionTime = Date.now()
    this.connectionMetrics.connectionStreak++
    
    if (this.connectionMetrics.connectionStreak > this.connectionMetrics.longestStreak) {
      this.connectionMetrics.longestStreak = this.connectionMetrics.connectionStreak
    }

    // Update average connection time
    const totalTime = this.connectionMetrics.averageConnectionTime * (this.connectionMetrics.successfulConnections - 1) + connectionTime
    this.connectionMetrics.averageConnectionTime = totalTime / this.connectionMetrics.successfulConnections

    if (this.debugMode) {
      console.log('=== Enhanced Socket Connected ===')
      console.log('Connection time:', connectionTime + 'ms')
      console.log('Connection streak:', this.connectionMetrics.connectionStreak)
      console.log('Socket ID:', this.socket?.id)
    }

    this.emit('connection_success', {
      connectionTime,
      socketId: this.socket?.id,
      metrics: this.connectionMetrics,
      timestamp: Date.now()
    })

    // Start health monitoring
    this.startHealthCheck()
  }

  /**
   * Handle disconnection
   */
  private handleDisconnection(reason: string): void {
    this.connectionState = 'disconnected'
    this.connectionQuality = 'poor'
    
    if (this.debugMode) {
      console.log('=== Enhanced Socket Disconnected ===')
      console.log('Reason:', reason)
    }

    this.emit('connection_lost', {
      reason,
      timestamp: Date.now(),
      metrics: this.connectionMetrics
    })

    // Stop health monitoring
    this.stopHealthCheck()

    // Attempt reconnection if not manual disconnect
    if (!this.isManualDisconnect) {
      this.attemptReconnection()
    }
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(error: Error): void {
    console.error('=== Enhanced Socket Connection Error ===')
    console.error('Error:', error)

    this.connectionState = 'disconnected'
    this.connectionQuality = 'poor'
    this.connectionMetrics.failedConnections++
    this.connectionMetrics.connectionStreak = 0

    const context: ErrorContext = {
      operation: 'enhanced_socket_connection',
      timestamp: Date.now(),
      additionalData: { 
        error: error.message,
        metrics: this.connectionMetrics
      }
    }

    const errorId = errorLogger.logError(error, context)

    this.emit('connection_error', {
      error: error.message,
      errorId,
      timestamp: Date.now(),
      metrics: this.connectionMetrics
    })
  }

  /**
   * Handle reconnection attempt
   */
  private handleReconnectionAttempt(attemptNumber: number): void {
    this.connectionState = 'reconnecting'
    this.connectionMetrics.reconnectionAttempts++

    if (this.debugMode) {
      console.log('=== Enhanced Socket Reconnection Attempt ===')
      console.log('Attempt:', attemptNumber)
    }

    this.emit('reconnection_attempt', {
      attempt: attemptNumber,
      timestamp: Date.now(),
      metrics: this.connectionMetrics
    })
  }

  /**
   * Handle successful reconnection
   */
  private handleReconnectionSuccess(attemptNumber: number): void {
    this.connectionState = 'connected'
    this.connectionQuality = 'good'

    if (this.debugMode) {
      console.log('=== Enhanced Socket Reconnected ===')
      console.log('Attempt:', attemptNumber)
    }

    this.emit('reconnection_success', {
      attempt: attemptNumber,
      timestamp: Date.now(),
      metrics: this.connectionMetrics
    })

    // Resume health monitoring
    this.startHealthCheck()
  }

  /**
   * Handle reconnection error
   */
  private handleReconnectionError(error: Error): void {
    console.error('=== Enhanced Socket Reconnection Error ===')
    console.error('Error:', error)

    this.emit('reconnection_error', {
      error: error.message,
      timestamp: Date.now(),
      metrics: this.connectionMetrics
    })
  }

  /**
   * Handle reconnection failure
   */
  private handleReconnectionFailed(): void {
    console.error('=== Enhanced Socket Reconnection Failed ===')
    
    this.connectionState = 'disconnected'
    this.connectionQuality = 'poor'

    this.emit('reconnection_failed', {
      timestamp: Date.now(),
      metrics: this.connectionMetrics
    })

    // Try manual reconnection with exponential backoff
    this.attemptReconnection()
  }

  /**
   * Handle socket error
   */
  private handleSocketError(error: any): void {
    console.error('=== Enhanced Socket Error ===')
    console.error('Error:', error)

    this.emit('socket_error', {
      error: error.message || 'Unknown socket error',
      timestamp: Date.now(),
      metrics: this.connectionMetrics
    })
  }

  /**
   * Attempt reconnection with exponential backoff
   */
  private async attemptReconnection(): Promise<void> {
    if (this.isManualDisconnect || this.connectionState === 'connected') {
      return
    }

    const delay = this.calculateReconnectionDelay()
    
    if (this.debugMode) {
      console.log(`Attempting reconnection in ${delay}ms`)
    }

    this.reconnectionTimeout = setTimeout(async () => {
      try {
        await this.connect()
      } catch (error) {
        console.error('Manual reconnection failed:', error)
        // Continue attempting with exponential backoff
        this.attemptReconnection()
      }
    }, delay)
  }

  /**
   * Calculate reconnection delay with exponential backoff
   */
  private calculateReconnectionDelay(): number {
    const attempts = this.connectionMetrics.reconnectionAttempts
    const delay = Math.min(
      this.reconnectionStrategy.baseDelay * Math.pow(this.reconnectionStrategy.backoffMultiplier, attempts),
      this.reconnectionStrategy.maxDelay
    )

    if (this.reconnectionStrategy.jitter) {
      // Add jitter to prevent thundering herd
      return delay + Math.random() * 1000
    }

    return delay
  }

  /**
   * Send ping to check connection health
   */
  public async ping(): Promise<void> {
    if (!this.socket || !this.socket.connected) {
      throw new Error('Socket not connected')
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Ping timeout'))
      }, 5000)

      const onPong = () => {
        clearTimeout(timeout)
        this.socket?.off('pong', onPong)
        resolve()
      }

      this.socket?.on('pong', onPong)
      this.socket?.emit('ping')
    })
  }

  /**
   * Disconnect socket
   */
  public disconnect(): void {
    this.isManualDisconnect = true
    this.stopHealthCheck()
    
    if (this.reconnectionTimeout) {
      clearTimeout(this.reconnectionTimeout)
      this.reconnectionTimeout = null
    }

    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }

    this.connectionState = 'disconnected'
    this.connectionQuality = 'unknown'

    this.emit('manual_disconnect', {
      timestamp: Date.now(),
      metrics: this.connectionMetrics
    })
  }

  /**
   * Get connection state
   */
  public getConnectionState(): SocketConnectionState {
    return this.connectionState
  }

  /**
   * Get connection quality
   */
  public getConnectionQuality(): SocketConnectionQuality {
    return this.connectionQuality
  }

  /**
   * Get connection metrics
   */
  public getConnectionMetrics(): ConnectionMetrics {
    return { ...this.connectionMetrics }
  }

  /**
   * Check if socket is connected
   */
  public isConnected(): boolean {
    return this.socket?.connected || false
  }

  /**
   * Emit event with reliability
   */
  public emit(event: string, data?: any): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data)
    } else {
      console.warn(`Cannot emit event '${event}' - socket not connected`)
    }
  }

  /**
   * Listen for events
   */
  public on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)

    if (this.socket) {
      this.socket.on(event, callback)
    }
  }

  /**
   * Remove event listener
   */
  public off(event: string, callback?: Function): void {
    if (callback) {
      const callbacks = this.listeners.get(event) || []
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    } else {
      this.listeners.delete(event)
    }

    if (this.socket) {
      this.socket.off(event, callback)
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.disconnect()
    this.listeners.clear()
    this.pendingOperations.clear()
  }
}

// Export singleton instance
export const enhancedSocketService = new EnhancedSocketService()

// Export types and service
export { EnhancedSocketService }
export type { ConnectionMetrics, ReconnectionStrategy }
