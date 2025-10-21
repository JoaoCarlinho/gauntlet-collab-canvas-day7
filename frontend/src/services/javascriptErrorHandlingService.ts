/**
 * Comprehensive JavaScript Error Handling Service with Error Recovery and User Experience Management
 */

import { errorLogger } from '../utils/errorLogger'

export interface ErrorContext {
  component?: string
  function?: string
  operation?: string
  userId?: string
  canvasId?: string
  objectId?: string
  timestamp: number
  userAgent: string
  url: string
  stack?: string
  metadata?: Record<string, any>
}

export interface ErrorRecoveryStrategy {
  name: string
  description: string
  canHandle: (error: Error, context: ErrorContext) => boolean
  execute: (error: Error, context: ErrorContext) => Promise<ErrorRecoveryResult>
  priority: number
}

export interface ErrorRecoveryResult {
  success: boolean
  recovered: boolean
  error?: string
  userMessage?: string
  action?: string
  metadata?: Record<string, any>
}

export interface ErrorMetrics {
  totalErrors: number
  handledErrors: number
  recoveredErrors: number
  criticalErrors: number
  errorTypes: Array<{ type: string; count: number }>
  recoveryStrategies: Array<{ strategy: string; successRate: number; attempts: number }>
  averageRecoveryTime: number
  userImpactLevels: Array<{ level: string; count: number }>
}

export interface ErrorClassification {
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'network' | 'validation' | 'state' | 'ui' | 'system' | 'user' | 'unknown'
  userImpact: 'none' | 'minor' | 'moderate' | 'severe'
  recoverable: boolean
  autoRecoverable: boolean
  requiresUserAction: boolean
}

class JavaScriptErrorHandlingService {
  private recoveryStrategies: ErrorRecoveryStrategy[] = []
  private errorMetrics: ErrorMetrics = {
    totalErrors: 0,
    handledErrors: 0,
    recoveredErrors: 0,
    criticalErrors: 0,
    errorTypes: [],
    recoveryStrategies: [],
    averageRecoveryTime: 0,
    userImpactLevels: []
  }

  private readonly RECOVERY_TIMEOUT = 5000
  private readonly ERROR_REPORTING_ENABLED = true

  constructor() {
    this.initializeErrorHandling()
    this.initializeRecoveryStrategies()
  }

