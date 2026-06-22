import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDistanceUnit } from '../context/DistanceUnitContext'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vueltasApi, tramosApi, gastosApi, sugerenciasApi } from '../api/vueltas.api'
import { camionesApi } from '../api/camiones.api'
import { conductoresApi } from '../api/conductores.api'
import { StatusBadge } from '../components/StatusBadge'
import { TramoTimeline } from '../components/TramoTimeline'
import { GastosDonut } from '../components/GastosDonut'
import BrokerAutocomplete from '../components/BrokerAutocomplete'
import { DateTimePicker } from '../components/DatePicker'

const ESTADOS = ['planificada', 'en_curso', 'completada', 'facturada']
const TIPOS_TRAMO = ['carga', 'vacio', 'regreso']
const CATEGORIAS = ['combustible', 'peaje', 'viatico', 'mantenimiento', 'otro']

const fmt = (n) => `$ ${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
const toLocal = (iso) => iso ? iso.slice(0, 16) : ''

export default function VueltaDetail() {
  const { t } = useTranslation()
  const { unit } = useDistanceUnit()
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [editingInfo, setEditingInfo] = useState(false)
  const [infoForm, setInfoForm] = useState(null)
  const [showConductor2, setShowConductor2] = useState(false)
  const [infoHints, setInfoHints] = useState({ camion: null, conductorPrincipal: null, conductorSecundario: null })
  const [editingTramoId, setEditingTramoId] = useState(null)
  const [tramoForm, setTramoForm] = useState(null)
  const [editingGastoId, setEditingGastoId] = useState(null)
  const [gastoForm, setGastoForm] = useState(null)
  const [newTramo, setNewTramo] = useState({ origen: '', destino: '', broker: null, numeroCarga: '', fleteCobrado: '', kmRecorridos: '', tipo: 'carga', fechaHora: '' })
  const [newGasto, setNewGasto] = useState({ categoria: 'combustible', monto: '', descripcion: '' })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['vuelta', id] })
    qc.invalidateQueries({ queryKey: ['vueltas'] })
  }

  const { data: vuelta, isLoading } = useQuery({ queryKey: ['vuelta', id], queryFn: () => vueltasApi.get(id) })
  const { data: camiones = [] } = useQuery({ queryKey: ['camiones'], queryFn: camionesApi.list })
  const { data: conductores = [] } = useQuery({ queryKey: ['conductores'], queryFn: conductoresApi.list })

  const estadoMutation = useMutation({
    mutationFn: (estado) => vueltasApi.changeEstado(id, estado),
    onSuccess: invalidate,
  })

  const updateInfoMutation = useMutation({
    mutationFn: (data) => vueltasApi.update(id, data),
    onSuccess: () => { invalidate(); setEditingInfo(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: () => vueltasApi.delete(id),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['vuelta', id] })
      qc.removeQueries({ queryKey: ['vueltas'] })
      navigate('/vueltas')
    },
  })

  const createTramoMutation = useMutation({
    mutationFn: (data) => vueltasApi.createTramo(id, data),
    onSuccess: () => { invalidate(); setNewTramo({ origen: '', destino: '', broker: null, numeroCarga: '', fleteCobrado: '', kmRecorridos: '', tipo: 'carga', fechaHora: '' }) },
  })

  const updateTramoMutation = useMutation({
    mutationFn: ({ tramoId, data }) => tramosApi.update(tramoId, data),
    onSuccess: () => { invalidate(); setEditingTramoId(null) },
  })

  const deleteTramoMutation = useMutation({
    mutationFn: (tramoId) => tramosApi.delete(tramoId),
    onSuccess: invalidate,
  })

  const createGastoMutation = useMutation({
    mutationFn: (data) => vueltasApi.createGasto(id, data),
    onSuccess: () => { invalidate(); setNewGasto({ categoria: 'combustible', monto: '', descripcion: '' }) },
  })

  const updateGastoMutation = useMutation({
    mutationFn: ({ gastoId, data }) => gastosApi.update(gastoId, data),
    onSuccess: () => { invalidate(); setEditingGastoId(null) },
  })

  const deleteGastoMutation = useMutation({
    mutationFn: (gastoId) => gastosApi.delete(gastoId),
    onSuccess: invalidate,
  })

  if (isLoading) return <p className="text-text-muted">{t('common.loading')}</p>
  if (!vuelta) return <p className="text-danger">{t('trips.notFound')}</p>

  const f = 'bg-surface-2 border border-border-dim rounded-lg px-3 py-1.5 text-text-primary text-sm focus:outline-none focus:border-gold w-full'

  const startEditInfo = () => {
    setInfoForm({
      camionId: vuelta.camionId,
      conductorPrincipalId: vuelta.conductorPrincipalId,
      conductorSecundarioId: vuelta.conductorSecundarioId ?? '',
      baseSalida: vuelta.baseSalida,
      fechaSalida: toLocal(vuelta.fechaSalida),
      fechaRegreso: toLocal(vuelta.fechaRegreso),
      notas: vuelta.notas ?? '',
    })
    setShowConductor2(!!vuelta.conductorSecundarioId)
    setInfoHints({ camion: null, conductorPrincipal: null, conductorSecundario: null })
    setEditingInfo(true)
  }

  const saveInfo = () => {
    updateInfoMutation.mutate({
      camionId: infoForm.camionId,
      conductorPrincipalId: infoForm.conductorPrincipalId,
      conductorSecundarioId: infoForm.conductorSecundarioId || null,
      baseSalida: infoForm.baseSalida,
      fechaSalida: infoForm.fechaSalida ? new Date(infoForm.fechaSalida).toISOString() : undefined,
      fechaRegreso: infoForm.fechaRegreso ? new Date(infoForm.fechaRegreso).toISOString() : null,
      notas: infoForm.notas || null,
    })
  }

  const onInfoConductorChange = async (conductorId) => {
    const currentCamionId = infoForm?.camionId
    setInfoForm(s => ({ ...s, conductorPrincipalId: conductorId }))
    if (!conductorId) { setInfoHints(h => ({ ...h, camion: null })); return }
    try {
      const { camion } = await sugerenciasApi.byConductor(conductorId)
      setInfoHints(h => ({ ...h, camion: camion ?? null }))
      if (camion && !currentCamionId) setInfoForm(s => ({ ...s, camionId: camion.id }))
    } catch {
      // Suggestions are optional.
    }
  }

  const onInfoCamionChange = async (camionId) => {
    const currentConductorId = infoForm?.conductorPrincipalId
    setInfoForm(s => ({ ...s, camionId }))
    if (!camionId) { setInfoHints(h => ({ ...h, conductorPrincipal: null })); return }
    try {
      const { conductor } = await sugerenciasApi.byCamion(camionId)
      setInfoHints(h => ({ ...h, conductorPrincipal: conductor ?? null }))
      if (conductor && !currentConductorId) setInfoForm(s => ({ ...s, conductorPrincipalId: conductor.id }))
    } catch {
      // Suggestions are optional.
    }
  }

  const onShowConductor2Edit = async () => {
    setShowConductor2(true)
    if (infoForm?.conductorPrincipalId) {
      try {
        const { conductor } = await sugerenciasApi.byConductorPrincipal(infoForm.conductorPrincipalId)
        setInfoHints(h => ({ ...h, conductorSecundario: conductor ?? null }))
        if (conductor && !infoForm.conductorSecundarioId) setInfoForm(s => ({ ...s, conductorSecundarioId: conductor.id }))
      } catch {
        // Suggestions are optional.
      }
    }
  }

  const startEditTramo = (tramo) => {
    setTramoForm({ origen: tramo.origen, destino: tramo.destino, broker: tramo.broker ?? null, numeroCarga: tramo.numeroCarga ?? '', fleteCobrado: tramo.fleteCobrado, kmRecorridos: tramo.kmRecorridos ?? '', tipo: tramo.tipo, fechaHora: toLocal(tramo.fechaHora) })
    setEditingTramoId(tramo.id)
  }

  const saveTramo = (tramoId) => {
    updateTramoMutation.mutate({
      tramoId,
      data: {
        origen: tramoForm.origen,
        destino: tramoForm.destino,
        brokerId: tramoForm.broker?.id ?? null,
        numeroCarga: tramoForm.numeroCarga || null,
        fleteCobrado: Number(tramoForm.fleteCobrado) || 0,
        kmRecorridos: tramoForm.kmRecorridos ? Number(tramoForm.kmRecorridos) : null,
        tipo: tramoForm.tipo,
        fechaHora: tramoForm.fechaHora ? new Date(tramoForm.fechaHora).toISOString() : null,
      },
    })
  }

  const startEditGasto = (g) => {
    setGastoForm({ categoria: g.categoria, monto: g.monto, descripcion: g.descripcion ?? '' })
    setEditingGastoId(g.id)
  }

  const saveGasto = (gastoId) => {
    updateGastoMutation.mutate({ gastoId, data: { categoria: gastoForm.categoria, monto: Number(gastoForm.monto), descripcion: gastoForm.descripcion || null } })
  }

  const addTramo = () => {
    if (!newTramo.origen || !newTramo.destino) return
    createTramoMutation.mutate({
      origen: newTramo.origen,
      destino: newTramo.destino,
      brokerId: newTramo.broker?.id ?? null,
      numeroCarga: newTramo.numeroCarga || null,
      orden: (vuelta.tramos?.length ?? 0) + 1,
      fleteCobrado: Number(newTramo.fleteCobrado) || 0,
      kmRecorridos: newTramo.kmRecorridos ? Number(newTramo.kmRecorridos) : null,
      tipo: newTramo.tipo,
      fechaHora: newTramo.fechaHora ? new Date(newTramo.fechaHora).toISOString() : null,
    })
  }

  const addGasto = () => {
    if (!newGasto.monto) return
    createGastoMutation.mutate({ categoria: newGasto.categoria, monto: Number(newGasto.monto), descripcion: newGasto.descripcion || null })
  }

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="font-serif text-2xl text-text-primary">{vuelta.codigo}</h2>
            <StatusBadge estado={vuelta.estado} />
          </div>
          <p className="text-text-muted text-sm">
            {vuelta.camion?.placa} · {vuelta.conductorPrincipal?.nombre}
            {vuelta.conductorSecundario && ` / ${vuelta.conductorSecundario.nombre}`}
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={vuelta.estado}
            onChange={e => estadoMutation.mutate(e.target.value)}
            className="bg-surface border border-border-dim rounded-lg px-3 py-1.5 text-text-primary text-sm focus:outline-none focus:border-gold"
          >
            {ESTADOS.map(e => <option key={e} value={e}>{t(`status.${e}`)}</option>)}
          </select>
          <button
            onClick={() => confirm(t('trips.detail.confirmDelete')) && deleteMutation.mutate()}
            className="border border-danger/30 text-danger px-3 py-1.5 rounded-lg text-sm hover:bg-danger/10 transition-colors"
          >
            {t('trips.detail.delete')}
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('trips.detail.totalIncome'), value: fmt(vuelta.ingresoTotal), cls: 'text-success' },
          { label: t('trips.detail.totalExpense'), value: fmt(vuelta.gastoTotal), cls: 'text-danger' },
          { label: t('trips.detail.profitability'), value: fmt(vuelta.rentabilidadNeta), cls: vuelta.rentabilidadNeta >= 0 ? 'text-success' : 'text-danger' },
          { label: t('trips.detail.kmTotal'), value: `${(vuelta.kmTotales ?? 0).toLocaleString('en-US')} ${unit}`, cls: 'text-gold' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-surface border border-border-dim rounded-xl p-4">
            <p className="text-text-muted text-xs uppercase tracking-wide mb-1">{label}</p>
            <p className={`font-serif text-xl font-bold ${cls}`}>{value}</p>
          </div>
        ))}

        {/* CPM card */}
        {vuelta.cpm != null ? (
          <div className="bg-surface border border-border-dim rounded-xl p-4">
            <p className="text-text-muted text-xs uppercase tracking-wide mb-1">{t('trips.cpm')}</p>
            <p className="text-text-primary text-2xl font-semibold">
              {fmt(vuelta.cpm)}<span className="text-text-muted text-sm font-normal"> /mi</span>
            </p>
            <p className="text-text-muted text-xs mt-1">{vuelta.totalMillas?.toFixed(1)} mi total</p>
          </div>
        ) : (
          <div className="bg-surface border border-border-dim rounded-xl p-4 opacity-50">
            <p className="text-text-muted text-xs uppercase tracking-wide mb-1">{t('trips.cpm')}</p>
            <p className="text-text-muted text-sm">{t('trips.enterMilesManually')}</p>
          </div>
        )}
      </div>

      {/* Basic Info */}
      <div className="bg-surface border border-border-dim rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-lg text-text-primary">{t('trips.detail.info')}</h3>
          {!editingInfo
            ? <button onClick={startEditInfo} className="text-text-muted hover:text-gold text-xs border border-border-dim px-3 py-1 rounded-lg transition-colors">{t('trips.detail.edit')}</button>
            : <button onClick={() => setEditingInfo(false)} className="text-text-muted hover:text-text-primary text-xs border border-border-dim px-3 py-1 rounded-lg transition-colors">{t('common.cancel')}</button>
          }
        </div>

        {editingInfo && infoForm ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('trips.detail.mainDriver')}</label>
                <select className={f} value={infoForm.conductorPrincipalId} onChange={e => onInfoConductorChange(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {conductores.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                {infoHints.conductorPrincipal && infoForm.conductorPrincipalId === infoHints.conductorPrincipal.id && (
                  <p className="text-gold/70 text-xs mt-0.5">{t('trips.hints.usualDriver')} {camiones.find(c => c.id === infoForm.camionId)?.placa}</p>
                )}
              </div>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('trips.detail.truck')}</label>
                <select className={f} value={infoForm.camionId} onChange={e => onInfoCamionChange(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {camiones.map(c => <option key={c.id} value={c.id}>{c.placa} — {c.modelo}</option>)}
                </select>
                {infoHints.camion && infoForm.camionId === infoHints.camion.id && (
                  <p className="text-gold/70 text-xs mt-0.5">{t('trips.hints.usualTruck')} {conductores.find(c => c.id === infoForm.conductorPrincipalId)?.nombre}</p>
                )}
              </div>
              <div className="col-span-2">
                {!showConductor2 ? (
                  <button type="button" onClick={onShowConductor2Edit} className="text-text-muted text-xs hover:text-gold transition-colors">
                    {t('trips.detail.addSecondDriver')}
                  </button>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-text-muted text-xs uppercase tracking-wide">{t('trips.detail.secondDriver')}</label>
                      <button type="button" onClick={() => { setShowConductor2(false); setInfoForm(s => ({ ...s, conductorSecundarioId: '' })) }}
                        className="text-text-muted text-xs hover:text-danger">{t('trips.detail.removeDriver')}</button>
                    </div>
                    <select className={f} value={infoForm.conductorSecundarioId}
                      onChange={e => setInfoForm(s => ({ ...s, conductorSecundarioId: e.target.value }))}>
                      <option value="">Ninguno</option>
                      {conductores.filter(c => c.id !== infoForm.conductorPrincipalId).map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                    {infoHints.conductorSecundario && infoForm.conductorSecundarioId === infoHints.conductorSecundario.id && (
                      <p className="text-gold/70 text-xs mt-0.5">{t('trips.hints.usualSecondary')} {conductores.find(c => c.id === infoForm.conductorPrincipalId)?.nombre}</p>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('trips.detail.baseSalida')}</label>
                <input className={f} value={infoForm.baseSalida} onChange={e => setInfoForm(s => ({ ...s, baseSalida: e.target.value }))} />
              </div>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('trips.detail.notes')}</label>
                <input className={f} value={infoForm.notas} placeholder="Opcional" onChange={e => setInfoForm(s => ({ ...s, notas: e.target.value }))} />
              </div>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('trips.detail.fechaSalida')}</label>
                <DateTimePicker value={infoForm.fechaSalida} onChange={v => setInfoForm(s => ({ ...s, fechaSalida: v }))} />
              </div>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">{t('trips.detail.fechaRegreso')}</label>
                <DateTimePicker value={infoForm.fechaRegreso} onChange={v => setInfoForm(s => ({ ...s, fechaRegreso: v }))} />
              </div>
            </div>
            <button onClick={saveInfo} disabled={updateInfoMutation.isPending}
              className="bg-gold text-bg-deep font-semibold text-sm px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
              {updateInfoMutation.isPending ? t('common.saving') : t('trips.detail.saveChanges')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-sm">
            <div><p className="text-text-muted text-xs uppercase tracking-wide mb-0.5">{t('trips.detail.truck')}</p><p className="text-text-primary">{vuelta.camion?.placa} — {vuelta.camion?.modelo}</p></div>
            <div>
              <p className="text-text-muted text-xs uppercase tracking-wide mb-0.5">{t('trips.detail.mainDriver')}</p>
              <p className="text-text-primary">{vuelta.conductorPrincipal?.nombre}</p>
              {vuelta.conductorSecundario && <p className="text-text-muted text-xs">{vuelta.conductorSecundario.nombre}</p>}
            </div>
            <div><p className="text-text-muted text-xs uppercase tracking-wide mb-0.5">{t('trips.detail.baseSalida')}</p><p className="text-text-primary">{vuelta.baseSalida}</p></div>
            <div><p className="text-text-muted text-xs uppercase tracking-wide mb-0.5">{t('trips.detail.fechaSalida')}</p><p className="text-text-primary">{vuelta.fechaSalida ? new Date(vuelta.fechaSalida).toLocaleString('en-US') : '–'}</p></div>
            <div><p className="text-text-muted text-xs uppercase tracking-wide mb-0.5">{t('trips.detail.fechaRegreso')}</p><p className="text-text-primary">{vuelta.fechaRegreso ? new Date(vuelta.fechaRegreso).toLocaleString('en-US') : '–'}</p></div>
            <div><p className="text-text-muted text-xs uppercase tracking-wide mb-0.5">{t('trips.detail.notes')}</p><p className="text-text-primary">{vuelta.notas || '–'}</p></div>
          </div>
        )}
      </div>

      {/* Route */}
      <div className="bg-surface border border-border-dim rounded-xl p-5">
        <h3 className="font-serif text-lg text-text-primary mb-4">{t('trips.detail.route')}</h3>
        <TramoTimeline tramos={vuelta.tramos ?? []} baseSalida={vuelta.baseSalida} />
      </div>

      {/* Tramos */}
      <div className="bg-surface border border-border-dim rounded-xl p-5 space-y-2">
        <h3 className="font-serif text-lg text-text-primary mb-2">{t('trips.detail.legs')}</h3>

        {(vuelta.tramos ?? []).map(tramo => (
          editingTramoId === tramo.id ? (
            <div key={tramo.id} className="grid grid-cols-2 gap-2 p-3 bg-surface-2 rounded-lg border border-gold/30">
              <input className={f} placeholder={t('trips.leg.origin')} value={tramoForm.origen} onChange={e => setTramoForm(s => ({ ...s, origen: e.target.value }))} />
              <input className={f} placeholder={t('trips.leg.destination')} value={tramoForm.destino} onChange={e => setTramoForm(s => ({ ...s, destino: e.target.value }))} />
              <BrokerAutocomplete value={tramoForm.broker} onChange={broker => setTramoForm(s => ({ ...s, broker }))} placeholder={t('trips.leg.broker')} className={f} />
              <input className={f} placeholder={t('trips.leg.loadNumber')} value={tramoForm.numeroCarga} onChange={e => setTramoForm(s => ({ ...s, numeroCarga: e.target.value }))} />
              <input className={f} type="number" placeholder={t('trips.leg.freight')} value={tramoForm.fleteCobrado} onChange={e => setTramoForm(s => ({ ...s, fleteCobrado: e.target.value }))} />
              <input className={f} type="number" placeholder={unit === 'mi' ? 'Miles' : 'KM'} value={tramoForm.kmRecorridos} onChange={e => setTramoForm(s => ({ ...s, kmRecorridos: e.target.value }))} />
              <select className={f} value={tramoForm.tipo} onChange={e => setTramoForm(s => ({ ...s, tipo: e.target.value }))}>
                {TIPOS_TRAMO.map(v => <option key={v} value={v}>{t(`tramoTipo.${v}`)}</option>)}
              </select>
              <DateTimePicker value={tramoForm.fechaHora} onChange={v => setTramoForm(s => ({ ...s, fechaHora: v }))} />
              <div className="col-span-2 flex gap-2">
                <button onClick={() => saveTramo(tramo.id)} disabled={updateTramoMutation.isPending}
                  className="bg-gold text-bg-deep font-semibold text-xs px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50">
                  {updateTramoMutation.isPending ? t('common.saving') : t('common.save')}
                </button>
                <button onClick={() => setEditingTramoId(null)} className="text-text-muted text-xs px-3 py-1.5 border border-border-dim rounded-lg hover:text-text-primary">{t('common.cancel')}</button>
              </div>
            </div>
          ) : (
            <div key={tramo.id} className="flex items-center gap-3 p-3 bg-surface-2 rounded-lg border border-border-dim text-sm">
              <span className="flex-1 text-text-primary">{tramo.origen} → {tramo.destino}</span>
              <span className="text-text-muted text-xs">{tramo.tipo}{tramo.kmRecorridos ? ` · ${tramo.kmRecorridos} ${unit}` : ''}{tramo.broker ? ` · ${tramo.broker.nombre}` : ''}{tramo.numeroCarga ? ` · #${tramo.numeroCarga}` : ''}</span>
              {tramo.distanceMillas != null
                ? <span className="text-text-muted text-xs">{tramo.distanceMillas.toFixed(1)} mi</span>
                : <span className="text-amber-400 text-xs">{t('trips.enterMilesManually')}</span>
              }
              <span className="text-success font-medium">{fmt(tramo.fleteCobrado)}</span>
              <button onClick={() => startEditTramo(tramo)} className="text-text-muted hover:text-gold text-xs px-2 py-1 border border-border-dim rounded hover:border-gold/30 transition-colors">✏</button>
              <button onClick={() => confirm(t('trips.detail.confirmDeleteLeg')) && deleteTramoMutation.mutate(tramo.id)}
                className="text-text-muted hover:text-danger text-xs px-2 py-1 border border-border-dim rounded hover:border-danger/30 transition-colors">✕</button>
            </div>
          )
        ))}

        {/* Add tramo form */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-dim">
          <input className={f} placeholder={t('trips.leg.origin')} value={newTramo.origen} onChange={e => setNewTramo(s => ({ ...s, origen: e.target.value }))} />
          <input className={f} placeholder={t('trips.leg.destination')} value={newTramo.destino} onChange={e => setNewTramo(s => ({ ...s, destino: e.target.value }))} />
          <BrokerAutocomplete value={newTramo.broker} onChange={broker => setNewTramo(s => ({ ...s, broker }))} placeholder={t('trips.leg.broker')} className={f} />
          <input className={f} placeholder={t('trips.leg.loadNumber')} value={newTramo.numeroCarga} onChange={e => setNewTramo(s => ({ ...s, numeroCarga: e.target.value }))} />
          <input className={f} type="number" placeholder={t('trips.leg.freight')} value={newTramo.fleteCobrado} onChange={e => setNewTramo(s => ({ ...s, fleteCobrado: e.target.value }))} />
          <input className={f} type="number" placeholder={unit === 'mi' ? 'Miles' : 'KM'} value={newTramo.kmRecorridos} onChange={e => setNewTramo(s => ({ ...s, kmRecorridos: e.target.value }))} />
          <select className={f} value={newTramo.tipo} onChange={e => setNewTramo(s => ({ ...s, tipo: e.target.value }))}>
            {TIPOS_TRAMO.map(v => <option key={v} value={v}>{t(`tramoTipo.${v}`)}</option>)}
          </select>
          <DateTimePicker value={newTramo.fechaHora} onChange={v => setNewTramo(s => ({ ...s, fechaHora: v }))} />
          <button onClick={addTramo} disabled={createTramoMutation.isPending}
            className="col-span-2 bg-gold/20 text-gold border border-gold/30 rounded-lg text-sm hover:bg-gold/30 disabled:opacity-50 transition-colors py-1.5">
            {createTramoMutation.isPending ? t('trips.leg.adding') : t('trips.leg.addLeg')}
          </button>
        </div>
      </div>

      {/* Charts + Gastos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface border border-border-dim rounded-xl p-5">
          <h3 className="font-serif text-lg text-text-primary mb-4">{t('trips.detail.expenseDist')}</h3>
          <GastosDonut gastos={vuelta.gastos ?? []} />
        </div>

        <div className="bg-surface border border-border-dim rounded-xl p-5 space-y-2">
          <h3 className="font-serif text-lg text-text-primary mb-2">{t('trips.detail.expenses')}</h3>

          {(vuelta.gastos ?? []).map(g => (
            editingGastoId === g.id ? (
              <div key={g.id} className="grid grid-cols-2 gap-2 p-2 bg-surface-2 rounded-lg border border-gold/30">
                <select className={f} value={gastoForm.categoria} onChange={e => setGastoForm(s => ({ ...s, categoria: e.target.value }))}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input className={f} type="number" placeholder={t('trips.expense.amount')} value={gastoForm.monto} onChange={e => setGastoForm(s => ({ ...s, monto: e.target.value }))} />
                <input className={`${f} col-span-2`} placeholder={t('trips.expense.description')} value={gastoForm.descripcion} onChange={e => setGastoForm(s => ({ ...s, descripcion: e.target.value }))} />
                <div className="col-span-2 flex gap-2">
                  <button onClick={() => saveGasto(g.id)} disabled={updateGastoMutation.isPending}
                    className="bg-gold text-bg-deep font-semibold text-xs px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50">
                    {updateGastoMutation.isPending ? t('common.saving') : t('common.save')}
                  </button>
                  <button onClick={() => setEditingGastoId(null)} className="text-text-muted text-xs px-3 py-1.5 border border-border-dim rounded-lg hover:text-text-primary">{t('common.cancel')}</button>
                </div>
              </div>
            ) : (
              <div key={g.id} className="flex items-center gap-2 text-sm border-b border-border-dim pb-2">
                <span className="text-text-muted capitalize w-24 shrink-0">{g.categoria}</span>
                <span className="text-text-primary flex-1 text-xs truncate">{g.descripcion}</span>
                <span className="text-danger font-medium shrink-0">{fmt(g.monto)}</span>
                <button onClick={() => startEditGasto(g)} className="text-text-muted hover:text-gold text-xs px-1.5 py-0.5 border border-border-dim rounded hover:border-gold/30 transition-colors shrink-0">✏</button>
                <button onClick={() => confirm(t('trips.detail.confirmDeleteExpense')) && deleteGastoMutation.mutate(g.id)}
                  className="text-text-muted hover:text-danger text-xs px-1.5 py-0.5 border border-border-dim rounded hover:border-danger/30 transition-colors shrink-0">✕</button>
              </div>
            )
          ))}

          {/* Add gasto form */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-dim">
            <select className={f} value={newGasto.categoria} onChange={e => setNewGasto(s => ({ ...s, categoria: e.target.value }))}>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input className={f} type="number" placeholder={t('trips.expense.amount')} value={newGasto.monto} onChange={e => setNewGasto(s => ({ ...s, monto: e.target.value }))} />
            <input className={`${f} col-span-2`} placeholder={t('trips.expense.description')} value={newGasto.descripcion} onChange={e => setNewGasto(s => ({ ...s, descripcion: e.target.value }))} />
            <button onClick={addGasto} disabled={createGastoMutation.isPending}
              className="col-span-2 bg-gold/20 text-gold border border-gold/30 rounded-lg py-1.5 text-sm hover:bg-gold/30 disabled:opacity-50 transition-colors">
              {createGastoMutation.isPending ? t('trips.expense.adding') : t('trips.expense.addExpense')}
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}
