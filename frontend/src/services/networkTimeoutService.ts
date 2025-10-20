/**
 * Network Timeout Handling Service with Adaptive Timeouts and Connection Quality Monitoring
 */

import { errorLogger } from '../utils/errorLogger'

export interface TimeoutConfig {
  defaultTimeout: number
  maxTimeout: number
  minTimeout: number
  adaptiveMultiplier: number
  connectionQualityThreshold: number
}

export interface ConnectionQuality {
  latency: number
  packetLoss: number
  bandwidth: number
  quality: 'excellent' | 'good' | 'fair' | 'poor'
  lastMeasured: number
}

export interface TimeoutResult<T> {
  success: boolean
  data?: T
  error?: string
  timeout: number
  actualDuration: number
  connectionQuality: ConnectionQuality
}

export interface NetworkMetrics {
  averageLatency: number
  successRate: number
  timeoutRate: number
  connectionQuality: ConnectionQuality
  lastMeasurement: number
}

class NetworkTimeoutService {
  private connectionQuality: ConnectionQuality = {
    latency: 0,
    packetLoss: 0,
    bandwidth: 0,
    quality: 'good',
    lastMeasured: 0
  }

  private networkMetrics: NetworkMetrics = {
    averageLatency: 0,
    successRate: 1.0,
    timeoutRate: 0,
    connectionQuality: this.connectionQuality,
    lastMeasurement: 0
  }

  private readonly DEFAULT_CONFIG: TimeoutConfig = {
    defaultTimeout: 15000, // 15 seconds
    maxTimeout: 60000,     // 60 seconds
    minTimeout: 5000,      // 5 seconds
    adaptiveMultiplier: 1.5,
    connectionQualityThreshold: 0.8
  }

  private readonly MEASUREMENT_INTERVAL = 30000 // 30 seconds
  private readonly MAX_MEASUREMENT_HISTORY = 10

  constructor() {
    this.initializeConnectionMonitoring()
  }

  /**
   * Initialize connection quality monitoring
   */
  private initializeConnectionMonitoring(): void {
    // Measure connection quality periodically
    setInterval(() => {
      this.measureConnectionQuality()
    }, this.MEASUREMENT_INTERVAL)

    // Initial measurement
    this.measureConnectionQuality()
  }

