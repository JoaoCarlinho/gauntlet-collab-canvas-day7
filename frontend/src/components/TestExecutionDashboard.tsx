/**
 * Test Execution Dashboard Component
 * Provides interface for automated production testing with passkey authentication
 */

import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../utils/env';

interface TestUser {
  id: string;
  email: string;
  name: string;
  can_execute_tests: boolean;
  can_view_results: boolean;
  can_manage_tests: boolean;
  has_passkey: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

interface TestExecution {
  execution_id: string;
  user_id: string;
  user_email: string;
  test_type: string;
  test_suite: string;
  status: string;
  start_time: string | null;
  end_time: string | null;
  duration: number | null;
  results: any;
  metrics: any;
  errors: string[];
  logs: string[];
  config: any;
}

interface TestExecutionDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

const TestExecutionDashboard: React.FC<TestExecutionDashboardProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState<'login' | 'dashboard' | 'executing'>('login');
  const [user, setUser] = useState<TestUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [executions, setExecutions] = useState<TestExecution[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Test execution form state
  const [testType, setTestType] = useState<string>('e2e');
  const [testSuite, setTestSuite] = useState<string>('');
  const [testConfig] = useState<any>({});

  const API_URL = getApiUrl();

  useEffect(() => {
    // Check for existing session on mount
    const existingToken = localStorage.getItem('test_session_token');
    if (existingToken) {
      setSessionToken(existingToken);
      setCurrentStep('dashboard');
      loadUserExecutions();
    }
  }, []);

  const handlePasskeyAuth = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Create authentication challenge
      const challengeResponse = await fetch(`${API_URL}/api/test-execution/passkey/auth/challenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com' // In production, get from user input
        })
      });

      if (!challengeResponse.ok) {
        throw new Error('Failed to create authentication challenge');
      }

      const { challenge } = await challengeResponse.json();

      // Step 2: Use WebAuthn API for authentication
      const credential = await navigator.credentials.get({
        publicKey: challenge
      }) as PublicKeyCredential | null;

      if (!credential) {
        throw new Error('Passkey authentication cancelled');
      }

      // Step 3: Verify authentication
      const verifyResponse = await fetch(`${API_URL}/api/test-execution/passkey/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          challenge: challenge.challenge,
          credential: {
            id: credential.id,
            rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
            response: {
              authenticatorData: btoa(String.fromCharCode(...new Uint8Array((credential.response as AuthenticatorAssertionResponse).authenticatorData))),
              clientDataJSON: btoa(String.fromCharCode(...new Uint8Array((credential.response as AuthenticatorAssertionResponse).clientDataJSON))),
              signature: btoa(String.fromCharCode(...new Uint8Array((credential.response as AuthenticatorAssertionResponse).signature))),
              userHandle: (credential.response as AuthenticatorAssertionResponse).userHandle ? btoa(String.fromCharCode(...new Uint8Array((credential.response as AuthenticatorAssertionResponse).userHandle))) : null
            }
          }
        })
      });

      if (!verifyResponse.ok) {
        throw new Error('Passkey authentication failed');
      }

      const { session_token, user: userData } = await verifyResponse.json();

      // Store session and update state
      localStorage.setItem('test_session_token', session_token);
      setSessionToken(session_token);
      setUser(userData);
      setCurrentStep('dashboard');
      loadUserExecutions();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserExecutions = async () => {
    if (!sessionToken) return;

    try {
      const response = await fetch(`${API_URL}/api/test-execution/executions`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load executions');
      }

      const { executions } = await response.json();
      setExecutions(executions);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load executions');
    }
  };

  const executeTest = async () => {
    if (!sessionToken || !testSuite.trim()) return;

    setIsLoading(true);
    setError(null);
    setCurrentStep('executing');

    try {
      const response = await fetch(`${API_URL}/api/test-execution/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          test_type: testType,
          test_suite: testSuite,
          config: testConfig
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start test execution');
      }

      const { execution_id } = await response.json();

      // Poll for execution status
      pollExecutionStatus(execution_id);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test execution failed');
      setCurrentStep('dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const pollExecutionStatus = async (executionId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/api/test-execution/executions/${executionId}`, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to get execution status');
        }

        const { execution } = await response.json();

        if (['completed', 'failed', 'cancelled', 'timeout'].includes(execution.status)) {
          clearInterval(pollInterval);
          setCurrentStep('dashboard');
          loadUserExecutions(); // Refresh executions list
        }

      } catch (err) {
        clearInterval(pollInterval);
        setError(err instanceof Error ? err.message : 'Failed to poll execution status');
        setCurrentStep('dashboard');
      }
    }, 2000); // Poll every 2 seconds
  };

  const logout = () => {
    localStorage.removeItem('test_session_token');
    setSessionToken(null);
    setUser(null);
    setCurrentStep('login');
    setExecutions([]);
  };

  if (!isOpen) return null;

  return (
    <div className="test-execution-dashboard-overlay">
      <div className="test-execution-dashboard">
        <div className="dashboard-header">
          <h2>Automated Production Testing</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="dashboard-content">
          {currentStep === 'login' && (
            <div className="login-section">
              <h3>Passkey Authentication</h3>
              <p>Use your registered passkey to access the test execution system.</p>
              
              {error && <div className="error-message">{error}</div>}
              
              <button 
                className="auth-button"
                onClick={handlePasskeyAuth}
                disabled={isLoading}
              >
                {isLoading ? 'Authenticating...' : 'Authenticate with Passkey'}
              </button>
            </div>
          )}

          {currentStep === 'dashboard' && user && (
            <div className="dashboard-section">
              <div className="user-info">
                <h3>Welcome, {user.name}</h3>
                <p>Email: {user.email}</p>
                <p>Permissions: {user.can_execute_tests ? 'Execute Tests' : 'View Only'}</p>
                <button className="logout-button" onClick={logout}>Logout</button>
              </div>

              <div className="test-execution-form">
                <h3>Execute Test</h3>
                
                <div className="form-group">
                  <label>Test Type:</label>
                  <select 
                    value={testType} 
                    onChange={(e) => setTestType(e.target.value)}
                    disabled={!user.can_execute_tests}
                  >
                    <option value="e2e">End-to-End</option>
                    <option value="api">API</option>
                    <option value="security">Security</option>
                    <option value="performance">Performance</option>
                    <option value="integration">Integration</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Test Suite:</label>
                  <input
                    type="text"
                    value={testSuite}
                    onChange={(e) => setTestSuite(e.target.value)}
                    placeholder="e.g., user-authentication, canvas-creation"
                    disabled={!user.can_execute_tests}
                  />
                </div>

                <button 
                  className="execute-button"
                  onClick={executeTest}
                  disabled={!user.can_execute_tests || !testSuite.trim() || isLoading}
                >
                  {isLoading ? 'Executing...' : 'Execute Test'}
                </button>
              </div>

              <div className="executions-list">
                <h3>Recent Executions</h3>
                {executions.length === 0 ? (
                  <p>No executions found.</p>
                ) : (
                  <div className="executions-table">
                    {executions.map((execution) => (
                      <div key={execution.execution_id} className="execution-item">
                        <div className="execution-header">
                          <span className="execution-id">{execution.execution_id}</span>
                          <span className={`status status-${execution.status}`}>
                            {execution.status}
                          </span>
                        </div>
                        <div className="execution-details">
                          <span>Type: {execution.test_type}</span>
                          <span>Suite: {execution.test_suite}</span>
                          <span>Duration: {execution.duration ? `${execution.duration}s` : 'N/A'}</span>
                        </div>
                        {execution.errors.length > 0 && (
                          <div className="execution-errors">
                            {execution.errors.map((error, index) => (
                              <div key={index} className="error-item">{error}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStep === 'executing' && (
            <div className="executing-section">
              <h3>Test Execution in Progress</h3>
              <div className="loading-spinner"></div>
              <p>Please wait while your test is being executed...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestExecutionDashboard;
