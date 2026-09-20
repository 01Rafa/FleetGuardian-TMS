import test from 'node:test'
import assert from 'node:assert/strict'
import { createSessionService, SESSION_TTL_MS, ROTATION_GRACE_MS } from './session.service.js'

function makeFake() {
  const rows = new Map()
  let n = 0
  const state = { clock: new Date('2026-09-20T12:00:00Z') }
  const db = {
    createSession: async ({ id, usuarioId, expiresAt }) => { rows.set(id, { id, usuarioId, expiresAt, rotatedAt: null }) },
    findSession: async id => (rows.has(id) ? { ...rows.get(id) } : null),
    claimRotation: async (id, at) => {
      const r = rows.get(id)
      if (!r || r.rotatedAt) return false
      r.rotatedAt = at
      return true
    },
    deleteSession: async id => { rows.delete(id) },
    deleteAllForUser: async usuarioId => { for (const [k, r] of rows) if (r.usuarioId === usuarioId) rows.delete(k) },
    deleteExpired: async (usuarioId, at) => { for (const [k, r] of rows) if (r.usuarioId === usuarioId && r.expiresAt <= at) rows.delete(k) },
  }
  const service = createSessionService({ db, now: () => state.clock, newId: () => `s${++n}` })
  return { service, rows, state }
}
const advance = (state, ms) => { state.clock = new Date(state.clock.getTime() + ms) }

test('start creates a session that lasts 7 days', async () => {
  const { service, rows, state } = makeFake()
  const { sid, expiresAt } = await service.start('u1')
  assert.equal(sid, 's1')
  assert.equal(expiresAt.getTime(), state.clock.getTime() + SESSION_TTL_MS)
  assert.equal(rows.get('s1').usuarioId, 'u1')
})

test('start removes that user\'s expired sessions and leaves other users alone', async () => {
  const { service, rows, state } = makeFake()
  await service.start('u1')
  await service.start('u2')
  advance(state, SESSION_TTL_MS + 1000)
  await service.start('u1')
  assert.equal(rows.has('s1'), false)
  assert.equal(rows.has('s2'), true)
  assert.equal(rows.has('s3'), true)
})

test('a fresh session rotates once into a new one', async () => {
  const { service, rows } = makeFake()
  const { sid } = await service.start('u1')
  const res = await service.rotate(sid)
  assert.deepEqual(res, { ok: true, usuarioId: 'u1', sid: 's2' })
  assert.notEqual(rows.get('s1').rotatedAt, null)
  assert.equal(rows.size, 2)
})

test('using the same session again inside the grace window works and revokes nothing', async () => {
  const { service, rows, state } = makeFake()
  const { sid } = await service.start('u1')
  await service.rotate(sid)
  advance(state, ROTATION_GRACE_MS - 1)
  const again = await service.rotate(sid)
  assert.equal(again.ok, true)
  assert.equal(again.sid, 's3')
  assert.equal(rows.size, 3)
})

test('using a rotated session after the grace window is reuse: every session of that user is deleted', async () => {
  const { service, rows, state } = makeFake()
  const { sid } = await service.start('u1')
  await service.start('u2')
  const rotated = await service.rotate(sid)
  advance(state, ROTATION_GRACE_MS + 1)
  assert.deepEqual(await service.rotate(sid), { ok: false, reason: 'reuse' })
  assert.equal(rows.has(rotated.sid), false)
  assert.equal([...rows.values()].some(r => r.usuarioId === 'u1'), false)
  assert.equal([...rows.values()].some(r => r.usuarioId === 'u2'), true)
})

test('unknown, missing and expired sessions are invalid', async () => {
  const { service, state } = makeFake()
  assert.deepEqual(await service.rotate('nope'), { ok: false, reason: 'invalid' })
  assert.deepEqual(await service.rotate(undefined), { ok: false, reason: 'invalid' })
  const { sid } = await service.start('u1')
  advance(state, SESSION_TTL_MS)
  assert.deepEqual(await service.rotate(sid), { ok: false, reason: 'invalid' })
})

test('two simultaneous rotations both succeed with different new sessions and only one claims', async () => {
  const { service, rows } = makeFake()
  const { sid } = await service.start('u1')
  const [a, b] = await Promise.all([service.rotate(sid), service.rotate(sid)])
  assert.equal(a.ok, true)
  assert.equal(b.ok, true)
  assert.notEqual(a.sid, b.sid)
  assert.equal(rows.size, 3)
})

test('end deletes one session and ignores a missing id; endAll deletes them all', async () => {
  const { service, rows } = makeFake()
  await service.start('u1')
  await service.start('u1')
  await service.start('u2')
  await service.end('s1')
  await service.end(undefined)
  assert.equal(rows.size, 2)
  await service.endAll('u1')
  assert.deepEqual([...rows.keys()], ['s3'])
})
