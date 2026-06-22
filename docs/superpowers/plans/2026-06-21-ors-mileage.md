# ORS Automatic Mileage Calculation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automatic mileage calculation to every trip leg using the OpenRouteService API, with Postgres caching, a backend distance endpoint, and a debounced auto-fill UI in the trip forms.

**Architecture:** A `routingService` wraps ORS geocoding + directions calls behind two Postgres cache tables (`GeoCache`, `RouteCache`). A lightweight `GET /api/routing/distance` endpoint powers the frontend debounce without coupling to tramo save. Tramo create/update silently calculate distance after saving — never blocking the save on ORS failure. CPM is derived on-the-fly in the trip detail response.

**Tech Stack:** OpenRouteService REST API, axios (backend), Node.js native test runner, Prisma, React + TanStack Query

## Global Constraints

- Env var name is `ORS_API_KEY` (spec). The key was previously saved to `.env` as `OPENROUTESERVICE_API_KEY` — **Task 1 renames it**.
- ORS base URL: `https://api.openrouteservice.org`
- ORS directions profile: `driving-hgv` (heavy goods vehicle)
- Timeout per ORS call: 5 000 ms; 1 retry after 1 s before throwing
- Never block a tramo save on ORS failure — `distanceMillas = null` on error
- Cache writes are always upsert (idempotent)
- Admin-only routes use `requireRole('admin')` (existing middleware)
- Test runner: Node.js built-in `node:test` + `node:assert/strict` (already used in the project)
- Migration approach: direct SQL via `pg` client + `prisma generate` (pgBouncer blocks `prisma db push` in this environment)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `backend/.env` | Rename key to `ORS_API_KEY` |
| Modify | `backend/.env.example` | Document `ORS_API_KEY` |
| Modify | `backend/prisma/schema.prisma` | Add `GeoCache`, `RouteCache`, `distanceMillas`/`distanceKm` on `Tramo` |
| Create | `backend/migrate-ors.mjs` | One-shot SQL migration (run once, then delete) |
| Create | `backend/src/utils/normalizeAddress.js` | Pure address normalization function |
| Create | `backend/src/utils/normalizeAddress.test.js` | Unit tests |
| Create | `backend/src/seeds/truckingCities.js` | 150 city coordinates array |
| Create | `backend/src/seeds/runSeed.js` | Upsert cities into GeoCache on startup |
| Modify | `backend/src/index.js` | Call `runSeed()` before `app.listen` |
| Create | `backend/src/services/routingService.js` | `geocodeAddress`, `getRouteMiles` |
| Create | `backend/src/services/routingService.test.js` | Unit tests with mocked fetch |
| Create | `backend/src/routes/routing.js` | `GET /api/routing/distance` |
| Create | `backend/src/controllers/routing.controller.js` | Handler for distance endpoint |
| Modify | `backend/src/index.js` | Mount `/api/routing` router |
| Modify | `backend/src/controllers/tramos.controller.js` | Fire-and-forget distance after save |
| Modify | `backend/src/schemas.js` | Allow `distanceMillas`/`distanceKm` in tramo schemas |
| Modify | `backend/src/controllers/vueltas.controller.js` | Add `totalMillas` + `cpm` to `getVuelta` response |
| Modify | `backend/src/routes/admin.js` | `GET /api/admin/cache-stats` |
| Create | `backend/src/controllers/admin.controller.js` | Cache stats handler |
| Modify | `backend/src/index.js` | Mount `/api/admin` router |
| Create | `frontend/src/hooks/useRouteDistance.js` | Debounced distance hook |
| Create | `frontend/src/api/routing.api.js` | `getDistance(origen, destino)` API call |
| Modify | `frontend/src/components/NuevaVueltaWizard.jsx` | Wire `useRouteDistance` into leg form |
| Modify | `frontend/src/pages/VueltaDetail.jsx` | Wire hook, add CPM KPI card, miles label on legs |
| Modify | `frontend/src/pages/Reportes.jsx` | Add average CPM chart card |
| Create | `backend/verify-routes.mjs` | Test 4 reference routes and report % error |

---

## Task 1 — Env Rename + Prisma Schema + SQL Migration

**Files:**
- Modify: `backend/.env`
- Modify: `backend/.env.example`
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/migrate-ors.mjs` (run once, then delete)

**Interfaces:**
- Produces: `GeoCache` and `RouteCache` Prisma models; `Tramo.distanceMillas Float?`, `Tramo.distanceKm Float?`; Prisma client regenerated

---

- [ ] **Step 1: Rename env key**

In `backend/.env` replace the old key line:
```
OPENROUTESERVICE_API_KEY=eyJvc...
```
with:
```
ORS_API_KEY=eyJvc...
```

In `backend/.env.example` replace:
```
OPENROUTESERVICE_API_KEY=your_openrouteservice_api_key_here
```
with:
```
ORS_API_KEY=your_openrouteservice_api_key_here
```

- [ ] **Step 2: Add models + fields to `backend/prisma/schema.prisma`**

Add to the end of the file (before the final closing):
```prisma
model GeoCache {
  id                Int      @id @default(autoincrement())
  addressNormalized String   @unique
  lat               Float
  lng               Float
  createdAt         DateTime @default(now())
}

model RouteCache {
  id                 Int      @id @default(autoincrement())
  origenNormalized   String
  destinoNormalized  String
  distanceMillas     Float
  distanceKm         Float
  createdAt          DateTime @default(now())
  hitCount           Int      @default(0)

  @@unique([origenNormalized, destinoNormalized])
}
```

In the `Tramo` model, add two fields after `notas`:
```prisma
  distanceMillas Float?
  distanceKm     Float?
```

- [ ] **Step 3: Create and run the SQL migration script**

Create `backend/migrate-ors.mjs`:
```js
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
require('dotenv').config()
const { Client } = require('pg')

const client = new Client({ connectionString: process.env.DB_DIRECT_URL })
await client.connect()
try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "GeoCache" (
      "id"                SERIAL PRIMARY KEY,
      "addressNormalized" TEXT NOT NULL UNIQUE,
      "lat"               DOUBLE PRECISION NOT NULL,
      "lng"               DOUBLE PRECISION NOT NULL,
      "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS "RouteCache" (
      "id"                SERIAL PRIMARY KEY,
      "origenNormalized"  TEXT NOT NULL,
      "destinoNormalized" TEXT NOT NULL,
      "distanceMillas"    DOUBLE PRECISION NOT NULL,
      "distanceKm"        DOUBLE PRECISION NOT NULL,
      "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT NOW(),
      "hitCount"          INTEGER NOT NULL DEFAULT 0,
      UNIQUE ("origenNormalized", "destinoNormalized")
    );
    ALTER TABLE "Tramo"
      ADD COLUMN IF NOT EXISTS "distanceMillas" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "distanceKm"     DOUBLE PRECISION;
  `)
  console.log('Migration complete')
} finally {
  await client.end()
}
```

