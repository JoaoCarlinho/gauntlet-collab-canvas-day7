/**
 * Network Health Service
 * Monitors network connectivity and service health
 * Provides fallback mechanisms and user feedback
 * 
 * NOTE: Health checking can be disabled by setting DISABLE_HEALTH_CHECKS=true
 */

import { errorLogger } from '../utils/errorLogger'
import { retryWithCondition, isRetryableError } from '../utils/retryLogic'
import { productionLogger } from '../utils/productionLogger'
import toast from 'react-hot-toast'

export interface NetworkStatus {
  isOnline: boolean
  apiHealth: 'healthy' | 'degraded' | 'unhealthy'
  socketHealth: 'connected' | 'disconnected' | 'reconnecting'
  lastCheck: number
  errorCount: number
  retryCount: number
}

export interface ServiceHealth {
  service: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime?: number
  lastError?: string
  lastCheck: number
}

export interface NetworkHealthConfig {
  checkInterval: number
  maxRetries: number
  retryDelay: number
  timeout: number
  services: string[]
}

class NetworkHealthService {
  private networkStatus: NetworkStatus = {
    isOnline: navigator.onLine,
    apiHealth: 'healthy',
    socketHealth: 'connected',
    lastCheck: Date.now(),
    errorCount: 0,
    retryCount: 0
  }

  private serviceHealth: Map<string, ServiceHealth> = new Map()
  private config: NetworkHealthConfig
  private checkInterval: NodeJS.Timeout | null = null
  private listeners: Map<string, Function[]> = new Map()
  private isMonitoring = false

  constructor(config: Partial<NetworkHealthConfig> = {}) {
    this.config = {
      checkInterval: 30000, // 30 seconds
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 5000,
      services: ['api', 'socket', 'auth'],
      ...config
    }

    this.initializeEventListeners()
    this.initializeServiceHealth()
  }

