import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTranslation } from 'react-i18next'
import { vueltasApi } from '../api/vueltas.api'
import { camionesApi } from '../api/camiones.api'
import { conductoresApi } from '../api/conductores.api'
import { brokersApi } from '../api/brokers.api'
import { VueltaTable } from '../components/VueltaTable'
import { DatePicker, DateTimePicker } from '../components/DatePicker'
import { useRole } from '../hooks/useRole'

const ESTADOS = ['planificada', 'en_curso', 'completada', 'facturada']
const fmt = (n) => `$ ${Number(n ?? 0).toLocaleString('en-US')}`
const inputCls = 'w-full bg-surface-2 border border-border-dim rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-gold'

function SortableMergeItem({ vuelta, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: vuelta.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-3 bg-surface border border-border-dim rounded-lg">
      <span {...attributes} {...listeners} className="text-text-muted cursor-grab text-lg select-none">⠿</span>
      <div className="flex-1">
        <p className="text-gold text-sm font-medium">{vuelta.codigo}</p>
        <p className="text-text-muted text-xs">{vuelta.baseSalida} · {vuelta.camion?.placa}</p>
      </div>
      <div className="text-right text-xs mr-1">
        <p className="text-success">{fmt(vuelta.ingresoTotal)}</p>
        <p className="text-danger">{fmt(vuelta.gastoTotal)}</p>
      </div>
      <button onClick={() => onRemove(vuelta.id)} className="text-danger text-xs hover:opacity-80">✕</button>
    </div>
  )
}

