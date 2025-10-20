/**
 * Connection Quality Monitor
 * Monitors Socket.IO connection quality and provides recommendations for optimization.
 */

import { socketService } from './socket'
import { socketIOClientOptimizer } from '../utils/socketioClientOptimizer'

export interface ConnectionQualityMetrics {
  parseErrorRate: number
  connectionDropRate: number
  reconnectionSuccessRate: number
  averageMessageSize: number
  connectionUptime: number
  lastParseError: number | null
  connectionQuality: 'excellent' | 'good' | 'poor'
  recommendations: string[]
}

export interface ConnectionEvent {
  type: 'connect' | 'disconnect' | 'reconnect' | 'parse_error' | 'message_sent' | 'message_received'
  timestamp: number
  data?: any
}

class ConnectionQualityMonitor {
  private connectionEvents: ConnectionEvent[] = []
  private maxEventHistory = 1000
  private monitoringInterval: number | null = null
  private isMonitoring = false
  private eventListeners: Map<string, Function> = new Map()

  /**
   * Start monitoring connection quality
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.isMonitoring) {
      console.warn('Connection quality monitoring already started')
      return
    }

    console.log('Starting connection quality monitoring')
    this.isMonitoring = true

    // Set up event listeners
    this.setupEventListeners()

    // Start periodic monitoring
    this.monitoringInterval = window.setInterval(() => {
      this.analyzeConnectionQuality()
    }, intervalMs)

    // Initial analysis
    this.analyzeConnectionQuality()
    
    // Set up connection recovery monitoring
    this.setupConnectionRecovery()
  }

  /**
   * Stop monitoring connection quality
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return
    }

    console.log('Stopping connection quality monitoring')
    this.isMonitoring = false

    // Clear interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    // Remove event listeners
    this.removeEventListeners()
  }

  /**
   * Set up connection recovery monitoring
   */
  private setupConnectionRecovery(): void {
    // Monitor for connection failures and attempt recovery
    const handleConnectionError = (error: any) => {
      console.log('Connection error detected, analyzing for recovery:', error)
      
      // Record the error event
      this.recordEvent({
        type: 'connection_error',
        timestamp: Date.now(),
        data: error
      })
      
      // Attempt recovery based on error type
      this.attemptConnectionRecovery(error)
    }
    
    const handleConnectionLost = (data: any) => {
      console.log('Connection lost, monitoring for recovery:', data)
      
      this.recordEvent({
        type: 'connection_lost',
        timestamp: Date.now(),
        data
      })
    }
    
    const handleConnectionRestored = (data: any) => {
      console.log('Connection restored:', data)
      
      this.recordEvent({
        type: 'connection_restored',
        timestamp: Date.now(),
        data
      })
    }
    
    // Listen to socket service events
    socketService.on('socket_error', handleConnectionError)
    socketService.on('connection_lost', handleConnectionLost)
    socketService.on('connection_restored', handleConnectionRestored)
    
    // Store listeners for cleanup
    this.eventListeners.set('socket_error', handleConnectionError)
    this.eventListeners.set('connection_lost', handleConnectionLost)
    this.eventListeners.set('connection_restored', handleConnectionRestored)
  }

  /**
   * Attempt connection recovery based on error type
   */
  private attemptConnectionRecovery(error: any): void {
    const errorType = error.type || 'unknown'
    
    switch (errorType) {
      case 'cors_error':
        console.log('CORS error detected - this may require server configuration changes')
        this.emit('recovery_recommendation', {
          type: 'cors_error',
          message: 'CORS configuration issue detected. Please check server settings.',
          severity: 'high'
        })
        break
        
      case 'polling_error':
        console.log('Polling error detected - attempting reconnection')
        this.emit('recovery_recommendation', {
          type: 'polling_error',
          message: 'Connection polling failed. Attempting to reconnect...',
          severity: 'medium'
        })
        break
        
      case 'timeout_error':
        console.log('Timeout error detected - connection may be slow')
        this.emit('recovery_recommendation', {
          type: 'timeout_error',
          message: 'Connection timeout detected. Network may be slow.',
          severity: 'low'
        })
        break
        
      default:
        console.log('Unknown connection error:', errorType)
        this.emit('recovery_recommendation', {
          type: 'unknown_error',
          message: 'Unknown connection error detected.',
          severity: 'medium'
        })
    }
  }

