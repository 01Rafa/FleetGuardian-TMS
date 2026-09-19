# Trailers — Design Spec

**Date:** 2026-09-19
**Status:** Approved (design), pending spec review

---

## Goal

Add **trailers** to Fleet as a first-class entity, managed the same way trucks are today: list, create, edit, delete, detail page with documents, compliance alerts, parts and maintenance history. Fleet gets two sections, **Trucks** and **Trailers**, as tabs.

## Decisions

| Topic | Decision |
|---|---|
| Scope | Full parity with trucks: list, create, edit, delete, detail page (general info, documents, compliance with alerts + notifications, parts, maintenance) |
| Navigation | One "Fleet" sidebar item; tabs **Trucks \| Trailers** inside it |
| Relation to trucks | **None.** A trailer has no `camionId` and no link to any truck. Each company manages its trailers as it wants |
| Owner fields | **None.** No `propietario` / `tipoPropiedad`. Tenancy is by `empresaId`, like trucks |
| Maintenance & parts | Trailers have their **own** records (`trailerId`), never mixed with truck history. Implemented as one shared `Mantenimiento`/`Pieza` table with an optional owner (see below) |
| Weight | `capacidadTon` stored in short tons, shown through the existing lb/ton preference |

## Out of scope

- Assigning a trailer to a trip (`Vuelta`) or leg (`Tramo`). Which truck a trailer travels with each day is a future trip-level feature.
- Photos / scanned documents.
- Any change to trucks' behavior or fields.

---

## Data model (`backend/prisma/schema.prisma`)

### New model `Trailer`

| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | PK |
| empresaId | String | FK → Empresa, indexed, `onDelete: Cascade` |
| placa | String | |
| tipo | String | `dry_van \| reefer \| flatbed \| otro` |
| modelo | String | |
| anio | Int? | |
| capacidadTon | Float? | short tons |
| estado | String | `disponible \| en_ruta \| mantenimiento`, default `disponible` |
| vin, color | String? | |
| fechaCompra | DateTime? | |
| notas | String? | |
| dotInspectionLastDate | DateTime? | interval: 1 year |
| stateInspectionLastDate | DateTime? | interval: 1 year |
| brakeInspectionLastDate | DateTime? | interval: 1 year |
| registrationExpiry | DateTime? | expiry |
| cargoInsuranceExpiry | DateTime? | expiry |
| epaRefrigerantExpiry | DateTime? | expiry, **reefer only** |
| mantenimientos | Mantenimiento[] | |
| piezas | Pieza[] | |

`Empresa` gains `trailers Trailer[]`.

### Changes to `Mantenimiento` and `Pieza`

- `camionId` becomes **optional** (`String?`), `camion` relation optional.
- New `trailerId String?` with relation to `Trailer` (`onDelete: Cascade`), indexed.
- **Exactly one owner** (camion XOR trailer) is enforced:
  1. In the API: create routes are nested under the owner (`/camiones/:id/...`, `/trailers/:id/...`) and set the owner from the URL; update routes never accept `camionId`/`trailerId`.
  2. In the DB: a manual SQL migration adds `CHECK (num_nonnulls("camionId", "trailerId") = 1)` on both tables (Prisma `db push` does not create CHECK constraints). Every existing row has `camionId` set, so the constraint is satisfied.

### Migration and deploy safety

- Adds one table and makes one column nullable; deletes nothing, so it is safe for production data.
- The DB is shared by local and production. Old backend code keeps working after the schema change (it ignores the new table/columns and only writes `camionId`).
- Railway applies the schema on deploy (`prisma db push` in `preDeployCommand`). Locally, `db push` is blocked by pgBouncer, so use the direct URL or a manual SQL file in `backend/migrations/manual/` (as done for ORS mileage).

---

## Backend

### Routes (`/api/trailers`, behind `jwtAuth`; viewers are already read-only globally)

```
GET    /api/trailers                    list (own empresa, ordered by placa)
POST   /api/trailers                    create (zod validated)
GET    /api/trailers/:id                detail + mantenimientos + piezas
PUT    /api/trailers/:id                update (zod validated)
DELETE /api/trailers/:id                delete (cascades its maintenance and parts)
POST   /api/trailers/:id/mantenimientos create maintenance for this trailer
POST   /api/trailers/:id/piezas         create part for this trailer
```

Existing `PUT|DELETE /api/mantenimientos/:id` and `/api/piezas/:id` are reused for both owners.

### Required fix to existing controllers

`updateMantenimiento`, `deleteMantenimiento`, `updatePieza`, `deletePieza` currently verify tenancy with `m.camion.empresaId`. With an optional `camion` this would throw for trailer records. They must resolve the owner as `record.camion ?? record.trailer` (including both relations) and compare that `empresaId`. A record with neither owner is treated as not found.

### Validation (`schemas.js`)

- `createTrailerSchema` / `updateTrailerSchema`: same style as the camion schemas, with a `trailerDateFields` object for the six compliance dates. `tipo` and `estado` are `z.enum` (trailer `tipo` drives reefer-only logic, so it must be a known value).
- Maintenance/parts creation for trailers reuses `createMantenimientoSchema` / `createPiezaSchema`.
- Date parsing follows the camion pattern (`parseTrailerDateFields`).

