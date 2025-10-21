/**
 * Error Rate Monitoring Service
 * Tracks authentication error rates and triggers alerts when thresholds are exceeded.
 */

export interface ErrorEvent {
  timestamp: number;
  type: 'authentication' | 'api' | 'websocket' | 'general';
  error: string;
  context?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ErrorRateStats {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  errorRate: number; // errors per minute
  recentErrors: ErrorEvent[];
  isHighErrorRate: boolean;
  lastAlertTime: number;
}

export interface AlertConfig {
  highErrorRateThreshold: number; // errors per minute
  criticalErrorRateThreshold: number; // errors per minute
  alertCooldown: number; // milliseconds between alerts
  monitoringWindow: number; // milliseconds to look back for error rate calculation
}

export class ErrorRateMonitor {
  private errors: ErrorEvent[] = [];
  private alertConfig: AlertConfig;
  private lastAlertTime = 0;
  private alertCallbacks: ((stats: ErrorRateStats) => void)[] = [];

  constructor(config: AlertConfig = {
    highErrorRateThreshold: 10, // 10 errors per minute
    criticalErrorRateThreshold: 20, // 20 errors per minute
    alertCooldown: 30000, // 30 seconds between alerts
    monitoringWindow: 60000 // 1 minute window
  }) {
    this.alertConfig = config;
    
    // Clean up old errors periodically
    setInterval(() => {
      this.cleanupOldErrors();
    }, 30000); // Clean up every 30 seconds
  }

  /**
   * Record an error event
   */
  recordError(
    type: ErrorEvent['type'],
    error: string,
    severity: ErrorEvent['severity'] = 'medium',
    context?: string
  ): void {
    const errorEvent: ErrorEvent = {
      timestamp: Date.now(),
      type,
      error,
      context,
      severity
    };

    this.errors.push(errorEvent);
    this.cleanupOldErrors();

    // Check if we need to trigger an alert
    this.checkErrorRate();
  }

  /**
   * Record an authentication error
   */
  recordAuthError(error: string, context?: string): void {
    this.recordError('authentication', error, 'high', context);
  }

  /**
   * Record an API error
   */
  recordApiError(error: string, context?: string): void {
    this.recordError('api', error, 'medium', context);
  }

  /**
   * Record a WebSocket error
   */
  recordWebSocketError(error: string, context?: string): void {
    this.recordError('websocket', error, 'high', context);
  }

  /**
   * Record a general error
   */
  recordGeneralError(error: string, severity: ErrorEvent['severity'] = 'low', context?: string): void {
    this.recordError('general', error, severity, context);
  }

  /**
   * Get current error rate statistics
   */
  getErrorRateStats(): ErrorRateStats {
    const now = Date.now();
    const windowStart = now - this.alertConfig.monitoringWindow;
    
    // Filter errors within the monitoring window
    const recentErrors = this.errors.filter(error => error.timestamp >= windowStart);
    
    // Count errors by type
    const errorsByType: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};
    
    recentErrors.forEach(error => {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
    });

    // Calculate error rate (errors per minute)
    const errorRate = (recentErrors.length / this.alertConfig.monitoringWindow) * 60000;
    
    // Determine if error rate is high
    const isHighErrorRate = errorRate >= this.alertConfig.highErrorRateThreshold;

    return {
      totalErrors: this.errors.length,
      errorsByType,
      errorsBySeverity,
      errorRate,
      recentErrors: recentErrors.slice(-10), // Last 10 errors
      isHighErrorRate,
      lastAlertTime: this.lastAlertTime
    };
  }

