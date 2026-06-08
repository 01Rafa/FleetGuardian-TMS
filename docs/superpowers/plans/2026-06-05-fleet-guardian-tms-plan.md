# Fleet Guardian TMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack fleet management web app with Vuelta Completa round-trip grouping, aggregated financials, JWT auth, and a dark gold-accented UI.

**Architecture:** Lean monorepo — `frontend/` (Vite + React 18 + Tailwind + React Query) deploys to Vercel; `backend/` (Express + Prisma) deploys to Railway; PostgreSQL on Supabase shared for dev and prod.

**Tech Stack:** React 18, Vite, Tailwind CSS, React Query v5, React Router v6, @dnd-kit/sortable, Recharts, Node.js, Express, Prisma ORM, PostgreSQL (Supabase), JWT, bcryptjs, cookie-parser

---

## File Map

### Backend
```
backend/
├── package.json
├── .env
├── src/
│   ├── index.js                        ← Express app entry, CORS, cookie-parser, routes
│   ├── lib/
│   │   ├── prisma.js                   ← Prisma client singleton
│   │   └── jwt.js                      ← signAccess, signRefresh, verifyAccess, verifyRefresh
│   ├── middleware/
│   │   ├── auth.js                     ← jwtAuth middleware (extracts userId, empresaId, rol)
│   │   └── errorHandler.js             ← global error handler + catchAsync wrapper
│   ├── routes/
│   │   ├── auth.js
│   │   ├── vueltas.js
│   │   ├── tramos.js
│   │   ├── gastos.js
│   │   ├── camiones.js
│   │   ├── conductores.js
│   │   └── dashboard.js
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── vueltas.controller.js
│   │   ├── tramos.controller.js
│   │   ├── gastos.controller.js
│   │   ├── camiones.controller.js
│   │   ├── conductores.controller.js
│   │   └── dashboard.controller.js
│   └── lib/
│       └── recalcularVuelta.js         ← shared recalc utility
└── prisma/
    ├── schema.prisma
    └── seed.js
```

### Frontend
```
frontend/
├── package.json
├── vite.config.js
├── tailwind.config.js
├── index.html                          ← Google Fonts: Playfair Display + Inter
└── src/
    ├── main.jsx
    ├── App.jsx                         ← Router + AuthProvider + QueryClientProvider
    ├── api/
    │   ├── axios.js                    ← axios instance, interceptors, refresh logic
    │   ├── auth.api.js
    │   ├── vueltas.api.js
    │   ├── tramos.api.js
    │   ├── gastos.api.js
    │   ├── camiones.api.js
    │   ├── conductores.api.js
    │   └── dashboard.api.js
    ├── hooks/
    │   ├── useAuth.js                  ← AuthContext consumer
    │   └── useVueltas.js               ← React Query hooks for vueltas resource
    ├── context/
    │   └── AuthContext.jsx
    ├── components/
    │   ├── StatCard.jsx
    │   ├── StatusBadge.jsx
    │   ├── VueltaTable.jsx
    │   ├── TramoTimeline.jsx
    │   ├── GastosDonut.jsx
    │   ├── NuevaVueltaWizard.jsx
    │   ├── Layout.jsx                  ← sidebar + topbar shell
    │   └── ProtectedRoute.jsx
    └── pages/
        ├── Login.jsx
        ├── Dashboard.jsx
        ├── Vueltas.jsx
        ├── VueltaDetail.jsx
        ├── Flota.jsx
        ├── Conductores.jsx
        └── Reportes.jsx
```

---

## Task 1: Backend scaffold + Prisma schema

**Files:**
- Create: `backend/package.json`
- Create: `backend/.env`
- Create: `backend/prisma/schema.prisma`
- Create: `backend/src/lib/prisma.js`

- [ ] **Step 1: Init backend package**

```bash
cd "Fleet Guardian TMS"
mkdir backend && cd backend
npm init -y
npm install express prisma @prisma/client bcryptjs jsonwebtoken cookie-parser cors dotenv
npm install --save-dev nodemon
```

- [ ] **Step 2: Create `backend/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Empresa {
  id          String      @id @default(uuid())
  nombre      String
  ruc         String?
  plan        String      @default("basic")
  creadoEn    DateTime    @default(now())
  camiones    Camion[]
  conductores Conductor[]
  vueltas     Vuelta[]
  usuarios    Usuario[]
}

model Usuario {
  id        String   @id @default(uuid())
  empresaId String
  empresa   Empresa  @relation(fields: [empresaId], references: [id])
  nombre    String
  email     String   @unique
  password  String
  rol       String   @default("dispatcher")
  creadoEn  DateTime @default(now())
}

model Camion {
  id           String   @id @default(uuid())
  empresaId    String
  empresa      Empresa  @relation(fields: [empresaId], references: [id])
  placa        String
  modelo       String
  anio         Int?
  capacidadTon Float?
  tipo         String
  estado       String   @default("disponible")
  vueltas      Vuelta[]
}

model Conductor {
  id        String   @id @default(uuid())
  empresaId String
  empresa   Empresa  @relation(fields: [empresaId], references: [id])
  nombre    String
  licencia  String?
  telefono  String?
  estado    String   @default("activo")
  vueltas   Vuelta[]
}

model Vuelta {
  id               String      @id @default(uuid())
  empresaId        String
  empresa          Empresa     @relation(fields: [empresaId], references: [id])
  camionId         String
  camion           Camion      @relation(fields: [camionId], references: [id])
  conductorId      String
  conductor        Conductor   @relation(fields: [conductorId], references: [id])
  codigo           String      @unique
  baseSalida       String
  fechaSalida      DateTime
  fechaRegreso     DateTime?
  estado           String      @default("planificada")
  ingresoTotal     Float       @default(0)
  gastoTotal       Float       @default(0)
  rentabilidadNeta Float       @default(0)
  notas            String?
  creadoEn         DateTime    @default(now())
  tramos           Tramo[]
  gastos           Gasto[]
}

model Tramo {
  id           String    @id @default(uuid())
  vueltaId     String
  vuelta       Vuelta    @relation(fields: [vueltaId], references: [id], onDelete: Cascade)
  orden        Int
  origen       String
  destino      String
  kmRecorridos Float?
  cargaTon     Float?
  fleteCobrado Float     @default(0)
  tipo         String    @default("carga")
  fechaHora    DateTime?
  notas        String?
  gastos       Gasto[]
}

model Gasto {
  id          String   @id @default(uuid())
  vueltaId    String
  vuelta      Vuelta   @relation(fields: [vueltaId], references: [id], onDelete: Cascade)
  tramoId     String?
  tramo       Tramo?   @relation(fields: [tramoId], references: [id])
  categoria   String
  monto       Float
  descripcion String?
  fecha       DateTime @default(now())
}
```

- [ ] **Step 3: Create `backend/.env`**

```
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
JWT_SECRET=change_me_32chars_minimum_secret
JWT_REFRESH_SECRET=change_me_different_32chars_secret
PORT=3000
FRONTEND_URL=http://localhost:5173
```

- [ ] **Step 4: Run Prisma migration**

```bash
cd backend
npx prisma migrate dev --name init
```

Expected: Migration applied, Prisma client generated.

- [ ] **Step 5: Create `backend/src/lib/prisma.js`**

```js
import { PrismaClient } from '@prisma/client'

const prisma = global.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') global.prisma = prisma

export default prisma
```

- [ ] **Step 6: Add scripts to `backend/package.json`**

```json
{
  "type": "module",
  "scripts": {
    "dev": "nodemon src/index.js",
    "start": "node src/index.js",
    "seed": "node prisma/seed.js"
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat: backend scaffold, Prisma schema, initial migration"
```

---

## Task 2: JWT utils + auth middleware

**Files:**
- Create: `backend/src/lib/jwt.js`
- Create: `backend/src/middleware/auth.js`
- Create: `backend/src/middleware/errorHandler.js`

- [ ] **Step 1: Create `backend/src/lib/jwt.js`**

```js
import jwt from 'jsonwebtoken'

export function signAccess(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' })
}

export function signRefresh(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' })
}

export function verifyAccess(token) {
  return jwt.verify(token, process.env.JWT_SECRET)
}

export function verifyRefresh(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET)
}
```

- [ ] **Step 2: Create `backend/src/middleware/errorHandler.js`**

```js
export function catchAsync(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}

export function errorHandler(err, req, res, next) {
  const status = err.status ?? 500
  const message = err.message ?? 'Internal server error'
  if (status === 500) console.error(err)
  res.status(status).json({ error: message })
}
```

- [ ] **Step 3: Create `backend/src/middleware/auth.js`**

```js
import { verifyAccess } from '../lib/jwt.js'

export function jwtAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }
  try {
    const payload = verifyAccess(header.slice(7))
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/
git commit -m "feat: JWT utils and auth middleware"
```

---

## Task 3: Express app entry + auth routes

**Files:**
- Create: `backend/src/index.js`
- Create: `backend/src/routes/auth.js`
- Create: `backend/src/controllers/auth.controller.js`

- [ ] **Step 1: Create `backend/src/index.js`**

