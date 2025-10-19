/**
 * Enhanced Error Handler
 * Provides intelligent error handling with network awareness
 * and user-friendly feedback
 */

import { networkHealthService, NetworkStatus } from './networkHealthService'
import { errorLogger, ErrorContext } from '../utils/errorLogger'
import { isRetryableError } from '../utils/retryLogic'
import toast from 'react-hot-toast'

export interface ErrorContext {
  operation: string
  component?: string
  userId?: string
  canvasId?: string
  objectId?: string
  timestamp: number
  additionalData?: Record<string, any>
}

export interface ErrorHandlingOptions {
  showToast?: boolean
  logError?: boolean
  retryable?: boolean
  fallbackAction?: () => void
  userMessage?: string
  severity?: 'low' | 'medium' | 'high' | 'critical'
}

export interface ErrorClassification {
  type: 'network' | 'authentication' | 'validation' | 'server' | 'client' | 'unknown'
  severity: 'low' | 'medium' | 'high' | 'critical'
  retryable: boolean
  userMessage: string
  technicalMessage: string
}

class EnhancedErrorHandler {
  private errorCounts: Map<string, number> = new Map()
  private lastErrorTime: Map<string, number> = new Map()
  private suppressedErrors: Set<string> = new Set()

  /**
   * Handle error with intelligent classification and user feedback
   */
  handleError(
    error: any,
    context: ErrorContext,
    options: ErrorHandlingOptions = {}
  ): ErrorClassification {
    const {
      showToast = true,
      logError = true,
      retryable = true,
      fallbackAction,
      userMessage,
      severity = 'medium'
    } = options

    // Classify the error
    const classification = this.classifyError(error, context)

    // Update error tracking
    this.updateErrorTracking(context.operation, classification.severity)

    // Log error if requested
    if (logError) {
      this.logError(error, context, classification)
    }

    // Show user feedback if requested and not suppressed
    if (showToast && !this.isErrorSuppressed(context.operation)) {
      this.showUserFeedback(classification, context, userMessage)
    }

    // Execute fallback action if provided
    if (fallbackAction && !this.isErrorSuppressed(context.operation)) {
      try {
        fallbackAction()
      } catch (fallbackError) {
        console.error('Fallback action failed:', fallbackError)
      }
    }

    return classification
  }

  /**
   * Classify error based on type and context
   */
  private classifyError(error: any, context: ErrorContext): ErrorClassification {
    const errorMessage = error?.message || error?.toString() || 'Unknown error'
    const statusCode = error?.response?.status || error?.status

    // Network errors
    if (this.isNetworkError(error)) {
      return {
        type: 'network',
        severity: this.getNetworkErrorSeverity(error),
        retryable: true,
        userMessage: this.getNetworkErrorMessage(error),
        technicalMessage: `Network error: ${errorMessage}`
      }
    }

    // Authentication errors
    if (this.isAuthenticationError(error, statusCode)) {
      return {
        type: 'authentication',
        severity: 'high',
        retryable: false,
        userMessage: 'Authentication failed. Please sign in again.',
        technicalMessage: `Authentication error: ${errorMessage}`
      }
    }

    // Validation errors
    if (this.isValidationError(error, statusCode)) {
      return {
        type: 'validation',
        severity: 'low',
        retryable: false,
        userMessage: 'Invalid input. Please check your data and try again.',
        technicalMessage: `Validation error: ${errorMessage}`
      }
    }

    // Server errors
    if (this.isServerError(error, statusCode)) {
      return {
        type: 'server',
        severity: this.getServerErrorSeverity(statusCode),
        retryable: isRetryableError(error),
        userMessage: this.getServerErrorMessage(statusCode),
        technicalMessage: `Server error (${statusCode}): ${errorMessage}`
      }
    }

    // Client errors
    if (this.isClientError(error, statusCode)) {
      return {
        type: 'client',
        severity: 'medium',
        retryable: false,
        userMessage: 'Something went wrong. Please try again.',
        technicalMessage: `Client error: ${errorMessage}`
      }
    }

    // Unknown errors
    return {
      type: 'unknown',
      severity: 'medium',
      retryable: isRetryableError(error),
      userMessage: 'An unexpected error occurred. Please try again.',
      technicalMessage: `Unknown error: ${errorMessage}`
    }
  }

  /**
   * Check if error is network-related
   */
  private isNetworkError(error: any): boolean {
    const message = error?.message || ''
    const code = error?.code || ''

    return (
      message.includes('Network Error') ||
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('timeout') ||
      code === 'NETWORK_ERROR' ||
      code === 'TIMEOUT' ||
      !navigator.onLine
    )
  }

  /**
   * Check if error is authentication-related
   */
  private isAuthenticationError(error: any, statusCode?: number): boolean {
    return (
      statusCode === 401 ||
      statusCode === 403 ||
      error?.message?.includes('unauthorized') ||
      error?.message?.includes('authentication') ||
      error?.message?.includes('token')
    )
  }

  /**
   * Check if error is validation-related
   */
  private isValidationError(error: any, statusCode?: number): boolean {
    return (
      statusCode === 400 ||
      error?.message?.includes('validation') ||
      error?.message?.includes('invalid') ||
      error?.message?.includes('required')
    )
  }

  /**
   * Check if error is server-related
   */
  private isServerError(error: any, statusCode?: number): boolean {
    return statusCode ? statusCode >= 500 : false
  }

  /**
   * Check if error is client-related
   */
  private isClientError(error: any, statusCode?: number): boolean {
    return statusCode ? statusCode >= 400 && statusCode < 500 : false
  }

