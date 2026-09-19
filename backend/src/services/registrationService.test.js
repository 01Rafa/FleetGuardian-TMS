import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeRegistration } from './registrationService.js'

const NOW = new Date('2026-09-19T12:00:00Z')

test('normalizes a clean registration', () => {
  const out = normalizeRegistration({
    plate: ' abc 1234 ', vin: '1fuja6cv5cdbk1234', year: 2019,
    make: 'FREIGHTLINER', model: 'CASCADIA', color: 'WHITE', expirationDate: '2027-03-31',
  }, NOW)
  assert.deepEqual(out, {
    placa: 'ABC 1234', vin: '1FUJA6CV5CDBK1234', anio: 2019,
    modelo: 'Freightliner Cascadia', color: 'White', registrationExpiry: '2027-03-31',
  })
})

test('returns null for every missing field', () => {
  assert.deepEqual(normalizeRegistration({}, NOW), {
    placa: null, vin: null, anio: null, modelo: null, color: null, registrationExpiry: null,
  })
  assert.deepEqual(normalizeRegistration(null, NOW), {
    placa: null, vin: null, anio: null, modelo: null, color: null, registrationExpiry: null,
  })
})

test('rejects a VIN that is not 17 characters or uses I, O or Q', () => {
  assert.equal(normalizeRegistration({ vin: '1FUJA6CV5CDBK123' }, NOW).vin, null)        // 16
  assert.equal(normalizeRegistration({ vin: '1FUJA6CV5CDBK12345' }, NOW).vin, null)      // 18
  assert.equal(normalizeRegistration({ vin: '1FUJA6CV5CDBK123I' }, NOW).vin, null)       // contains I
  assert.equal(normalizeRegistration({ vin: '1FUJA6CV5CDBK123O' }, NOW).vin, null)       // contains O
  assert.equal(normalizeRegistration({ vin: '1fuja6cv5 cdbk1234' }, NOW).vin, '1FUJA6CV5CDBK1234') // spaces removed
})

test('accepts the year as a number or numeric string within a sane range', () => {
  assert.equal(normalizeRegistration({ year: '2021' }, NOW).anio, 2021)
  assert.equal(normalizeRegistration({ year: 2027 }, NOW).anio, 2027)   // next model year is allowed
  assert.equal(normalizeRegistration({ year: 2028 }, NOW).anio, null)
  assert.equal(normalizeRegistration({ year: 1950 }, NOW).anio, null)
  assert.equal(normalizeRegistration({ year: 'abcd' }, NOW).anio, null)
})

test('builds the model from make and model, from make alone, or not at all', () => {
  assert.equal(normalizeRegistration({ make: 'Peterbilt', model: '389' }, NOW).modelo, 'Peterbilt 389')
  assert.equal(normalizeRegistration({ make: 'GREAT DANE' }, NOW).modelo, 'Great Dane')
  assert.equal(normalizeRegistration({ model: 'T680' }, NOW).modelo, 'T680')
  assert.equal(normalizeRegistration({ make: '  ', model: '' }, NOW).modelo, null)
})

test('does not repeat the make when the model already starts with it', () => {
  assert.equal(normalizeRegistration({ make: 'Kenworth', model: 'Kenworth T680' }, NOW).modelo, 'Kenworth T680')
})

test('title-cases shouting text but keeps mixed case as it came', () => {
  assert.equal(normalizeRegistration({ color: 'DARK BLUE' }, NOW).color, 'Dark Blue')
  assert.equal(normalizeRegistration({ color: 'Dark Blue' }, NOW).color, 'Dark Blue')
})

test('accepts ISO dates and MM/DD/YYYY, rejects invalid or out-of-range ones', () => {
  assert.equal(normalizeRegistration({ expirationDate: '2027-03-31' }, NOW).registrationExpiry, '2027-03-31')
  assert.equal(normalizeRegistration({ expirationDate: '03/31/2027' }, NOW).registrationExpiry, '2027-03-31')
  assert.equal(normalizeRegistration({ expirationDate: '2027-02-31' }, NOW).registrationExpiry, null)
  assert.equal(normalizeRegistration({ expirationDate: '1999-01-01' }, NOW).registrationExpiry, null)
  assert.equal(normalizeRegistration({ expirationDate: 'soon' }, NOW).registrationExpiry, null)
})

test('drops an absurdly long plate or model instead of passing it on', () => {
  assert.equal(normalizeRegistration({ plate: 'A'.repeat(20) }, NOW).placa, null)
  assert.equal(normalizeRegistration({ make: 'A'.repeat(70) }, NOW).modelo, null)
})

test('ignores personal data the model might send back', () => {
  const out = normalizeRegistration({ plate: 'ABC1234', ownerName: 'John Smith', ownerAddress: '1 Main St' }, NOW)
  assert.deepEqual(Object.keys(out).sort(), ['anio', 'color', 'modelo', 'placa', 'registrationExpiry', 'vin'])
})
