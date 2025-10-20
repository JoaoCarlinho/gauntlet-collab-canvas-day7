/**
 * Enhanced REST API Fallback Service with Advanced Error Handling and Recovery
 */

import { objectsAPI } from './api'
import { authService } from './authService'
import { errorLogger } from '../utils/errorLogger'
import { retryWithBackoff, RETRY_PRESETS } from '../utils/retryLogic'
import { CanvasObject } from '../types'

export interface RestApiFallbackResult {
  success: boolean
  method: 'rest' | 'failed'
  error?: string
  object?: CanvasObject
  attempts: number
  totalTime: number
  fallbackReason?: string
  recoveryStrategy?: string
}

export interface RestApiFallbackOptions {
  retryOptions?: any
  onProgress?: (attempt: number, method: string) => void
  enableTokenRefresh?: boolean
  enableCircuitBreaker?: boolean
  timeout?: number
  validateResponse?: boolean
}

export interface CircuitBreakerState {
  isOpen: boolean
  failureCount: number
  lastFailureTime: number
  nextAttemptTime: number
}

class EnhancedRestApiFallbackService {
  private circuitBreaker: CircuitBreakerState = {
    isOpen: false,
    failureCount: 0,
    lastFailureTime: 0,
    nextAttemptTime: 0
  }
  
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5
  private readonly CIRCUIT_BREAKER_TIMEOUT = 30000 // 30 seconds
  private readonly DEFAULT_TIMEOUT = 15000 // 15 seconds
  private readonly MAX_RETRY_ATTEMPTS = 3