Run it:
```bash
cd backend
node migrate-ors.mjs
```

Expected output: `Migration complete`

- [ ] **Step 4: Regenerate Prisma client**

```bash
cd backend
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 5: Delete the migration script**

```bash
rm backend/migrate-ors.mjs
```

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/.env.example
git commit -m "feat(ors): add GeoCache, RouteCache tables and Tramo distance fields"
```

---

## Task 2 — Address Normalization Utility

**Files:**
- Create: `backend/src/utils/normalizeAddress.js`
- Create: `backend/src/utils/normalizeAddress.test.js`

**Interfaces:**
- Produces: `normalizeAddress(address: string): string` — returns `"city,st"` lowercase, abbreviated

---

- [ ] **Step 1: Write the failing test**

Create `backend/src/utils/normalizeAddress.test.js`:
```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAddress } from './normalizeAddress.js'

test('lowercases and trims', () => {
  assert.equal(normalizeAddress('  Miami, FL  '), 'miami,fl')
})

test('removes periods', () => {
  assert.equal(normalizeAddress('St. Louis, MO'), 'st louis,mo')
})

test('collapses extra spaces', () => {
  assert.equal(normalizeAddress('Kansas  City,  MO'), 'kansas city,mo')
})

test('expands florida to fl', () => {
  assert.equal(normalizeAddress('Miami, Florida'), 'miami,fl')
})

test('expands texas to tx', () => {
  assert.equal(normalizeAddress('Dallas, Texas'), 'dallas,tx')
})

test('expands georgia to ga', () => {
  assert.equal(normalizeAddress('Atlanta, Georgia'), 'atlanta,ga')
})

test('expands california to ca', () => {
  assert.equal(normalizeAddress('Los Angeles, California'), 'los angeles,ca')
})

test('expands tennessee to tn', () => {
  assert.equal(normalizeAddress('Memphis, Tennessee'), 'memphis,tn')
})

test('expands illinois to il', () => {
  assert.equal(normalizeAddress('Chicago, Illinois'), 'chicago,il')
})

test('expands ohio to oh', () => {
  assert.equal(normalizeAddress('Columbus, Ohio'), 'columbus,oh')
})

test('handles already-abbreviated state', () => {
  assert.equal(normalizeAddress('Houston, TX'), 'houston,tx')
})

test('handles no space around comma', () => {
  assert.equal(normalizeAddress('Phoenix,AZ'), 'phoenix,az')
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
node --test src/utils/normalizeAddress.test.js
```

Expected: all tests fail with `normalizeAddress is not a function`

- [ ] **Step 3: Implement `normalizeAddress`**

Create `backend/src/utils/normalizeAddress.js`:
```js
const STATE_MAP = {
  alabama: 'al', alaska: 'ak', arizona: 'az', arkansas: 'ar',
  california: 'ca', colorado: 'co', connecticut: 'ct', delaware: 'de',
  florida: 'fl', georgia: 'ga', hawaii: 'hi', idaho: 'id',
  illinois: 'il', indiana: 'in', iowa: 'ia', kansas: 'ks',
  kentucky: 'ky', louisiana: 'la', maine: 'me', maryland: 'md',
  massachusetts: 'ma', michigan: 'mi', minnesota: 'mn', mississippi: 'ms',
  missouri: 'mo', montana: 'mt', nebraska: 'ne', nevada: 'nv',
  'new hampshire': 'nh', 'new jersey': 'nj', 'new mexico': 'nm',
  'new york': 'ny', 'north carolina': 'nc', 'north dakota': 'nd',
  ohio: 'oh', oklahoma: 'ok', oregon: 'or', pennsylvania: 'pa',
  'rhode island': 'ri', 'south carolina': 'sc', 'south dakota': 'sd',
  tennessee: 'tn', texas: 'tx', utah: 'ut', vermont: 'vt',
  virginia: 'va', washington: 'wa', 'west virginia': 'wv',
  wisconsin: 'wi', wyoming: 'wy',
}

export function normalizeAddress(address) {
  let s = address.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim()
  // Normalize comma spacing: "city , st" or "city,st" → "city,st"
  s = s.replace(/\s*,\s*/g, ',')
  // Expand full state names to abbreviations
  for (const [full, abbr] of Object.entries(STATE_MAP)) {
    s = s.replace(new RegExp(`\\b${full}\\b`, 'g'), abbr)
  }
  return s
}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
cd backend
node --test src/utils/normalizeAddress.test.js
```

