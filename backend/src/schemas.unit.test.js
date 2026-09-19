import test from 'node:test'
import assert from 'node:assert/strict'
import { createCamionSchema, updateCamionSchema, createTrailerSchema, updateTrailerSchema } from './schemas.js'

const truck = { placa: 'ABC123', modelo: 'Freightliner', tipo: 'tractocamion' }
const trailer = { placa: 'TR-1', modelo: 'Utility', tipo: 'dry_van' }

test('camion schemas accept an optional unit number', () => {
  assert.equal(createCamionSchema.parse({ ...truck, numeroUnidad: 'T-104' }).numeroUnidad, 'T-104')
  assert.equal(createCamionSchema.parse(truck).numeroUnidad, undefined)
  assert.equal(createCamionSchema.parse({ ...truck, numeroUnidad: null }).numeroUnidad, null)
  assert.equal(updateCamionSchema.parse({ numeroUnidad: 'T-105' }).numeroUnidad, 'T-105')
  assert.equal(updateCamionSchema.parse({ numeroUnidad: null }).numeroUnidad, null)
})

test('trailer schemas accept an optional unit number', () => {
  assert.equal(createTrailerSchema.parse({ ...trailer, numeroUnidad: 'TR-22' }).numeroUnidad, 'TR-22')
  assert.equal(createTrailerSchema.parse(trailer).numeroUnidad, undefined)
  assert.equal(updateTrailerSchema.parse({ numeroUnidad: null }).numeroUnidad, null)
})

test('unit number is trimmed and limited to 30 characters', () => {
  assert.equal(createCamionSchema.parse({ ...truck, numeroUnidad: '  T-9  ' }).numeroUnidad, 'T-9')
  assert.equal(createCamionSchema.safeParse({ ...truck, numeroUnidad: 'x'.repeat(31) }).success, false)
  assert.equal(createTrailerSchema.safeParse({ ...trailer, numeroUnidad: 'x'.repeat(31) }).success, false)
  assert.equal(createCamionSchema.safeParse({ ...truck, numeroUnidad: 'x'.repeat(30) }).success, true)
})
