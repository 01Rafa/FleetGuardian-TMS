export function fmtDate(iso) {
  if (!iso) return '–'
  // Date-only values are stored as midnight UTC: format them in UTC so the calendar day never shifts with the viewer's zone.
  return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

// English (m/d/yyyy) version of fmtDate, used by the driver pages.
export function fmtDateUS(iso) {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC' })
}

export function toInputDate(iso) {
  if (!iso) return ''
  return iso.slice(0, 10)
}

export function fmtMoney(n) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const FIELD_CLS = 'bg-surface-2 border border-border-dim rounded-lg px-3 py-2 text-text-primary text-sm w-full focus:outline-none focus:border-gold placeholder:text-text-muted'