export default function Vueltas() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { isViewer } = useRole()
  const [filters, setFilters] = useState({ estado: '', camionId: '', brokerId: '', fechaDesde: '', fechaHasta: '' })
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [showMerge, setShowMerge] = useState(false)
  const [mergeOrder, setMergeOrder] = useState([])
  const [mergeForm, setMergeForm] = useState({ camionId: '', conductorPrincipalId: '', baseSalida: '', fechaSalida: '' })

  const { data: vueltas = [], isLoading } = useQuery({
    queryKey: ['vueltas', filters],
    queryFn: () => vueltasApi.list(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))),
  })
  const { data: camiones = [] } = useQuery({ queryKey: ['camiones'], queryFn: camionesApi.list })
  const { data: conductores = [] } = useQuery({ queryKey: ['conductores'], queryFn: conductoresApi.list })
  const { data: brokers = [] } = useQuery({ queryKey: ['brokers'], queryFn: brokersApi.list })

  const mergeMutation = useMutation({
    mutationFn: () => vueltasApi.merge({
      vueltaIds: mergeOrder.map(v => v.id),
      camionId: mergeForm.camionId,
      conductorPrincipalId: mergeForm.conductorPrincipalId,
      baseSalida: mergeForm.baseSalida,
      fechaSalida: new Date(mergeForm.fechaSalida).toISOString(),
    }),
    onSuccess: (newVuelta) => {
      qc.invalidateQueries({ queryKey: ['vueltas'] })
      closeMergeModal()
      navigate(`/vueltas/${newVuelta.id}`)
    },
  })

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const openMergeModal = () => {
    const ordered = selectedIds.map(id => vueltas.find(v => v.id === id)).filter(Boolean)
    setMergeOrder(ordered)
    const first = ordered[0]
    setMergeForm({
      camionId: first?.camionId ?? '',
      conductorPrincipalId: first?.conductorPrincipalId ?? '',
      baseSalida: first?.baseSalida ?? '',
      fechaSalida: first?.fechaSalida ? new Date(first.fechaSalida).toISOString().slice(0, 16) : '',
    })
    setShowMerge(true)
  }

  const closeMergeModal = () => {
    setShowMerge(false)
    setSelectMode(false)
    setSelectedIds([])
    setMergeOrder([])
    setMergeForm({ camionId: '', conductorPrincipalId: '', baseSalida: '', fechaSalida: '' })
  }

  const handleDragEnd = ({ active, over }) => {
    if (active.id !== over?.id) {
      setMergeOrder(items => {
        const oldIndex = items.findIndex(i => i.id === active.id)
        const newIndex = items.findIndex(i => i.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const removeFromMerge = (id) => {
    const next = mergeOrder.filter(v => v.id !== id)
    setMergeOrder(next)
    setSelectedIds(prev => prev.filter(x => x !== id))
    if (next.length < 2) closeMergeModal()
  }

  const mergeIngreso = mergeOrder.reduce((s, v) => s + (v.ingresoTotal ?? 0), 0)
  const mergeGasto = mergeOrder.reduce((s, v) => s + (v.gastoTotal ?? 0), 0)
  const canMerge = mergeForm.camionId && mergeForm.conductorPrincipalId && mergeForm.baseSalida && mergeForm.fechaSalida

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl text-text-primary">{t('trips.title')}</h2>
        <div className="flex gap-2">
          {selectMode ? (
            <>
              <button
                onClick={() => { setSelectMode(false); setSelectedIds([]) }}
                className="bg-surface border border-border-dim text-text-muted px-4 py-2 rounded-lg text-sm hover:text-text-primary transition-colors"
              >
                {t('trips.cancel')}
              </button>
              <button
                disabled={selectedIds.length < 2}
                onClick={openMergeModal}
                className="bg-gold text-bg-deep font-semibold px-4 py-2 rounded-lg hover:bg-gold/90 transition-colors text-sm disabled:opacity-50"
              >
                {t('trips.group')}{selectedIds.length >= 2 ? ` (${selectedIds.length})` : ''}
              </button>
            </>
          ) : (
            !isViewer && (
              <>
                <button
                  onClick={() => setSelectMode(true)}
                  className="bg-surface border border-border-dim text-text-muted px-4 py-2 rounded-lg text-sm hover:text-text-primary transition-colors"
                >
                  {t('trips.groupTrip')}
                </button>
                <button
                  onClick={() => navigate('/vueltas/nueva')}
                  className="bg-gold text-bg-deep font-semibold px-4 py-2 rounded-lg hover:bg-gold/90 transition-colors text-sm"
                >
                  {t('trips.newTrip')}
                </button>
              </>
            )
          )}
        </div>
      </div>

      {selectMode && (
        <div className="bg-gold/10 border border-gold/30 rounded-lg px-4 py-2 text-gold text-sm">
          {t('trips.merge.selectAtLeast2')}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <select
          value={filters.estado}
          onChange={(e) => setFilters(f => ({ ...f, estado: e.target.value }))}
          className="bg-surface border border-border-dim rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-gold"
        >
          <option value="">{t('trips.allStatuses')}</option>
          {ESTADOS.map(e => <option key={e} value={e}>{t(`status.${e}`)}</option>)}
        </select>
        <select
          value={filters.camionId}
          onChange={(e) => setFilters(f => ({ ...f, camionId: e.target.value }))}
          className="bg-surface border border-border-dim rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-gold"
        >
          <option value="">{t('trips.allTrucks')}</option>
          {camiones.map(c => <option key={c.id} value={c.id}>{c.placa}</option>)}
        </select>
        <select
          value={filters.brokerId}
          onChange={(e) => setFilters(f => ({ ...f, brokerId: e.target.value }))}
          className="bg-surface border border-border-dim rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-gold"
        >
          <option value="">{t('trips.allBrokers')}</option>
          {brokers.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
        </select>
        <DatePicker value={filters.fechaDesde} onChange={v => setFilters(f => ({ ...f, fechaDesde: v }))} placeholder="From date" />
        <DatePicker value={filters.fechaHasta} onChange={v => setFilters(f => ({ ...f, fechaHasta: v }))} placeholder="To date" />
      </div>

      {isLoading ? (
        <p className="text-text-muted">{t('trips.loading')}</p>
      ) : (
        <VueltaTable
          vueltas={vueltas}
          selectable={selectMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
        />
      )}

      {showMerge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface border border-border-dim rounded-xl w-full max-w-lg space-y-5 p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-serif text-xl text-text-primary">{t('trips.merge.title')}</h3>

            <div>
              <p className="text-text-muted text-xs uppercase tracking-wide mb-2">{t('trips.merge.selected')}</p>
              <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={mergeOrder.map(v => v.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {mergeOrder.map(v => (
                      <SortableMergeItem key={v.id} vuelta={v} onRemove={removeFromMerge} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-text-muted text-xs uppercase tracking-wide mb-1.5">{t('trips.detail.truck')}</label>
                <select value={mergeForm.camionId} onChange={e => setMergeForm(f => ({ ...f, camionId: e.target.value }))} className={inputCls}>
                  <option value="">Seleccionar...</option>
                  {camiones.map(c => <option key={c.id} value={c.id}>{c.placa} — {c.modelo}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-text-muted text-xs uppercase tracking-wide mb-1.5">{t('trips.detail.mainDriver')}</label>
                <select value={mergeForm.conductorPrincipalId} onChange={e => setMergeForm(f => ({ ...f, conductorPrincipalId: e.target.value }))} className={inputCls}>
                  <option value="">Seleccionar...</option>
                  {conductores.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-text-muted text-xs uppercase tracking-wide mb-1.5">{t('trips.detail.baseSalida')}</label>
                <input value={mergeForm.baseSalida} onChange={e => setMergeForm(f => ({ ...f, baseSalida: e.target.value }))} className={inputCls} placeholder="Miami, FL" />
              </div>
              <div>
                <label className="block text-text-muted text-xs uppercase tracking-wide mb-1.5">{t('trips.detail.fechaSalida')}</label>
                <DateTimePicker value={mergeForm.fechaSalida} onChange={v => setMergeForm(f => ({ ...f, fechaSalida: v }))} />
              </div>
            </div>

            <div className="bg-surface-2 rounded-lg p-4 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-text-muted">{t('trips.merge.combinedIncome')}</span><span className="text-success">{fmt(mergeIngreso)}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">{t('trips.merge.combinedExpense')}</span><span className="text-danger">{fmt(mergeGasto)}</span></div>
              <div className="flex justify-between font-semibold border-t border-border-dim pt-1 mt-1">
                <span className="text-text-primary">{t('trips.detail.profitability')}</span>
                <span className={mergeIngreso - mergeGasto >= 0 ? 'text-success' : 'text-danger'}>{fmt(mergeIngreso - mergeGasto)}</span>
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={closeMergeModal} className="text-text-muted text-sm hover:text-text-primary">{t('trips.cancel')}</button>
              <button
                onClick={() => mergeMutation.mutate()}
                disabled={mergeMutation.isPending || !canMerge}
                className="bg-gold text-bg-deep font-semibold px-5 py-2 rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-50"
              >
                {mergeMutation.isPending ? t('trips.merge.merging') : t('trips.merge.mergeBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
