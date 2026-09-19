import test from 'node:test'
import assert from 'node:assert/strict'
import { applyRegistration, summarizeRegistration, REGISTRATION_FIELDS } from './registration.js'

const full = { placa: 'ABC 1234', vin: '1FUJA6CV5CDBK1234', anio: 2019, modelo: 'Freightliner Cascadia', color: 'White', registrationExpiry: '2027-03-31' }

test('REGISTRATION_FIELDS lists the six extracted fields', () => {
  assert.deepEqual(REGISTRATION_FIELDS.map(f => f.key), ['placa', 'vin', 'anio', 'modelo', 'color', 'registrationExpiry'])
})

test('applyRegistration fills every extracted field as a string and reports them as filled', () => {
  const { form, filled, missing } = applyRegistration({ placa: '', notas: 'x' }, full)
  assert.equal(form.placa, 'ABC 1234')
  assert.equal(form.anio, '2019')
  assert.equal(form.registrationExpiry, '2027-03-31')
  assert.equal(form.notas, 'x')
  assert.deepEqual(filled, ['placa', 'vin', 'anio', 'modelo', 'color', 'registrationExpiry'])
  assert.deepEqual(missing, [])
})

test('applyRegistration keeps the current value of any field the document did not have', () => {
  const current = { placa: 'OLD-1', vin: 'OLDVIN', anio: '2015', modelo: 'Old', color: 'Red', registrationExpiry: '2026-01-01' }
  const { form, filled, missing } = applyRegistration(current, { ...full, color: null, vin: null, anio: null })
  assert.equal(form.color, 'Red')
  assert.equal(form.vin, 'OLDVIN')
  assert.equal(form.anio, '2015')
  assert.equal(form.placa, 'ABC 1234')
  assert.deepEqual(filled, ['placa', 'modelo', 'registrationExpiry'])
  assert.deepEqual(missing, ['vin', 'anio', 'color'])
})

test('applyRegistration does not touch fields that are not part of the registration', () => {
  const current = { numeroUnidad: 'T-104', tipo: 'reefer', estado: 'en_ruta', capacidad: '45000', notas: 'n' }
  const { form } = applyRegistration(current, full)
  for (const k of Object.keys(current)) assert.equal(form[k], current[k])
})

test('applyRegistration does not mutate the form it receives', () => {
  const current = { placa: '' }
  applyRegistration(current, full)
  assert.deepEqual(current, { placa: '' })
})

test('applyRegistration handles an empty or missing answer', () => {
  const { form, filled, missing } = applyRegistration({ placa: 'A' }, null)
  assert.equal(form.placa, 'A')
  assert.deepEqual(filled, [])
  assert.equal(missing.length, 6)
})

test('summarizeRegistration returns which fields were found and which were not', () => {
  assert.deepEqual(summarizeRegistration({ placa: 'A', vin: null, anio: 0, modelo: '', color: 'Red' }), {
    filled: ['placa', 'anio', 'color'],
    missing: ['vin', 'modelo', 'registrationExpiry'],
  })
})
