import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTranslation } from 'react-i18next'
import { camionesApi } from '../api/camiones.api'
import { conductoresApi } from '../api/conductores.api'
import { vueltasApi, sugerenciasApi } from '../api/vueltas.api'
import { brokersApi } from '../api/brokers.api'
import { rateconApi } from '../api/ratecon.api'
import BrokerAutocomplete from './BrokerAutocomplete'
import { useDistanceUnit } from '../context/DistanceUnitContext'
import { DateTimePicker } from './DatePicker'
import { useRouteDistance } from '../hooks/useRouteDistance'

const TIPOS_TRAMO = ['carga', 'vacio', 'regreso']
const RATECON_TRAMO_ID = 'ratecon-leg-1'
const CATEGORIAS = ['combustible', 'peaje', 'viatico', 'mantenimiento', 'otro']

const RATECON_FIELD_LABELS = {
  origin: 'Origen',
  destination: 'Destino',
  loadNumber: 'Número de carga',
  freightAmount: 'Flete',
  originDate: 'Fecha de recogida',
  destinationDate: 'Fecha de entrega',
  commodity: 'Tipo de carga',
  equipment: 'Equipo',
  brokerName: 'Broker',
}

function daysAgo(isoDate) {
  if (!isoDate) return null
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000)
}

function SortableTramo({ tramo, index, onRemove }) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: tramo.tempId })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const meta = [tramo.tipoCarga, tramo.tipoEquipo].filter(Boolean).join(' · ')
  const brokerLabel = tramo.broker?.nombre ?? (tramo.brokerHint ? `${tramo.brokerHint} *` : null)
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-3 bg-surface-2 border border-border-dim rounded-lg">
      <span {...attributes} {...listeners} className="text-text-muted cursor-grab text-lg">⠿</span>
      <div className="flex-1 grid grid-cols-2 gap-1 text-xs text-text-muted">
        <span>{tramo.origen} → {tramo.destino}</span>
        <span>$ {tramo.fleteCobrado} · {t(`tramoTipo.${tramo.tipo}`)}{brokerLabel ? ` · ${brokerLabel}` : ''}</span>
        {meta && <span className="col-span-2 text-text-muted/70">{meta}</span>}
      </div>
      <button onClick={() => onRemove(index)} className="text-danger text-xs hover:opacity-80">✕</button>
    </div>
  )
}

