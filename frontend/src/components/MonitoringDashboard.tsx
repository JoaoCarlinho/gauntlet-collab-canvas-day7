/**
 * Comprehensive Monitoring Dashboard Component
 */

import React, { useState, useEffect } from 'react'
import { X, RefreshCw, AlertTriangle, CheckCircle, Clock, Activity, Users, Database, Wifi, WifiOff } from 'lucide-react'
import { authService } from '../services/authService'
import { enhancedSocketService } from '../services/enhancedSocketService'
import { stateManagementService } from '../services/stateManagementService'
import { errorRecoveryService } from '../services/errorRecoveryService'
import { duplicatePreventionService } from '../services/duplicatePreventionService'
import { canvasPermissionService } from '../services/canvasPermissionService'
import { userFeedbackService } from '../services/userFeedbackService'
import { objectValidationService } from '../services/objectValidationService'

interface MonitoringDashboardProps {
  isOpen: boolean
  onClose: () => void
}

interface SystemMetrics {
  auth: any
  socket: any
  state: any
  errorRecovery: any
  duplicatePrevention: any
  permissions: any
  feedback: any
  validation: any
}

const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({ isOpen, onClose }) => {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'auth' | 'socket' | 'state' | 'errors' | 'performance'>('overview')

  useEffect(() => {
    if (isOpen) {
      refreshMetrics()
      const interval = setInterval(refreshMetrics, 5000) // Refresh every 5 seconds
      return () => clearInterval(interval)
    }
  }, [isOpen])

  const refreshMetrics = async () => {
    setIsRefreshing(true)
    try {
      const newMetrics: SystemMetrics = {
        auth: authService.getAuthState(),
        socket: {
          connectionState: enhancedSocketService.getConnectionState(),
          connectionQuality: enhancedSocketService.getConnectionQuality(),
          metrics: enhancedSocketService.getConnectionMetrics()
        },
        state: stateManagementService.getStateMetrics(),
        errorRecovery: errorRecoveryService.getRecoveryMetrics(),
        duplicatePrevention: duplicatePreventionService.getMetrics(),
        permissions: canvasPermissionService.getMetrics(),
        feedback: userFeedbackService.getMetrics(),
        validation: {
          constraints: objectValidationService.getConstraints(),
          validTypes: objectValidationService.getValidObjectTypes()
        }
      }
      
      setMetrics(newMetrics)
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Failed to refresh metrics:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'success':
      case 'completed':
        return 'text-green-600'
      case 'disconnected':
      case 'failed':
      case 'error':
        return 'text-red-600'
      case 'connecting':
      case 'pending':
      case 'warning':
        return 'text-yellow-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
      case 'success':
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'disconnected':
      case 'failed':
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-600" />
      case 'connecting':
      case 'pending':
      case 'warning':
        return <Clock className="w-4 h-4 text-yellow-600" />
      default:
        return <Activity className="w-4 h-4 text-gray-600" />
    }
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString()
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">System Monitoring Dashboard</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={refreshMetrics}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'auth', label: 'Authentication' },
            { id: 'socket', label: 'Socket Connection' },
            { id: 'state', label: 'State Management' },
            { id: 'errors', label: 'Error Recovery' },
            { id: 'performance', label: 'Performance' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {!metrics ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Activity className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-pulse" />
                <p className="text-gray-500">Loading metrics...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Authentication Status */}
                  <div className="bg-white border rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Authentication</h3>
                      {getStatusIcon(metrics.auth.isAuthenticated ? 'connected' : 'disconnected')}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Status:</span>
                        <span className={`text-sm font-medium ${getStatusColor(metrics.auth.isAuthenticated ? 'connected' : 'disconnected')}`}>
                          {metrics.auth.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">User ID:</span>
                        <span className="text-sm font-mono text-gray-900">
                          {metrics.auth.user?.id || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Last Validation:</span>
                        <span className="text-sm text-gray-900">
                          {metrics.auth.lastValidation ? formatTime(metrics.auth.lastValidation) : 'Never'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Socket Connection */}
                  <div className="bg-white border rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Socket Connection</h3>
                      {getStatusIcon(metrics.socket.connectionState)}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">State:</span>
                        <span className={`text-sm font-medium ${getStatusColor(metrics.socket.connectionState)}`}>
                          {metrics.socket.connectionState}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Quality:</span>
                        <span className={`text-sm font-medium ${getStatusColor(metrics.socket.connectionQuality)}`}>
                          {metrics.socket.connectionQuality}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Total Connections:</span>
                        <span className="text-sm text-gray-900">
                          {formatNumber(metrics.socket.metrics.totalConnections)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Success Rate:</span>
                        <span className="text-sm text-gray-900">
                          {metrics.socket.metrics.totalConnections > 0 
                            ? `${((metrics.socket.metrics.successfulConnections / metrics.socket.metrics.totalConnections) * 100).toFixed(1)}%`
                            : 'N/A'
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* State Management */}
                  <div className="bg-white border rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">State Management</h3>
                      <Activity className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Total Operations:</span>
                        <span className="text-sm text-gray-900">
                          {formatNumber(metrics.state.totalOperations)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Success Rate:</span>
                        <span className="text-sm text-gray-900">
                          {metrics.state.totalOperations > 0 
                            ? `${((metrics.state.successfulOperations / metrics.state.totalOperations) * 100).toFixed(1)}%`
                            : 'N/A'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Pending Operations:</span>
                        <span className="text-sm text-gray-900">
                          {formatNumber(metrics.state.pendingOperations)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Conflicts Resolved:</span>
                        <span className="text-sm text-gray-900">
                          {formatNumber(metrics.state.conflictsResolved)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Error Recovery */}
                  <div className="bg-white border rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Error Recovery</h3>
                      <AlertTriangle className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Total Recoveries:</span>
                        <span className="text-sm text-gray-900">
                          {formatNumber(metrics.errorRecovery.totalRecoveries)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Success Rate:</span>
                        <span className="text-sm text-gray-900">
                          {metrics.errorRecovery.totalRecoveries > 0 
                            ? `${((metrics.errorRecovery.successfulRecoveries / metrics.errorRecovery.totalRecoveries) * 100).toFixed(1)}%`
                            : 'N/A'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Avg Recovery Time:</span>
                        <span className="text-sm text-gray-900">
                          {formatDuration(metrics.errorRecovery.averageRecoveryTime)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Duplicate Prevention */}
                  <div className="bg-white border rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Duplicate Prevention</h3>
                      <Database className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Total Checks:</span>
                        <span className="text-sm text-gray-900">
                          {formatNumber(metrics.duplicatePrevention.totalChecks)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Duplicates Detected:</span>
                        <span className="text-sm text-gray-900">
                          {formatNumber(metrics.duplicatePrevention.duplicatesDetected)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Duplicates Prevented:</span>
                        <span className="text-sm text-gray-900">
                          {formatNumber(metrics.duplicatePrevention.duplicatesPrevented)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Avg Similarity:</span>
                        <span className="text-sm text-gray-900">
                          {(metrics.duplicatePrevention.averageSimilarity * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* User Feedback */}
                  <div className="bg-white border rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">User Feedback</h3>
                      <Users className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Total Messages:</span>
                        <span className="text-sm text-gray-900">
                          {formatNumber(metrics.feedback.totalMessages)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">User Interactions:</span>
                        <span className="text-sm text-gray-900">
                          {formatNumber(metrics.feedback.userInteractions)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Dismissed Messages:</span>
                        <span className="text-sm text-gray-900">
                          {formatNumber(metrics.feedback.dismissedMessages)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Other tabs would contain detailed metrics for each service */}
              {activeTab !== 'overview' && (
                <div className="text-center py-12">
                  <p className="text-gray-500">Detailed metrics for {activeTab} will be implemented here.</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-4">
              <span>Last updated: {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}</span>
              <span>•</span>
              <span>System Status: {metrics ? 'Healthy' : 'Unknown'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>All systems operational</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MonitoringDashboard
