import React from 'react';
import { getApiUrl } from '../utils/env';

export const EnvDebug: React.FC = () => {
  // Completely disable in production and during tests
  if (import.meta.env.PROD || 
      import.meta.env.MODE === 'production' ||
      (window as any).Cypress || 
      (window as any).playwright ||
      navigator.userAgent.includes('Playwright')) {
    return null;
  }
  
  const apiUrl = getApiUrl();
  
  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      <div><strong>Environment Debug:</strong></div>
      <div>API URL: {apiUrl}</div>
      <div>Mode: {import.meta.env.MODE}</div>
      <div>VITE_API_URL: {import.meta.env.VITE_API_URL || 'NOT SET'}</div>
    </div>
  );
};