export default function NuevaVueltaWizard() {
  const { t } = useTranslation()
  const { unit } = useDistanceUnit()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const fileInputRef = useRef(null)
  const pendingFileRef = useRef(null) // keeps File object alive for retry
  const [step, setStep] = useState(1)

  const [info, setInfo] = useState({
    camionId: '', conductorPrincipalId: '', conductorSecundarioId: '',
    baseSalida: '', fechaSalida: '',
  })
  const [showConductor2, setShowConductor2] = useState(false)
  const [hints, setHints] = useState({ camion: null, conductorPrincipal: null, conductorSecundario: null })

  // Rate confirmation state
  const [rateConFile, setRateConFile] = useState(null)
  const [rateConData, setRateConData] = useState(null)
  const [rateConLoading, setRateConLoading] = useState(false)
  const [rateConError, setRateConError] = useState(null)
  const [rateConBanner, setRateConBanner] = useState(null)
  const [rateConDragging, setRateConDragging] = useState(false)
  const [rateConBrokerName, setRateConBrokerName] = useState(null) // raw name when not DB-matched

  // Last-location state
  const [truckLastLoc, setTruckLastLoc] = useState(null) // { location, date }
  const [driverLastLoc, setDriverLastLoc] = useState(null)

  const [tramos, setTramos] = useState([])
  const [newTramo, setNewTramo] = useState({
    origen: '', destino: '', broker: null, numeroCarga: '',
    fleteCobrado: 0, kmRecorridos: '', cargaTon: '', tipo: 'carga',
    fechaHora: '', tipoCarga: '', tipoEquipo: '', fechaEntrega: '', tempId: '',
  })

  const { distanceMillas: calcMillas, distanceKm: calcKm, loading: calcLoading, error: calcError } =
    useRouteDistance(newTramo.origen, newTramo.destino)

  useEffect(() => {
    if (calcMillas != null) {
      const dist = unit === 'mi' ? calcMillas : calcKm
      setNewTramo(prev => ({ ...prev, kmRecorridos: dist?.toFixed(1) ?? prev.kmRecorridos, distanceMillas: calcMillas, distanceKm: calcKm }))
    }
  }, [calcMillas, calcKm, unit])

  // Auto-add leg 1 as a card whenever rate con data arrives
  useEffect(() => {
    if (!rateConData) return
    setTramos(prev => {
      const withoutRateCon = prev.filter(t => t.tempId !== RATECON_TRAMO_ID)
      return [{
        origen: rateConData.origin ?? '',
        destino: rateConData.destination ?? '',
        broker: null,
        brokerHint: rateConData.brokerName ?? null,
        numeroCarga: rateConData.loadNumber ? String(rateConData.loadNumber) : '',
        fleteCobrado: rateConData.freightAmount ?? 0,
        kmRecorridos: '',
        cargaTon: '',
        tipo: 'carga',
        fechaHora: rateConData.originDate ?? '',
        tipoCarga: rateConData.commodity ?? '',
        tipoEquipo: rateConData.equipment ?? '',
        fechaEntrega: rateConData.destinationDate ?? '',
        tempId: RATECON_TRAMO_ID,
      }, ...withoutRateCon]
    })
  }, [rateConData])

  // Pre-fill the leg form when the user enters Step 2 with rate con data
  useEffect(() => {
    if (step !== 2 || !rateConData) return
    console.log('rateConData in Step 2:', rateConData)
    console.log('setting newTramo from rateConData')
    setNewTramo(prev => ({
      ...prev,
      origen: rateConData.origin ?? prev.origen,
      destino: rateConData.destination ?? prev.destino,
      numeroCarga: rateConData.loadNumber ? String(rateConData.loadNumber) : prev.numeroCarga,
      fleteCobrado: rateConData.freightAmount ?? prev.fleteCobrado,
      fechaHora: rateConData.originDate ?? prev.fechaHora,
      fechaEntrega: rateConData.destinationDate ?? prev.fechaEntrega,
      tipoCarga: rateConData.commodity ?? prev.tipoCarga,
      tipoEquipo: rateConData.equipment ?? prev.tipoEquipo,
    }))
  }, [step, rateConData])

  // Resolve broker — patch the auto-added card and pre-fill the form
  useEffect(() => {
    if (!rateConData?.brokerName) return
    let cancelled = false
    brokersApi.search(rateConData.brokerName).then(results => {
      if (cancelled) return
      if (results.length > 0) {
        const broker = results[0]
        setTramos(prev => prev.map(t =>
          t.tempId === RATECON_TRAMO_ID ? { ...t, broker, brokerHint: null } : t
        ))
        setNewTramo(prev => ({ ...prev, broker }))
        setRateConBrokerName(null)
      } else {
        setRateConBrokerName(rateConData.brokerName)
      }
    }).catch(() => {
      if (!cancelled) setRateConBrokerName(rateConData.brokerName)
    })
    return () => { cancelled = true }
  }, [rateConData])

  const [gastos, setGastos] = useState([])
  const [newGasto, setNewGasto] = useState({ categoria: 'combustible', monto: 0, descripcion: '' })

  const { data: camiones = [] } = useQuery({ queryKey: ['camiones'], queryFn: camionesApi.list })
  const { data: conductores = [] } = useQuery({ queryKey: ['conductores'], queryFn: conductoresApi.list })

  // Rate confirmation upload handler
  const handleRateConUpload = async (file) => {
    if (!file) return
    pendingFileRef.current = file
    setRateConFile({ name: file.name, size: file.size })
    setRateConLoading(true)
    setRateConError(null)
    setRateConBanner(null)
    setRateConBrokerName(null)
    try {
      const data = await rateconApi.extract(file)
      // Setting rateConData triggers useEffects that populate newTramo and resolve broker
      setRateConData(data)
      // Compute banner from raw extraction (broker marked filled if Gemini found a name)
      const fields = Object.entries(RATECON_FIELD_LABELS).map(([key, label]) => {
        const val = data[key]
        return { label, filled: val != null && val !== '' }
      })
      setRateConBanner({
        filled: fields.filter(f => f.filled).map(f => f.label),
        missing: fields.filter(f => !f.filled).map(f => f.label),
      })
    } catch (err) {
      setRateConError({
        message: err?.response?.data?.error ?? err.message ?? 'Error al procesar el archivo',
        busy: err?.response?.status === 503,
      })
    } finally {
      setRateConLoading(false)
    }
  }

  const handleRetry = () => {
    if (pendingFileRef.current) handleRateConUpload(pendingFileRef.current)
  }

  const handleFilePick = (e) => {
    const file = e.target.files?.[0]
    if (file) handleRateConUpload(file)
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setRateConDragging(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) handleRateConUpload(file)
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      return vueltasApi.create({
        camionId: info.camionId,
        conductorPrincipalId: info.conductorPrincipalId,
        ...(info.conductorSecundarioId ? { conductorSecundarioId: info.conductorSecundarioId } : {}),
        baseSalida: info.baseSalida,
        fechaSalida: new Date(info.fechaSalida).toISOString(),
        tramos: tramos.map((tramo, i) => {
          const tr = { ...tramo }
          const broker = tr.broker
          delete tr.tempId
          delete tr.broker
          delete tr.brokerHint
          return {
            ...tr,
            orden: i + 1,
            brokerId: broker?.id ?? null,
            numeroCarga: tr.numeroCarga || null,
            fleteCobrado: Number(tr.fleteCobrado),
            kmRecorridos: tr.kmRecorridos ? Number(tr.kmRecorridos) : null,
            cargaTon: tr.cargaTon ? Number(tr.cargaTon) : null,
            fechaHora: tr.fechaHora ? new Date(tr.fechaHora).toISOString() : null,
            fechaEntrega: tr.fechaEntrega ? new Date(tr.fechaEntrega).toISOString() : null,
            tipoCarga: tr.tipoCarga || null,
            tipoEquipo: tr.tipoEquipo || null,
          }
        }),
        gastos: gastos.map(gasto => ({ ...gasto, monto: Number(gasto.monto) })),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vueltas'] })
      navigate('/vueltas')
    },
  })

  const onConductorPrincipalChange = async (conductorId) => {
    const currentCamionId = info.camionId
    setInfo(i => ({ ...i, conductorPrincipalId: conductorId }))
    if (!conductorId) {
      setHints(h => ({ ...h, camion: null }))
      setDriverLastLoc(null)
      return
    }
    try {
      const { camion } = await sugerenciasApi.byConductor(conductorId)
      setHints(h => ({ ...h, camion: camion ?? null }))
      if (camion && !currentCamionId) setInfo(i => ({ ...i, camionId: camion.id }))
      if (showConductor2 && info.conductorSecundarioId === '') {
        const { conductor } = await sugerenciasApi.byConductorPrincipal(conductorId)
        setHints(h => ({ ...h, conductorSecundario: conductor ?? null }))
      }
    } catch { /* suggestions are optional */ }
    // Last location — only fills origin if no truck location and rate con didn't set it
    try {
      const { lastLocation, lastTripDate } = await conductoresApi.lastLocation(conductorId)
      if (lastLocation) {
        setDriverLastLoc({ location: lastLocation, date: lastTripDate })
        setNewTramo(prev => {
          if (!prev.origen && !truckLastLoc?.location) {
            return { ...prev, origen: lastLocation }
          }
          return prev
        })
      } else {
        setDriverLastLoc(null)
      }
    } catch { /* last location is optional */ }
  }

  const onCamionChange = async (camionId) => {
    const currentConductorId = info.conductorPrincipalId
    setInfo(i => ({ ...i, camionId }))
    if (!camionId) {
      setHints(h => ({ ...h, conductorPrincipal: null }))
      setTruckLastLoc(null)
      // Restore driver location if available and rate con didn't set origin
      setNewTramo(prev => {
        if (!rateConData?.origin) {
          return { ...prev, origen: driverLastLoc?.location ?? '' }
        }
        return prev
      })
      return
    }
    try {
      const { conductor } = await sugerenciasApi.byCamion(camionId)
      setHints(h => ({ ...h, conductorPrincipal: conductor ?? null }))
      if (conductor && !currentConductorId) setInfo(i => ({ ...i, conductorPrincipalId: conductor.id }))
    } catch { /* suggestions are optional */ }
    // Last location — truck always wins over driver
    try {
      const { lastLocation, lastTripDate } = await camionesApi.lastLocation(camionId)
      if (lastLocation) {
        setTruckLastLoc({ location: lastLocation, date: lastTripDate })
        if (!rateConData?.origin) {
          setNewTramo(prev => ({ ...prev, origen: lastLocation }))
        }
      } else {
        setTruckLastLoc(null)
      }
    } catch { /* last location is optional */ }
  }

  const onShowConductor2 = async () => {
    setShowConductor2(true)
    if (info.conductorPrincipalId) {
      try {
        const { conductor } = await sugerenciasApi.byConductorPrincipal(info.conductorPrincipalId)
        setHints(h => ({ ...h, conductorSecundario: conductor ?? null }))
        if (conductor) setInfo(i => ({ ...i, conductorSecundarioId: conductor.id }))
      } catch { /* suggestions are optional */ }
    }
  }

  const addTramo = () => {
    if (!newTramo.origen || !newTramo.destino) return
    setTramos(prev => [...prev, { ...newTramo, tempId: crypto.randomUUID() }])
    setNewTramo({
      origen: '', destino: '', broker: null, numeroCarga: '',
      fleteCobrado: 0, kmRecorridos: '', cargaTon: '', tipo: 'carga',
      fechaHora: '', tipoCarga: '', tipoEquipo: '', fechaEntrega: '', tempId: '',
    })
    setRateConBrokerName(null)
  }

  const addGasto = () => {
    if (!newGasto.monto) return
    setGastos(prev => [...prev, { ...newGasto }])
    setNewGasto({ categoria: 'combustible', monto: 0, descripcion: '' })
  }

  const handleDragEnd = ({ active, over }) => {
    if (active.id !== over?.id) {
      setTramos(items => {
        const oldIndex = items.findIndex(i => i.tempId === active.id)
        const newIndex = items.findIndex(i => i.tempId === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const ingresoTotal = tramos.reduce((s, tr) => s + Number(tr.fleteCobrado), 0)
  const gastoTotal = gastos.reduce((s, g) => s + Number(g.monto), 0)

  const inputCls = 'w-full bg-surface-2 border border-border-dim rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-gold'

  const conductorPrincipalNombre = conductores.find(c => c.id === info.conductorPrincipalId)?.nombre
  const camionNombre = camiones.find(c => c.id === info.camionId)?.placa

  // Effective last-location for Step 2 hint: truck > driver
  const effectiveLastLoc = truckLastLoc ?? driverLastLoc
  const effectiveLastLocLabel = effectiveLastLoc
    ? `📍 Última ubicación (${truckLastLoc ? 'camión' : 'conductor'}${(() => { const d = daysAgo(effectiveLastLoc.date); return d != null ? `, hace ${d} día${d !== 1 ? 's' : ''}` : '' })()})`
    : null

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="font-serif text-2xl text-text-primary">{t('trips.wizard.title')}</h2>
        <div className="flex gap-2 ml-auto">
          {[1, 2, 3].map(s => (
            <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === s ? 'bg-gold text-bg-deep' : step > s ? 'bg-gold/30 text-gold' : 'bg-surface-2 text-text-muted'}`}>{s}</div>
          ))}
        </div>
      </div>

      {step === 1 && (
        <div className="bg-surface border border-border-dim rounded-xl p-6 space-y-4">
          <h3 className="font-serif text-lg text-text-primary">{t('trips.wizard.step1Title')}</h3>

          {/* Rate Confirmation Upload */}
          <div>
            <p className="text-text-muted text-xs uppercase tracking-wide mb-2">📄 Rate Confirmation (opcional)</p>
            <div
              onDragOver={e => { e.preventDefault(); setRateConDragging(true) }}
              onDragLeave={() => setRateConDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${rateConDragging ? 'border-gold bg-gold/5' : 'border-border-dim hover:border-gold/50'}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,image/jpeg,image/png,image/webp"
                onChange={handleFilePick}
              />
              {rateConLoading ? (
                <p className="text-text-muted text-sm animate-pulse">Leyendo rate confirmation...</p>
              ) : rateConFile ? (
                <p className="text-text-muted text-sm">📎 {rateConFile.name}</p>
              ) : (
                <p className="text-text-muted text-sm">Arrastra aquí o haz clic · PDF, JPG, PNG — máx 10 MB</p>
              )}
            </div>

            {rateConError && rateConError.busy && (
              <div className="mt-2 rounded-lg px-3 py-2 bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-3">
                <p className="text-amber-400 text-xs">⚠ {rateConError.message}</p>
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={rateConLoading}
                  className="text-amber-400 text-xs border border-amber-400/40 rounded px-2 py-0.5 hover:bg-amber-400/10 transition-colors shrink-0 disabled:opacity-50"
                >
                  🔄 Reintentar
                </button>
              </div>
            )}
            {rateConError && !rateConError.busy && (
              <p className="text-danger text-xs mt-2">⚠ {rateConError.message}</p>
            )}

            {rateConBanner && rateConBanner.filled.length > 0 && (
              <div className="mt-2 rounded-lg px-3 py-2 bg-success/10 border border-success/20">
                <p className="text-success text-xs">✓ {rateConBanner.filled.length} campos extraídos: {rateConBanner.filled.join(', ')}</p>
              </div>
            )}

            {rateConBanner && rateConBanner.missing.length > 0 && (
              <div className="mt-1 rounded-lg px-3 py-2 bg-amber-500/10 border border-amber-500/20">
                <p className="text-amber-400 text-xs">No encontramos: {rateConBanner.missing.join(', ')} — verifica manualmente</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Conductor Principal */}
            <div>
              <label className="block text-text-muted text-xs uppercase tracking-wide mb-1.5">{t('trips.detail.mainDriver')}</label>
              <select value={info.conductorPrincipalId} onChange={e => onConductorPrincipalChange(e.target.value)} className={inputCls}>
                <option value="">Seleccionar...</option>
                {conductores.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              {hints.conductorPrincipal && info.conductorPrincipalId === hints.conductorPrincipal.id && (
                <p className="text-gold/70 text-xs mt-1">{t('trips.hints.usualDriver')} {camionNombre}</p>
              )}
            </div>

            {/* Camión */}
            <div>
              <label className="block text-text-muted text-xs uppercase tracking-wide mb-1.5">{t('trips.detail.truck')}</label>
              <select value={info.camionId} onChange={e => onCamionChange(e.target.value)} className={inputCls}>
                <option value="">Seleccionar...</option>
                {camiones.map(c => <option key={c.id} value={c.id}>{c.placa} — {c.modelo}</option>)}
              </select>
              {hints.camion && info.camionId === hints.camion.id && (
                <p className="text-gold/70 text-xs mt-1">{t('trips.hints.usualTruck')} {conductorPrincipalNombre}</p>
              )}
            </div>

            {/* Conductor Secundario */}
            <div className="col-span-2">
              {!showConductor2 ? (
                <button type="button" onClick={onShowConductor2} className="text-text-muted text-xs hover:text-gold transition-colors">
                  {t('trips.detail.addSecondDriver')}
                </button>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-text-muted text-xs uppercase tracking-wide">{t('trips.detail.secondDriver')}</label>
                    <button type="button" onClick={() => { setShowConductor2(false); setInfo(i => ({ ...i, conductorSecundarioId: '' })); setHints(h => ({ ...h, conductorSecundario: null })) }} className="text-text-muted text-xs hover:text-danger">
                      {t('trips.detail.removeDriver')}
                    </button>
                  </div>
                  <select value={info.conductorSecundarioId} onChange={e => setInfo(i => ({ ...i, conductorSecundarioId: e.target.value }))} className={inputCls}>
                    <option value="">Ninguno</option>
                    {conductores.filter(c => c.id !== info.conductorPrincipalId).map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                  {hints.conductorSecundario && info.conductorSecundarioId === hints.conductorSecundario.id && (
                    <p className="text-gold/70 text-xs mt-1">{t('trips.hints.usualSecondary')} {conductorPrincipalNombre}</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-text-muted text-xs uppercase tracking-wide mb-1.5">{t('trips.detail.baseSalida')}</label>
              <input value={info.baseSalida} onChange={e => setInfo(i => ({ ...i, baseSalida: e.target.value }))} className={inputCls} placeholder="Miami, FL" />
            </div>
            <div>
              <label className="block text-text-muted text-xs uppercase tracking-wide mb-1.5">{t('trips.detail.fechaSalida')}</label>
              <DateTimePicker value={info.fechaSalida} onChange={v => setInfo(i => ({ ...i, fechaSalida: v }))} />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              disabled={!info.camionId || !info.conductorPrincipalId || !info.baseSalida || !info.fechaSalida}
              onClick={() => setStep(2)}
              className="bg-gold text-bg-deep font-semibold px-5 py-2 rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-50"
            >
              {t('common.next')}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-surface border border-border-dim rounded-xl p-6 space-y-4">
          <h3 className="font-serif text-lg text-text-primary">{t('trips.wizard.step2Title')}</h3>
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={tramos.map(tr => tr.tempId)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {tramos.map((tr, i) => (
                  <SortableTramo key={tr.tempId} tramo={tr} index={i} onRemove={(idx) => setTramos(arr => arr.filter((_, j) => j !== idx))} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <div className="grid grid-cols-2 gap-3 p-4 bg-surface-2 rounded-lg border border-border-dim">
            <div>
              <input value={newTramo.origen} onChange={e => setNewTramo(prev => ({ ...prev, origen: e.target.value }))} className={inputCls} placeholder={t('trips.leg.origin')} />
              {effectiveLastLocLabel && newTramo.origen === effectiveLastLoc?.location && (
                <p className="text-gold/70 text-xs mt-1">{effectiveLastLocLabel}</p>
              )}
            </div>
            <input value={newTramo.destino} onChange={e => setNewTramo(prev => ({ ...prev, destino: e.target.value }))} className={inputCls} placeholder={t('trips.leg.destination')} />
            <BrokerAutocomplete value={newTramo.broker} onChange={broker => setNewTramo(prev => ({ ...prev, broker }))} placeholder={t('trips.leg.broker')} className={inputCls} initialQuery={newTramo.broker ? null : rateConBrokerName} />
            <input value={newTramo.numeroCarga} onChange={e => setNewTramo(prev => ({ ...prev, numeroCarga: e.target.value }))} className={inputCls} placeholder={t('trips.leg.loadNumber')} />
            <input type="number" value={newTramo.fleteCobrado} onChange={e => setNewTramo(prev => ({ ...prev, fleteCobrado: e.target.value }))} className={inputCls} placeholder={t('trips.leg.freight')} />
            <div>
              <div className="relative">
                <input type="number" value={newTramo.kmRecorridos} onChange={e => setNewTramo(prev => ({ ...prev, kmRecorridos: e.target.value }))} className={inputCls + (calcLoading ? ' opacity-50' : '')} placeholder={unit === 'mi' ? 'Miles' : 'KM'} />
                {calcLoading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs animate-pulse">…</span>}
              </div>
              {calcMillas != null && !calcLoading && <p className="text-green-400 text-xs mt-1">✓ calculado automáticamente — {calcMillas.toFixed(1)} mi</p>}
              {calcError && !calcLoading && <p className="text-amber-400 text-xs mt-1">{t('trips.enterMilesManually')}</p>}
            </div>
            <select value={newTramo.tipo} onChange={e => setNewTramo(prev => ({ ...prev, tipo: e.target.value }))} className={inputCls}>
              {TIPOS_TRAMO.map(tipo => <option key={tipo} value={tipo}>{t(`tramoTipo.${tipo}`)}</option>)}
            </select>
            <DateTimePicker value={newTramo.fechaHora} onChange={v => setNewTramo(prev => ({ ...prev, fechaHora: v }))} />
            <input value={newTramo.tipoCarga} onChange={e => setNewTramo(prev => ({ ...prev, tipoCarga: e.target.value }))} className={inputCls} placeholder="Commodity (ej. Produce)" />
            <input value={newTramo.tipoEquipo} onChange={e => setNewTramo(prev => ({ ...prev, tipoEquipo: e.target.value }))} className={inputCls} placeholder="Equipo (ej. Reefer 53')" />
            <DateTimePicker value={newTramo.fechaEntrega} onChange={v => setNewTramo(prev => ({ ...prev, fechaEntrega: v }))} />
            <button onClick={addTramo} className="col-span-2 bg-gold/20 text-gold border border-gold/30 rounded-lg text-sm hover:bg-gold/30 transition-colors py-2">{t('trips.leg.addLeg')}</button>
          </div>
          <p className="text-text-muted text-xs">{t('trips.wizard.calculatedIncome')} <span className="text-success">${ingresoTotal.toLocaleString('en-US')}</span></p>
          <div className="flex justify-between items-start">
            <button onClick={() => setStep(1)} className="text-text-muted text-sm hover:text-text-primary">{t('common.back')}</button>
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={() => setStep(3)}
                disabled={tramos.length === 0}
                className="bg-gold text-bg-deep font-semibold px-5 py-2 rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.next')}
              </button>
              {tramos.length === 0 && <p className="text-danger text-xs">{t('trips.wizard.atLeastOneLeg')}</p>}
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bg-surface border border-border-dim rounded-xl p-6 space-y-4">
          <h3 className="font-serif text-lg text-text-primary">{t('trips.wizard.step3Title')}</h3>
          <div className="space-y-2">
            {gastos.map((g, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-surface-2 border border-border-dim rounded-lg text-sm">
                <span className="text-text-muted capitalize">{g.categoria}</span>
                <span className="text-text-primary">{g.descripcion}</span>
                <span className="text-danger">${Number(g.monto).toLocaleString('en-US')}</span>
                <button onClick={() => setGastos(arr => arr.filter((_, j) => j !== i))} className="text-danger text-xs">✕</button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 p-4 bg-surface-2 rounded-lg border border-border-dim">
            <select value={newGasto.categoria} onChange={e => setNewGasto(g => ({ ...g, categoria: e.target.value }))} className={inputCls}>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="number" value={newGasto.monto} onChange={e => setNewGasto(g => ({ ...g, monto: e.target.value }))} className={inputCls} placeholder={t('trips.expense.amount')} />
            <input value={newGasto.descripcion} onChange={e => setNewGasto(g => ({ ...g, descripcion: e.target.value }))} className={inputCls} placeholder={t('trips.expense.description')} />
            <button onClick={addGasto} className="col-span-3 bg-gold/20 text-gold border border-gold-dim rounded-lg py-2 text-sm hover:bg-gold/30 transition-colors">{t('trips.expense.addExpense')}</button>
          </div>
          <div className="bg-surface-2 rounded-lg p-4 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-text-muted">{t('trips.detail.ingresos')}</span><span className="text-success">${ingresoTotal.toLocaleString('en-US')}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">{t('trips.detail.gastos')}</span><span className="text-danger">${gastoTotal.toLocaleString('en-US')}</span></div>
            <div className="flex justify-between font-semibold border-t border-border-dim pt-1 mt-1">
              <span className="text-text-primary">{t('trips.detail.profitability')}</span>
              <span className={ingresoTotal - gastoTotal >= 0 ? 'text-success' : 'text-danger'}>$ {(ingresoTotal - gastoTotal).toLocaleString('en-US')}</span>
            </div>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="text-text-muted text-sm hover:text-text-primary">{t('common.back')}</button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="bg-gold text-bg-deep font-semibold px-5 py-2 rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? t('trips.wizard.creating') : t('trips.wizard.create')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
