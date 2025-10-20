/**
 * Server Availability Monitoring Service with Health Checks and Failover Management
 */

import { errorLogger } from '../utils/errorLogger'
import { networkTimeoutService } from './networkTimeoutService'

export interface ServerHealth {
  isAvailable: boolean
  responseTime: number
  lastChecked: number
  consecutiveFailures: number
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
  error?: string
}

export interface ServerEndpoint {
  name: string
  url: string
  healthCheckPath: string
  timeout: number
  retryAttempts: number
  priority: number
}

export interface AvailabilityMetrics {
  overallAvailability: number
  averageResponseTime: number
  totalChecks: number
  successfulChecks: number
  failedChecks: number
  lastHealthCheck: number
  servers: Map<string, ServerHealth>
}

export interface HealthCheckResult {
  server: string
  isHealthy: boolean
  responseTime: number
  error?: string
  timestamp: number
}

class ServerAvailabilityService {
  private servers: Map<string, ServerEndpoint> = new Map()
  private serverHealth: Map<string, ServerHealth> = new Map()
  private availabilityMetrics: AvailabilityMetrics = {
    overallAvailability: 1.0,
    averageResponseTime: 0,
    totalChecks: 0,
    successfulChecks: 0,
    failedChecks: 0,
    lastHealthCheck: 0,
    servers: new Map()
  }

  private healthCheckInterval: NodeJS.Timeout | null = null
  private readonly DEFAULT_HEALTH_CHECK_INTERVAL = 30000 // 30 seconds
  private readonly DEFAULT_TIMEOUT = 10000 // 10 seconds
  private readonly MAX_CONSECUTIVE_FAILURES = 3
  private readonly DEGRADED_THRESHOLD = 0.8
  private readonly UNHEALTHY_THRESHOLD = 0.5

  constructor() {
    this.initializeDefaultServers()
    this.startHealthCheckMonitoring()
  }

  /**
   * Initialize default server endpoints
   */
  private initializeDefaultServers(): void {
    const isDevelopment = import.meta.env.DEV || 
                         import.meta.env.VITE_DEBUG_MODE === 'true' ||
                         window.location.hostname === 'localhost' ||
                         window.location.hostname === '127.0.0.1'

    if (isDevelopment) {
      // Development servers
      this.addServer({
        name: 'local-backend',
        url: 'http://localhost:5000',
        healthCheckPath: '/health',
        timeout: 5000,
        retryAttempts: 2,
        priority: 1
      })
    } else {
      // Production servers
      const API_URL = import.meta.env.VITE_API_URL || 'https://api.collabcanvas.com'
      
      this.addServer({
        name: 'primary-backend',
        url: API_URL,
        healthCheckPath: '/health',
        timeout: this.DEFAULT_TIMEOUT,
        retryAttempts: 3,
        priority: 1
      })

      // Add backup servers if available
      const BACKUP_API_URL = import.meta.env.VITE_BACKUP_API_URL
      if (BACKUP_API_URL) {
        this.addServer({
          name: 'backup-backend',
          url: BACKUP_API_URL,
          healthCheckPath: '/health',
          timeout: this.DEFAULT_TIMEOUT,
          retryAttempts: 2,
          priority: 2
        })
      }
    }
  }

  /**
   * Add a server endpoint for monitoring
   */
  public addServer(server: ServerEndpoint): void {
    this.servers.set(server.name, server)
    this.serverHealth.set(server.name, {
      isAvailable: false,
      responseTime: 0,
      lastChecked: 0,
      consecutiveFailures: 0,
      status: 'unknown'
    })
  }

