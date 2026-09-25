import { extractJsonFromDocument } from './geminiExtract.js'

const PROMPT = `You are a data extraction assistant for a trucking fleet management system. Extract fields from this US commercial driver's license (CDL) and return ONLY a valid JSON object with no markdown, no backticks, no explanation.
If a field is not clearly present in the document, use null. Never guess and never invent values.

FIELD-BY-FIELD RULES:

name:
- The full name of the LICENSE HOLDER (the person the license belongs to).
- Return it in "First Last" order, even if the document shows it as "Last, First" or "Last First Middle".

licenseNumber:
- The driver's license / CDL number. Labels: "DL", "LIC", "License No.", "CDL No.".
- NOT the document discriminator number, NOT the DD/audit number sometimes printed on the back.

state:
- The two-letter US state (or DC) that issued the license, or its full name if the abbreviation is not shown.

expirationDate:
- The date on which the license EXPIRES. Labels: "EXP", "Expires", "Expiration".
- Return it as an ISO date "YYYY-MM-DD".

DO NOT return date of birth, address, sex, height, weight, eye color, restrictions, endorsements, license class, or any other field.

Return this exact JSON structure:
{
  "name": "string or null",
  "licenseNumber": "string or null",
  "state": "string or null",
  "expirationDate": "YYYY-MM-DD or null"
}`

// Full name -> USPS abbreviation, for documents that spell the issuing state out.
const STATE_ABBR = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO',
  connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY',
  louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH',
  'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND',
  ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT',
  vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
}
const VALID_ABBR = new Set(Object.values(STATE_ABBR))

const clean = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '')

// Text in ALL CAPS is turned into Title Case; text that already has lowercase letters is left alone.
function niceCase(s) {
  if (!s || s !== s.toUpperCase() || !/[A-Z]/.test(s)) return s
  return s.toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase())
}

function normalizeName(v) {
  const s = niceCase(clean(v))
  return s && s.length <= 100 ? s : null
}

function normalizeCdlNumber(v) {
  const s = clean(v).replace(/\s+/g, '').toUpperCase()
  return s && s.length <= 20 ? s : null
}

function normalizeState(v) {
  const s = clean(v).toUpperCase()
  if (VALID_ABBR.has(s)) return s
  return STATE_ABBR[clean(v).toLowerCase()] ?? null
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

// Turns the raw model answer into the fields of the driver form.
// Anything missing or implausible becomes null; unrequested personal data is never carried over.
export function normalizeCdl(raw) {
  const r = raw ?? {}
  return {
    nombre: normalizeName(r.name),
    cdlNumber: normalizeCdlNumber(r.licenseNumber),
    cdlState: normalizeState(r.state),
    cdlExpiry: normalizeDate(r.expirationDate),
  }
}

export async function extractCdl(fileBuffer, mimeType) {
  const raw = await extractJsonFromDocument({
    buffer: fileBuffer,
    mimeType,
    prompt: PROMPT,
    parseError: 'No se pudo leer la licencia',
    generationConfig: { thinkingConfig: { thinkingBudget: 0 } }, // plain field extraction: no reasoning needed, much faster
    timeoutMs: 15000,
  })
  return normalizeCdl(raw)
}
