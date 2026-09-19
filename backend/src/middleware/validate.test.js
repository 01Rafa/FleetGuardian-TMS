import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { validate } from './validate.js'

const schema = z.object({ placa: z.string().min(1), anio: z.number().int().optional() })

function fakeRes() {
  const res = { statusCode: null, body: null }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (payload) => { res.body = payload; return res }
  return res
}

test('validate responds 400 with per-field errors when the body is invalid', () => {
  const req = { body: {} }
  const res = fakeRes()
  let nextCalled = false

  validate(schema)(req, res, () => { nextCalled = true })

  assert.equal(nextCalled, false)
  assert.equal(res.statusCode, 400)
  assert.equal(res.body.error, 'Validation failed')
  assert.equal(res.body.errors.length, 1)
  assert.equal(res.body.errors[0].field, 'placa')
  assert.equal(typeof res.body.errors[0].message, 'string')
})

test('validate reports every failing field with a dotted path', () => {
  const nested = z.object({ usuario: z.object({ email: z.string().email() }), placa: z.string() })
  const res = fakeRes()

  validate(nested)({ body: { usuario: { email: 'nope' } } }, res, () => {})

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.body.errors.map(e => e.field).sort(), ['placa', 'usuario.email'])
})

test('validate replaces req.body with the parsed data (unknown keys stripped) and calls next', () => {
  const req = { body: { placa: 'TR-1', empresaId: 'hack' } }
  const res = fakeRes()
  let nextCalled = false

  validate(schema)(req, res, () => { nextCalled = true })

  assert.equal(nextCalled, true)
  assert.equal(res.statusCode, null)
  assert.deepEqual(req.body, { placa: 'TR-1' })
})