  /**
   * Remove a server endpoint
   */
  public removeServer(serverName: string): void {
    this.servers.delete(serverName)
    this.serverHealth.delete(serverName)
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheckMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks()
    }, this.DEFAULT_HEALTH_CHECK_INTERVAL)

    // Perform initial health check
    this.performHealthChecks()
  }

  /**
   * Stop health check monitoring
   */
  public stopHealthCheckMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
  }

  /**
   * Perform health checks on all servers
   */
  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises = Array.from(this.servers.entries()).map(([name, server]) =>
      this.checkServerHealth(name, server)
    )

    try {
      const results = await Promise.allSettled(healthCheckPromises)
      this.updateAvailabilityMetrics(results)
      this.availabilityMetrics.lastHealthCheck = Date.now()
    } catch (error) {
      console.error('Health check monitoring failed:', error)
      errorLogger.logError('Health check monitoring failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * Check health of a specific server
   */
  private async checkServerHealth(serverName: string, server: ServerEndpoint): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      const healthCheckUrl = `${server.url}${server.healthCheckPath}`
      
      const result = await networkTimeoutService.executeWithTimeout(
        async () => {
          const response = await fetch(healthCheckUrl, {
            method: 'GET',
            cache: 'no-cache',
            headers: {
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            }
          })

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          return await response.json()
        },
        server.timeout,
        `health_check_${serverName}`
      )

      const responseTime = Date.now() - startTime
      const isHealthy = result.success

      // Update server health
      const currentHealth = this.serverHealth.get(serverName)!
      const updatedHealth: ServerHealth = {
        isAvailable: isHealthy,
        responseTime,
        lastChecked: Date.now(),
        consecutiveFailures: isHealthy ? 0 : currentHealth.consecutiveFailures + 1,
        status: this.determineServerStatus(isHealthy, currentHealth.consecutiveFailures + (isHealthy ? 0 : 1)),
        error: isHealthy ? undefined : result.error
      }

      this.serverHealth.set(serverName, updatedHealth)

      return {
        server: serverName,
        isHealthy,
        responseTime,
        error: isHealthy ? undefined : result.error,
        timestamp: Date.now()
      }

    } catch (error) {
      const responseTime = Date.now() - startTime
      const currentHealth = this.serverHealth.get(serverName)!
      
      const updatedHealth: ServerHealth = {
        isAvailable: false,
        responseTime,
        lastChecked: Date.now(),
        consecutiveFailures: currentHealth.consecutiveFailures + 1,
        status: this.determineServerStatus(false, currentHealth.consecutiveFailures + 1),
        error: error instanceof Error ? error.message : 'Health check failed'
      }

      this.serverHealth.set(serverName, updatedHealth)

      return {
        server: serverName,
        isHealthy: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Health check failed',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Determine server status based on health and consecutive failures
   */
  private determineServerStatus(isHealthy: boolean, consecutiveFailures: number): 'healthy' | 'degraded' | 'unhealthy' | 'unknown' {
    if (isHealthy && consecutiveFailures === 0) {
      return 'healthy'
    } else if (isHealthy && consecutiveFailures < this.MAX_CONSECUTIVE_FAILURES) {
      return 'degraded'
    } else if (!isHealthy && consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      return 'unhealthy'
    } else {
      return 'unknown'
    }
  }

  /**
   * Update availability metrics based on health check results
   */
  private updateAvailabilityMetrics(results: PromiseSettledResult<HealthCheckResult>[]): void {
    let totalResponseTime = 0
    let successfulChecks = 0
    let failedChecks = 0

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const healthResult = result.value
        totalResponseTime += healthResult.responseTime
        
        if (healthResult.isHealthy) {
          successfulChecks++
        } else {
          failedChecks++
        }
      } else {
        failedChecks++
      }
    })

    this.availabilityMetrics.totalChecks += results.length
    this.availabilityMetrics.successfulChecks += successfulChecks
    this.availabilityMetrics.failedChecks += failedChecks

    if (this.availabilityMetrics.totalChecks > 0) {
      this.availabilityMetrics.overallAvailability = 
        this.availabilityMetrics.successfulChecks / this.availabilityMetrics.totalChecks
    }

    if (successfulChecks > 0) {
      this.availabilityMetrics.averageResponseTime = totalResponseTime / successfulChecks
    }

    // Update servers map
    this.availabilityMetrics.servers = new Map(this.serverHealth)
  }

  /**
   * Get the best available server
   */
  public getBestAvailableServer(): ServerEndpoint | null {
    const availableServers = Array.from(this.servers.entries())
      .filter(([name, _]) => {
        const health = this.serverHealth.get(name)
        return health && health.isAvailable && health.status !== 'unhealthy'
      })
      .sort(([nameA, _], [nameB, __]) => {
        const healthA = this.serverHealth.get(nameA)!
        const healthB = this.serverHealth.get(nameB)!
        
        // Sort by priority first, then by response time
        const serverA = this.servers.get(nameA)!
        const serverB = this.servers.get(nameB)!
        
        if (serverA.priority !== serverB.priority) {
          return serverA.priority - serverB.priority
        }
        
        return healthA.responseTime - healthB.responseTime
      })

    return availableServers.length > 0 ? availableServers[0][1] : null
  }

  /**
   * Check if any server is available
   */
  public isAnyServerAvailable(): boolean {
    return Array.from(this.serverHealth.values()).some(health => 
      health.isAvailable && health.status !== 'unhealthy'
    )
  }

  /**
   * Get server health information
   */
  public getServerHealth(serverName: string): ServerHealth | null {
    return this.serverHealth.get(serverName) || null
  }

  /**
   * Get all server health information
   */
  public getAllServerHealth(): Map<string, ServerHealth> {
    return new Map(this.serverHealth)
  }

  /**
   * Get availability metrics
   */
  public getAvailabilityMetrics(): AvailabilityMetrics {
    return { ...this.availabilityMetrics }
  }

  /**
   * Force health check on all servers
   */
  public async forceHealthCheck(): Promise<HealthCheckResult[]> {
    const healthCheckPromises = Array.from(this.servers.entries()).map(([name, server]) =>
      this.checkServerHealth(name, server)
    )

    const results = await Promise.allSettled(healthCheckPromises)
    const healthResults: HealthCheckResult[] = []

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        healthResults.push(result.value)
      }
    })

    this.updateAvailabilityMetrics(results)
    return healthResults
  }

  /**
   * Get server endpoint by name
   */
  public getServer(serverName: string): ServerEndpoint | null {
    return this.servers.get(serverName) || null
  }

  /**
   * Get all server endpoints
   */
  public getAllServers(): Map<string, ServerEndpoint> {
    return new Map(this.servers)
  }

  /**
   * Reset availability metrics
   */
  public resetAvailabilityMetrics(): void {
    this.availabilityMetrics = {
      overallAvailability: 1.0,
      averageResponseTime: 0,
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      lastHealthCheck: 0,
      servers: new Map()
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stopHealthCheckMonitoring()
  }
}

// Export singleton instance
export const serverAvailabilityService = new ServerAvailabilityService()

// Export types and service
export { ServerAvailabilityService }
export type { ServerHealth, ServerEndpoint, AvailabilityMetrics, HealthCheckResult }