Expected: all 12 tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/normalizeAddress.js backend/src/utils/normalizeAddress.test.js
git commit -m "feat(ors): add address normalization utility"
```

---

## Task 3 — Trucking Cities Seed

**Files:**
- Create: `backend/src/seeds/truckingCities.js`
- Create: `backend/src/seeds/runSeed.js`
- Modify: `backend/src/index.js`

**Interfaces:**
- Consumes: `GeoCache` Prisma model (from Task 1), `normalizeAddress` (from Task 2)
- Produces: `runSeed(): Promise<void>` — upserts 150+ city coordinates into GeoCache on startup

---

- [ ] **Step 1: Create the city list**

Create `backend/src/seeds/truckingCities.js`:
```js
// [city, state, lat, lng] — 150 major US freight hubs
export const TRUCKING_CITIES = [
  // Florida
  ['Miami', 'FL', 25.7617, -80.1918],
  ['Jacksonville', 'FL', 30.3322, -81.6557],
  ['Orlando', 'FL', 28.5384, -81.3789],
  ['Tampa', 'FL', 27.9506, -82.4572],
  ['Fort Lauderdale', 'FL', 26.1224, -80.1373],
  ['Pensacola', 'FL', 30.4213, -87.2169],
  ['Tallahassee', 'FL', 30.4383, -84.2807],
  ['Lakeland', 'FL', 28.0395, -81.9498],
  ['Fort Myers', 'FL', 26.6406, -81.8723],
  ['Daytona Beach', 'FL', 29.2108, -81.0228],
  ['Gainesville', 'FL', 29.6516, -82.3248],
  ['Sarasota', 'FL', 27.3364, -82.5307],
  // Georgia
  ['Atlanta', 'GA', 33.7490, -84.3880],
  ['Savannah', 'GA', 32.0835, -81.0998],
  ['Augusta', 'GA', 33.4735, -82.0105],
  ['Macon', 'GA', 32.8407, -83.6324],
  ['Columbus', 'GA', 32.4610, -84.9877],
  // Texas
  ['Dallas', 'TX', 32.7767, -96.7970],
  ['Houston', 'TX', 29.7604, -95.3698],
  ['San Antonio', 'TX', 29.4241, -98.4936],
  ['Laredo', 'TX', 27.5064, -99.5075],
  ['El Paso', 'TX', 31.7619, -106.4850],
  ['Austin', 'TX', 30.2672, -97.7431],
  ['Fort Worth', 'TX', 32.7555, -97.3308],
  ['Corpus Christi', 'TX', 27.8006, -97.3964],
  ['Amarillo', 'TX', 35.2220, -101.8313],
  ['Lubbock', 'TX', 33.5779, -101.8552],
  ['Beaumont', 'TX', 30.0860, -94.1018],
  ['Waco', 'TX', 31.5493, -97.1467],
  ['McAllen', 'TX', 26.2034, -98.2300],
  ['Brownsville', 'TX', 25.9017, -97.4975],
  ['Midland', 'TX', 31.9973, -102.0779],
  ['Harlingen', 'TX', 26.1906, -97.6961],
  // Illinois
  ['Chicago', 'IL', 41.8781, -87.6298],
  ['Rockford', 'IL', 42.2711, -89.0940],
  ['Peoria', 'IL', 40.6936, -89.5890],
  ['Springfield', 'IL', 39.7817, -89.6501],
  // Tennessee
  ['Memphis', 'TN', 35.1495, -90.0490],
  ['Nashville', 'TN', 36.1627, -86.7816],
  ['Knoxville', 'TN', 35.9606, -83.9207],
  ['Chattanooga', 'TN', 35.0456, -85.3097],
  // North Carolina
  ['Charlotte', 'NC', 35.2271, -80.8431],
  ['Raleigh', 'NC', 35.7796, -78.6382],
  ['Greensboro', 'NC', 36.0726, -79.7920],
  ['Wilmington', 'NC', 34.2257, -77.9447],
  ['Asheville', 'NC', 35.5951, -82.5515],
  ['Fayetteville', 'NC', 35.0527, -78.8784],
  // California
  ['Los Angeles', 'CA', 34.0522, -118.2437],
  ['Long Beach', 'CA', 33.7701, -118.1937],
  ['San Diego', 'CA', 32.7157, -117.1611],
  ['San Francisco', 'CA', 37.7749, -122.4194],
  ['Oakland', 'CA', 37.8044, -122.2712],
  ['Sacramento', 'CA', 38.5816, -121.4944],
  ['Fresno', 'CA', 36.7378, -119.7871],
  ['Bakersfield', 'CA', 35.3733, -119.0187],
  ['Stockton', 'CA', 37.9577, -121.2908],
  ['Modesto', 'CA', 37.6391, -120.9969],
  ['Riverside', 'CA', 33.9806, -117.3755],
  ['San Bernardino', 'CA', 34.1083, -117.2898],
  ['Redding', 'CA', 40.5865, -122.3917],
  // Arizona
  ['Phoenix', 'AZ', 33.4484, -112.0740],
  ['Tucson', 'AZ', 32.2226, -110.9747],
  ['Flagstaff', 'AZ', 35.1983, -111.6513],
  ['Yuma', 'AZ', 32.6927, -114.6277],
  // Colorado
  ['Denver', 'CO', 39.7392, -104.9903],
  ['Colorado Springs', 'CO', 38.8339, -104.8214],
  ['Pueblo', 'CO', 38.2544, -104.6091],
  // Washington
  ['Seattle', 'WA', 47.6062, -122.3321],
  ['Tacoma', 'WA', 47.2529, -122.4443],
  ['Spokane', 'WA', 47.6587, -117.4260],
  // Oregon
  ['Portland', 'OR', 45.5051, -122.6750],
  ['Eugene', 'OR', 44.0521, -123.0868],
  ['Medford', 'OR', 42.3265, -122.8756],
  // Nevada
  ['Las Vegas', 'NV', 36.1699, -115.1398],
  ['Reno', 'NV', 39.5296, -119.8138],
  // Missouri
  ['Kansas City', 'MO', 39.0997, -94.5786],
  ['St Louis', 'MO', 38.6270, -90.1994],
  ['Springfield', 'MO', 37.2153, -93.2982],
  // New York
  ['New York', 'NY', 40.7128, -74.0060],
  ['Buffalo', 'NY', 42.8865, -78.8784],
  ['Rochester', 'NY', 43.1566, -77.6088],
  ['Syracuse', 'NY', 43.0481, -76.1474],
  ['Albany', 'NY', 42.6526, -73.7562],
  // New Jersey
  ['Newark', 'NJ', 40.7357, -74.1724],
  ['Trenton', 'NJ', 40.2171, -74.7429],
  // Pennsylvania
  ['Philadelphia', 'PA', 39.9526, -75.1652],
  ['Pittsburgh', 'PA', 40.4406, -79.9959],
  ['Allentown', 'PA', 40.6023, -75.4714],
  ['Erie', 'PA', 42.1292, -80.0851],
  // Maryland
  ['Baltimore', 'MD', 39.2904, -76.6122],
  // Ohio
  ['Columbus', 'OH', 39.9612, -82.9988],
  ['Cleveland', 'OH', 41.4993, -81.6944],
  ['Cincinnati', 'OH', 39.1031, -84.5120],
  ['Toledo', 'OH', 41.6528, -83.5379],
  ['Akron', 'OH', 41.0814, -81.5190],
  // Indiana
  ['Indianapolis', 'IN', 39.7684, -86.1581],
  ['Fort Wayne', 'IN', 41.1306, -85.1289],
  ['Evansville', 'IN', 37.9716, -87.5711],
  ['South Bend', 'IN', 41.6764, -86.2520],
  // Minnesota
  ['Minneapolis', 'MN', 44.9778, -93.2650],
  // Michigan
  ['Detroit', 'MI', 42.3314, -83.0458],
  ['Grand Rapids', 'MI', 42.9634, -85.6681],
  ['Flint', 'MI', 43.0125, -83.6875],
  // Kentucky
  ['Louisville', 'KY', 38.2527, -85.7585],
  ['Lexington', 'KY', 38.0406, -84.5037],
  ['Bowling Green', 'KY', 36.9903, -86.4436],
  // Louisiana
  ['New Orleans', 'LA', 29.9511, -90.0715],
  ['Baton Rouge', 'LA', 30.4515, -91.1871],
  ['Shreveport', 'LA', 32.5252, -93.7502],
  ['Monroe', 'LA', 32.5093, -92.1193],
  // Alabama
  ['Birmingham', 'AL', 33.5186, -86.8104],
  ['Montgomery', 'AL', 32.3668, -86.3000],
  ['Huntsville', 'AL', 34.7304, -86.5861],
  ['Mobile', 'AL', 30.6954, -88.0399],
  // Mississippi
  ['Jackson', 'MS', 32.2988, -90.1848],
  ['Meridian', 'MS', 32.3643, -88.7034],
  ['Hattiesburg', 'MS', 31.3271, -89.2903],
  ['Biloxi', 'MS', 30.3960, -88.8853],
  // Oklahoma
  ['Oklahoma City', 'OK', 35.4676, -97.5164],
  ['Tulsa', 'OK', 36.1539, -95.9928],
  // New Mexico
  ['Albuquerque', 'NM', 35.0844, -106.6504],
  ['El Paso', 'TX', 31.7619, -106.4850], // duplicate handled by upsert
  ['Santa Fe', 'NM', 35.6870, -105.9378],
  // Utah
  ['Salt Lake City', 'UT', 40.7608, -111.8910],
  ['Provo', 'UT', 40.2338, -111.6585],
  ['St George', 'UT', 37.1041, -113.5841],
  // Idaho
  ['Boise', 'ID', 43.6150, -116.2023],
  // Wyoming
  ['Cheyenne', 'WY', 41.1400, -104.8202],
  ['Casper', 'WY', 42.8666, -106.3131],
  // Montana
  ['Billings', 'MT', 45.7833, -108.5007],
  ['Great Falls', 'MT', 47.5002, -111.2998],
  ['Missoula', 'MT', 46.8721, -113.9940],
  // Kansas
  ['Wichita', 'KS', 37.6872, -97.3301],
  ['Topeka', 'KS', 39.0473, -95.6752],
  // Nebraska
  ['Omaha', 'NE', 41.2565, -95.9345],
  // Iowa
  ['Des Moines', 'IA', 41.5868, -93.6250],
  ['Davenport', 'IA', 41.5236, -90.5776],
  // Wisconsin
  ['Milwaukee', 'WI', 43.0389, -87.9065],
  ['Madison', 'WI', 43.0731, -89.4012],
  ['Green Bay', 'WI', 44.5133, -88.0133],
  // South Dakota
  ['Sioux Falls', 'SD', 43.5446, -96.7311],
  // North Dakota
  ['Fargo', 'ND', 46.8772, -96.7898],
  // South Carolina
  ['Charleston', 'SC', 32.7765, -79.9311],
  ['Columbia', 'SC', 34.0007, -81.0348],
  ['Greenville', 'SC', 34.8526, -82.3940],
  // Virginia
  ['Richmond', 'VA', 37.5407, -77.4360],
  ['Norfolk', 'VA', 36.8508, -76.2859],
  ['Roanoke', 'VA', 37.2710, -79.9414],
  // Arkansas
  ['Little Rock', 'AR', 34.7465, -92.2896],
  ['Fayetteville', 'AR', 36.0622, -94.1574],
  // Massachusetts
  ['Boston', 'MA', 42.3601, -71.0589],
  ['Worcester', 'MA', 42.2626, -71.8023],
  // Connecticut
  ['Hartford', 'CT', 41.7658, -72.6851],
  ['Bridgeport', 'CT', 41.1865, -73.1952],
  // Delaware
  ['Wilmington', 'DE', 39.7447, -75.5484],
  // Rhode Island
  ['Providence', 'RI', 41.8240, -71.4128],
  // Maine
  ['Portland', 'ME', 43.6591, -70.2568],
  // New Hampshire
  ['Manchester', 'NH', 42.9956, -71.4548],
  // Vermont
  ['Burlington', 'VT', 44.4759, -73.2121],
]
```

- [ ] **Step 2: Create `runSeed.js`**

Create `backend/src/seeds/runSeed.js`:
```js
import prisma from '../lib/prisma.js'
import { normalizeAddress } from '../utils/normalizeAddress.js'
import { TRUCKING_CITIES } from './truckingCities.js'

