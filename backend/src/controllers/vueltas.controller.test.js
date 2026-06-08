import test from 'node:test'
import assert from 'node:assert/strict'
import { buildNextCodigo, prepareCreateVueltaData } from './vueltas.controller.js'

test('buildNextCodigo increments the latest global trip code', () => {
  assert.equal(buildNextCodigo('VLT-2026-', undefined), 'VLT-2026-001')
  assert.equal(buildNextCodigo('VLT-2026-', 'VLT-2026-008'), 'VLT-2026-009')
})

test('prepareCreateVueltaData builds an atomic vuelta create payload with totals', () => {
  const result = prepareCreateVueltaData({
    body: {
      camionId: 'truck-1',
      conductorPrincipalId: 'driver-1',
      baseSalida: 'Miami, FL',
      fechaSalida: '2026-06-08T10:00:00.000Z',
      tramos: [
        { origen: 'Miami, FL', destino: 'Atlanta, GA', orden: 1, fleteCobrado: 1200, kmRecorridos: 660 },
        { origen: 'Atlanta, GA', destino: 'Miami, FL', orden: 2, fleteCobrado: 0, kmRecorridos: null },
      ],
      gastos: [
        { categoria: 'combustible', monto: 300, descripcion: 'Fuel' },
        { categoria: 'peaje', monto: 75 },
      ],
    },
    empresaId: 'company-1',
    codigo: 'VLT-2026-001',
  })

  assert.equal(result.empresaId, 'company-1')
  assert.equal(result.codigo, 'VLT-2026-001')
  assert.equal(result.ingresoTotal, 1200)
  assert.equal(result.gastoTotal, 375)
  assert.equal(result.rentabilidadNeta, 825)
  assert.deepEqual(result.tramos.create, [
    { origen: 'Miami, FL', destino: 'Atlanta, GA', orden: 1, fleteCobrado: 1200, kmRecorridos: 660 },
    { origen: 'Atlanta, GA', destino: 'Miami, FL', orden: 2, fleteCobrado: 0, kmRecorridos: null },
  ])
  assert.deepEqual(result.gastos.create, [
    { categoria: 'combustible', monto: 300, descripcion: 'Fuel' },
    { categoria: 'peaje', monto: 75 },
  ])
})
