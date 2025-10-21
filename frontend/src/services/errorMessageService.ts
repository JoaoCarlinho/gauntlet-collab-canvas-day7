/**
 * Error Message Service
 * Provides user-friendly error messages for various error types and scenarios.
 */

export interface ErrorContext {
  operation?: string;
  component?: string;
  userId?: string;
  timestamp?: number;
  additionalData?: Record<string, any>;
}

export interface UserFriendlyError {
  title: string;
  message: string;
  action?: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  canRetry: boolean;
  showToUser: boolean;
}

export class ErrorMessageService {
  private static instance: ErrorMessageService;
  
  private constructor() {}
  
  static getInstance(): ErrorMessageService {
    if (!ErrorMessageService.instance) {
      ErrorMessageService.instance = new ErrorMessageService();
    }
    return ErrorMessageService.instance;
  }

  /**
   * Get user-friendly error message for any error
   */
  getErrorMessage(error: any, context?: ErrorContext): UserFriendlyError {
    // Handle different error types
    if (error?.response?.status) {
      return this.getHttpErrorMessage(error, context);
    }
    
    if (error?.code) {
      return this.getCodeErrorMessage(error, context);
    }
    
    if (error?.message) {
      return this.getMessageBasedError(error, context);
    }
    
    // Fallback for unknown errors
    return this.getGenericErrorMessage(error, context);
  }

  /**
   * Get user-friendly message for HTTP errors
   */
  private getHttpErrorMessage(error: any, _context?: ErrorContext): UserFriendlyError {
    const status = error.response?.status;
    const url = error.config?.url || '';
    
    switch (status) {
      case 401:
        return {
          title: 'Authentication Required',
          message: 'Your session has expired. Please sign in again to continue.',
          action: 'Sign In',
          severity: 'warning',
          canRetry: true,
          showToUser: true
        };
      
      case 403:
        return {
          title: 'Access Denied',
          message: 'You don\'t have permission to perform this action.',
          action: 'Contact Support',
          severity: 'error',
          canRetry: false,
          showToUser: true
        };
      
      case 404:
        if (url.includes('/auth/')) {
          return {
            title: 'Service Unavailable',
            message: 'Authentication service is temporarily unavailable. Please try again later.',
            action: 'Retry',
            severity: 'warning',
            canRetry: true,
            showToUser: true
          };
        }
        return {
          title: 'Not Found',
          message: 'The requested resource could not be found.',
          action: 'Go Back',
          severity: 'error',
          canRetry: false,
          showToUser: true
        };
      
      case 429:
        return {
          title: 'Too Many Requests',
          message: 'You\'re making requests too quickly. Please wait a moment and try again.',
          action: 'Wait and Retry',
          severity: 'warning',
          canRetry: true,
          showToUser: true
        };
      
      case 500:
      case 502:
      case 503:
      case 504:
        return {
          title: 'Service Temporarily Unavailable',
          message: 'Our servers are experiencing issues. Please try again in a few moments.',
          action: 'Retry',
          severity: 'warning',
          canRetry: true,
          showToUser: true
        };
      
      default:
        return {
          title: 'Request Failed',
          message: 'Something went wrong with your request. Please try again.',
          action: 'Retry',
          severity: 'error',
          canRetry: true,
          showToUser: true
        };
    }
  }

