import { defineConfig } from '@playwright/test'
import { SIZES } from './test/browser/page.mjs'

export default defineConfig({
  testDir: 'test/browser',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: process.env.CI ? 4 : 2,
  timeout: 120_000,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  // one baseline set, rendered on CI's Linux (fonts and anti-aliasing differ on macOS): no platform suffix
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  use: { browserName: 'chromium' },
  projects: Object.entries(SIZES).map(([name, use]) => ({ name, use })),
})
