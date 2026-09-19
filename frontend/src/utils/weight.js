// Weights are stored in the DB as US short tons (capacidadTon / cargaTon).
// The UI works in pounds by default and can switch to tons.
export const LB_PER_TON = 2000

const isEmpty = (v) => v === null || v === undefined || v === ''

export function tonsToDisplay(tons, unit) {
  if (isEmpty(tons)) return null
  const n = Number(tons)
  if (Number.isNaN(n)) return null
  return unit === 'lb' ? Math.round(n * LB_PER_TON) : Math.round(n * 100) / 100
}

export function displayToTons(value, unit) {
  if (isEmpty(value)) return null
  const n = Number(value)
  if (Number.isNaN(n)) return null
  return unit === 'lb' ? n / LB_PER_TON : n
}

export function formatWeight(tons, unit) {
  const v = tonsToDisplay(tons, unit)
  if (!v) return '–'
  return `${v.toLocaleString('en-US')} ${unit}`
}
