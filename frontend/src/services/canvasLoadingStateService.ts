/**
 * Canvas Loading State Management Service with Progress Tracking and Error Handling
 */

import { errorLogger } from '../utils/errorLogger'
import { networkTimeoutService } from './networkTimeoutService'
import { canvasIdValidationService } from './canvasIdValidationService'

export interface LoadingState {
  isLoading: boolean
  progress: number
  stage: LoadingStage
  error?: string
  startTime: number
  estimatedTimeRemaining?: number
  metadata?: Record<string, any>
}

export interface LoadingStage {
  name: string
  description: string
  progress: number
  isCompleted: boolean
  isFailed: boolean
  error?: string
  startTime: number
  endTime?: number
  duration?: number
}

export interface LoadingConfig {
  enableProgressTracking: boolean
  enableTimeEstimation: boolean
  enableErrorRecovery: boolean
  maxLoadingTime: number
  progressUpdateInterval: number
  retryAttempts: number
  retryDelay: number
}

export interface LoadingMetrics {
  totalLoads: number
  successfulLoads: number
  failedLoads: number
  averageLoadingTime: number
  averageProgressAccuracy: number
  mostCommonErrors: Array<{ error: string; count: number }>
  stagePerformance: Array<{ stage: string; averageTime: number; successRate: number }>
}

export interface LoadingResult {
  success: boolean
  canvasId: string
  loadingTime: number
  error?: string
  stages: LoadingStage[]
  metadata?: Record<string, any>
}

class CanvasLoadingStateService {
  private loadingStates: Map<string, LoadingState> = new Map()
  private loadingStages: Map<string, LoadingStage[]> = new Map()
  private progressIntervals: Map<string, NodeJS.Timeout> = new Map()
  private metrics: LoadingMetrics = {
    totalLoads: 0,
    successfulLoads: 0,
    failedLoads: 0,
    averageLoadingTime: 0,
    averageProgressAccuracy: 0,
    mostCommonErrors: [],
    stagePerformance: []
  }

  private config: LoadingConfig = {
    enableProgressTracking: true,
    enableTimeEstimation: true,
    enableErrorRecovery: true,
    maxLoadingTime: 60000, // 1 minute
    progressUpdateInterval: 100, // 100ms
    retryAttempts: 3,
    retryDelay: 1000
  }

  private readonly DEFAULT_STAGES: LoadingStage[] = [
    {
      name: 'validation',
      description: 'Validating canvas ID and permissions',
      progress: 0,
      isCompleted: false,
      isFailed: false,
      startTime: 0
    },
    {
      name: 'authentication',
      description: 'Authenticating user and verifying access',
      progress: 0,
      isCompleted: false,
      isFailed: false,
      startTime: 0
    },
    {
      name: 'data_fetch',
      description: 'Fetching canvas data and objects',
      progress: 0,
      isCompleted: false,
      isFailed: false,
      startTime: 0
    },
    {
      name: 'initialization',
      description: 'Initializing canvas components and state',
      progress: 0,
      isCompleted: false,
      isFailed: false,
      startTime: 0
    },
    {
      name: 'rendering',
      description: 'Rendering canvas and objects',
      progress: 0,
      isCompleted: false,
      isFailed: false,
      startTime: 0
    }
  ]

