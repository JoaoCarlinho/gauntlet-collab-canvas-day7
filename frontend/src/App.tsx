import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { SocketProvider } from './hooks/useSocket'
import HomePage from './components/HomePage'
import LoginPage from './components/LoginPage'
import CanvasPage from './components/CanvasPage'
import ProtectedRoute from './components/ProtectedRoute'
// import { EnvDebug } from './components/EnvDebug'
import ErrorBoundary from './components/ErrorBoundary'
// import NetworkStatusIndicator from './components/NetworkStatusIndicator'
import { UpdateNotification } from './components/UpdateNotification'

// Test comment for PR build validation workflow

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SocketProvider>
          <div className="min-h-screen bg-gray-50">
            {/* <EnvDebug /> */}
            {/* <NetworkStatusIndicator /> */}
            <UpdateNotification position="bottom-right" autoPrompt={false} />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/canvas/:canvasId"
                element={
                  <ProtectedRoute>
                    <CanvasPage />
                  </ProtectedRoute>
                }
              />
              {/* Development route for testing without authentication */}
              <Route
                path="/dev/canvas/:canvasId"
                element={<CanvasPage />}
              />
            </Routes>
          </div>
        </SocketProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