  /**
   * Set up event listeners for connection monitoring
   */
  private setupEventListeners(): void {
    const handleConnectionRestored = (data: any) => {
      this.recordEvent({
        type: 'connect',
        timestamp: Date.now(),
        data
      })
    }

    const handleConnectionLost = (data: any) => {
      this.recordEvent({
        type: 'disconnect',
        timestamp: Date.now(),
        data
      })
    }

    const handleReconnectionSuccess = (data: any) => {
      this.recordEvent({
        type: 'reconnect',
        timestamp: Date.now(),
        data
      })
    }

    const handleSocketError = (data: any) => {
      if (data.error?.message?.includes('parse error')) {
        this.recordEvent({
          type: 'parse_error',
          timestamp: Date.now(),
          data
        })
      }
    }

    // Store listeners and register them
    this.eventListeners.set('connection_restored', handleConnectionRestored)
    this.eventListeners.set('connection_lost', handleConnectionLost)
    this.eventListeners.set('reconnection_success', handleReconnectionSuccess)
    this.eventListeners.set('socket_error', handleSocketError)

    socketService.on('connection_restored', handleConnectionRestored)
    socketService.on('connection_lost', handleConnectionLost)
    socketService.on('reconnection_success', handleReconnectionSuccess)
    socketService.on('socket_error', handleSocketError)
  }

  /**
   * Remove event listeners
   */
  private removeEventListeners(): void {
    for (const [event, listener] of this.eventListeners) {
      socketService.off(event, listener)
    }
    this.eventListeners.clear()
  }

  /**
   * Record a connection event
   */
  private recordEvent(event: ConnectionEvent): void {
    this.connectionEvents.push(event)

    // Keep only recent events
    if (this.connectionEvents.length > this.maxEventHistory) {
      this.connectionEvents.shift()
    }

    // Log significant events
    if (event.type === 'parse_error' || event.type === 'disconnect') {
      console.warn(`Connection event: ${event.type}`, event.data)
    }
  }