  /**
   * Start canvas loading process
   */
  public async startLoading(
    canvasId: string,
    options: {
      stages?: string[]
      metadata?: Record<string, any>
      onProgress?: (progress: number, stage: string) => void
      onStageComplete?: (stage: string) => void
      onError?: (error: string, stage: string) => void
    } = {}
  ): Promise<LoadingResult> {
    const startTime = Date.now()
    this.metrics.totalLoads++

    try {
      // Initialize loading state
      const loadingState: LoadingState = {
        isLoading: true,
        progress: 0,
        stage: this.DEFAULT_STAGES[0],
        startTime,
        metadata: options.metadata
      }

      this.loadingStates.set(canvasId, loadingState)

      // Initialize stages
      const stages = this.initializeStages(options.stages)
      this.loadingStages.set(canvasId, stages)

      // Start progress tracking
      if (this.config.enableProgressTracking) {
        this.startProgressTracking(canvasId, options.onProgress)
      }

      // Execute loading stages
      const result = await this.executeLoadingStages(canvasId, stages, {
        onStageComplete: options.onStageComplete,
        onError: options.onError
      })

      // Complete loading
      this.completeLoading(canvasId, result.success, result.error)

      return {
        success: result.success,
        canvasId,
        loadingTime: Date.now() - startTime,
        error: result.error,
        stages: this.loadingStages.get(canvasId) || [],
        metadata: options.metadata
      }

    } catch (error) {
      console.error('Canvas loading failed:', error)
      
      this.completeLoading(canvasId, false, error instanceof Error ? error.message : 'Loading failed')
      
      return {
        success: false,
        canvasId,
        loadingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Loading failed',
        stages: this.loadingStages.get(canvasId) || [],
        metadata: options.metadata
      }
    }
  }

  /**
   * Initialize loading stages
   */
  private initializeStages(requestedStages?: string[]): LoadingStage[] {
    if (requestedStages) {
      return requestedStages.map(stageName => {
        const defaultStage = this.DEFAULT_STAGES.find(s => s.name === stageName)
        return defaultStage || {
          name: stageName,
          description: `Loading ${stageName}`,
          progress: 0,
          isCompleted: false,
          isFailed: false,
          startTime: 0
        }
      })
    }
    return this.DEFAULT_STAGES.map(stage => ({ ...stage }))
  }

  /**
   * Execute loading stages
   */
  private async executeLoadingStages(
    canvasId: string,
    stages: LoadingStage[],
    callbacks: {
      onStageComplete?: (stage: string) => void
      onError?: (error: string, stage: string) => void
    }
  ): Promise<{ success: boolean; error?: string }> {
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i]
      stage.startTime = Date.now()

