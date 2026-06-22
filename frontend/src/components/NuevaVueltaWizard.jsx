import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTranslation } from 'react-i18next'
import { camionesApi } from '../api/camiones.api'
import { conductoresApi } from '../api/conductores.api'
import { vueltasApi, sugerenciasApi } from '../api/vueltas.api'
import BrokerAutocomplete from './BrokerAutocomplete'
import { useDistanceUnit } from '../context/DistanceUnitContext'
import { DateTimePicker } from './DatePicker'
import { useRouteDistance } from '../hooks/useRouteDistance'

const TIPOS_TRAMO = ['carga', 'vacio', 'regreso']
const CATEGORIAS = ['combustible', 'peaje', 'viatico', 'mantenimiento', 'otro']

function SortableTramo({ tramo, index, onRemove }) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: tramo.tempId })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-3 bg-surface-2 border border-border-dim rounded-lg">
      <span {...attributes} {...listeners} className="text-text-muted cursor-grab text-lg">⠿</span>
      <div className="flex-1 grid grid-cols-2 gap-2 text-xs text-text-muted">
        <span>{tramo.origen} → {tramo.destino}</span>
        <span>$ {tramo.fleteCobrado} · {t(`tramoTipo.${tramo.tipo}`)}{tramo.broker ? ` · ${tramo.broker.nombre}` : ''}</span>
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
  const [step, setStep] = useState(1)

  const [info, setInfo] = useState({
    camionId: '', conductorPrincipalId: '', conductorSecundarioId: '',
    baseSalida: '', fechaSalida: '',
  })
  const [showConductor2, setShowConductor2] = useState(false)
  const [hints, setHints] = useState({ camion: null, conductorPrincipal: null, conductorSecundario: null })

  const [tramos, setTramos] = useState([])
  const [newTramo, setNewTramo] = useState({ origen: '', destino: '', broker: null, numeroCarga: '', fleteCobrado: 0, kmRecorridos: '', cargaTon: '', tipo: 'carga', fechaHora: '', tempId: '' })

  const { distanceMillas: calcMillas, distanceKm: calcKm, loading: calcLoading, error: calcError } =
    useRouteDistance(newTramo.origen, newTramo.destino)

  useEffect(() => {
    if (calcMillas != null) {
      setNewTramo(t => ({ ...t, kmRecorridos: calcKm?.toFixed(1) ?? t.kmRecorridos, distanceMillas: calcMillas, distanceKm: calcKm }))
    }
  }, [calcMillas, calcKm])

  const [gastos, setGastos] = useState([])
  const [newGasto, setNewGasto] = useState({ categoria: 'combustible', monto: 0, descripcion: '' })

  const { data: camiones = [] } = useQuery({ queryKey: ['camiones'], queryFn: camionesApi.list })
  const { data: conductores = [] } = useQuery({ queryKey: ['conductores'], queryFn: conductoresApi.list })

  const createMutation = useMutation({
    mutationFn: async () => {
      return vueltasApi.create({
        camionId: info.camionId,
        conductorPrincipalId: info.conductorPrincipalId,
        ...(info.conductorSecundarioId ? { conductorSecundarioId: info.conductorSecundarioId } : {}),
        baseSalida: info.baseSalida,
        fechaSalida: new Date(info.fechaSalida).toISOString(),
        tramos: tramos.map((tramo, i) => {
          const t = { ...tramo }
          const broker = t.broker
          delete t.tempId
          delete t.broker
          return {
            ...t,
            orden: i + 1,
            brokerId: broker?.id ?? null,
            numeroCarga: t.numeroCarga || null,
            fleteCobrado: Number(t.fleteCobrado),
            kmRecorridos: t.kmRecorridos ? Number(t.kmRecorridos) : null,
            cargaTon: t.cargaTon ? Number(t.cargaTon) : null,
            fechaHora: t.fechaHora ? new Date(t.fechaHora).toISOString() : null,
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

  // --- Autocomplete handlers ---
  const onConductorPrincipalChange = async (conductorId) => {
    const currentCamionId = info.camionId
    setInfo(i => ({ ...i, conductorPrincipalId: conductorId }))
    if (!conductorId) { setHints(h => ({ ...h, camion: null })); return }
    try {
      const { camion } = await sugerenciasApi.byConductor(conductorId)
      setHints(h => ({ ...h, camion: camion ?? null }))
      if (camion && !currentCamionId) setInfo(i => ({ ...i, camionId: camion.id }))
      // Suggest secondary conductor if second conductor panel is open
      if (showConductor2 && info.conductorSecundarioId === '') {
        const { conductor } = await sugerenciasApi.byConductorPrincipal(conductorId)
        setHints(h => ({ ...h, conductorSecundario: conductor ?? null }))
      }
    } catch {
      // Suggestions are optional.
    }
  }

  const onCamionChange = async (camionId) => {
    const currentConductorId = info.conductorPrincipalId
    setInfo(i => ({ ...i, camionId }))
    if (!camionId) { setHints(h => ({ ...h, conductorPrincipal: null })); return }
    try {
      const { conductor } = await sugerenciasApi.byCamion(camionId)
      setHints(h => ({ ...h, conductorPrincipal: conductor ?? null }))
      if (conductor && !currentConductorId) setInfo(i => ({ ...i, conductorPrincipalId: conductor.id }))
    } catch {
      // Suggestions are optional.
    }
  }

  const onShowConductor2 = async () => {
    setShowConductor2(true)
    if (info.conductorPrincipalId) {
      try {
        const { conductor } = await sugerenciasApi.byConductorPrincipal(info.conductorPrincipalId)
        setHints(h => ({ ...h, conductorSecundario: conductor ?? null }))
        if (conductor) setInfo(i => ({ ...i, conductorSecundarioId: conductor.id }))
      } catch {
        // Suggestions are optional.
      }
    }
  }

  // --- Trip / expense handlers ---
  const addTramo = () => {
    if (!newTramo.origen || !newTramo.destino) return
    setTramos(t => [...t, { ...newTramo, tempId: crypto.randomUUID() }])
    setNewTramo({ origen: '', destino: '', broker: null, numeroCarga: '', fleteCobrado: 0, kmRecorridos: '', cargaTon: '', tipo: 'carga', fechaHora: '', tempId: '' })
  }

  const addGasto = () => {
    if (!newGasto.monto) return
    setGastos(g => [...g, { ...newGasto }])
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

  const ingresoTotal = tramos.reduce((s, t) => s + Number(t.fleteCobrado), 0)
  const gastoTotal = gastos.reduce((s, g) => s + Number(g.monto), 0)

  const inputCls = 'w-full bg-surface-2 border border-border-dim rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-gold'

  const conductorPrincipalNombre = conductores.find(c => c.id === info.conductorPrincipalId)?.nombre
  const camionNombre = camiones.find(c => c.id === info.camionId)?.placa

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
          <div className="grid grid-cols-2 gap-4">
            {/* Conductor Principal */}
            <div>
              <label className="block text-text-muted text-xs uppercase tracking-wide mb-1.5">{t('trips.detail.mainDriver')}</label>
              <select
                value={info.conductorPrincipalId}
                onChange={e => onConductorPrincipalChange(e.target.value)}
                className={inputCls}
              >
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
              <select
                value={info.camionId}
                onChange={e => onCamionChange(e.target.value)}
                className={inputCls}
              >
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
                <button
                  type="button"
                  onClick={onShowConductor2}
                  className="text-text-muted text-xs hover:text-gold transition-colors"
                >
                  {t('trips.detail.addSecondDriver')}
                </button>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-text-muted text-xs uppercase tracking-wide">{t('trips.detail.secondDriver')}</label>
                    <button
                      type="button"
                      onClick={() => { setShowConductor2(false); setInfo(i => ({ ...i, conductorSecundarioId: '' })); setHints(h => ({ ...h, conductorSecundario: null })) }}
                      className="text-text-muted text-xs hover:text-danger"
                    >
                      {t('trips.detail.removeDriver')}
                    </button>
                  </div>
                  <select
                    value={info.conductorSecundarioId}
                    onChange={e => setInfo(i => ({ ...i, conductorSecundarioId: e.target.value }))}
                    className={inputCls}
                  >
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
            <SortableContext items={tramos.map(t => t.tempId)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {tramos.map((t, i) => (
                  <SortableTramo key={t.tempId} tramo={t} index={i} onRemove={(idx) => setTramos(arr => arr.filter((_, j) => j !== idx))} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <div className="grid grid-cols-2 gap-3 p-4 bg-surface-2 rounded-lg border border-border-dim">
            <input value={newTramo.origen} onChange={e => setNewTramo(t => ({ ...t, origen: e.target.value }))} className={inputCls} placeholder={t('trips.leg.origin')} />
            <input value={newTramo.destino} onChange={e => setNewTramo(t => ({ ...t, destino: e.target.value }))} className={inputCls} placeholder={t('trips.leg.destination')} />
            <BrokerAutocomplete
              value={newTramo.broker}
              onChange={broker => setNewTramo(t => ({ ...t, broker }))}
              placeholder={t('trips.leg.broker')}
              className={inputCls}
            />
            <input value={newTramo.numeroCarga} onChange={e => setNewTramo(t => ({ ...t, numeroCarga: e.target.value }))} className={inputCls} placeholder={t('trips.leg.loadNumber')} />
            <input type="number" value={newTramo.fleteCobrado} onChange={e => setNewTramo(t => ({ ...t, fleteCobrado: e.target.value }))} className={inputCls} placeholder={t('trips.leg.freight')} />
            <div>
              <div className="relative">
                <input
                  type="number"
                  value={newTramo.kmRecorridos}
                  onChange={e => setNewTramo(t => ({ ...t, kmRecorridos: e.target.value }))}
                  className={inputCls + (calcLoading ? ' opacity-50' : '')}
                  placeholder={unit === 'mi' ? 'Miles' : 'KM'}
                />
                {calcLoading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs animate-pulse">…</span>
                )}
              </div>
              {calcMillas != null && !calcLoading && (
                <p className="text-green-400 text-xs mt-1">✓ calculado automáticamente — {calcMillas.toFixed(1)} mi</p>
              )}
              {calcError && !calcLoading && (
                <p className="text-amber-400 text-xs mt-1">{t('trips.enterMilesManually')}</p>
              )}
            </div>
            <select value={newTramo.tipo} onChange={e => setNewTramo(t => ({ ...t, tipo: e.target.value }))} className={inputCls}>
              {TIPOS_TRAMO.map(tipo => <option key={tipo} value={tipo}>{t(`tramoTipo.${tipo}`)}</option>)}
            </select>
            <DateTimePicker value={newTramo.fechaHora} onChange={v => setNewTramo(t => ({ ...t, fechaHora: v }))} />
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
              {tramos.length === 0 && (
                <p className="text-danger text-xs">{t('trips.wizard.atLeastOneLeg')}</p>
              )}
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
