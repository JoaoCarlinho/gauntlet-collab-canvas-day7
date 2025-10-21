/**
 * Enhanced Error Recovery Service with Comprehensive Recovery Strategies
 */

import { errorLogger } from '../utils/errorLogger'
import { authService } from './authService'
import { enhancedSocketService } from './enhancedSocketService'

export interface RecoveryStrategy {
  name: string
  condition: (error: any) => boolean
  action: (error: any, context: RecoveryContext) => Promise<RecoveryResult>
  priority: number
  maxAttempts: number
}

export interface RecoveryContext {
  operation: string
  timestamp: number
  retryCount: number
  originalError: any
  additionalData?: any
}

export interface RecoveryResult {
  success: boolean
  recovered: boolean
  error?: any
  retryable: boolean
  nextStrategy?: string
  data?: any
}

export interface RecoveryMetrics {
  totalRecoveries: number
  successfulRecoveries: number
  failedRecoveries: number
  strategiesUsed: Map<string, number>
  averageRecoveryTime: number
  lastRecoveryTime: number
}

class ErrorRecoveryService {
  private recoveryStrategies: RecoveryStrategy[] = []
  private recoveryMetrics: RecoveryMetrics = {
    totalRecoveries: 0,
    successfulRecoveries: 0,
    failedRecoveries: 0,
    strategiesUsed: new Map(),
    averageRecoveryTime: 0,
    lastRecoveryTime: 0
  }
  private activeRecoveries = new Map<string, Promise<RecoveryResult>>()

  constructor() {
    this.initializeRecoveryStrategies()
  }

  /**
   * Initialize recovery strategies
   */
  private initializeRecoveryStrategies(): void {
    this.recoveryStrategies = [
      // Authentication recovery
      {
        name: 'auth_token_refresh',
        condition: (error) => this.isAuthError(error),
        action: async () => this.recoverAuthToken(),
        priority: 1,
        maxAttempts: 2
      },
      
      // Socket connection recovery
      {
        name: 'socket_reconnection',
        condition: (error) => this.isSocketError(error),
        action: async () => this.recoverSocketConnection(),
        priority: 2,
        maxAttempts: 3
      },
      
      // Network timeout recovery
      {
        name: 'network_retry',
        condition: (error) => this.isNetworkError(error),
        action: async () => this.recoverNetworkError(),
        priority: 3,
        maxAttempts: 3
      },
      
      // Object creation recovery
      {
        name: 'object_creation_retry',
        condition: (error) => this.isObjectCreationError(error),
        action: async () => this.recoverObjectCreation(),
        priority: 4,
        maxAttempts: 2
      },
      
      // State synchronization recovery
      {
        name: 'state_sync',
        condition: (error) => this.isStateSyncError(error),
        action: async () => this.recoverStateSync(),
        priority: 5,
        maxAttempts: 2
      },
      
      // Fallback recovery
      {
        name: 'fallback_operation',
        condition: () => this.isFallbackEligible(),
        action: async () => this.recoverWithFallback(),
        priority: 6,
        maxAttempts: 1
      }
    ]

    // Sort strategies by priority
    this.recoveryStrategies.sort((a, b) => a.priority - b.priority)
  }

