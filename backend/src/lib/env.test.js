import test from 'node:test'
import assert from 'node:assert/strict'
import { checkEnv, validateEnv } from './env.js'

const full = { DATABASE_URL: 'postgres://x', JWT_SECRET: 'a', JWT_REFRESH_SECRET: 'b', APP_ENV: 'development', ORS_API_KEY: 'c', GEMINI_API_KEY: 'd' }

test('a complete environment has nothing missing and no warnings', () => {
  assert.deepEqual(checkEnv(full), { missing: [], warnings: [], invalid: [] })
})

test('missing or blank required variables are reported', () => {
  const { missing } = checkEnv({ ...full, JWT_SECRET: undefined, DATABASE_URL: '   ' })
  assert.deepEqual(missing, ['DATABASE_URL', 'JWT_SECRET'])
})

test('missing optional variables only warn', () => {
  const { missing, warnings } = checkEnv({ ...full, ORS_API_KEY: '' })
  assert.deepEqual(missing, [])
  assert.deepEqual(warnings, ['ORS_API_KEY'])
})

test('validateEnv throws naming the missing required variables', () => {
  assert.throws(() => validateEnv({ ...full, JWT_REFRESH_SECRET: undefined }), /JWT_REFRESH_SECRET/)
})

test('validateEnv does not throw when only optional variables are missing', () => {
  assert.doesNotThrow(() => validateEnv({ DATABASE_URL: 'x', JWT_SECRET: 'a', JWT_REFRESH_SECRET: 'b', APP_ENV: 'production' }))
})

test('APP_ENV is required', () => {
  const { APP_ENV, ...rest } = full
  assert.deepEqual(checkEnv(rest).missing, ['APP_ENV'])
  assert.throws(() => validateEnv(rest), /APP_ENV/)
})

test('APP_ENV must be development, staging or production', () => {
  assert.deepEqual(checkEnv({ ...full, APP_ENV: 'prod' }).invalid, ['APP_ENV must be one of development, staging, production (got "prod")'])
  assert.throws(() => validateEnv({ ...full, APP_ENV: 'prod' }), /APP_ENV must be one of/)
  for (const ok of ['development', 'staging', 'production']) assert.doesNotThrow(() => validateEnv({ ...full, APP_ENV: ok }))
})
