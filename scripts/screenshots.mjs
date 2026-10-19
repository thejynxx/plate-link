// scripts/screenshots.mjs
// Automated screenshot capture using Playwright against live production:
// https://plate-link-sigma.vercel.app

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import sharp from "sharp"
import { createClient } from "@supabase/supabase-js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, "..")
const SCREENSHOTS_DIR = path.join(ROOT_DIR, "docs", "screenshots")

const BASE_URL = process.env.PL_BASE_URL || "https://plate-link-sigma.vercel.app"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mjverufnlbxozbtvfvby.supabase.co"
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_04dwEDbtYjskW_OoLomDKg_AExOOB-X"

let CANTEEN_EMAIL = process.env.PL_CANTEEN_EMAIL
let CANTEEN_PASSWORD = process.env.PL_CANTEEN_PASSWORD
let NGO_EMAIL = process.env.PL_NGO_EMAIL
let NGO_PASSWORD = process.env.PL_NGO_PASSWORD

async function ensureAccounts() {
  if (CANTEEN_EMAIL && CANTEEN_PASSWORD && NGO_EMAIL && NGO_PASSWORD) {
    console.log("Using credentials from environment variables.")
    return
  }

  console.log("Environment variables not set. Auto-provisioning demo accounts on Supabase...")
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const ts = Date.now()

  // 1. Canteen
  CANTEEN_EMAIL = `canteen.${ts}@platelink.local`
  CANTEEN_PASSWORD = `Password123!${ts}`
  const { data: canteenAuth, error: cAuthErr } = await sb.auth.signUp({
    email: CANTEEN_EMAIL,
    password: CANTEEN_PASSWORD,
    options: { data: { role: "canteen", name: "Campus Central Dining" } },
  })
  if (cAuthErr) throw new Error(`Canteen signUp failed: ${cAuthErr.message}`)

  const canteenSb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  await canteenSb.auth.setSession({
    access_token: canteenAuth.session.access_token,
    refresh_token: canteenAuth.session.refresh_token,
  })

  await canteenSb.from("canteens").insert({
    id: canteenAuth.user.id,
    org_name: "Campus Central Dining Hall",
    address: "Anna University, Sardar Patel Rd, Guindy, Chennai",
    location_lat: 13.0102,
    location_lng: 80.2355,
    pickup_instructions: "Kitchen entrance near Food Court Gate 2",
  })

  const { data: listings } = await canteenSb.from("food_listings").insert([
    {
      canteen_id: canteenAuth.user.id,
      title: "Veg biryani & raita",
      description: "Fresh aromatic biryani with cucumber raita, prepared today at 18:00.",
      food_type: "veg",
      quantity: 45,
      status: "available",
      expires_at: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
    },
    {
      canteen_id: canteenAuth.user.id,
      title: "Chapati & dal makhani",
      description: "Warm whole wheat chapatis with slow-cooked dal.",
      food_type: "veg",
      quantity: 35,
      status: "available",
      expires_at: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
    },
  ]).select()

  // 2. NGO
  NGO_EMAIL = `ngo.${ts}@platelink.local`
  NGO_PASSWORD = `Password123!${ts}`
  const { data: ngoAuth, error: nAuthErr } = await sb.auth.signUp({
    email: NGO_EMAIL,
    password: NGO_PASSWORD,
    options: { data: { role: "user", name: "Anbu Children Shelter" } },
  })
  if (nAuthErr) throw new Error(`NGO signUp failed: ${nAuthErr.message}`)

  const ngoSb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  await ngoSb.auth.setSession({
    access_token: ngoAuth.session.access_token,
    refresh_token: ngoAuth.session.refresh_token,
  })

  // 3. Claim one listing so orders & tracking page have real data
  if (listings && listings[0]) {
    await ngoSb.rpc("claim_listing", {
      p_listing_id: listings[0].id,
      p_dropoff_address: "Anbu Shelter, 12 Railway Border Rd, Tambaram, Chennai",
      p_dropoff_lat: 12.9249,
      p_dropoff_lng: 80.1466,
    })
  }

  console.log(`  ✓ Provisioned Canteen: ${CANTEEN_EMAIL}`)
  console.log(`  ✓ Provisioned NGO:     ${NGO_EMAIL}`)
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
  await ensureAccounts()
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
      await page.waitForTimeout(2000)
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

    await canteenPage.waitForURL(
      (url) => url.pathname.startsWith("/canteen") || url.pathname.startsWith("/dashboard"),
      { timeout: 15000 }
    )
    await canteenPage.goto(`${BASE_URL}/canteen/home`, { waitUntil: "networkidle" })
    await canteenPage.waitForTimeout(3000)
    const canteenBuffer = await canteenPage.screenshot({ fullPage: false })
    await compressAndSave(canteenBuffer, "canteen-home.png")

    // -------------------------------------------------------------
    // 3. ML Prep Planner (/canteen/planner)
    // -------------------------------------------------------------
    console.log("[3/5] Navigating to ML Prep Planner (/canteen/planner)...")
    await canteenPage.goto(`${BASE_URL}/canteen/planner`, { waitUntil: "networkidle" })
    await canteenPage.waitForTimeout(3000)
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
      geolocation: { latitude: 13.0102, longitude: 80.2355 },
      permissions: ["geolocation"],
    })
    const ngoPage = await ngoContext.newPage()
    await ngoPage.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" })
    await ngoPage.fill("#email", NGO_EMAIL)
    await ngoPage.fill("#password", NGO_PASSWORD)
    await ngoPage.click('button[type="submit"]')

    await ngoPage.waitForURL(
      (url) => url.pathname.startsWith("/app") || url.pathname.startsWith("/dashboard"),
      { timeout: 15000 }
    )
    await ngoPage.goto(`${BASE_URL}/app`, { waitUntil: "networkidle" })
    // Extra 4s for MapLibre tiles and pins to fully render
    await ngoPage.waitForTimeout(4000)
    const feedBuffer = await ngoPage.screenshot({ fullPage: false })
    await compressAndSave(feedBuffer, "feed-map.png")

    // -------------------------------------------------------------
    // 5. Live Order Tracking (/app/orders -> /app/orders/[id])
    // -------------------------------------------------------------
    console.log("[5/5] Navigating to NGO Orders & Tracking (/app/orders)...")
    await ngoPage.goto(`${BASE_URL}/app/orders`, { waitUntil: "networkidle" })
    await ngoPage.waitForTimeout(2500)

    const orderLink = await ngoPage.$('a[href^="/app/orders/"]')
    if (orderLink) {
      console.log("  Found active claim. Navigating to order tracking...")
      const href = await orderLink.getAttribute("href")
      if (href) {
        await ngoPage.goto(`${BASE_URL}${href}`, { waitUntil: "networkidle" })
        await ngoPage.waitForTimeout(4000)
      }
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
