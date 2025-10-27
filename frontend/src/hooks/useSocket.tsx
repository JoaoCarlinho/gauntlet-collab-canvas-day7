import React, { createContext, useContext, useEffect, useState } from 'react'
import { socketService } from '../services/socket'
import { authService } from '../services/authService'
import { useAuth } from './useAuth'
import toast from 'react-hot-toast'

interface SocketContextType {
  isConnected: boolean
  connect: () => Promise<void>
  disconnect: () => void
}

const SocketContext = createContext<SocketContextType | undefined>(undefined)

// eslint-disable-next-line react-refresh/only-export-components
export const useSocket = () => {
  const context = useContext(SocketContext)
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false)
  const { isAuthenticated, user } = useAuth()

  // Check if we're in development mode
  const isDevelopment = import.meta.env.DEV || 
                       import.meta.env.MODE === 'development' ||
                       import.meta.env.VITE_DEBUG_MODE === 'true' ||
                       window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1'

  const connect = async () => {
    if (isDevelopment) {
      // In development mode, skip socket connection entirely
      console.log('Development mode: Skipping socket connection')
      setIsConnected(false) // Set to false to prevent socket operations
      return
    }

    try {
      console.log('Validating token before Socket.IO connection...')

      // CRITICAL: Validate and refresh token BEFORE Socket.IO connection
      // This prevents Socket.IO from connecting with stale/expired tokens
      const validation = await authService.validateAndRefreshToken()

      if (!validation.isValid || !validation.token) {
        console.error('Cannot connect to socket: token validation failed')

        // Show user-friendly error message
        toast.error('Your session has expired. Please log in again.', {
          duration: 5000,
          id: 'socket-auth-error' // Prevent duplicate toasts
        })

        // Clear auth state and redirect to login
        authService.clearAuth()
        setIsConnected(false)
        return
      }

      console.log('Token validated successfully, connecting to socket...')

      // Connect with validated/refreshed token
      if (isAuthenticated) {
        socketService.connect(validation.token)
        setIsConnected(true)
      }
    } catch (error) {
      console.error('Failed to validate token for socket connection:', error)
      toast.error('Connection failed. Please refresh the page.', {
        duration: 5000,
        id: 'socket-connection-error'
      })
      setIsConnected(false)
    }
  }

  const disconnect = () => {
    socketService.disconnect()
    setIsConnected(false)
  }

  useEffect(() => {
    if (isDevelopment) {
      // In development mode, skip socket connection entirely
      console.log('Development mode: Skipping socket connection in useEffect')
      setIsConnected(false)
    } else if (isAuthenticated && user) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      if (!isDevelopment) {
        disconnect()
      }
    }
  }, [isAuthenticated, user, isDevelopment])

  useEffect(() => {
    // Skip socket event listeners in development mode
    if (isDevelopment) {
      return
    }

    const handleConnect = () => setIsConnected(true)
    const handleDisconnect = () => setIsConnected(false)

    // Handle authentication errors from Socket.IO
    const handleAuthError = (data: { error: string; timestamp: number }) => {
      console.error('Socket authentication error:', data)

      // Show user-friendly error message
      toast.error('Your session has expired. Please log in again.', {
        duration: 5000,
        id: 'socket-auth-error'
      })

      // Clear auth state and disconnect
      authService.clearAuth()
      disconnect()

      // Redirect to login page after a short delay
      setTimeout(() => {
        window.location.href = '/login?reason=session_expired'
      }, 2000)
    }

    socketService.on('connect', handleConnect)
    socketService.on('disconnect', handleDisconnect)
    socketService.on('authentication_error', handleAuthError)

    return () => {
      socketService.off('connect', handleConnect)
      socketService.off('disconnect', handleDisconnect)
      socketService.off('authentication_error', handleAuthError)
    }
  }, [isDevelopment])

  const value: SocketContextType = {
    isConnected,
    connect,
    disconnect,
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  )
}
