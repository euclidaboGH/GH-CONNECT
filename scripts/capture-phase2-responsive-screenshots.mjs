#!/usr/bin/env node
/**
 * Preview-only responsive screenshot harness.
 * Usage: GREENHAVEN_PREVIEW_URL=https://preview.example node scripts/capture-phase2-responsive-screenshots.mjs
 * Optional: GREENHAVEN_STORAGE_STATE=/absolute/path/storage-state.json
 * Screenshots are evidence artifacts only; this script does not approve production.
 */
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

const baseURL = process.env.GREENHAVEN_PREVIEW_URL
if (!baseURL) throw new Error('Set GREENHAVEN_PREVIEW_URL to a deployed preview URL.')
const output = path.resolve(process.env.GREENHAVEN_SCREENSHOT_DIR || 'artifacts/phase2-responsive')
fs.mkdirSync(output, { recursive: true })
const storageState = process.env.GREENHAVEN_STORAGE_STATE
const viewports = [
  { name: 'android-compact', width: 360, height: 800, isMobile: true, hasTouch: true },
  { name: 'android-standard', width: 393, height: 852, isMobile: true, hasTouch: true },
  { name: 'android-large', width: 432, height: 960, isMobile: true, hasTouch: true },
  { name: 'tablet-portrait', width: 768, height: 1024, isMobile: true, hasTouch: true },
  { name: 'tablet-landscape', width: 1024, height: 768, isMobile: false, hasTouch: true },
  { name: 'desktop', width: 1440, height: 900, isMobile: false, hasTouch: false },
  { name: 'ultrawide', width: 1920, height: 1080, isMobile: false, hasTouch: false },
]
const browser = await chromium.launch({ headless: true })
const failures = []
try {
  for (const viewport of viewports) {
    for (const colorScheme of ['light', 'dark']) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.isMobile,
        hasTouch: viewport.hasTouch,
        deviceScaleFactor: viewport.isMobile ? 2 : 1,
        storageState: storageState && fs.existsSync(storageState) ? storageState : undefined,
        reducedMotion: 'reduce',
        colorScheme,
      })
      const page = await context.newPage()
      page.on('pageerror', (error) => failures.push(`${viewport.name}/${colorScheme}: ${error.message}`))
      await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.locator('body').waitFor({ state: 'visible' })
      await page.waitForTimeout(1200)
      const dimensions = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      }))
      if (dimensions.documentWidth > dimensions.viewportWidth + 2) {
        failures.push(`${viewport.name}/${colorScheme}: horizontal document overflow (${dimensions.documentWidth}px > ${dimensions.viewportWidth}px)`)
      }
      const shell = page.locator('.gh-app-shell').first()
      if (await shell.count()) {
        const box = await shell.boundingBox()
        if (box && box.width > viewport.width + 1) failures.push(`${viewport.name}/${colorScheme}: app shell overflows viewport (${box.width}px > ${viewport.width}px)`)
        await shell.screenshot({ path: path.join(output, `${viewport.name}-${colorScheme}-shell.png`) })
      } else {
        await page.screenshot({ path: path.join(output, `${viewport.name}-${colorScheme}-entry.png`), fullPage: true })
      }
      // Capture each canonical navigation destination when authenticated navigation is present.
      const navButtons = page.locator('nav[aria-label="Main navigation"] button')
      const count = Math.min(await navButtons.count(), 8)
      for (let i = 0; i < count; i++) {
        const button = navButtons.nth(i)
        const label = (await button.getAttribute('aria-label')) || (await button.innerText()).trim() || `nav-${i + 1}`
        const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || `nav-${i + 1}`
        await button.click({ timeout: 5000 }).catch(() => undefined)
        await page.waitForTimeout(500)
        await page.screenshot({ path: path.join(output, `${viewport.name}-${colorScheme}-${safeLabel}.png`), fullPage: false }).catch(() => undefined)
      }
      await context.close()
    }
  }
} finally {
  await browser.close()
}
if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Responsive screenshots saved to ${output}. Review overflow, clipping, keyboard focus, text zoom and localized content manually.`)
}