  /**
   * Get network error severity
   */
  private getNetworkErrorSeverity(error: any): 'low' | 'medium' | 'high' | 'critical' {
    const networkStatus = networkHealthService.getNetworkStatus()
    
    if (!networkStatus.isOnline) {
      return 'critical'
    }

    if (networkStatus.apiHealth === 'unhealthy') {
      return 'high'
    }

    if (networkStatus.apiHealth === 'degraded') {
      return 'medium'
    }

    return 'low'
  }

  /**
   * Get server error severity
   */
  private getServerErrorSeverity(statusCode?: number): 'low' | 'medium' | 'high' | 'critical' {
    if (!statusCode) return 'medium'

    if (statusCode >= 500 && statusCode < 600) {
      return statusCode === 500 ? 'high' : 'critical'
    }

    return 'medium'
  }

  /**
   * Get network error message
   */
  private getNetworkErrorMessage(error: any): string {
    const networkStatus = networkHealthService.getNetworkStatus()
    
    if (!networkStatus.isOnline) {
      return 'No internet connection. Please check your network and try again.'
    }

    if (networkStatus.apiHealth === 'unhealthy') {
      return 'Server connection issues. Some features may be limited.'
    }

    if (networkStatus.apiHealth === 'degraded') {
      return 'Slow connection detected. Some features may be limited.'
    }

    return 'Network error occurred. Some features may be limited.'
  }

  /**
   * Get server error message
   */
  private getServerErrorMessage(statusCode?: number): string {
    switch (statusCode) {
      case 500:
        return 'Server error occurred. Please try again in a moment.'
      case 502:
      case 503:
        return 'Service temporarily unavailable. Please try again later.'
      case 504:
        return 'Request timeout. Please try again.'
      default:
        return 'Server error occurred. Some features may be limited.'
    }
  }

  /**
   * Show user feedback based on error classification
   */
  private showUserFeedback(
    classification: ErrorClassification,
    context: ErrorContext,
    customMessage?: string
  ): void {
    const message = customMessage || classification.userMessage
    const duration = this.getToastDuration(classification.severity)

    switch (classification.severity) {
      case 'critical':
        toast.error(message, { duration, icon: '🚨' })
        break
      case 'high':
        toast.error(message, { duration, icon: '⚠️' })
        break
      case 'medium':
        toast.error(message, { duration })
        break
      case 'low':
        toast(message, { duration, icon: 'ℹ️' })
        break
    }
  }

  /**
   * Get toast duration based on severity
   */
  private getToastDuration(severity: 'low' | 'medium' | 'high' | 'critical'): number {
    switch (severity) {
      case 'critical':
        return 8000
      case 'high':
        return 6000
      case 'medium':
        return 4000
      case 'low':
        return 3000
    }
  }

  /**
   * Log error with context
   */
  private logError(error: any, context: ErrorContext, classification: ErrorClassification): void {
    const errorContext: ErrorContext = {
      operation: context.operation,
      component: context.component,
      userId: context.userId,
      canvasId: context.canvasId,
      objectId: context.objectId,
      timestamp: context.timestamp,
      additionalData: {
        ...context.additionalData,
        errorType: classification.type,
        severity: classification.severity,
        retryable: classification.retryable,
        networkStatus: networkHealthService.getNetworkStatus()
      }
    }

    errorLogger.logError(error, errorContext)
  }

  /**
   * Update error tracking for rate limiting
   */
  private updateErrorTracking(operation: string, severity: 'low' | 'medium' | 'high' | 'critical'): void {
    const now = Date.now()
    const key = `${operation}_${severity}`
    
    // Increment error count
    const currentCount = this.errorCounts.get(key) || 0
    this.errorCounts.set(key, currentCount + 1)
    this.lastErrorTime.set(key, now)

    // Suppress errors if too many in short time
    if (currentCount > 5 && now - (this.lastErrorTime.get(key) || 0) < 60000) {
      this.suppressedErrors.add(key)
      
      // Remove suppression after 5 minutes
      setTimeout(() => {
        this.suppressedErrors.delete(key)
        this.errorCounts.delete(key)
      }, 300000)
    }
  }

  /**
   * Check if error should be suppressed
   */
  private isErrorSuppressed(operation: string): boolean {
    return Array.from(this.suppressedErrors).some(key => key.startsWith(operation))
  }

  /**
   * Handle Socket.IO errors specifically
   */
  handleSocketError(error: any, context: Partial<ErrorContext> = {}): void {
    const fullContext: ErrorContext = {
      operation: 'socket_operation',
      timestamp: Date.now(),
      ...context
    }

    const classification = this.handleError(error, fullContext, {
      showToast: true,
      logError: true,
      retryable: true,
      userMessage: 'Real-time features temporarily unavailable. Some features may be limited.'
    })

    // Update network health service
    if (classification.type === 'network') {
      networkHealthService.performHealthCheck()
    }
  }

  /**
   * Handle API errors specifically
   */
  handleAPIError(error: any, context: Partial<ErrorContext> = {}): void {
    const fullContext: ErrorContext = {
      operation: 'api_request',
      timestamp: Date.now(),
      ...context
    }

    const classification = this.handleError(error, fullContext, {
      showToast: true,
      logError: true,
      retryable: true
    })

    // Update network health service
    if (classification.type === 'network' || classification.type === 'server') {
      networkHealthService.performHealthCheck()
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats(): any {
    return {
      errorCounts: Object.fromEntries(this.errorCounts),
      suppressedErrors: Array.from(this.suppressedErrors),
      networkStatus: networkHealthService.getNetworkStatus()
    }
  }

  /**
   * Clear error tracking
   */
  clearErrorTracking(): void {
    this.errorCounts.clear()
    this.lastErrorTime.clear()
    this.suppressedErrors.clear()
  }
}

// Create singleton instance
export const enhancedErrorHandler = new EnhancedErrorHandler()

// Export types and service
export default enhancedErrorHandler
