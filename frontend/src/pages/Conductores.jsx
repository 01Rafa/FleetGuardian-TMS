import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { conductoresApi } from '../api/conductores.api'
import { StatusBadge } from '../components/StatusBadge'
import { getComplianceStatus } from '../utils/compliance'
import { useRole } from '../hooks/useRole'

const ESTADOS = ['activo', 'inactivo', 'vacaciones']
const EMPTY = { nombre: '', licencia: '', telefono: '', estado: 'activo' }

export default function Conductores() {
  const qc = useQueryClient()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isViewer } = useRole()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deleteError, setDeleteError] = useState(null)

  const { data: conductores = [], isLoading } = useQuery({
    queryKey: ['conductores'],
    queryFn: conductoresApi.list,
  })

  const createMutation = useMutation({
    mutationFn: (data) => conductoresApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conductores'] })
      setForm(EMPTY)
      setShowForm(false)
      setError(null)
    },
    onError: (err) => setError(err.response?.data?.error ?? t('drivers.errorSave')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => conductoresApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conductores'] })
      setConfirmDeleteId(null)
      setDeleteError(null)
    },
    onError: (err) => setDeleteError(err.response?.data?.error ?? t('drivers.errorDelete')),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) return setError(t('drivers.validationRequired'))
    createMutation.mutate({
      nombre: form.nombre.trim(),
      ...(form.licencia.trim() ? { licencia: form.licencia.trim() } : {}),
      ...(form.telefono.trim() ? { telefono: form.telefono.trim() } : {}),
      estado: form.estado,
    })
  }

  const field = 'bg-surface-2 border border-border-dim rounded-lg px-3 py-2 text-text-primary text-sm w-full focus:outline-none focus:border-gold placeholder:text-text-muted'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl text-text-primary">{t('drivers.title')}</h2>
        {!isViewer && (
          <button
            onClick={() => { setShowForm(v => !v); setError(null) }}
            className="bg-gold text-bg-deep font-semibold text-sm px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            {showForm ? t('common.cancel') : t('drivers.newDriver')}
          </button>
        )}
      </div>

      {showForm && !isViewer && (
        <form onSubmit={handleSubmit} className="bg-surface border border-border-dim rounded-xl p-5 space-y-4">
          <h3 className="font-serif text-lg text-text-primary">{t('drivers.formTitle')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('drivers.name')} *</label>
              <input className={field} placeholder="John Smith" value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('drivers.license')}</label>
              <input className={field} placeholder="CDL-FL-001" value={form.licencia}
                onChange={e => setForm(f => ({ ...f, licencia: e.target.value }))} />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('drivers.phone')}</label>
              <input className={field} placeholder="305-555-0100" value={form.telefono}
                onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('drivers.status')}</label>
              <select className={field} value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                {ESTADOS.map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-danger text-sm">{error}</p>}
          <button type="submit" disabled={createMutation.isPending}
            className="bg-gold text-bg-deep font-semibold text-sm px-5 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
            {createMutation.isPending ? t('drivers.saving') : t('drivers.addDriver')}
          </button>
        </form>
      )}

      {deleteError && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg px-4 py-2 text-danger text-sm flex justify-between">
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="hover:opacity-70">✕</button>
        </div>
      )}

      {isLoading ? <p className="text-text-muted">{t('common.loading')}</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {conductores.map(c => {
            const { status, closest } = getComplianceStatus(c)
            const borderCls = status === 'red'
              ? 'border-2 border-danger'
              : status === 'yellow'
              ? 'border-2 border-gold'
              : 'border border-border-dim'
            const dotCls = { green: 'bg-success', yellow: 'bg-yellow-400', red: 'bg-danger' }[status]
            const subtitleCls = status === 'red' ? 'text-danger' : 'text-yellow-400'
            const subtitle = closest
              ? closest.daysLeft < 0
                ? `${closest.label} ${closest.verb === 'expires' ? 'expired' : 'overdue'} ${Math.abs(closest.daysLeft)}d`
                : `${closest.label} ${closest.verb} in ${closest.daysLeft}d`
              : null

            return (
              <div
                key={c.id}
                onClick={() => navigate(`/conductores/${c.id}`)}
                className={`bg-surface ${borderCls} rounded-xl p-5 space-y-3 cursor-pointer hover:opacity-90 transition-opacity`}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-text-primary font-medium truncate">{c.nombre}</p>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dotCls}`} />
                    </div>
                    <p className="text-text-muted text-sm">{t('drivers.lic')} {c.licencia ?? '–'}</p>
                    {subtitle && (
                      <p className={`text-xs mt-0.5 ${subtitleCls}`}>{subtitle}</p>
                    )}
                  </div>
                  <StatusBadge estado={c.estado} />
                </div>
                <p className="text-text-muted text-xs">{c.telefono ?? t('drivers.noPhone')}</p>
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
          {conductores.length === 0 && <p className="text-text-muted text-sm col-span-3">{t('drivers.noDrivers')}</p>}
        </div>
      )}
    </div>
  )
}