  /**
   * Get user-friendly message for error codes
   */
  private getCodeErrorMessage(error: any, _context?: ErrorContext): UserFriendlyError {
    const code = error.code;
    
    switch (code) {
      case 'auth/user-not-found':
        return {
          title: 'Account Not Found',
          message: 'No account found with this email address.',
          action: 'Sign Up',
          severity: 'error',
          canRetry: false,
          showToUser: true
        };
      
      case 'auth/wrong-password':
        return {
          title: 'Incorrect Password',
          message: 'The password you entered is incorrect. Please try again.',
          action: 'Try Again',
          severity: 'error',
          canRetry: true,
          showToUser: true
        };
      
      case 'auth/email-already-in-use':
        return {
          title: 'Email Already Registered',
          message: 'An account with this email address already exists.',
          action: 'Sign In',
          severity: 'warning',
          canRetry: false,
          showToUser: true
        };
      
      case 'auth/weak-password':
        return {
          title: 'Password Too Weak',
          message: 'Please choose a stronger password with at least 6 characters.',
          action: 'Try Again',
          severity: 'error',
          canRetry: true,
          showToUser: true
        };
      
      case 'auth/invalid-email':
        return {
          title: 'Invalid Email',
          message: 'Please enter a valid email address.',
          action: 'Try Again',
          severity: 'error',
          canRetry: true,
          showToUser: true
        };
      
      case 'auth/too-many-requests':
        return {
          title: 'Too Many Attempts',
          message: 'Too many failed attempts. Please wait a moment before trying again.',
          action: 'Wait and Retry',
          severity: 'warning',
          canRetry: true,
          showToUser: true
        };
      
      case 'auth/network-request-failed':
        return {
          title: 'Network Error',
          message: 'Please check your internet connection and try again.',
          action: 'Retry',
          severity: 'warning',
          canRetry: true,
          showToUser: true
        };
      
      case 'auth/popup-closed-by-user':
        return {
          title: 'Sign-in Cancelled',
          message: 'Sign-in was cancelled. Please try again if you want to continue.',
          action: 'Try Again',
          severity: 'info',
          canRetry: true,
          showToUser: true
        };
      
      case 'auth/popup-blocked':
        return {
          title: 'Popup Blocked',
          message: 'Your browser blocked the sign-in popup. Please allow popups and try again.',
          action: 'Allow Popups and Retry',
          severity: 'warning',
          canRetry: true,
          showToUser: true
        };
      
      case 'NETWORK_ERROR':
        return {
          title: 'Connection Problem',
          message: 'Unable to connect to our servers. Please check your internet connection.',
          action: 'Retry',
          severity: 'warning',
          canRetry: true,
          showToUser: true
        };
      
      case 'TIMEOUT_ERROR':
        return {
          title: 'Request Timeout',
          message: 'The request took too long to complete. Please try again.',
          action: 'Retry',
          severity: 'warning',
          canRetry: true,
          showToUser: true
        };
      
      default:
        return {
          title: 'Authentication Error',
          message: 'An error occurred during authentication. Please try again.',
          action: 'Try Again',
          severity: 'error',
          canRetry: true,
          showToUser: true
        };
    }
  }

  /**
   * Get user-friendly message based on error message content
   */
  private getMessageBasedError(error: any, _context?: ErrorContext): UserFriendlyError {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('connection')) {
      return {
        title: 'Connection Problem',
        message: 'Unable to connect to our servers. Please check your internet connection and try again.',
        action: 'Retry',
        severity: 'warning',
        canRetry: true,
        showToUser: true
      };
    }
    
    if (message.includes('timeout')) {
      return {
        title: 'Request Timeout',
        message: 'The request took too long to complete. Please try again.',
        action: 'Retry',
        severity: 'warning',
        canRetry: true,
        showToUser: true
      };
    }
    
    if (message.includes('unauthorized') || message.includes('authentication')) {
      return {
        title: 'Authentication Required',
        message: 'Please sign in to continue.',
        action: 'Sign In',
        severity: 'warning',
        canRetry: true,
        showToUser: true
      };
    }
    
    if (message.includes('forbidden') || message.includes('permission')) {
      return {
        title: 'Access Denied',
        message: 'You don\'t have permission to perform this action.',
        action: 'Contact Support',
        severity: 'error',
        canRetry: false,
        showToUser: true
      };
    }
    
    if (message.includes('not found') || message.includes('404')) {
      return {
        title: 'Not Found',
        message: 'The requested resource could not be found.',
        action: 'Go Back',
        severity: 'error',
        canRetry: false,
        showToUser: true
      };
    }
    
    if (message.includes('server error') || message.includes('500')) {
      return {
        title: 'Server Error',
        message: 'Our servers are experiencing issues. Please try again later.',
        action: 'Retry Later',
        severity: 'error',
        canRetry: true,
        showToUser: true
      };
    }
    
