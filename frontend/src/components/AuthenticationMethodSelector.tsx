import React from 'react'
import { Mail, Shield } from 'lucide-react'

interface AuthenticationMethodSelectorProps {
  selectedMethod: 'google' | 'email'
  onMethodChange: (method: 'google' | 'email') => void
}

const AuthenticationMethodSelector: React.FC<AuthenticationMethodSelectorProps> = ({
  selectedMethod,
  onMethodChange
}) => {
  return (
    <div className="space-y-4">
      {/* Method Selection */}
      <div className="flex bg-gray-100 rounded-lg p-1">
        <button
          type="button"
          onClick={() => onMethodChange('google')}
          className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
            selectedMethod === 'google'
              ? 'bg-white text-primary-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Shield className="h-4 w-4" />
          <span>Google</span>
        </button>
        <button
          type="button"
          onClick={() => onMethodChange('email')}
          className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
            selectedMethod === 'email'
              ? 'bg-white text-primary-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          data-testid="email-auth-button"
        >
          <Mail className="h-4 w-4" />
          <span>Email</span>
        </button>
      </div>

      {/* Method Description */}
      <div className="text-center">
        {selectedMethod === 'google' ? (
          <p className="text-sm text-gray-600">
            Sign in quickly with your Google account
          </p>
        ) : (
          <p className="text-sm text-gray-600">
            Sign in with your email and password
          </p>
        )}
      </div>
    </div>
  )
}

export default AuthenticationMethodSelector
