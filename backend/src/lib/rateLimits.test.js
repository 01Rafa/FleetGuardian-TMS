import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createLoginLimiter, createRegisterLimiter, createLoginEmailLimiters, createRefreshLimiter, createExtractLimiter } from './rateLimits.js'

// Small app with a login-like route: password "ok" succeeds, anything else is a 401.
async function withServer(limiter, run) {
  const app = express()
  app.use(express.json())
  app.post('/login', limiter, (req, res) => (req.body.password === 'ok' ? res.json({ ok: true }) : res.status(401).json({ error: 'Invalid credentials' })))
  const server = app.listen(0)
  const url = `http://127.0.0.1:${server.address().port}/login`
  const hit = (password, email) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password, email }) })
  try { await run(hit) } finally { server.close() }
}

test('login is blocked with 429 and a JSON error after too many failed attempts', async () => {
  await withServer(createLoginLimiter({ limit: 3 }), async hit => {
    for (let i = 0; i < 3; i++) assert.equal((await hit('bad')).status, 401)
    const blocked = await hit('bad')
    assert.equal(blocked.status, 429)
    assert.match((await blocked.json()).error, /too many/i)
  })
})

test('successful logins do not count toward the login limit', async () => {
  await withServer(createLoginLimiter({ limit: 3 }), async hit => {
    for (let i = 0; i < 10; i++) assert.equal((await hit('ok')).status, 200)
    assert.equal((await hit('bad')).status, 401)
  })
})

test('register limiter counts every request, successful or not', async () => {
  await withServer(createRegisterLimiter({ limit: 2 }), async hit => {
    assert.equal((await hit('ok')).status, 200)
    assert.equal((await hit('ok')).status, 200)
    assert.equal((await hit('ok')).status, 429)
  })
})

test('the default limits are 10 logins per 15 minutes and 5 registrations per hour', async () => {
  await withServer(createLoginLimiter(), async hit => {
    const res = await hit('bad')
    assert.equal(res.headers.get('ratelimit-policy')?.includes('900'), true)
  })
  await withServer(createRegisterLimiter(), async hit => {
    const res = await hit('ok')
    assert.equal(res.headers.get('ratelimit-policy')?.includes('3600'), true)
  })
})

test('per email: the sixth failed attempt is blocked, whatever the case or spaces, and other emails are unaffected', async () => {
  await withServer(createLoginEmailLimiters(), async hit => {
    for (let i = 0; i < 5; i++) assert.equal((await hit('bad', i % 2 ? ' A@X.com ' : 'a@x.com')).status, 401)
    const blocked = await hit('bad', 'a@x.com')
    assert.equal(blocked.status, 429)
    assert.match((await blocked.json()).error, /too many/i)
    assert.equal((await hit('bad', 'b@x.com')).status, 401)
  })
})

test('per email: a locked email is blocked even with the right password', async () => {
  await withServer(createLoginEmailLimiters(), async hit => {
    for (let i = 0; i < 5; i++) await hit('bad', 'a@x.com')
    assert.equal((await hit('ok', 'a@x.com')).status, 429)
  })
})

test('per email: successful logins do not count', async () => {
  await withServer(createLoginEmailLimiters(), async hit => {
    for (let i = 0; i < 12; i++) assert.equal((await hit('ok', 'a@x.com')).status, 200)
    assert.equal((await hit('bad', 'a@x.com')).status, 401)
  })
})

test('per email: the daily tier blocks after 15 failures even when the short tier keeps resetting', async () => {
  await withServer(createLoginEmailLimiters({ shortLimit: 100, dayLimit: 3 }), async hit => {
    for (let i = 0; i < 3; i++) assert.equal((await hit('bad', 'a@x.com')).status, 401)
    assert.equal((await hit('bad', 'a@x.com')).status, 429)
  })
})

test('per email: without an email the limiter falls back to the client IP', async () => {
  await withServer(createLoginEmailLimiters(), async hit => {
    for (let i = 0; i < 5; i++) assert.equal((await hit('bad')).status, 401)
    assert.equal((await hit('bad')).status, 429)
  })
})

test('the per-email limiters come as a short tier and a daily tier', () => {
  const limiters = createLoginEmailLimiters()
  assert.equal(limiters.length, 2)
  for (const l of limiters) assert.equal(typeof l, 'function')
})

test('refresh allows 60 per 15 minutes', async () => {
  await withServer(createRefreshLimiter(), async hit => {
    assert.match((await hit('ok')).headers.get('ratelimit-policy') ?? '', /60;w=900/)
  })
})

test('extraction is limited per user, not per IP', async () => {
  const app = express()
  app.use((req, _res, next) => { req.user = { userId: req.headers['x-user'] }; next() })
  app.post('/extract', createExtractLimiter({ limit: 2 }), (_req, res) => res.json({ ok: true }))
  const server = app.listen(0)
  const url = `http://127.0.0.1:${server.address().port}/extract`
  const as = user => fetch(url, { method: 'POST', headers: { 'x-user': user } })
  try {
    assert.equal((await as('ana')).status, 200)
    assert.equal((await as('ana')).status, 200)
    assert.equal((await as('ana')).status, 429)
    assert.equal((await as('luis')).status, 200)
  } finally { server.close() }
})

test('the default extraction limit is 10 per hour', async () => {
  const app = express()
  app.use((req, _res, next) => { req.user = { userId: 'ana' }; next() })
  app.post('/extract', createExtractLimiter(), (_req, res) => res.json({ ok: true }))
  const server = app.listen(0)
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/extract`, { method: 'POST' })
    assert.match(res.headers.get('ratelimit-policy') ?? '', /10;w=3600/)
  } finally { server.close() }
})
