import test from 'node:test'
import assert from 'node:assert/strict'
import { computeComplianceStatus, getComplianceStatus } from './compliance.js'
import { getTruckComplianceStatus } from './truckComplianceFields.js'
import { TRAILER_COMPLIANCE_FIELDS, getTrailerComplianceStatus } from './trailerComplianceFields.js'

const NOW = Date.parse('2026-09-19T00:00:00.000Z')

test('TRAILER_COMPLIANCE_FIELDS has the six trailer fields, EPA reefer-only', () => {
  assert.deepEqual(TRAILER_COMPLIANCE_FIELDS.map(f => f.key), [
    'dotInspectionLastDate', 'stateInspectionLastDate', 'brakeInspectionLastDate',
    'registrationExpiry', 'cargoInsuranceExpiry', 'epaRefrigerantExpiry',
  ])
  assert.deepEqual(TRAILER_COMPLIANCE_FIELDS.filter(f => f.reeferOnly).map(f => f.key), ['epaRefrigerantExpiry'])
})

test('green when nothing is expiring', () => {
  const r = computeComplianceStatus({ tipo: 'dry_van', registrationExpiry: '2027-06-01' }, TRAILER_COMPLIANCE_FIELDS, NOW)
  assert.equal(r.status, 'green')
  assert.equal(r.closest, null)
})

test('green when no dates are set at all', () => {
  assert.equal(computeComplianceStatus({ tipo: 'dry_van' }, TRAILER_COMPLIANCE_FIELDS, NOW).status, 'green')
})

test('yellow when an expiry is within 30 days', () => {
  const r = computeComplianceStatus({ tipo: 'dry_van', registrationExpiry: '2026-10-01' }, TRAILER_COMPLIANCE_FIELDS, NOW)
  assert.equal(r.status, 'yellow')
  assert.equal(r.closest.key, 'registrationExpiry')
  assert.equal(r.closest.daysLeft, 12)
})

test('interval fields are due one year after the last date', () => {
  const r = computeComplianceStatus({ tipo: 'dry_van', dotInspectionLastDate: '2025-09-25' }, TRAILER_COMPLIANCE_FIELDS, NOW)
  assert.equal(r.status, 'yellow')
  assert.equal(r.closest.key, 'dotInspectionLastDate')
  assert.equal(r.closest.daysLeft, 6)
})

test('red when something is expired, closest is the most recently expired', () => {
  const r = computeComplianceStatus({
    tipo: 'dry_van',
    registrationExpiry: '2026-09-09',
    cargoInsuranceExpiry: '2026-09-16',
  }, TRAILER_COMPLIANCE_FIELDS, NOW)
  assert.equal(r.status, 'red')
  assert.equal(r.closest.key, 'cargoInsuranceExpiry')
  assert.equal(r.closest.daysLeft, -3)
})

test('the EPA field only counts for reefer trailers', () => {
  const dry = getTrailerComplianceStatus({ tipo: 'dry_van', epaRefrigerantExpiry: '2000-01-01' })
  const reefer = getTrailerComplianceStatus({ tipo: 'reefer', epaRefrigerantExpiry: '2000-01-01' })
  assert.equal(dry.status, 'green')
  assert.equal(reefer.status, 'red')
})

test('truck and driver wrappers keep their behavior', () => {
  assert.equal(getTruckComplianceStatus({ tipo: 'dry_van', epaRefrigerantExpiry: '2000-01-01' }).status, 'green')
  assert.equal(getTruckComplianceStatus({ tipo: 'reefer', epaRefrigerantExpiry: '2000-01-01' }).status, 'red')
  assert.equal(getTruckComplianceStatus({ tipo: 'dry_van', registrationExpiry: '2999-01-01' }).status, 'green')
  assert.equal(getComplianceStatus({ cdlExpiry: '2000-01-01' }).status, 'red')
  assert.equal(getComplianceStatus({ cdlExpiry: '2999-01-01' }).status, 'green')
})