  /**
   * Execute operation with adaptive timeout
   */
  public async executeWithTimeout<T>(
    operation: () => Promise<T>,
    customTimeout?: number,
    operationName: string = 'operation'
  ): Promise<TimeoutResult<T>> {
    const startTime = Date.now()
    const timeout = customTimeout || this.calculateAdaptiveTimeout()
    
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        const actualDuration = Date.now() - startTime
        this.recordTimeout(operationName, timeout, actualDuration)
        
        resolve({
          success: false,
          error: `Operation timed out after ${timeout}ms`,
          timeout,
          actualDuration,
          connectionQuality: this.connectionQuality
        })
      }, timeout)

      operation()
        .then((data) => {
          clearTimeout(timeoutId)
          const actualDuration = Date.now() - startTime
          this.recordSuccess(operationName, timeout, actualDuration)
          
          resolve({
            success: true,
            data,
            timeout,
            actualDuration,
            connectionQuality: this.connectionQuality
          })
        })
        .catch((error) => {
          clearTimeout(timeoutId)
          const actualDuration = Date.now() - startTime
          this.recordError(operationName, timeout, actualDuration, error)
          
          resolve({
            success: false,
            error: error instanceof Error ? error.message : 'Operation failed',
            timeout,
            actualDuration,
            connectionQuality: this.connectionQuality
          })
        })
    })
  }

  /**
   * Execute multiple operations with timeout and fallback
   */
  public async executeWithFallback<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    primaryTimeout?: number,
    fallbackTimeout?: number,
    operationName: string = 'operation'
  ): Promise<TimeoutResult<T>> {
    // Try primary operation first
    const primaryResult = await this.executeWithTimeout(
      primaryOperation,
      primaryTimeout,
      `${operationName}_primary`
    )

    if (primaryResult.success) {
      return primaryResult
    }

    // If primary failed, try fallback
    console.log(`Primary operation failed, trying fallback: ${primaryResult.error}`)
    
    const fallbackResult = await this.executeWithTimeout(
      fallbackOperation,
      fallbackTimeout,
      `${operationName}_fallback`
    )

    return fallbackResult
  }

  /**
   * Calculate adaptive timeout based on connection quality
   */
  private calculateAdaptiveTimeout(): number {
    const baseTimeout = this.DEFAULT_CONFIG.defaultTimeout
    const qualityMultiplier = this.getQualityMultiplier()
    
    let adaptiveTimeout = baseTimeout * qualityMultiplier
    
    // Apply bounds
    adaptiveTimeout = Math.max(adaptiveTimeout, this.DEFAULT_CONFIG.minTimeout)
    adaptiveTimeout = Math.min(adaptiveTimeout, this.DEFAULT_CONFIG.maxTimeout)
    
    return Math.round(adaptiveTimeout)
  }

  /**
   * Get quality multiplier based on connection quality
   */
  private getQualityMultiplier(): number {
    switch (this.connectionQuality.quality) {
      case 'excellent':
        return 0.8
      case 'good':
        return 1.0
      case 'fair':
        return 1.5
      case 'poor':
        return 2.0
      default:
        return 1.0
    }
  }

  /**
   * Measure connection quality using various techniques
   */
  private async measureConnectionQuality(): Promise<void> {
    try {
      const startTime = Date.now()
      
      // Measure latency using a simple ping-like approach
      const latency = await this.measureLatency()
      
      // Measure bandwidth (simplified)
      const bandwidth = await this.measureBandwidth()
      
      // Calculate packet loss (simplified - based on recent failures)
      const packetLoss = this.calculatePacketLoss()
      
      // Determine overall quality
      const quality = this.determineQuality(latency, packetLoss, bandwidth)
      
      this.connectionQuality = {
        latency,
        packetLoss,
        bandwidth,
        quality,
        lastMeasured: Date.now()
      }
      
      this.networkMetrics.connectionQuality = this.connectionQuality
      this.networkMetrics.lastMeasurement = Date.now()
      
      console.log('Connection quality measured:', {
        latency: `${latency}ms`,
        packetLoss: `${(packetLoss * 100).toFixed(1)}%`,
        bandwidth: `${bandwidth}Mbps`,
        quality
      })
      
    } catch (error) {
      console.error('Failed to measure connection quality:', error)
      // Use conservative defaults
      this.connectionQuality = {
        latency: 200,
        packetLoss: 0.1,
        bandwidth: 1,
        quality: 'poor',
        lastMeasured: Date.now()
      }
    }
  }

  /**
   * Measure network latency
   */
  private async measureLatency(): Promise<number> {
    const startTime = performance.now()
    
    try {
      // Use a simple fetch to measure latency
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache'
      })
      
      if (response.ok) {
        return performance.now() - startTime
      } else {
        throw new Error('Health check failed')
      }
    } catch (error) {
      // Fallback to a reasonable default
      return 200
    }
  }

  /**
   * Measure bandwidth (simplified)
   */
  private async measureBandwidth(): Promise<number> {
    try {
      // This is a simplified bandwidth measurement
      // In a real implementation, you might download a small test file
      const startTime = performance.now()
      
      const response = await fetch('/api/health', {
        method: 'GET',
        cache: 'no-cache'
      })
      
      if (response.ok) {
        const data = await response.text()
        const duration = (performance.now() - startTime) / 1000 // seconds
        const sizeBytes = new Blob([data]).size
        const sizeMB = sizeBytes / (1024 * 1024)
        const bandwidthMbps = (sizeMB * 8) / duration // Mbps
        
        return Math.max(bandwidthMbps, 0.1) // Minimum 0.1 Mbps
      } else {
        throw new Error('Bandwidth measurement failed')
      }
    } catch (error) {
      // Fallback to a reasonable default
      return 1.0
    }
  }

  /**
   * Calculate packet loss based on recent operation failures
   */
  private calculatePacketLoss(): number {
    // This is a simplified calculation
    // In a real implementation, you might track actual network packet loss
    const recentFailures = this.networkMetrics.timeoutRate
    return Math.min(recentFailures, 0.5) // Cap at 50%
  }

  /**
   * Determine connection quality based on metrics
   */
  private determineQuality(latency: number, packetLoss: number, bandwidth: number): 'excellent' | 'good' | 'fair' | 'poor' {
    // Excellent: low latency, no packet loss, good bandwidth
    if (latency < 50 && packetLoss < 0.01 && bandwidth > 10) {
      return 'excellent'
    }
    
    // Good: moderate latency, low packet loss, decent bandwidth
    if (latency < 100 && packetLoss < 0.05 && bandwidth > 5) {
      return 'good'
    }
    
    // Fair: higher latency or packet loss, but still usable
    if (latency < 300 && packetLoss < 0.2 && bandwidth > 1) {
      return 'fair'
    }
    
    // Poor: high latency, high packet loss, or low bandwidth
    return 'poor'
  }

  /**
   * Record successful operation
   */
  private recordSuccess(operationName: string, timeout: number, actualDuration: number): void {
    this.updateSuccessRate(true)
    this.updateAverageLatency(actualDuration)
    
    // Log successful operation
    errorLogger.logError('Network operation successful', {
      operation: operationName,
      timeout,
      actualDuration,
      connectionQuality: this.connectionQuality
    })
  }

  /**
   * Record timeout
   */
  private recordTimeout(operationName: string, timeout: number, actualDuration: number): void {
    this.updateSuccessRate(false)
    this.updateTimeoutRate(true)
    
    // Log timeout
    errorLogger.logError('Network operation timed out', {
      operation: operationName,
      timeout,
      actualDuration,
      connectionQuality: this.connectionQuality
    })
  }

  /**
   * Record error
   */
  private recordError(operationName: string, timeout: number, actualDuration: number, error: any): void {
    this.updateSuccessRate(false)
    this.updateTimeoutRate(false)
    
    // Log error
    errorLogger.logError('Network operation failed', {
      operation: operationName,
      timeout,
      actualDuration,
      error: error instanceof Error ? error.message : 'Unknown error',
      connectionQuality: this.connectionQuality
    })
  }

  /**
   * Update success rate
   */
  private updateSuccessRate(success: boolean): void {
    const alpha = 0.1 // Smoothing factor
    this.networkMetrics.successRate = (alpha * (success ? 1 : 0)) + ((1 - alpha) * this.networkMetrics.successRate)
  }

  /**
   * Update timeout rate
   */
  private updateTimeoutRate(isTimeout: boolean): void {
    const alpha = 0.1 // Smoothing factor
    this.networkMetrics.timeoutRate = (alpha * (isTimeout ? 1 : 0)) + ((1 - alpha) * this.networkMetrics.timeoutRate)
  }

  /**
   * Update average latency
   */
  private updateAverageLatency(latency: number): void {
    const alpha = 0.1 // Smoothing factor
    this.networkMetrics.averageLatency = (alpha * latency) + ((1 - alpha) * this.networkMetrics.averageLatency)
  }

  /**
   * Get current network metrics
   */
  public getNetworkMetrics(): NetworkMetrics {
    return { ...this.networkMetrics }
  }

  /**
   * Get current connection quality
   */
  public getConnectionQuality(): ConnectionQuality {
    return { ...this.connectionQuality }
  }

  /**
   * Get recommended timeout for operation type
   */
  public getRecommendedTimeout(operationType: 'create' | 'update' | 'delete' | 'fetch'): number {
    const baseTimeout = this.calculateAdaptiveTimeout()
    
    // Adjust based on operation type
    switch (operationType) {
      case 'create':
        return Math.round(baseTimeout * 1.2) // Create operations might take longer
      case 'update':
        return Math.round(baseTimeout * 1.1) // Update operations are usually faster
      case 'delete':
        return Math.round(baseTimeout * 0.9) // Delete operations are usually fast
      case 'fetch':
        return baseTimeout // Fetch operations use base timeout
      default:
        return baseTimeout
    }
  }

  /**
   * Force connection quality measurement
   */
  public async forceConnectionQualityMeasurement(): Promise<ConnectionQuality> {
    await this.measureConnectionQuality()
    return this.getConnectionQuality()
  }

  /**
   * Reset network metrics
   */
  public resetNetworkMetrics(): void {
    this.networkMetrics = {
      averageLatency: 0,
      successRate: 1.0,
      timeoutRate: 0,
      connectionQuality: this.connectionQuality,
      lastMeasurement: 0
    }
  }
}

// Export singleton instance
export const networkTimeoutService = new NetworkTimeoutService()

// Export types and service
export { NetworkTimeoutService }
export type { TimeoutConfig, ConnectionQuality, TimeoutResult, NetworkMetrics }