  /**
   * Initialize event listeners for network status
   */
  private initializeEventListeners(): void {
    // Browser online/offline events
    window.addEventListener('online', () => {
      this.handleNetworkChange(true)
    })

    window.addEventListener('offline', () => {
      this.handleNetworkChange(false)
    })

    // Page visibility change
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.performHealthCheck()
      }
    })
  }

  /**
   * Initialize service health tracking
   */
  private initializeServiceHealth(): void {
    this.config.services.forEach(service => {
      this.serviceHealth.set(service, {
        service,
        status: 'healthy',
        lastCheck: Date.now()
      })
    })
  }

  /**
   * Start monitoring network health
   */
  startMonitoring(): void {
    if (this.isMonitoring) return

    this.isMonitoring = true
    this.performHealthCheck()

    this.checkInterval = setInterval(() => {
      this.performHealthCheck()
    }, this.config.checkInterval)

    productionLogger.info('Network health monitoring started')
  }

  /**
   * Stop monitoring network health
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    this.isMonitoring = false
    productionLogger.info('Network health monitoring stopped')
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<void> {
    try {
      // Check basic connectivity
      await this.checkBasicConnectivity()

      // Check API health
      await this.checkAPIHealth()

      // Check Socket.IO health
      await this.checkSocketHealth()

      // Update overall status
      this.updateNetworkStatus()

      // Notify listeners
      this.notifyListeners('healthCheck', this.networkStatus)

    } catch (error) {
      this.handleHealthCheckError(error)
    }
  }

  /**
   * Check basic internet connectivity
   */
  private async checkBasicConnectivity(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

      // Use the correct API URL instead of relative path
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
      const response = await fetch(`${API_URL}/api/health`, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache'
      })

      clearTimeout(timeoutId)
      return response.ok
    } catch (error) {
      // Fallback to a simple connectivity test
      return this.testBasicConnectivity()
    }
  }

  /**
   * Fallback connectivity test
   */
  private async testBasicConnectivity(): Promise<boolean> {
    try {
      await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache'
      })
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Check API service health
   */
  private async checkAPIHealth(): Promise<void> {
    const startTime = Date.now()
    
    try {
      // Use the correct API URL instead of relative path
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
      const response = await fetch(`${API_URL}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        cache: 'no-cache'
      })

      const responseTime = Date.now() - startTime
      const isHealthy = response.ok && responseTime < 2000

      this.updateServiceHealth('api', {
        status: isHealthy ? 'healthy' : 'degraded',
        responseTime,
        lastCheck: Date.now()
      })

    } catch (error) {
      this.updateServiceHealth('api', {
        status: 'unhealthy',
        lastError: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: Date.now()
      })
    }
  }

  /**
   * Check Socket.IO service health
   */
  private async checkSocketHealth(): Promise<void> {
    // This would be implemented based on your socket service
    // For now, we'll assume it's healthy if we have a socket connection
    const socketService = (window as any).socketService
    
    if (socketService && socketService.isConnected()) {
      this.updateServiceHealth('socket', {
        status: 'healthy',
        lastCheck: Date.now()
      })
    } else {
      this.updateServiceHealth('socket', {
        status: 'unhealthy',
        lastError: 'Socket not connected',
        lastCheck: Date.now()
      })
    }
  }

  /**
   * Update service health status
   */
  private updateServiceHealth(service: string, health: Partial<ServiceHealth>): void {
    const current = this.serviceHealth.get(service)
    if (current) {
      this.serviceHealth.set(service, {
        ...current,
        ...health
      })
    }
  }

  /**
   * Update overall network status
   */
  private updateNetworkStatus(): void {
    const apiHealth = this.serviceHealth.get('api')?.status || 'unhealthy'
    const socketHealth = this.serviceHealth.get('socket')?.status || 'disconnected'

    // Determine overall API health
    if (apiHealth === 'healthy') {
      this.networkStatus.apiHealth = 'healthy'
    } else if (apiHealth === 'degraded') {
      this.networkStatus.apiHealth = 'degraded'
    } else {
      this.networkStatus.apiHealth = 'unhealthy'
    }

    // Determine socket health
    if (socketHealth === 'healthy') {
      this.networkStatus.socketHealth = 'connected'
    } else if (socketHealth === 'degraded') {
      this.networkStatus.socketHealth = 'reconnecting'
    } else {
      this.networkStatus.socketHealth = 'disconnected'
    }

    this.networkStatus.lastCheck = Date.now()
  }

  /**
   * Handle network status change
   */
  private handleNetworkChange(isOnline: boolean): void {
    this.networkStatus.isOnline = isOnline

    if (isOnline) {
      productionLogger.info('Network connection restored')
      // Network connection monitoring - toast notifications suppressed
      this.performHealthCheck()
    } else {
      productionLogger.warning('Network connection lost')
      // Network connection monitoring - toast notifications suppressed
    }

    this.notifyListeners('networkChange', this.networkStatus)
  }

  /**
   * Handle health check errors
   */
  private handleHealthCheckError(error: any): void {
    this.networkStatus.errorCount++
    
      errorLogger.logError(error, {
        operation: 'general',
        timestamp: Date.now(),
        additionalData: {
          errorCount: this.networkStatus.errorCount,
          retryCount: this.networkStatus.retryCount
        }
      })

    // If we have too many errors, mark as unhealthy
    if (this.networkStatus.errorCount > 3) {
      this.networkStatus.apiHealth = 'unhealthy'
      this.notifyListeners('healthDegraded', this.networkStatus)
    }
  }

  /**
   * Get current network status
   */
  getNetworkStatus(): NetworkStatus {
    return { ...this.networkStatus }
  }

  /**
   * Get service health status
   */
  getServiceHealth(service?: string): ServiceHealth | Map<string, ServiceHealth> {
    if (service) {
      return this.serviceHealth.get(service) || {
        service,
        status: 'unhealthy',
        lastCheck: Date.now()
      }
    }
    return new Map(this.serviceHealth)
  }

  /**
   * Check if a service is healthy
   */
  isServiceHealthy(service: string): boolean {
    const health = this.serviceHealth.get(service)
    return health?.status === 'healthy'
  }

  /**
   * Get user-friendly status message
   */
  getStatusMessage(): string {
    if (!this.networkStatus.isOnline) {
      return 'No internet connection. Some features may be limited.'
    }

    if (this.networkStatus.apiHealth === 'unhealthy') {
      return 'Server connection issues. Some features may be limited.'
    }

    if (this.networkStatus.apiHealth === 'degraded') {
      return 'Slow connection detected. Some features may be limited.'
    }

    if (this.networkStatus.socketHealth === 'disconnected') {
      return 'Real-time features unavailable. Some features may be limited.'
    }

    return 'All services are running normally.'
  }

  /**
   * Add event listener
   */
  addEventListener(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  /**
   * Notify event listeners
   */
  private notifyListeners(event: string, data: any): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data as any)
        } catch (error) {
          productionLogger.error('Error in network health listener', error as any)
        }
      })
    }
  }

  /**
   * Retry failed operation with network health awareness
   */
  async retryWithHealthCheck<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number
      retryDelay?: number
      service?: string
    } = {}
  ): Promise<T> {
    const { maxRetries = this.config.maxRetries, retryDelay = this.config.retryDelay, service } = options

    return retryWithCondition(
      operation,
      (error: any, attempt: number) => {
        // Don't retry if network is offline
        if (!this.networkStatus.isOnline) {
          return false
        }

        // Don't retry if service is unhealthy
        if (service && !this.isServiceHealthy(service)) {
          return false
        }

        // Use standard retry logic
        return isRetryableError(error) && attempt < maxRetries
      },
      {
        baseDelay: retryDelay
      }
    ).then(result => {
      if (result.success) {
        return result.data!
      } else {
        throw result.error
      }
    })
  }

  /**
   * Get network health summary for debugging
   */
  getHealthSummary(): any {
    return {
      networkStatus: this.networkStatus,
      serviceHealth: Object.fromEntries(this.serviceHealth),
      config: this.config,
      isMonitoring: this.isMonitoring,
      listeners: Array.from(this.listeners.keys())
    }
  }
}

// Create singleton instance
const networkHealthService = new NetworkHealthService()

// Check if health checks should be disabled
const isHealthChecksDisabled = 
  import.meta.env.DISABLE_HEALTH_CHECKS === 'true' ||
  import.meta.env.SKIP_HEALTH_MONITORING === 'true' ||
  import.meta.env.HEALTH_CHECK_ENABLED === 'false'

// Export disabled version if health checks are disabled
if (isHealthChecksDisabled) {
  console.log('Health checks disabled - using mock service')
  // Import and export the disabled version
  import('./networkHealthService.disabled').then(({ networkHealthService: disabledService }) => {
    Object.assign(networkHealthService, disabledService)
  })
}

export { networkHealthService }
export default networkHealthService
