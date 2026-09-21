import test from 'node:test'
import assert from 'node:assert/strict'
import { checkEnvironmentMarker, checkDestructiveAllowed, checkSetupAllowed, readMarker, assertDatabaseEnvironment } from './environment.js'

test('the server starts when the database marker equals APP_ENV', () => {
  assert.deepEqual(checkEnvironmentMarker({ appEnv: 'production', marker: 'production' }), { ok: true })
  assert.deepEqual(checkEnvironmentMarker({ appEnv: 'development', marker: 'development' }), { ok: true })
})

test('a development server pointed at the production database is refused, naming both values', () => {
  const res = checkEnvironmentMarker({ appEnv: 'development', marker: 'production' })
  assert.equal(res.ok, false)
  assert.match(res.message, /APP_ENV is "development"/)
  assert.match(res.message, /marked "production"/)
})

test('a database without a marker is refused and the message says how to mark it', () => {
  const res = checkEnvironmentMarker({ appEnv: 'production', marker: null })
  assert.equal(res.ok, false)
  assert.match(res.message, /no environment marker/)
  assert.match(res.message, /mark-environment\.mjs production/)
})

test('destructive scripts never run with APP_ENV=production, whatever the marker says', () => {
  assert.equal(checkDestructiveAllowed({ appEnv: 'production', marker: 'production' }).ok, false)
})

test('destructive scripts need the marker to match a non-production environment', () => {
  assert.equal(checkDestructiveAllowed({ appEnv: 'development', marker: 'development' }).ok, true)
  assert.equal(checkDestructiveAllowed({ appEnv: 'development', marker: 'production' }).ok, false)
  assert.equal(checkDestructiveAllowed({ appEnv: 'development', marker: null }).ok, false)
})

test('setup is refused for production and for a database marked as another environment', () => {
  assert.equal(checkSetupAllowed({ appEnv: 'production', marker: null, hasData: false }).ok, false)
  assert.equal(checkSetupAllowed({ appEnv: 'development', marker: 'production', hasData: true }).ok, false)
})

test('setup is refused on a database that has data but no marker', () => {
  const res = checkSetupAllowed({ appEnv: 'development', marker: null, hasData: true })
  assert.equal(res.ok, false)
  assert.match(res.message, /has data but no environment marker/)
})

test('setup is allowed on an empty database or one already marked with the same environment', () => {
  assert.equal(checkSetupAllowed({ appEnv: 'development', marker: null, hasData: false }).ok, true)
  assert.equal(checkSetupAllowed({ appEnv: 'development', marker: 'development', hasData: true }).ok, true)
})

const fakePrisma = handler => ({ $queryRaw: async () => handler() })

test('readMarker returns the name stored in the database', async () => {
  assert.equal(await readMarker(fakePrisma(() => [{ name: 'development' }])), 'development')
})

test('readMarker returns null for an empty table or a missing table', async () => {
  assert.equal(await readMarker(fakePrisma(() => [])), null)
  assert.equal(await readMarker(fakePrisma(() => { throw new Error('relation "AppEnvironment" does not exist') })), null)
})

test('readMarker does not hide a real database error', async () => {
  await assert.rejects(readMarker(fakePrisma(() => { throw new Error('connect ECONNREFUSED') })), /ECONNREFUSED/)
})

test('assertDatabaseEnvironment resolves on a match and throws the message on a mismatch', async () => {
  await assertDatabaseEnvironment(fakePrisma(() => [{ name: 'production' }]), 'production')
  await assert.rejects(assertDatabaseEnvironment(fakePrisma(() => [{ name: 'production' }]), 'development'), /marked "production"/)
  await assert.rejects(assertDatabaseEnvironment(fakePrisma(() => []), 'production'), /no environment marker/)
})
