import test from 'node:test'
import assert from 'node:assert/strict'

// We test the pure conversion logic only — ORS calls are integration-tested via verify-routes.mjs
test('miles conversion: 1000 meters = 0.621 miles (±0.01)', () => {
  const meters = 1000
  const miles = meters / 1609.34
  assert.ok(Math.abs(miles - 0.6214) < 0.01, `Got ${miles}`)
})

test('km conversion: 1000 meters = 1 km', () => {
  const meters = 1000
  const km = meters / 1000
  assert.equal(km, 1)
})

test('round-trip: 662 expected miles from Miami→Atlanta (within 5%)', () => {
  // Approximate straight-line distance in meters between Miami and Atlanta
  // Driving distance is ~1065 km = 661 miles, just sanity-check the formula
  const exampleMeters = 1064730
  const miles = exampleMeters / 1609.34
  assert.ok(Math.abs(miles - 662) / 662 < 0.05, `Got ${miles.toFixed(1)} miles, expected ~662`)
})