  /**
   * Analyze connection quality based on recent events
   */
  private analyzeConnectionQuality(): void {
    const now = Date.now()
    const fiveMinutesAgo = now - 5 * 60 * 1000
    const recentEvents = this.connectionEvents.filter(event => event.timestamp > fiveMinutesAgo)

    if (recentEvents.length === 0) {
      return
    }

    // Calculate metrics
    const parseErrors = recentEvents.filter(event => event.type === 'parse_error').length
    const disconnections = recentEvents.filter(event => event.type === 'disconnect').length
    const reconnections = recentEvents.filter(event => event.type === 'reconnect').length
    const connections = recentEvents.filter(event => event.type === 'connect').length

    const parseErrorRate = parseErrors / recentEvents.length
    const connectionDropRate = disconnections / Math.max(connections, 1)
    const reconnectionSuccessRate = reconnections / Math.max(disconnections, 1)

    // Get parse error metrics from optimizer
    const parseErrorMetrics = socketIOClientOptimizer.getParseErrorMetrics()
    const connectionQuality = socketIOClientOptimizer.getConnectionQuality()

    // Calculate connection uptime (simplified)
    const connectionUptime = this.calculateConnectionUptime(recentEvents)

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      parseErrorRate,
      connectionDropRate,
      reconnectionSuccessRate,
      averageMessageSize: parseErrorMetrics.averageMessageSize,
      connectionUptime,
      lastParseError: parseErrorMetrics.lastParseError,
      connectionQuality,
      recommendations: [] // Will be populated by generateRecommendations
    })

    // Log quality report
    console.log('=== Connection Quality Report ===')
    console.log('Parse Error Rate:', (parseErrorRate * 100).toFixed(2) + '%')
    console.log('Connection Drop Rate:', (connectionDropRate * 100).toFixed(2) + '%')
    console.log('Reconnection Success Rate:', (reconnectionSuccessRate * 100).toFixed(2) + '%')
    console.log('Average Message Size:', Math.round(parseErrorMetrics.averageMessageSize) + ' bytes')
    console.log('Connection Quality:', connectionQuality)
    console.log('Recommendations:', recommendations)

    // Note: Quality report is logged above, emit functionality can be added later if needed
  }

  /**
   * Calculate connection uptime percentage
   */
  private calculateConnectionUptime(events: ConnectionEvent[]): number {
    if (events.length === 0) return 100

    const now = Date.now()
    const fiveMinutesAgo = now - 5 * 60 * 1000
    let totalUptime = 0
    let lastConnectTime = fiveMinutesAgo
    let isConnected = false

    for (const event of events) {
      if (event.type === 'connect') {
        if (!isConnected) {
          lastConnectTime = event.timestamp
          isConnected = true
        }
      } else if (event.type === 'disconnect') {
        if (isConnected) {
          totalUptime += event.timestamp - lastConnectTime
          isConnected = false
        }
      }
    }

    // Add remaining uptime if still connected
    if (isConnected) {
      totalUptime += now - lastConnectTime
    }

    const totalTime = now - fiveMinutesAgo
    return Math.min(100, (totalUptime / totalTime) * 100)
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(metrics: ConnectionQualityMetrics): string[] {
    const recommendations: string[] = []

    if (metrics.parseErrorRate > 0.01) { // > 1%
      recommendations.push('High parse error rate detected - consider reducing message sizes')
    }

    if (metrics.connectionDropRate > 0.1) { // > 10%
      recommendations.push('Frequent connection drops - check network stability')
    }

    if (metrics.reconnectionSuccessRate < 0.8) { // < 80%
      recommendations.push('Low reconnection success rate - consider adjusting reconnection settings')
    }

    if (metrics.averageMessageSize > 100000) { // > 100KB
      recommendations.push('Large average message size - consider message compression or chunking')
    }

    if (metrics.connectionUptime < 95) { // < 95%
      recommendations.push('Low connection uptime - investigate connection stability')
    }

    if (metrics.connectionQuality === 'poor') {
      recommendations.push('Poor connection quality - consider switching to polling transport')
    }

    if (recommendations.length === 0) {
      recommendations.push('Connection quality is good - no immediate optimizations needed')
    }

    return recommendations
  }

  /**
   * Get current connection quality metrics
   */
  getConnectionQualityMetrics(): ConnectionQualityMetrics {
    const parseErrorMetrics = socketIOClientOptimizer.getParseErrorMetrics()
    const connectionQuality = socketIOClientOptimizer.getConnectionQuality()

    const now = Date.now()
    const fiveMinutesAgo = now - 5 * 60 * 1000
    const recentEvents = this.connectionEvents.filter(event => event.timestamp > fiveMinutesAgo)

    const parseErrors = recentEvents.filter(event => event.type === 'parse_error').length
    const disconnections = recentEvents.filter(event => event.type === 'disconnect').length
    const reconnections = recentEvents.filter(event => event.type === 'reconnect').length
    const connections = recentEvents.filter(event => event.type === 'connect').length

    const parseErrorRate = parseErrors / Math.max(recentEvents.length, 1)
    const connectionDropRate = disconnections / Math.max(connections, 1)
    const reconnectionSuccessRate = reconnections / Math.max(disconnections, 1)
    const connectionUptime = this.calculateConnectionUptime(recentEvents)

    const recommendations = this.generateRecommendations({
      parseErrorRate,
      connectionDropRate,
      reconnectionSuccessRate,
      averageMessageSize: parseErrorMetrics.averageMessageSize,
      connectionUptime,
      lastParseError: parseErrorMetrics.lastParseError,
      connectionQuality,
      recommendations: [] // Will be populated by generateRecommendations
    })

    return {
      parseErrorRate,
      connectionDropRate,
      reconnectionSuccessRate,
      averageMessageSize: parseErrorMetrics.averageMessageSize,
      connectionUptime,
      lastParseError: parseErrorMetrics.lastParseError,
      connectionQuality,
      recommendations
    }
  }

  /**
   * Get connection event history
   */
  getConnectionEventHistory(): ConnectionEvent[] {
    return [...this.connectionEvents]
  }

  /**
   * Clear connection event history
   */
  clearEventHistory(): void {
    this.connectionEvents = []
    console.log('Connection event history cleared')
  }

  /**
   * Get monitoring status
   */
  isMonitoringActive(): boolean {
    return this.isMonitoring
  }
}

export const connectionQualityMonitor = new ConnectionQualityMonitor()