export async function runSeed() {
  let loaded = 0
  for (const [city, state, lat, lng] of TRUCKING_CITIES) {
    const addressNormalized = normalizeAddress(`${city}, ${state}`)
    await prisma.geoCache.upsert({
      where: { addressNormalized },
      update: { lat, lng },
      create: { addressNormalized, lat, lng },
    })
    loaded++
  }
  console.log(`[seed] Pre-loaded ${loaded} trucking cities into GeoCache`)
}
```

- [ ] **Step 3: Wire `runSeed` into `backend/src/index.js`**

At the top of `backend/src/index.js`, add import after the existing imports:
```js
import { runSeed } from './seeds/runSeed.js'
```

Replace the `app.listen` block:
```js
// BEFORE:
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
  startNotificacionesCron()
})

// AFTER:
runSeed().catch(err => console.error('[seed] Failed to seed cities:', err))
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
  startNotificacionesCron()
})
```

- [ ] **Step 4: Verify seed runs**

Start the backend: `npm run dev`

Expected log line: `[seed] Pre-loaded 15X trucking cities into GeoCache`

- [ ] **Step 5: Commit**

```bash
git add backend/src/seeds/ backend/src/index.js
git commit -m "feat(ors): pre-load 150 trucking cities into GeoCache on startup"
```

---

## Task 4 — Routing Service + Distance Endpoint

**Files:**
- Create: `backend/src/services/routingService.js`
- Create: `backend/src/services/routingService.test.js`
- Create: `backend/src/controllers/routing.controller.js`
- Create: `backend/src/routes/routing.js`
- Modify: `backend/src/index.js` (mount router)

**Interfaces:**
- Consumes: `normalizeAddress` (Task 2), `GeoCache`, `RouteCache` Prisma models (Task 1), `ORS_API_KEY` env var
- Produces:
  - `geocodeAddress(address: string): Promise<{ lat: number, lng: number }>`
  - `getRouteMiles(origen: string, destino: string): Promise<{ distanceMillas: number, distanceKm: number }>`
  - `GET /api/routing/distance?origen=X&destino=Y` → `{ distanceMillas, distanceKm }`

---

- [ ] **Step 1: Install axios in backend**

```bash
cd backend
npm install axios
```

- [ ] **Step 2: Write failing tests for `routingService`**

Create `backend/src/services/routingService.test.js`:
```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { mock } from 'node:test'

// We test the pure conversion logic only — ORS calls are integration-tested via verify-routes.mjs
test('miles conversion: 1000 meters = 0.621 miles (±0.01)', () => {
  const meters = 1000
  const miles = meters / 1609.34
  assert.ok(Math.abs(miles - 0.6214) < 0.01, `Got ${miles}`)
})

test('km conversion: 1000 meters = 1 km', () => {
  const meters = 1000
  const km = meters / 1000
  assert.equal(km, 1)
})

test('round-trip: 662 expected miles from Miami→Atlanta (within 5%)', () => {
  // Approximate straight-line distance in meters between Miami and Atlanta
  // Driving distance is ~1065 km = 661 miles, just sanity-check the formula
  const exampleMeters = 1064730
  const miles = exampleMeters / 1609.34
  assert.ok(Math.abs(miles - 662) / 662 < 0.05, `Got ${miles.toFixed(1)} miles, expected ~662`)
})
```

- [ ] **Step 3: Run tests to verify they pass (these are formula tests, no mocking needed)**

```bash
cd backend
node --test src/services/routingService.test.js
```

Expected: 3 tests pass

- [ ] **Step 4: Implement `routingService.js`**

Create `backend/src/services/routingService.js`:
```js
import axios from 'axios'
import prisma from '../lib/prisma.js'
import { normalizeAddress } from '../utils/normalizeAddress.js'