    // Default message-based error
    return {
      title: 'Something Went Wrong',
      message: 'An unexpected error occurred. Please try again.',
      action: 'Retry',
      severity: 'error',
      canRetry: true,
      showToUser: true
    };
  }

  /**
   * Get generic error message for unknown errors
   */
  private getGenericErrorMessage(error: any, context?: ErrorContext): UserFriendlyError {
    // Check if this is a development error that shouldn't be shown to users
    if (context?.operation === 'development' || 
        (typeof error === 'string' && error.includes('dev'))) {
      return {
        title: 'Development Error',
        message: 'This is a development-only error and will not appear in production.',
        action: 'Continue',
        severity: 'info',
        canRetry: false,
        showToUser: false
      };
    }
    
    return {
      title: 'Unexpected Error',
      message: 'Something unexpected happened. Please try again or contact support if the problem persists.',
      action: 'Retry',
      severity: 'error',
      canRetry: true,
      showToUser: true
    };
  }

  /**
   * Get error message for specific operations
   */
  getOperationErrorMessage(operation: string, error: any, context?: ErrorContext): UserFriendlyError {
    const baseError = this.getErrorMessage(error, context);
    
    // Customize based on operation
    switch (operation) {
      case 'create_object':
        return {
          ...baseError,
          title: 'Failed to Create Object',
          message: baseError.message || 'Unable to create the object. Please try again.',
          action: baseError.action || 'Retry'
        };
      
      case 'update_object':
        return {
          ...baseError,
          title: 'Failed to Update Object',
          message: baseError.message || 'Unable to update the object. Please try again.',
          action: baseError.action || 'Retry'
        };
      
      case 'delete_object':
        return {
          ...baseError,
          title: 'Failed to Delete Object',
          message: baseError.message || 'Unable to delete the object. Please try again.',
          action: baseError.action || 'Retry'
        };
      
      case 'save_canvas':
        return {
          ...baseError,
          title: 'Failed to Save Canvas',
          message: baseError.message || 'Unable to save your canvas. Please try again.',
          action: baseError.action || 'Retry'
        };
      
      case 'load_canvas':
        return {
          ...baseError,
          title: 'Failed to Load Canvas',
          message: baseError.message || 'Unable to load the canvas. Please try again.',
          action: baseError.action || 'Retry'
        };
      
      case 'websocket_connection':
        return {
          ...baseError,
          title: 'Connection Lost',
          message: 'Lost connection to the server. Attempting to reconnect...',
          action: 'Reconnecting...',
          severity: 'warning',
          canRetry: true,
          showToUser: true
        };
      
      default:
        return baseError;
    }
  }

  /**
   * Check if an error should be shown to the user
   */
  shouldShowToUser(error: any, context?: ErrorContext): boolean {
    const errorMessage = this.getErrorMessage(error, context);
    return errorMessage.showToUser;
  }

  /**
   * Get a simple error message string
   */
  getSimpleErrorMessage(error: any, context?: ErrorContext): string {
    const errorMessage = this.getErrorMessage(error, context);
    return errorMessage.message;
  }

  /**
   * Get error title
   */
  getErrorTitle(error: any, context?: ErrorContext): string {
    const errorMessage = this.getErrorMessage(error, context);
    return errorMessage.title;
  }
}

// Export singleton instance
export const errorMessageService = ErrorMessageService.getInstance();

// Convenience functions
export const getUserFriendlyError = (error: any, context?: ErrorContext) => 
  errorMessageService.getErrorMessage(error, context);

export const getOperationError = (operation: string, error: any, context?: ErrorContext) => 
  errorMessageService.getOperationErrorMessage(operation, error, context);

export const getSimpleError = (error: any, context?: ErrorContext) => 
  errorMessageService.getSimpleErrorMessage(error, context);

export const getErrorTitle = (error: any, context?: ErrorContext) => 
  errorMessageService.getErrorTitle(error, context);

export const shouldShowError = (error: any, context?: ErrorContext) => 
  errorMessageService.shouldShowToUser(error, context);

// Export the service class
export default errorMessageService;
