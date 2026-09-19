import test from 'node:test'
import assert from 'node:assert/strict'
import { belongsToEmpresa } from './ownership.js'

test('camion-owned record belongs to the camion empresa only', () => {
  const rec = { camion: { empresaId: 'e1' }, trailer: null }
  assert.equal(belongsToEmpresa(rec, 'e1'), true)
  assert.equal(belongsToEmpresa(rec, 'e2'), false)
})

test('trailer-owned record belongs to the trailer empresa only', () => {
  const rec = { camion: null, trailer: { empresaId: 'e1' } }
  assert.equal(belongsToEmpresa(rec, 'e1'), true)
  assert.equal(belongsToEmpresa(rec, 'e2'), false)
})

test('ownerless or missing records never belong to anyone', () => {
  assert.equal(belongsToEmpresa({ camion: null, trailer: null }, 'e1'), false)
  assert.equal(belongsToEmpresa(null, 'e1'), false)
  assert.equal(belongsToEmpresa(undefined, 'e1'), false)
})