```js
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { errorHandler } from './middleware/errorHandler.js'
import authRouter from './routes/auth.js'
import vueltasRouter from './routes/vueltas.js'
import tramosRouter from './routes/tramos.js'
import gastosRouter from './routes/gastos.js'
import camionesRouter from './routes/camiones.js'
import conductoresRouter from './routes/conductores.js'
import dashboardRouter from './routes/dashboard.js'
import { jwtAuth } from './middleware/auth.js'

const app = express()

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.use('/api/auth', authRouter)
app.use('/api', jwtAuth)
app.use('/api/vueltas', vueltasRouter)
app.use('/api/tramos', tramosRouter)
app.use('/api/gastos', gastosRouter)
app.use('/api/camiones', camionesRouter)
app.use('/api/conductores', conductoresRouter)
app.use('/api/dashboard', dashboardRouter)

app.use(errorHandler)

const PORT = process.env.PORT ?? 3000
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`))
```

- [ ] **Step 2: Create `backend/src/controllers/auth.controller.js`**

```js
import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma.js'
import { signAccess, signRefresh, verifyRefresh } from '../lib/jwt.js'
import { catchAsync } from '../middleware/errorHandler.js'

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'none',
  secure: true,
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body
  const user = await prisma.usuario.findUnique({ where: { email } })
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

  const payload = { userId: user.id, empresaId: user.empresaId, rol: user.rol }
  const accessToken = signAccess(payload)
  const refreshToken = signRefresh(payload)

  res.cookie('refreshToken', refreshToken, COOKIE_OPTS)
  res.json({ accessToken, user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol } })
})

export const refresh = catchAsync(async (req, res) => {
  const token = req.cookies?.refreshToken
  if (!token) return res.status(401).json({ error: 'No refresh token' })

  const payload = verifyRefresh(token)
  const accessToken = signAccess({ userId: payload.userId, empresaId: payload.empresaId, rol: payload.rol })
  res.json({ accessToken })
})

export const logout = catchAsync(async (req, res) => {
  res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'none', secure: true })
  res.json({ ok: true })
})
```

- [ ] **Step 3: Create `backend/src/routes/auth.js`**

```js
import { Router } from 'express'
import { login, refresh, logout } from '../controllers/auth.controller.js'

const router = Router()
router.post('/login', login)
router.post('/refresh', refresh)
router.post('/logout', logout)

export default router
```

- [ ] **Step 4: Start server and test login**

```bash
cd backend && npm run dev
# In another terminal:
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo1234"}'
```

Expected: `401` (no user yet — seed not run). Server should start without errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/
git commit -m "feat: Express entry, auth routes and controller"
```

---

## Task 4: recalcularVuelta utility + Vuelta CRUD

**Files:**
- Create: `backend/src/lib/recalcularVuelta.js`
- Create: `backend/src/controllers/vueltas.controller.js`
- Create: `backend/src/routes/vueltas.js`

- [ ] **Step 1: Create `backend/src/lib/recalcularVuelta.js`**

```js
import prisma from './prisma.js'

export async function recalcularVuelta(vueltaId, tx = prisma) {
  const [tramoAgg, gastoAgg] = await Promise.all([
    tx.tramo.aggregate({ where: { vueltaId }, _sum: { fleteCobrado: true } }),
    tx.gasto.aggregate({ where: { vueltaId }, _sum: { monto: true } }),
  ])
  const ingresoTotal = tramoAgg._sum.fleteCobrado ?? 0
  const gastoTotal = gastoAgg._sum.monto ?? 0
  await tx.vuelta.update({
    where: { id: vueltaId },
    data: { ingresoTotal, gastoTotal, rentabilidadNeta: ingresoTotal - gastoTotal },
  })
}
```

- [ ] **Step 2: Create `backend/src/controllers/vueltas.controller.js`**

```js
import prisma from '../lib/prisma.js'
import { recalcularVuelta } from '../lib/recalcularVuelta.js'
import { catchAsync } from '../middleware/errorHandler.js'

async function generarCodigo(empresaId) {
  const year = new Date().getFullYear()
  const count = await prisma.vuelta.count({
    where: { empresaId, creadoEn: { gte: new Date(`${year}-01-01`) } },
  })
  return `VLT-${year}-${String(count + 1).padStart(3, '0')}`
}

export const listVueltas = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const { estado, camionId, fechaDesde, fechaHasta } = req.query
  const where = { empresaId }
  if (estado) where.estado = estado
  if (camionId) where.camionId = camionId
  if (fechaDesde || fechaHasta) {
    where.fechaSalida = {}
    if (fechaDesde) where.fechaSalida.gte = new Date(fechaDesde)
    if (fechaHasta) where.fechaSalida.lte = new Date(fechaHasta)
  }
  const vueltas = await prisma.vuelta.findMany({
    where,
    include: { camion: true, conductor: true },
    orderBy: { creadoEn: 'desc' },
  })
  res.json(vueltas)
})

export const createVuelta = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const codigo = await generarCodigo(empresaId)
  const vuelta = await prisma.vuelta.create({
    data: { ...req.body, empresaId, codigo },
  })
  res.status(201).json(vuelta)
})

export const getVuelta = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const vuelta = await prisma.vuelta.findFirst({
    where: { id: req.params.id, empresaId },
    include: {
      camion: true,
      conductor: true,
      tramos: { orderBy: { orden: 'asc' }, include: { gastos: true } },
      gastos: { orderBy: { fecha: 'asc' } },
    },
  })
  if (!vuelta) return res.status(404).json({ error: 'Vuelta not found' })
  const kmTotales = vuelta.tramos.reduce((s, t) => s + (t.kmRecorridos ?? 0), 0)
  res.json({ ...vuelta, kmTotales })
})

export const updateVuelta = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const vuelta = await prisma.vuelta.findFirst({ where: { id: req.params.id, empresaId } })
  if (!vuelta) return res.status(404).json({ error: 'Vuelta not found' })
  const updated = await prisma.vuelta.update({ where: { id: req.params.id }, data: req.body })
  res.json(updated)
})

export const deleteVuelta = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const vuelta = await prisma.vuelta.findFirst({ where: { id: req.params.id, empresaId } })
  if (!vuelta) return res.status(404).json({ error: 'Vuelta not found' })
  await prisma.vuelta.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})

export const changeEstado = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const vuelta = await prisma.vuelta.findFirst({ where: { id: req.params.id, empresaId } })
  if (!vuelta) return res.status(404).json({ error: 'Vuelta not found' })
  const updated = await prisma.vuelta.update({
    where: { id: req.params.id },
    data: { estado: req.body.estado },
  })
  res.json(updated)
})
```

- [ ] **Step 3: Create `backend/src/routes/vueltas.js`**

```js
import { Router } from 'express'
import { listVueltas, createVuelta, getVuelta, updateVuelta, deleteVuelta, changeEstado } from '../controllers/vueltas.controller.js'

const router = Router()
router.get('/', listVueltas)
router.post('/', createVuelta)
router.get('/:id', getVuelta)
router.put('/:id', updateVuelta)
router.delete('/:id', deleteVuelta)
router.patch('/:id/estado', changeEstado)

export default router
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/
git commit -m "feat: vueltas CRUD with recalcularVuelta utility"
```

---

## Task 5: Tramos + Gastos controllers and routes

**Files:**
- Create: `backend/src/controllers/tramos.controller.js`
- Create: `backend/src/routes/tramos.js`
- Create: `backend/src/controllers/gastos.controller.js`
- Create: `backend/src/routes/gastos.js`

- [ ] **Step 1: Create `backend/src/controllers/tramos.controller.js`**

```js
import prisma from '../lib/prisma.js'
import { recalcularVuelta } from '../lib/recalcularVuelta.js'
import { catchAsync } from '../middleware/errorHandler.js'

export const createTramo = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const vuelta = await prisma.vuelta.findFirst({ where: { id: req.params.vueltaId, empresaId } })
  if (!vuelta) return res.status(404).json({ error: 'Vuelta not found' })
  const tramo = await prisma.tramo.create({ data: { ...req.body, vueltaId: req.params.vueltaId } })
  await recalcularVuelta(req.params.vueltaId)
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

- [ ] **Step 2: Create `backend/src/routes/tramos.js`**

```js
import { Router } from 'express'
import { updateTramo, deleteTramo } from '../controllers/tramos.controller.js'
import { createTramo } from '../controllers/tramos.controller.js'

const router = Router()
router.put('/:id', updateTramo)
router.delete('/:id', deleteTramo)

export default router
```

Note: `POST /api/vueltas/:id/tramos` is mounted in `vueltas.js` — add this to `backend/src/routes/vueltas.js`:

```js
import { createTramo } from '../controllers/tramos.controller.js'
// add after existing routes:
router.post('/:id/tramos', createTramo)
```

- [ ] **Step 3: Create `backend/src/controllers/gastos.controller.js`**

```js
import prisma from '../lib/prisma.js'
import { recalcularVuelta } from '../lib/recalcularVuelta.js'
import { catchAsync } from '../middleware/errorHandler.js'

export const createGasto = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const vuelta = await prisma.vuelta.findFirst({ where: { id: req.params.vueltaId, empresaId } })
  if (!vuelta) return res.status(404).json({ error: 'Vuelta not found' })
  const gasto = await prisma.gasto.create({ data: { ...req.body, vueltaId: req.params.vueltaId } })
  await recalcularVuelta(req.params.vueltaId)
  res.status(201).json(gasto)
})

export const updateGasto = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const gasto = await prisma.gasto.findFirst({
    where: { id: req.params.id },
    include: { vuelta: { select: { empresaId: true } } },
  })
  if (!gasto || gasto.vuelta.empresaId !== empresaId) return res.status(404).json({ error: 'Gasto not found' })
  const updated = await prisma.gasto.update({ where: { id: req.params.id }, data: req.body })
  await recalcularVuelta(gasto.vueltaId)
  res.json(updated)
})

