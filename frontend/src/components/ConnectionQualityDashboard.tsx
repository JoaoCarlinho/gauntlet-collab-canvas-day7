/**
 * Connection Quality Dashboard
 * Displays real-time connection quality metrics and parse error monitoring.
 */

import React, { useState, useEffect } from 'react'
import { Activity, Wifi, WifiOff, AlertTriangle, CheckCircle, XCircle, BarChart3 } from 'lucide-react'
import { connectionQualityMonitor, ConnectionQualityMetrics } from '../services/connectionQualityMonitor'
import { socketService } from '../services/socket'
import { socketIOClientOptimizer } from '../utils/socketioClientOptimizer'

interface ConnectionQualityDashboardProps {
  isVisible: boolean
  onClose: () => void
}

const ConnectionQualityDashboard: React.FC<ConnectionQualityDashboardProps> = ({ isVisible, onClose }) => {
  const [metrics, setMetrics] = useState<ConnectionQualityMetrics | null>(null)
  const [parseErrorMetrics, setParseErrorMetrics] = useState<any>(null)
  const [connectionState, setConnectionState] = useState<string>('unknown')
  const [isMonitoring, setIsMonitoring] = useState(false)

  useEffect(() => {
    if (!isVisible) return

    // Get initial metrics
    updateMetrics()

    // Set up periodic updates
    const interval = setInterval(updateMetrics, 5000) // Update every 5 seconds

    // Listen for connection quality reports
    const handleQualityReport = (data: any) => {
      setMetrics(data)
    }

    socketService.on('connection_quality_report', handleQualityReport)

    return () => {
      clearInterval(interval)
      socketService.off('connection_quality_report', handleQualityReport)
    }
  }, [isVisible])

  const updateMetrics = () => {
    const qualityMetrics = connectionQualityMonitor.getConnectionQualityMetrics()
    const parseMetrics = socketService.getParseErrorMetrics()
    const state = socketService.getConnectionState()

    setMetrics(qualityMetrics)
    setParseErrorMetrics(parseMetrics)
    setConnectionState(state)
    setIsMonitoring(connectionQualityMonitor.isMonitoringActive())
  }

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-600'
      case 'good': return 'text-blue-600'
      case 'poor': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getQualityIcon = (quality: string) => {
    switch (quality) {
      case 'excellent': return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'good': return <Activity className="w-5 h-5 text-blue-600" />
      case 'poor': return <AlertTriangle className="w-5 h-5 text-red-600" />
      default: return <XCircle className="w-5 h-5 text-gray-600" />
    }
  }

  const getConnectionIcon = (state: string) => {
    switch (state) {
      case 'connected': return <Wifi className="w-5 h-5 text-green-600" />
      case 'connecting': return <Activity className="w-5 h-5 text-yellow-600" />
      case 'reconnecting': return <Activity className="w-5 h-5 text-orange-600" />
      case 'disconnected': return <WifiOff className="w-5 h-5 text-red-600" />
      default: return <XCircle className="w-5 h-5 text-gray-600" />
    }
  }

  const formatPercentage = (value: number) => {
    return (value * 100).toFixed(2) + '%'
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatTimestamp = (timestamp: number | null) => {
    if (!timestamp) return 'Never'
    return new Date(timestamp).toLocaleTimeString()
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-900">Connection Quality Dashboard</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          {/* Connection Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                {getConnectionIcon(connectionState)}
                <h3 className="font-semibold text-gray-900">Connection State</h3>
              </div>
              <p className="text-2xl font-bold text-gray-900 capitalize">{connectionState}</p>
              <p className="text-sm text-gray-600">Current connection status</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                {metrics ? getQualityIcon(metrics.connectionQuality) : <XCircle className="w-5 h-5 text-gray-600" />}
                <h3 className="font-semibold text-gray-900">Connection Quality</h3>
              </div>
              <p className={`text-2xl font-bold capitalize ${metrics ? getQualityColor(metrics.connectionQuality) : 'text-gray-600'}`}>
                {metrics?.connectionQuality || 'Unknown'}
              </p>
              <p className="text-sm text-gray-600">Overall connection health</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Activity className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Monitoring</h3>
              </div>
              <p className={`text-2xl font-bold ${isMonitoring ? 'text-green-600' : 'text-red-600'}`}>
                {isMonitoring ? 'Active' : 'Inactive'}
              </p>
              <p className="text-sm text-gray-600">Quality monitoring status</p>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">Parse Error Rate</h4>
              <p className="text-3xl font-bold text-red-600">
                {metrics ? formatPercentage(metrics.parseErrorRate) : '0%'}
              </p>
              <p className="text-sm text-gray-600">Last 5 minutes</p>
            </div>

            <div className="bg-white border rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">Connection Drop Rate</h4>
              <p className="text-3xl font-bold text-orange-600">
                {metrics ? formatPercentage(metrics.connectionDropRate) : '0%'}
              </p>
              <p className="text-sm text-gray-600">Last 5 minutes</p>
            </div>

            <div className="bg-white border rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">Reconnection Success</h4>
              <p className="text-3xl font-bold text-green-600">
                {metrics ? formatPercentage(metrics.reconnectionSuccessRate) : '100%'}
              </p>
              <p className="text-sm text-gray-600">Success rate</p>
            </div>

            <div className="bg-white border rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">Connection Uptime</h4>
              <p className="text-3xl font-bold text-blue-600">
                {metrics ? formatPercentage(metrics.connectionUptime / 100) : '100%'}
              </p>
              <p className="text-sm text-gray-600">Last 5 minutes</p>
            </div>
          </div>

          {/* Parse Error Details */}
          <div className="bg-white border rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">Parse Error Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Parse Errors</p>
                <p className="text-2xl font-bold text-red-600">
                  {parseErrorMetrics?.parseErrorCount || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Last Parse Error</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatTimestamp(parseErrorMetrics?.lastParseError)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Average Message Size</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatBytes(parseErrorMetrics?.averageMessageSize || 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {metrics && metrics.recommendations.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-yellow-800 mb-2">Recommendations</h3>
              <ul className="list-disc list-inside space-y-1">
                {metrics.recommendations.map((recommendation, index) => (
                  <li key={index} className="text-sm text-yellow-700">
                    {recommendation}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-4">
            <button
              onClick={() => {
                connectionQualityMonitor.clearEventHistory()
                socketService.resetParseErrorMetrics()
                updateMetrics()
              }}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Reset Metrics
            </button>
            <button
              onClick={updateMetrics}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConnectionQualityDashboard
