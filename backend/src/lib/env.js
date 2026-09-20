const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET']
// The app boots without these, but the feature that uses them fails at request time.
const OPTIONAL = ['ORS_API_KEY', 'GEMINI_API_KEY']

const isSet = v => typeof v === 'string' && v.trim() !== ''

export function checkEnv(env = process.env) {
  return {
    missing: REQUIRED.filter(k => !isSet(env[k])),
    warnings: OPTIONAL.filter(k => !isSet(env[k])),
  }
}

// Call once at boot: a missing required variable stops the process with a clear message
// instead of failing on the first login.
export function validateEnv(env = process.env) {
  const { missing, warnings } = checkEnv(env)
  if (warnings.length) console.warn(`[env] optional variables not set (related features will fail): ${warnings.join(', ')}`)
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
}