export const deleteGasto = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const gasto = await prisma.gasto.findFirst({
    where: { id: req.params.id },
    include: { vuelta: { select: { empresaId: true } } },
  })
  if (!gasto || gasto.vuelta.empresaId !== empresaId) return res.status(404).json({ error: 'Gasto not found' })
  await prisma.gasto.delete({ where: { id: req.params.id } })
  await recalcularVuelta(gasto.vueltaId)
  res.json({ ok: true })
})
```

- [ ] **Step 4: Create `backend/src/routes/gastos.js`**

```js
import { Router } from 'express'
import { updateGasto, deleteGasto } from '../controllers/gastos.controller.js'

const router = Router()
router.put('/:id', updateGasto)
router.delete('/:id', deleteGasto)

export default router
```

Add to `backend/src/routes/vueltas.js`:
```js
import { createGasto } from '../controllers/gastos.controller.js'
// add after existing routes:
router.post('/:id/gastos', createGasto)
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/
git commit -m "feat: tramos and gastos CRUD with auto-recalculation"
```

---

## Task 6: Camiones, Conductores, Dashboard routes

**Files:**
- Create: `backend/src/controllers/camiones.controller.js`
- Create: `backend/src/routes/camiones.js`
- Create: `backend/src/controllers/conductores.controller.js`
- Create: `backend/src/routes/conductores.js`
- Create: `backend/src/controllers/dashboard.controller.js`
- Create: `backend/src/routes/dashboard.js`

- [ ] **Step 1: Create `backend/src/controllers/camiones.controller.js`**

```js
import prisma from '../lib/prisma.js'
import { catchAsync } from '../middleware/errorHandler.js'

export const listCamiones = catchAsync(async (req, res) => {
  const camiones = await prisma.camion.findMany({ where: { empresaId: req.user.empresaId }, orderBy: { placa: 'asc' } })
  res.json(camiones)
})

export const createCamion = catchAsync(async (req, res) => {
  const camion = await prisma.camion.create({ data: { ...req.body, empresaId: req.user.empresaId } })
  res.status(201).json(camion)
})

export const updateCamion = catchAsync(async (req, res) => {
  const camion = await prisma.camion.findFirst({ where: { id: req.params.id, empresaId: req.user.empresaId } })
  if (!camion) return res.status(404).json({ error: 'Camion not found' })
  const updated = await prisma.camion.update({ where: { id: req.params.id }, data: req.body })
  res.json(updated)
})
```

- [ ] **Step 2: Create `backend/src/routes/camiones.js`**

```js
import { Router } from 'express'
import { listCamiones, createCamion, updateCamion } from '../controllers/camiones.controller.js'

const router = Router()
router.get('/', listCamiones)
router.post('/', createCamion)
router.put('/:id', updateCamion)
export default router
```

- [ ] **Step 3: Create `backend/src/controllers/conductores.controller.js`**

```js
import prisma from '../lib/prisma.js'
import { catchAsync } from '../middleware/errorHandler.js'

export const listConductores = catchAsync(async (req, res) => {
  const conductores = await prisma.conductor.findMany({ where: { empresaId: req.user.empresaId }, orderBy: { nombre: 'asc' } })
  res.json(conductores)
})

export const createConductor = catchAsync(async (req, res) => {
  const conductor = await prisma.conductor.create({ data: { ...req.body, empresaId: req.user.empresaId } })
  res.status(201).json(conductor)
})

export const updateConductor = catchAsync(async (req, res) => {
  const conductor = await prisma.conductor.findFirst({ where: { id: req.params.id, empresaId: req.user.empresaId } })
  if (!conductor) return res.status(404).json({ error: 'Conductor not found' })
  const updated = await prisma.conductor.update({ where: { id: req.params.id }, data: req.body })
  res.json(updated)
})
```

- [ ] **Step 4: Create `backend/src/routes/conductores.js`**

```js
import { Router } from 'express'
import { listConductores, createConductor, updateConductor } from '../controllers/conductores.controller.js'

const router = Router()
router.get('/', listConductores)
router.post('/', createConductor)
router.put('/:id', updateConductor)
export default router
```

- [ ] **Step 5: Create `backend/src/controllers/dashboard.controller.js`**

```js
import prisma from '../lib/prisma.js'
import { catchAsync } from '../middleware/errorHandler.js'

export const getStats = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)

  const [vueltasActivas, semanaAgg, totalCamiones, camionesEnRuta] = await Promise.all([
    prisma.vuelta.count({ where: { empresaId, estado: { in: ['planificada', 'en_curso'] } } }),
    prisma.vuelta.aggregate({
      where: { empresaId, fechaSalida: { gte: weekStart } },
      _sum: { ingresoTotal: true, gastoTotal: true, rentabilidadNeta: true },
    }),
    prisma.camion.count({ where: { empresaId } }),
    prisma.camion.count({ where: { empresaId, estado: 'en_ruta' } }),
  ])

  res.json({
    vueltasActivas,
    ingresoSemana: semanaAgg._sum.ingresoTotal ?? 0,
    gastoSemana: semanaAgg._sum.gastoTotal ?? 0,
    rentabilidadSemana: semanaAgg._sum.rentabilidadNeta ?? 0,
    flotaUtilization: totalCamiones > 0 ? Math.round((camionesEnRuta / totalCamiones) * 100) : 0,
    totalCamiones,
    camionesEnRuta,
  })
})
```

- [ ] **Step 6: Create `backend/src/routes/dashboard.js`**

```js
import { Router } from 'express'
import { getStats } from '../controllers/dashboard.controller.js'

const router = Router()
router.get('/stats', getStats)
export default router
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/
git commit -m "feat: camiones, conductores, dashboard routes"
```

---

## Task 7: Seed database

**Files:**
- Create: `backend/prisma/seed.js`

- [ ] **Step 1: Create `backend/prisma/seed.js`**

```js
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const empresa = await prisma.empresa.create({
    data: { nombre: 'Transportes Demo S.A.', ruc: '20123456789' },
  })

  await prisma.usuario.create({
    data: {
      empresaId: empresa.id,
      nombre: 'Admin Demo',
      email: 'admin@demo.com',
      password: await bcrypt.hash('demo1234', 10),
      rol: 'admin',
    },
  })

  const [c1, c2, c3] = await Promise.all([
    prisma.camion.create({ data: { empresaId: empresa.id, placa: 'ABC-123', modelo: 'Volvo FH16', anio: 2021, capacidadTon: 30, tipo: 'reefer', estado: 'en_ruta' } }),
    prisma.camion.create({ data: { empresaId: empresa.id, placa: 'DEF-456', modelo: 'Scania R450', anio: 2020, capacidadTon: 28, tipo: 'flatbed', estado: 'disponible' } }),
    prisma.camion.create({ data: { empresaId: empresa.id, placa: 'GHI-789', modelo: 'Mercedes Actros', anio: 2022, capacidadTon: 25, tipo: 'dry_van', estado: 'disponible' } }),
  ])

  const [d1, d2, d3] = await Promise.all([
    prisma.conductor.create({ data: { empresaId: empresa.id, nombre: 'Carlos Ramírez', licencia: 'A3-001', telefono: '999111222' } }),
    prisma.conductor.create({ data: { empresaId: empresa.id, nombre: 'Luis Mendoza', licencia: 'A3-002', telefono: '999333444' } }),
    prisma.conductor.create({ data: { empresaId: empresa.id, nombre: 'Ana Torres', licencia: 'A3-003', telefono: '999555666' } }),
  ])

  const vueltas = [
    { camion: c1, conductor: d1, estado: 'en_curso', base: 'Lima', dias: -2 },
    { camion: c2, conductor: d2, estado: 'completada', base: 'Lima', dias: -7 },
    { camion: c3, conductor: d3, estado: 'planificada', base: 'Lima', dias: 1 },
    { camion: c1, conductor: d1, estado: 'facturada', base: 'Lima', dias: -14 },
    { camion: c2, conductor: d2, estado: 'completada', base: 'Lima', dias: -10 },
  ]

  for (let i = 0; i < vueltas.length; i++) {
    const v = vueltas[i]
    const year = new Date().getFullYear()
    const codigo = `VLT-${year}-${String(i + 1).padStart(3, '0')}`
    const fechaSalida = new Date()
    fechaSalida.setDate(fechaSalida.getDate() + v.dias)

    const vuelta = await prisma.vuelta.create({
      data: {
        empresaId: empresa.id,
        camionId: v.camion.id,
        conductorId: v.conductor.id,
        codigo,
        baseSalida: v.base,
        fechaSalida,
        estado: v.estado,
      },
    })

    await prisma.tramo.createMany({
      data: [
        { vueltaId: vuelta.id, orden: 1, origen: 'Lima', destino: 'Arequipa', kmRecorridos: 1009, cargaTon: 20, fleteCobrado: 4500, tipo: 'carga' },
        { vueltaId: vuelta.id, orden: 2, origen: 'Arequipa', destino: 'Cusco', kmRecorridos: 521, cargaTon: 15, fleteCobrado: 2800, tipo: 'carga' },
        { vueltaId: vuelta.id, orden: 3, origen: 'Cusco', destino: 'Lima', kmRecorridos: 1105, cargaTon: 0, fleteCobrado: 0, tipo: 'regreso' },
      ],
    })

    await prisma.gasto.createMany({
      data: [
        { vueltaId: vuelta.id, categoria: 'combustible', monto: 1200, descripcion: 'Diésel tramo Lima-Arequipa' },
        { vueltaId: vuelta.id, categoria: 'peaje', monto: 180, descripcion: 'Peajes autopista' },
        { vueltaId: vuelta.id, categoria: 'viatico', monto: 250, descripcion: 'Alojamiento y comida conductor' },
        { vueltaId: vuelta.id, categoria: 'mantenimiento', monto: 120, descripcion: 'Cambio de aceite' },
        { vueltaId: vuelta.id, categoria: 'otro', monto: 50, descripcion: 'Lavado unidad' },
      ],
    })

    const { PrismaClient: PC } = await import('@prisma/client')
    const { recalcularVuelta } = await import('../src/lib/recalcularVuelta.js')
    await recalcularVuelta(vuelta.id)
  }

  console.log('Seed completed.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Run seed**

```bash
cd backend && npm run seed
```

Expected: `Seed completed.`

- [ ] **Step 3: Test login with seeded user**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo1234"}'
```

Expected: `{ "accessToken": "eyJ...", "user": { ... } }`

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/seed.js
git commit -m "feat: seed with 1 empresa, 3 camiones, 3 conductores, 5 vueltas"
```

---

## Task 8: Frontend scaffold + Tailwind + design tokens

**Files:**
- Create: `frontend/` (Vite project)
- Create: `frontend/tailwind.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.jsx`

- [ ] **Step 1: Scaffold Vite React app**

```bash
cd "Fleet Guardian TMS"
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install @tanstack/react-query axios react-router-dom react-hook-form @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities recharts
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 2: Create `frontend/tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'bg-base': '#0E0E0E',
        'bg-deep': '#0a0a0a',
        surface: '#161616',
        'surface-2': '#1E1E1E',
        gold: '#C9A84C',
        'gold-dim': 'rgba(201,168,76,0.18)',
        'text-primary': '#F0EDE6',
        'text-muted': '#888580',
        success: '#4CAF7D',
        danger: '#E05252',
        'border-dim': 'rgba(255,255,255,0.07)',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 3: Update `frontend/index.html`**

```html
<!DOCTYPE html>
<html lang="es" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Fleet Guardian TMS</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet" />
  </head>
  <body class="bg-bg-base text-text-primary font-sans antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create `frontend/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: Create `frontend/src/main.jsx`**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)
