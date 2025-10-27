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

export function viteVersionPlugin(options: VersionPluginOptions = {}): Plugin {
  const packageJsonPath = options.packageJsonPath || './package.json'

  return {
    name: 'vite-plugin-version',

    config(config, { mode }) {
      // Get version info
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
      const version = packageJson.version || '0.0.0'
      const buildTime = new Date().toISOString()

      // Get git commit hash
      let gitCommit = 'unknown'
      try {
        gitCommit = execSync('git rev-parse --short HEAD').toString().trim()
      } catch (error) {
        console.warn('Could not get git commit hash:', error)
      }

      // Add to define config
      return {
        define: {
          ...config.define,
          __APP_VERSION__: JSON.stringify(version),
          __BUILD_TIME__: JSON.stringify(buildTime),
          __GIT_COMMIT__: JSON.stringify(gitCommit)
        }
      }
    },

    generateBundle() {
      // Generate version.json file for runtime version checking
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
      const version = packageJson.version || '0.0.0'
      const buildTime = new Date().toISOString()

      let gitCommit = 'unknown'
      try {
        gitCommit = execSync('git rev-parse --short HEAD').toString().trim()
      } catch (error) {
        console.warn('Could not get git commit hash')
      }

      const versionInfo = {
        version,
        buildTime,
        gitCommit,
        isDevelopment: false
      }

      // Emit version.json file
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify(versionInfo, null, 2)
      })

      console.log('\n✓ Version info generated:')
      console.log(`  Version: ${version}`)
      console.log(`  Build Time: ${buildTime}`)
      console.log(`  Git Commit: ${gitCommit}\n`)
    }
  }
}
