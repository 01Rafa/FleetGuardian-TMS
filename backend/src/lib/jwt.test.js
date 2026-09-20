import test from 'node:test'
import assert from 'node:assert/strict'
import { signRefresh, verifyRefresh, signAccess, verifyAccess } from './jwt.js'

process.env.JWT_SECRET ??= 'test-access-secret'
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret'

const payload = { userId: 'u1', empresaId: 'e1', rol: 'admin' }

test('the refresh token carries the session id as jti', () => {
  const decoded = verifyRefresh(signRefresh(payload, 'session-1'))
  assert.equal(decoded.jti, 'session-1')
  assert.equal(decoded.userId, 'u1')
})

test('without a session id there is no jti (old tokens look like this)', () => {
  assert.equal(verifyRefresh(signRefresh(payload)).jti, undefined)
})

test('access tokens are unchanged and have no jti', () => {
  const decoded = verifyAccess(signAccess(payload))
  assert.equal(decoded.rol, 'admin')
  assert.equal(decoded.jti, undefined)
})
