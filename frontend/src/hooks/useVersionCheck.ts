/**
 * React hook for version checking and automatic update prompts
 */

import { useEffect, useState, useCallback } from 'react'
import {
  checkForNewVersion,
  reloadToLatestVersion,
  setupVersionChecking,
  logVersionInfo
} from '../utils/version'

export interface UseVersionCheckOptions {
  /**
   * How often to check for new version (in minutes)
   * @default 5
   */
  checkIntervalMinutes?: number

  /**
   * Whether to automatically prompt user for update
   * @default true
   */
  autoPrompt?: boolean

  /**
   * Whether to check on mount
   * @default true
   */
  checkOnMount?: boolean

  /**
   * Whether to log version info to console
   * @default true in development
   */
  logVersion?: boolean

  /**
   * Custom callback when update is available
   */
  onUpdateAvailable?: () => void

  /**
   * Custom callback before reload
   */
  onBeforeReload?: () => void
}

export interface UseVersionCheckResult {
  /**
   * Whether an update is available
   */
  updateAvailable: boolean

  /**
   * Check for updates manually
   */
  checkNow: () => Promise<void>

  /**
   * Reload to get the latest version
   */
  reload: () => void

  /**
   * Whether currently checking for updates
   */
  isChecking: boolean
}

/**
 * Hook to check for app version updates and prompt user to reload
 *
 * @example
 * ```tsx
 * function App() {
 *   const { updateAvailable, reload } = useVersionCheck({
 *     checkIntervalMinutes: 5,
 *     autoPrompt: true
 *   })
 *
 *   return (
 *     <div>
 *       {updateAvailable && (
 *         <button onClick={reload}>Update Available - Click to Reload</button>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 */
export function useVersionCheck(options: UseVersionCheckOptions = {}): UseVersionCheckResult {
  const {
    checkIntervalMinutes = 5,
    autoPrompt = true,
    checkOnMount = true,
    logVersion = import.meta.env.DEV,
    onUpdateAvailable,
    onBeforeReload
  } = options

  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [isChecking, setIsChecking] = useState(false)

  const checkNow = useCallback(async () => {
    if (isChecking) return

    setIsChecking(true)
    try {
      const hasUpdate = await checkForNewVersion()
      setUpdateAvailable(hasUpdate)

      if (hasUpdate) {
        console.log('✨ New version available!')
        onUpdateAvailable?.()

        if (autoPrompt) {
          const shouldUpdate = window.confirm(
            'A new version of the app is available with important fixes and improvements.\n\n' +
            'Would you like to reload now to get the latest version?\n\n' +
            '(Any unsaved changes will be lost)'
          )

          if (shouldUpdate) {
            onBeforeReload?.()
            reloadToLatestVersion()
          }
        }
      }
    } catch (error) {
      console.error('Error checking for version update:', error)
    } finally {
      setIsChecking(false)
    }
  }, [isChecking, autoPrompt, onUpdateAvailable, onBeforeReload])

  const reload = useCallback(() => {
    onBeforeReload?.()
    reloadToLatestVersion()
  }, [onBeforeReload])

  // Log version info on mount
  useEffect(() => {
    if (logVersion) {
      logVersionInfo()
    }
  }, [logVersion])

  // Check for updates on mount
  useEffect(() => {
    if (checkOnMount) {
      // Small delay to avoid blocking initial render
      const timer = setTimeout(() => {
        checkNow()
      }, 3000)

      return () => clearTimeout(timer)
    }
  }, [checkOnMount, checkNow])

  // Set up periodic version checking
  useEffect(() => {
    if (checkIntervalMinutes > 0) {
      const cleanup = setupVersionChecking(checkIntervalMinutes)
      return cleanup
    }
  }, [checkIntervalMinutes])

  // Listen for custom version update events
  useEffect(() => {
    const handleVersionEvent = (event: Event) => {
      const customEvent = event as CustomEvent
      console.log('Version update event received:', customEvent.detail)
      setUpdateAvailable(true)
    }

    window.addEventListener('app:new-version', handleVersionEvent)
    return () => window.removeEventListener('app:new-version', handleVersionEvent)
  }, [])

  // Check for updates when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isChecking) {
        checkNow()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [checkNow, isChecking])

  return {
    updateAvailable,
    checkNow,
    reload,
    isChecking
  }
}
