import test from 'node:test'
import assert from 'node:assert/strict'
import { pickPiezaFields } from './piezas.controller.js'

test('pickPiezaFields keeps only editable part fields', () => {
  const out = pickPiezaFields({
    nombre: 'Filtro', costo: 12.5, cantidad: 2, fecha: '2026-09-01T00:00:00.000Z',
    numeroParte: 'A1', proveedor: 'XYZ', notas: 'ok',
    camionId: 'other-truck', trailerId: 'other-trailer', id: 'hack',
  })
  assert.deepEqual(Object.keys(out).sort(), ['cantidad', 'costo', 'fecha', 'nombre', 'notas', 'numeroParte', 'proveedor'])
})

test('pickPiezaFields omits fields that were not sent', () => {
  assert.deepEqual(pickPiezaFields({ costo: 5 }), { costo: 5 })
})
