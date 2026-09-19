import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { mantenimientosApi } from '../api/camiones.api'
import { DatePicker } from './DatePicker'
import { fmtDate, fmtMoney, FIELD_CLS } from '../utils/format'

const TIPOS_MANT = ['aceite', 'llantas', 'frenos', 'electrico', 'revision', 'otro']
const MANT_EMPTY = { tipo: 'aceite', descripcion: '', costo: '', proveedor: '', fecha: '', proximoMantenimiento: '' }

const MANT_BADGE = {
  aceite:    'bg-blue-500/10 text-blue-400 border-blue-500/30',
  llantas:   'bg-orange-500/10 text-orange-400 border-orange-500/30',
  frenos:    'bg-red-500/10 text-red-400 border-red-500/30',
  electrico: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  revision:  'bg-purple-500/10 text-purple-400 border-purple-500/30',
  otro:      'bg-surface-2 text-text-muted border-border-dim',
}

export function MantenimientosSection({ mantenimientos, queryKey, createMantenimiento, readOnly = false }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(MANT_EMPTY)
  const [error, setError] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const createMutation = useMutation({
    mutationFn: (data) => createMantenimiento(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey })
      setForm(MANT_EMPTY)
      setShowForm(false)
      setError(null)
    },
    onError: (err) => setError(err.response?.data?.error ?? 'Error al guardar'),
  })

  const deleteMutation = useMutation({
    mutationFn: (mantId) => mantenimientosApi.delete(mantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey })
      setConfirmDeleteId(null)
    },
  })

  const submit = (e) => {
    e.preventDefault()
    if (!form.descripcion.trim() || !form.fecha) return setError('Descripción y fecha son obligatorias')
    createMutation.mutate({
      tipo: form.tipo,
      descripcion: form.descripcion.trim(),
      costo: form.costo ? parseFloat(form.costo) : 0,
      proveedor: form.proveedor.trim() || null,
      fecha: new Date(form.fecha).toISOString(),
      proximoMantenimiento: form.proximoMantenimiento ? new Date(form.proximoMantenimiento).toISOString() : null,
    })
  }

  const total = mantenimientos.reduce((s, m) => s + m.costo, 0)
  const proximos = mantenimientos
    .filter(m => m.proximoMantenimiento && new Date(m.proximoMantenimiento) > new Date())
    .sort((a, b) => new Date(a.proximoMantenimiento) - new Date(b.proximoMantenimiento))

  return (
    <>
      {proximos.length > 0 && (
        <div className="bg-surface border border-border-dim rounded-xl p-5">
          <h3 className="font-serif text-lg text-text-primary mb-3">Próximos mantenimientos</h3>
          <div className="space-y-2">
            {proximos.map(m => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b border-border-dim last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded border ${MANT_BADGE[m.tipo] ?? MANT_BADGE.otro}`}>{m.tipo}</span>
                  <span className="text-text-primary text-sm">{m.descripcion}</span>
                </div>
                <span className="text-text-muted text-xs">{fmtDate(m.proximoMantenimiento)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-surface border border-border-dim rounded-xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-serif text-lg text-text-primary">Historial de mantenimiento</h3>
          {!readOnly && (
            <button
              onClick={() => { setShowForm(v => !v); setError(null) }}
              className="bg-gold text-bg-deep font-semibold text-xs px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
            >
              {showForm ? 'Cancelar' : '+ Agregar'}
            </button>
          )}
        </div>

        {showForm && !readOnly && (
          <form onSubmit={submit} className="bg-surface-2 border border-border-dim rounded-lg p-4 mb-5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Tipo</label>
                <select className={FIELD_CLS} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  {TIPOS_MANT.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Fecha *</label>
                <DatePicker value={form.fecha} onChange={v => setForm(f => ({ ...f, fecha: v }))} />
              </div>
              <div className="md:col-span-2">
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Descripción *</label>
                <input className={FIELD_CLS} placeholder="Cambio de aceite 5W-30" value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
              </div>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Costo ($)</label>
                <input className={FIELD_CLS} type="number" step="0.01" min="0" placeholder="0.00" value={form.costo}
                  onChange={e => setForm(f => ({ ...f, costo: e.target.value }))} />
              </div>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Proveedor</label>
                <input className={FIELD_CLS} placeholder="Taller Mecánico XYZ" value={form.proveedor}
                  onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Próximo mantenimiento</label>
                <DatePicker value={form.proximoMantenimiento} onChange={v => setForm(f => ({ ...f, proximoMantenimiento: v }))} />
              </div>
            </div>
            {error && <p className="text-danger text-sm">{error}</p>}
            <button type="submit" disabled={createMutation.isPending}
              className="bg-gold text-bg-deep font-semibold text-sm px-4 py-1.5 rounded hover:opacity-90 disabled:opacity-50 transition-opacity">
              {createMutation.isPending ? 'Guardando…' : 'Guardar mantenimiento'}
            </button>
          </form>
        )}

        {mantenimientos.length === 0 ? (
          <p className="text-text-muted text-sm">No hay registros de mantenimiento</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted text-xs uppercase tracking-wide border-b border-border-dim">
                  <th className="text-left py-2 pr-4 font-normal">Fecha</th>
                  <th className="text-left py-2 pr-4 font-normal">Tipo</th>
                  <th className="text-left py-2 pr-4 font-normal">Descripción</th>
                  <th className="text-left py-2 pr-4 font-normal">Proveedor</th>
                  <th className="text-right py-2 font-normal">Costo</th>
                  <th className="py-2 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {mantenimientos.map(m => (
                  <tr key={m.id} className="border-b border-border-dim last:border-0">
                    <td className="py-2.5 pr-4 text-text-muted whitespace-nowrap">{fmtDate(m.fecha)}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded border ${MANT_BADGE[m.tipo] ?? MANT_BADGE.otro}`}>{m.tipo}</span>
                    </td>
                    <td className="py-2.5 pr-4 text-text-primary">{m.descripcion}</td>
                    <td className="py-2.5 pr-4 text-text-muted">{m.proveedor ?? '–'}</td>
                    <td className="py-2.5 text-right text-text-primary whitespace-nowrap">$ {fmtMoney(m.costo)}</td>
                    <td className="py-2.5 pl-3 text-right">
                      {readOnly ? null : confirmDeleteId === m.id ? (
                        <div className="flex gap-1 items-center justify-end">
                          <button onClick={() => deleteMutation.mutate(m.id)} disabled={deleteMutation.isPending}
                            className="text-xs bg-danger text-white px-2 py-0.5 rounded hover:opacity-80 disabled:opacity-50">Sí</button>
                          <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-text-muted hover:text-text-primary">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(m.id)} className="text-text-muted hover:text-danger text-xs transition-colors">✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="pt-3 text-text-muted text-xs uppercase tracking-wide">Total</td>
                  <td className="pt-3 text-right text-gold font-semibold">$ {fmtMoney(total)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
