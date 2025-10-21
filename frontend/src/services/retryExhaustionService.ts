/**
 * Retry Exhaustion Handling Service with Intelligent Backoff and Recovery Strategies
 */

import { errorLogger } from '../utils/errorLogger'
// import { networkTimeoutService } from './networkTimeoutService' // Unused import
import { serverAvailabilityService } from './serverAvailabilityService'

export interface RetryExhaustionConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  exponentialBase: number
  jitter: boolean
  circuitBreakerThreshold: number
  recoveryTimeout: number
}

export interface RetryAttempt {
  attemptNumber: number
  timestamp: number
  error: string
  operation: string
  duration: number
  success: boolean
}

export interface RetryExhaustionResult {
  isExhausted: boolean
  totalAttempts: number
  lastError: string
  operation: string
  exhaustionReason: 'max_retries' | 'circuit_breaker' | 'timeout' | 'critical_error'
  recoveryStrategy: string
  nextRetryTime?: number
  canRetry: boolean
}

export interface OperationContext {
  operationType: 'create' | 'update' | 'delete' | 'fetch' | 'auth' | 'socket'
  operationName: string
  criticality: 'low' | 'medium' | 'high' | 'critical'
  userId?: string
  canvasId?: string
  objectId?: string
  metadata?: Record<string, any>
}

export interface RecoveryStrategy {
  name: string
  description: string
  canApply: (context: OperationContext, attempts: RetryAttempt[]) => boolean
  execute: (context: OperationContext, attempts: RetryAttempt[]) => Promise<boolean>
  priority: number
}

class RetryExhaustionService {
  private retryHistory: Map<string, RetryAttempt[]> = new Map()
  private exhaustionStates: Map<string, RetryExhaustionResult> = new Map()
  private recoveryStrategies: RecoveryStrategy[] = []
  
  private readonly DEFAULT_CONFIG: RetryExhaustionConfig = {
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 30000,
    exponentialBase: 2,
    jitter: true,
    circuitBreakerThreshold: 3,
    recoveryTimeout: 60000 // 1 minute
  }

  private readonly OPERATION_CONFIGS: Record<string, Partial<RetryExhaustionConfig>> = {
    create: { maxRetries: 3, baseDelay: 500 },
    update: { maxRetries: 3, baseDelay: 500 },
    delete: { maxRetries: 2, baseDelay: 300 },
    fetch: { maxRetries: 4, baseDelay: 1000 },
    auth: { maxRetries: 2, baseDelay: 2000 },
    socket: { maxRetries: 5, baseDelay: 1000 }
  }

  constructor() {
    this.initializeRecoveryStrategies()
  }

  /**
   * Initialize recovery strategies
   */
  private initializeRecoveryStrategies(): void {
    this.recoveryStrategies = [
      {
        name: 'exponential_backoff',
        description: 'Apply exponential backoff with jitter',
        canApply: (_, attempts) => attempts.length < this.DEFAULT_CONFIG.maxRetries,
        execute: async (_, attempts) => {
          const delay = this.calculateExponentialBackoff(attempts.length)
          await this.sleep(delay)
          return true
        },
        priority: 1
      },
      {
        name: 'circuit_breaker_reset',
        description: 'Reset circuit breaker and wait for recovery',
        canApply: (context, _attempts) => {
          const exhaustionState = this.exhaustionStates.get(this.getOperationKey(context))
          return exhaustionState?.exhaustionReason === 'circuit_breaker'
        },
        execute: async (_context, _attempts) => {
          const delay = this.DEFAULT_CONFIG.recoveryTimeout
          await this.sleep(delay)
          this.clearExhaustionState(_context)
          return true
        },
        priority: 2
      },
      {
        name: 'server_failover',
        description: 'Switch to backup server if available',
        canApply: (_, _attempts) => {
          const availableServers = serverAvailabilityService.getAllServers()
          return availableServers.size > 1
        },
        execute: async (_context, _attempts) => {
          const bestServer = serverAvailabilityService.getBestAvailableServer()
          if (bestServer) {
            console.log(`Switching to backup server: ${bestServer.name}`)
            return true
          }
          return false
        },
        priority: 3
      },
      {
        name: 'auth_token_refresh',
        description: 'Refresh authentication token',
        canApply: (_, attempts) => {
          const lastError = attempts[attempts.length - 1]?.error
          return lastError?.includes('401') || lastError?.includes('Unauthorized')
        },
        execute: async (_context, _attempts) => {
          // This would integrate with auth service
          console.log('Refreshing authentication token')
          return true
        },
        priority: 4
      },
      {
        name: 'graceful_degradation',
        description: 'Switch to offline mode or reduced functionality',
        canApply: (context, _attempts) => {
          return context.criticality === 'low' || context.criticality === 'medium'
        },
        execute: async (_context, _attempts) => {
          console.log(`Switching to graceful degradation for ${_context.operationName}`)
          return true
        },
        priority: 5
      },
      {
        name: 'user_notification',
        description: 'Notify user of service degradation',
        canApply: (context, _attempts) => {
          return context.criticality === 'high' || context.criticality === 'critical'
        },
        execute: async (_context, _attempts) => {
          console.log(`Notifying user of service issues for ${_context.operationName}`)
          // This would integrate with user notification service
          return true
        },
        priority: 6
      }
    ]

    // Sort strategies by priority
    this.recoveryStrategies.sort((a, b) => a.priority - b.priority)
  }

