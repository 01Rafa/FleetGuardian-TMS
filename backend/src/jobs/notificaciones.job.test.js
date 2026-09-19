import test from 'node:test'
import assert from 'node:assert/strict'
import { TRAILER_FIELDS, computeNextDue, buildTrailerMessage, entidadTipoFor } from './notificaciones.job.js'

const byKey = (key) => TRAILER_FIELDS.find(f => f.key === key)

test('TRAILER_FIELDS has exactly the six trailer compliance fields', () => {
  assert.deepEqual(TRAILER_FIELDS.map(f => f.key).sort(), [
    'brakeInspectionLastDate', 'cargoInsuranceExpiry', 'dotInspectionLastDate',
    'epaRefrigerantExpiry', 'registrationExpiry', 'stateInspectionLastDate',
  ])
})

test('only the EPA refrigerant field is reefer-only', () => {
  assert.deepEqual(TRAILER_FIELDS.filter(f => f.reeferOnly).map(f => f.key), ['epaRefrigerantExpiry'])
})

test('computeNextDue: expiry fields use the date itself, interval fields add one year', () => {
  const expiry = computeNextDue(byKey('registrationExpiry'), '2027-01-01T00:00:00.000Z')
  assert.equal(expiry.toISOString(), '2027-01-01T00:00:00.000Z')
  const interval = computeNextDue(byKey('dotInspectionLastDate'), '2026-01-01T00:00:00.000Z')
  assert.equal(interval.toISOString(), '2027-01-01T00:00:00.000Z')
  assert.equal(computeNextDue(byKey('registrationExpiry'), null), null)
})

test('buildTrailerMessage covers overdue, due today and upcoming for both field types', () => {
  const reg = byKey('registrationExpiry')
  const dot = byKey('dotInspectionLastDate')
  assert.equal(buildTrailerMessage('TR-1', reg, -3), 'Trailer TR-1 registration is 3 days overdue')
  assert.equal(buildTrailerMessage('TR-1', reg, 0), 'Trailer TR-1 registration is due today')
  assert.equal(buildTrailerMessage('TR-1', reg, 1), 'Trailer TR-1 registration expires in 1 day')
  assert.equal(buildTrailerMessage('TR-1', dot, 5), 'Trailer TR-1 dot annual inspection is due in 5 days')
})

test('entidadTipoFor maps notification types to the entity used for navigation', () => {
  assert.equal(entidadTipoFor('compliance_driver'), 'conductor')
  assert.equal(entidadTipoFor('compliance_truck'), 'camion')
  assert.equal(entidadTipoFor('compliance_trailer'), 'trailer')
})
