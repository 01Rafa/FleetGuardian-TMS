import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { piezasApi } from '../api/camiones.api'
import { DatePicker } from './DatePicker'
import { fmtDate, fmtMoney, FIELD_CLS } from '../utils/format'

const PIEZA_EMPTY = { nombre: '', numeroParte: '', proveedor: '', costo: '', cantidad: '1', fecha: '', notas: '' }

export function PiezasSection({ piezas, queryKey, createPieza, readOnly = false }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(PIEZA_EMPTY)
  const [error, setError] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const createMutation = useMutation({
    mutationFn: (data) => createPieza(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey })
      setForm(PIEZA_EMPTY)
      setShowForm(false)
      setError(null)
    },
    onError: (err) => setError(err.response?.data?.error ?? 'Error al guardar'),
  })

  const deleteMutation = useMutation({
    mutationFn: (piezaId) => piezasApi.delete(piezaId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey })
      setConfirmDeleteId(null)
    },
  })

  const submit = (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) return setError('Nombre de la pieza es obligatorio')
    if (!form.fecha) return setError('Fecha es obligatoria')
    if (!form.costo) return setError('Costo es obligatorio')
    createMutation.mutate({
      nombre: form.nombre.trim(),
      numeroParte: form.numeroParte.trim() || null,
      proveedor: form.proveedor.trim() || null,
      costo: parseFloat(form.costo),
      cantidad: form.cantidad ? parseInt(form.cantidad) : 1,
      fecha: new Date(form.fecha).toISOString(),
      notas: form.notas.trim() || null,
    })
  }

  const total = piezas.reduce((s, p) => s + p.costo * p.cantidad, 0)

  return (
    <div className="bg-surface border border-border-dim rounded-xl p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-serif text-lg text-text-primary">Piezas y Repuestos</h3>
        {!readOnly && (
          <button
            onClick={() => { setShowForm(v => !v); setError(null) }}
            className="bg-gold text-bg-deep font-semibold text-xs px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            {showForm ? 'Cancelar' : '+ Agregar Pieza'}
          </button>
        )}
      </div>

      {showForm && !readOnly && (
        <form onSubmit={submit} className="bg-surface-2 border border-border-dim rounded-lg p-4 mb-5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Nombre *</label>
              <input className={FIELD_CLS} placeholder="Filtro de aceite" value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Número de parte</label>
              <input className={FIELD_CLS} placeholder="OEM-12345" value={form.numeroParte}
                onChange={e => setForm(f => ({ ...f, numeroParte: e.target.value }))} />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Fecha *</label>
              <DatePicker value={form.fecha} onChange={v => setForm(f => ({ ...f, fecha: v }))} />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Proveedor</label>
              <input className={FIELD_CLS} placeholder="Distribuidora XYZ" value={form.proveedor}
                onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))} />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Costo unitario ($) *</label>
              <input className={FIELD_CLS} type="number" step="0.01" min="0" placeholder="0.00" value={form.costo}
                onChange={e => setForm(f => ({ ...f, costo: e.target.value }))} />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Cantidad</label>
              <input className={FIELD_CLS} type="number" min="1" step="1" value={form.cantidad}
                onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Notas</label>
              <input className={FIELD_CLS} placeholder="Observaciones opcionales" value={form.notas}
                onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
            </div>
          </div>
          {error && <p className="text-danger text-sm">{error}</p>}
          <button type="submit" disabled={createMutation.isPending}
            className="bg-gold text-bg-deep font-semibold text-sm px-4 py-1.5 rounded hover:opacity-90 disabled:opacity-50 transition-opacity">
            {createMutation.isPending ? 'Guardando…' : 'Guardar pieza'}
          </button>
        </form>
      )}

      {piezas.length === 0 ? (
        <p className="text-text-muted text-sm">No hay piezas registradas</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-muted text-xs uppercase tracking-wide border-b border-border-dim">
                <th className="text-left py-2 pr-3 font-normal">Fecha</th>
                <th className="text-left py-2 pr-3 font-normal">Pieza</th>
                <th className="text-left py-2 pr-3 font-normal">N° Parte</th>
                <th className="text-left py-2 pr-3 font-normal">Proveedor</th>
                <th className="text-right py-2 pr-3 font-normal">Cant.</th>
                <th className="text-right py-2 pr-3 font-normal">Costo Unit.</th>
                <th className="text-right py-2 font-normal">Total</th>
                <th className="py-2 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {piezas.map(p => (
                <tr key={p.id} className="border-b border-border-dim last:border-0">
                  <td className="py-2.5 pr-3 text-text-muted whitespace-nowrap">{fmtDate(p.fecha)}</td>
                  <td className="py-2.5 pr-3 text-text-primary">
                    <span>{p.nombre}</span>
                    {p.notas && <span className="block text-text-muted text-xs">{p.notas}</span>}
                  </td>
                  <td className="py-2.5 pr-3 text-text-muted font-mono text-xs">{p.numeroParte ?? '–'}</td>
                  <td className="py-2.5 pr-3 text-text-muted">{p.proveedor ?? '–'}</td>
                  <td className="py-2.5 pr-3 text-right text-text-primary">{p.cantidad}</td>
                  <td className="py-2.5 pr-3 text-right text-text-primary whitespace-nowrap">$ {fmtMoney(p.costo)}</td>
                  <td className="py-2.5 text-right text-text-primary whitespace-nowrap">$ {fmtMoney(p.costo * p.cantidad)}</td>
                  <td className="py-2.5 pl-2 text-right">
                    {readOnly ? null : confirmDeleteId === p.id ? (
                      <div className="flex gap-1 items-center justify-end">
                        <button onClick={() => deleteMutation.mutate(p.id)} disabled={deleteMutation.isPending}
                          className="text-xs bg-danger text-white px-2 py-0.5 rounded hover:opacity-80 disabled:opacity-50">Sí</button>
                        <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-text-muted hover:text-text-primary">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(p.id)} className="text-text-muted hover:text-danger text-xs transition-colors">✕</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6} className="pt-3 text-text-muted text-xs uppercase tracking-wide">Total piezas</td>
                <td className="pt-3 text-right text-gold font-semibold whitespace-nowrap">$ {fmtMoney(total)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