  /**
   * Record a retry attempt
   */
  public recordRetryAttempt(
    context: OperationContext,
    attemptNumber: number,
    success: boolean,
    error: string,
    duration: number
  ): void {
    const operationKey = this.getOperationKey(context)
    const attempts = this.retryHistory.get(operationKey) || []
    
    const attempt: RetryAttempt = {
      attemptNumber,
      timestamp: Date.now(),
      error,
      operation: context.operationName,
      duration,
      success
    }
    
    attempts.push(attempt)
    this.retryHistory.set(operationKey, attempts)
    
    // Log the attempt
    errorLogger.logError('Retry attempt recorded', {
      operation: 'general',
      additionalData: { operationName: context.operationName, attemptNumber, success, error, duration, totalAttempts: attempts.length },
      timestamp: Date.now()
    })
  }

  /**
   * Check if retries are exhausted for an operation
   */
  public checkRetryExhaustion(context: OperationContext): RetryExhaustionResult {
    const operationKey = this.getOperationKey(context)
    const attempts = this.retryHistory.get(operationKey) || []
    const config = this.getConfigForOperation(context.operationType)
    
    // Check if we already have an exhaustion state
    const existingExhaustion = this.exhaustionStates.get(operationKey)
    if (existingExhaustion && existingExhaustion.canRetry) {
      return existingExhaustion
    }
    
    // Check if max retries exceeded
    if (attempts.length >= config.maxRetries) {
      const exhaustionResult: RetryExhaustionResult = {
        isExhausted: true,
        totalAttempts: attempts.length,
        lastError: attempts[attempts.length - 1]?.error || 'Unknown error',
        operation: context.operationName,
        exhaustionReason: 'max_retries',
        recoveryStrategy: this.getRecoveryStrategy(context, attempts),
        canRetry: false
      }
      
      this.exhaustionStates.set(operationKey, exhaustionResult)
      return exhaustionResult
    }
    
    // Check circuit breaker threshold
    const recentFailures = this.getRecentFailures(attempts, 30000) // Last 30 seconds
    if (recentFailures >= config.circuitBreakerThreshold) {
      const exhaustionResult: RetryExhaustionResult = {
        isExhausted: true,
        totalAttempts: attempts.length,
        lastError: attempts[attempts.length - 1]?.error || 'Circuit breaker triggered',
        operation: context.operationName,
        exhaustionReason: 'circuit_breaker',
        recoveryStrategy: this.getRecoveryStrategy(context, attempts),
        nextRetryTime: Date.now() + config.recoveryTimeout,
        canRetry: true
      }
      
      this.exhaustionStates.set(operationKey, exhaustionResult)
      return exhaustionResult
    }
    
    // Check for critical errors
    const lastError = attempts[attempts.length - 1]?.error
    if (this.isCriticalError(lastError)) {
      const exhaustionResult: RetryExhaustionResult = {
        isExhausted: true,
        totalAttempts: attempts.length,
        lastError: lastError || 'Critical error',
        operation: context.operationName,
        exhaustionReason: 'critical_error',
        recoveryStrategy: this.getRecoveryStrategy(context, attempts),
        canRetry: false
      }
      
      this.exhaustionStates.set(operationKey, exhaustionResult)
      return exhaustionResult
    }
    
    // Not exhausted
    return {
      isExhausted: false,
      totalAttempts: attempts.length,
      lastError: attempts[attempts.length - 1]?.error || '',
      operation: context.operationName,
      exhaustionReason: 'max_retries',
      recoveryStrategy: '',
      canRetry: true
    }
  }

