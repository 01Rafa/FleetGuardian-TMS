// Fields the registration reader can fill in a truck or trailer form (same key names in every form).
export const REGISTRATION_FIELDS = [
  { key: 'placa' },
  { key: 'vin' },
  { key: 'anio' },
  { key: 'modelo' },
  { key: 'color' },
  { key: 'registrationExpiry' },
]

const isFound = (v) => v !== null && v !== undefined && v !== ''

export function summarizeRegistration(data) {
  const filled = []
  const missing = []
  for (const { key } of REGISTRATION_FIELDS) (isFound(data?.[key]) ? filled : missing).push(key)
  return { filled, missing }
}

// Returns a copy of the form with the values found in the document; fields not found keep their current value.
export function applyRegistration(form, data) {
  const next = { ...form }
  for (const key of summarizeRegistration(data).filled) next[key] = String(data[key])
  return { form: next, ...summarizeRegistration(data) }
}