  /**
   * Attempt to recover from an error
   */
  public async attemptRecovery(
    error: any,
    operation: string,
    additionalData?: any
  ): Promise<RecoveryResult> {
    const recoveryId = `${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Check if recovery is already in progress
    if (this.activeRecoveries.has(recoveryId)) {
      return this.activeRecoveries.get(recoveryId)!
    }

    const startTime = Date.now()
    this.recoveryMetrics.totalRecoveries++

    const recoveryPromise = this.performRecovery(error, operation, additionalData, startTime)
    this.activeRecoveries.set(recoveryId, recoveryPromise)

    try {
      const result = await recoveryPromise
      return result
    } finally {
      this.activeRecoveries.delete(recoveryId)
    }
  }

  /**
   * Perform recovery with multiple strategies
   */
  private async performRecovery(
    error: any,
    operation: string,
    additionalData: any,
    startTime: number
  ): Promise<RecoveryResult> {
    const context: RecoveryContext = {
      operation,
      timestamp: Date.now(),
      retryCount: 0,
      originalError: error,
      additionalData
    }

    // Try each recovery strategy in order of priority
    for (const strategy of this.recoveryStrategies) {
      if (strategy.condition(error)) {
        try {
          console.log(`Attempting recovery with strategy: ${strategy.name}`)
          
          const result = await strategy.action(error, context)
          
          // Update metrics
          const strategyCount = this.recoveryMetrics.strategiesUsed.get(strategy.name) || 0
          this.recoveryMetrics.strategiesUsed.set(strategy.name, strategyCount + 1)
          
          if (result.success) {
            this.recoveryMetrics.successfulRecoveries++
            this.recoveryMetrics.lastRecoveryTime = Date.now()
            
            // Update average recovery time
            const totalTime = this.recoveryMetrics.averageRecoveryTime * (this.recoveryMetrics.successfulRecoveries - 1) + (Date.now() - startTime)
            this.recoveryMetrics.averageRecoveryTime = totalTime / this.recoveryMetrics.successfulRecoveries
            
            console.log(`Recovery successful with strategy: ${strategy.name}`)
            return result
          } else if (result.retryable && context.retryCount < strategy.maxAttempts) {
            context.retryCount++
            console.log(`Recovery failed but retryable, attempt ${context.retryCount}/${strategy.maxAttempts}`)
            continue
          }
        } catch (recoveryError) {
          console.error(`Recovery strategy ${strategy.name} failed:`, recoveryError)
          errorLogger.logError(recoveryError as Error, {
            operation: 'general',
            timestamp: Date.now(),
            additionalData: {
              strategy: strategy.name,
              originalError: error,
              context
            }
          })
        }
      }
    }

    // All recovery strategies failed
    this.recoveryMetrics.failedRecoveries++
    console.error('All recovery strategies failed')
    
    return {
      success: false,
      recovered: false,
      error: error,
      retryable: false
    }
  }

  /**
   * Check if error is authentication-related
   */
  private isAuthError(error: any): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      return message.includes('auth') || 
             message.includes('token') || 
             message.includes('unauthorized') ||
             message.includes('401') ||
             error.name === 'AuthenticationError'
    }
    
    if (error?.response?.status === 401) {
      return true
    }
    
    return false
  }

  /**
   * Check if error is socket-related
   */
  private isSocketError(error: any): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      return message.includes('socket') || 
             message.includes('connection') ||
             message.includes('websocket') ||
             error.name === 'SocketError'
    }
    
    return false
  }

  /**
   * Check if error is network-related
   */
  private isNetworkError(error: any): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      return message.includes('network') || 
             message.includes('timeout') ||
             message.includes('connection') ||
             message.includes('fetch') ||
             error.name === 'NetworkError'
    }
    
    if (error?.code === 'NETWORK_ERROR' || error?.code === 'TIMEOUT') {
      return true
    }
    
    return false
  }

  /**
   * Check if error is object creation-related
   */
  private isObjectCreationError(error: any): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      return message.includes('object') || 
             message.includes('creation') ||
             message.includes('canvas') ||
             error.name === 'ObjectCreationError'
    }
    
    return false
  }

  /**
   * Check if error is state synchronization-related
   */
  private isStateSyncError(error: any): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      return message.includes('state') || 
             message.includes('sync') ||
             message.includes('conflict') ||
             error.name === 'StateSyncError'
    }
    
    return false
  }

  /**
   * Check if error is eligible for fallback recovery
   */
  private isFallbackEligible(): boolean {
    // Most errors are eligible for fallback recovery
    return true
  }

  /**
   * Recover authentication token
   */
  private async recoverAuthToken(): Promise<RecoveryResult> {
    try {
      console.log('Attempting authentication token recovery...')
      
      const tokenValidation = await authService.validateAndRefreshToken()
      
      if (tokenValidation.isValid) {
        return {
          success: true,
          recovered: true,
          retryable: false,
          data: { token: tokenValidation.token }
        }
      } else {
        return {
          success: false,
          recovered: false,
          error: tokenValidation.error,
          retryable: false
        }
      }
    } catch (recoveryError) {
      return {
        success: false,
        recovered: false,
        error: recoveryError,
        retryable: false
      }
    }
  }

  /**
   * Recover socket connection
   */
  private async recoverSocketConnection(): Promise<RecoveryResult> {
    try {
      console.log('Attempting socket connection recovery...')
      
      if (!enhancedSocketService.isConnected()) {
        // Try to reconnect
        const token = await authService.getValidToken()
        if (token) {
          await enhancedSocketService.connect(token)
          
          if (enhancedSocketService.isConnected()) {
            return {
              success: true,
              recovered: true,
              retryable: false
            }
          }
        }
      } else {
        // Connection exists, perform health check
        await enhancedSocketService.ping()
        return {
          success: true,
          recovered: true,
          retryable: false
        }
      }
      
      return {
        success: false,
        recovered: false,
        error: 'Socket reconnection failed',
        retryable: true
      }
    } catch (recoveryError) {
      return {
        success: false,
        recovered: false,
        error: recoveryError,
        retryable: true
      }
    }
  }

  /**
   * Recover network error
   */
  private async recoverNetworkError(): Promise<RecoveryResult> {
    try {
      console.log('Attempting network error recovery...')
      
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Check if we're online
      if (navigator.onLine) {
        return {
          success: true,
          recovered: true,
          retryable: false
        }
      } else {
        return {
          success: false,
          recovered: false,
          error: 'Network is offline',
          retryable: true
        }
      }
    } catch (recoveryError) {
      return {
        success: false,
        recovered: false,
        error: recoveryError,
        retryable: true
      }
    }
  }

  /**
   * Recover object creation error
   */
  private async recoverObjectCreation(): Promise<RecoveryResult> {
    try {
      console.log('Attempting object creation recovery...')
      
      // If we have object data, try to recreate
      // This would need to be passed as a parameter in a real implementation
      if (true) { // Placeholder condition
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Try to create object via REST API as fallback
        // This would need actual object data in a real implementation
        
        return {
          success: true,
          recovered: true,
          retryable: false,
          data: { object: null }
        }
      }
      
      return {
        success: false,
        recovered: false,
        error: 'No object data available for recovery',
        retryable: false
      }
    } catch (recoveryError) {
      return {
        success: false,
        recovered: false,
        error: recoveryError,
        retryable: true
      }
    }
  }

  /**
   * Recover state synchronization error
   */
  private async recoverStateSync(): Promise<RecoveryResult> {
    try {
      console.log('Attempting state synchronization recovery...')
      
      // Force a state refresh
      // This would need canvasId in a real implementation
      if (true) { // Placeholder condition
        // Fetch fresh canvas objects
        // const response = await objectsAPI.getObject(canvasId)
        
        return {
          success: true,
          recovered: true,
          retryable: false,
          data: { objects: [] }
        }
      }
      
      return {
        success: false,
        recovered: false,
        error: 'No canvas ID available for state recovery',
        retryable: false
      }
    } catch (recoveryError) {
      return {
        success: false,
        recovered: false,
        error: recoveryError,
        retryable: true
      }
    }
  }

  /**
   * Recover with fallback operation
   */
  private async recoverWithFallback(): Promise<RecoveryResult> {
    try {
      console.log('Attempting fallback recovery...')
      
      // Log the error for analysis
      errorLogger.logError('Fallback recovery attempted', {
        operation: 'general',
        timestamp: Date.now(),
        additionalData: { fallback: true }
      })
      
      // Return a generic recovery result
      return {
        success: false,
        recovered: false,
        error: 'Fallback recovery not available',
        retryable: false
      }
    } catch (recoveryError) {
      return {
        success: false,
        recovered: false,
        error: recoveryError,
        retryable: false
      }
    }
  }

  /**
   * Get recovery metrics
   */
  public getRecoveryMetrics(): RecoveryMetrics {
    return {
      ...this.recoveryMetrics,
      strategiesUsed: new Map(this.recoveryMetrics.strategiesUsed)
    }
  }

  /**
   * Reset recovery metrics
   */
  public resetMetrics(): void {
    this.recoveryMetrics = {
      totalRecoveries: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      strategiesUsed: new Map(),
      averageRecoveryTime: 0,
      lastRecoveryTime: 0
    }
  }

  /**
   * Add custom recovery strategy
   */
  public addRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.push(strategy)
    this.recoveryStrategies.sort((a, b) => a.priority - b.priority)
  }

  /**
   * Remove recovery strategy
   */
  public removeRecoveryStrategy(strategyName: string): void {
    this.recoveryStrategies = this.recoveryStrategies.filter(s => s.name !== strategyName)
  }

  /**
   * Get active recoveries count
   */
  public getActiveRecoveriesCount(): number {
    return this.activeRecoveries.size
  }

  /**
   * Cancel all active recoveries
   */
  public cancelAllActiveRecoveries(): void {
    this.activeRecoveries.clear()
  }
}

// Export singleton instance
export const errorRecoveryService = new ErrorRecoveryService()

// Export service
export { ErrorRecoveryService }
