import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'
  const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production'
  
  // Get API URL from environment variables
  const apiUrl = process.env.VITE_API_URL || 'http://localhost:5000'
  const socketUrl = process.env.VITE_SOCKET_URL || 'http://localhost:5000'
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: parseInt(process.env.PORT || '3000'),
      host: '0.0.0.0', // Allow external connections for Railway
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
        },
        '/socket.io': {
          target: socketUrl,
          changeOrigin: true,
          ws: true,
        },
      },
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        'Cross-Origin-Embedder-Policy': 'unsafe-none',
      },
    },
    preview: {
      port: parseInt(process.env.PORT || '3000'),
      host: '0.0.0.0', // Allow external connections for Railway
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        'Cross-Origin-Embedder-Policy': 'unsafe-none',
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: !isProduction, // Disable sourcemaps in production for Railway
      assetsDir: 'assets',
      rollupOptions: {
        output: {
          assetFileNames: 'assets/[name]-[hash][extname]',
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
        },
      },
      // Exclude test files from build
      commonjsOptions: {
        exclude: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**']
      }
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    },
    // Railway-specific optimizations
    define: {
      __RAILWAY_ENV__: JSON.stringify(isRailway),
      __API_URL__: JSON.stringify(apiUrl),
      __SOCKET_URL__: JSON.stringify(socketUrl),
      __DISABLE_HEALTH_CHECKS__: JSON.stringify(
        process.env.DISABLE_HEALTH_CHECKS === 'true' ||
        process.env.SKIP_HEALTH_MONITORING === 'true' ||
        process.env.HEALTH_CHECK_ENABLED === 'false'
      ),
    },
  }
})
