import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { normalizeEmail } from './email.js'

// Counters live in memory, so they reset on every deploy. Enough for a single Railway instance.
const build = options => rateLimit({
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
  ...options,
})

// Failed attempts only: a correct login does not eat into the allowance.
export const createLoginLimiter = ({ limit = 10, windowMs = 15 * 60 * 1000 } = {}) =>
  build({ limit, windowMs, skipSuccessfulRequests: true })

export const createRegisterLimiter = ({ limit = 5, windowMs = 60 * 60 * 1000 } = {}) =>
  build({ limit, windowMs })

// The key is the email being attacked, so guessing spread over many IPs is still counted.
const emailKey = req => {
  const email = normalizeEmail(req.body?.email)
  return email ? `email:${email}` : ipKeyGenerator(req.ip)
}

// Two tiers, failures only. Spread it into the route: router.post('/login', ...createLoginEmailLimiters(), ...)
export const createLoginEmailLimiters = ({ shortLimit = 5, shortWindowMs = 15 * 60 * 1000, dayLimit = 15, dayWindowMs = 24 * 60 * 60 * 1000 } = {}) => [
  build({ limit: shortLimit, windowMs: shortWindowMs, keyGenerator: emailKey, skipSuccessfulRequests: true }),
  build({ limit: dayLimit, windowMs: dayWindowMs, keyGenerator: emailKey, skipSuccessfulRequests: true }),
]

export const createRefreshLimiter = ({ limit = 60, windowMs = 15 * 60 * 1000 } = {}) =>
  build({ limit, windowMs })

// Document reading calls Gemini, which has a small daily quota: cap what one user can burn.
export const createExtractLimiter = ({ limit = 10, windowMs = 60 * 60 * 1000 } = {}) =>
  build({ limit, windowMs, keyGenerator: req => `user:${req.user?.userId ?? ipKeyGenerator(req.ip)}` })