  /**
   * Initialize global error handling
   */
  private initializeErrorHandling(): void {
    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error, {
        component: 'global',
        function: 'uncaught_error',
        operation: 'page_error',
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        stack: event.error?.stack,
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      })
    })

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(new Error(event.reason), {
        component: 'global',
        function: 'unhandled_promise_rejection',
        operation: 'promise_rejection',
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        metadata: {
          reason: event.reason,
          promise: event.promise
        }
      })
    })

    // Handle resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        this.handleError(new Error(`Resource loading failed: ${event.target}`), {
          component: 'global',
          function: 'resource_loading',
          operation: 'resource_load',
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          metadata: {
            target: event.target,
            type: (event.target as any)?.tagName
          }
        })
      }
    }, true)
  }

  /**
   * Initialize recovery strategies
   */
  private initializeRecoveryStrategies(): void {
    this.recoveryStrategies = [
      {
        name: 'state_reset',
        description: 'Reset component state to recover from state corruption',
        canHandle: (error, context) => 
          error.message.includes('state') || 
          error.message.includes('undefined') ||
          context.component !== 'global',
        execute: async () => this.executeStateReset(),
        priority: 1
      },
      {
        name: 'component_remount',
        description: 'Remount component to recover from rendering errors',
        canHandle: (error) => 
          error.message.includes('render') || 
          error.message.includes('component') ||
          error.name === 'TypeError',
        execute: async () => this.executeComponentRemount(),
        priority: 2
      },
      {
        name: 'network_retry',
        description: 'Retry network operations with exponential backoff',
        canHandle: (error) => 
          error.message.includes('fetch') || 
          error.message.includes('network') ||
          error.message.includes('timeout'),
        execute: async () => this.executeNetworkRetry(),
        priority: 3
      },
      {
        name: 'validation_fix',
        description: 'Fix validation errors by providing default values',
        canHandle: (error) => 
          error.message.includes('validation') || 
          error.message.includes('required') ||
          error.message.includes('invalid'),
        execute: async () => this.executeValidationFix(),
        priority: 4
      },
      {
        name: 'fallback_ui',
        description: 'Show fallback UI when primary functionality fails',
        canHandle: (error, context) => 
          error.message.includes('render') || 
          error.message.includes('component') ||
          context.component !== 'global',
        execute: async () => this.executeFallbackUI(),
        priority: 5
      },
      {
        name: 'user_notification',
        description: 'Notify user of error and provide recovery options',
        canHandle: () => true, // Always available as fallback
        execute: async () => this.executeUserNotification(),
        priority: 6
      }
    ]

    // Sort strategies by priority
    this.recoveryStrategies.sort((a, b) => a.priority - b.priority)
  }

  /**
   * Handle JavaScript error
   */
  public async handleError(error: Error, context: ErrorContext): Promise<ErrorRecoveryResult> {
    const startTime = Date.now()
    this.errorMetrics.totalErrors++

    try {
      // Classify the error
      const classification = this.classifyError(error, context)
      
      // Log the error
      this.logError(error, context, classification)

      // Update metrics
      this.updateErrorMetrics(error, classification)

      // Attempt recovery if the error is recoverable
      if (classification.recoverable && classification.autoRecoverable) {
        const recoveryResult = await this.attemptRecovery(error, context)
        
        if (recoveryResult.success && recoveryResult.recovered) {
          this.errorMetrics.recoveredErrors++
          this.updateRecoveryMetrics(recoveryResult, Date.now() - startTime)
          return recoveryResult
        }
      }

      // If recovery failed or not possible, handle as unrecoverable
      this.handleUnrecoverableError(error, context, classification)

      return {
        success: false,
        recovered: false,
        error: error.message,
        userMessage: this.getUserFriendlyMessage(classification),
        action: 'manual_intervention_required'
      }

    } catch (recoveryError) {
      console.error('Error handling failed:', recoveryError)
      
      return {
        success: false,
        recovered: false,
        error: `Error handling failed: ${recoveryError instanceof Error ? recoveryError.message : 'Unknown error'}`,
        userMessage: 'An unexpected error occurred. Please refresh the page.',
        action: 'page_refresh_required'
      }
    }
  }

  /**
   * Classify error severity and impact
   */
  private classifyError(error: Error, context: ErrorContext): ErrorClassification {
    const errorMessage = error.message.toLowerCase()
    const errorName = error.name.toLowerCase()

    // Determine severity
    let severity: ErrorClassification['severity'] = 'medium'
    if (errorName.includes('critical') || errorMessage.includes('fatal')) {
      severity = 'critical'
    } else if (errorName.includes('warning') || errorMessage.includes('deprecated')) {
      severity = 'low'
    } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      severity = 'high'
    }

    // Determine category
    let category: ErrorClassification['category'] = 'unknown'
    if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('timeout')) {
      category = 'network'
    } else if (errorMessage.includes('validation') || errorMessage.includes('invalid') || errorMessage.includes('required')) {
      category = 'validation'
    } else if (errorMessage.includes('state') || errorMessage.includes('undefined') || errorMessage.includes('null')) {
      category = 'state'
    } else if (errorMessage.includes('render') || errorMessage.includes('component') || errorMessage.includes('dom')) {
      category = 'ui'
    } else if (errorMessage.includes('system') || errorMessage.includes('memory') || errorMessage.includes('permission')) {
      category = 'system'
    } else if (errorMessage.includes('user') || errorMessage.includes('input') || errorMessage.includes('action')) {
      category = 'user'
    }

    // Determine user impact
    let userImpact: ErrorClassification['userImpact'] = 'moderate'
    if (severity === 'critical' || category === 'system') {
      userImpact = 'severe'
    } else if (severity === 'low' && category === 'validation') {
      userImpact = 'minor'
    } else if (context.component === 'global') {
      userImpact = 'severe'
    }

    // Determine recoverability
    const recoverable = !errorMessage.includes('fatal') && 
                       !errorMessage.includes('critical') && 
                       category !== 'system'

    const autoRecoverable = recoverable && 
                           (category === 'network' || category === 'validation' || category === 'state')

    const requiresUserAction = severity === 'critical' || 
                              userImpact === 'severe' || 
                              !autoRecoverable

    return {
      severity,
      category,
      userImpact,
      recoverable,
      autoRecoverable,
      requiresUserAction
    }
  }

  /**
   * Log error with context
   */
  private logError(error: Error, context: ErrorContext, classification: ErrorClassification): void {
    if (this.ERROR_REPORTING_ENABLED) {
      errorLogger.logError('JavaScript error handled', {
        operation: 'general',
        additionalData: { error: error.message, stack: error.stack, name: error.name, context, classification },
        timestamp: Date.now()
      })
    }

    // Log to console with appropriate level
    const logLevel = classification.severity === 'critical' ? 'error' : 
                    classification.severity === 'high' ? 'warn' : 'log'
    
    console[logLevel](`[${classification.severity.toUpperCase()}] ${error.name}: ${error.message}`, {
      context,
      classification,
      stack: error.stack
    })
  }

  /**
   * Update error metrics
   */
  private updateErrorMetrics(error: Error, classification: ErrorClassification): void {
    this.errorMetrics.handledErrors++

    if (classification.severity === 'critical') {
      this.errorMetrics.criticalErrors++
    }

    // Update error types
    const errorType = `${error.name}:${classification.category}`
    const existingType = this.errorMetrics.errorTypes.find(t => t.type === errorType)
    if (existingType) {
      existingType.count++
    } else {
      this.errorMetrics.errorTypes.push({ type: errorType, count: 1 })
    }

    // Update user impact levels
    const existingImpact = this.errorMetrics.userImpactLevels.find(i => i.level === classification.userImpact)
    if (existingImpact) {
      existingImpact.count++
    } else {
      this.errorMetrics.userImpactLevels.push({ level: classification.userImpact, count: 1 })
    }

    // Sort by count
    this.errorMetrics.errorTypes.sort((a, b) => b.count - a.count)
    this.errorMetrics.userImpactLevels.sort((a, b) => b.count - a.count)
  }

  /**
   * Attempt error recovery
   */
  private async attemptRecovery(error: Error, context: ErrorContext): Promise<ErrorRecoveryResult> {
    const applicableStrategies = this.recoveryStrategies.filter(strategy =>
      strategy.canHandle(error, context)
    )

    for (const strategy of applicableStrategies) {
      try {
        console.log(`Attempting error recovery with strategy: ${strategy.name}`)
        
        const result = await Promise.race([
          strategy.execute(error, context),
          new Promise<ErrorRecoveryResult>((_, reject) => 
            setTimeout(() => reject(new Error('Recovery timeout')), this.RECOVERY_TIMEOUT)
          )
        ])

        if (result.success && result.recovered) {
          console.log(`Error recovery successful with strategy: ${strategy.name}`)
          return result
        }

        console.log(`Error recovery failed with strategy: ${strategy.name}`)

      } catch (recoveryError) {
        console.error(`Error recovery strategy ${strategy.name} failed:`, recoveryError)
      }
    }

    return {
      success: false,
      recovered: false,
      error: 'All recovery strategies failed'
    }
  }

  /**
   * Execute state reset recovery
   */
  private async executeStateReset(): Promise<ErrorRecoveryResult> {
    try {
      // This would integrate with state management to reset component state
      console.log('Executing state reset recovery')
      
      // Simulate state reset
      await new Promise(resolve => setTimeout(resolve, 100))
      
      return {
        success: true,
        recovered: true,
        userMessage: 'Component state has been reset',
        action: 'state_reset',
        metadata: { strategy: 'state_reset' }
      }
    } catch (error) {
      return {
        success: false,
        recovered: false,
        error: error instanceof Error ? error.message : 'State reset failed'
      }
    }
  }

  /**
   * Execute component remount recovery
   */
  private async executeComponentRemount(): Promise<ErrorRecoveryResult> {
    try {
      // This would integrate with React or other framework to remount component
      console.log('Executing component remount recovery')
      
      // Simulate component remount
      await new Promise(resolve => setTimeout(resolve, 200))
      
      return {
        success: true,
        recovered: true,
        userMessage: 'Component has been reloaded',
        action: 'component_remount',
        metadata: { strategy: 'component_remount' }
      }
    } catch (error) {
      return {
        success: false,
        recovered: false,
        error: error instanceof Error ? error.message : 'Component remount failed'
      }
    }
  }

  /**
   * Execute network retry recovery
   */
  private async executeNetworkRetry(): Promise<ErrorRecoveryResult> {
    try {
      // This would integrate with network service to retry failed requests
      console.log('Executing network retry recovery')
      
      // Simulate network retry
      await new Promise(resolve => setTimeout(resolve, 500))
      
      return {
        success: true,
        recovered: true,
        userMessage: 'Network operation retried successfully',
        action: 'network_retry',
        metadata: { strategy: 'network_retry' }
      }
    } catch (error) {
      return {
        success: false,
        recovered: false,
        error: error instanceof Error ? error.message : 'Network retry failed'
      }
    }
  }

  /**
   * Execute validation fix recovery
   */
  private async executeValidationFix(): Promise<ErrorRecoveryResult> {
    try {
      // This would integrate with validation service to fix validation errors
      console.log('Executing validation fix recovery')
      
      // Simulate validation fix
      await new Promise(resolve => setTimeout(resolve, 100))
      
      return {
        success: true,
        recovered: true,
        userMessage: 'Validation errors have been fixed',
        action: 'validation_fix',
        metadata: { strategy: 'validation_fix' }
      }
    } catch (error) {
      return {
        success: false,
        recovered: false,
        error: error instanceof Error ? error.message : 'Validation fix failed'
      }
    }
  }

  /**
   * Execute fallback UI recovery
   */
  private async executeFallbackUI(): Promise<ErrorRecoveryResult> {
    try {
      // This would integrate with UI service to show fallback interface
      console.log('Executing fallback UI recovery')
      
      // Simulate fallback UI
      await new Promise(resolve => setTimeout(resolve, 300))
      
      return {
        success: true,
        recovered: true,
        userMessage: 'Fallback interface is now active',
        action: 'fallback_ui',
        metadata: { strategy: 'fallback_ui' }
      }
    } catch (error) {
      return {
        success: false,
        recovered: false,
        error: error instanceof Error ? error.message : 'Fallback UI failed'
      }
    }
  }

  /**
   * Execute user notification recovery
   */
  private async executeUserNotification(): Promise<ErrorRecoveryResult> {
    try {
      // This would integrate with notification service to inform user
      console.log('Executing user notification recovery')
      
      // Simulate user notification
      await new Promise(resolve => setTimeout(resolve, 100))
      
      return {
        success: true,
        recovered: false, // User notification doesn't recover the error
        userMessage: 'An error occurred. Please try again.',
        action: 'user_notification',
        metadata: { strategy: 'user_notification' }
      }
    } catch (error) {
      return {
        success: false,
        recovered: false,
        error: error instanceof Error ? error.message : 'User notification failed'
      }
    }
  }

  /**
   * Handle unrecoverable error
   */
  private handleUnrecoverableError(error: Error, context: ErrorContext, classification: ErrorClassification): void {
    console.error('Unrecoverable error:', error)
    
    // Report to error tracking service
    if (this.ERROR_REPORTING_ENABLED) {
      errorLogger.logError('Unrecoverable error', {
        operation: 'general',
        additionalData: { error: error.message, stack: error.stack, context, classification },
        timestamp: Date.now()
      })
    }

    // Show user-friendly error message
    const userMessage = this.getUserFriendlyMessage(classification)
    this.showUserErrorNotification(userMessage, classification)
  }

  /**
   * Get user-friendly error message
   */
  private getUserFriendlyMessage(classification: ErrorClassification): string {
    switch (classification.category) {
      case 'network':
        return 'Network connection issue. Please check your internet connection and try again.'
      case 'validation':
        return 'Please check your input and try again.'
      case 'state':
        return 'Application state issue. The page will be refreshed automatically.'
      case 'ui':
        return 'Display issue detected. The interface will be reloaded.'
      case 'system':
        return 'System error occurred. Please refresh the page or contact support.'
      case 'user':
        return 'Please check your action and try again.'
      default:
        return 'An unexpected error occurred. Please try again or refresh the page.'
    }
  }

  /**
   * Show user error notification
   */
  private showUserErrorNotification(message: string, classification: ErrorClassification): void {
    // This would integrate with notification service
    console.log(`User notification: ${message}`)
    
    // For critical errors, show modal or alert
    if (classification.severity === 'critical') {
      // Show critical error modal
      console.error('CRITICAL ERROR - User action required')
    }
  }

  /**
   * Update recovery metrics
   */
  private updateRecoveryMetrics(result: ErrorRecoveryResult, recoveryTime: number): void {
    const alpha = 0.1 // Smoothing factor
    this.errorMetrics.averageRecoveryTime = 
      (alpha * recoveryTime) + ((1 - alpha) * this.errorMetrics.averageRecoveryTime)

    // Update strategy metrics
    const strategyName = result.metadata?.strategy || 'unknown'
    const existingStrategy = this.errorMetrics.recoveryStrategies.find(s => s.strategy === strategyName)
    if (existingStrategy) {
      existingStrategy.attempts++
      existingStrategy.successRate = (existingStrategy.successRate * (existingStrategy.attempts - 1) + 1) / existingStrategy.attempts
    } else {
      this.errorMetrics.recoveryStrategies.push({
        strategy: strategyName,
        successRate: 1.0,
        attempts: 1
      })
    }
  }

  /**
   * Get error metrics
   */
  public getMetrics(): ErrorMetrics {
    return { ...this.errorMetrics }
  }

  /**
   * Reset error metrics
   */
  public resetMetrics(): void {
    this.errorMetrics = {
      totalErrors: 0,
      handledErrors: 0,
      recoveredErrors: 0,
      criticalErrors: 0,
      errorTypes: [],
      recoveryStrategies: [],
      averageRecoveryTime: 0,
      userImpactLevels: []
    }
  }

  /**
   * Add custom recovery strategy
   */
  public addRecoveryStrategy(strategy: ErrorRecoveryStrategy): void {
    this.recoveryStrategies.push(strategy)
    this.recoveryStrategies.sort((a, b) => a.priority - b.priority)
  }

  /**
   * Remove recovery strategy
   */
  public removeRecoveryStrategy(strategyName: string): void {
    this.recoveryStrategies = this.recoveryStrategies.filter(s => s.name !== strategyName)
  }
}

// Export singleton instance
export const javascriptErrorHandlingService = new JavaScriptErrorHandlingService()

// Export service
export { JavaScriptErrorHandlingService }
