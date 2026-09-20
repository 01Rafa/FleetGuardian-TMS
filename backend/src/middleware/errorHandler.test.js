import test from 'node:test'
import assert from 'node:assert/strict'
import { errorHandler } from './errorHandler.js'

function run(err) {
  const res = { statusCode: null, body: null, status(c) { this.statusCode = c; return this }, json(b) { this.body = b; return this } }
  const original = console.error
  console.error = () => {}
  try { errorHandler(err, {}, res, () => {}) } finally { console.error = original }
  return res
}

test('a 500 never leaks the internal message', () => {
  const res = run(new Error('connect ECONNREFUSED 10.0.0.5:5432 password=secret'))
  assert.equal(res.statusCode, 500)
  assert.deepEqual(res.body, { error: 'Internal server error' })
})

test('an error with an explicit 4xx status keeps its message', () => {
  const err = Object.assign(new Error('Unexpected token } in JSON'), { status: 400 })
  const res = run(err)
  assert.equal(res.statusCode, 400)
  assert.equal(res.body.error, 'Unexpected token } in JSON')
})

test('an explicit 5xx status also gets the generic message', () => {
  const res = run(Object.assign(new Error('upstream exploded: key=abc'), { status: 502 }))
  assert.equal(res.statusCode, 502)
  assert.deepEqual(res.body, { error: 'Internal server error' })
})

test('prisma errors keep their friendly mapping', () => {
  assert.equal(run(Object.assign(new Error('x'), { code: 'P2002' })).statusCode, 409)
  assert.equal(run(Object.assign(new Error('x'), { code: 'P2025' })).statusCode, 404)
  const res = run(Object.assign(new Error('secret sql'), { code: 'P1001' }))
  assert.equal(res.statusCode, 500)
  assert.deepEqual(res.body, { error: 'Database error' })
})
