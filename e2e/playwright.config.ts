import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// npm run test:e2e builds the fixture db, both web builds and the server first
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const SERVER = 'http://127.0.0.1:3412'
export const APP = 'http://127.0.0.1:3413'

export default defineConfig({
  testDir: '.',
  outputDir: 'test-results',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: SERVER, trace: 'retain-on-failure' },
  webServer: [
    {
      command: `${repo}/server/bin/arutha_lk -root-path ${repo} -db ${repo}/e2e/fixtures/db/dict.db -listen 127.0.0.1:3412`,
      url: `${SERVER}/api/health`,
      reuseExistingServer: !process.env.CI,
    },
    { command: `node ${repo}/scripts/static-server.mjs ${repo}/web/dist-app 3413`, url: `${APP}/index.html`, reuseExistingServer: !process.env.CI },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /android/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: /android|ssr/ },
    { name: 'pixel', use: { ...devices['Pixel 7'] }, testIgnore: /android|ssr/ },
    { name: 'iphone', use: { ...devices['iPhone 14'] }, testIgnore: /android|ssr/ },
    { name: 'android-sim', use: { ...devices['Pixel 7'] }, testMatch: /android/ },
  ],
})
