import { extractJsonFromDocument } from './geminiExtract.js'

const PROMPT = `You are a data extraction assistant for a trucking fleet management system. Extract fields from this US vehicle registration document (a truck, tractor or trailer registration, registration card or IRP cab card) and return ONLY a valid JSON object with no markdown, no backticks, no explanation.
If a field is not clearly present in the document, use null. Never guess and never invent values.

FIELD-BY-FIELD RULES:

plate:
- The LICENSE PLATE number of the vehicle.
- NOT the registration/document number, NOT the title number, NOT the fleet or account number.

vin:
- The 17-character Vehicle Identification Number (letters and digits). Labels: "VIN", "Vehicle ID", "Vehicle Identification Number".

year:
- The MODEL YEAR of the vehicle (a 4-digit year), not the registration or issue year.

make:
- The manufacturer of the vehicle, e.g. "Freightliner", "Peterbilt", "Kenworth", "Volvo", "Great Dane", "Utility". Labels: "Make".

model:
- The model name if shown, e.g. "Cascadia", "389", "T680". Return null if only the make is shown.

color:
- The vehicle color if the document shows it. Many registrations do not: then null.

expirationDate:
- The date on which the registration EXPIRES. Labels: "Expires", "Expiration", "Exp. Date", "Valid Through".
- Return it as an ISO date "YYYY-MM-DD".
- If only a month and year are shown, use the last day of that month.

DO NOT return the owner's name, address, or any other personal data.

Return this exact JSON structure:
{
  "plate": "string or null",
  "vin": "string or null",
  "year": number or null,
  "make": "string or null",
  "model": "string or null",
  "color": "string or null",
  "expirationDate": "YYYY-MM-DD or null"
}`

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/

const clean = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '')

// Text in ALL CAPS is turned into Title Case; text that already has lowercase letters is left alone.
function niceCase(s) {
  if (!s || s !== s.toUpperCase() || !/[A-Z]/.test(s)) return s
  return s.toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase())
}

function normalizePlate(v) {
  const s = clean(v).toUpperCase()
  return s && s.length <= 12 ? s : null
}

function normalizeVin(v) {
  const s = clean(v).replace(/\s/g, '').toUpperCase()
  return VIN_RE.test(s) ? s : null
}

function normalizeYear(v, now) {
  const n = typeof v === 'number' ? v : /^\d{4}$/.test(clean(v)) ? Number(clean(v)) : NaN
  return Number.isInteger(n) && n >= 1980 && n <= now.getUTCFullYear() + 1 ? n : null
}

function normalizeModel(make, model) {
  const mk = niceCase(clean(make))
  const md = niceCase(clean(model))
  let out
  if (mk && md) out = md.toLowerCase().startsWith(mk.toLowerCase()) ? md : `${mk} ${md}`
  else out = mk || md
  return out && out.length <= 60 ? out : null
}

function normalizeColor(v) {
  const s = niceCase(clean(v))
  return s && s.length <= 30 ? s : null
}

function normalizeDate(v) {
  const s = clean(v)
  let y, m, d
  let match = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match) [, y, m, d] = match
  else if ((match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) [, m, d, y] = match
  else return null
  const date = new Date(Date.UTC(+y, +m - 1, +d))
  const valid = date.getUTCFullYear() === +y && date.getUTCMonth() === +m - 1 && date.getUTCDate() === +d
  if (!valid || +y < 2000 || +y > 2100) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// Turns the raw model answer into the fields of the truck/trailer form.
// Anything missing or implausible becomes null; personal data (owner, address) is never carried over.
export function normalizeRegistration(raw, now = new Date()) {
  const r = raw ?? {}
  return {
    placa: normalizePlate(r.plate),
    vin: normalizeVin(r.vin),
    anio: normalizeYear(r.year, now),
    modelo: normalizeModel(r.make, r.model),
    color: normalizeColor(r.color),
    registrationExpiry: normalizeDate(r.expirationDate),
  }
}

export async function extractRegistration(fileBuffer, mimeType) {
  const raw = await extractJsonFromDocument({
    buffer: fileBuffer,
    mimeType,
    prompt: PROMPT,
    parseError: 'No se pudo leer la registración',
    generationConfig: { thinkingConfig: { thinkingBudget: 0 } }, // plain field extraction: no reasoning needed, much faster
    timeoutMs: 15000,
  })
  return normalizeRegistration(raw)
}
