import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeEmail } from './email.js'

test('trims and lowercases', () => {
  assert.equal(normalizeEmail('  Foo.Bar@Example.COM '), 'foo.bar@example.com')
})

test('missing values become an empty string instead of throwing', () => {
  assert.equal(normalizeEmail(undefined), '')
  assert.equal(normalizeEmail(null), '')
})
