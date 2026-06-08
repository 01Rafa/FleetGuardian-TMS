# Fleet Guardian TMS — Design Spec
_Date: 2026-06-05_

## Overview

Full-stack fleet management web application. Core differentiator: the **Vuelta Completa** — a parent entity that groups multiple trip legs (tramos) from departure base → destinations → return, with aggregated financials. Replaces TruckingOffice's single-leg model with a round-trip-aware structure.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS + React Query + React Router v6 |
| Backend | Node.js + Express + Prisma ORM |
| Database | PostgreSQL via Supabase (cloud, dev + prod) |
| Auth | JWT access token (15min) + refresh token (7d, HttpOnly cookie) |
| Frontend deploy | Vercel |
| Backend deploy | Railway |

---

## Architecture

```
/Fleet Guardian TMS          ← git root
├── frontend/                ← Vite + React 18 → Vercel
│   ├── src/
│   │   ├── api/             ← axios instance + React Query hooks per resource
│   │   ├── components/      ← shared UI (Button, Card, Badge, Table, Modal)
│   │   ├── pages/           ← one file per route
│   │   ├── hooks/           ← useAuth, useVuelta, etc.
│   │   └── styles/          ← tailwind.config.js with Fleet Guardian tokens
│   └── vite.config.js
├── backend/                 ← Express + Prisma → Railway
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/      ← jwtAuth, empresaScope, errorHandler
│   │   └── lib/             ← prismaClient singleton, jwtUtils
│   └── prisma/
│       ├── schema.prisma
│       └── seed.ts
├── .env.example
├── vercel.json
└── railway.toml
```

**Data flow:** Frontend → axios (Bearer token in Authorization header) → Express JWT middleware → controller → Prisma → Supabase PostgreSQL.

---

## Brand & Design System

- **Theme:** Dark only
- **Background:** `#0E0E0E` / `#0a0a0a`
- **Surface:** `#161616` / `#1E1E1E`
- **Gold accent:** `#C9A84C` — primary CTA, active states, key numbers
- **Text:** `#F0EDE6` (primary), `#888580` (muted)
- **Borders:** `rgba(201,168,76,0.18)` gold borders | `rgba(255,255,255,0.07)` dim borders
- **Success:** `#4CAF7D` | **Danger:** `#E05252`
- **Headings:** Playfair Display (Google Fonts)
- **Body:** Inter / system sans-serif
- Tailwind config extends with named tokens: `gold`, `surface`, `bg-base`, `danger`, `success`

---

## Database Schema (Prisma)

### Empresa
| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | PK |
| nombre | String | |
| ruc | String? | |
| plan | String | default: "basic" |
| creadoEn | DateTime | |

### Usuario
| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | PK |
| empresaId | String | FK → Empresa |
| nombre | String | |
| email | String | unique |
| password | String | bcrypt hashed |
| rol | String | admin \| dispatcher \| viewer |

### Camion
| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | PK |
| empresaId | String | FK → Empresa |
| placa | String | |
| modelo | String | |
| anio | Int? | |
| capacidadTon | Float? | |
| tipo | String | reefer \| flatbed \| dry_van |
| estado | String | disponible \| en_ruta \| mantenimiento |

### Conductor
| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | PK |
| empresaId | String | FK → Empresa |
| nombre | String | |
| licencia | String? | |
| telefono | String? | |
| estado | String | activo \| inactivo |

### Vuelta
| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | PK |
| empresaId | String | FK → Empresa |
| camionId | String | FK → Camion |
| conductorId | String | FK → Conductor |
| codigo | String | unique, auto: VLT-{YYYY}-{NNN} |
| baseSalida | String | |
| fechaSalida | DateTime | |
| fechaRegreso | DateTime? | |
| estado | String | planificada \| en_curso \| completada \| facturada |
| ingresoTotal | Float | auto-calculated |
| gastoTotal | Float | auto-calculated |
| rentabilidadNeta | Float | auto-calculated |
| notas | String? | |

### Tramo
| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | PK |
| vueltaId | String | FK → Vuelta (cascade delete) |
| orden | Int | for drag-reorder |
| origen | String | |
| destino | String | |
| kmRecorridos | Float? | |
| cargaTon | Float? | |
| fleteCobrado | Float | default 0 |
| tipo | String | carga \| vacio \| regreso |
| fechaHora | DateTime? | |
| notas | String? | |

### Gasto
| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | PK |
| vueltaId | String | FK → Vuelta (cascade delete) |
| tramoId | String? | optional FK → Tramo |
| categoria | String | combustible \| peaje \| viatico \| mantenimiento \| otro |
| monto | Float | |
| descripcion | String? | |
| fecha | DateTime | |

---

## API Endpoints

### Auth
```
POST /api/auth/login       → { accessToken } + Set-Cookie: refreshToken
POST /api/auth/refresh     → { accessToken }
POST /api/auth/logout      → clears cookie
```

