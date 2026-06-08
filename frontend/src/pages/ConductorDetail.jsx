import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { conductoresApi } from '../api/conductores.api'
import { StatusBadge } from '../components/StatusBadge'
import { getComplianceStatus, COMPLIANCE_FIELDS, computeNextDue } from '../utils/compliance'
import { DatePicker } from '../components/DatePicker'

const ESTADOS = ['activo', 'inactivo', 'vacaciones']

const ALL_DATE_KEYS = COMPLIANCE_FIELDS.map(f => f.key)

function toInputDate(iso) {
  if (!iso) return ''
  return typeof iso === 'string' ? iso.slice(0, 10) : new Date(iso).toISOString().slice(0, 10)
}

function fmtDate(iso) {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('en-US')
}

function DaysBadge({ nextDue }) {
  if (!nextDue) return null
  const daysLeft = Math.ceil((nextDue.getTime() - Date.now()) / 86400000)
  const cls = daysLeft < 0
    ? 'bg-danger/10 text-danger border-danger/30'
    : daysLeft <= 30
    ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
    : 'bg-success/10 text-success border-success/30'
  const badge = daysLeft < 0
    ? `${Math.abs(daysLeft)}d overdue`
    : daysLeft === 0
    ? 'Today'
    : `${daysLeft}d`
  return <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${cls}`}>{badge}</span>
}

export default function ConductorDetail() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [editInfo, setEditInfo] = useState(false)
  const [infoForm, setInfoForm] = useState({})
  const [infoError, setInfoError] = useState(null)

  const [editCompliance, setEditCompliance] = useState(false)
  const [complianceForm, setComplianceForm] = useState({})
  const [complianceError, setComplianceError] = useState(null)

  const { data: conductor, isLoading, isError } = useQuery({
    queryKey: ['conductor', id],
    queryFn: () => conductoresApi.get(id),
  })

  const updateMutation = useMutation({
    mutationFn: (data) => conductoresApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conductor', id] })
      qc.invalidateQueries({ queryKey: ['conductores'] })
      setEditInfo(false)
      setEditCompliance(false)
      setInfoError(null)
      setComplianceError(null)
    },
    onError: (err) => {
      const msg = err.response?.data?.error ?? 'Error saving'
      if (editInfo) setInfoError(msg)
      else setComplianceError(msg)
    },
  })

  if (isLoading) return <p className="text-text-muted p-4">{t('common.loading')}</p>
  if (isError || !conductor) return <p className="text-danger p-4">{t('trips.notFound')}</p>

  const { status: complianceStatus, closest } = getComplianceStatus(conductor)

  const statusLabel = { green: t('compliance.compliant'), yellow: t('compliance.expiringSoon'), red: t('compliance.nonCompliant') }[complianceStatus]
  const statusCls = { green: 'text-success', yellow: 'text-yellow-400', red: 'text-danger' }[complianceStatus]
  const dotCls = { green: 'bg-success', yellow: 'bg-yellow-400', red: 'bg-danger' }[complianceStatus]

  const startEditInfo = () => {
    setInfoForm({
      nombre: conductor.nombre,
      licencia: conductor.licencia ?? '',
      telefono: conductor.telefono ?? '',
      cdlNumber: conductor.cdlNumber ?? '',
      cdlState: conductor.cdlState ?? '',
      estado: conductor.estado,
    })
    setEditInfo(true)
    setInfoError(null)
  }

  const saveInfo = () => {
    if (!infoForm.nombre.trim()) return setInfoError(t('drivers.validationRequired'))
    updateMutation.mutate({
      nombre: infoForm.nombre.trim(),
      licencia: infoForm.licencia.trim() || null,
      telefono: infoForm.telefono.trim() || null,
      cdlNumber: infoForm.cdlNumber.trim() || null,
      cdlState: infoForm.cdlState.trim().toUpperCase() || null,
      estado: infoForm.estado,
    })
  }

  const startEditCompliance = () => {
    const form = {}
    for (const key of ALL_DATE_KEYS) form[key] = toInputDate(conductor[key])
    setComplianceForm(form)
    setEditCompliance(true)
    setComplianceError(null)
  }

  const saveCompliance = () => {
    const data = {}
    for (const key of ALL_DATE_KEYS) {
      data[key] = complianceForm[key] ? new Date(complianceForm[key]).toISOString() : null
    }
    updateMutation.mutate(data)
  }

  const field = 'bg-surface-2 border border-border-dim rounded-lg px-3 py-2 text-text-primary text-sm w-full focus:outline-none focus:border-gold placeholder:text-text-muted'

  return (
    <div className="space-y-6 max-w-4xl">
      <button onClick={() => navigate('/conductores')} className="text-text-muted hover:text-text-primary text-sm transition-colors">
        {t('drivers.backToList')}
      </button>

      {/* Header */}
      <div className="bg-surface border border-border-dim rounded-xl p-5 flex flex-wrap gap-4 items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="font-serif text-3xl text-text-primary">{conductor.nombre}</h2>
            <StatusBadge estado={conductor.estado} />
            <span className={`flex items-center gap-1.5 text-sm font-medium ${statusCls}`}>
              <span className={`w-2 h-2 rounded-full ${dotCls}`} />
              {statusLabel}
            </span>
          </div>
          <p className="text-text-muted text-sm">
            {t('drivers.lic')} {conductor.licencia ?? '–'}
            {conductor.cdlNumber ? ` · CDL ${conductor.cdlNumber}` : ''}
            {conductor.cdlState ? ` (${conductor.cdlState})` : ''}
            {conductor.telefono ? ` · ${conductor.telefono}` : ''}
          </p>
          {closest && (
            <p className={`text-xs mt-1 ${statusCls}`}>
              {closest.daysLeft < 0
                ? `${closest.label} ${closest.verb === 'expires' ? 'expired' : 'overdue'} ${Math.abs(closest.daysLeft)}d`
                : `${closest.label} ${closest.verb} in ${closest.daysLeft}d`}
            </p>
          )}
        </div>
      </div>

      {/* General Information */}
      <div className="bg-surface border border-border-dim rounded-xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-serif text-lg text-text-primary">{t('compliance.generalInfo')}</h3>
          {!editInfo ? (
            <button onClick={startEditInfo} className="text-xs text-gold border border-gold/30 rounded px-3 py-1 hover:opacity-70 transition-opacity">
              {t('common.edit')}
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => { setEditInfo(false); setInfoError(null) }} className="text-xs text-text-muted border border-border-dim rounded px-3 py-1 hover:text-text-primary">
                {t('common.cancel')}
              </button>
              <button onClick={saveInfo} disabled={updateMutation.isPending}
                className="text-xs bg-gold text-bg-deep font-semibold px-3 py-1 rounded hover:opacity-90 disabled:opacity-50">
                {updateMutation.isPending ? t('common.saving') : t('common.save')}
              </button>
            </div>
          )}
        </div>

        {editInfo ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('drivers.name')} *</label>
              <input className={field} value={infoForm.nombre} onChange={e => setInfoForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('drivers.status')}</label>
              <select className={field} value={infoForm.estado} onChange={e => setInfoForm(f => ({ ...f, estado: e.target.value }))}>
                {ESTADOS.map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('drivers.license')}</label>
              <input className={field} value={infoForm.licencia} onChange={e => setInfoForm(f => ({ ...f, licencia: e.target.value }))} />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('drivers.phone')}</label>
              <input className={field} value={infoForm.telefono} onChange={e => setInfoForm(f => ({ ...f, telefono: e.target.value }))} />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('drivers.cdlNumber')}</label>
              <input className={field} placeholder="FL1234567" value={infoForm.cdlNumber} onChange={e => setInfoForm(f => ({ ...f, cdlNumber: e.target.value }))} />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('drivers.cdlState')}</label>
              <input className={field} placeholder="FL" maxLength={2} value={infoForm.cdlState} onChange={e => setInfoForm(f => ({ ...f, cdlState: e.target.value }))} />
            </div>
            {infoError && <p className="md:col-span-2 text-danger text-sm">{infoError}</p>}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 text-sm">
            <div><p className="text-text-muted text-xs uppercase tracking-wide mb-0.5">{t('drivers.license')}</p><p className="text-text-primary">{conductor.licencia ?? '–'}</p></div>
            <div><p className="text-text-muted text-xs uppercase tracking-wide mb-0.5">{t('drivers.phone')}</p><p className="text-text-primary">{conductor.telefono ?? t('drivers.noPhone')}</p></div>
            <div><p className="text-text-muted text-xs uppercase tracking-wide mb-0.5">{t('drivers.status')}</p><StatusBadge estado={conductor.estado} /></div>
            <div><p className="text-text-muted text-xs uppercase tracking-wide mb-0.5">{t('drivers.cdlNumber')}</p><p className="text-text-primary font-mono">{conductor.cdlNumber ?? '–'}</p></div>
            <div><p className="text-text-muted text-xs uppercase tracking-wide mb-0.5">{t('drivers.cdlState')}</p><p className="text-text-primary">{conductor.cdlState ?? '–'}</p></div>
          </div>
        )}
      </div>

      {/* Compliance & Certifications */}
      <div className="bg-surface border border-border-dim rounded-xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-serif text-lg text-text-primary">{t('compliance.title')}</h3>
          {!editCompliance ? (
            <button onClick={startEditCompliance} className="text-xs text-gold border border-gold/30 rounded px-3 py-1 hover:opacity-70 transition-opacity">
              {t('common.edit')}
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => { setEditCompliance(false); setComplianceError(null) }} className="text-xs text-text-muted border border-border-dim rounded px-3 py-1 hover:text-text-primary">
                {t('common.cancel')}
              </button>
              <button onClick={saveCompliance} disabled={updateMutation.isPending}
                className="text-xs bg-gold text-bg-deep font-semibold px-3 py-1 rounded hover:opacity-90 disabled:opacity-50">
                {updateMutation.isPending ? t('common.saving') : t('common.save')}
              </button>
            </div>
          )}
        </div>

        {editCompliance ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {COMPLIANCE_FIELDS.map(compField => {
              const currentVal = complianceForm[compField.key] ?? ''
              const nextDue = compField.type === 'interval' && currentVal ? computeNextDue(compField, currentVal) : null
              return (
                <div key={compField.key}>
                  <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">
                    {t(compField.labelKey)}
                    <span className="normal-case ml-1 text-text-muted/60">({compField.type === 'interval' ? 'last completed' : 'expiry date'})</span>
                  </label>
                  <DatePicker value={currentVal} onChange={v => setComplianceForm(f => ({ ...f, [compField.key]: v }))} />
                  {nextDue && (
                    <p className="text-text-muted text-xs mt-0.5">Next due: {nextDue.toLocaleDateString('en-US')}</p>
                  )}
                </div>
              )
            })}
            {complianceError && <p className="md:col-span-2 text-danger text-sm">{complianceError}</p>}
          </div>
        ) : (
          <div className="divide-y divide-border-dim">
            {COMPLIANCE_FIELDS.map(compField => {
              const val = conductor[compField.key]
              const nextDue = computeNextDue(compField, val)
              return (
                <div key={compField.key} className="flex items-start justify-between py-2.5">
                  <p className="text-text-muted text-sm w-36 shrink-0">{t(compField.labelKey)}</p>
                  <div className="text-right">
                    {compField.type === 'interval' ? (
                      val ? (
                        <>
                          <p className="text-text-muted text-xs">Last: {fmtDate(val)}</p>
                          <div className="flex items-center gap-2 justify-end mt-0.5">
                            <p className="text-text-primary text-sm">Next: {nextDue ? fmtDate(nextDue) : '–'}</p>
                            <DaysBadge nextDue={nextDue} />
                          </div>
                        </>
                      ) : (
                        <p className="text-text-muted text-sm">–</p>
                      )
                    ) : (
                      <div className="flex items-center gap-2 justify-end">
                        <p className="text-text-primary text-sm">{val ? fmtDate(val) : '–'}</p>
                        <DaysBadge nextDue={nextDue} />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Trip History */}
      <div className="bg-surface border border-border-dim rounded-xl p-5">
        <h3 className="font-serif text-lg text-text-primary mb-4">{t('compliance.tripHistory')}</h3>
        {(conductor.vueltasPrincipal ?? []).length === 0 ? (
          <p className="text-text-muted text-sm">{t('compliance.noTrips')}</p>
        ) : (
          <div className="space-y-2">
            {conductor.vueltasPrincipal.map(v => (
              <div key={v.id} onClick={() => navigate(`/vueltas/${v.id}`)}
                className="flex items-center justify-between p-3 bg-surface-2 rounded-lg border border-border-dim cursor-pointer hover:border-gold/30 transition-colors text-sm">
                <div>
                  <p className="text-gold font-medium">{v.codigo}</p>
                  <p className="text-text-muted text-xs">
                    {v.camion?.placa} · {v.fechaSalida ? new Date(v.fechaSalida).toLocaleDateString('en-US') : '–'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-success">$ {(v.ingresoTotal ?? 0).toLocaleString('en-US')}</p>
                  <p className="text-text-muted text-xs capitalize">{v.estado?.replace('_', ' ')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
