/**
 * Environment variable validation and utilities
 */

export const validateEnvironment = () => {
  const apiUrl = import.meta.env.VITE_API_URL;
  
  console.log('Environment validation:');
  console.log('- VITE_API_URL:', apiUrl);
  console.log('- NODE_ENV:', import.meta.env.NODE_ENV || 'undefined');
  console.log('- MODE:', import.meta.env.MODE);
  console.log('- PROD:', import.meta.env.PROD);
  console.log('- DEV:', import.meta.env.DEV);
  
  // Production mode should use environment variable
  if (import.meta.env.MODE === 'production' || import.meta.env.PROD) {
    if (!apiUrl) {
      console.error('VITE_API_URL is required in production mode!');
      console.error('Please set VITE_API_URL environment variable in Vercel dashboard');
      // Don't throw error in production to prevent app crash
      // Return a placeholder that will show an error in the UI instead
      return 'https://api-not-configured.vercel.app';
    }
    console.log('Production mode detected, using environment variable:', apiUrl);
    return apiUrl;
  }
  
  if (!apiUrl) {
    console.warn('VITE_API_URL is not set! Using localhost fallback.');
    return 'http://localhost:5000';
  }
  
  if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
    console.error('VITE_API_URL must start with http:// or https://');
    console.error('Current value:', apiUrl);
    return 'http://localhost:5000';
  }
  
  return apiUrl;
};

export const getApiUrl = () => {
  let apiUrl = validateEnvironment();

  // Force HTTPS in production to prevent mixed content errors
  if (import.meta.env.PROD && apiUrl.startsWith('http://')) {
    console.warn('Converting HTTP to HTTPS in production mode to prevent mixed content errors');
    apiUrl = apiUrl.replace('http://', 'https://');
  }

  return apiUrl;
};
