/**
 * Token Optimization Service
 * Handles Firebase token validation, optimization, and refresh for socket connections.
 */

import { authService } from './authService'
import { canvasAPI } from './api'

export interface TokenValidationResult {
  isValid: boolean
  hasIssues: boolean
  issues: string[]
  tokenSize: number
  recommendations: string[]
  optimizationApplied: boolean
}

export interface TokenRefreshResult {
  refreshSuccessful: boolean
  oldTokenAnalysis: any
  newTokenAnalysis: any
  refreshImpact: any
  recommendations: string[]
  optimizationApplied: boolean
}

class TokenOptimizationService {
  private tokenCache = new Map<string, { result: TokenValidationResult; timestamp: number }>()
  private refreshInProgress = false
  private validationStats = {
    tokensValidated: 0,
    cacheHits: 0,
    validationFailures: 0,
    optimizationApplied: 0
  }

  /**
   * Validate a token for socket usage
   */
  async validateTokenForSocket(token: string, userId: string = 'unknown'): Promise<TokenValidationResult> {
    try {
      // Check cache first (5 minute cache)
      const cacheKey = `${userId}:${this.hashToken(token)}`
      const cached = this.tokenCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < 300000) {
        this.validationStats.cacheHits++
        console.log('Token cache hit for user:', userId)
        return cached.result
      }

      // Validate token locally first
      const localValidation = this.validateTokenLocally(token)
      
      // If local validation passes, validate with backend
      if (localValidation.isValid) {
        try {
          const backendValidation = await this.validateTokenWithBackend(token, userId)
          if (backendValidation.isValid) {
            // Cache the result
            this.tokenCache.set(cacheKey, {
              result: backendValidation,
              timestamp: Date.now()
            })
            
            this.validationStats.tokensValidated++
            return backendValidation
          } else {
            this.validationStats.validationFailures++
            return backendValidation
          }
        } catch (error) {
          console.warn('Backend token validation failed, using local validation:', error)
          this.validationStats.validationFailures++
          return localValidation
        }
      } else {
        this.validationStats.validationFailures++
        return localValidation
      }
    } catch (error) {
      console.error('Token validation failed:', error)
      this.validationStats.validationFailures++
      return {
        isValid: false,
        hasIssues: true,
        issues: [`Validation error: ${error}`],
        tokenSize: 0,
        recommendations: ['Fix token validation error'],
        optimizationApplied: false
      }
    }
  }

  /**
   * Validate token locally without backend call
   */
  private validateTokenLocally(token: string): TokenValidationResult {
    const issues: string[] = []
    let isValid = true

    // Basic token format validation
    if (!token || typeof token !== 'string') {
      issues.push('Token is empty or not a string')
      isValid = false
    } else if (token.length < 100) {
      issues.push('Token too short (likely invalid)')
      isValid = false
    } else if (token.length > 10000) {
      issues.push('Token unusually long')
      isValid = false
    }

    // Check for problematic characters
    if (token) {
      for (let i = 0; i < token.length; i++) {
        const char = token[i]
        const charCode = token.charCodeAt(i)
        
        if (charCode < 32 && !['\t', '\n', '\r'].includes(char)) {
          issues.push('Token contains control characters')
          isValid = false
          break
        } else if (charCode > 127) {
          issues.push('Token contains non-ASCII characters')
          isValid = false
          break
        }
      }
    }

    // Test JSON serialization
    try {
      JSON.stringify({ id_token: token })
    } catch (error) {
      issues.push(`Token serialization failed: ${error}`)
      isValid = false
    }

    const tokenSize = token ? new Blob([token]).size : 0
    const recommendations = this.generateRecommendations(issues)

    return {
      isValid,
      hasIssues: issues.length > 0,
      issues,
      tokenSize,
      recommendations,
      optimizationApplied: false
    }
  }

  /**
   * Validate token with backend
   */
  private async validateTokenWithBackend(token: string, userId: string): Promise<TokenValidationResult> {
    try {
      const response = await canvasAPI.post('/api/token-analysis/validate', {
        token,
        user_id: userId
      })

      if (response.data.status === 'success') {
        return response.data.validation
      } else {
        throw new Error(response.data.message || 'Backend validation failed')
      }
    } catch (error) {
      throw new Error(`Backend validation error: ${error}`)
    }
  }

  /**
   * Optimize a socket message containing a token
   */
  async optimizeSocketMessageWithToken(message: Record<string, any>, token: string, userId: string = 'unknown'): Promise<Record<string, any>> {
    try {
      // Validate token first
      const tokenValidation = await this.validateTokenForSocket(token, userId)
      
      // Create optimized message
      const optimizedMessage = { ...message }
      
      // Apply token-specific optimizations
      if (tokenValidation.hasIssues) {
        optimizedMessage._tokenIssues = tokenValidation.issues
        optimizedMessage._tokenOptimizationApplied = true
      }
      
      // Ensure token is properly formatted in message
      if ('id_token' in optimizedMessage) {
        optimizedMessage.id_token = token
      }
      
      // Add token metadata for debugging
      optimizedMessage._tokenMetadata = {
        size: tokenValidation.tokenSize,
        validatedAt: Date.now(),
        hasIssues: tokenValidation.hasIssues
      }
      
      console.log('Socket message optimized for user:', userId)
      return optimizedMessage
      
    } catch (error) {
      console.error('Socket message optimization failed:', error)
      return message // Return original message if optimization fails
    }
  }

  /**
   * Handle token refresh
   */
  async handleTokenRefresh(oldToken: string, newToken: string, userId: string = 'unknown'): Promise<TokenRefreshResult> {
    try {
      if (this.refreshInProgress) {
        throw new Error('Token refresh already in progress')
      }

      this.refreshInProgress = true

      // Clear old token from cache
      const oldCacheKey = `${userId}:${this.hashToken(oldToken)}`
      this.tokenCache.delete(oldCacheKey)

      // Validate new token
      const newTokenValidation = await this.validateTokenForSocket(newToken, userId)

      // Analyze refresh impact
      const oldTokenSize = new Blob([oldToken]).size
      const newTokenSize = newTokenValidation.tokenSize
      const sizeChange = newTokenSize - oldTokenSize
      const sizeChangePercent = oldTokenSize > 0 ? (sizeChange / oldTokenSize) * 100 : 0

      const refreshResult: TokenRefreshResult = {
        refreshSuccessful: newTokenValidation.isValid,
        oldTokenAnalysis: {
          tokenSize: oldTokenSize,
          isValid: true // Assume old token was valid if we're refreshing
        },
        newTokenAnalysis: newTokenValidation,
        refreshImpact: {
          sizeChange,
          sizeChangePercent,
          oldHasIssues: false,
          newHasIssues: newTokenValidation.hasIssues
        },
        recommendations: newTokenValidation.recommendations,
        optimizationApplied: newTokenValidation.optimizationApplied
      }

      // Add refresh-specific recommendations
      if (sizeChangePercent > 50) {
        refreshResult.recommendations.push('Token size increased significantly during refresh')
      }

      if (newTokenValidation.hasIssues) {
        refreshResult.recommendations.push('New token introduced parse issues')
      }

      console.log('Token refresh handled for user:', userId)
      return refreshResult

    } catch (error) {
      console.error('Token refresh handling failed:', error)
      return {
        refreshSuccessful: false,
        oldTokenAnalysis: { error: String(error) },
        newTokenAnalysis: { error: String(error) },
        refreshImpact: { error: String(error) },
        recommendations: ['Fix token refresh error'],
        optimizationApplied: false
      }
    } finally {
      this.refreshInProgress = false
    }
  }

  /**
   * Get current token and validate it
   */
  async getValidatedCurrentToken(): Promise<{ token: string; validation: TokenValidationResult } | null> {
    try {
      const token = await authService.getValidToken()
      if (!token) {
        return null
      }

      const validation = await this.validateTokenForSocket(token)
      return { token, validation }
    } catch (error) {
      console.error('Failed to get validated current token:', error)
      return null
    }
  }

  /**
   * Refresh token if needed
   */
  async refreshTokenIfNeeded(): Promise<{ token: string; refreshed: boolean } | null> {
    try {
      const currentToken = await authService.getValidToken()
      if (!currentToken) {
        return null
      }

      // Check if token needs refresh
      const validation = await this.validateTokenForSocket(currentToken)
      if (validation.isValid && !validation.hasIssues) {
        return { token: currentToken, refreshed: false }
      }

      // Try to refresh token
      const newToken = await authService.publicRefreshToken()
      if (newToken && newToken !== currentToken) {
        const refreshResult = await this.handleTokenRefresh(currentToken, newToken)
        return { 
          token: newToken, 
          refreshed: refreshResult.refreshSuccessful 
        }
      }

      return { token: currentToken, refreshed: false }
    } catch (error) {
      console.error('Token refresh failed:', error)
      return null
    }
  }

  /**
   * Generate recommendations based on issues
   */
  private generateRecommendations(issues: string[]): string[] {
    const recommendations: string[] = []

    for (const issue of issues) {
      if (issue.includes('too short')) {
        recommendations.push('Token appears to be invalid or corrupted')
      } else if (issue.includes('unusually long')) {
        recommendations.push('Consider token refresh to get a shorter token')
      } else if (issue.includes('control characters')) {
        recommendations.push('Token contains invalid characters, refresh required')
      } else if (issue.includes('non-ASCII')) {
        recommendations.push('Token contains non-ASCII characters, refresh required')
      } else if (issue.includes('serialization failed')) {
        recommendations.push('Token cannot be serialized, refresh required')
      }
    }

    return recommendations
  }

  /**
   * Hash token for cache key
   */
  private hashToken(token: string): string {
    let hash = 0
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString()
  }

  /**
   * Clear token cache
   */
  clearTokenCache(userId?: string): void {
    if (userId) {
      // Clear cache entries for specific user
      const keysToDelete: string[] = []
      for (const key of this.tokenCache.keys()) {
        if (key.startsWith(`${userId}:`)) {
          keysToDelete.push(key)
        }
      }
      keysToDelete.forEach(key => this.tokenCache.delete(key))
      console.log('Token cache cleared for user:', userId)
    } else {
      // Clear entire cache
      this.tokenCache.clear()
      console.log('Token cache cleared for all users')
    }
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats() {
    const cacheSize = this.tokenCache.size
    const totalRequests = this.validationStats.tokensValidated
    const cacheHitRate = totalRequests > 0 ? this.validationStats.cacheHits / totalRequests : 0
    const validationSuccessRate = totalRequests > 0 ? 1 - (this.validationStats.validationFailures / totalRequests) : 1

    return {
      ...this.validationStats,
      cacheSize,
      cacheHitRate,
      validationSuccessRate,
      optimizationRate: totalRequests > 0 ? this.validationStats.optimizationApplied / totalRequests : 0
    }
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.validationStats = {
      tokensValidated: 0,
      cacheHits: 0,
      validationFailures: 0,
      optimizationApplied: 0
    }
    this.tokenCache.clear()
    console.log('Token optimization statistics reset')
  }
}

export const tokenOptimizationService = new TokenOptimizationService()