  /**
   * Check if error rate exceeds thresholds and trigger alerts
   */
  private checkErrorRate(): void {
    const now = Date.now();
    const stats = this.getErrorRateStats();
    
    // Check if we're in cooldown period
    if (now - this.lastAlertTime < this.alertConfig.alertCooldown) {
      return;
    }

    // Check if error rate is critical
    if (stats.errorRate >= this.alertConfig.criticalErrorRateThreshold) {
      this.triggerAlert('critical', stats);
      this.lastAlertTime = now;
    }
    // Check if error rate is high
    else if (stats.errorRate >= this.alertConfig.highErrorRateThreshold) {
      this.triggerAlert('high', stats);
      this.lastAlertTime = now;
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(level: 'high' | 'critical', stats: ErrorRateStats): void {
    const alertMessage = `Error rate ${level}: ${stats.errorRate.toFixed(2)} errors/minute`;
    console.error(`🚨 ${alertMessage}`, stats);
    
    // Call registered alert callbacks
    this.alertCallbacks.forEach(callback => {
      try {
        callback(stats);
      } catch (error) {
        console.error('Error in alert callback:', error);
      }
    });

    // Log to error tracking service if available
    if (typeof window !== 'undefined' && (window as any).errorTracker) {
      (window as any).errorTracker.logError('High Error Rate Detected', {
        level,
        errorRate: stats.errorRate,
        errorsByType: stats.errorsByType,
        recentErrors: stats.recentErrors
      });
    }
  }

  /**
   * Register an alert callback
   */
  onAlert(callback: (stats: ErrorRateStats) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Remove an alert callback
   */
  removeAlertCallback(callback: (stats: ErrorRateStats) => void): void {
    const index = this.alertCallbacks.indexOf(callback);
    if (index > -1) {
      this.alertCallbacks.splice(index, 1);
    }
  }

  /**
   * Clean up old errors outside the monitoring window
   */
  private cleanupOldErrors(): void {
    const cutoffTime = Date.now() - (this.alertConfig.monitoringWindow * 2); // Keep 2x window for safety
    this.errors = this.errors.filter(error => error.timestamp >= cutoffTime);
  }

  /**
   * Get errors of a specific type
   */
  getErrorsByType(type: ErrorEvent['type']): ErrorEvent[] {
    return this.errors.filter(error => error.type === type);
  }

  /**
   * Get errors of a specific severity
   */
  getErrorsBySeverity(severity: ErrorEvent['severity']): ErrorEvent[] {
    return this.errors.filter(error => error.severity === severity);
  }

  /**
   * Get recent errors within a time window
   */
  getRecentErrors(windowMs: number = 300000): ErrorEvent[] { // Default 5 minutes
    const cutoffTime = Date.now() - windowMs;
    return this.errors.filter(error => error.timestamp >= cutoffTime);
  }

  /**
   * Clear all error history
   */
  clearHistory(): void {
    this.errors = [];
    this.lastAlertTime = 0;
    console.log('Error rate monitor history cleared');
  }

  /**
   * Update alert configuration
   */
  updateConfig(newConfig: Partial<AlertConfig>): void {
    this.alertConfig = { ...this.alertConfig, ...newConfig };
    console.log('Error rate monitor configuration updated:', this.alertConfig);
  }

  /**
   * Get current configuration
   */
  getConfig(): AlertConfig {
    return { ...this.alertConfig };
  }

  /**
   * Check if system is in a healthy state
   */
  isHealthy(): boolean {
    const stats = this.getErrorRateStats();
    return !stats.isHighErrorRate && stats.errorRate < this.alertConfig.highErrorRateThreshold;
  }

  /**
   * Get health status
   */
  getHealthStatus(): 'healthy' | 'degraded' | 'critical' {
    const stats = this.getErrorRateStats();
    
    if (stats.errorRate >= this.alertConfig.criticalErrorRateThreshold) {
      return 'critical';
    } else if (stats.errorRate >= this.alertConfig.highErrorRateThreshold) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }
}

// Global error rate monitor instance
export const errorRateMonitor = new ErrorRateMonitor();

// Convenience functions for common error types
export const recordAuthError = (error: string, context?: string) => 
  errorRateMonitor.recordAuthError(error, context);

export const recordApiError = (error: string, context?: string) => 
  errorRateMonitor.recordApiError(error, context);

export const recordWebSocketError = (error: string, context?: string) => 
  errorRateMonitor.recordWebSocketError(error, context);

export const recordGeneralError = (error: string, severity: ErrorEvent['severity'] = 'low', context?: string) => 
  errorRateMonitor.recordGeneralError(error, severity, context);

// Export the monitor instance
export default errorRateMonitor;
