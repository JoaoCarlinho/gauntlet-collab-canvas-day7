/**
 * Version tracking and cache busting utilities
 * This file helps ensure users always get the latest version of the app
 */

// Version info - injected at build time via Vite's define
export const APP_VERSION = __APP_VERSION__
export const BUILD_TIME = __BUILD_TIME__
export const GIT_COMMIT = __GIT_COMMIT__

export interface VersionInfo {
  version: string
  buildTime: string
  gitCommit: string
  isDevelopment: boolean
}

/**
 * Get current app version info
 */
export function getVersionInfo(): VersionInfo {
  return {
    version: APP_VERSION,
    buildTime: BUILD_TIME,
    gitCommit: GIT_COMMIT,
    isDevelopment: import.meta.env.DEV
  }
}

/**
 * Check if a new version is available
 */
export async function checkForNewVersion(): Promise<boolean> {
  try {
    // Fetch version info from server with cache-busting query param
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    })

    if (!response.ok) {
      console.warn('Could not fetch version info')
      return false
    }

    const serverVersion: VersionInfo = await response.json()
    const currentVersion = getVersionInfo()

    // Compare build times
    if (serverVersion.buildTime !== currentVersion.buildTime) {
      console.log('New version detected:', {
        current: currentVersion.buildTime,
        server: serverVersion.buildTime
      })
      return true
    }

    return false
  } catch (error) {
    console.error('Error checking for new version:', error)
    return false
  }
}

/**
 * Force reload the app to get the latest version
 */
export function reloadToLatestVersion(): void {
  // Clear all caches before reloading
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name))
    })
  }

  // Unregister service workers
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => registration.unregister())
    })
  }

  // Clear session storage
  sessionStorage.clear()

  // Hard reload with cache bypass
  window.location.reload()
}

/**
 * Prompt user to reload if new version available
 */
export async function promptForUpdate(onUpdate?: () => void): Promise<void> {
  const hasUpdate = await checkForNewVersion()

  if (hasUpdate) {
    const shouldUpdate = window.confirm(
      'A new version of the app is available. Would you like to reload to get the latest features and fixes?'
    )

    if (shouldUpdate) {
      if (onUpdate) onUpdate()
      reloadToLatestVersion()
    }
  }
}

/**
 * Set up automatic version checking
 */
export function setupVersionChecking(intervalMinutes: number = 5): () => void {
  console.log(`Setting up version checking every ${intervalMinutes} minutes`)

  const intervalMs = intervalMinutes * 60 * 1000
  const intervalId = setInterval(async () => {
    const hasUpdate = await checkForNewVersion()
    if (hasUpdate) {
      // Show subtle notification instead of prompt
      console.log('New version available. User will be prompted on next interaction.')

      // Optionally show a toast notification
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('app:new-version', {
          detail: { version: getVersionInfo() }
        }))
      }
    }
  }, intervalMs)

  // Return cleanup function
  return () => clearInterval(intervalId)
}

/**
 * Log version info to console
 */
export function logVersionInfo(): void {
  const info = getVersionInfo()
  console.log('%c App Version Info ', 'background: #4CAF50; color: white; padding: 2px 5px; border-radius: 3px')
  console.log('Version:', info.version)
  console.log('Build Time:', info.buildTime)
  console.log('Git Commit:', info.gitCommit)
  console.log('Environment:', info.isDevelopment ? 'Development' : 'Production')
}