      try {
        // Update current stage
        this.updateCurrentStage(canvasId, stage)

        // Execute stage
        const stageResult = await this.executeStage(canvasId, stage)
        
        if (stageResult.success) {
          stage.isCompleted = true
          stage.endTime = Date.now()
          stage.duration = stage.endTime - stage.startTime
          stage.progress = 100

          callbacks.onStageComplete?.(stage.name)
        } else {
          stage.isFailed = true
          stage.error = stageResult.error
          stage.endTime = Date.now()
          stage.duration = stage.endTime - stage.startTime

          callbacks.onError?.(stageResult.error || 'Stage failed', stage.name)

          // Handle stage failure
          if (this.config.enableErrorRecovery) {
            const recoveryResult = await this.attemptStageRecovery(canvasId, stage)
            if (!recoveryResult.success) {
              return { success: false, error: stageResult.error }
            }
          } else {
            return { success: false, error: stageResult.error }
          }
        }

        // Update progress
        this.updateProgress(canvasId, ((i + 1) / stages.length) * 100)

      } catch (error) {
        stage.isFailed = true
        stage.error = error instanceof Error ? error.message : 'Stage execution failed'
        stage.endTime = Date.now()
        stage.duration = stage.endTime - stage.startTime

        callbacks.onError?.(stage.error, stage.name)

        return { success: false, error: stage.error }
      }
    }

    return { success: true }
  }

  /**
   * Execute individual stage
   */
  private async executeStage(canvasId: string, stage: LoadingStage): Promise<{ success: boolean; error?: string }> {
    try {
      switch (stage.name) {
        case 'validation':
          return await this.executeValidationStage(canvasId)
        
        case 'authentication':
          return await this.executeAuthenticationStage(canvasId)
        
        case 'data_fetch':
          return await this.executeDataFetchStage(canvasId)
        
        case 'initialization':
          return await this.executeInitializationStage(canvasId)
        
        case 'rendering':
          return await this.executeRenderingStage(canvasId)
        
        default:
          return { success: true } // Unknown stages are considered successful
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Stage execution failed'
      }
    }
  }

  /**
   * Execute validation stage
   */
  private async executeValidationStage(canvasId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const validationResult = await canvasIdValidationService.validateCanvasId(canvasId, {
        validationLevel: 'comprehensive'
      })

      if (!validationResult.isValid) {
        return { success: false, error: validationResult.error }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Validation failed'
      }
    }
  }

  /**
   * Execute authentication stage
   */
  private async executeAuthenticationStage(canvasId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // This would integrate with authentication service
      // For now, we'll simulate the authentication check
      
      const result = await networkTimeoutService.executeWithTimeout(
        async () => {
          // Simulate authentication check
          await new Promise(resolve => setTimeout(resolve, 500))
          return { success: true }
        },
        5000,
        `auth_stage_${canvasId}`
      )

      return result.success ? { success: true } : { success: false, error: result.error }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      }
    }
  }

  /**
   * Execute data fetch stage
   */
  private async executeDataFetchStage(canvasId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // This would integrate with canvas API service
      // For now, we'll simulate the data fetch
      
      const result = await networkTimeoutService.executeWithTimeout(
        async () => {
          // Simulate data fetch
          await new Promise(resolve => setTimeout(resolve, 1000))
          return { success: true, data: { canvasId, objects: [] } }
        },
        10000,
        `data_fetch_${canvasId}`
      )

      return result.success ? { success: true } : { success: false, error: result.error }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Data fetch failed'
      }
    }
  }

  /**
   * Execute initialization stage
   */
  private async executeInitializationStage(canvasId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // This would integrate with canvas initialization logic
      // For now, we'll simulate the initialization
      
      const result = await networkTimeoutService.executeWithTimeout(
        async () => {
          // Simulate initialization
          await new Promise(resolve => setTimeout(resolve, 300))
          return { success: true }
        },
        5000,
        `init_stage_${canvasId}`
      )

      return result.success ? { success: true } : { success: false, error: result.error }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Initialization failed'
      }
    }
  }

  /**
   * Execute rendering stage
   */
  private async executeRenderingStage(canvasId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // This would integrate with canvas rendering logic
      // For now, we'll simulate the rendering
      
      const result = await networkTimeoutService.executeWithTimeout(
        async () => {
          // Simulate rendering
          await new Promise(resolve => setTimeout(resolve, 200))
          return { success: true }
        },
        5000,
        `render_stage_${canvasId}`
      )

      return result.success ? { success: true } : { success: false, error: result.error }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Rendering failed'
      }
    }
  }

  /**
   * Attempt stage recovery
   */
  private async attemptStageRecovery(canvasId: string, stage: LoadingStage): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`Attempting recovery for stage: ${stage.name}`)
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, this.config.retryDelay))
      
      // Retry the stage
      return await this.executeStage(canvasId, stage)

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Recovery failed'
      }
    }
  }

  /**
   * Start progress tracking
   */
  private startProgressTracking(canvasId: string, onProgress?: (progress: number, stage: string) => void): void {
    const interval = setInterval(() => {
      const loadingState = this.loadingStates.get(canvasId)
      if (loadingState && loadingState.isLoading) {
        onProgress?.(loadingState.progress, loadingState.stage.name)
      }
    }, this.config.progressUpdateInterval)

    this.progressIntervals.set(canvasId, interval)
  }

  /**
   * Update current stage
   */
  private updateCurrentStage(canvasId: string, stage: LoadingStage): void {
    const loadingState = this.loadingStates.get(canvasId)
    if (loadingState) {
      loadingState.stage = stage
      this.loadingStates.set(canvasId, loadingState)
    }
  }

  /**
   * Update progress
   */
  private updateProgress(canvasId: string, progress: number): void {
    const loadingState = this.loadingStates.get(canvasId)
    if (loadingState) {
      loadingState.progress = Math.min(100, Math.max(0, progress))
      
      // Update estimated time remaining
      if (this.config.enableTimeEstimation) {
        const elapsed = Date.now() - loadingState.startTime
        const estimatedTotal = (elapsed / progress) * 100
        loadingState.estimatedTimeRemaining = Math.max(0, estimatedTotal - elapsed)
      }
      
      this.loadingStates.set(canvasId, loadingState)
    }
  }

  /**
   * Complete loading
   */
  private completeLoading(canvasId: string, success: boolean, error?: string): void {
    const loadingState = this.loadingStates.get(canvasId)
    if (loadingState) {
      loadingState.isLoading = false
      loadingState.progress = success ? 100 : loadingState.progress
      loadingState.error = error
      this.loadingStates.set(canvasId, loadingState)
    }

    // Stop progress tracking
    const interval = this.progressIntervals.get(canvasId)
    if (interval) {
      clearInterval(interval)
      this.progressIntervals.delete(canvasId)
    }

    // Update metrics
    if (success) {
      this.metrics.successfulLoads++
    } else {
      this.metrics.failedLoads++
      this.recordError(error || 'Unknown error')
    }

    this.updateAverageLoadingTime()
  }

  /**
   * Record error
   */
  private recordError(error: string): void {
    const existingError = this.metrics.mostCommonErrors.find(e => e.error === error)
    if (existingError) {
      existingError.count++
    } else {
      this.metrics.mostCommonErrors.push({ error, count: 1 })
    }
    
    // Sort by count
    this.metrics.mostCommonErrors.sort((a, b) => b.count - a.count)
  }

  /**
   * Update average loading time
   */
  private updateAverageLoadingTime(): void {
    const alpha = 0.1 // Smoothing factor
    const currentAverage = this.metrics.averageLoadingTime
    // This would be calculated from actual loading times
    this.metrics.averageLoadingTime = currentAverage
  }

  /**
   * Get loading state for canvas
   */
  public getLoadingState(canvasId: string): LoadingState | null {
    return this.loadingStates.get(canvasId) || null
  }

  /**
   * Get loading stages for canvas
   */
  public getLoadingStages(canvasId: string): LoadingStage[] {
    return this.loadingStages.get(canvasId) || []
  }

  /**
   * Cancel loading for canvas
   */
  public cancelLoading(canvasId: string): void {
    const loadingState = this.loadingStates.get(canvasId)
    if (loadingState) {
      loadingState.isLoading = false
      loadingState.error = 'Loading cancelled'
      this.loadingStates.set(canvasId, loadingState)
    }

    // Stop progress tracking
    const interval = this.progressIntervals.get(canvasId)
    if (interval) {
      clearInterval(interval)
      this.progressIntervals.delete(canvasId)
    }
  }

  /**
   * Get loading metrics
   */
  public getMetrics(): LoadingMetrics {
    return { ...this.metrics }
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<LoadingConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Get current configuration
   */
  public getConfig(): LoadingConfig {
    return { ...this.config }
  }

  /**
   * Clear all loading states
   */
  public clearAll(): void {
    // Cancel all active loadings
    for (const canvasId of this.loadingStates.keys()) {
      this.cancelLoading(canvasId)
    }
    
    this.loadingStates.clear()
    this.loadingStages.clear()
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      totalLoads: 0,
      successfulLoads: 0,
      failedLoads: 0,
      averageLoadingTime: 0,
      averageProgressAccuracy: 0,
      mostCommonErrors: [],
      stagePerformance: []
    }
  }
}

// Export singleton instance
export const canvasLoadingStateService = new CanvasLoadingStateService()

// Export types and service
export { CanvasLoadingStateService }
export type { LoadingState, LoadingStage, LoadingConfig, LoadingMetrics, LoadingResult }