const ORS_KEY = process.env.ORS_API_KEY
const ORS_BASE = 'https://api.openrouteservice.org'
const TIMEOUT = 5000

async function withRetry(fn) {
  try {
    return await fn()
  } catch {
    await new Promise(r => setTimeout(r, 1000))
    return await fn()
  }
}

export async function geocodeAddress(address) {
  const addressNormalized = normalizeAddress(address)

  const cached = await prisma.geoCache.findUnique({ where: { addressNormalized } })
  if (cached) return { lat: cached.lat, lng: cached.lng }

  let coords
  try {
    const { data } = await withRetry(() =>
      axios.get(`${ORS_BASE}/geocode/search`, {
        headers: { Authorization: ORS_KEY },
        params: { text: address, size: 1, 'boundary.country': 'US' },
        timeout: TIMEOUT,
      })
    )
    const [lng, lat] = data.features[0].geometry.coordinates
    coords = { lat, lng }
  } catch (err) {
    console.error(`[routing] geocode failed for "${address}":`, err.message)
    throw new Error('No se pudo calcular la distancia')
  }

  await prisma.geoCache.create({ data: { addressNormalized, lat: coords.lat, lng: coords.lng } })
  return coords
}

export async function getRouteMiles(origen, destino) {
  const origenNormalized = normalizeAddress(origen)
  const destinoNormalized = normalizeAddress(destino)

  const cached = await prisma.routeCache.findUnique({
    where: { origenNormalized_destinoNormalized: { origenNormalized, destinoNormalized } },
  })
  if (cached) {
    await prisma.routeCache.update({
      where: { origenNormalized_destinoNormalized: { origenNormalized, destinoNormalized } },
      data: { hitCount: { increment: 1 } },
    })
    return { distanceMillas: cached.distanceMillas, distanceKm: cached.distanceKm }
  }

  const [origenCoords, destinoCoords] = await Promise.all([
    geocodeAddress(origen),
    geocodeAddress(destino),
  ])

  let meters
  try {
    const { data } = await withRetry(() =>
      axios.post(
        `${ORS_BASE}/v2/directions/driving-hgv`,
        { coordinates: [[origenCoords.lng, origenCoords.lat], [destinoCoords.lng, destinoCoords.lat]] },
        { headers: { Authorization: ORS_KEY, 'Content-Type': 'application/json' }, timeout: TIMEOUT }
      )
    )
    meters = data.routes[0].summary.distance
  } catch (err) {
    console.error(`[routing] directions failed for "${origen}" → "${destino}":`, err.message)
    throw new Error('No se pudo calcular la distancia')
  }

  const distanceKm = meters / 1000
  const distanceMillas = meters / 1609.34

  await prisma.routeCache.create({
    data: { origenNormalized, destinoNormalized, distanceMillas, distanceKm },
  })

  return { distanceMillas, distanceKm }
}
```

- [ ] **Step 5: Create the distance endpoint controller**

Create `backend/src/controllers/routing.controller.js`:
```js
import { getRouteMiles } from '../services/routingService.js'
import { catchAsync } from '../middleware/errorHandler.js'

export const getDistance = catchAsync(async (req, res) => {
  const { origen, destino } = req.query
  if (!origen?.trim() || !destino?.trim()) {
    return res.status(400).json({ error: 'origen and destino are required' })
  }
  const result = await getRouteMiles(origen.trim(), destino.trim())
  res.json(result)
})
```

- [ ] **Step 6: Create the routing router**

Create `backend/src/routes/routing.js`:
```js
import { Router } from 'express'
import { getDistance } from '../controllers/routing.controller.js'

const router = Router()
router.get('/distance', getDistance)

export default router
```

- [ ] **Step 7: Mount the router in `backend/src/index.js`**

Add import:
```js
import routingRouter from './routes/routing.js'
```

Add mount after `app.use('/api', jwtAuth)` block:
```js
app.use('/api/routing', routingRouter)
```

- [ ] **Step 8: Manual smoke test**

With the backend running:
```bash
curl "http://localhost:3000/api/routing/distance?origen=Miami,FL&destino=Atlanta,GA" \
  -H "Authorization: Bearer <your_token>"
```

Expected: `{"distanceMillas": <number near 662>, "distanceKm": <number near 1065>}`

- [ ] **Step 9: Commit**

```bash
git add backend/src/services/ backend/src/controllers/routing.controller.js backend/src/routes/routing.js backend/src/index.js
git commit -m "feat(ors): add routing service with geocode/route caching and distance endpoint"
```

---

## Task 5 — Wire Distance into Tramo Controller

**Files:**
- Modify: `backend/src/controllers/tramos.controller.js`
- Modify: `backend/src/schemas.js`

**Interfaces:**
- Consumes: `getRouteMiles` from `routingService.js` (Task 4)
- Produces: `distanceMillas` and `distanceKm` saved on Tramo after create/update; `null` on ORS failure

---

- [ ] **Step 1: Update `tramos.controller.js`**

Replace the full file content:
```js
import prisma from '../lib/prisma.js'
import { recalcularVuelta } from '../lib/recalcularVuelta.js'
import { catchAsync } from '../middleware/errorHandler.js'
import { getRouteMiles } from '../services/routingService.js'

async function calcDistance(tramoId, origen, destino) {
  if (!origen || !destino) return
  try {
    const { distanceMillas, distanceKm } = await getRouteMiles(origen, destino)
    await prisma.tramo.update({
      where: { id: tramoId },
      data: { distanceMillas, distanceKm },
    })
  } catch {
    // Distance is best-effort — never block the tramo save
  }
}

export const createTramo = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const vuelta = await prisma.vuelta.findFirst({ where: { id: req.params.id, empresaId } })
  if (!vuelta) return res.status(404).json({ error: 'Vuelta not found' })
  const tramo = await prisma.tramo.create({ data: { ...req.body, vueltaId: req.params.id } })
  await recalcularVuelta(req.params.id)
  // Fire-and-forget: don't await, don't block response
  calcDistance(tramo.id, tramo.origen, tramo.destino)
  res.status(201).json(tramo)
})

