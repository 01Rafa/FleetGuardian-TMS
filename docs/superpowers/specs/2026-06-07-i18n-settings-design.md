# i18n + Settings Page Design

**Date:** 2026-06-07  
**Status:** Approved

## Overview

Add full internationalization (ES/EN) to Fleet Guardian TMS via `react-i18next`, plus a `/configuracion` settings page where the user selects their language. Language choice persists in `localStorage`.

## Libraries

- `i18next` — core engine
- `react-i18next` — React bindings (`useTranslation`, `I18nextProvider`)
- `i18next-browser-languagedetector` — reads/writes `localStorage` key `i18nextLng` automatically

No lazy-loading — locale files are small and bundled statically.

## File Structure

```
frontend/src/
  i18n/
    index.js              # i18next init, default lang = 'es'
  locales/
    es.json               # Spanish strings (current default)
    en.json               # English translations
  pages/
    Configuracion.jsx     # New settings page
```

## Translation Key Schema

```json
{
  "nav": { "dashboard", "trips", "fleet", "drivers", "reports", "settings" },
  "auth": { "logout", "login", "email", "password", "loginBtn" },
  "common": { "save", "cancel", "delete", "edit", "add", "loading", "noData", "optional", "back", "next", "saving", "adding" },
  "status": { "planificada", "en_curso", "completada", "facturada", "disponible", "en_ruta", "mantenimiento" },
  "tramoTipo": { "carga", "vacio", "regreso" },
  "dashboard": { "title", "newTrip", "activeTrips", "weekIncome", "weekExpense", "netProfit", "tripsInProgress", "noActiveTrips", "recentActivity" },
  "trips": {
    "title", "newTrip", "groupTrip", "cancel", "allStatuses", "allTrucks", "allBrokers",
    "noTrips", "loading",
    "table": { "loadNumber", "route", "truck", "driver", "income", "expense", "profit", "status" },
    "detail": { "info", "route", "legs", "expenses", "expenseDist", "edit", "delete", "confirmDelete", "confirmDeleteLeg", "confirmDeleteExpense", "saving", "adding", "kmTotal", "totalIncome", "totalExpense", "profitability" },
    "wizard": { "title", "step1", "step2", "step3", "basicInfo", "legs", "expenses", "next", "back", "create", "creating", "calculatedIncome", "atLeastOneLeg" },
    "leg": { "origin", "destination", "broker", "loadNumber", "freight", "km", "type", "datetime", "addLeg", "noLegs" },
    "expense": { "category", "amount", "description", "addExpense" },
    "merge": { "title", "selected", "dragToReorder", "combinedIncome", "combinedExpense", "mergeBtn", "merging" },
    "statuses": { "all", "planned", "inProgress", "completed", "invoiced" }
  },
  "fleet": { "title", "addTruck", "noTrucks", "loading", "fields": {...} },
  "drivers": { "title", "addDriver", "noDrivers", "loading", "fields": {...} },
  "reports": { "title" },
  "settings": {
    "title",
    "language": { "title", "spanish", "english" }
  }
}
```

## Component Changes

### StatusBadge
Replace hardcoded `labels` object with `t('status.<estado>')`. CSS `styles` object stays unchanged (it's class names, not text).

### TIPOS_TRAMO selects
The `value` attribute stays as `'carga'`/`'vacio'`/`'regreso'` (what gets stored in the DB). The displayed text uses `t('tramoTipo.carga')` etc.

### Layout sidebar
- `navItems` array items use `t('nav.*')` keys
- Settings gear icon (⚙) added between nav and footer, links to `/configuracion`
- "Cerrar sesión" → `t('auth.logout')`

### All pages/components
Every hardcoded string replaced with `t()` call. `useTranslation()` called at component top.

## /configuracion Page

Expandable section layout — designed to grow:

```
<h2>Configuración / Settings</h2>

<section>
  <h3>🌐 Idioma / Language</h3>
  <div class="toggle-group">
    <button [active if es]>Español</button>
    <button [active if en]>English</button>
  </div>
</section>

<!-- future sections go here -->
```

Clicking a language button calls `i18next.changeLanguage(code)` which triggers the `languagedetector` to persist to `localStorage`. All `t()` calls in the app re-render instantly via React context.

## Routing

Add to `App.jsx`:
```jsx
<Route path="/configuracion" element={<ProtectedRoute><Layout><Configuracion /></Layout></ProtectedRoute>} />
```

## Constraints

- DB values (`planificada`, `carga`, etc.) are never translated — only display labels
- English nav labels: Dashboard, Trips, Fleet, Drivers, Reports, Settings
- Default language: Spanish (`es`), regardless of browser language
