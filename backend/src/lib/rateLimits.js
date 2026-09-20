import rateLimit from 'express-rate-limit'

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
