import test from 'node:test'
import assert from 'node:assert/strict'
import { parseTrailerDateFields, TRAILER_DATE_FIELDS } from './trailers.controller.js'

test('TRAILER_DATE_FIELDS lists exactly the seven date columns', () => {
  assert.deepEqual([...TRAILER_DATE_FIELDS].sort(), [
    'brakeInspectionLastDate', 'cargoInsuranceExpiry', 'dotInspectionLastDate',
    'epaRefrigerantExpiry', 'fechaCompra', 'registrationExpiry', 'stateInspectionLastDate',
  ])
})

test('parseTrailerDateFields converts date strings to Date and empty values to null', () => {
  const out = parseTrailerDateFields({
    placa: 'TR-1',
    registrationExpiry: '2027-01-01',
    cargoInsuranceExpiry: '',
    epaRefrigerantExpiry: null,
  })
  assert.ok(out.registrationExpiry instanceof Date)
  assert.equal(out.cargoInsuranceExpiry, null)
  assert.equal(out.epaRefrigerantExpiry, null)
  assert.equal(out.placa, 'TR-1')
})

test('parseTrailerDateFields leaves absent date fields absent', () => {
  const out = parseTrailerDateFields({ placa: 'TR-1' })
  assert.equal('registrationExpiry' in out, false)
})