```

- [ ] **Step 6: Create `frontend/vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: frontend scaffold, Tailwind with Fleet Guardian design tokens"
```

---

## Task 9: AuthContext + axios instance + API layer

**Files:**
- Create: `frontend/src/context/AuthContext.jsx`
- Create: `frontend/src/hooks/useAuth.js`
- Create: `frontend/src/api/axios.js`
- Create: `frontend/src/api/auth.api.js`
- Create: `frontend/src/api/vueltas.api.js`
- Create: `frontend/src/api/camiones.api.js`
- Create: `frontend/src/api/conductores.api.js`
- Create: `frontend/src/api/dashboard.api.js`

- [ ] **Step 1: Create `frontend/src/context/AuthContext.jsx`**

```jsx
import { createContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '../api/auth.api'
import { setAccessToken, getAccessToken } from '../api/axios'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshSession = useCallback(async () => {
    try {
      const { accessToken, user: u } = await authApi.refresh()
      setAccessToken(accessToken)
      setUser(u)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refreshSession() }, [refreshSession])

  const login = async (email, password) => {
    const { accessToken, user: u } = await authApi.login(email, password)
    setAccessToken(accessToken)
    setUser(u)
  }

  const logout = async () => {
    await authApi.logout()
    setAccessToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
```

- [ ] **Step 2: Create `frontend/src/hooks/useAuth.js`**

```js
import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

- [ ] **Step 3: Create `frontend/src/api/axios.js`**

```js
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL ?? ''

let accessToken = null
export const setAccessToken = (t) => { accessToken = t }
export const getAccessToken = () => accessToken

const api = axios.create({ baseURL: `${API_URL}/api`, withCredentials: true })

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

let isRefreshing = false
let failedQueue = []
const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => error ? reject(error) : resolve(token))
  failedQueue = []
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        })
      }
      original._retry = true
      isRefreshing = true
      try {
        const { data } = await axios.post(`${API_URL}/api/auth/refresh`, {}, { withCredentials: true })
        setAccessToken(data.accessToken)
        processQueue(null, data.accessToken)
        original.headers.Authorization = `Bearer ${data.accessToken}`
        return api(original)
      } catch (err) {
        processQueue(err)
        setAccessToken(null)
        window.location.href = '/login'
        return Promise.reject(err)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

export default api
```

- [ ] **Step 4: Create `frontend/src/api/auth.api.js`**

```js
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL ?? ''

export const authApi = {
  login: async (email, password) => {
    const { data } = await axios.post(`${API_URL}/api/auth/login`, { email, password }, { withCredentials: true })
    return data
  },
  refresh: async () => {
    const { data } = await axios.post(`${API_URL}/api/auth/refresh`, {}, { withCredentials: true })
    return data
  },
  logout: async () => {
    await axios.post(`${API_URL}/api/auth/logout`, {}, { withCredentials: true })
  },
}
```

- [ ] **Step 5: Create `frontend/src/api/vueltas.api.js`**

```js
import api from './axios'

export const vueltasApi = {
  list: (params) => api.get('/vueltas', { params }).then(r => r.data),
  get: (id) => api.get(`/vueltas/${id}`).then(r => r.data),
  create: (data) => api.post('/vueltas', data).then(r => r.data),
  update: (id, data) => api.put(`/vueltas/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/vueltas/${id}`).then(r => r.data),
  changeEstado: (id, estado) => api.patch(`/vueltas/${id}/estado`, { estado }).then(r => r.data),
  createTramo: (vueltaId, data) => api.post(`/vueltas/${vueltaId}/tramos`, data).then(r => r.data),
  createGasto: (vueltaId, data) => api.post(`/vueltas/${vueltaId}/gastos`, data).then(r => r.data),
}

export const tramosApi = {
  update: (id, data) => api.put(`/tramos/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/tramos/${id}`).then(r => r.data),
}

export const gastosApi = {
  update: (id, data) => api.put(`/gastos/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/gastos/${id}`).then(r => r.data),
}
```

- [ ] **Step 6: Create remaining API files**

`frontend/src/api/camiones.api.js`:
```js
import api from './axios'
export const camionesApi = {
  list: () => api.get('/camiones').then(r => r.data),
  create: (data) => api.post('/camiones', data).then(r => r.data),
  update: (id, data) => api.put(`/camiones/${id}`, data).then(r => r.data),
}
```

`frontend/src/api/conductores.api.js`:
```js
import api from './axios'
export const conductoresApi = {
  list: () => api.get('/conductores').then(r => r.data),
  create: (data) => api.post('/conductores', data).then(r => r.data),
  update: (id, data) => api.put(`/conductores/${id}`, data).then(r => r.data),
}
```

`frontend/src/api/dashboard.api.js`:
```js
import api from './axios'
export const dashboardApi = {
  stats: () => api.get('/dashboard/stats').then(r => r.data),
}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/
git commit -m "feat: AuthContext, axios instance with refresh interceptor, API layer"
```

---

## Task 10: App router + Layout + ProtectedRoute

**Files:**
- Create: `frontend/src/App.jsx`
- Create: `frontend/src/components/Layout.jsx`
- Create: `frontend/src/components/ProtectedRoute.jsx`

- [ ] **Step 1: Create `frontend/src/components/ProtectedRoute.jsx`**

```jsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen bg-bg-base"><div className="text-gold text-lg">Cargando...</div></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}
```

- [ ] **Step 2: Create `frontend/src/components/Layout.jsx`**

```jsx
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/vueltas', label: 'Vueltas' },
  { to: '/flota', label: 'Flota' },
  { to: '/conductores', label: 'Conductores' },
  { to: '/reportes', label: 'Reportes' },
]

export function Layout({ children }) {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-bg-base">
      <aside className="w-56 flex-shrink-0 bg-surface border-r border-border-dim flex flex-col">
        <div className="px-5 py-6 border-b border-border-dim">
          <h1 className="font-serif text-xl text-gold leading-tight">Fleet<br/>Guardian</h1>
          <p className="text-text-muted text-xs mt-0.5">TMS</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`block px-3 py-2 rounded text-sm transition-colors ${
                pathname.startsWith(to)
                  ? 'bg-gold-dim text-gold font-medium'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-border-dim">
          <p className="text-text-muted text-xs mb-2 truncate">{user?.nombre}</p>
          <button onClick={handleLogout} className="text-text-muted text-xs hover:text-danger transition-colors">
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 3: Create `frontend/src/App.jsx`**

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Vueltas from './pages/Vueltas'
import VueltaDetail from './pages/VueltaDetail'
import NuevaVueltaWizard from './components/NuevaVueltaWizard'
import Flota from './pages/Flota'
import Conductores from './pages/Conductores'
import Reportes from './pages/Reportes'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/vueltas" element={<ProtectedRoute><Layout><Vueltas /></Layout></ProtectedRoute>} />
      <Route path="/vueltas/nueva" element={<ProtectedRoute><Layout><NuevaVueltaWizard /></Layout></ProtectedRoute>} />
      <Route path="/vueltas/:id" element={<ProtectedRoute><Layout><VueltaDetail /></Layout></ProtectedRoute>} />
      <Route path="/flota" element={<ProtectedRoute><Layout><Flota /></Layout></ProtectedRoute>} />
      <Route path="/conductores" element={<ProtectedRoute><Layout><Conductores /></Layout></ProtectedRoute>} />
      <Route path="/reportes" element={<ProtectedRoute><Layout><Reportes /></Layout></ProtectedRoute>} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: App router, Layout sidebar, ProtectedRoute"
```

---

## Task 11: Shared UI components

**Files:**
- Create: `frontend/src/components/StatCard.jsx`
- Create: `frontend/src/components/StatusBadge.jsx`
- Create: `frontend/src/components/VueltaTable.jsx`
- Create: `frontend/src/components/TramoTimeline.jsx`
- Create: `frontend/src/components/GastosDonut.jsx`

- [ ] **Step 1: Create `frontend/src/components/StatCard.jsx`**

```jsx
export function StatCard({ label, value, prefix = '', suffix = '', trend }) {
  return (
    <div className="bg-surface border border-border-dim rounded-xl p-5">
      <p className="text-text-muted text-xs font-medium uppercase tracking-wide mb-2">{label}</p>
      <p className="text-gold font-serif text-3xl font-bold">
        {prefix}{typeof value === 'number' ? value.toLocaleString('es-PE') : value}{suffix}
      </p>
      {trend !== undefined && (
        <p className={`text-xs mt-1 ${trend >= 0 ? 'text-success' : 'text-danger'}`}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% vs semana anterior
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `frontend/src/components/StatusBadge.jsx`**

```jsx
const styles = {
  en_curso:    'bg-success/20 text-success border-success/30',
  planificada: 'bg-gold/20 text-gold border-gold/30',
  completada:  'bg-text-muted/20 text-text-muted border-text-muted/30',
  facturada:   'bg-blue-500/20 text-blue-400 border-blue-500/30',
  disponible:  'bg-success/20 text-success border-success/30',
  en_ruta:     'bg-gold/20 text-gold border-gold/30',
  mantenimiento: 'bg-danger/20 text-danger border-danger/30',
}
const labels = {
  en_curso: 'En Curso', planificada: 'Planificada', completada: 'Completada',
  facturada: 'Facturada', disponible: 'Disponible', en_ruta: 'En Ruta', mantenimiento: 'Mantenimiento',
}

export function StatusBadge({ estado }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[estado] ?? 'bg-surface-2 text-text-muted border-border-dim'}`}>
      {labels[estado] ?? estado}
    </span>
  )
}
```

- [ ] **Step 3: Create `frontend/src/components/VueltaTable.jsx`**

```jsx
import { useNavigate } from 'react-router-dom'
import { StatusBadge } from './StatusBadge'

export function VueltaTable({ vueltas = [] }) {
  const navigate = useNavigate()
  return (
    <div className="overflow-x-auto rounded-xl border border-border-dim">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-dim bg-surface-2">
            {['Código','Ruta','Camión','Conductor','Ingreso','Gasto','Rentabilidad','Estado'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-text-muted font-medium text-xs uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vueltas.map((v) => (
            <tr
              key={v.id}
              onClick={() => navigate(`/vueltas/${v.id}`)}
              className="border-b border-border-dim hover:bg-surface-2 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3 text-gold font-medium">{v.codigo}</td>
              <td className="px-4 py-3 text-text-primary">{v.baseSalida} → destino</td>
              <td className="px-4 py-3 text-text-muted">{v.camion?.placa}</td>
              <td className="px-4 py-3 text-text-muted">{v.conductor?.nombre}</td>
              <td className="px-4 py-3 text-success">S/ {v.ingresoTotal.toLocaleString('es-PE')}</td>
              <td className="px-4 py-3 text-danger">S/ {v.gastoTotal.toLocaleString('es-PE')}</td>
              <td className={`px-4 py-3 font-medium ${v.rentabilidadNeta >= 0 ? 'text-success' : 'text-danger'}`}>
                S/ {v.rentabilidadNeta.toLocaleString('es-PE')}
              </td>
              <td className="px-4 py-3"><StatusBadge estado={v.estado} /></td>
            </tr>
          ))}
          {vueltas.length === 0 && (
            <tr><td colSpan={8} className="px-4 py-8 text-center text-text-muted">No hay vueltas</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Create `frontend/src/components/TramoTimeline.jsx`**

```jsx
export function TramoTimeline({ tramos = [], baseSalida }) {
  const stops = [baseSalida, ...tramos.map(t => t.destino)]
  return (
    <div className="flex items-start gap-0 overflow-x-auto pb-2">
      {stops.map((stop, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`w-3 h-3 rounded-full border-2 ${i === 0 || i === stops.length - 1 ? 'border-gold bg-gold' : 'border-gold bg-transparent'}`} />
            <p className="text-text-primary text-xs mt-1 whitespace-nowrap max-w-[80px] text-center">{stop}</p>
            {i < tramos.length && (
              <p className="text-text-muted text-xs mt-0.5">S/ {tramos[i].fleteCobrado.toLocaleString('es-PE')}</p>
            )}
          </div>
          {i < stops.length - 1 && (
            <div className="flex flex-col items-center mx-1">
              <div className="h-0.5 w-16 bg-gold-dim mt-1.5" />
              <p className="text-text-muted text-xs mt-1">{tramos[i]?.kmRecorridos ?? '–'} km</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Create `frontend/src/components/GastosDonut.jsx`**

```jsx
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = { combustible: '#C9A84C', peaje: '#4CAF7D', viatico: '#60a5fa', mantenimiento: '#E05252', otro: '#888580' }

export function GastosDonut({ gastos = [] }) {
  const grouped = gastos.reduce((acc, g) => {
    acc[g.categoria] = (acc[g.categoria] ?? 0) + g.monto
    return acc
  }, {})
  const data = Object.entries(grouped).map(([name, value]) => ({ name, value }))
  if (data.length === 0) return <p className="text-text-muted text-sm">Sin gastos registrados</p>
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
          {data.map((entry) => <Cell key={entry.name} fill={COLORS[entry.name] ?? '#888580'} />)}
        </Pie>
        <Tooltip formatter={(v) => `S/ ${v.toLocaleString('es-PE')}`} contentStyle={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8 }} />
        <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-text-muted text-xs capitalize">{v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/
git commit -m "feat: StatCard, StatusBadge, VueltaTable, TramoTimeline, GastosDonut"
```

---

## Task 12: Login page

**Files:**
- Create: `frontend/src/pages/Login.jsx`

- [ ] **Step 1: Create `frontend/src/pages/Login.jsx`**

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch {
      setError('Credenciales inválidas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-deep flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="font-serif text-4xl text-gold">Fleet Guardian</h1>
          <p className="text-text-muted text-sm mt-2">Transportation Management System</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-surface border border-border-dim rounded-2xl p-8 space-y-5">
          <div>
            <label className="block text-text-muted text-xs font-medium uppercase tracking-wide mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface-2 border border-border-dim rounded-lg px-3 py-2.5 text-text-primary text-sm focus:outline-none focus:border-gold transition-colors"
              placeholder="admin@demo.com"
              required
            />
          </div>
          <div>
            <label className="block text-text-muted text-xs font-medium uppercase tracking-wide mb-1.5">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface-2 border border-border-dim rounded-lg px-3 py-2.5 text-text-primary text-sm focus:outline-none focus:border-gold transition-colors"
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p className="text-danger text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold text-bg-deep font-semibold py-2.5 rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Start frontend dev server and test login page**

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173/login`. Expected: Fleet Guardian login form with dark theme and gold accents.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Login.jsx
git commit -m "feat: Login page with Fleet Guardian branding"
```

---

## Task 13: Dashboard page

**Files:**
- Create: `frontend/src/pages/Dashboard.jsx`

- [ ] **Step 1: Create `frontend/src/pages/Dashboard.jsx`**

```jsx
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { dashboardApi } from '../api/dashboard.api'
import { vueltasApi } from '../api/vueltas.api'
import { StatCard } from '../components/StatCard'
import { StatusBadge } from '../components/StatusBadge'

export default function Dashboard() {
  const navigate = useNavigate()
  const { data: stats } = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.stats })
  const { data: vueltas = [] } = useQuery({
    queryKey: ['vueltas', 'activas'],
    queryFn: () => vueltasApi.list({ estado: 'en_curso' }),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl text-text-primary">Dashboard</h2>
        <button
          onClick={() => navigate('/vueltas/nueva')}
          className="bg-gold text-bg-deep font-semibold px-4 py-2 rounded-lg hover:bg-gold/90 transition-colors text-sm"
        >
          + Nueva Vuelta
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Vueltas Activas" value={stats?.vueltasActivas ?? 0} />
        <StatCard label="Ingreso Semana" value={stats?.ingresoSemana ?? 0} prefix="S/ " />
        <StatCard label="Gasto Semana" value={stats?.gastoSemana ?? 0} prefix="S/ " />
        <StatCard label="Rentabilidad Neta" value={stats?.rentabilidadSemana ?? 0} prefix="S/ " />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-surface border border-border-dim rounded-xl p-5">
          <h3 className="font-serif text-lg text-text-primary mb-4">Vueltas en Curso</h3>
          <div className="space-y-3">
            {vueltas.map((v) => (
              <div
                key={v.id}
                onClick={() => navigate(`/vueltas/${v.id}`)}
                className="flex items-center justify-between p-3 bg-surface-2 rounded-lg cursor-pointer hover:border-gold-dim border border-border-dim transition-colors"
              >
                <div>
                  <p className="text-gold text-sm font-medium">{v.codigo}</p>
                  <p className="text-text-muted text-xs">{v.camion?.placa} · {v.conductor?.nombre}</p>
                </div>
                <div className="text-right">
                  <p className="text-success text-sm">S/ {v.ingresoTotal.toLocaleString('es-PE')}</p>
                  <StatusBadge estado={v.estado} />
                </div>
              </div>
            ))}
            {vueltas.length === 0 && <p className="text-text-muted text-sm">No hay vueltas en curso</p>}
          </div>
        </div>

        <div className="bg-surface border border-border-dim rounded-xl p-5">
          <h3 className="font-serif text-lg text-text-primary mb-4">Utilización Flota</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-text-muted mb-1">
                <span>En Ruta</span>
                <span>{stats?.camionesEnRuta ?? 0} / {stats?.totalCamiones ?? 0}</span>
              </div>
              <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gold rounded-full transition-all"
                  style={{ width: `${stats?.flotaUtilization ?? 0}%` }}
                />
              </div>
              <p className="text-gold text-xs mt-1">{stats?.flotaUtilization ?? 0}% utilización</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify dashboard loads with seeded data**

Login as `admin@demo.com` / `demo1234`, navigate to `/dashboard`. Expected: stat cards show real numbers from seeded vueltas.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Dashboard.jsx
git commit -m "feat: Dashboard page with stat cards, active vueltas list, fleet utilization"
```

---

## Task 14: Vueltas list page

**Files:**
- Create: `frontend/src/pages/Vueltas.jsx`

- [ ] **Step 1: Create `frontend/src/pages/Vueltas.jsx`**

```jsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { vueltasApi } from '../api/vueltas.api'
import { camionesApi } from '../api/camiones.api'
import { VueltaTable } from '../components/VueltaTable'

const ESTADOS = ['', 'planificada', 'en_curso', 'completada', 'facturada']

export default function Vueltas() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState({ estado: '', camionId: '', fechaDesde: '', fechaHasta: '' })

  const { data: vueltas = [], isLoading } = useQuery({
    queryKey: ['vueltas', filters],
    queryFn: () => vueltasApi.list(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))),
  })
  const { data: camiones = [] } = useQuery({ queryKey: ['camiones'], queryFn: camionesApi.list })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl text-text-primary">Vueltas</h2>
        <button
          onClick={() => navigate('/vueltas/nueva')}
          className="bg-gold text-bg-deep font-semibold px-4 py-2 rounded-lg hover:bg-gold/90 transition-colors text-sm"
        >
          + Nueva Vuelta
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={filters.estado}
          onChange={(e) => setFilters(f => ({ ...f, estado: e.target.value }))}
          className="bg-surface border border-border-dim rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-gold"
        >
          <option value="">Todos los estados</option>
          {ESTADOS.filter(Boolean).map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select
          value={filters.camionId}
          onChange={(e) => setFilters(f => ({ ...f, camionId: e.target.value }))}
          className="bg-surface border border-border-dim rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-gold"
        >
          <option value="">Todos los camiones</option>
          {camiones.map(c => <option key={c.id} value={c.id}>{c.placa}</option>)}
        </select>
        <input
          type="date"
          value={filters.fechaDesde}
          onChange={(e) => setFilters(f => ({ ...f, fechaDesde: e.target.value }))}
          className="bg-surface border border-border-dim rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-gold"
        />
        <input
          type="date"
          value={filters.fechaHasta}
          onChange={(e) => setFilters(f => ({ ...f, fechaHasta: e.target.value }))}
          className="bg-surface border border-border-dim rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-gold"
        />
      </div>

      {isLoading ? (
        <p className="text-text-muted">Cargando vueltas...</p>
      ) : (
        <VueltaTable vueltas={vueltas} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Vueltas.jsx
git commit -m "feat: Vueltas list page with filter bar"
```

---

## Task 15: NuevaVueltaWizard (3-step form)

**Files:**
- Create: `frontend/src/components/NuevaVueltaWizard.jsx`

- [ ] **Step 1: Create `frontend/src/components/NuevaVueltaWizard.jsx`**

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { camionesApi } from '../api/camiones.api'
import { conductoresApi } from '../api/conductores.api'
import { vueltasApi } from '../api/vueltas.api'

const TIPOS_TRAMO = ['carga', 'vacio', 'regreso']
const CATEGORIAS = ['combustible', 'peaje', 'viatico', 'mantenimiento', 'otro']

function SortableTramo({ tramo, index, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: tramo.tempId })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-3 bg-surface-2 border border-border-dim rounded-lg">
      <span {...attributes} {...listeners} className="text-text-muted cursor-grab text-lg">⠿</span>
      <div className="flex-1 grid grid-cols-2 gap-2 text-xs text-text-muted">
        <span>{tramo.origen} → {tramo.destino}</span>
        <span>S/ {tramo.fleteCobrado} · {tramo.tipo}</span>
      </div>
      <button onClick={() => onRemove(index)} className="text-danger text-xs hover:opacity-80">✕</button>
    </div>
  )
}

export default function NuevaVueltaWizard() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [step, setStep] = useState(1)

  const [info, setInfo] = useState({ camionId: '', conductorId: '', baseSalida: '', fechaSalida: '' })
  const [tramos, setTramos] = useState([])
  const [newTramo, setNewTramo] = useState({ origen: '', destino: '', fleteCobrado: 0, kmRecorridos: '', cargaTon: '', tipo: 'carga', tempId: '' })
  const [gastos, setGastos] = useState([])
  const [newGasto, setNewGasto] = useState({ categoria: 'combustible', monto: 0, descripcion: '' })

  const { data: camiones = [] } = useQuery({ queryKey: ['camiones'], queryFn: camionesApi.list })
  const { data: conductores = [] } = useQuery({ queryKey: ['conductores'], queryFn: conductoresApi.list })

  const createMutation = useMutation({
    mutationFn: async () => {
      const vuelta = await vueltasApi.create({
        camionId: info.camionId,
        conductorId: info.conductorId,
        baseSalida: info.baseSalida,
        fechaSalida: new Date(info.fechaSalida).toISOString(),
      })
      for (let i = 0; i < tramos.length; i++) {
        const { tempId, ...t } = tramos[i]
        await vueltasApi.createTramo(vuelta.id, { ...t, orden: i + 1, fleteCobrado: Number(t.fleteCobrado), kmRecorridos: t.kmRecorridos ? Number(t.kmRecorridos) : null, cargaTon: t.cargaTon ? Number(t.cargaTon) : null })
      }
      for (const g of gastos) {
        await vueltasApi.createGasto(vuelta.id, { ...g, monto: Number(g.monto) })
      }
      return vuelta
    },
    onSuccess: (vuelta) => {
      qc.invalidateQueries({ queryKey: ['vueltas'] })
      navigate(`/vueltas/${vuelta.id}`)
    },
  })

  const addTramo = () => {
    if (!newTramo.origen || !newTramo.destino) return
    setTramos(t => [...t, { ...newTramo, tempId: crypto.randomUUID() }])
    setNewTramo({ origen: '', destino: '', fleteCobrado: 0, kmRecorridos: '', cargaTon: '', tipo: 'carga', tempId: '' })
  }

  const addGasto = () => {
    if (!newGasto.monto) return
    setGastos(g => [...g, { ...newGasto }])
    setNewGasto({ categoria: 'combustible', monto: 0, descripcion: '' })
  }

  const handleDragEnd = ({ active, over }) => {
    if (active.id !== over?.id) {
      setTramos(items => {
        const oldIndex = items.findIndex(i => i.tempId === active.id)
        const newIndex = items.findIndex(i => i.tempId === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const ingresoTotal = tramos.reduce((s, t) => s + Number(t.fleteCobrado), 0)
  const gastoTotal = gastos.reduce((s, g) => s + Number(g.monto), 0)

  const inputCls = 'w-full bg-surface-2 border border-border-dim rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-gold'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="font-serif text-2xl text-text-primary">Nueva Vuelta</h2>
        <div className="flex gap-2 ml-auto">
          {[1, 2, 3].map(s => (
            <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === s ? 'bg-gold text-bg-deep' : step > s ? 'bg-gold/30 text-gold' : 'bg-surface-2 text-text-muted'}`}>{s}</div>
          ))}
        </div>
      </div>

      {step === 1 && (
        <div className="bg-surface border border-border-dim rounded-xl p-6 space-y-4">
          <h3 className="font-serif text-lg text-text-primary">Información Básica</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-text-muted text-xs uppercase tracking-wide mb-1.5">Camión</label>
              <select value={info.camionId} onChange={e => setInfo(i => ({ ...i, camionId: e.target.value }))} className={inputCls}>
                <option value="">Seleccionar...</option>
                {camiones.map(c => <option key={c.id} value={c.id}>{c.placa} — {c.modelo}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-text-muted text-xs uppercase tracking-wide mb-1.5">Conductor</label>
              <select value={info.conductorId} onChange={e => setInfo(i => ({ ...i, conductorId: e.target.value }))} className={inputCls}>
                <option value="">Seleccionar...</option>
                {conductores.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-text-muted text-xs uppercase tracking-wide mb-1.5">Base de Salida</label>
              <input value={info.baseSalida} onChange={e => setInfo(i => ({ ...i, baseSalida: e.target.value }))} className={inputCls} placeholder="Lima" />
            </div>
            <div>
              <label className="block text-text-muted text-xs uppercase tracking-wide mb-1.5">Fecha de Salida</label>
              <input type="datetime-local" value={info.fechaSalida} onChange={e => setInfo(i => ({ ...i, fechaSalida: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              disabled={!info.camionId || !info.conductorId || !info.baseSalida || !info.fechaSalida}
              onClick={() => setStep(2)}
              className="bg-gold text-bg-deep font-semibold px-5 py-2 rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-50"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-surface border border-border-dim rounded-xl p-6 space-y-4">
          <h3 className="font-serif text-lg text-text-primary">Tramos</h3>
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={tramos.map(t => t.tempId)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {tramos.map((t, i) => (
                  <SortableTramo key={t.tempId} tramo={t} index={i} onRemove={(idx) => setTramos(arr => arr.filter((_, j) => j !== idx))} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <div className="grid grid-cols-2 gap-3 p-4 bg-surface-2 rounded-lg border border-border-dim">
            <input value={newTramo.origen} onChange={e => setNewTramo(t => ({ ...t, origen: e.target.value }))} className={inputCls} placeholder="Origen" />
            <input value={newTramo.destino} onChange={e => setNewTramo(t => ({ ...t, destino: e.target.value }))} className={inputCls} placeholder="Destino" />
            <input type="number" value={newTramo.fleteCobrado} onChange={e => setNewTramo(t => ({ ...t, fleteCobrado: e.target.value }))} className={inputCls} placeholder="Flete S/" />
            <input type="number" value={newTramo.kmRecorridos} onChange={e => setNewTramo(t => ({ ...t, kmRecorridos: e.target.value }))} className={inputCls} placeholder="KM" />
            <select value={newTramo.tipo} onChange={e => setNewTramo(t => ({ ...t, tipo: e.target.value }))} className={inputCls}>
              {TIPOS_TRAMO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={addTramo} className="bg-gold/20 text-gold border border-gold-dim rounded-lg text-sm hover:bg-gold/30 transition-colors">+ Agregar Tramo</button>
          </div>
          <p className="text-text-muted text-xs">Ingreso calculado: <span className="text-success">S/ {ingresoTotal.toLocaleString('es-PE')}</span></p>
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="text-text-muted text-sm hover:text-text-primary">← Atrás</button>
            <button onClick={() => setStep(3)} className="bg-gold text-bg-deep font-semibold px-5 py-2 rounded-lg hover:bg-gold/90 transition-colors">Siguiente →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bg-surface border border-border-dim rounded-xl p-6 space-y-4">
          <h3 className="font-serif text-lg text-text-primary">Gastos</h3>
          <div className="space-y-2">
            {gastos.map((g, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-surface-2 border border-border-dim rounded-lg text-sm">
                <span className="text-text-muted capitalize">{g.categoria}</span>
                <span className="text-text-primary">{g.descripcion}</span>
                <span className="text-danger">S/ {Number(g.monto).toLocaleString('es-PE')}</span>
                <button onClick={() => setGastos(arr => arr.filter((_, j) => j !== i))} className="text-danger text-xs">✕</button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 p-4 bg-surface-2 rounded-lg border border-border-dim">
            <select value={newGasto.categoria} onChange={e => setNewGasto(g => ({ ...g, categoria: e.target.value }))} className={inputCls}>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="number" value={newGasto.monto} onChange={e => setNewGasto(g => ({ ...g, monto: e.target.value }))} className={inputCls} placeholder="Monto S/" />
            <input value={newGasto.descripcion} onChange={e => setNewGasto(g => ({ ...g, descripcion: e.target.value }))} className={inputCls} placeholder="Descripción" />
            <button onClick={addGasto} className="col-span-3 bg-gold/20 text-gold border border-gold-dim rounded-lg py-2 text-sm hover:bg-gold/30 transition-colors">+ Agregar Gasto</button>
          </div>
          <div className="bg-surface-2 rounded-lg p-4 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-text-muted">Ingresos</span><span className="text-success">S/ {ingresoTotal.toLocaleString('es-PE')}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Gastos</span><span className="text-danger">S/ {gastoTotal.toLocaleString('es-PE')}</span></div>
            <div className="flex justify-between font-semibold border-t border-border-dim pt-1 mt-1"><span className="text-text-primary">Rentabilidad</span><span className={ingresoTotal - gastoTotal >= 0 ? 'text-success' : 'text-danger'}>S/ {(ingresoTotal - gastoTotal).toLocaleString('es-PE')}</span></div>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="text-text-muted text-sm hover:text-text-primary">← Atrás</button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="bg-gold text-bg-deep font-semibold px-5 py-2 rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'Guardando...' : 'Crear Vuelta'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/NuevaVueltaWizard.jsx
git commit -m "feat: NuevaVueltaWizard 3-step form with drag-reorder tramos"
```

---

## Task 16: VueltaDetail page

**Files:**
- Create: `frontend/src/pages/VueltaDetail.jsx`

- [ ] **Step 1: Create `frontend/src/pages/VueltaDetail.jsx`**

```jsx
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vueltasApi } from '../api/vueltas.api'
import { StatusBadge } from '../components/StatusBadge'
import { TramoTimeline } from '../components/TramoTimeline'
import { GastosDonut } from '../components/GastosDonut'

const ESTADOS = ['planificada', 'en_curso', 'completada', 'facturada']

export default function VueltaDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: vuelta, isLoading } = useQuery({
    queryKey: ['vuelta', id],
    queryFn: () => vueltasApi.get(id),
  })

  const estadoMutation = useMutation({
    mutationFn: (estado) => vueltasApi.changeEstado(id, estado),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vuelta', id] }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => vueltasApi.delete(id),
    onSuccess: () => navigate('/vueltas'),
  })

  if (isLoading) return <p className="text-text-muted">Cargando...</p>
  if (!vuelta) return <p className="text-danger">Vuelta no encontrada</p>

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="font-serif text-2xl text-text-primary">{vuelta.codigo}</h2>
            <StatusBadge estado={vuelta.estado} />
          </div>
          <p className="text-text-muted text-sm">{vuelta.camion?.placa} · {vuelta.conductor?.nombre}</p>
        </div>
        <div className="flex gap-2">
          <select
            value={vuelta.estado}
            onChange={e => estadoMutation.mutate(e.target.value)}
            className="bg-surface border border-border-dim rounded-lg px-3 py-1.5 text-text-primary text-sm focus:outline-none focus:border-gold"
          >
            {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <button
            onClick={() => confirm('¿Eliminar esta vuelta?') && deleteMutation.mutate()}
            className="border border-danger/30 text-danger px-3 py-1.5 rounded-lg text-sm hover:bg-danger/10 transition-colors"
          >
            Eliminar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Ingreso Total', value: `S/ ${vuelta.ingresoTotal.toLocaleString('es-PE')}`, cls: 'text-success' },
          { label: 'Gasto Total', value: `S/ ${vuelta.gastoTotal.toLocaleString('es-PE')}`, cls: 'text-danger' },
          { label: 'Rentabilidad', value: `S/ ${vuelta.rentabilidadNeta.toLocaleString('es-PE')}`, cls: vuelta.rentabilidadNeta >= 0 ? 'text-success' : 'text-danger' },
          { label: 'KM Totales', value: `${(vuelta.kmTotales ?? 0).toLocaleString('es-PE')} km`, cls: 'text-gold' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-surface border border-border-dim rounded-xl p-4">
            <p className="text-text-muted text-xs uppercase tracking-wide mb-1">{label}</p>
            <p className={`font-serif text-xl font-bold ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border-dim rounded-xl p-5">
        <h3 className="font-serif text-lg text-text-primary mb-4">Ruta</h3>
        <TramoTimeline tramos={vuelta.tramos ?? []} baseSalida={vuelta.baseSalida} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface border border-border-dim rounded-xl p-5">
          <h3 className="font-serif text-lg text-text-primary mb-4">Distribución de Gastos</h3>
          <GastosDonut gastos={vuelta.gastos ?? []} />
        </div>
        <div className="bg-surface border border-border-dim rounded-xl p-5">
          <h3 className="font-serif text-lg text-text-primary mb-4">Gastos</h3>
          <div className="space-y-2">
            {(vuelta.gastos ?? []).map(g => (
              <div key={g.id} className="flex justify-between text-sm border-b border-border-dim pb-2">
                <span className="text-text-muted capitalize">{g.categoria}</span>
                <span className="text-text-primary">{g.descripcion}</span>
                <span className="text-danger">S/ {g.monto.toLocaleString('es-PE')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/VueltaDetail.jsx
git commit -m "feat: VueltaDetail page with KPI row, TramoTimeline, GastosDonut"
```

---

## Task 17: Flota + Conductores pages

**Files:**
- Create: `frontend/src/pages/Flota.jsx`
- Create: `frontend/src/pages/Conductores.jsx`

- [ ] **Step 1: Create `frontend/src/pages/Flota.jsx`**

```jsx
import { useQuery } from '@tanstack/react-query'
import { camionesApi } from '../api/camiones.api'
import { StatusBadge } from '../components/StatusBadge'

export default function Flota() {
  const { data: camiones = [], isLoading } = useQuery({ queryKey: ['camiones'], queryFn: camionesApi.list })

  return (
    <div className="space-y-5">
      <h2 className="font-serif text-2xl text-text-primary">Flota</h2>
      {isLoading ? <p className="text-text-muted">Cargando...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {camiones.map(c => (
            <div key={c.id} className="bg-surface border border-border-dim rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gold font-medium text-lg">{c.placa}</p>
                  <p className="text-text-muted text-sm">{c.modelo} {c.anio ? `(${c.anio})` : ''}</p>
                </div>
                <StatusBadge estado={c.estado} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><p className="text-text-muted">Tipo</p><p className="text-text-primary capitalize">{c.tipo}</p></div>
                <div><p className="text-text-muted">Capacidad</p><p className="text-text-primary">{c.capacidadTon ? `${c.capacidadTon} ton` : '–'}</p></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `frontend/src/pages/Conductores.jsx`**

```jsx
import { useQuery } from '@tanstack/react-query'
import { conductoresApi } from '../api/conductores.api'
import { StatusBadge } from '../components/StatusBadge'

export default function Conductores() {
  const { data: conductores = [], isLoading } = useQuery({ queryKey: ['conductores'], queryFn: conductoresApi.list })

  return (
    <div className="space-y-5">
      <h2 className="font-serif text-2xl text-text-primary">Conductores</h2>
      {isLoading ? <p className="text-text-muted">Cargando...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {conductores.map(c => (
            <div key={c.id} className="bg-surface border border-border-dim rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-text-primary font-medium">{c.nombre}</p>
                  <p className="text-text-muted text-sm">Lic. {c.licencia ?? '–'}</p>
                </div>
                <StatusBadge estado={c.estado} />
              </div>
              <p className="text-text-muted text-xs">{c.telefono ?? 'Sin teléfono'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Flota.jsx frontend/src/pages/Conductores.jsx
git commit -m "feat: Flota and Conductores pages"
```

---

## Task 18: Reportes page

**Files:**
- Create: `frontend/src/pages/Reportes.jsx`

- [ ] **Step 1: Create `frontend/src/pages/Reportes.jsx`**

```jsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { vueltasApi } from '../api/vueltas.api'

export default function Reportes() {
  const [period, setPeriod] = useState('weekly')

  const now = new Date()
  const fechaDesde = new Date(now)
  if (period === 'weekly') fechaDesde.setDate(now.getDate() - 7)
  else fechaDesde.setDate(now.getDate() - 30)

  const { data: vueltas = [] } = useQuery({
    queryKey: ['vueltas', 'reportes', period],
    queryFn: () => vueltasApi.list({ fechaDesde: fechaDesde.toISOString().split('T')[0] }),
  })

  const byCamion = Object.values(
    vueltas.reduce((acc, v) => {
      const key = v.camion?.placa ?? 'Sin placa'
      if (!acc[key]) acc[key] = { placa: key, ingreso: 0, gasto: 0, rentabilidad: 0 }
      acc[key].ingreso += v.ingresoTotal
      acc[key].gasto += v.gastoTotal
      acc[key].rentabilidad += v.rentabilidadNeta
      return acc
    }, {})
  )

  const topRoutes = vueltas
    .map(v => ({ ruta: `${v.baseSalida} → …`, rentabilidad: v.rentabilidadNeta, codigo: v.codigo }))
    .sort((a, b) => b.rentabilidad - a.rentabilidad)
    .slice(0, 5)

  const tooltipStyle = { background: '#161616', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8 }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl text-text-primary">Reportes</h2>
        <div className="flex gap-2">
          {['weekly', 'monthly'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${period === p ? 'bg-gold text-bg-deep font-semibold' : 'bg-surface border border-border-dim text-text-muted hover:text-text-primary'}`}
            >
              {p === 'weekly' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface border border-border-dim rounded-xl p-5">
        <h3 className="font-serif text-lg text-text-primary mb-4">Ingresos por Camión</h3>
        {byCamion.length === 0 ? <p className="text-text-muted text-sm">Sin datos</p> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byCamion}>
              <XAxis dataKey="placa" tick={{ fill: '#888580', fontSize: 12 }} />
              <YAxis tick={{ fill: '#888580', fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => `S/ ${v.toLocaleString('es-PE')}`} />
              <Bar dataKey="ingreso" name="Ingreso" fill="#C9A84C" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gasto" name="Gasto" fill="#E05252" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-surface border border-border-dim rounded-xl p-5">
        <h3 className="font-serif text-lg text-text-primary mb-4">Top Vueltas por Rentabilidad</h3>
        <div className="space-y-2">
          {topRoutes.map((r, i) => (
            <div key={r.codigo} className="flex items-center justify-between p-3 bg-surface-2 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-gold text-sm font-bold w-5">{i + 1}</span>
                <div>
                  <p className="text-text-primary text-sm">{r.codigo}</p>
                  <p className="text-text-muted text-xs">{r.ruta}</p>
                </div>
              </div>
              <span className={`font-medium text-sm ${r.rentabilidad >= 0 ? 'text-success' : 'text-danger'}`}>
                S/ {r.rentabilidad.toLocaleString('es-PE')}
              </span>
            </div>
          ))}
          {topRoutes.length === 0 && <p className="text-text-muted text-sm">Sin datos</p>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Reportes.jsx
git commit -m "feat: Reportes page with bar chart by camion and top routes"
```

---

## Task 19: Deployment config files

**Files:**
- Create: `.env.example`
- Create: `vercel.json`
- Create: `railway.toml`
- Create: `frontend/.env.example`

- [ ] **Step 1: Create `.env.example` (backend)**

```bash
cat > .env.example << 'EOF'
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
JWT_SECRET=change_me_32chars_minimum_secret
JWT_REFRESH_SECRET=change_me_different_32chars_secret
PORT=3000
FRONTEND_URL=http://localhost:5173
EOF
```

- [ ] **Step 2: Create `vercel.json`**

```json
{
  "version": 2,
  "builds": [
    { "src": "frontend/package.json", "use": "@vercel/static-build", "config": { "distDir": "dist" } }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "https://your-railway-backend.up.railway.app/api/$1" },
    { "src": "/(.*)", "dest": "/frontend/dist/$1" }
  ]
}
```

Note: Replace `your-railway-backend.up.railway.app` with the actual Railway URL after deployment.

- [ ] **Step 3: Create `railway.toml`**

```toml
[build]
builder = "nixpacks"
buildCommand = "cd backend && npm install && npx prisma generate"

[deploy]
startCommand = "cd backend && node src/index.js"
healthcheckPath = "/api/auth/refresh"
restartPolicyType = "on_failure"
```

- [ ] **Step 4: Create `frontend/.env.example`**

```
VITE_API_URL=https://your-railway-backend.up.railway.app
```

- [ ] **Step 5: Commit**

```bash
git add .env.example vercel.json railway.toml frontend/.env.example
git commit -m "feat: deployment config for Vercel, Railway, and Supabase"
```

---

## Task 20: End-to-end smoke test

- [ ] **Step 1: Run both servers**

Terminal 1:
```bash
cd backend && npm run dev
```

Terminal 2:
```bash
cd frontend && npm run dev
```

- [ ] **Step 2: Smoke test checklist**

Open `http://localhost:5173` and verify each item:

```
[ ] /login renders with gold Fleet Guardian heading
[ ] Login with admin@demo.com / demo1234 redirects to /dashboard
[ ] Dashboard shows 4 stat cards with real numbers
[ ] Dashboard shows at least 1 active vuelta card
[ ] Fleet utilization bar renders
[ ] /vueltas shows table with 5 seeded vueltas
[ ] Filter by estado works (select "en_curso" → shows only that)
[ ] Click a vuelta row → navigates to /vueltas/:id
[ ] VueltaDetail shows KPI row, TramoTimeline with stops, GastosDonut
[ ] Change estado dropdown updates the badge without page reload
[ ] /vueltas/nueva → step 1 form renders
[ ] Fill step 1, proceed to step 2 (tramos)
[ ] Add 2 tramos, drag to reorder
[ ] Proceed to step 3 (gastos), add 1 gasto
[ ] Submit → redirects to new vuelta detail page
[ ] /flota shows 3 camion cards with estado badges
[ ] /conductores shows 3 conductor cards
[ ] /reportes shows bar chart and top routes list
[ ] Logout clears session, redirects to /login
[ ] Refresh while logged in rehydrates session (stays on /dashboard)
```

- [ ] **Step 3: Fix any failures found, commit fixes**

```bash
git add -A
git commit -m "fix: smoke test corrections"
```

---

## Self-Review Notes

**Spec coverage verified:**
- ✅ All 7 pages implemented (Login, Dashboard, Vueltas, NuevaVuelta, VueltaDetail, Flota, Conductores, Reportes)
- ✅ All API endpoints implemented (auth, vueltas, tramos, gastos, camiones, conductores, dashboard)
- ✅ Full Prisma schema matching spec
- ✅ recalcularVuelta called on every tramo/gasto mutation
- ✅ VLT-{YYYY}-{NNN} codigo generation in transaction
- ✅ JWT + HttpOnly cookie refresh token
- ✅ Axios interceptor with silent refresh + retry
- ✅ Multi-tenant empresaId filtering on all queries
- ✅ Seed: 1 empresa, 1 admin, 3 camiones, 3 conductores, 5 vueltas with tramos + gastos
- ✅ Deployment config: vercel.json, railway.toml, .env.example
- ✅ Tailwind design tokens matching brand spec
- ✅ All 5 key components: StatCard, StatusBadge, VueltaTable, TramoTimeline, GastosDonut
- ✅ NuevaVueltaWizard with @dnd-kit drag reorder
- ✅ Reportes with weekly/monthly toggle (defaults to weekly)