### Vueltas
```
GET    /api/vueltas                    ?estado=&camionId=&fechaDesde=&fechaHasta=
POST   /api/vueltas
GET    /api/vueltas/:id                full detail: tramos + gastos + KPIs
PUT    /api/vueltas/:id
DELETE /api/vueltas/:id
PATCH  /api/vueltas/:id/estado
```

### Tramos
```
POST   /api/vueltas/:id/tramos
PUT    /api/tramos/:id
DELETE /api/tramos/:id
```

### Gastos
```
POST   /api/vueltas/:id/gastos
PUT    /api/gastos/:id
DELETE /api/gastos/:id
```

### Flota
```
GET    /api/camiones
POST   /api/camiones
PUT    /api/camiones/:id
```

### Conductores
```
GET    /api/conductores
POST   /api/conductores
PUT    /api/conductores/:id
```

### Dashboard
```
GET    /api/dashboard/stats
→ { vueltasActivas, ingresoSemana, gastoSemana, rentabilidadSemana, flotaUtilization }
```

---

## Auth Flow

- Access token: JWT, 15-min TTL, payload `{ userId, empresaId, rol }`, sent as `Authorization: Bearer <token>`
- Refresh token: JWT, 7-day TTL, stored in `HttpOnly; SameSite=None; Secure` cookie
- On page load: app calls `/api/auth/refresh` silently to rehydrate session from cookie
- On 401 response: axios interceptor calls refresh endpoint, retries original request once
- CORS: `credentials: true`, `origin: process.env.FRONTEND_URL`

---

## Business Logic

### Auto-recalculation
Shared utility `recalcularVuelta(vueltaId, prisma)`:
1. Sum `tramos.fleteCobrado` → `ingresoTotal`
2. Sum `gastos.monto` → `gastoTotal`
3. `rentabilidadNeta = ingresoTotal - gastoTotal`
4. `prisma.vuelta.update(...)` — called after every tramo/gasto create, update, delete

### Vuelta codigo generation
Inside a Prisma transaction:
1. Count existing vueltas for `empresaId` in current year
2. `codigo = VLT-${year}-${String(count + 1).padStart(3, '0')}`

---

## Frontend Pages

| Route | Description |
|---|---|
| `/login` | Auth page with Fleet Guardian branding |
| `/dashboard` | 4 stat cards + active vueltas list + fleet utilization bars + "Nueva Vuelta" CTA |
| `/vueltas` | Filter bar + table: codigo, ruta, camion, conductor, ingresos, gastos, rentabilidad, estado |
| `/vueltas/nueva` | 3-step wizard: (1) info básica, (2) tramos with drag-reorder, (3) gastos |
| `/vueltas/:id` | Detail: header KPIs, TramoTimeline, GastosDonut, edit/estado actions |
| `/flota` | Camiones list with estado badges |
| `/conductores` | Conductores list |
| `/reportes` | Revenue by camion, top routes by rentabilidad, gastos by categoria |

---

## Key Frontend Components

- **`StatCard`** — gold number, muted label, optional trend indicator
- **`StatusBadge`** — `en_curso`=green, `planificada`=gold, `completada`=gray, `facturada`=blue
- **`VueltaTable`** — sortable, clickable rows, inline estado filter
- **`TramoTimeline`** — horizontal step chain: Base → Tramo 1 → … → Base, km + flete per step
- **`GastosDonut`** — recharts donut grouped by categoria
- **`NuevaVueltaWizard`** — 3-step form, step 2 uses `@dnd-kit/sortable` for tramo reordering

---

## Deployment

### Vercel (frontend)
- Root directory: `frontend/`
- Env var: `VITE_API_URL` → Railway backend URL

### Railway (backend)
- Root directory: `backend/`
- Build: `npm install && npx prisma generate`
- Start: `node src/index.js`
- Env vars: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PORT`, `FRONTEND_URL`

### Supabase (database)
- Migrations run via `npx prisma migrate deploy` from Railway or locally
- Pooled connection string (port 6543) for runtime, direct (port 5432) for migrations

---

## Seed Data

- 1 Empresa: "Transportes Demo S.A."
- 1 Usuario admin: `admin@demo.com` / `demo1234`
- 3 Camiones (one per tipo: reefer, flatbed, dry_van)
- 3 Conductores
- 5 Vueltas with:
  - 2–3 tramos each (mix of carga, vacio, regreso types)
  - Gastos spread across all 5 categories (combustible, peaje, viatico, mantenimiento, otro)
  - Mix of estados (planificada, en_curso, completada, facturada)

---

## .env.example

```
DATABASE_URL=
JWT_SECRET=
JWT_REFRESH_SECRET=
PORT=3000
FRONTEND_URL=http://localhost:5173
```