  /**
   * Attempt recovery from retry exhaustion
   */
  public async attemptRecovery(context: OperationContext): Promise<boolean> {
    const operationKey = this.getOperationKey(context)
    const attempts = this.retryHistory.get(operationKey) || []
    const exhaustionState = this.exhaustionStates.get(operationKey)
    
    if (!exhaustionState || !exhaustionState.isExhausted) {
      return true // Not exhausted, can proceed
    }
    
    // Find applicable recovery strategies
    const applicableStrategies = this.recoveryStrategies.filter(strategy =>
      strategy.canApply(context, attempts)
    )
    
    // Execute strategies in priority order
    for (const strategy of applicableStrategies) {
      try {
        console.log(`Attempting recovery strategy: ${strategy.name}`)
        const success = await strategy.execute(context, attempts)
        
        if (success) {
          console.log(`Recovery strategy ${strategy.name} succeeded`)
          
          // Clear exhaustion state if recovery was successful
          if (strategy.name === 'circuit_breaker_reset' || strategy.name === 'server_failover') {
            this.clearExhaustionState(context)
          }
          
          return true
        }
      } catch (error) {
        console.error(`Recovery strategy ${strategy.name} failed:`, error)
        errorLogger.logError('Recovery strategy failed', {
          operation: 'general',
          additionalData: { strategy: strategy.name, operationName: context.operationName, error: error instanceof Error ? error.message : 'Unknown error' },
          timestamp: Date.now()
        })
      }
    }
    
    return false
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateExponentialBackoff(attemptNumber: number): number {
    const config = this.DEFAULT_CONFIG
    let delay = config.baseDelay * Math.pow(config.exponentialBase, attemptNumber)
    
    // Apply jitter
    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5)
    }
    
    // Cap at max delay
    delay = Math.min(delay, config.maxDelay)
    
    return Math.round(delay)
  }

  /**
   * Get configuration for operation type
   */
  private getConfigForOperation(operationType: string): RetryExhaustionConfig {
    const operationConfig = this.OPERATION_CONFIGS[operationType] || {}
    return { ...this.DEFAULT_CONFIG, ...operationConfig }
  }

  /**
   * Get recent failures count
   */
  private getRecentFailures(attempts: RetryAttempt[], timeWindow: number): number {
    const cutoffTime = Date.now() - timeWindow
    return attempts.filter(attempt => 
      !attempt.success && attempt.timestamp > cutoffTime
    ).length
  }

  /**
   * Check if error is critical (should not retry)
   */
  private isCriticalError(error: string): boolean {
    const criticalErrors = [
      'Invalid authentication',
      'Permission denied',
      'Invalid object type',
      'Canvas not found',
      'User not found'
    ]
    
    return criticalErrors.some(criticalError => 
      error.toLowerCase().includes(criticalError.toLowerCase())
    )
  }

  /**
   * Get recovery strategy for context
   */
  private getRecoveryStrategy(context: OperationContext, attempts: RetryAttempt[]): string {
    const applicableStrategies = this.recoveryStrategies.filter(strategy =>
      strategy.canApply(context, attempts)
    )
    
    return applicableStrategies.length > 0 ? applicableStrategies[0].name : 'none'
  }

  /**
   * Get operation key for tracking
   */
  private getOperationKey(context: OperationContext): string {
    return `${context.operationType}:${context.operationName}:${context.userId || 'anonymous'}:${context.canvasId || 'global'}`
  }

  /**
   * Clear exhaustion state for operation
   */
  private clearExhaustionState(context: OperationContext): void {
    const operationKey = this.getOperationKey(context)
    this.exhaustionStates.delete(operationKey)
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get retry history for operation
   */
  public getRetryHistory(context: OperationContext): RetryAttempt[] {
    const operationKey = this.getOperationKey(context)
    return this.retryHistory.get(operationKey) || []
  }

  /**
   * Get exhaustion state for operation
   */
  public getExhaustionState(context: OperationContext): RetryExhaustionResult | null {
    const operationKey = this.getOperationKey(context)
    return this.exhaustionStates.get(operationKey) || null
  }

  /**
   * Clear all retry history
   */
  public clearRetryHistory(): void {
    this.retryHistory.clear()
    this.exhaustionStates.clear()
  }

  /**
   * Get retry statistics
   */
  public getRetryStatistics(): {
    totalOperations: number
    exhaustedOperations: number
    averageAttempts: number
    mostCommonErrors: Array<{ error: string; count: number }>
  } {
    const allAttempts = Array.from(this.retryHistory.values()).flat()
    const exhaustedOperations = this.exhaustionStates.size
    const totalOperations = this.retryHistory.size
    
    const averageAttempts = allAttempts.length / Math.max(totalOperations, 1)
    
    // Count error frequencies
    const errorCounts = new Map<string, number>()
    allAttempts.forEach(attempt => {
      if (!attempt.success) {
        const count = errorCounts.get(attempt.error) || 0
        errorCounts.set(attempt.error, count + 1)
      }
    })
    
    const mostCommonErrors = Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
    
    return {
      totalOperations,
      exhaustedOperations,
      averageAttempts,
      mostCommonErrors
    }
  }
}

// Export singleton instance
export const retryExhaustionService = new RetryExhaustionService()

// Export service
export { RetryExhaustionService }
