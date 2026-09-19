// Which browser origins may call the API with credentials (the refresh cookie is SameSite=None).
// Only exact origins are accepted: no wildcards and no "any *.vercel.app", otherwise any site hosted there
// could ask the API for a session token on behalf of a logged-in user.

const DEV_ORIGIN = 'http://localhost:5173'

const normalize = (origin) => String(origin).trim().toLowerCase().replace(/\/+$/, '')

// "https://a.com, http://localhost:5173/" -> ['https://a.com', 'http://localhost:5173']
export function parseOrigins(value) {
  return String(value ?? '').split(',').map(normalize).filter(Boolean)
}

// ALLOWED_ORIGINS (comma separated) plus FRONTEND_URL. With nothing configured only the local dev origin is allowed.
export function getAllowedOrigins(env = process.env) {
  const list = [...parseOrigins(env.ALLOWED_ORIGINS), ...parseOrigins(env.FRONTEND_URL)]
  const unique = [...new Set(list)]
  return unique.length ? unique : [DEV_ORIGIN]
}

// Requests without an Origin header (same origin, curl, server to server) involve no CORS decision.
export function isOriginAllowed(origin, allowed) {
  if (!origin) return true
  return allowed.includes(normalize(origin))
}