### Notifications (`jobs/notificaciones.job.js`)

- New `TRAILER_FIELDS`: the six compliance fields above (`epaRefrigerantExpiry` with `reeferOnly`).
- `runForEmpresa` also loads trailers and calls `checkEntity` with `tipo: 'compliance_trailer'` and message `Trailer {placa} {label} ...`.
- `entidadTipo` is no longer "conductor else camion": it maps `compliance_driver → conductor`, `compliance_truck → camion`, `compliance_trailer → trailer`.
- Pure helpers (`TRAILER_FIELDS`, message builder, entity-type mapping) are exported so they can be unit-tested.

---

## Frontend

### Navigation and pages

- `/flota` stays the Trucks list. New `/flota/trailers` (Trailers list) and `/flota/trailers/:id` (detail). `/flota/:id` remains the truck detail; React Router ranks the static `trailers` segment above `:id`.
- New `FleetTabs` component (Trucks | Trailers) rendered under the page title in both `Flota.jsx` and the new `Trailers.jsx`. The active tab follows the URL.
- New `Trailers.jsx`: same layout as `Flota.jsx` — card grid with compliance-colored borders, status badge, capacity, delete with inline confirm, "New Trailer" form (placa, tipo, modelo, año, capacidad, estado).
- New `TrailerDetail.jsx`: same sections as `CamionDetail`: general info (editable), documents/expirations, compliance & registrations with days badges, parts, upcoming maintenance, maintenance history.
- Viewers see everything read-only (`useRole().isViewer`), as elsewhere.

### Shared components (refactor of `CamionDetail.jsx`)

To avoid copying ~700 lines, the sections that are identical for both owners are extracted and used by both pages:

- `MantenimientosSection` and `PiezasSection` (including "upcoming maintenance"): props for the owner id, the list, the create/update/delete functions, the React Query key to invalidate, and `readOnly`.
- A generic `computeComplianceStatus(entity, fields, now)` in `utils/compliance.js` (next to `computeNextDue`); `getComplianceStatus(conductor)` and `getTruckComplianceStatus` become thin wrappers with unchanged behavior, and `getTrailerComplianceStatus` is added with `utils/trailerComplianceFields.js`.
- ComplianceSection (view + edit of the compliance list) is shared as well, alongside MantenimientosSection and PiezasSection.
- General info and documents forms stay per-entity (fields differ).

This is the only step that touches working truck code, so `CamionDetail` maintenance and parts must be re-verified (see Testing).

### API client and i18n

- `api/trailers.api.js`: `list`, `get`, `create`, `update`, `delete`, `createMantenimiento`, `createPieza`. The existing `mantenimientosApi` / `piezasApi` are reused for update/delete.
- Notification dropdown: `entidadTipo === 'trailer'` navigates to `/flota/trailers/:id`.
- `es.json` / `en.json`: `fleet.tabs.trucks`, `fleet.tabs.trailers`, plus a `trailers.*` block mirroring the `fleet.*` keys (title, new, form, empty state, errors, trailer types).
- Capacity uses `useWeightUnit()` and `utils/weight.js` exactly as trucks do.

---

## Testing

**Automated (`node:test`, in the style of the existing tests):**
- Backend: `createTrailerSchema` / `updateTrailerSchema` (required fields, enums, dates, nullable fields).
- Backend: notification helpers — `TRAILER_FIELDS` computes due dates correctly, EPA field applies only to reefer, `entidadTipo` mapping, message text for overdue / due today / upcoming.
- Backend: owner resolution for maintenance/parts — camion-owned, trailer-owned, other-empresa, and ownerless records.
- Frontend: `getComplianceStatus` with trailer fields (red / yellow / green, reefer-only).

**Manual checklist (no UI test runner exists):**
1. Trucks unchanged: create/edit/delete a truck; add, edit, delete a maintenance and a part on a truck.
2. Trailers: create, edit, delete a trailer; add, edit, delete a maintenance and a part on it; verify a trailer's history never shows on a truck and vice versa.
3. Compliance: set an expired date on a trailer → red card + notification linking to `/flota/trailers/:id`; reefer shows the EPA field, other types do not.
4. Viewer role: read-only on both tabs.
5. Weight: lb/ton preference applies to trailer capacity.
6. Deleting a trailer removes its maintenance and parts and nothing else.

## Risks

- **Regression in truck maintenance/parts** from extracting the shared sections. Mitigation: extract without changing behavior and run manual checklist item 1 before moving on.
- **Shared prod/dev DB.** The schema change is additive, but it hits production immediately when applied locally against the shared URL. Mitigation: apply it deliberately, with the additive migration reviewed first.
- **Pre-existing lint errors** in `CamionDetail.jsx` (`docColor` unused, `Date.now` in render) will surface when that file is touched; they are not part of this work and are left alone unless the refactor removes them naturally.
