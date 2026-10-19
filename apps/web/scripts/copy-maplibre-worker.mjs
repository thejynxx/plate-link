import { copyFileSync, existsSync, mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const maplibrePkg = require.resolve("maplibre-gl/package.json")
const workerSrc = path.join(path.dirname(maplibrePkg), "dist", "maplibre-gl-worker.mjs")

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(__dirname, "..", "public")
const workerDest = path.join(publicDir, "maplibre-gl-worker.mjs")

if (!existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true })
}

copyFileSync(workerSrc, workerDest)
console.log(`[copy-maplibre-worker] Copied ${path.basename(workerSrc)} to public/`)
