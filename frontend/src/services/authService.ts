/**
 * Enhanced Authentication Service with Robust Token Validation and Automatic Refresh
 */

import { auth, refreshFirebaseToken, isUserAuthenticated } from './firebase'
import { errorLogger } from '../utils/errorLogger'

export interface TokenValidationResult {
  isValid: boolean
  needsRefresh: boolean
  token: string | null
  error?: string
  expiresAt?: number
}

export interface AuthState {
  isAuthenticated: boolean
  user: any | null
  token: string | null
  lastValidation: number
  validationAttempts: number
  userId: string | null
  userRecoveryAttempts: number
}

class AuthService {
  private authState: AuthState = {
    isAuthenticated: false,
    user: null,
    token: null,
    lastValidation: 0,
    validationAttempts: 0,
    userId: null,
    userRecoveryAttempts: 0
  }

  private refreshInterval: NodeJS.Timeout | null = null
  private validationTimeout: NodeJS.Timeout | null = null
  private readonly REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes
  private readonly MAX_VALIDATION_ATTEMPTS = 3
  private readonly MAX_USER_RECOVERY_ATTEMPTS = 5

  constructor() {
    this.initializeAuthMonitoring()
  }

  /**
   * Initialize authentication monitoring and automatic refresh
   */
  private initializeAuthMonitoring(): void {
    // Start periodic token refresh
    this.startTokenRefresh()
    
    // Monitor auth state changes
    if (auth && auth.onAuthStateChanged) {
      auth.onAuthStateChanged((user: any) => {
        this.handleAuthStateChange(user)
      })
    }

    // Monitor visibility changes to refresh token when user returns
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.authState.isAuthenticated) {
        this.validateAndRefreshToken()
      }
    })

    // Monitor focus events for token refresh
    window.addEventListener('focus', () => {
      if (this.authState.isAuthenticated) {
        this.validateAndRefreshToken()
      }
    })
  }

  /**
   * Handle authentication state changes
   */
  private handleAuthStateChange(user: any): void {
    console.log('Auth state changed:', { 
      hasUser: !!user, 
      userId: user?.uid,
      email: user?.email 
    })

    if (user) {
      this.authState.user = user
      this.authState.userId = user.uid
      this.authState.isAuthenticated = true
      this.authState.userRecoveryAttempts = 0
      localStorage.setItem('userId', user.uid)
      this.validateAndRefreshToken()
    } else {
      this.authState.user = null
      this.authState.userId = null
      this.authState.isAuthenticated = false
      this.authState.token = null
      this.stopTokenRefresh()
      localStorage.removeItem('idToken')
      localStorage.removeItem('userId')
    }
  }

  /**
   * Start automatic token refresh
   */
  private startTokenRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
    }

    this.refreshInterval = setInterval(() => {
      if (this.authState.isAuthenticated) {
        this.validateAndRefreshToken()
      }
    }, this.REFRESH_INTERVAL)
  }

  /**
   * Stop automatic token refresh
   */
  private stopTokenRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
      this.refreshInterval = null
    }
  }

  /**
   * Validate current token and refresh if needed
   */
  public async validateAndRefreshToken(): Promise<TokenValidationResult> {
    try {
      // Check if we're in development mode
      const isDevelopment = import.meta.env.DEV || 
                           import.meta.env.VITE_DEBUG_MODE === 'true' ||
                           window.location.hostname === 'localhost' ||
                           window.location.hostname === '127.0.0.1'

      if (isDevelopment) {
        return this.handleDevelopmentMode()
      }

      // Check if user is authenticated
      if (!isUserAuthenticated()) {
        return {
          isValid: false,
          needsRefresh: false,
          token: null,
          error: 'User not authenticated'
        }
      }

      // Get current token from localStorage
      const currentToken = localStorage.getItem('idToken')
      if (!currentToken) {
        return {
          isValid: false,
          needsRefresh: true,
          token: null,
          error: 'No token found in localStorage'
        }
      }

      // Validate token format and expiration
      const validationResult = await this.validateTokenFormat(currentToken)
      if (!validationResult.isValid) {
        return validationResult
      }

      // Check if token needs refresh (expires within 10 minutes)
      const needsRefresh = this.shouldRefreshToken(validationResult.expiresAt)
      if (needsRefresh) {
        return await this.refreshToken()
      }

      // Token is valid and doesn't need refresh
      this.authState.token = currentToken
      this.authState.lastValidation = Date.now()
      this.authState.validationAttempts = 0

      return {
        isValid: true,
        needsRefresh: false,
        token: currentToken,
        expiresAt: validationResult.expiresAt
      }

    } catch (error) {
      console.error('Token validation error:', error)
      errorLogger.logError('Token validation failed', {
        operation: 'general',
        additionalData: { error: error instanceof Error ? error.message : 'Unknown error', authState: this.authState },
        timestamp: Date.now()
      })

      return {
        isValid: false,
        needsRefresh: true,
        token: null,
        error: error instanceof Error ? error.message : 'Token validation failed'
      }
    }
  }

  /**
   * Handle development mode authentication
   */
  private handleDevelopmentMode(): TokenValidationResult {
    const devToken = localStorage.getItem('idToken') || 'dev-token'
    return {
      isValid: true,
      needsRefresh: false,
      token: devToken,
      expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour from now
    }
  }

  /**
   * Validate token format and extract expiration
   */
  private async validateTokenFormat(token: string): Promise<TokenValidationResult> {
    try {
      // Basic JWT format validation
      const parts = token.split('.')
      if (parts.length !== 3) {
        return {
          isValid: false,
          needsRefresh: true,
          token: null,
          error: 'Invalid token format'
        }
      }

      // Decode payload to check expiration
      const payload = JSON.parse(atob(parts[1]))
      const expiresAt = payload.exp * 1000 // Convert to milliseconds
      const now = Date.now()

      if (expiresAt <= now) {
        return {
          isValid: false,
          needsRefresh: true,
          token: null,
          error: 'Token has expired',
          expiresAt
        }
      }

      return {
        isValid: true,
        needsRefresh: false,
        token,
        expiresAt
      }

    } catch (error) {
      return {
        isValid: false,
        needsRefresh: true,
        token: null,
        error: 'Token format validation failed'
      }
    }
  }

  /**
   * Check if token should be refreshed
   */
  private shouldRefreshToken(expiresAt?: number): boolean {
    if (!expiresAt) return true
    
    const now = Date.now()
    const refreshThreshold = 10 * 60 * 1000 // 10 minutes
    return (expiresAt - now) < refreshThreshold
  }

  /**
   * Refresh the authentication token
   */
  private async refreshToken(): Promise<TokenValidationResult> {
    try {
      console.log('Refreshing authentication token...')
      
      const newToken = await refreshFirebaseToken()
      if (newToken) {
        localStorage.setItem('idToken', newToken)
        this.authState.token = newToken
        this.authState.lastValidation = Date.now()
        this.authState.validationAttempts = 0

        console.log('Token refreshed successfully')
        return {
          isValid: true,
          needsRefresh: false,
          token: newToken
        }
      } else {
        throw new Error('Failed to refresh token')
      }

    } catch (error) {
      console.error('Token refresh failed:', error)
      this.authState.validationAttempts++

      // If we've exceeded max attempts, mark as invalid
      if (this.authState.validationAttempts >= this.MAX_VALIDATION_ATTEMPTS) {
        this.authState.isAuthenticated = false
        this.authState.token = null
        localStorage.removeItem('idToken')
      }

      return {
        isValid: false,
        needsRefresh: false,
        token: null,
        error: error instanceof Error ? error.message : 'Token refresh failed'
      }
    }
  }

  /**
   * Get current authentication state
   */
  public getAuthState(): AuthState {
    return { ...this.authState }
  }

  /**
   * Get current valid token
   */
  public async getValidToken(): Promise<string | null> {
    const validation = await this.validateAndRefreshToken()
    return validation.isValid ? validation.token : null
  }

  /**
   * Force token refresh
   */
  public async forceTokenRefresh(): Promise<TokenValidationResult> {
    this.authState.validationAttempts = 0
    return await this.refreshToken()
  }

  /**
   * Public method to refresh authentication token
   * @returns Promise<string | null> - The new token or null if refresh failed
   */
  public async publicRefreshToken(): Promise<string | null> {
    try {
      const result = await this.refreshToken()
      return result.isValid ? result.token : null
    } catch (error) {
      console.error('Public token refresh failed:', error)
      return null
    }
  }

  /**
   * Check if user has valid authentication
   */
  public async isAuthenticated(): Promise<boolean> {
    const validation = await this.validateAndRefreshToken()
    return validation.isValid
  }

  /**
   * Get user information
   */
  public getUser(): any | null {
    return this.authState.user
  }

  /**
   * Validate and recover user ID
   */
  public async validateAndRecoverUserId(): Promise<{ isValid: boolean; userId: string | null; error?: string }> {
    try {
      // Check if we already have a valid user ID
      if (this.authState.userId && this.authState.user) {
        return {
          isValid: true,
          userId: this.authState.userId
        }
      }

      // Try to recover from Firebase auth state
      if (auth && auth.currentUser) {
        const currentUser = auth.currentUser
        this.authState.user = currentUser
        this.authState.userId = currentUser.uid
        this.authState.isAuthenticated = true
        this.authState.userRecoveryAttempts = 0

        console.log('User ID recovered from Firebase auth state:', currentUser.uid)
        return {
          isValid: true,
          userId: currentUser.uid
        }
      }

      // Try to recover from localStorage
      const storedUserId = localStorage.getItem('userId')
      if (storedUserId) {
        // Validate the stored user ID by checking if we can get a token
        const tokenValidation = await this.validateAndRefreshToken()
        if (tokenValidation.isValid) {
          this.authState.userId = storedUserId
          console.log('User ID recovered from localStorage:', storedUserId)
          return {
            isValid: true,
            userId: storedUserId
          }
        }
      }

      // If all recovery attempts fail
      this.authState.userRecoveryAttempts++
      if (this.authState.userRecoveryAttempts >= this.MAX_USER_RECOVERY_ATTEMPTS) {
        console.error('Max user recovery attempts exceeded')
        return {
          isValid: false,
          userId: null,
          error: 'Unable to recover user ID after multiple attempts'
        }
      }

      return {
        isValid: false,
        userId: null,
        error: 'User ID not found and recovery failed'
      }

    } catch (error) {
      console.error('User ID validation error:', error)
      this.authState.userRecoveryAttempts++
      
      return {
        isValid: false,
        userId: null,
        error: error instanceof Error ? error.message : 'User ID validation failed'
      }
    }
  }

  /**
   * Get current user ID with validation
   */
  public async getCurrentUserId(): Promise<string | null> {
    const validation = await this.validateAndRecoverUserId()
    return validation.isValid ? validation.userId : null
  }

  /**
   * Check if user ID is valid
   */
  public async isUserIdValid(): Promise<boolean> {
    const validation = await this.validateAndRecoverUserId()
    return validation.isValid
  }

  /**
   * Clear authentication state
   */
  public clearAuth(): void {
    this.authState = {
      isAuthenticated: false,
      user: null,
      token: null,
      lastValidation: 0,
      validationAttempts: 0,
      userId: null,
      userRecoveryAttempts: 0
    }
    this.stopTokenRefresh()
    localStorage.removeItem('idToken')
    localStorage.removeItem('userId')
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stopTokenRefresh()
    if (this.validationTimeout) {
      clearTimeout(this.validationTimeout)
    }
  }
}

// Export singleton instance
export const authService = new AuthService()

// Export service
export { AuthService }
