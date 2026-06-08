import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { camionesApi } from '../api/camiones.api'
import { StatusBadge } from '../components/StatusBadge'
import { getTruckComplianceStatus } from '../utils/truckComplianceFields'
import { useRole } from '../hooks/useRole'

const TIPOS = ['tractocamion', 'camion_rigido', 'otro']
const ESTADOS = ['disponible', 'en_ruta', 'mantenimiento']
const EMPTY = { placa: '', modelo: '', anio: '', capacidadTon: '', tipo: 'dry_van', estado: 'disponible' }

export default function Flota() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { t } = useTranslation()
  const { isViewer } = useRole()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deleteError, setDeleteError] = useState(null)

  const { data: camiones = [], isLoading } = useQuery({
    queryKey: ['camiones'],
    queryFn: camionesApi.list,
  })

  const createMutation = useMutation({
    mutationFn: (data) => camionesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['camiones'] })
      setForm(EMPTY)
      setShowForm(false)
      setError(null)
    },
    onError: (err) => setError(err.response?.data?.error ?? t('fleet.errorSave')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => camionesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['camiones'] })
      setConfirmDeleteId(null)
      setDeleteError(null)
    },
    onError: (err) => setDeleteError(err.response?.data?.error ?? t('fleet.errorDelete')),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.placa.trim() || !form.modelo.trim()) return setError(t('fleet.validationRequired'))
    createMutation.mutate({
      placa: form.placa.trim().toUpperCase(),
      modelo: form.modelo.trim(),
      tipo: form.tipo,
      estado: form.estado,
      ...(form.anio ? { anio: parseInt(form.anio) } : {}),
      ...(form.capacidadTon ? { capacidadTon: parseFloat(form.capacidadTon) } : {}),
    })
  }

  const field = 'bg-surface-2 border border-border-dim rounded-lg px-3 py-2 text-text-primary text-sm w-full focus:outline-none focus:border-gold placeholder:text-text-muted'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl text-text-primary">{t('fleet.title')}</h2>
        {!isViewer && (
          <button
            onClick={() => { setShowForm(v => !v); setError(null) }}
            className="bg-gold text-bg-deep font-semibold text-sm px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            {showForm ? t('common.cancel') : t('fleet.newTruck')}
          </button>
        )}
      </div>

      {showForm && !isViewer && (
        <form onSubmit={handleSubmit} className="bg-surface border border-border-dim rounded-xl p-5 space-y-4">
          <h3 className="font-serif text-lg text-text-primary">{t('fleet.formTitle')}</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('fleet.plate')} *</label>
              <input className={field} placeholder="ABC-123" value={form.placa}
                onChange={e => setForm(f => ({ ...f, placa: e.target.value }))} />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('fleet.model')} *</label>
              <input className={field} placeholder="Volvo FH16" value={form.modelo}
                onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('fleet.type')}</label>
              <select className={field} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                {TIPOS.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
              </select>
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('fleet.status')}</label>
              <select className={field} value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                {ESTADOS.map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('fleet.year')}</label>
              <input className={field} type="number" placeholder="2022" min="1990" max="2030" value={form.anio}
                onChange={e => setForm(f => ({ ...f, anio: e.target.value }))} />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('fleet.capacity')}</label>
              <input className={field} type="number" placeholder="30" step="0.1" min="0" value={form.capacidadTon}
                onChange={e => setForm(f => ({ ...f, capacidadTon: e.target.value }))} />
            </div>
          </div>

          {error && <p className="text-danger text-sm">{error}</p>}

          <button type="submit" disabled={createMutation.isPending}
            className="bg-gold text-bg-deep font-semibold text-sm px-5 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
            {createMutation.isPending ? t('fleet.saving') : t('fleet.addTruck')}
          </button>
        </form>
      )}

      {deleteError && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg px-4 py-2 text-danger text-sm flex justify-between">
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="text-danger hover:opacity-70">✕</button>
        </div>
      )}

      {isLoading ? <p className="text-text-muted">{t('common.loading')}</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {camiones.map(c => {
            const { status, closest } = getTruckComplianceStatus(c)
            const borderCls = status === 'red' ? 'border-danger/50'
              : status === 'yellow' ? 'border-yellow-500/40'
              : 'border-border-dim hover:border-gold/30'
            const alertCls = status === 'red' ? 'text-danger' : 'text-yellow-400'
            return (
            <div
              key={c.id}
              onClick={() => navigate(`/flota/${c.id}`)}
              className={`bg-surface border ${borderCls} rounded-xl p-5 space-y-3 cursor-pointer transition-colors`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gold font-medium text-lg">{c.placa}</p>
                  <p className="text-text-muted text-sm">{c.modelo} {c.anio ? `(${c.anio})` : ''}</p>
                  {closest && (
                    <p className={`text-xs mt-0.5 ${alertCls}`}>
                      {closest.daysLeft < 0
                        ? `${closest.label} ${closest.verb === 'expires' ? 'expired' : 'overdue'} ${Math.abs(closest.daysLeft)}d`
                        : `${closest.label} ${closest.verb} in ${closest.daysLeft}d`}
                    </p>
                  )}
                </div>
                <StatusBadge estado={c.estado} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><p className="text-text-muted">{t('fleet.type')}</p><p className="text-text-primary capitalize">{c.tipo}</p></div>
                <div><p className="text-text-muted">{t('fleet.capacity')}</p><p className="text-text-primary">{c.capacidadTon ? `${c.capacidadTon} ton` : '–'}</p></div>
              </div>
              <div className="flex justify-end pt-1" onClick={e => e.stopPropagation()}>
                {confirmDeleteId === c.id ? (
                  <div className="flex gap-2 items-center">
                    <span className="text-text-muted text-xs">{t('common.confirmDelete')}</span>
                    <button
                      onClick={() => deleteMutation.mutate(c.id)}
                      disabled={deleteMutation.isPending}
                      className="text-xs bg-danger text-white px-3 py-1 rounded hover:opacity-80 disabled:opacity-50"
                    >
                      {t('common.yes')}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs text-text-muted hover:text-text-primary"
                    >
                      {t('common.no')}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setConfirmDeleteId(c.id); setDeleteError(null) }}
                    className="text-text-muted hover:text-danger text-xs border border-border-dim hover:border-danger/40 rounded px-2 py-1 transition-colors"
                  >
                    {t('common.delete')}
                  </button>
                )}
              </div>
            </div>
          )
          })}
          {camiones.length === 0 && <p className="text-text-muted text-sm col-span-3">{t('fleet.noTrucks')}</p>}
        </div>
      )}
    </div>
  )
}
