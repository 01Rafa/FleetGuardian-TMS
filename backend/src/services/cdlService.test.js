import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeCdl } from './cdlService.js'

test('normalizes a clean CDL', () => {
  const out = normalizeCdl({
    name: 'JOHN SMITH', licenseNumber: ' s123 456 ', state: 'FL', expirationDate: '2027-03-31',
  })
  assert.deepEqual(out, {
    nombre: 'John Smith', cdlNumber: 'S123456', cdlState: 'FL', cdlExpiry: '2027-03-31',
  })
})

test('returns null for every missing field', () => {
  assert.deepEqual(normalizeCdl({}), { nombre: null, cdlNumber: null, cdlState: null, cdlExpiry: null })
  assert.deepEqual(normalizeCdl(null), { nombre: null, cdlNumber: null, cdlState: null, cdlExpiry: null })
})

test('accepts a 2-letter state code case-insensitively, rejects an unknown one', () => {
  assert.equal(normalizeCdl({ state: 'FL' }).cdlState, 'FL')
  assert.equal(normalizeCdl({ state: 'fl' }).cdlState, 'FL')
  assert.equal(normalizeCdl({ state: 'ZZ' }).cdlState, null)
})

test('accepts a full US state name and converts it to its abbreviation', () => {
  assert.equal(normalizeCdl({ state: 'Florida' }).cdlState, 'FL')
  assert.equal(normalizeCdl({ state: 'NEW YORK' }).cdlState, 'NY')
  assert.equal(normalizeCdl({ state: 'District of Columbia' }).cdlState, 'DC')
  assert.equal(normalizeCdl({ state: 'Not a State' }).cdlState, null)
})

test('strips whitespace from the license number but keeps other characters', () => {
  assert.equal(normalizeCdl({ licenseNumber: ' S 123-456 ' }).cdlNumber, 'S123-456')
})

test('accepts ISO dates and MM/DD/YYYY, rejects invalid or out-of-range ones', () => {
  assert.equal(normalizeCdl({ expirationDate: '2027-03-31' }).cdlExpiry, '2027-03-31')
  assert.equal(normalizeCdl({ expirationDate: '03/31/2027' }).cdlExpiry, '2027-03-31')
  assert.equal(normalizeCdl({ expirationDate: '2027-02-31' }).cdlExpiry, null)
  assert.equal(normalizeCdl({ expirationDate: '1999-01-01' }).cdlExpiry, null)
  assert.equal(normalizeCdl({ expirationDate: 'soon' }).cdlExpiry, null)
})

test('title-cases a shouting name but keeps mixed case as it came', () => {
  assert.equal(normalizeCdl({ name: 'JOHN SMITH' }).nombre, 'John Smith')
  assert.equal(normalizeCdl({ name: 'John Smith' }).nombre, 'John Smith')
})

test('drops an absurdly long name or license number instead of passing it on', () => {
  assert.equal(normalizeCdl({ name: 'A'.repeat(120) }).nombre, null)
  assert.equal(normalizeCdl({ licenseNumber: 'A'.repeat(25) }).cdlNumber, null)
})

test('ignores personal data the model might send back', () => {
  const out = normalizeCdl({ name: 'John Smith', dob: '1990-01-01', address: '1 Main St', sex: 'M' })
  assert.deepEqual(Object.keys(out).sort(), ['cdlExpiry', 'cdlNumber', 'cdlState', 'nombre'])
})
