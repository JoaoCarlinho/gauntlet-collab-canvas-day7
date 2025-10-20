/**
 * Canvas ID Validation Service with Comprehensive Validation and Recovery
 */

import { errorLogger } from '../utils/errorLogger'
import { canvasAPI } from './api'
import { authService } from './authService'
import { networkTimeoutService } from './networkTimeoutService'

export interface CanvasValidationResult {
  isValid: boolean
  canvasId: string
  error?: string
  validationMethod: 'format' | 'existence' | 'permission' | 'accessibility' | 'failed'
  recoverySuggestion?: string
  timestamp: number
}

export interface CanvasInfo {
  id: string
  name: string
  description?: string
  ownerId: string
  permissions: {
    canEdit: boolean
    canView: boolean
    canDelete: boolean
    canShare: boolean
  }
  isPublic: boolean
  createdAt: string
  updatedAt: string
  objectCount: number
  lastAccessedAt?: string
}

export interface CanvasValidationConfig {
  enableFormatValidation: boolean
  enableExistenceValidation: boolean
  enablePermissionValidation: boolean
  enableAccessibilityValidation: boolean
  cacheValidationResults: boolean
  cacheTimeout: number
  maxRetries: number
  retryDelay: number
}

export interface CanvasValidationMetrics {
  totalValidations: number
  successfulValidations: number
  failedValidations: number
  formatValidationFailures: number
  existenceValidationFailures: number
  permissionValidationFailures: number
  accessibilityValidationFailures: number
  averageValidationTime: number
  cacheHitRate: number
}

class CanvasIdValidationService {
  private validationCache: Map<string, { result: CanvasValidationResult; timestamp: number }> = new Map()
  private canvasInfoCache: Map<string, { info: CanvasInfo; timestamp: number }> = new Map()
  private metrics: CanvasValidationMetrics = {
    totalValidations: 0,
    successfulValidations: 0,
    failedValidations: 0,
    formatValidationFailures: 0,
    existenceValidationFailures: 0,
    permissionValidationFailures: 0,
    accessibilityValidationFailures: 0,
    averageValidationTime: 0,
    cacheHitRate: 0
  }

  private config: CanvasValidationConfig = {
    enableFormatValidation: true,
    enableExistenceValidation: true,
    enablePermissionValidation: true,
    enableAccessibilityValidation: true,
    cacheValidationResults: true,
    cacheTimeout: 300000, // 5 minutes
    maxRetries: 3,
    retryDelay: 1000
  }

  private readonly CANVAS_ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/
  private readonly CANVAS_ID_MIN_LENGTH = 8
  private readonly CANVAS_ID_MAX_LENGTH = 64

