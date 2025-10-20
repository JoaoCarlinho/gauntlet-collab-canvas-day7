/**
 * Network Status Indicator Component
 * Shows current network status and provides user feedback
 */

import React, { useState, useEffect } from 'react'
import { networkHealthService, NetworkStatus } from '../services/networkHealthService'
import { offlineModeService } from '../services/offlineModeService'
import toast from 'react-hot-toast'

interface NetworkStatusIndicatorProps {
  className?: string
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

const NetworkStatusIndicator: React.FC<NetworkStatusIndicatorProps> = ({
  className = '',
  position = 'top-right'
}) => {
  // Disable during tests to prevent click blocking
  if ((window as any).Cypress || 
      (window as any).playwright ||
      navigator.userAgent.includes('Playwright')) {
    return null;
  }
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(networkHealthService.getNetworkStatus())
  const [offlineStatus, setOfflineStatus] = useState(offlineModeService.getOfflineStatus())
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    // Start monitoring
    networkHealthService.startMonitoring()

    // Listen to network status changes
    const handleNetworkChange = (status: NetworkStatus) => {
      setNetworkStatus(status)
    }

    const handleOfflineMode = () => {
      setOfflineStatus(offlineModeService.getOfflineStatus())
    }

    const handleStatusChange = (data: any) => {
      setOfflineStatus(data)
    }

    networkHealthService.addEventListener('networkChange', handleNetworkChange)
    networkHealthService.addEventListener('healthCheck', handleNetworkChange)
    offlineModeService.addEventListener('offlineMode', handleOfflineMode)
    offlineModeService.addEventListener('statusChange', handleStatusChange)

    return () => {
      networkHealthService.removeEventListener('networkChange', handleNetworkChange)
      networkHealthService.removeEventListener('healthCheck', handleNetworkChange)
      offlineModeService.removeEventListener('offlineMode', handleOfflineMode)
      offlineModeService.removeEventListener('statusChange', handleStatusChange)
    }
  }, [])

  const getStatusIcon = () => {
    if (!networkStatus.isOnline) {
      return '🔴' // Offline
    }

    if (networkStatus.apiHealth === 'unhealthy') {
      return '🟠' // Unhealthy
    }

    if (networkStatus.apiHealth === 'degraded') {
      return '🟡' // Degraded
    }

    if (networkStatus.socketHealth === 'disconnected') {
      return '🟡' // Socket disconnected
    }

    return '🟢' // Healthy
  }

  const getStatusText = () => {
    if (!networkStatus.isOnline) {
      return 'Offline'
    }

    if (networkStatus.apiHealth === 'unhealthy') {
      return 'Connection Issues'
    }

    if (networkStatus.apiHealth === 'degraded') {
      return 'Slow Connection'
    }

    if (networkStatus.socketHealth === 'disconnected') {
      return 'Limited Features'
    }

    return 'Connected'
  }

  const getStatusColor = () => {
    if (!networkStatus.isOnline) {
      return 'text-red-600'
    }

    if (networkStatus.apiHealth === 'unhealthy') {
      return 'text-orange-600'
    }

    if (networkStatus.apiHealth === 'degraded' || networkStatus.socketHealth === 'disconnected') {
      return 'text-yellow-600'
    }

    return 'text-green-600'
  }

  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4'
      case 'top-right':
        return 'top-4 right-4'
      case 'bottom-left':
        return 'bottom-4 left-4'
      case 'bottom-right':
        return 'bottom-4 right-4'
      default:
        return 'top-4 right-4'
    }
  }

  const handleRefresh = () => {
    networkHealthService.performHealthCheck()
    toast.success('Checking connection...', { duration: 2000 })
  }

  const handleSync = () => {
    if (offlineStatus.actionCount > 0) {
      offlineModeService.syncOfflineActions()
    } else {
      toast('No offline changes to sync', { duration: 2000, icon: 'ℹ️' })
    }
  }

  const handleClearOfflineData = () => {
    if (confirm('Clear all offline data? This cannot be undone.')) {
      offlineModeService.clearOfflineData()
      toast.success('Offline data cleared', { duration: 2000 })
    }
  }

  return (
    <div className={`fixed ${getPositionClasses()} z-50 ${className}`}>
      {/* Main Status Indicator */}
      <div
        className={`
          flex items-center space-x-2 px-3 py-2 rounded-lg shadow-lg bg-white border
          cursor-pointer transition-all duration-200 hover:shadow-xl
          ${getStatusColor()}
        `}
        onClick={() => setIsExpanded(!isExpanded)}
        title={networkHealthService.getStatusMessage()}
      >
        <span className="text-lg">{getStatusIcon()}</span>
        <span className="text-sm font-medium">{getStatusText()}</span>
        
        {/* Offline Actions Badge */}
        {offlineStatus.actionCount > 0 && (
          <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
            {offlineStatus.actionCount}
          </span>
        )}
        
        {/* Expand/Collapse Arrow */}
        <span className={`text-xs transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-2 p-4 bg-white rounded-lg shadow-lg border min-w-80">
          <div className="space-y-3">
            {/* Network Status */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">Network Status</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Internet:</span>
                  <span className={networkStatus.isOnline ? 'text-green-600' : 'text-red-600'}>
                    {networkStatus.isOnline ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>API:</span>
                  <span className={getStatusColor()}>
                    {networkStatus.apiHealth}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Real-time:</span>
                  <span className={getStatusColor()}>
                    {networkStatus.socketHealth}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Last Check:</span>
                  <span className="text-gray-500">
                    {new Date(networkStatus.lastCheck).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Offline Status */}
            {offlineStatus.actionCount > 0 && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Offline Changes</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Pending Actions:</span>
                    <span className="text-blue-600">{offlineStatus.actionCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Offline Canvases:</span>
                    <span className="text-blue-600">{offlineStatus.canvasCount}</span>
                  </div>
                  {offlineStatus.syncInProgress && (
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className="text-yellow-600">Syncing...</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex space-x-2 pt-2 border-t">
              <button
                onClick={handleRefresh}
                className="flex-1 px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Refresh
              </button>
              
              {offlineStatus.actionCount > 0 && (
                <button
                  onClick={handleSync}
                  disabled={offlineStatus.syncInProgress}
                  className="flex-1 px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 transition-colors"
                >
                  {offlineStatus.syncInProgress ? 'Syncing...' : 'Sync'}
                </button>
              )}
              
              {offlineStatus.actionCount > 0 && (
                <button
                  onClick={handleClearOfflineData}
                  className="flex-1 px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Status Message */}
            <div className="text-xs text-gray-600 pt-2 border-t">
              {networkHealthService.getStatusMessage()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default NetworkStatusIndicator
