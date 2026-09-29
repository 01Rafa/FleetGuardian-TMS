// A truck or trailer is identified on screen by its unit number; the plate is the fallback.
export const hasUnitNumber = (unit) => Boolean(unit?.numeroUnidad?.trim())

export const unitLabel = (unit) => unit?.numeroUnidad?.trim() || unit?.placa

const unitCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

// Sorts trucks/trailers ascending by their displayed unit label (e.g. "T-2" before "T-10").
export const compareByUnitNumber = (a, b) => unitCollator.compare(unitLabel(a) || '', unitLabel(b) || '')
