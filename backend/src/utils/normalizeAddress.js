const STATE_MAP = {
  alabama: 'al', alaska: 'ak', arizona: 'az', arkansas: 'ar',
  california: 'ca', colorado: 'co', connecticut: 'ct', delaware: 'de',
  florida: 'fl', georgia: 'ga', hawaii: 'hi', idaho: 'id',
  illinois: 'il', indiana: 'in', iowa: 'ia', kansas: 'ks',
  kentucky: 'ky', louisiana: 'la', maine: 'me', maryland: 'md',
  massachusetts: 'ma', michigan: 'mi', minnesota: 'mn', mississippi: 'ms',
  missouri: 'mo', montana: 'mt', nebraska: 'ne', nevada: 'nv',
  'new hampshire': 'nh', 'new jersey': 'nj', 'new mexico': 'nm',
  'new york': 'ny', 'north carolina': 'nc', 'north dakota': 'nd',
  ohio: 'oh', oklahoma: 'ok', oregon: 'or', pennsylvania: 'pa',
  'rhode island': 'ri', 'south carolina': 'sc', 'south dakota': 'sd',
  tennessee: 'tn', texas: 'tx', utah: 'ut', vermont: 'vt',
  virginia: 'va', washington: 'wa', 'west virginia': 'wv',
  wisconsin: 'wi', wyoming: 'wy',
}

export function normalizeAddress(address) {
  // Lowercase, remove periods, collapse whitespace, trim
  let s = address.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim()
  // Normalize comma spacing: "city , st" or "city,st" → "city,st"
  s = s.replace(/\s*,\s*/g, ',')
  // Split into city and state parts
  const commaIdx = s.indexOf(',')
  if (commaIdx === -1) return s
  const city = s.slice(0, commaIdx).trim()
  let state = s.slice(commaIdx + 1).trim()
  // Expand full state name to abbreviation (only in state part)
  const abbr = STATE_MAP[state]
  if (abbr) state = abbr
  return `${city},${state}`
}
