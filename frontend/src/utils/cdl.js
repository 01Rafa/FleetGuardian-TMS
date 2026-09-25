// Fields the CDL reader can fill in a driver form.
export const CDL_FIELDS = [
  { key: 'nombre' },
  { key: 'cdlNumber' },
  { key: 'cdlState' },
  { key: 'cdlExpiry' },
]

const isFound = (v) => v !== null && v !== undefined && v !== ''

export function summarizeCdl(data) {
  const filled = []
  const missing = []
  for (const { key } of CDL_FIELDS) (isFound(data?.[key]) ? filled : missing).push(key)
  return { filled, missing }
}

// Returns a copy of the form with the values found in the document; fields not found keep their current value.
// The CDL number also mirrors into `licencia`, since that field holds the same number in this app.
export function applyCdl(form, data) {
  const next = { ...form }
  const { filled, missing } = summarizeCdl(data)
  for (const key of filled) next[key] = String(data[key])
  if (isFound(data?.cdlNumber)) next.licencia = String(data.cdlNumber)
  return { form: next, filled, missing }
}