  /**
   * Validate canvas ID with comprehensive checks
   */
  public async validateCanvasId(
    canvasId: string,
    options: {
      skipCache?: boolean
      validationLevel?: 'basic' | 'standard' | 'comprehensive'
      userId?: string
    } = {}
  ): Promise<CanvasValidationResult> {
    const startTime = Date.now()
    this.metrics.totalValidations++

    try {
      // Check cache first
      if (this.config.cacheValidationResults && !options.skipCache) {
        const cachedResult = this.getCachedValidation(canvasId)
        if (cachedResult) {
          this.metrics.cacheHitRate = 
            (this.metrics.cacheHitRate * (this.metrics.totalValidations - 1) + 1) / this.metrics.totalValidations
          return cachedResult
        }
      }

      // Format validation
      if (this.config.enableFormatValidation) {
        const formatResult = this.validateCanvasIdFormat(canvasId)
        if (!formatResult.isValid) {
          this.metrics.formatValidationFailures++
          this.metrics.failedValidations++
          this.updateAverageValidationTime(Date.now() - startTime)
          return formatResult
        }
      }

      // Existence validation
      if (this.config.enableExistenceValidation && options.validationLevel !== 'basic') {
        const existenceResult = await this.validateCanvasExistence(canvasId)
        if (!existenceResult.isValid) {
          this.metrics.existenceValidationFailures++
          this.metrics.failedValidations++
          this.updateAverageValidationTime(Date.now() - startTime)
          return existenceResult
        }
      }

      // Permission validation
      if (this.config.enablePermissionValidation && options.validationLevel === 'comprehensive') {
        const permissionResult = await this.validateCanvasPermissions(canvasId, options.userId)
        if (!permissionResult.isValid) {
          this.metrics.permissionValidationFailures++
          this.metrics.failedValidations++
          this.updateAverageValidationTime(Date.now() - startTime)
          return permissionResult
        }
      }

      // Accessibility validation
      if (this.config.enableAccessibilityValidation && options.validationLevel === 'comprehensive') {
        const accessibilityResult = await this.validateCanvasAccessibility(canvasId, options.userId)
        if (!accessibilityResult.isValid) {
          this.metrics.accessibilityValidationFailures++
          this.metrics.failedValidations++
          this.updateAverageValidationTime(Date.now() - startTime)
          return accessibilityResult
        }
      }

      // All validations passed
      const result: CanvasValidationResult = {
        isValid: true,
        canvasId,
        validationMethod: 'existence',
        timestamp: Date.now()
      }

      // Cache the result
      if (this.config.cacheValidationResults) {
        this.cacheValidationResult(canvasId, result)
      }

      this.metrics.successfulValidations++
      this.updateAverageValidationTime(Date.now() - startTime)

      return result

    } catch (error) {
      console.error('Canvas ID validation failed:', error)
      this.metrics.failedValidations++
      this.updateAverageValidationTime(Date.now() - startTime)

      return {
        isValid: false,
        canvasId,
        error: error instanceof Error ? error.message : 'Validation failed',
        validationMethod: 'failed',
        recoverySuggestion: 'Please check the canvas ID and try again',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Validate canvas ID format
   */
  private validateCanvasIdFormat(canvasId: string): CanvasValidationResult {
    if (!canvasId || typeof canvasId !== 'string') {
      return {
        isValid: false,
        canvasId: canvasId || '',
        error: 'Canvas ID is required and must be a string',
        validationMethod: 'format',
        recoverySuggestion: 'Provide a valid canvas ID',
        timestamp: Date.now()
      }
    }

    if (canvasId.length < this.CANVAS_ID_MIN_LENGTH) {
      return {
        isValid: false,
        canvasId,
        error: `Canvas ID must be at least ${this.CANVAS_ID_MIN_LENGTH} characters long`,
        validationMethod: 'format',
        recoverySuggestion: 'Use a longer canvas ID',
        timestamp: Date.now()
      }
    }

    if (canvasId.length > this.CANVAS_ID_MAX_LENGTH) {
      return {
        isValid: false,
        canvasId,
        error: `Canvas ID must be no more than ${this.CANVAS_ID_MAX_LENGTH} characters long`,
        validationMethod: 'format',
        recoverySuggestion: 'Use a shorter canvas ID',
        timestamp: Date.now()
      }
    }

    if (!this.CANVAS_ID_PATTERN.test(canvasId)) {
      return {
        isValid: false,
        canvasId,
        error: 'Canvas ID contains invalid characters. Only letters, numbers, hyphens, and underscores are allowed',
        validationMethod: 'format',
        recoverySuggestion: 'Use only alphanumeric characters, hyphens, and underscores',
        timestamp: Date.now()
      }
    }

    return {
      isValid: true,
      canvasId,
      validationMethod: 'format',
      timestamp: Date.now()
    }
  }

  /**
   * Validate canvas existence
   */
  private async validateCanvasExistence(canvasId: string): Promise<CanvasValidationResult> {
    try {
      const result = await networkTimeoutService.executeWithTimeout(
        async () => {
          const response = await canvasAPI.getCanvas(canvasId)
          return response
        },
        10000,
        `canvas_existence_validation_${canvasId}`
      )

      if (result.success && result.data) {
        return {
          isValid: true,
          canvasId,
          validationMethod: 'existence',
          timestamp: Date.now()
        }
      } else {
        return {
          isValid: false,
          canvasId,
          error: result.error || 'Canvas not found',
          validationMethod: 'existence',
          recoverySuggestion: 'Check if the canvas ID is correct or if the canvas exists',
          timestamp: Date.now()
        }
      }

    } catch (error) {
      return {
        isValid: false,
        canvasId,
        error: error instanceof Error ? error.message : 'Failed to validate canvas existence',
        validationMethod: 'existence',
        recoverySuggestion: 'Check your network connection and try again',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Validate canvas permissions
   */
  private async validateCanvasPermissions(canvasId: string, userId?: string): Promise<CanvasValidationResult> {
    try {
      if (!userId) {
        const currentUserId = await authService.getCurrentUserId()
        if (!currentUserId) {
          return {
            isValid: false,
            canvasId,
            error: 'User ID is required for permission validation',
            validationMethod: 'permission',
            recoverySuggestion: 'Please log in to access this canvas',
            timestamp: Date.now()
          }
        }
        userId = currentUserId
      }

      const canvasInfo = await this.getCanvasInfo(canvasId)
      if (!canvasInfo) {
        return {
          isValid: false,
          canvasId,
          error: 'Canvas information not available',
          validationMethod: 'permission',
          recoverySuggestion: 'Canvas may not exist or be accessible',
          timestamp: Date.now()
        }
      }

      // Check if user has at least view permission
      if (!canvasInfo.permissions.canView) {
        return {
          isValid: false,
          canvasId,
          error: 'You do not have permission to view this canvas',
          validationMethod: 'permission',
          recoverySuggestion: 'Request access from the canvas owner',
          timestamp: Date.now()
        }
      }

      return {
        isValid: true,
        canvasId,
        validationMethod: 'permission',
        timestamp: Date.now()
      }

    } catch (error) {
      return {
        isValid: false,
        canvasId,
        error: error instanceof Error ? error.message : 'Permission validation failed',
        validationMethod: 'permission',
        recoverySuggestion: 'Check your permissions for this canvas',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Validate canvas accessibility
   */
  private async validateCanvasAccessibility(canvasId: string, userId?: string): Promise<CanvasValidationResult> {
    try {
      const canvasInfo = await this.getCanvasInfo(canvasId)
      if (!canvasInfo) {
        return {
          isValid: false,
          canvasId,
          error: 'Canvas information not available',
          validationMethod: 'accessibility',
          recoverySuggestion: 'Canvas may not exist or be accessible',
          timestamp: Date.now()
        }
      }

      // Check if canvas is accessible (not deleted, not archived, etc.)
      if (canvasInfo.isPublic === false && !userId) {
        return {
          isValid: false,
          canvasId,
          error: 'Canvas is private and requires authentication',
          validationMethod: 'accessibility',
          recoverySuggestion: 'Please log in to access this private canvas',
          timestamp: Date.now()
        }
      }

      // Check if canvas has been recently accessed (not stale)
      const lastAccessed = canvasInfo.lastAccessedAt ? new Date(canvasInfo.lastAccessedAt) : null
      const now = new Date()
      const staleThreshold = 30 * 24 * 60 * 60 * 1000 // 30 days

      if (lastAccessed && (now.getTime() - lastAccessed.getTime()) > staleThreshold) {
        return {
          isValid: false,
          canvasId,
          error: 'Canvas appears to be inactive or stale',
          validationMethod: 'accessibility',
          recoverySuggestion: 'Contact the canvas owner to verify it is still active',
          timestamp: Date.now()
        }
      }

      return {
        isValid: true,
        canvasId,
        validationMethod: 'accessibility',
        timestamp: Date.now()
      }

    } catch (error) {
      return {
        isValid: false,
        canvasId,
        error: error instanceof Error ? error.message : 'Accessibility validation failed',
        validationMethod: 'accessibility',
        recoverySuggestion: 'Check if the canvas is accessible',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Get canvas information with caching
   */
  private async getCanvasInfo(canvasId: string): Promise<CanvasInfo | null> {
    try {
      // Check cache first
      const cached = this.canvasInfoCache.get(canvasId)
      if (cached && (Date.now() - cached.timestamp) < this.config.cacheTimeout) {
        return cached.info
      }

      // Fetch from API
      const result = await networkTimeoutService.executeWithTimeout(
        async () => {
          const response = await canvasAPI.getCanvas(canvasId)
          return response
        },
        10000,
        `canvas_info_fetch_${canvasId}`
      )

      if (result.success && result.data) {
        const canvasInfo: CanvasInfo = {
          id: result.data.id,
          name: result.data.name,
          description: result.data.description,
          ownerId: result.data.owner_id,
          permissions: {
            canEdit: result.data.permissions?.can_edit || false,
            canView: result.data.permissions?.can_view || false,
            canDelete: result.data.permissions?.can_delete || false,
            canShare: result.data.permissions?.can_share || false
          },
          isPublic: result.data.is_public || false,
          createdAt: result.data.created_at,
          updatedAt: result.data.updated_at,
          objectCount: result.data.object_count || 0,
          lastAccessedAt: result.data.last_accessed_at
        }

        // Cache the result
        this.canvasInfoCache.set(canvasId, {
          info: canvasInfo,
          timestamp: Date.now()
        })

        return canvasInfo
      }

      return null

    } catch (error) {
      console.error('Failed to get canvas info:', error)
      return null
    }
  }

  /**
   * Get cached validation result
   */
  private getCachedValidation(canvasId: string): CanvasValidationResult | null {
    const cached = this.validationCache.get(canvasId)
    if (cached && (Date.now() - cached.timestamp) < this.config.cacheTimeout) {
      return cached.result
    }
    return null
  }

  /**
   * Cache validation result
   */
  private cacheValidationResult(canvasId: string, result: CanvasValidationResult): void {
    this.validationCache.set(canvasId, {
      result,
      timestamp: Date.now()
    })
  }

  /**
   * Update average validation time
   */
  private updateAverageValidationTime(validationTime: number): void {
    const alpha = 0.1 // Smoothing factor
    this.metrics.averageValidationTime = 
      (alpha * validationTime) + ((1 - alpha) * this.metrics.averageValidationTime)
  }

  /**
   * Validate multiple canvas IDs
   */
  public async validateMultipleCanvasIds(
    canvasIds: string[],
    options: {
      validationLevel?: 'basic' | 'standard' | 'comprehensive'
      userId?: string
      parallel?: boolean
    } = {}
  ): Promise<CanvasValidationResult[]> {
    if (options.parallel) {
      // Validate in parallel
      const validationPromises = canvasIds.map(canvasId =>
        this.validateCanvasId(canvasId, options)
      )
      return Promise.all(validationPromises)
    } else {
      // Validate sequentially
      const results: CanvasValidationResult[] = []
      for (const canvasId of canvasIds) {
        const result = await this.validateCanvasId(canvasId, options)
        results.push(result)
      }
      return results
    }
  }

  /**
   * Get canvas validation metrics
   */
  public getMetrics(): CanvasValidationMetrics {
    return { ...this.metrics }
  }

  /**
   * Get cached canvas info
   */
  public getCachedCanvasInfo(canvasId: string): CanvasInfo | null {
    const cached = this.canvasInfoCache.get(canvasId)
    if (cached && (Date.now() - cached.timestamp) < this.config.cacheTimeout) {
      return cached.info
    }
    return null
  }

  /**
   * Clear validation cache
   */
  public clearCache(): void {
    this.validationCache.clear()
    this.canvasInfoCache.clear()
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<CanvasValidationConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Get current configuration
   */
  public getConfig(): CanvasValidationConfig {
    return { ...this.config }
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      formatValidationFailures: 0,
      existenceValidationFailures: 0,
      permissionValidationFailures: 0,
      accessibilityValidationFailures: 0,
      averageValidationTime: 0,
      cacheHitRate: 0
    }
  }
}

// Export singleton instance
export const canvasIdValidationService = new CanvasIdValidationService()

// Export types and service
export { CanvasIdValidationService }
export type { CanvasValidationResult, CanvasInfo, CanvasValidationConfig, CanvasValidationMetrics }
