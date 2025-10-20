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
   * Set up event listeners for connection monitoring
   */
  private setupEventListeners(): void {
    socketService.on('connection_restored', (data) => {
      this.recordEvent({
        type: 'connect',
        timestamp: Date.now(),
        data
      })
    })

    socketService.on('connection_lost', (data) => {
      this.recordEvent({
        type: 'disconnect',
        timestamp: Date.now(),
        data
      })
    })

    socketService.on('reconnection_success', (data) => {
      this.recordEvent({
        type: 'reconnect',
        timestamp: Date.now(),
        data
      })
    })

    socketService.on('socket_error', (data) => {
      if (data.error?.message?.includes('parse error')) {
        this.recordEvent({
          type: 'parse_error',
          timestamp: Date.now(),
          data
        })
      }
    })
  }

  /**
   * Remove event listeners
   */
  private removeEventListeners(): void {
    socketService.off('connection_restored')
    socketService.off('connection_lost')
    socketService.off('reconnection_success')
    socketService.off('socket_error')
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
      connectionQuality
    })

    // Log quality report
    console.log('=== Connection Quality Report ===')
    console.log('Parse Error Rate:', (parseErrorRate * 100).toFixed(2) + '%')
    console.log('Connection Drop Rate:', (connectionDropRate * 100).toFixed(2) + '%')
    console.log('Reconnection Success Rate:', (reconnectionSuccessRate * 100).toFixed(2) + '%')
    console.log('Average Message Size:', Math.round(parseErrorMetrics.averageMessageSize) + ' bytes')
    console.log('Connection Quality:', connectionQuality)
    console.log('Recommendations:', recommendations)

    // Emit quality report
    socketService.emit('connection_quality_report', {
      parseErrorRate,
      connectionDropRate,
      reconnectionSuccessRate,
      averageMessageSize: parseErrorMetrics.averageMessageSize,
      connectionUptime,
      lastParseError: parseErrorMetrics.lastParseError,
      connectionQuality,
      recommendations,
      timestamp: now
    })
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
      connectionQuality
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
