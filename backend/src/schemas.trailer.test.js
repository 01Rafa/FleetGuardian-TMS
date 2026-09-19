import test from 'node:test'
import assert from 'node:assert/strict'
import { createTrailerSchema, updateTrailerSchema } from './schemas.js'

const valid = { placa: 'TR-100', modelo: 'Utility 3000R', tipo: 'reefer' }

test('createTrailerSchema accepts the minimal valid trailer', () => {
  assert.equal(createTrailerSchema.safeParse(valid).success, true)
})

test('createTrailerSchema requires placa, modelo and tipo', () => {
  for (const key of ['placa', 'modelo', 'tipo']) {
    const { [key]: _omit, ...rest } = valid
    assert.equal(createTrailerSchema.safeParse(rest).success, false, `${key} should be required`)
  }
})

test('createTrailerSchema rejects unknown tipo and estado', () => {
  assert.equal(createTrailerSchema.safeParse({ ...valid, tipo: 'tractocamion' }).success, false)
  assert.equal(createTrailerSchema.safeParse({ ...valid, estado: 'roto' }).success, false)
})

test('createTrailerSchema accepts the compliance dates and nullable fields', () => {
  const r = createTrailerSchema.safeParse({
    ...valid, anio: 2021, capacidadTon: 22.5, estado: 'en_ruta', vin: null, color: null, notas: null,
    fechaCompra: '2024-01-01', dotInspectionLastDate: '2026-01-01', stateInspectionLastDate: null,
    brakeInspectionLastDate: '2026-02-01', registrationExpiry: '2027-01-01',
    cargoInsuranceExpiry: '2027-03-01', epaRefrigerantExpiry: null,
  })
  assert.equal(r.success, true)
})

test('create/update schemas strip owner-like and unknown fields', () => {
  const c = createTrailerSchema.parse({ ...valid, camionId: 'x', trailerId: 'y', empresaId: 'z' })
  assert.deepEqual(Object.keys(c).sort(), ['modelo', 'placa', 'tipo'])
  const u = updateTrailerSchema.parse({ placa: 'TR-2', empresaId: 'z', camionId: 'x' })
  assert.deepEqual(Object.keys(u), ['placa'])
})

test('updateTrailerSchema makes every field optional but validates provided ones', () => {
  assert.equal(updateTrailerSchema.safeParse({}).success, true)
  assert.equal(updateTrailerSchema.safeParse({ tipo: 'bogus' }).success, false)
  assert.equal(updateTrailerSchema.safeParse({ placa: '' }).success, false)
})
