import test from 'node:test'
import assert from 'node:assert/strict'
import { parseOrigins, getAllowedOrigins, isOriginAllowed } from './cors.js'

test('parseOrigins splits, trims, lowercases, drops empties and trailing slashes', () => {
  assert.deepEqual(parseOrigins(' https://App.vercel.app/ , http://localhost:5173,, '), ['https://app.vercel.app', 'http://localhost:5173'])
  assert.deepEqual(parseOrigins(undefined), [])
  assert.deepEqual(parseOrigins(''), [])
})

test('getAllowedOrigins joins ALLOWED_ORIGINS and FRONTEND_URL without duplicates', () => {
  const out = getAllowedOrigins({ ALLOWED_ORIGINS: 'https://a.example,http://localhost:5173', FRONTEND_URL: 'https://a.example/' })
  assert.deepEqual(out, ['https://a.example', 'http://localhost:5173'])
})

test('getAllowedOrigins falls back to the local dev origin only when nothing is configured', () => {
  assert.deepEqual(getAllowedOrigins({}), ['http://localhost:5173'])
  assert.deepEqual(getAllowedOrigins({ FRONTEND_URL: 'https://a.example' }), ['https://a.example'])
})

const allowed = ['https://fleet.example.com', 'http://localhost:5173']

test('an allowed origin is accepted, also with different case or a trailing slash', () => {
  assert.equal(isOriginAllowed('https://fleet.example.com', allowed), true)
  assert.equal(isOriginAllowed('HTTPS://Fleet.Example.com', allowed), true)
  assert.equal(isOriginAllowed('https://fleet.example.com/', allowed), true)
  assert.equal(isOriginAllowed('http://localhost:5173', allowed), true)
})

test('requests without an Origin header (same origin, curl, server to server) are not blocked', () => {
  assert.equal(isOriginAllowed(undefined, allowed), true)
  assert.equal(isOriginAllowed('', allowed), true)
})

test('any other *.vercel.app site is rejected (the hole this fix closes)', () => {
  assert.equal(isOriginAllowed('https://evil.vercel.app', allowed), false)
  assert.equal(isOriginAllowed('https://evil.vercel.app', ['https://fleet.vercel.app']), false)
})

test('look-alike origins are rejected', () => {
  assert.equal(isOriginAllowed('https://fleet.example.com.evil.com', allowed), false) // suffix trick
  assert.equal(isOriginAllowed('https://evilfleet.example.com', allowed), false)      // prefix trick
  assert.equal(isOriginAllowed('http://fleet.example.com', allowed), false)           // wrong scheme
  assert.equal(isOriginAllowed('https://fleet.example.com:8443', allowed), false)     // wrong port
  assert.equal(isOriginAllowed('http://localhost:3000', allowed), false)              // other local port
  assert.equal(isOriginAllowed('null', allowed), false)                               // sandboxed iframe / file://
})

test('nothing is allowed when the list is empty, except requests without an Origin', () => {
  assert.equal(isOriginAllowed('https://fleet.example.com', []), false)
  assert.equal(isOriginAllowed(undefined, []), true)
})
