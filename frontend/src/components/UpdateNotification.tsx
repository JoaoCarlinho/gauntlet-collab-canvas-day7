/**
 * Component to display update notifications when a new version is available
 */

import { useVersionCheck } from '../hooks/useVersionCheck'

export interface UpdateNotificationProps {
  /**
   * Position of the notification
   * @default 'bottom-right'
   */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

  /**
   * Whether to auto-prompt with dialog
   * @default false (show banner instead)
   */
  autoPrompt?: boolean
}

export function UpdateNotification({ position = 'bottom-right', autoPrompt = false }: UpdateNotificationProps) {
  const { updateAvailable, reload } = useVersionCheck({
    checkIntervalMinutes: 5,
    autoPrompt,
    checkOnMount: true,
    logVersion: true
  })

  if (!updateAvailable) {
    return null
  }

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  }

  return (
    <div
      className={`fixed ${positionClasses[position]} z-50 max-w-md animate-slide-up`}
      role="alert"
      aria-live="polite"
    >
      <div className="bg-blue-600 text-white rounded-lg shadow-lg p-4 flex items-start space-x-3">
        <div className="flex-shrink-0">
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-sm">Update Available</h3>
          <p className="text-sm mt-1 opacity-90">
            A new version is available with important fixes and improvements.
          </p>
          <button
            onClick={reload}
            className="mt-3 bg-white text-blue-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-50 transition-colors"
          >
            Update Now
          </button>
        </div>
        <button
          onClick={() => {
            const event = new CustomEvent('app:dismiss-update')
            window.dispatchEvent(event)
          }}
          className="flex-shrink-0 text-white hover:text-blue-200"
          aria-label="Dismiss"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
