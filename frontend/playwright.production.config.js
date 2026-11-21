import { defineConfig } from '@playwright/test'
import development from './playwright.config.js'

export default defineConfig({
  ...development,
  outputDir: './node_modules/.cache/playwright-production-results',
  use: { ...development.use, baseURL: 'http://127.0.0.1:5180' },
  webServer: {
    command: 'node tests/browser/serveProduction.js',
    url: 'http://127.0.0.1:5180',
    reuseExistingServer: false,
  },
})
