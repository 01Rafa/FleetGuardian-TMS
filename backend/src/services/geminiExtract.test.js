import test from 'node:test'
import assert from 'node:assert/strict'
import { extractJsonFromDocument } from './geminiExtract.js'

const base = { buffer: Buffer.from('x'), mimeType: 'application/pdf', prompt: 'p', parseError: 'No se pudo leer', delays: [0, 0, 0], sleepFn: async () => {} }

test('returns the parsed JSON, also when the model wraps it in a markdown fence', async () => {
  const plain = await extractJsonFromDocument({ ...base, generate: async () => '{"a":1}' })
  assert.deepEqual(plain, { a: 1 })
  const fenced = await extractJsonFromDocument({ ...base, generate: async () => '```json\n{"b":2}\n```' })
  assert.deepEqual(fenced, { b: 2 })
})

test('throws the caller-provided message when the model does not return JSON, without retrying', async () => {
  let calls = 0
  await assert.rejects(
    extractJsonFromDocument({ ...base, generate: async () => { calls++; return 'not json' } }),
    { message: 'No se pudo leer' },
  )
  assert.equal(calls, 1)
})

test('retries on 503 and succeeds when the service recovers', async () => {
  let calls = 0
  const result = await extractJsonFromDocument({
    ...base,
    generate: async () => {
      calls++
      if (calls < 3) throw new Error('503 Service Unavailable')
      return '{"ok":true}'
    },
  })
  assert.deepEqual(result, { ok: true })
  assert.equal(calls, 3)
})

test('gives a friendly "busy" error after exhausting the retries', async () => {
  let calls = 0
  await assert.rejects(
    extractJsonFromDocument({ ...base, generate: async () => { calls++; throw new Error('model is overloaded') } }),
    (err) => err.message.includes('ocupado'),
  )
  assert.equal(calls, 4) // first try + 3 retries
})

test('does not retry errors that are not 503', async () => {
  let calls = 0
  await assert.rejects(
    extractJsonFromDocument({ ...base, generate: async () => { calls++; throw new Error('API key invalid') } }),
    { message: 'API key invalid' },
  )
  assert.equal(calls, 1)
})

test('retries network failures and succeeds when the connection recovers', async () => {
  let calls = 0
  const result = await extractJsonFromDocument({
    ...base,
    generate: async () => {
      calls++
      if (calls < 3) throw new Error('[GoogleGenerativeAI Error]: Error fetching from https://example: fetch failed')
      return '{"ok":true}'
    },
  })
  assert.deepEqual(result, { ok: true })
  assert.equal(calls, 3)
})

test('caps network retries at two and then reports a connection problem', async () => {
  let calls = 0
  await assert.rejects(
    extractJsonFromDocument({ ...base, generate: async () => { calls++; throw new Error('Error fetching from https://example: fetch failed') } }),
    (err) => err.message.includes('conectar'),
  )
  assert.equal(calls, 3) // first try + 2 retries
})

test('treats a timeout as a network failure', async () => {
  let calls = 0
  await assert.rejects(
    extractJsonFromDocument({ ...base, generate: async () => { calls++; throw new Error('The operation was aborted due to timeout') } }),
    (err) => err.message.includes('conectar'),
  )
  assert.equal(calls, 3)
})

test('forwards generationConfig and timeoutMs to the generator', async () => {
  let seen
  await extractJsonFromDocument({
    ...base,
    generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
    timeoutMs: 15000,
    generate: async (args) => { seen = args; return '{}' },
  })
  assert.deepEqual(seen.generationConfig, { thinkingConfig: { thinkingBudget: 0 } })
  assert.equal(seen.timeoutMs, 15000)
})

test('a 429 quota error is not treated as a network failure: no retries and a clear usage-limit message', async () => {
  let calls = 0
  const quota = () => Object.assign(
    new Error('[GoogleGenerativeAI Error]: Error fetching from https://x: [429 Too Many Requests] You exceeded your current quota'),
    { status: 429 })
  await assert.rejects(
    extractJsonFromDocument({ ...base, generate: async () => { calls++; throw quota() } }),
    (err) => err.message.includes('límite'),
  )
  assert.equal(calls, 1)
})

test('other HTTP errors that mention "Error fetching" (for example 400 or 403) are not retried and keep their message', async () => {
  let calls = 0
  const bad = Object.assign(new Error('Error fetching from https://x: [403 Forbidden] API key not valid'), { status: 403 })
  await assert.rejects(
    extractJsonFromDocument({ ...base, generate: async () => { calls++; throw bad } }),
    (err) => err.message.includes('403 Forbidden'),
  )
  assert.equal(calls, 1)
})
