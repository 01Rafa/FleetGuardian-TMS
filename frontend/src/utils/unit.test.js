import test from 'node:test'
import assert from 'node:assert/strict'
import { unitLabel, hasUnitNumber } from './unit.js'

test('unitLabel returns the unit number when there is one', () => {
  assert.equal(unitLabel({ numeroUnidad: 'T-104', placa: 'ABC123' }), 'T-104')
})

test('unitLabel trims the unit number', () => {
  assert.equal(unitLabel({ numeroUnidad: '  2207  ', placa: 'ABC123' }), '2207')
})

test('unitLabel falls back to the plate when the unit number is empty, blank or missing', () => {
  assert.equal(unitLabel({ numeroUnidad: '', placa: 'ABC123' }), 'ABC123')
  assert.equal(unitLabel({ numeroUnidad: '   ', placa: 'ABC123' }), 'ABC123')
  assert.equal(unitLabel({ numeroUnidad: null, placa: 'ABC123' }), 'ABC123')
  assert.equal(unitLabel({ placa: 'ABC123' }), 'ABC123')
})

test('hasUnitNumber is true only for a non-blank unit number', () => {
  assert.equal(hasUnitNumber({ numeroUnidad: 'T-104' }), true)
  assert.equal(hasUnitNumber({ numeroUnidad: '  ' }), false)
  assert.equal(hasUnitNumber({ numeroUnidad: null }), false)
  assert.equal(hasUnitNumber({}), false)
})