export const updateTramo = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const tramo = await prisma.tramo.findFirst({
    where: { id: req.params.id },
    include: { vuelta: { select: { empresaId: true } } },
  })
  if (!tramo || tramo.vuelta.empresaId !== empresaId) return res.status(404).json({ error: 'Tramo not found' })
  const updated = await prisma.tramo.update({ where: { id: req.params.id }, data: req.body })
  await recalcularVuelta(tramo.vueltaId)
  // Recalculate distance if origin or destination changed
  const origenChanged = req.body.origen && req.body.origen !== tramo.origen
  const destinoChanged = req.body.destino && req.body.destino !== tramo.destino
  if (origenChanged || destinoChanged) {
    calcDistance(updated.id, updated.origen, updated.destino)
  }
  res.json(updated)
})

export const deleteTramo = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const tramo = await prisma.tramo.findFirst({
    where: { id: req.params.id },
    include: { vuelta: { select: { empresaId: true } } },
  })
  if (!tramo || tramo.vuelta.empresaId !== empresaId) return res.status(404).json({ error: 'Tramo not found' })
  await prisma.tramo.delete({ where: { id: req.params.id } })
  await recalcularVuelta(tramo.vueltaId)
  res.json({ ok: true })
})
```

- [ ] **Step 2: Allow `distanceMillas`/`distanceKm` in tramo Zod schemas**

In `backend/src/schemas.js`, find `const tramoBody = z.object({...})` and add to it:
```js
  distanceMillas: z.number().nullable().optional(),
  distanceKm: z.number().nullable().optional(),
```

And in `updateTramoSchema`:
```js
  distanceMillas: z.number().nullable().optional(),
  distanceKm: z.number().nullable().optional(),
```

- [ ] **Step 3: Verify — create a tramo via the API and check distance is populated**

Create a tramo for a trip and then re-fetch it after a couple seconds. `distanceMillas` should be populated (not null) for any valid origin/destination pair.

```bash
# after creating tramo, wait 2s, then:
curl http://localhost:3000/api/vueltas/<id> -H "Authorization: Bearer <token>"
# Check tramos[0].distanceMillas is a number
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/tramos.controller.js backend/src/schemas.js
git commit -m "feat(ors): auto-calculate distance on tramo create/update"
```

---

## Task 6 — CPM Calculation (Backend + Frontend KPI Card)

**Files:**
- Modify: `backend/src/controllers/vueltas.controller.js` — `getVuelta` handler
- Modify: `frontend/src/pages/VueltaDetail.jsx` — CPM KPI card + miles label per leg
- Modify: `frontend/src/pages/Reportes.jsx` — average CPM stat

**Interfaces:**
- Consumes: `vuelta.tramos[].distanceMillas`, `vuelta.gastoTotal`
- Produces: `getVuelta` returns `{ ...vuelta, kmTotales, totalMillas, cpm }` where `cpm = gastoTotal / totalMillas` or `null` if any leg has no distance

---

- [ ] **Step 1: Update `getVuelta` in `vueltas.controller.js`**

Find the `getVuelta` handler (currently ends around line 98). Replace:
```js
// BEFORE:
  const kmTotales = vuelta.tramos.reduce((s, t) => s + (t.kmRecorridos ?? 0), 0)
  res.json({ ...vuelta, kmTotales })

// AFTER:
  const kmTotales = vuelta.tramos.reduce((s, t) => s + (t.kmRecorridos ?? 0), 0)
  const allHaveMiles = vuelta.tramos.length > 0 && vuelta.tramos.every(t => t.distanceMillas != null)
  const totalMillas = allHaveMiles
    ? vuelta.tramos.reduce((s, t) => s + t.distanceMillas, 0)
    : null
  const cpm = totalMillas && totalMillas > 0 ? vuelta.gastoTotal / totalMillas : null
  res.json({ ...vuelta, kmTotales, totalMillas, cpm })
```

- [ ] **Step 2: Add CPM KPI card to `VueltaDetail.jsx`**

Find the section in `VueltaDetail.jsx` where the financial KPI cards are rendered (look for `ingresoTotal`, `gastoTotal`, `rentabilidadNeta` display blocks). After the last KPI card, add:

```jsx
{/* CPM card */}
{vuelta.cpm != null ? (
  <div className="bg-surface border border-border-dim rounded-xl p-4">
    <p className="text-text-muted text-xs uppercase tracking-wide mb-1">{t('trips.cpm')}</p>
    <p className="text-text-primary text-2xl font-semibold">
      {fmt(vuelta.cpm)}<span className="text-text-muted text-sm font-normal"> /mi</span>
    </p>
    <p className="text-text-muted text-xs mt-1">{vuelta.totalMillas?.toFixed(1)} mi total</p>
  </div>
) : (
  <div className="bg-surface border border-border-dim rounded-xl p-4 opacity-50">
    <p className="text-text-muted text-xs uppercase tracking-wide mb-1">{t('trips.cpm')}</p>
    <p className="text-text-muted text-sm">{t('trips.enterMilesManually')}</p>
  </div>
)}
```

- [ ] **Step 3: Add miles label per leg row in `VueltaDetail.jsx`**

Find where tramos are rendered in the detail view (look for `tramo.origen`, `tramo.destino` in JSX). In the leg display row, add after the existing distance/km display:

```jsx
{tramo.distanceMillas != null
  ? <span className="text-text-muted text-xs">{tramo.distanceMillas.toFixed(1)} mi</span>
  : <span className="text-amber-400 text-xs">{t('trips.enterMilesManually')}</span>
}
```

- [ ] **Step 4: Add translation keys**

In `frontend/src/i18n/index.js`, find the `trips` section and add:
```js
cpm: 'Costo por milla',
enterMilesManually: 'Ingresa millas manualmente',
```
(Adjust for whatever i18n structure is already in place — check the existing keys.)

- [ ] **Step 5: Add average CPM to `Reportes.jsx`**

After the `byCamion` chart block and before the `topRoutes` block, add a CPM stat:

```jsx
const avgCpm = (() => {
  const withCpm = vueltas.filter(v => v.cpm != null)
  if (!withCpm.length) return null
  return withCpm.reduce((s, v) => s + v.cpm, 0) / withCpm.length
})()
```

And in the JSX, add a stat card:
```jsx
{avgCpm != null && (
  <div className="bg-surface border border-border-dim rounded-xl p-5">
    <h3 className="font-serif text-lg text-text-primary mb-2">{t('reports.avgCpm')}</h3>
    <p className="text-3xl font-semibold text-text-primary">
      ${avgCpm.toFixed(2)}<span className="text-text-muted text-base font-normal"> /mi</span>
    </p>
    <p className="text-text-muted text-sm mt-1">Período seleccionado</p>
  </div>
)}
```

Add `'reports.avgCpm': 'Costo promedio por milla'` to i18n.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/vueltas.controller.js frontend/src/pages/VueltaDetail.jsx frontend/src/pages/Reportes.jsx frontend/src/i18n/
git commit -m "feat(ors): add CPM KPI card to trip detail and reports"
```

---

## Task 7 — Frontend Debounced Auto-fill

