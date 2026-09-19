import test from 'node:test'
import assert from 'node:assert/strict'
import { LB_PER_TON, tonsToDisplay, displayToTons, formatWeight } from './weight.js'

test('LB_PER_TON is the US short ton', () => {
  assert.equal(LB_PER_TON, 2000)
})

test('tonsToDisplay converts tons to lb', () => {
  assert.equal(tonsToDisplay(30, 'lb'), 60000)
  assert.equal(tonsToDisplay(22.5, 'lb'), 45000)
})

test('tonsToDisplay leaves tons untouched', () => {
  assert.equal(tonsToDisplay(30, 'ton'), 30)
})

test('tonsToDisplay rounds lb to whole pounds and tons to 2 decimals', () => {
  assert.equal(tonsToDisplay(22.4995, 'lb'), 44999)
  assert.equal(tonsToDisplay(22.12345, 'ton'), 22.12)
})

test('tonsToDisplay returns null for empty values', () => {
  assert.equal(tonsToDisplay(null, 'lb'), null)
  assert.equal(tonsToDisplay(undefined, 'ton'), null)
  assert.equal(tonsToDisplay('', 'lb'), null)
})

test('displayToTons converts lb to tons', () => {
  assert.equal(displayToTons(60000, 'lb'), 30)
  assert.equal(displayToTons('45000', 'lb'), 22.5)
})

test('displayToTons leaves tons untouched', () => {
  assert.equal(displayToTons('30', 'ton'), 30)
})

test('displayToTons returns null for empty or invalid input', () => {
  assert.equal(displayToTons('', 'lb'), null)
  assert.equal(displayToTons(null, 'ton'), null)
  assert.equal(displayToTons('abc', 'lb'), null)
})

test('lb -> tons -> lb round trip is lossless for whole pounds', () => {
  for (const lb of [1, 999, 44999, 45000, 80000]) {
    assert.equal(tonsToDisplay(displayToTons(lb, 'lb'), 'lb'), lb)
  }
})

test('formatWeight formats with unit suffix and thousands separator', () => {
  assert.equal(formatWeight(30, 'lb'), '60,000 lb')
  assert.equal(formatWeight(30, 'ton'), '30 ton')
  assert.equal(formatWeight(22.5, 'ton'), '22.5 ton')
})

test('formatWeight returns a dash for empty values', () => {
  assert.equal(formatWeight(null, 'lb'), '–')
  assert.equal(formatWeight(0, 'lb'), '–')
})
