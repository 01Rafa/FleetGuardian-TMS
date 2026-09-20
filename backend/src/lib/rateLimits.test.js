import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createLoginLimiter, createRegisterLimiter } from './rateLimits.js'

// Small app with a login-like route: password "ok" succeeds, anything else is a 401.
async function withServer(limiter, run) {
  const app = express()
  app.use(express.json())
  app.post('/login', limiter, (req, res) => (req.body.password === 'ok' ? res.json({ ok: true }) : res.status(401).json({ error: 'Invalid credentials' })))
  const server = app.listen(0)
  const url = `http://127.0.0.1:${server.address().port}/login`
  const hit = password => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
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
