import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { camionesApi } from '../api/camiones.api'
import { StatusBadge } from '../components/StatusBadge'
import { useDistanceUnit } from '../context/DistanceUnitContext'
import { useWeightUnit } from '../context/WeightUnitContext'
import { tonsToDisplay, displayToTons, formatWeight } from '../utils/weight'
import { DatePicker } from '../components/DatePicker'
import { TRUCK_COMPLIANCE_FIELDS, getTruckComplianceStatus } from '../utils/truckComplianceFields'
import { fmtDate, toInputDate, FIELD_CLS } from '../utils/format'
import { unitLabel, hasUnitNumber } from '../utils/unit'
import { ComplianceSection } from '../components/ComplianceSection'
import { PiezasSection } from '../components/PiezasSection'
import { MantenimientosSection } from '../components/MantenimientosSection'

const TIPOS_CAMION = ['tractocamion', 'camion_rigido', 'otro']
const ESTADOS_CAMION = ['disponible', 'en_ruta', 'mantenimiento']

export default function CamionDetail() {
  const { unit } = useDistanceUnit()
  const { weightUnit } = useWeightUnit()
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [editInfo, setEditInfo] = useState(false)
  const [infoForm, setInfoForm] = useState({})
  const [infoError, setInfoError] = useState(null)

  const [editDocs, setEditDocs] = useState(false)
  const [docsForm, setDocsForm] = useState({})
  const [docsError, setDocsError] = useState(null)

  const { data: camion, isLoading, isError, error } = useQuery({
    queryKey: ['camion', id],
    queryFn: () => camionesApi.get(id),
  })

  const updateMutation = useMutation({
    mutationFn: (data) => camionesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['camion', id] })
      qc.invalidateQueries({ queryKey: ['camiones'] })
      setEditInfo(false)
      setEditDocs(false)
      setInfoError(null)
      setDocsError(null)
    },
    onError: (err) => {
      const msg = err.response?.data?.error ?? 'Error al guardar'
      if (editInfo) setInfoError(msg)
      else setDocsError(msg)
    },
  })

  if (isLoading) return <p className="text-text-muted p-4">Cargando...</p>
  if (isError) {
    const status = error?.response?.status
    const msg = status === 404 ? 'Camión no encontrado' : `Error al cargar el camión (${error?.response?.data?.error ?? error?.message ?? 'desconocido'})`
    return <p className="text-danger p-4">{msg}</p>
  }
  if (!camion) return <p className="text-danger p-4">Camión no encontrado</p>

  const startEditInfo = () => {
    setInfoForm({
      placa: camion.placa,
      numeroUnidad: camion.numeroUnidad ?? '',
      modelo: camion.modelo,
      tipo: camion.tipo,
      estado: camion.estado,
      anio: camion.anio ?? '',
      capacidad: tonsToDisplay(camion.capacidadTon, weightUnit) ?? '',
      color: camion.color ?? '',
      vin: camion.vin ?? '',
      notas: camion.notas ?? '',
    })
    setEditInfo(true)
    setInfoError(null)
  }

  const startEditDocs = () => {
    setDocsForm({ fechaCompra: toInputDate(camion.fechaCompra) })
    setEditDocs(true)
    setDocsError(null)
  }

  const saveInfo = () => {
    if (!infoForm.placa.trim() || !infoForm.modelo.trim()) return setInfoError('Placa y modelo son obligatorios')
    updateMutation.mutate({
      placa: infoForm.placa.trim().toUpperCase(),
      numeroUnidad: infoForm.numeroUnidad.trim() || null,
      modelo: infoForm.modelo.trim(),
      tipo: infoForm.tipo,
      estado: infoForm.estado,
      anio: infoForm.anio ? parseInt(infoForm.anio) : null,
      capacidadTon: infoForm.capacidad ? displayToTons(infoForm.capacidad, weightUnit) : null,
      color: infoForm.color.trim() || null,
      vin: infoForm.vin.trim() || null,
      notas: infoForm.notas.trim() || null,
    })
  }

  const saveDocs = () => {
    updateMutation.mutate({ fechaCompra: docsForm.fechaCompra || null })
  }

  const field = FIELD_CLS

  const { status: complianceStatus, closest: complianceClosest } = getTruckComplianceStatus(camion)
  const complianceCls = { green: 'text-success', yellow: 'text-yellow-400', red: 'text-danger' }[complianceStatus]
  const complianceDotCls = { green: 'bg-success', yellow: 'bg-yellow-400', red: 'bg-danger' }[complianceStatus]
  const complianceLabel = { green: 'Compliant', yellow: 'Expiring soon', red: 'Non-compliant' }[complianceStatus]

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/flota')} className="text-text-muted hover:text-text-primary text-sm transition-colors">
        ← Volver a Flota
      </button>

      {/* Header */}
      <div className="bg-surface border border-border-dim rounded-xl p-5 flex flex-wrap gap-4 items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="font-serif text-3xl text-gold">{unitLabel(camion)}</h2>
            <StatusBadge estado={camion.estado} />
            <span className={`flex items-center gap-1.5 text-sm font-medium ${complianceCls}`}>
              <span className={`w-2 h-2 rounded-full ${complianceDotCls}`} />
              {complianceLabel}
            </span>
          </div>
          <p className="text-text-muted">{hasUnitNumber(camion) ? `Placa ${camion.placa} · ` : ''}{camion.modelo}{camion.anio ? ` (${camion.anio})` : ''} · <span className="capitalize">{camion.tipo?.replace('_', ' ')}</span></p>
          {complianceClosest && (
            <p className={`text-xs mt-1 ${complianceCls}`}>
              {complianceClosest.daysLeft < 0
                ? `${complianceClosest.label} ${complianceClosest.verb === 'expires' ? 'expired' : 'overdue'} ${Math.abs(complianceClosest.daysLeft)}d`
                : `${complianceClosest.label} ${complianceClosest.verb} in ${complianceClosest.daysLeft}d`}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-text-muted text-xs uppercase tracking-wide mb-0.5">{unit === 'mi' ? 'Total Miles' : 'Total KM'}</p>
          <p className="text-text-primary text-2xl font-semibold">{(camion.kmTotales ?? 0).toLocaleString('en-US')}</p>
        </div>
      </div>

      {/* Información general */}
      <div className="bg-surface border border-border-dim rounded-xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-serif text-lg text-text-primary">Información general</h3>
          {!editInfo ? (
            <button onClick={startEditInfo} className="text-xs text-gold border border-gold/30 rounded px-3 py-1 hover:opacity-70 transition-opacity">
              Editar
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => { setEditInfo(false); setInfoError(null) }} className="text-xs text-text-muted border border-border-dim rounded px-3 py-1 hover:text-text-primary">
                Cancelar
              </button>
              <button onClick={saveInfo} disabled={updateMutation.isPending}
                className="text-xs bg-gold text-bg-deep font-semibold px-3 py-1 rounded hover:opacity-90 disabled:opacity-50">
                {updateMutation.isPending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          )}
        </div>

        {editInfo ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Número de unidad</label>
              <input className={field} placeholder="T-104" maxLength={30} value={infoForm.numeroUnidad} onChange={e => setInfoForm(f => ({ ...f, numeroUnidad: e.target.value }))} />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Placa *</label>
              <input className={field} value={infoForm.placa} onChange={e => setInfoForm(f => ({ ...f, placa: e.target.value }))} />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Modelo *</label>
              <input className={field} value={infoForm.modelo} onChange={e => setInfoForm(f => ({ ...f, modelo: e.target.value }))} />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Tipo</label>
              <select className={field} value={infoForm.tipo} onChange={e => setInfoForm(f => ({ ...f, tipo: e.target.value }))}>
                {TIPOS_CAMION.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Estado</label>
              <select className={field} value={infoForm.estado} onChange={e => setInfoForm(f => ({ ...f, estado: e.target.value }))}>
                {ESTADOS_CAMION.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Año</label>
              <input className={field} type="number" min="1990" max="2030" value={infoForm.anio}
                onChange={e => setInfoForm(f => ({ ...f, anio: e.target.value }))} />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Capacidad ({weightUnit})</label>
              <input className={field} type="number" step={weightUnit === 'lb' ? '1' : '0.1'} min="0" value={infoForm.capacidad}
                onChange={e => setInfoForm(f => ({ ...f, capacidad: e.target.value }))} />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Color</label>
              <input className={field} placeholder="Blanco" value={infoForm.color}
                onChange={e => setInfoForm(f => ({ ...f, color: e.target.value }))} />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">VIN</label>
              <input className={field} placeholder="1HGBH41JXMN109186" value={infoForm.vin}
                onChange={e => setInfoForm(f => ({ ...f, vin: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Notas</label>
              <textarea className={field} rows={3} value={infoForm.notas}
                onChange={e => setInfoForm(f => ({ ...f, notas: e.target.value }))} />
            </div>
            {infoError && <p className="md:col-span-2 text-danger text-sm">{infoError}</p>}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 text-sm">
            <div><p className="text-text-muted text-xs uppercase tracking-wide mb-0.5">Tipo</p><p className="text-text-primary capitalize">{camion.tipo?.replace('_', ' ')}</p></div>
            <div><p className="text-text-muted text-xs uppercase tracking-wide mb-0.5">Estado</p><StatusBadge estado={camion.estado} /></div>
            <div><p className="text-text-muted text-xs uppercase tracking-wide mb-0.5">Año</p><p className="text-text-primary">{camion.anio ?? '–'}</p></div>
            <div><p className="text-text-muted text-xs uppercase tracking-wide mb-0.5">Capacidad</p><p className="text-text-primary">{formatWeight(camion.capacidadTon, weightUnit)}</p></div>
            <div><p className="text-text-muted text-xs uppercase tracking-wide mb-0.5">Color</p><p className="text-text-primary">{camion.color ?? '–'}</p></div>
            <div><p className="text-text-muted text-xs uppercase tracking-wide mb-0.5">VIN</p><p className="text-text-primary font-mono text-xs break-all">{camion.vin ?? '–'}</p></div>
            {camion.notas && (
              <div className="col-span-2 md:col-span-3">
                <p className="text-text-muted text-xs uppercase tracking-wide mb-0.5">Notas</p>
                <p className="text-text-primary">{camion.notas}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Documentos y vencimientos */}
      <div className="bg-surface border border-border-dim rounded-xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-serif text-lg text-text-primary">Documentos y vencimientos</h3>
          {!editDocs ? (
            <button onClick={startEditDocs} className="text-xs text-gold border border-gold/30 rounded px-3 py-1 hover:opacity-70 transition-opacity">
              Editar
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => { setEditDocs(false); setDocsError(null) }} className="text-xs text-text-muted border border-border-dim rounded px-3 py-1 hover:text-text-primary">
                Cancelar
              </button>
              <button onClick={saveDocs} disabled={updateMutation.isPending}
                className="text-xs bg-gold text-bg-deep font-semibold px-3 py-1 rounded hover:opacity-90 disabled:opacity-50">
                {updateMutation.isPending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          )}
        </div>

        {editDocs ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Fecha de compra</label>
              <DatePicker value={docsForm.fechaCompra} onChange={v => setDocsForm(f => ({ ...f, fechaCompra: v }))} />
            </div>
            {docsError && <p className="md:col-span-2 text-danger text-sm">{docsError}</p>}
          </div>
        ) : (
          <div className="text-sm">
            <div>
              <p className="text-text-muted text-xs uppercase tracking-wide mb-0.5">Fecha de compra</p>
              <p className="text-text-primary">{fmtDate(camion.fechaCompra)}</p>
            </div>
          </div>
        )}
      </div>

      <ComplianceSection
        entity={camion}
        fields={TRUCK_COMPLIANCE_FIELDS}
        onSave={(data) => updateMutation.mutateAsync(data)}
      />

      <PiezasSection
        piezas={camion.piezas ?? []}
        queryKey={['camion', id]}
        createPieza={(data) => camionesApi.createPieza(id, data)}
      />

      <MantenimientosSection
        mantenimientos={camion.mantenimientos ?? []}
        queryKey={['camion', id]}
        createMantenimiento={(data) => camionesApi.createMantenimiento(id, data)}
      />
    </div>
  )
}
