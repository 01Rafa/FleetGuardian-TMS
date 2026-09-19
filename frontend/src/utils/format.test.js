import test from 'node:test'
import assert from 'node:assert/strict'
import { fmtDate, fmtDateUS, toInputDate } from './format.js'

// Date-only values (a purchase date, an expiry...) are stored as midnight UTC. They must show the same calendar
// day in every time zone, including the ones behind UTC where local time is still the previous day.
function inZone(tz, fn) {
  const previous = process.env.TZ
  process.env.TZ = tz
  try { return fn() } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous }
}

const STORED = '2027-03-31T00:00:00.000Z'
const ZONES = ['America/Mexico_City', 'America/Los_Angeles', 'UTC', 'Europe/Madrid', 'Asia/Tokyo', 'Pacific/Auckland']

test('the zone switch used by these tests really changes the local day (guards against a vacuous test)', () => {
  assert.equal(inZone('America/Mexico_City', () => new Date(STORED).getDate()), 30)
  assert.equal(inZone('Pacific/Auckland', () => new Date(STORED).getDate()), 31)
})

test('fmtDate shows the stored calendar day (dd/mm/yyyy) in every time zone', () => {
  for (const tz of ZONES) assert.equal(inZone(tz, () => fmtDate(STORED)), '31/03/2027', tz)
})

test('fmtDate also accepts a Date object (used for computed due dates)', () => {
  for (const tz of ZONES) assert.equal(inZone(tz, () => fmtDate(new Date(STORED))), '31/03/2027', tz)
})

test('fmtDateUS shows the stored calendar day (m/d/yyyy) in every time zone', () => {
  for (const tz of ZONES) assert.equal(inZone(tz, () => fmtDateUS(STORED)), '3/31/2027', tz)
})

test('empty values show a dash', () => {
  assert.equal(fmtDate(null), '–')
  assert.equal(fmtDate(''), '–')
  assert.equal(fmtDateUS(undefined), '–')
})

test('toInputDate keeps returning the stored calendar day for the date pickers', () => {
  assert.equal(toInputDate(STORED), '2027-03-31')
  assert.equal(toInputDate(null), '')
})