  /**
   * Enhanced REST API object creation with advanced fallback strategies
   */
  public async createObject(
    canvasId: string,
    object: { type: string; properties: Record<string, any> },
    options: RestApiFallbackOptions = {}
  ): Promise<RestApiFallbackResult> {
    const startTime = Date.now()
    
    try {
      // Check circuit breaker
      if (this.isCircuitBreakerOpen()) {
        return {
          success: false,
          method: 'failed',
          error: 'Circuit breaker is open - too many recent failures',
          attempts: 0,
          totalTime: Date.now() - startTime,
          fallbackReason: 'circuit_breaker_open'
        }
      }

      // Validate inputs
      const validationResult = this.validateInputs(canvasId, object)
      if (!validationResult.isValid) {
        return {
          success: false,
          method: 'failed',
          error: validationResult.error,
          attempts: 0,
          totalTime: Date.now() - startTime,
          fallbackReason: 'validation_failed'
        }
      }

      // Get valid token
      const tokenResult = await this.getValidToken(options.enableTokenRefresh)
      if (!tokenResult.success) {
        return {
          success: false,
          method: 'failed',
          error: tokenResult.error,
          attempts: 0,
          totalTime: Date.now() - startTime,
          fallbackReason: 'token_validation_failed'
        }
      }

      // Perform creation with retry logic
      const retryOptions = options.retryOptions || {
        ...RETRY_PRESETS.STANDARD,
        maxAttempts: this.MAX_RETRY_ATTEMPTS
      }

      const result = await retryWithBackoff(async () => {
        options.onProgress?.(1, 'rest')
        
        const response = await this.performRestApiCall(
          canvasId,
          object,
          tokenResult.token!,
          options.timeout || this.DEFAULT_TIMEOUT
        )

        return response
      }, retryOptions)

      // Success - reset circuit breaker
      this.resetCircuitBreaker()

      return {
        success: true,
        method: 'rest',
        object: result.data,
        attempts: result.attempts,
        totalTime: Date.now() - startTime
      }

    } catch (error) {
      console.error('REST API fallback failed:', error)
      
      // Record failure in circuit breaker
      this.recordFailure()

      // Log error with context
      errorLogger.logError('REST API fallback failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        canvasId,
        objectType: object.type,
        timestamp: new Date().toISOString(),
        circuitBreakerState: this.circuitBreaker
      })

      return {
        success: false,
        method: 'failed',
        error: error instanceof Error ? error.message : 'REST API fallback failed',
        attempts: 1,
        totalTime: Date.now() - startTime,
        fallbackReason: 'rest_api_failed',
        recoveryStrategy: this.getRecoveryStrategy(error)
      }
    }
  }

  /**
   * Enhanced REST API object update with fallback strategies
   */
  public async updateObject(
    canvasId: string,
    objectId: string,
    properties: Record<string, any>,
    options: RestApiFallbackOptions = {}
  ): Promise<RestApiFallbackResult> {
    const startTime = Date.now()
    
    try {
      // Check circuit breaker
      if (this.isCircuitBreakerOpen()) {
        return {
          success: false,
          method: 'failed',
          error: 'Circuit breaker is open - too many recent failures',
          attempts: 0,
          totalTime: Date.now() - startTime,
          fallbackReason: 'circuit_breaker_open'
        }
      }

      // Get valid token
      const tokenResult = await this.getValidToken(options.enableTokenRefresh)
      if (!tokenResult.success) {
        return {
          success: false,
          method: 'failed',
          error: tokenResult.error,
          attempts: 0,
          totalTime: Date.now() - startTime,
          fallbackReason: 'token_validation_failed'
        }
      }

      // Perform update with retry logic
      const retryOptions = options.retryOptions || {
        ...RETRY_PRESETS.STANDARD,
        maxAttempts: this.MAX_RETRY_ATTEMPTS
      }

      const result = await retryWithBackoff(async () => {
        options.onProgress?.(1, 'rest')
        
        const response = await objectsAPI.updateObject(objectId, {
          canvas_id: canvasId,
          properties
        })

        return response
      }, retryOptions)

      // Success - reset circuit breaker
      this.resetCircuitBreaker()

      return {
        success: true,
        method: 'rest',
        object: result.data,
        attempts: result.attempts,
        totalTime: Date.now() - startTime
      }

    } catch (error) {
      console.error('REST API update failed:', error)
      
      // Record failure in circuit breaker
      this.recordFailure()

      return {
        success: false,
        method: 'failed',
        error: error instanceof Error ? error.message : 'REST API update failed',
        attempts: 1,
        totalTime: Date.now() - startTime,
        fallbackReason: 'rest_api_failed',
        recoveryStrategy: this.getRecoveryStrategy(error)
      }
    }
  }

  /**
   * Enhanced REST API object deletion with fallback strategies
   */
  public async deleteObject(
    canvasId: string,
    objectId: string,
    options: RestApiFallbackOptions = {}
  ): Promise<RestApiFallbackResult> {
    const startTime = Date.now()
    
    try {
      // Check circuit breaker
      if (this.isCircuitBreakerOpen()) {
        return {
          success: false,
          method: 'failed',
          error: 'Circuit breaker is open - too many recent failures',
          attempts: 0,
          totalTime: Date.now() - startTime,
          fallbackReason: 'circuit_breaker_open'
        }
      }

      // Get valid token
      const tokenResult = await this.getValidToken(options.enableTokenRefresh)
      if (!tokenResult.success) {
        return {
          success: false,
          method: 'failed',
          error: tokenResult.error,
          attempts: 0,
          totalTime: Date.now() - startTime,
          fallbackReason: 'token_validation_failed'
        }
      }

      // Perform deletion with retry logic
      const retryOptions = options.retryOptions || {
        ...RETRY_PRESETS.STANDARD,
        maxAttempts: this.MAX_RETRY_ATTEMPTS
      }

      const result = await retryWithBackoff(async () => {
        options.onProgress?.(1, 'rest')
        
        await objectsAPI.deleteObject(objectId)

        return { success: true }
      }, retryOptions)

      // Success - reset circuit breaker
      this.resetCircuitBreaker()

      return {
        success: true,
        method: 'rest',
        attempts: result.attempts,
        totalTime: Date.now() - startTime
      }

    } catch (error) {
      console.error('REST API deletion failed:', error)
      
      // Record failure in circuit breaker
      this.recordFailure()

      return {
        success: false,
        method: 'failed',
        error: error instanceof Error ? error.message : 'REST API deletion failed',
        attempts: 1,
        totalTime: Date.now() - startTime,
        fallbackReason: 'rest_api_failed',
        recoveryStrategy: this.getRecoveryStrategy(error)
      }
    }
  }

  /**
   * Validate input parameters
   */
  private validateInputs(
    canvasId: string,
    object: { type: string; properties: Record<string, any> }
  ): { isValid: boolean; error?: string } {
    if (!canvasId || canvasId.trim() === '') {
      return { isValid: false, error: 'Canvas ID is required' }
    }

    if (!object) {
      return { isValid: false, error: 'Object data is required' }
    }

    const objectType = object.type || (object as any).object_type
    if (!objectType) {
      return { isValid: false, error: 'Object type is required' }
    }

    const validTypes = ['rectangle', 'circle', 'text', 'heart', 'star', 'diamond', 'line', 'arrow']
    if (!validTypes.includes(objectType)) {
      return { isValid: false, error: `Invalid object type: ${objectType}` }
    }

    const objectProperties = object.properties || object
    if (!objectProperties || typeof objectProperties !== 'object') {
      return { isValid: false, error: 'Object properties must be a valid object' }
    }

    return { isValid: true }
  }

  /**
   * Get valid authentication token
   */
  private async getValidToken(enableRefresh: boolean = true): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
      if (enableRefresh) {
        const validation = await authService.validateAndRefreshToken()
        if (validation.isValid && validation.token) {
          return { success: true, token: validation.token }
        } else {
          return { success: false, error: validation.error || 'Token validation failed' }
        }
      } else {
        const token = localStorage.getItem('idToken')
        if (token) {
          return { success: true, token }
        } else {
          return { success: false, error: 'No token found' }
        }
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Token retrieval failed' 
      }
    }
  }

  /**
   * Perform REST API call with timeout
   */
  private async performRestApiCall(
    canvasId: string,
    object: { type: string; properties: Record<string, any> },
    token: string,
    timeout: number
  ): Promise<any> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await objectsAPI.createObject({
        canvas_id: canvasId,
        object_type: object.type,
        properties: object.properties
      }, {
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitBreakerOpen(): boolean {
    if (!this.circuitBreaker.isOpen) {
      return false
    }

    // Check if we should attempt to close the circuit breaker
    if (Date.now() >= this.circuitBreaker.nextAttemptTime) {
      this.circuitBreaker.isOpen = false
      this.circuitBreaker.failureCount = 0
      return false
    }

    return true
  }

  /**
   * Record a failure in the circuit breaker
   */
  private recordFailure(): void {
    this.circuitBreaker.failureCount++
    this.circuitBreaker.lastFailureTime = Date.now()

    if (this.circuitBreaker.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreaker.isOpen = true
      this.circuitBreaker.nextAttemptTime = Date.now() + this.CIRCUIT_BREAKER_TIMEOUT
      console.warn('Circuit breaker opened due to repeated failures')
    }
  }

  /**
   * Reset circuit breaker
   */
  private resetCircuitBreaker(): void {
    this.circuitBreaker.isOpen = false
    this.circuitBreaker.failureCount = 0
    this.circuitBreaker.lastFailureTime = 0
    this.circuitBreaker.nextAttemptTime = 0
  }

  /**
   * Get recovery strategy based on error type
   */
  private getRecoveryStrategy(error: any): string {
    if (error.name === 'AbortError') {
      return 'timeout_retry'
    } else if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      return 'token_refresh'
    } else if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
      return 'permission_check'
    } else if (error.message?.includes('500') || error.message?.includes('Internal Server Error')) {
      return 'server_retry'
    } else if (error.message?.includes('Network') || error.message?.includes('fetch')) {
      return 'network_retry'
    } else {
      return 'generic_retry'
    }
  }

  /**
   * Get circuit breaker status
   */
  public getCircuitBreakerStatus(): CircuitBreakerState {
    return { ...this.circuitBreaker }
  }

  /**
   * Force reset circuit breaker
   */
  public forceResetCircuitBreaker(): void {
    this.resetCircuitBreaker()
  }
}

// Export singleton instance
export const enhancedRestApiFallbackService = new EnhancedRestApiFallbackService()

// Export types and service
export { EnhancedRestApiFallbackService }
export type { RestApiFallbackResult, RestApiFallbackOptions, CircuitBreakerState }
