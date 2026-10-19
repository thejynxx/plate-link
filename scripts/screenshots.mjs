// scripts/screenshots.mjs
// Automated screenshot capture using Playwright against live production:
// https://plate-link-sigma.vercel.app

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import sharp from "sharp"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, "..")
const SCREENSHOTS_DIR = path.join(ROOT_DIR, "docs", "screenshots")

const BASE_URL = process.env.PL_BASE_URL || "https://plate-link-sigma.vercel.app"

const CANTEEN_EMAIL = process.env.PL_CANTEEN_EMAIL
const CANTEEN_PASSWORD = process.env.PL_CANTEEN_PASSWORD
const NGO_EMAIL = process.env.PL_NGO_EMAIL
const NGO_PASSWORD = process.env.PL_NGO_PASSWORD

function checkEnv() {
  const missing = []
  if (!CANTEEN_EMAIL) missing.push("PL_CANTEEN_EMAIL")
  if (!CANTEEN_PASSWORD) missing.push("PL_CANTEEN_PASSWORD")
  if (!NGO_EMAIL) missing.push("PL_NGO_EMAIL")
  if (!NGO_PASSWORD) missing.push("PL_NGO_PASSWORD")

  if (missing.length > 0) {
    console.error("=================================================================")
    console.error("  Missing required environment variables for screenshots:")
    for (const m of missing) {
      console.error(`    - ${m}`)
    }
    console.error("")
    console.error("  Please set them in PowerShell before running this script:")
    console.error('    $env:PL_CANTEEN_EMAIL = "canteen@example.com"')
    console.error('    $env:PL_CANTEEN_PASSWORD = "your-password"')
    console.error('    $env:PL_NGO_EMAIL = "ngo@example.com"')
    console.error('    $env:PL_NGO_PASSWORD = "your-password"')
    console.error("    node scripts/screenshots.mjs")
    console.error("=================================================================")
    process.exit(1)
  }
}

async function compressAndSave(buffer, fileName) {
  const outPath = path.join(SCREENSHOTS_DIR, fileName)
  await sharp(buffer)
    .resize({ width: 1600, withoutEnlargement: true })
    .png({ quality: 80, compressionLevel: 9, effort: 7 })
    .toFile(outPath)
  const stat = await fs.promises.stat(outPath)
  console.log(`  ✓ Saved & compressed ${fileName} (${(stat.size / 1024).toFixed(1)} KB)`)
}

async function main() {
  checkEnv()
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })

  console.log(`Starting screenshot capture against ${BASE_URL} (dark mode, 1440x900 @2x)...`)
  const browser = await chromium.launch({ headless: true })

  try {
    // -------------------------------------------------------------
    // 1. Landing Page (logged out)
    // -------------------------------------------------------------
    console.log("[1/5] Capturing landing page (logged out)...")
    {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
        colorScheme: "dark",
      })
      const page = await context.newPage()
      await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" })
      await page.waitForTimeout(1500)
      const buffer = await page.screenshot({ fullPage: false })
      await compressAndSave(buffer, "landing.png")
      await context.close()
    }

    // -------------------------------------------------------------
    // 2. Canteen Home (/canteen/home)
    // -------------------------------------------------------------
    console.log("[2/5] Logging in as Canteen -> /canteen/home...")
    let canteenContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      colorScheme: "dark",
    })
    let canteenPage = await canteenContext.newPage()
    await canteenPage.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" })
    await canteenPage.fill("#email", CANTEEN_EMAIL)
    await canteenPage.fill("#password", CANTEEN_PASSWORD)
    await canteenPage.click('button[type="submit"]')

    // Wait for redirect to dashboard/canteen
    await canteenPage.waitForURL(/canteen|dashboard/, { timeout: 15000 }).catch(() => {})
    if (canteenPage.url().includes("/login")) {
      console.warn("  ⚠️ Canteen login might have failed or timed out — check PL_CANTEEN_EMAIL and PL_CANTEEN_PASSWORD.")
    }
    await canteenPage.goto(`${BASE_URL}/canteen/home`, { waitUntil: "networkidle" })
    await canteenPage.waitForTimeout(2000)
    const canteenBuffer = await canteenPage.screenshot({ fullPage: false })
    await compressAndSave(canteenBuffer, "canteen-home.png")

    // -------------------------------------------------------------
    // 3. ML Prep Planner (/canteen/planner)
    // -------------------------------------------------------------
    console.log("[3/5] Navigating to ML Prep Planner (/canteen/planner)...")
    await canteenPage.goto(`${BASE_URL}/canteen/planner`, { waitUntil: "networkidle" })
    await canteenPage.waitForTimeout(2500)
    // Ensure form has values and result board has calculated
    const plannerBuffer = await canteenPage.screenshot({ fullPage: false })
    await compressAndSave(plannerBuffer, "planner.png")
    await canteenContext.close()

    // -------------------------------------------------------------
    // 4. Recipient Feed & Map (/app)
    // -------------------------------------------------------------
    console.log("[4/5] Logging in as NGO -> /app (feed and map)...")
    const ngoContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      colorScheme: "dark",
      geolocation: { latitude: 13.0827, longitude: 80.2707 },
      permissions: ["geolocation"],
    })
    const ngoPage = await ngoContext.newPage()
    await ngoPage.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" })
    await ngoPage.fill("#email", NGO_EMAIL)
    await ngoPage.fill("#password", NGO_PASSWORD)
    await ngoPage.click('button[type="submit"]')

    await ngoPage.waitForURL(/app|dashboard/, { timeout: 15000 }).catch(() => {})
    if (ngoPage.url().includes("/login")) {
      console.warn("  ⚠️ NGO login might have failed or timed out — check PL_NGO_EMAIL and PL_NGO_PASSWORD.")
    }
    await ngoPage.goto(`${BASE_URL}/app`, { waitUntil: "networkidle" })
    // Extra 3.5s for MapLibre tiles and pins to fully render
    await ngoPage.waitForTimeout(3500)
    const feedBuffer = await ngoPage.screenshot({ fullPage: false })
    await compressAndSave(feedBuffer, "feed-map.png")

    // -------------------------------------------------------------
    // 5. Live Order Tracking (/app/orders -> /app/orders/[id])
    // -------------------------------------------------------------
    console.log("[5/5] Navigating to NGO Orders & Tracking (/app/orders)...")
    await ngoPage.goto(`${BASE_URL}/app/orders`, { waitUntil: "networkidle" })
    await ngoPage.waitForTimeout(2000)

    // Check if an order link exists
    const orderLink = await ngoPage.$('a[href^="/app/orders/"]')
    if (orderLink) {
      console.log("  Found active claim. Navigating to order tracking...")
      const href = await orderLink.getAttribute("href")
      if (href) {
        await ngoPage.goto(`${BASE_URL}${href}`, { waitUntil: "networkidle" })
        // Extra 3.5s for MapLibre tracking route and telemetry pins
        await ngoPage.waitForTimeout(3500)
      }
    } else {
      console.log("  No active claims found. Capturing Claims list page...")
    }

    const trackingBuffer = await ngoPage.screenshot({ fullPage: false })
    await compressAndSave(trackingBuffer, "tracking.png")
    await ngoContext.close()

    console.log("\nAll 5 production screenshots captured and compressed successfully in docs/screenshots/!")
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error("Error during screenshot capture:", err)
  process.exit(1)
})
