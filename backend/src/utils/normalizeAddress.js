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

const STATE_ABBRS = new Set(Object.values(STATE_MAP))

export function normalizeAddress(address) {
  // Lowercase, remove periods, collapse whitespace, trim
  let s = address.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim()
  // Normalize comma spacing: "city , st" or "city,st" → "city,st"
  s = s.replace(/\s*,\s*/g, ',')

  const commaIdx = s.indexOf(',')
  if (commaIdx !== -1) {
    // Comma-separated: "City, ST" or "City, State"
    const city = s.slice(0, commaIdx)
    const rawState = s.slice(commaIdx + 1)
    const state = STATE_MAP[rawState] ?? rawState
    return `${city},${state}`
  }

  // No comma: try to detect trailing state ("Pharr TX", "Pharr Texas", "Charlotte North Carolina")
  const words = s.split(' ')
  if (words.length >= 2) {
    const last = words[words.length - 1]
    if (STATE_ABBRS.has(last)) {
      return `${words.slice(0, -1).join(' ')},${last}`
    }
    if (STATE_MAP[last]) {
      return `${words.slice(0, -1).join(' ')},${STATE_MAP[last]}`
    }
    if (words.length >= 3) {
      const lastTwo = words.slice(-2).join(' ')
      if (STATE_MAP[lastTwo]) {
        return `${words.slice(0, -2).join(' ')},${STATE_MAP[lastTwo]}`
      }
    }
  }

  return s
}
