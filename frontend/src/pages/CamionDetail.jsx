import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { camionesApi, mantenimientosApi, piezasApi } from '../api/camiones.api'
import { StatusBadge } from '../components/StatusBadge'
import { useDistanceUnit } from '../context/DistanceUnitContext'
import { DatePicker } from '../components/DatePicker'
import { TRUCK_COMPLIANCE_FIELDS, getTruckComplianceStatus } from '../utils/truckComplianceFields'
import { computeNextDue } from '../utils/compliance'

function fmtDate(iso) {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function toInputDate(iso) {
  if (!iso) return ''
  return iso.slice(0, 10)
}

function docColor(iso) {
  if (!iso) return 'text-text-muted'
  const t = new Date(iso).getTime()
  const now = Date.now()
  if (t < now) return 'text-danger'
  if (t < now + 30 * 864e5) return 'text-yellow-400'
  return 'text-success'
}

function fmtMoney(n) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function DaysBadge({ nextDue }) {
  if (!nextDue) return null
  const daysLeft = Math.ceil((nextDue.getTime() - Date.now()) / 86400000)
  const cls = daysLeft < 0 ? 'bg-danger/10 text-danger border-danger/30'
    : daysLeft <= 30 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
    : 'bg-success/10 text-success border-success/30'
  const badge = daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Today' : `${daysLeft}d`
  return <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${cls}`}>{badge}</span>
}

const TIPOS_CAMION = ['tractocamion', 'camion_rigido', 'otro']
const ESTADOS_CAMION = ['disponible', 'en_ruta', 'mantenimiento']
const TIPOS_MANT = ['aceite', 'llantas', 'frenos', 'electrico', 'revision', 'otro']
const MANT_EMPTY = { tipo: 'aceite', descripcion: '', costo: '', proveedor: '', fecha: '', proximoMantenimiento: '' }
const PIEZA_EMPTY = { nombre: '', numeroParte: '', proveedor: '', costo: '', cantidad: '1', fecha: '', notas: '' }

const MANT_BADGE = {
  aceite:    'bg-blue-500/10 text-blue-400 border-blue-500/30',
  llantas:   'bg-orange-500/10 text-orange-400 border-orange-500/30',
  frenos:    'bg-red-500/10 text-red-400 border-red-500/30',
  electrico: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  revision:  'bg-purple-500/10 text-purple-400 border-purple-500/30',
  otro:      'bg-surface-2 text-text-muted border-border-dim',
}

export default function CamionDetail() {
  const { unit } = useDistanceUnit()
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [editInfo, setEditInfo] = useState(false)
  const [infoForm, setInfoForm] = useState({})
  const [infoError, setInfoError] = useState(null)

  const [editDocs, setEditDocs] = useState(false)
  const [docsForm, setDocsForm] = useState({})
  const [docsError, setDocsError] = useState(null)

  const [showPiezaForm, setShowPiezaForm] = useState(false)
  const [piezaForm, setPiezaForm] = useState(PIEZA_EMPTY)
  const [piezaError, setPiezaError] = useState(null)
  const [confirmDeletePiezaId, setConfirmDeletePiezaId] = useState(null)

  const [showMantForm, setShowMantForm] = useState(false)
  const [mantForm, setMantForm] = useState(MANT_EMPTY)
  const [mantError, setMantError] = useState(null)
  const [confirmDeleteMantId, setConfirmDeleteMantId] = useState(null)

  const [editCompliance, setEditCompliance] = useState(false)
  const [complianceForm, setComplianceForm] = useState({})
  const [complianceError, setComplianceError] = useState(null)

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
      setEditCompliance(false)
      setInfoError(null)
      setDocsError(null)
      setComplianceError(null)
    },
    onError: (err) => {
      const msg = err.response?.data?.error ?? 'Error al guardar'
      if (editInfo) setInfoError(msg)
      else if (editCompliance) setComplianceError(msg)
      else setDocsError(msg)
    },
  })

  const createPiezaMutation = useMutation({
    mutationFn: (data) => camionesApi.createPieza(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['camion', id] })
      setPiezaForm(PIEZA_EMPTY)
      setShowPiezaForm(false)
      setPiezaError(null)
    },
    onError: (err) => setPiezaError(err.response?.data?.error ?? 'Error al guardar'),
  })

  const deletePiezaMutation = useMutation({
    mutationFn: (piezaId) => piezasApi.delete(piezaId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['camion', id] })
      setConfirmDeletePiezaId(null)
    },
  })

  const createMantMutation = useMutation({
    mutationFn: (data) => camionesApi.createMantenimiento(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['camion', id] })
      setMantForm(MANT_EMPTY)
      setShowMantForm(false)
      setMantError(null)
    },
    onError: (err) => setMantError(err.response?.data?.error ?? 'Error al guardar'),
  })

  const deleteMantMutation = useMutation({
    mutationFn: (mantId) => mantenimientosApi.delete(mantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['camion', id] })
      setConfirmDeleteMantId(null)
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
      modelo: camion.modelo,
      tipo: camion.tipo,
      estado: camion.estado,
      anio: camion.anio ?? '',
      capacidadTon: camion.capacidadTon ?? '',
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
      modelo: infoForm.modelo.trim(),
      tipo: infoForm.tipo,
      estado: infoForm.estado,
      anio: infoForm.anio ? parseInt(infoForm.anio) : null,
      capacidadTon: infoForm.capacidadTon ? parseFloat(infoForm.capacidadTon) : null,
      color: infoForm.color.trim() || null,
      vin: infoForm.vin.trim() || null,
      notas: infoForm.notas.trim() || null,
    })
  }

  const saveDocs = () => {
    updateMutation.mutate({ fechaCompra: docsForm.fechaCompra || null })
  }

  const ALL_COMPLIANCE_KEYS = TRUCK_COMPLIANCE_FIELDS.map(f => f.key)

  const startEditCompliance = () => {
    const form = {}
    for (const key of ALL_COMPLIANCE_KEYS) form[key] = toInputDate(camion[key])
    setComplianceForm(form)
    setEditCompliance(true)
    setComplianceError(null)
  }

  const saveCompliance = () => {
    const data = {}
    for (const key of ALL_COMPLIANCE_KEYS) {
      data[key] = complianceForm[key] ? new Date(complianceForm[key]).toISOString() : null
    }
    updateMutation.mutate(data)
  }

  const submitPieza = (e) => {
    e.preventDefault()
    if (!piezaForm.nombre.trim()) return setPiezaError('Nombre de la pieza es obligatorio')
    if (!piezaForm.fecha) return setPiezaError('Fecha es obligatoria')
    if (!piezaForm.costo) return setPiezaError('Costo es obligatorio')
    createPiezaMutation.mutate({
      nombre: piezaForm.nombre.trim(),
      numeroParte: piezaForm.numeroParte.trim() || null,
      proveedor: piezaForm.proveedor.trim() || null,
      costo: parseFloat(piezaForm.costo),
      cantidad: piezaForm.cantidad ? parseInt(piezaForm.cantidad) : 1,
      fecha: new Date(piezaForm.fecha).toISOString(),
      notas: piezaForm.notas.trim() || null,
    })
  }

  const submitMant = (e) => {
    e.preventDefault()
    if (!mantForm.descripcion.trim() || !mantForm.fecha) return setMantError('Descripción y fecha son obligatorias')
    createMantMutation.mutate({
      tipo: mantForm.tipo,
      descripcion: mantForm.descripcion.trim(),
      costo: mantForm.costo ? parseFloat(mantForm.costo) : 0,
      proveedor: mantForm.proveedor.trim() || null,
      fecha: new Date(mantForm.fecha).toISOString(),
      proximoMantenimiento: mantForm.proximoMantenimiento ? new Date(mantForm.proximoMantenimiento).toISOString() : null,
    })
  }

  const field = 'bg-surface-2 border border-border-dim rounded-lg px-3 py-2 text-text-primary text-sm w-full focus:outline-none focus:border-gold placeholder:text-text-muted'

  const piezas = camion.piezas ?? []
  const totalPiezas = piezas.reduce((s, p) => s + p.costo * p.cantidad, 0)

  const mantenimientos = camion.mantenimientos ?? []
  const totalMant = mantenimientos.reduce((s, m) => s + m.costo, 0)
  const proximos = mantenimientos
    .filter(m => m.proximoMantenimiento && new Date(m.proximoMantenimiento) > new Date())
    .sort((a, b) => new Date(a.proximoMantenimiento) - new Date(b.proximoMantenimiento))

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
            <h2 className="font-serif text-3xl text-gold">{camion.placa}</h2>
            <StatusBadge estado={camion.estado} />
            <span className={`flex items-center gap-1.5 text-sm font-medium ${complianceCls}`}>
              <span className={`w-2 h-2 rounded-full ${complianceDotCls}`} />
              {complianceLabel}
            </span>
          </div>
          <p className="text-text-muted">{camion.modelo}{camion.anio ? ` (${camion.anio})` : ''} · <span className="capitalize">{camion.tipo?.replace('_', ' ')}</span></p>
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
              <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Capacidad (ton)</label>
              <input className={field} type="number" step="0.1" min="0" value={infoForm.capacidadTon}
                onChange={e => setInfoForm(f => ({ ...f, capacidadTon: e.target.value }))} />
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
            <div><p className="text-text-muted text-xs uppercase tracking-wide mb-0.5">Capacidad</p><p className="text-text-primary">{camion.capacidadTon ? `${camion.capacidadTon} ton` : '–'}</p></div>
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

      {/* Compliance & Registrations */}
      <div className="bg-surface border border-border-dim rounded-xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-serif text-lg text-text-primary">Compliance & Registrations</h3>
          {!editCompliance ? (
            <button onClick={startEditCompliance} className="text-xs text-gold border border-gold/30 rounded px-3 py-1 hover:opacity-70 transition-opacity">
              Editar
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => { setEditCompliance(false); setComplianceError(null) }} className="text-xs text-text-muted border border-border-dim rounded px-3 py-1 hover:text-text-primary">
                Cancelar
              </button>
              <button onClick={saveCompliance} disabled={updateMutation.isPending}
                className="text-xs bg-gold text-bg-deep font-semibold px-3 py-1 rounded hover:opacity-90 disabled:opacity-50">
                {updateMutation.isPending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          )}
        </div>

        {editCompliance ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TRUCK_COMPLIANCE_FIELDS.filter(f => !f.reeferOnly || camion.tipo === 'reefer').map(compField => {
              const currentVal = complianceForm[compField.key] ?? ''
              const nextDue = compField.type === 'interval' && currentVal ? computeNextDue(compField, currentVal) : null
              return (
                <div key={compField.key}>
                  <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">
                    {compField.label}
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
            {TRUCK_COMPLIANCE_FIELDS.filter(f => !f.reeferOnly || camion.tipo === 'reefer').map(compField => {
              const val = camion[compField.key]
              const nextDue = computeNextDue(compField, val)
              return (
                <div key={compField.key} className="flex items-start justify-between py-2.5">
                  <p className="text-text-muted text-sm w-44 shrink-0">{compField.label}</p>
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

      {/* Piezas y Repuestos */}
      <div className="bg-surface border border-border-dim rounded-xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-serif text-lg text-text-primary">Piezas y Repuestos</h3>
          <button
            onClick={() => { setShowPiezaForm(v => !v); setPiezaError(null) }}
            className="bg-gold text-bg-deep font-semibold text-xs px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            {showPiezaForm ? 'Cancelar' : '+ Agregar Pieza'}
          </button>
        </div>

        {showPiezaForm && (
          <form onSubmit={submitPieza} className="bg-surface-2 border border-border-dim rounded-lg p-4 mb-5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Nombre *</label>
                <input className={field} placeholder="Filtro de aceite" value={piezaForm.nombre}
                  onChange={e => setPiezaForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Número de parte</label>
                <input className={field} placeholder="OEM-12345" value={piezaForm.numeroParte}
                  onChange={e => setPiezaForm(f => ({ ...f, numeroParte: e.target.value }))} />
              </div>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Fecha *</label>
                <DatePicker value={piezaForm.fecha} onChange={v => setPiezaForm(f => ({ ...f, fecha: v }))} />
              </div>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Proveedor</label>
                <input className={field} placeholder="Distribuidora XYZ" value={piezaForm.proveedor}
                  onChange={e => setPiezaForm(f => ({ ...f, proveedor: e.target.value }))} />
              </div>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Costo unitario ($) *</label>
                <input className={field} type="number" step="0.01" min="0" placeholder="0.00" value={piezaForm.costo}
                  onChange={e => setPiezaForm(f => ({ ...f, costo: e.target.value }))} />
              </div>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Cantidad</label>
                <input className={field} type="number" min="1" step="1" value={piezaForm.cantidad}
                  onChange={e => setPiezaForm(f => ({ ...f, cantidad: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Notas</label>
                <input className={field} placeholder="Observaciones opcionales" value={piezaForm.notas}
                  onChange={e => setPiezaForm(f => ({ ...f, notas: e.target.value }))} />
              </div>
            </div>
            {piezaError && <p className="text-danger text-sm">{piezaError}</p>}
            <button type="submit" disabled={createPiezaMutation.isPending}
              className="bg-gold text-bg-deep font-semibold text-sm px-4 py-1.5 rounded hover:opacity-90 disabled:opacity-50 transition-opacity">
              {createPiezaMutation.isPending ? 'Guardando…' : 'Guardar pieza'}
            </button>
          </form>
        )}

        {piezas.length === 0 ? (
          <p className="text-text-muted text-sm">No hay piezas registradas</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted text-xs uppercase tracking-wide border-b border-border-dim">
                  <th className="text-left py-2 pr-3 font-normal">Fecha</th>
                  <th className="text-left py-2 pr-3 font-normal">Pieza</th>
                  <th className="text-left py-2 pr-3 font-normal">N° Parte</th>
                  <th className="text-left py-2 pr-3 font-normal">Proveedor</th>
                  <th className="text-right py-2 pr-3 font-normal">Cant.</th>
                  <th className="text-right py-2 pr-3 font-normal">Costo Unit.</th>
                  <th className="text-right py-2 font-normal">Total</th>
                  <th className="py-2 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {piezas.map(p => (
                  <tr key={p.id} className="border-b border-border-dim last:border-0">
                    <td className="py-2.5 pr-3 text-text-muted whitespace-nowrap">{fmtDate(p.fecha)}</td>
                    <td className="py-2.5 pr-3 text-text-primary">
                      <span>{p.nombre}</span>
                      {p.notas && <span className="block text-text-muted text-xs">{p.notas}</span>}
                    </td>
                    <td className="py-2.5 pr-3 text-text-muted font-mono text-xs">{p.numeroParte ?? '–'}</td>
                    <td className="py-2.5 pr-3 text-text-muted">{p.proveedor ?? '–'}</td>
                    <td className="py-2.5 pr-3 text-right text-text-primary">{p.cantidad}</td>
                    <td className="py-2.5 pr-3 text-right text-text-primary whitespace-nowrap">$ {fmtMoney(p.costo)}</td>
                    <td className="py-2.5 text-right text-text-primary whitespace-nowrap">$ {fmtMoney(p.costo * p.cantidad)}</td>
                    <td className="py-2.5 pl-2 text-right">
                      {confirmDeletePiezaId === p.id ? (
                        <div className="flex gap-1 items-center justify-end">
                          <button onClick={() => deletePiezaMutation.mutate(p.id)} disabled={deletePiezaMutation.isPending}
                            className="text-xs bg-danger text-white px-2 py-0.5 rounded hover:opacity-80 disabled:opacity-50">Sí</button>
                          <button onClick={() => setConfirmDeletePiezaId(null)} className="text-xs text-text-muted hover:text-text-primary">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeletePiezaId(p.id)} className="text-text-muted hover:text-danger text-xs transition-colors">✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} className="pt-3 text-text-muted text-xs uppercase tracking-wide">Total piezas</td>
                  <td className="pt-3 text-right text-gold font-semibold whitespace-nowrap">$ {fmtMoney(totalPiezas)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Próximos mantenimientos */}
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

      {/* Historial de mantenimiento */}
      <div className="bg-surface border border-border-dim rounded-xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-serif text-lg text-text-primary">Historial de mantenimiento</h3>
          <button
            onClick={() => { setShowMantForm(v => !v); setMantError(null) }}
            className="bg-gold text-bg-deep font-semibold text-xs px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            {showMantForm ? 'Cancelar' : '+ Agregar'}
          </button>
        </div>

        {showMantForm && (
          <form onSubmit={submitMant} className="bg-surface-2 border border-border-dim rounded-lg p-4 mb-5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Tipo</label>
                <select className={field} value={mantForm.tipo} onChange={e => setMantForm(f => ({ ...f, tipo: e.target.value }))}>
                  {TIPOS_MANT.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Fecha *</label>
                <DatePicker value={mantForm.fecha} onChange={v => setMantForm(f => ({ ...f, fecha: v }))} />
              </div>
              <div className="md:col-span-2">
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Descripción *</label>
                <input className={field} placeholder="Cambio de aceite 5W-30" value={mantForm.descripcion}
                  onChange={e => setMantForm(f => ({ ...f, descripcion: e.target.value }))} />
              </div>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Costo ($)</label>
                <input className={field} type="number" step="0.01" min="0" placeholder="0.00" value={mantForm.costo}
                  onChange={e => setMantForm(f => ({ ...f, costo: e.target.value }))} />
              </div>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Proveedor</label>
                <input className={field} placeholder="Taller Mecánico XYZ" value={mantForm.proveedor}
                  onChange={e => setMantForm(f => ({ ...f, proveedor: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Próximo mantenimiento</label>
                <DatePicker value={mantForm.proximoMantenimiento} onChange={v => setMantForm(f => ({ ...f, proximoMantenimiento: v }))} />
              </div>
            </div>
            {mantError && <p className="text-danger text-sm">{mantError}</p>}
            <button type="submit" disabled={createMantMutation.isPending}
              className="bg-gold text-bg-deep font-semibold text-sm px-4 py-1.5 rounded hover:opacity-90 disabled:opacity-50 transition-opacity">
              {createMantMutation.isPending ? 'Guardando…' : 'Guardar mantenimiento'}
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
                      {confirmDeleteMantId === m.id ? (
                        <div className="flex gap-1 items-center justify-end">
                          <button onClick={() => deleteMantMutation.mutate(m.id)} disabled={deleteMantMutation.isPending}
                            className="text-xs bg-danger text-white px-2 py-0.5 rounded hover:opacity-80 disabled:opacity-50">Sí</button>
                          <button onClick={() => setConfirmDeleteMantId(null)} className="text-xs text-text-muted hover:text-text-primary">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteMantId(m.id)} className="text-text-muted hover:text-danger text-xs transition-colors">✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="pt-3 text-text-muted text-xs uppercase tracking-wide">Total</td>
                  <td className="pt-3 text-right text-gold font-semibold">$ {fmtMoney(totalMant)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