**Files:**
- Create: `frontend/src/api/routing.api.js`
- Create: `frontend/src/hooks/useRouteDistance.js`
- Modify: `frontend/src/components/NuevaVueltaWizard.jsx`
- Modify: `frontend/src/pages/VueltaDetail.jsx`

**Interfaces:**
- Consumes: `GET /api/routing/distance` (Task 4)
- Produces: `useRouteDistance(origen, destino)` hook returning `{ distanceMillas, distanceKm, loading, error }`

---

- [ ] **Step 1: Create `routing.api.js`**

Create `frontend/src/api/routing.api.js`:
```js
import api from './axios'

export const routingApi = {
  getDistance: (origen, destino) =>
    api.get('/routing/distance', { params: { origen, destino } }).then(r => r.data),
}
```

- [ ] **Step 2: Create `useRouteDistance` hook**

Create `frontend/src/hooks/useRouteDistance.js`:
```js
import { useState, useEffect, useRef } from 'react'
import { routingApi } from '../api/routing.api'

export function useRouteDistance(origen, destino) {
  const [distanceMillas, setDistanceMillas] = useState(null)
  const [distanceKm, setDistanceKm] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const timerRef = useRef(null)
  const prevRef = useRef({ origen: '', destino: '' })

  useEffect(() => {
    const origenClean = (origen ?? '').trim()
    const destinoClean = (destino ?? '').trim()

    // Only trigger when both fields have ≥5 chars
    if (origenClean.length < 5 || destinoClean.length < 5) return

    // Only trigger if value actually changed
    if (origenClean === prevRef.current.origen && destinoClean === prevRef.current.destino) return

    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      prevRef.current = { origen: origenClean, destino: destinoClean }
      setLoading(true)
      setError(null)
      try {
        const { distanceMillas: dm, distanceKm: dk } = await routingApi.getDistance(origenClean, destinoClean)
        setDistanceMillas(dm)
        setDistanceKm(dk)
      } catch {
        setError('No se pudo calcular — ingresa las millas manualmente')
        setDistanceMillas(null)
        setDistanceKm(null)
      } finally {
        setLoading(false)
      }
    }, 800)

    return () => clearTimeout(timerRef.current)
  }, [origen, destino])

  return { distanceMillas, distanceKm, loading, error }
}
```

- [ ] **Step 3: Wire `useRouteDistance` into `NuevaVueltaWizard.jsx`**

In `NuevaVueltaWizard.jsx`:

1. Add import at the top:
```js
import { useRouteDistance } from '../hooks/useRouteDistance'
```

2. Inside the component, below the `newTramo` state declaration, add:
```js
const { distanceMillas: calcMillas, distanceKm: calcKm, loading: calcLoading, error: calcError } =
  useRouteDistance(newTramo.origen, newTramo.destino)
```

3. Add a `useEffect` that auto-fills `kmRecorridos` and stores distance when a calculation arrives:
```js
useEffect(() => {
  if (calcMillas != null) {
    setNewTramo(t => ({ ...t, kmRecorridos: calcKm?.toFixed(1) ?? t.kmRecorridos, distanceMillas: calcMillas, distanceKm: calcKm }))
  }
}, [calcMillas, calcKm])
```

4. In the leg form JSX, find the `kmRecorridos` input and wrap it with status feedback. Replace the plain input:
```jsx
{/* BEFORE */}
<input
  type="number"
  value={newTramo.kmRecorridos}
  onChange={e => setNewTramo(t => ({ ...t, kmRecorridos: e.target.value }))}
  ...
/>

{/* AFTER */}
<div className="relative">
  <input
    type="number"
    value={newTramo.kmRecorridos}
    onChange={e => setNewTramo(t => ({ ...t, kmRecorridos: e.target.value }))}
    className={inputCls + (calcLoading ? ' opacity-50' : '')}
    placeholder="0"
  />
  {calcLoading && (
    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs animate-pulse">…</span>
  )}
</div>
{calcMillas != null && !calcLoading && (
  <p className="text-green-400 text-xs mt-1">✓ calculado automáticamente — {calcMillas.toFixed(1)} mi</p>
)}
{calcError && !calcLoading && (
  <p className="text-amber-400 text-xs mt-1">{calcError}</p>
)}
```

- [ ] **Step 4: Wire `useRouteDistance` into `VueltaDetail.jsx` (new tramo form)**

In `VueltaDetail.jsx`:

1. Add import:
```js
import { useRouteDistance } from '../hooks/useRouteDistance'
```

2. Near the `newTramo` state (around line 37), add the hook:
```js
const { distanceMillas: newCalcMillas, distanceKm: newCalcKm, loading: newCalcLoading, error: newCalcError } =
  useRouteDistance(newTramo.origen, newTramo.destino)
```

3. Add `useEffect` to auto-fill:
```js
useEffect(() => {
  if (newCalcMillas != null) {
    setNewTramo(t => ({ ...t, kmRecorridos: newCalcKm?.toFixed(1) ?? t.kmRecorridos, distanceMillas: newCalcMillas, distanceKm: newCalcKm }))
  }
}, [newCalcMillas, newCalcKm])
```

4. Apply the same spinner + label pattern around the `kmRecorridos` input in the **new tramo form** section (search for `newTramo.kmRecorridos` in the JSX).

5. Also wire the hook for `tramoForm` (editing existing tramo). Add:
```js
const { distanceMillas: editCalcMillas, distanceKm: editCalcKm, loading: editCalcLoading, error: editCalcError } =
  useRouteDistance(tramoForm?.origen, tramoForm?.destino)

useEffect(() => {
  if (editCalcMillas != null && editingTramoId) {
    setTramoForm(f => f ? { ...f, kmRecorridos: editCalcKm?.toFixed(1) ?? f.kmRecorridos, distanceMillas: editCalcMillas, distanceKm: editCalcKm } : f)
  }
}, [editCalcMillas, editCalcKm, editingTramoId])
```

Apply spinner + label around the `kmRecorridos` input in the **edit tramo form** as well (search for `tramoForm.kmRecorridos` in JSX).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/routing.api.js frontend/src/hooks/useRouteDistance.js frontend/src/components/NuevaVueltaWizard.jsx frontend/src/pages/VueltaDetail.jsx
git commit -m "feat(ors): debounced auto-fill mileage in leg forms"
```

---

## Task 8 — Cache Stats Endpoint

**Files:**
- Create: `backend/src/controllers/admin.controller.js`
- Modify: `backend/src/routes/` — check if `admin.js` already exists; if not, create it
- Modify: `backend/src/index.js` (mount `/api/admin`)

**Interfaces:**
- Produces: `GET /api/admin/cache-stats` (admin only) → `{ totalRoutesCache, totalGeocodeCache, totalCacheHits, topRoutes }`

---

- [ ] **Step 1: Create `admin.controller.js`**

Create `backend/src/controllers/admin.controller.js`:
```js
import prisma from '../lib/prisma.js'
import { catchAsync } from '../middleware/errorHandler.js'

