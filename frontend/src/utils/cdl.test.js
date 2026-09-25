import test from 'node:test'
import assert from 'node:assert/strict'
import { applyCdl, summarizeCdl, CDL_FIELDS } from './cdl.js'

const full = { nombre: 'John Smith', cdlNumber: 'S123456', cdlState: 'FL', cdlExpiry: '2027-03-31' }

test('CDL_FIELDS lists the four extracted fields', () => {
  assert.deepEqual(CDL_FIELDS.map(f => f.key), ['nombre', 'cdlNumber', 'cdlState', 'cdlExpiry'])
})

test('applyCdl fills every extracted field as a string and reports them as filled', () => {
  const { form, filled, missing } = applyCdl({ nombre: '', notas: 'x' }, full)
  assert.equal(form.nombre, 'John Smith')
  assert.equal(form.cdlNumber, 'S123456')
  assert.equal(form.cdlState, 'FL')
  assert.equal(form.cdlExpiry, '2027-03-31')
  assert.equal(form.notas, 'x')
  assert.deepEqual(filled, ['nombre', 'cdlNumber', 'cdlState', 'cdlExpiry'])
  assert.deepEqual(missing, [])
})

test('applyCdl also mirrors the CDL number into licencia', () => {
  const { form } = applyCdl({ licencia: '' }, full)
  assert.equal(form.licencia, 'S123456')
})

test('applyCdl leaves licencia untouched when no CDL number was found', () => {
  const { form } = applyCdl({ licencia: 'OLD-1' }, { ...full, cdlNumber: null })
  assert.equal(form.licencia, 'OLD-1')
})

test('applyCdl keeps the current value of any field the document did not have', () => {
  const current = { nombre: 'Old Name', cdlNumber: 'OLD1', cdlState: 'TX', cdlExpiry: '2026-01-01' }
  const { form, filled, missing } = applyCdl(current, { ...full, cdlState: null, cdlExpiry: null })
  assert.equal(form.nombre, 'John Smith')
  assert.equal(form.cdlNumber, 'S123456')
  assert.equal(form.cdlState, 'TX')
  assert.equal(form.cdlExpiry, '2026-01-01')
  assert.deepEqual(filled, ['nombre', 'cdlNumber'])
  assert.deepEqual(missing, ['cdlState', 'cdlExpiry'])
})

test('applyCdl does not touch fields that are not part of the CDL', () => {
  const current = { telefono: '305-555-0100', estado: 'activo' }
  const { form } = applyCdl(current, full)
  for (const k of Object.keys(current)) assert.equal(form[k], current[k])
})

test('applyCdl does not mutate the form it receives', () => {
  const current = { nombre: '' }
  applyCdl(current, full)
  assert.deepEqual(current, { nombre: '' })
})

test('applyCdl handles an empty or missing answer', () => {
  const { form, filled, missing } = applyCdl({ nombre: 'A' }, null)
  assert.equal(form.nombre, 'A')
  assert.deepEqual(filled, [])
  assert.equal(missing.length, 4)
})

test('summarizeCdl returns which fields were found and which were not', () => {
  assert.deepEqual(summarizeCdl({ nombre: 'A', cdlNumber: null, cdlState: '', cdlExpiry: '2027-03-31' }), {
    filled: ['nombre', 'cdlExpiry'],
    missing: ['cdlNumber', 'cdlState'],
  })
})
