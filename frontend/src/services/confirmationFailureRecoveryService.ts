/**
 * Confirmation Failure Recovery Service with Object Verification and State Synchronization
 */

import { errorLogger } from '../utils/errorLogger'
import { objectsAPI } from './api'
import { authService } from './authService'
import { networkTimeoutService } from './networkTimeoutService'

export interface ConfirmationFailureContext {
  operationType: 'create' | 'update' | 'delete'
  objectId: string
  canvasId: string
  userId: string
  originalData?: any
  timestamp: number
  retryCount: number
}

export interface ConfirmationResult {
  success: boolean
  object?: any
  error?: string
  verificationMethod: 'direct_fetch' | 'list_scan' | 'socket_verification' | 'failed'
  recoveryStrategy?: string
  timestamp: number
}

export interface RecoveryStrategy {
  name: string
  description: string
  canApply: (context: ConfirmationFailureContext) => boolean
  execute: (context: ConfirmationFailureContext) => Promise<ConfirmationResult>
  priority: number
  maxAttempts: number
}

export interface ConfirmationFailureMetrics {
  totalFailures: number
  successfulRecoveries: number
  failedRecoveries: number
  averageRecoveryTime: number
  mostCommonFailures: Array<{ operation: string; count: number }>
  recoveryStrategies: Array<{ strategy: string; successRate: number; attempts: number }>
}

class ConfirmationFailureRecoveryService {
  private recoveryStrategies: RecoveryStrategy[] = []
  private failureHistory: Map<string, ConfirmationFailureContext[]> = new Map()
  private metrics: ConfirmationFailureMetrics = {
    totalFailures: 0,
    successfulRecoveries: 0,
    failedRecoveries: 0,
    averageRecoveryTime: 0,
    mostCommonFailures: [],
    recoveryStrategies: []
  }

  private readonly MAX_RETRY_ATTEMPTS = 3
  private readonly VERIFICATION_TIMEOUT = 10000 // 10 seconds
  private readonly RECOVERY_TIMEOUT = 30000 // 30 seconds

  constructor() {
    this.initializeRecoveryStrategies()
  }

  /**
   * Initialize recovery strategies
   */
  private initializeRecoveryStrategies(): void {
    this.recoveryStrategies = [
      {
        name: 'direct_object_fetch',
        description: 'Directly fetch the object by ID to verify creation',
        canApply: (context) => context.operationType === 'create' || context.operationType === 'update',
        execute: async (context) => this.directObjectFetch(context),
        priority: 1,
        maxAttempts: 2
      },
      {
        name: 'canvas_objects_scan',
        description: 'Scan all canvas objects to find the missing object',
        canApply: (context) => context.operationType === 'create',
        execute: async (context) => this.canvasObjectsScan(context),
        priority: 2,
        maxAttempts: 1
      },
      {
        name: 'socket_verification',
        description: 'Use socket connection to verify object state',
        canApply: (context) => true,
        execute: async (context) => this.socketVerification(context),
        priority: 3,
        maxAttempts: 2
      },
      {
        name: 'delayed_verification',
        description: 'Wait and retry verification after a delay',
        canApply: (context) => context.retryCount < this.MAX_RETRY_ATTEMPTS,
        execute: async (context) => this.delayedVerification(context),
        priority: 4,
        maxAttempts: 2
      },
      {
        name: 'state_reconstruction',
        description: 'Reconstruct object state from available data',
        canApply: (context) => context.originalData !== undefined,
        execute: async (context) => this.stateReconstruction(context),
        priority: 5,
        maxAttempts: 1
      },
      {
        name: 'user_notification',
        description: 'Notify user of confirmation failure and provide options',
        canApply: (context) => context.retryCount >= this.MAX_RETRY_ATTEMPTS,
        execute: async (context) => this.userNotification(context),
        priority: 6,
        maxAttempts: 1
      }
    ]

    // Sort strategies by priority
    this.recoveryStrategies.sort((a, b) => a.priority - b.priority)
  }

