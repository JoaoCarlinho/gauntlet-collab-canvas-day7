/**
 * Vite plugin to inject version information during build
 * This enables cache busting and version tracking
 */

import { Plugin } from 'vite'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

export interface VersionPluginOptions {
  packageJsonPath?: string
}

/**
 * Safely get git commit hash
 * Falls back to Railway environment variables if git is not available
 */
function getGitCommit(): string {
  // Try Railway environment variable first (available during Railway builds)
  if (process.env.RAILWAY_GIT_COMMIT_SHA) {
    return process.env.RAILWAY_GIT_COMMIT_SHA.substring(0, 7)
  }

  // Try Vercel environment variable
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.substring(0, 7)
  }

  // Try git command as fallback
  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: 'pipe',
      encoding: 'utf-8'
    }).trim()
  } catch (error) {
    // Git not available or not a git repository
    return 'unknown'
  }
}

export function viteVersionPlugin(options: VersionPluginOptions = {}): Plugin {
  const packageJsonPath = options.packageJsonPath || './package.json'
  let versionInfo: any = null

  return {
    name: 'vite-plugin-version',

    config(config, { command, mode }) {
      // Only generate version info during build, not in dev/preview
      if (command === 'build') {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
        const version = packageJson.version || '0.0.0'
        const buildTime = new Date().toISOString()
        const gitCommit = getGitCommit()

        versionInfo = {
          version,
          buildTime,
          gitCommit,
          isDevelopment: false
        }

        console.log('🔧 Building with version info:', versionInfo)
      } else {
        // In dev/preview mode, try to read from existing build
        try {
          const distVersionPath = path.join(process.cwd(), 'dist', 'version.json')
          if (fs.existsSync(distVersionPath)) {
            versionInfo = JSON.parse(fs.readFileSync(distVersionPath, 'utf-8'))
            console.log('📦 Using existing version info from dist/version.json')
          }
        } catch (error) {
          // Fallback for dev mode
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
          versionInfo = {
            version: packageJson.version || '0.0.0-dev',
            buildTime: new Date().toISOString(),
            gitCommit: 'dev',
            isDevelopment: true
          }
          console.log('🔧 Using dev version info')
        }
      }

      // Add to define config
      return {
        define: {
          ...config.define,
          __APP_VERSION__: JSON.stringify(versionInfo.version),
          __BUILD_TIME__: JSON.stringify(versionInfo.buildTime),
          __GIT_COMMIT__: JSON.stringify(versionInfo.gitCommit)
        }
      }
    },

    generateBundle() {
      // Only emit version.json during build
      if (versionInfo && !versionInfo.isDevelopment) {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify(versionInfo, null, 2)
        })

        console.log('\n✓ Version info generated:')
        console.log(`  Version: ${versionInfo.version}`)
        console.log(`  Build Time: ${versionInfo.buildTime}`)
        console.log(`  Git Commit: ${versionInfo.gitCommit}\n`)
      }
    }
  }
}
