import React, { createContext, useContext, useEffect, useState } from 'react'
import { socketService } from '../services/socket'
import { useAuth } from './useAuth'

interface SocketContextType {
  isConnected: boolean
  connect: () => void
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

  const connect = () => {
    if (isDevelopment) {
      // In development mode, skip socket connection entirely
      console.log('Development mode: Skipping socket connection')
      setIsConnected(false) // Set to false to prevent socket operations
    } else {
      const idToken = localStorage.getItem('idToken')
      if (idToken && isAuthenticated) {
        socketService.connect(idToken)
        setIsConnected(true)
      }
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

    socketService.on('connect', handleConnect)
    socketService.on('disconnect', handleDisconnect)

    return () => {
      socketService.off('connect', handleConnect)
      socketService.off('disconnect', handleDisconnect)
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
