import test from 'node:test'
import assert from 'node:assert/strict'
import { formatCodigo, nextCodigo, withTripCode } from './tripCode.js'

test('formatCodigo pads to three digits and grows past 999', () => {
  assert.equal(formatCodigo(2026, 1), 'VLT-2026-001')
  assert.equal(formatCodigo(2026, 42), 'VLT-2026-042')
  assert.equal(formatCodigo(2026, 999), 'VLT-2026-999')
  assert.equal(formatCodigo(2026, 1000), 'VLT-2026-1000')
})

// Fake database: the counter lives in memory and $transaction runs the callback with a fake transaction.
function fakePrisma() {
  const counters = new Map()
  const tx = {
    $queryRaw: async (_strings, empresaId, anio) => {
      const key = `${empresaId}/${anio}`
      counters.set(key, (counters.get(key) ?? 0) + 1)
      return [{ ultimo: counters.get(key) }]
    },
  }
  return { counters, $transaction: async fn => fn(tx) }
}

test('nextCodigo counts per company and per year', async () => {
  const p = fakePrisma()
  await p.$transaction(async tx => {
    assert.equal(await nextCodigo(tx, 'A', 2026), 'VLT-2026-001')
    assert.equal(await nextCodigo(tx, 'A', 2026), 'VLT-2026-002')
    assert.equal(await nextCodigo(tx, 'B', 2026), 'VLT-2026-001')
    assert.equal(await nextCodigo(tx, 'A', 2027), 'VLT-2027-001')
  })
})

test('withTripCode passes the code to the creator and returns its result', async () => {
  const p = fakePrisma()
  const out = await withTripCode(p, 'A', async (_tx, codigo) => ({ codigo }), { anio: 2026 })
  assert.deepEqual(out, { codigo: 'VLT-2026-001' })
})

test('withTripCode retries on a unique violation and moves to the next number', async () => {
  const p = fakePrisma()
  let calls = 0
  const out = await withTripCode(p, 'A', async (_tx, codigo) => {
    calls++
    if (calls === 1) throw Object.assign(new Error('unique'), { code: 'P2002' })
    return { codigo }
  }, { anio: 2026 })
  assert.equal(calls, 2)
  assert.equal(out.codigo, 'VLT-2026-002')
})

test('withTripCode gives up after five attempts', async () => {
  const p = fakePrisma()
  let calls = 0
  await assert.rejects(
    withTripCode(p, 'A', async () => { calls++; throw Object.assign(new Error('unique'), { code: 'P2002' }) }, { anio: 2026 }),
    err => err.code === 'P2002',
  )
  assert.equal(calls, 5)
})

test('withTripCode does not retry other errors', async () => {
  const p = fakePrisma()
  let calls = 0
  await assert.rejects(
    withTripCode(p, 'A', async () => { calls++; throw new Error('boom') }, { anio: 2026 }),
    /boom/,
  )
  assert.equal(calls, 1)
})
