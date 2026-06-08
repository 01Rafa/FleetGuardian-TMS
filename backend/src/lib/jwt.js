import jwt from 'jsonwebtoken'

export function signAccess(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' })
}

export function signRefresh(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' })
}

export function verifyAccess(token) {
  return jwt.verify(token, process.env.JWT_SECRET)
}

export function verifyRefresh(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET)
}