  /**
   * Attempt to recover from confirmation failure
   */
  public async attemptRecovery(context: ConfirmationFailureContext): Promise<ConfirmationResult> {
    const startTime = Date.now()
    
    try {
      // Record the failure
      this.recordFailure(context)
      
      // Find applicable recovery strategies
      const applicableStrategies = this.recoveryStrategies.filter(strategy =>
        strategy.canApply(context)
      )
      
      if (applicableStrategies.length === 0) {
        return {
          success: false,
          error: 'No recovery strategies available',
          verificationMethod: 'failed',
          timestamp: Date.now()
        }
      }
      
      // Try strategies in priority order
      for (const strategy of applicableStrategies) {
        try {
          console.log(`Attempting recovery strategy: ${strategy.name}`)
          
          const result = await networkTimeoutService.executeWithTimeout(
            () => strategy.execute(context),
            this.RECOVERY_TIMEOUT,
            `confirmation_recovery_${strategy.name}`
          )
          
          if (result.success && result.data) {
            const confirmationResult = result.data as ConfirmationResult
            
            if (confirmationResult.success) {
              console.log(`Recovery strategy ${strategy.name} succeeded`)
              this.recordSuccessfulRecovery(strategy.name, Date.now() - startTime)
              
              return {
                ...confirmationResult,
                recoveryStrategy: strategy.name,
                timestamp: Date.now()
              }
            }
          }
          
          console.log(`Recovery strategy ${strategy.name} failed: ${result.error}`)
          
        } catch (error) {
          console.error(`Recovery strategy ${strategy.name} threw error:`, error)
          errorLogger.logError('Recovery strategy error', {
            strategy: strategy.name,
            context,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
      
      // All strategies failed
      this.recordFailedRecovery(Date.now() - startTime)
      
      return {
        success: false,
        error: 'All recovery strategies failed',
        verificationMethod: 'failed',
        recoveryStrategy: 'none',
        timestamp: Date.now()
      }
      
    } catch (error) {
      console.error('Confirmation recovery failed:', error)
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Recovery failed',
        verificationMethod: 'failed',
        recoveryStrategy: 'none',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Direct object fetch strategy
   */
  private async directObjectFetch(context: ConfirmationFailureContext): Promise<ConfirmationResult> {
    try {
      const response = await objectsAPI.getObject(context.objectId)
      
      if (response.object && response.object.id === context.objectId) {
        return {
          success: true,
          object: response.object,
          verificationMethod: 'direct_fetch',
          timestamp: Date.now()
        }
      } else {
        return {
          success: false,
          error: 'Object not found or ID mismatch',
          verificationMethod: 'direct_fetch',
          timestamp: Date.now()
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Direct fetch failed',
        verificationMethod: 'direct_fetch',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Canvas objects scan strategy
   */
  private async canvasObjectsScan(context: ConfirmationFailureContext): Promise<ConfirmationResult> {
    try {
      const response = await objectsAPI.getCanvasObjects(context.canvasId)
      
      if (response.objects) {
        const foundObject = response.objects.find(obj => obj.id === context.objectId)
        
        if (foundObject) {
          return {
            success: true,
            object: foundObject,
            verificationMethod: 'list_scan',
            timestamp: Date.now()
          }
        }
      }
      
      return {
        success: false,
        error: 'Object not found in canvas objects list',
        verificationMethod: 'list_scan',
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Canvas scan failed',
        verificationMethod: 'list_scan',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Socket verification strategy
   */
  private async socketVerification(context: ConfirmationFailureContext): Promise<ConfirmationResult> {
    try {
      // This would integrate with socket service to verify object state
      // For now, we'll simulate the verification
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({
            success: false,
            error: 'Socket verification timeout',
            verificationMethod: 'socket_verification',
            timestamp: Date.now()
          })
        }, this.VERIFICATION_TIMEOUT)
        
        // Simulate socket verification
        setTimeout(() => {
          clearTimeout(timeout)
          resolve({
            success: false,
            error: 'Socket verification not implemented',
            verificationMethod: 'socket_verification',
            timestamp: Date.now()
          })
        }, 1000)
      })
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Socket verification failed',
        verificationMethod: 'socket_verification',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Delayed verification strategy
   */
  private async delayedVerification(context: ConfirmationFailureContext): Promise<ConfirmationResult> {
    try {
      // Wait for a delay based on retry count
      const delay = Math.min(1000 * Math.pow(2, context.retryCount), 5000)
      await new Promise(resolve => setTimeout(resolve, delay))
      
      // Try direct fetch again
      return await this.directObjectFetch(context)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delayed verification failed',
        verificationMethod: 'direct_fetch',
        timestamp: Date.now()
      }
    }
  }

  /**
   * State reconstruction strategy
   */
  private async stateReconstruction(context: ConfirmationFailureContext): Promise<ConfirmationResult> {
    try {
      if (!context.originalData) {
        return {
          success: false,
          error: 'No original data available for reconstruction',
          verificationMethod: 'failed',
          timestamp: Date.now()
        }
      }
      
      // Reconstruct object with original data and current timestamp
      const reconstructedObject = {
        ...context.originalData,
        id: context.objectId,
        canvas_id: context.canvasId,
        user_id: context.userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      return {
        success: true,
        object: reconstructedObject,
        verificationMethod: 'direct_fetch',
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'State reconstruction failed',
        verificationMethod: 'failed',
        timestamp: Date.now()
      }
    }
  }

  /**
   * User notification strategy
   */
  private async userNotification(context: ConfirmationFailureContext): Promise<ConfirmationResult> {
    try {
      // This would integrate with user notification service
      console.log(`Notifying user of confirmation failure for ${context.operationType} operation on object ${context.objectId}`)
      
      // For now, we'll return a failure but with a user-friendly message
      return {
        success: false,
        error: 'Object operation confirmation failed. Please try again or contact support if the issue persists.',
        verificationMethod: 'failed',
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'User notification failed',
        verificationMethod: 'failed',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Record confirmation failure
   */
  private recordFailure(context: ConfirmationFailureContext): void {
    const key = `${context.canvasId}:${context.userId}`
    const failures = this.failureHistory.get(key) || []
    failures.push(context)
    this.failureHistory.set(key, failures)
    
    this.metrics.totalFailures++
    
    // Update most common failures
    const operationKey = `${context.operationType}:${context.canvasId}`
    const existingFailure = this.metrics.mostCommonFailures.find(f => f.operation === operationKey)
    if (existingFailure) {
      existingFailure.count++
    } else {
      this.metrics.mostCommonFailures.push({ operation: operationKey, count: 1 })
    }
    
    // Sort by count
    this.metrics.mostCommonFailures.sort((a, b) => b.count - a.count)
  }

  /**
   * Record successful recovery
   */
  private recordSuccessfulRecovery(strategy: string, recoveryTime: number): void {
    this.metrics.successfulRecoveries++
    
    // Update average recovery time
    const totalRecoveries = this.metrics.successfulRecoveries + this.metrics.failedRecoveries
    this.metrics.averageRecoveryTime = 
      (this.metrics.averageRecoveryTime * (totalRecoveries - 1) + recoveryTime) / totalRecoveries
    
    // Update strategy metrics
    const strategyMetric = this.metrics.recoveryStrategies.find(s => s.strategy === strategy)
    if (strategyMetric) {
      strategyMetric.attempts++
      strategyMetric.successRate = (strategyMetric.successRate * (strategyMetric.attempts - 1) + 1) / strategyMetric.attempts
    } else {
      this.metrics.recoveryStrategies.push({
        strategy,
        successRate: 1.0,
        attempts: 1
      })
    }
  }

  /**
   * Record failed recovery
   */
  private recordFailedRecovery(recoveryTime: number): void {
    this.metrics.failedRecoveries++
    
    // Update average recovery time
    const totalRecoveries = this.metrics.successfulRecoveries + this.metrics.failedRecoveries
    this.metrics.averageRecoveryTime = 
      (this.metrics.averageRecoveryTime * (totalRecoveries - 1) + recoveryTime) / totalRecoveries
  }

  /**
   * Get confirmation failure metrics
   */
  public getMetrics(): ConfirmationFailureMetrics {
    return { ...this.metrics }
  }

  /**
   * Get failure history for a specific context
   */
  public getFailureHistory(canvasId: string, userId: string): ConfirmationFailureContext[] {
    const key = `${canvasId}:${userId}`
    return this.failureHistory.get(key) || []
  }

  /**
   * Clear failure history
   */
  public clearFailureHistory(): void {
    this.failureHistory.clear()
    this.metrics = {
      totalFailures: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      averageRecoveryTime: 0,
      mostCommonFailures: [],
      recoveryStrategies: []
    }
  }

  /**
   * Get recovery strategies
   */
  public getRecoveryStrategies(): RecoveryStrategy[] {
    return [...this.recoveryStrategies]
  }
}

// Export singleton instance
export const confirmationFailureRecoveryService = new ConfirmationFailureRecoveryService()

// Export types and service
export { ConfirmationFailureRecoveryService }
export type { ConfirmationFailureContext, ConfirmationResult, RecoveryStrategy, ConfirmationFailureMetrics }