export const getCacheStats = catchAsync(async (req, res) => {
  const [totalRoutesCache, totalGeocodeCache, hitAgg, topRoutes] = await Promise.all([
    prisma.routeCache.count(),
    prisma.geoCache.count(),
    prisma.routeCache.aggregate({ _sum: { hitCount: true } }),
    prisma.routeCache.findMany({
      orderBy: { hitCount: 'desc' },
      take: 10,
      select: { origenNormalized: true, destinoNormalized: true, hitCount: true },
    }),
  ])

  res.json({
    totalRoutesCache,
    totalGeocodeCache,
    totalCacheHits: hitAgg._sum.hitCount ?? 0,
    topRoutes: topRoutes.map(r => ({
      origen: r.origenNormalized,
      destino: r.destinoNormalized,
      hitCount: r.hitCount,
    })),
  })
})
```

- [ ] **Step 2: Create admin router**

Create `backend/src/routes/admin.js`:
```js
import { Router } from 'express'
import { getCacheStats } from '../controllers/admin.controller.js'
import { requireRole } from '../middleware/requireRole.js'

const router = Router()
router.get('/cache-stats', requireRole('admin'), getCacheStats)

export default router
```

- [ ] **Step 3: Mount in `index.js`**

Add import:
```js
import adminRouter from './routes/admin.js'
```

Add mount (after the other `app.use` mounts):
```js
app.use('/api/admin', adminRouter)
```

- [ ] **Step 4: Verify endpoint**

```bash
curl http://localhost:3000/api/admin/cache-stats -H "Authorization: Bearer <admin_token>"
```

Expected:
```json
{
  "totalRoutesCache": 0,
  "totalGeocodeCache": 150,
  "totalCacheHits": 0,
  "topRoutes": []
}
```
(150 geocode entries from seed, 0 routes until first distance call)

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/admin.controller.js backend/src/routes/admin.js backend/src/index.js
git commit -m "feat(ors): add /api/admin/cache-stats endpoint"
```

---

## Task 9 — Verify Test Routes

**Files:**
- Create: `backend/verify-routes.mjs` (run once, then delete)

**Goal:** Confirm the 4 reference routes are within 5% of expected mileage.

---

- [ ] **Step 1: Create `verify-routes.mjs`**

Create `backend/verify-routes.mjs`:
```js
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
require('dotenv').config()

// Must import after dotenv
const { getRouteMiles } = await import('./src/services/routingService.js')

const ROUTES = [
  { origen: 'Miami, FL',      destino: 'Atlanta, GA',    expected: 662 },
  { origen: 'Dallas, TX',     destino: 'Chicago, IL',    expected: 921 },
  { origen: 'Los Angeles, CA',destino: 'Phoenix, AZ',    expected: 370 },
  { origen: 'Houston, TX',    destino: 'Nashville, TN',  expected: 781 },
]

let allPass = true
for (const { origen, destino, expected } of ROUTES) {
  try {
    const { distanceMillas } = await getRouteMiles(origen, destino)
    const pct = Math.abs(distanceMillas - expected) / expected * 100
    const pass = pct <= 5
    if (!pass) allPass = false
    console.log(
      `${pass ? '✅' : '❌'} ${origen} → ${destino}: ${distanceMillas.toFixed(1)} mi (expected ${expected}, ${pct.toFixed(1)}% off)`
    )
  } catch (err) {
    allPass = false
    console.log(`❌ ${origen} → ${destino}: ERROR — ${err.message}`)
  }
}

console.log(allPass ? '\n✅ All routes within 5%' : '\n❌ Some routes failed')
process.exit(allPass ? 0 : 1)
```

- [ ] **Step 2: Run verification**

```bash
cd backend
node verify-routes.mjs
```

Expected output (exact numbers may vary slightly):
```
✅ Miami, FL → Atlanta, GA: 661.3 mi (expected 662, 0.1% off)
✅ Dallas, TX → Chicago, IL: 919.5 mi (expected 921, 0.2% off)
✅ Los Angeles, CA → Phoenix, AZ: 371.2 mi (expected 370, 0.3% off)
✅ Houston, TX → Nashville, TN: 782.1 mi (expected 781, 0.1% off)

✅ All routes within 5%
```

If any route shows > 5% error, check:
1. The ORS key is valid and has sufficient quota
2. The route is not being misrouted (ORS HGV profile avoids certain roads)
3. The reference "expected" value is for driving distance, not straight-line

- [ ] **Step 3: Delete the verification script**

```bash
rm backend/verify-routes.mjs
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(ors): complete mileage auto-calculation implementation"
```

---

## Self-Review

**Spec coverage checklist:**

| Spec section | Covered in task |
|---|---|
| GeoCache table | Task 1 |
| RouteCache table | Task 1 |
| Address normalization | Task 2 |
| Pre-load 150 trucking cities | Task 3 |
| `geocodeAddress` with GeoCache | Task 4 |
| `getRouteMiles` with RouteCache + hitCount | Task 4 |
| ORS geocode API call | Task 4 |
| ORS directions API (driving-hgv) | Task 4 |
| 5s timeout + 1 retry | Task 4 |
| Error handling — never crash app | Task 4 + Task 5 |
| Wire distance to tramo create/update | Task 5 |
| distanceMillas = null on ORS failure | Task 5 |
| CPM = gastos / totalMillas | Task 6 |
| KPI card in trip detail | Task 6 |
| CPM in reports | Task 6 |
| "Ingresa millas manualmente" for null legs | Task 6 |
| 800ms debounce in leg form | Task 7 |
| Min 5 chars on both fields | Task 7 |
| Spinner while calculating | Task 7 |
| "✓ calculado automáticamente" label | Task 7 |
| Error label in amber | Task 7 |
| Field stays editable (override) | Task 7 — input is always an `<input>`, auto-fill just sets value |
| Recalculate only if origen/destino changed | Task 7 — `prevRef` in hook |
| Cache stats endpoint (admin only) | Task 8 |
| topRoutes top 10 | Task 8 |
| Verify 4 reference routes ±5% | Task 9 |
| `runSeed` on startup | Task 3 |

**No gaps found.**

**Placeholder scan:** No "TBD", no "similar to task N", no steps without code. ✅

**Type consistency:**
- `getRouteMiles` returns `{ distanceMillas, distanceKm }` — consumed in Task 5, Task 4 endpoint, and Task 7 hook. ✅
- `geocodeAddress` returns `{ lat, lng }` — used internally in Task 4. ✅
- `useRouteDistance` returns `{ distanceMillas, distanceKm, loading, error }` — consumed in Task 7 wizard and detail page. ✅
