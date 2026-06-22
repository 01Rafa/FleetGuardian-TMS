import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAddress } from './normalizeAddress.js'

test('lowercases and trims', () => {
  assert.equal(normalizeAddress('  Miami, FL  '), 'miami,fl')
})

test('removes periods', () => {
  assert.equal(normalizeAddress('St. Louis, MO'), 'st louis,mo')
})

test('collapses extra spaces', () => {
  assert.equal(normalizeAddress('Kansas  City,  MO'), 'kansas city,mo')
})

test('expands florida to fl', () => {
  assert.equal(normalizeAddress('Miami, Florida'), 'miami,fl')
})

test('expands texas to tx', () => {
  assert.equal(normalizeAddress('Dallas, Texas'), 'dallas,tx')
})

test('expands georgia to ga', () => {
  assert.equal(normalizeAddress('Atlanta, Georgia'), 'atlanta,ga')
})

test('expands california to ca', () => {
  assert.equal(normalizeAddress('Los Angeles, California'), 'los angeles,ca')
})

test('expands tennessee to tn', () => {
  assert.equal(normalizeAddress('Memphis, Tennessee'), 'memphis,tn')
})

test('expands illinois to il', () => {
  assert.equal(normalizeAddress('Chicago, Illinois'), 'chicago,il')
})

test('expands ohio to oh', () => {
  assert.equal(normalizeAddress('Columbus, Ohio'), 'columbus,oh')
})

test('handles already-abbreviated state', () => {
  assert.equal(normalizeAddress('Houston, TX'), 'houston,tx')
})

test('handles no space around comma', () => {
  assert.equal(normalizeAddress('Phoenix,AZ'), 'phoenix,az')
})
