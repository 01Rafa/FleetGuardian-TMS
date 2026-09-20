import test from 'node:test'
import assert from 'node:assert/strict'
import { generateTempPassword } from './tempPassword.js'

test('generates a 12 character password by default', () => {
  assert.equal(generateTempPassword().length, 12)
  assert.equal(generateTempPassword(16).length, 16)
})

test('always contains an upper case letter, a lower case letter and a digit', () => {
  for (let i = 0; i < 200; i++) {
    const p = generateTempPassword()
    assert.match(p, /[A-Z]/)
    assert.match(p, /[a-z]/)
    assert.match(p, /[0-9]/)
  }
})

test('never uses look-alike characters', () => {
  for (let i = 0; i < 200; i++) assert.doesNotMatch(generateTempPassword(), /[0O1lI]/)
})

test('two passwords are not the same', () => {
  const set = new Set(Array.from({ length: 50 }, () => generateTempPassword()))
  assert.equal(set.size, 50)
})

test('is never the old hardcoded password', () => {
  for (let i = 0; i < 50; i++) assert.notEqual(generateTempPassword(), 'Welcome2025!')
})
