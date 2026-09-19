import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { trailersApi } from '../api/trailers.api'
import { StatusBadge } from '../components/StatusBadge'
import { FleetTabs } from '../components/FleetTabs'
import { getTrailerComplianceStatus } from '../utils/trailerComplianceFields'
import { useRole } from '../hooks/useRole'
import { useWeightUnit } from '../context/WeightUnitContext'
import { displayToTons, formatWeight } from '../utils/weight'
import { unitLabel, hasUnitNumber } from '../utils/unit'
import { DatePicker } from '../components/DatePicker'
import { RegistrationUpload } from '../components/RegistrationUpload'
import { applyRegistration } from '../utils/registration'
import { FIELD_CLS } from '../utils/format'

const TIPOS = ['dry_van', 'reefer', 'flatbed', 'otro']
const ESTADOS = ['disponible', 'en_ruta', 'mantenimiento']
const EMPTY = { numeroUnidad: '', vin: '', color: '', registrationExpiry: '', placa: '', modelo: '', anio: '', capacidad: '', tipo: 'dry_van', estado: 'disponible' }

export default function Trailers() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { t } = useTranslation()
  const { isViewer } = useRole()
  const { weightUnit } = useWeightUnit()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deleteError, setDeleteError] = useState(null)

  const { data: trailers = [], isLoading } = useQuery({
    queryKey: ['trailers'],
    queryFn: trailersApi.list,
  })

  const createMutation = useMutation({
    mutationFn: (data) => trailersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trailers'] })
      setForm(EMPTY)
      setShowForm(false)
      setError(null)
    },
    onError: (err) => setError(err.response?.data?.error ?? t('fleet.errorSave')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => trailersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trailers'] })
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
      ...(form.numeroUnidad.trim() ? { numeroUnidad: form.numeroUnidad.trim() } : {}),
      ...(form.vin.trim() ? { vin: form.vin.trim().toUpperCase() } : {}),
      ...(form.color.trim() ? { color: form.color.trim() } : {}),
      ...(form.registrationExpiry ? { registrationExpiry: new Date(form.registrationExpiry).toISOString() } : {}),
      modelo: form.modelo.trim(),
      tipo: form.tipo,
      estado: form.estado,
      ...(form.anio ? { anio: parseInt(form.anio) } : {}),
      ...(form.capacidad ? { capacidadTon: displayToTons(form.capacidad, weightUnit) } : {}),
    })
  }

  const field = FIELD_CLS

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl text-text-primary">{t('fleet.title')}</h2>
        {!isViewer && (
          <button
            onClick={() => { setShowForm(v => !v); setError(null) }}
            className="bg-gold text-bg-deep font-semibold text-sm px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            {showForm ? t('common.cancel') : t('trailers.newTrailer')}
          </button>
        )}
      </div>

      <FleetTabs />

      {showForm && !isViewer && (
        <form onSubmit={handleSubmit} className="bg-surface border border-border-dim rounded-xl p-5 space-y-4">
          <h3 className="font-serif text-lg text-text-primary">{t('trailers.formTitle')}</h3>

          <RegistrationUpload onExtracted={(d) => setForm(f => applyRegistration(f, d).form)} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('fleet.unitNumber')}</label>
              <input className={field} placeholder="T-104" maxLength={30} value={form.numeroUnidad}
                onChange={e => setForm(f => ({ ...f, numeroUnidad: e.target.value }))} />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('fleet.plate')} *</label>
              <input className={field} placeholder="TR-123" value={form.placa}
                onChange={e => setForm(f => ({ ...f, placa: e.target.value }))} />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('fleet.model')} *</label>
              <input className={field} placeholder="Utility 3000R" value={form.modelo}
                onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('fleet.type')}</label>
              <select className={field} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                {TIPOS.map(tipo => <option key={tipo} value={tipo}>{t(`trailers.types.${tipo}`)}</option>)}
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
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('fleet.capacity')} ({weightUnit})</label>
              <input className={field} type="number" placeholder={weightUnit === 'lb' ? '45000' : '22.5'} step={weightUnit === 'lb' ? '1' : '0.1'} min="0" value={form.capacidad}
                onChange={e => setForm(f => ({ ...f, capacidad: e.target.value }))} />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('registration.fields.vin')}</label>
              <input className={field} placeholder="1FUJA6CV5CDBK1234" maxLength={17} value={form.vin}
                onChange={e => setForm(f => ({ ...f, vin: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('registration.fields.color')}</label>
              <input className={field} value={form.color}
                onChange={e => setForm(f => ({ ...f, color: e.target.value }))} />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('registration.fields.registrationExpiry')}</label>
              <DatePicker value={form.registrationExpiry} onChange={v => setForm(f => ({ ...f, registrationExpiry: v }))} />
            </div>
          </div>

          {error && <p className="text-danger text-sm">{error}</p>}

          <button type="submit" disabled={createMutation.isPending}
            className="bg-gold text-bg-deep font-semibold text-sm px-5 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
            {createMutation.isPending ? t('fleet.saving') : t('trailers.addTrailer')}
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
          {trailers.map(tr => {
            const { status, closest } = getTrailerComplianceStatus(tr)
            const borderCls = status === 'red' ? 'border-danger/50'
              : status === 'yellow' ? 'border-yellow-500/40'
              : 'border-border-dim hover:border-gold/30'
            const alertCls = status === 'red' ? 'text-danger' : 'text-yellow-400'
            return (
              <div
                key={tr.id}
                onClick={() => navigate(`/flota/trailers/${tr.id}`)}
                className={`bg-surface border ${borderCls} rounded-xl p-5 space-y-3 cursor-pointer transition-colors`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-gold font-medium text-lg">{unitLabel(tr)}</p>
                    <p className="text-text-muted text-sm">{hasUnitNumber(tr) ? `${t('fleet.plate')} ${tr.placa} · ` : ''}{tr.modelo} {tr.anio ? `(${tr.anio})` : ''}</p>
                    {closest && (
                      <p className={`text-xs mt-0.5 ${alertCls}`}>
                        {closest.daysLeft < 0
                          ? `${closest.label} ${closest.verb === 'expires' ? 'expired' : 'overdue'} ${Math.abs(closest.daysLeft)}d`
                          : `${closest.label} ${closest.verb} in ${closest.daysLeft}d`}
                      </p>
                    )}
                  </div>
                  <StatusBadge estado={tr.estado} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><p className="text-text-muted">{t('fleet.type')}</p><p className="text-text-primary">{t(`trailers.types.${tr.tipo}`, { defaultValue: tr.tipo })}</p></div>
                  <div><p className="text-text-muted">{t('fleet.capacity')}</p><p className="text-text-primary">{formatWeight(tr.capacidadTon, weightUnit)}</p></div>
                </div>
                {!isViewer && (
                  <div className="flex justify-end pt-1" onClick={e => e.stopPropagation()}>
                    {confirmDeleteId === tr.id ? (
                      <div className="flex gap-2 items-center">
                        <span className="text-text-muted text-xs">{t('common.confirmDelete')}</span>
                        <button
                          onClick={() => deleteMutation.mutate(tr.id)}
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
                        onClick={() => { setConfirmDeleteId(tr.id); setDeleteError(null) }}
                        className="text-text-muted hover:text-danger text-xs border border-border-dim hover:border-danger/40 rounded px-2 py-1 transition-colors"
                      >
                        {t('common.delete')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {trailers.length === 0 && <p className="text-text-muted text-sm col-span-3">{t('trailers.noTrailers')}</p>}
        </div>
      )}
    </div>
  )
}
