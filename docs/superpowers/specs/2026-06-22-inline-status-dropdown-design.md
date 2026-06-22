# Inline Status Dropdown — Design Spec

**Date:** 2026-06-22  
**Feature:** Inline status change from the trips list page  
**Status:** Approved

---

## Problem

Clicking the status badge in the trips list navigates to the full trip detail page. Dispatchers need to change a trip's status without leaving the list.

---

## Solution Overview

Replace the static `<StatusBadge>` in each row with a `<StatusDropdown>` that opens a small floating menu on click. The row's existing click-to-navigate behavior is preserved for all other cells.

---

## Backend

### File: `backend/src/controllers/vueltas.controller.js`

**Change:** Add `await recalcularVuelta(req.params.id)` to `changeEstado` after the Prisma update, before `res.json(updated)`.

**Why:** `recalcularVuelta` is already called in `createVuelta` and `mergeVueltas` but was missing from `changeEstado`.

**Endpoint (unchanged):** `PATCH /api/vueltas/:id/estado`  
**Body (unchanged):** `{ estado: 'planificada' | 'en_curso' | 'completada' | 'facturada' }`  
**Frontend client (unchanged):** `vueltasApi.changeEstado(id, estado)`

---

## Frontend

### 1. Install `sonner`

Add `sonner` to `frontend/package.json` dependencies.  
Mount `<Toaster position="bottom-right" />` in `frontend/src/main.jsx`.

### 2. Update badge colors — `frontend/src/components/StatusBadge.jsx`

| Status | Color |
|---|---|
| `planificada` | gray (`bg-text-muted/20 text-text-muted border-text-muted/30`) |
| `en_curso` | blue (`bg-blue-500/20 text-blue-400 border-blue-500/30`) |
| `completada` | green (`bg-success/20 text-success border-success/30`) |
| `facturada` | amber/gold (`bg-gold/20 text-gold border-gold/30`) |

Affects all uses of `StatusBadge` across the app (list + detail).

### 3. New component — `frontend/src/components/StatusDropdown.jsx`

Self-contained. No props from parent except `vuelta` object.

**State:**
- `open: boolean` — dropdown visibility
- `displayEstado: string` — optimistic local copy, initialized from `vuelta.estado`, synced via `useEffect([vuelta.estado])`

**Behavior:**
- Clicking the badge button: `e.stopPropagation()` + toggle `open`
- Selecting a status: set `displayEstado` optimistically, call `vueltasApi.changeEstado`, close dropdown
- On success: `toast.success('Estado actualizado')`, `qc.invalidateQueries(['vueltas'])`
- On error: revert `displayEstado` to `vuelta.estado`, `toast.error('Error al actualizar el estado')`
- Close triggers: outside click (mousedown listener on document), Escape key, status selection
- Current status shown in dropdown with reduced opacity and `cursor-default` (not re-selectable)
- Dropdown position: `absolute`, below the badge, `z-50`, min-width 160px

**ESTADOS constant:** `['planificada', 'en_curso', 'completada', 'facturada']`

### 4. Update `frontend/src/components/VueltaTable.jsx`

- Replace `<StatusBadge estado={v.estado} />` with `<StatusDropdown vuelta={v} />`
- Add `onClick={e => e.stopPropagation()}` to the status `<td>` so dropdown item clicks don't trigger row navigation
- Import `StatusDropdown` instead of (or alongside) `StatusBadge`

---

## Close Behavior

| Trigger | Result |
|---|---|
| Click outside dropdown | Close |
| Press Escape | Close |
| Select a status | Close + fire mutation |
| Click anywhere else on row | Row navigates (unchanged) |

---

## What Does NOT Change

- Row `onClick` → `navigate(/vueltas/:id)` — untouched
- Edit button in last column — untouched
- VueltaDetail status `<select>` — untouched
- Existing route, schema, Zod validation — untouched
- `vueltasApi.changeEstado` — untouched

---

## Files Changed

| File | Change |
|---|---|
| `backend/src/controllers/vueltas.controller.js` | +1 line: `await recalcularVuelta(req.params.id)` |
| `frontend/package.json` | Add `sonner` |
| `frontend/src/main.jsx` | Add `<Toaster />` |
| `frontend/src/components/StatusBadge.jsx` | Update 4 color values |
| `frontend/src/components/StatusDropdown.jsx` | New file |
| `frontend/src/components/VueltaTable.jsx` | Swap badge → dropdown, add stopPropagation on td |
