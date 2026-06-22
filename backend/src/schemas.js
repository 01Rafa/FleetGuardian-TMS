import { z } from 'zod'

const uuid = z.string().uuid()
const optUuid = uuid.nullable().optional()
const dateStr = z.string().nullable().optional()
const ESTADOS_VUELTA = ['planificada', 'en_curso', 'completada', 'facturada']
const ROLES = ['admin', 'dispatcher', 'viewer']

// ── Auth ─────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email({ message: 'Valid email required' }),
  password: z.string().min(1, { message: 'Password required' }),
})

export const registerSchema = z.object({
  empresa: z.object({
    nombre: z.string().min(1, { message: 'Company name required' }),
    dotNumber: z.string().optional(),
    phone: z.string().optional(),
  }),
  usuario: z.object({
    nombre: z.string().min(1, { message: 'Full name required' }),
    email: z.string().email({ message: 'Valid email required' }),
    password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
    confirmPassword: z.string(),
  }),
})

export const changePasswordSchema = z.object({
  password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
  confirmPassword: z.string(),
})

// ── Vuelta ────────────────────────────────────────────────────────────────────

const tramoBody = z.object({
  orden: z.number().int(),
  origen: z.string().min(1),
  destino: z.string().min(1),
  numeroCarga: z.string().nullable().optional(),
  kmRecorridos: z.number().nullable().optional(),
  cargaTon: z.number().nullable().optional(),
  fleteCobrado: z.number().optional(),
  tipo: z.string().optional(),
  fechaHora: dateStr,
  brokerId: optUuid,
  notas: z.string().nullable().optional(),
})

const gastoBody = z.object({
  categoria: z.string().min(1),
  monto: z.number(),
  descripcion: z.string().nullable().optional(),
  fecha: dateStr,
  tramoId: optUuid,
})

export const createVueltaSchema = z.object({
  camionId: uuid,
  conductorPrincipalId: uuid,
  conductorSecundarioId: z.union([uuid, z.literal(''), z.null()]).optional(),
  baseSalida: z.string().min(1),
  fechaSalida: z.string(),
  fechaRegreso: dateStr,
  estado: z.enum(ESTADOS_VUELTA).optional(),
  notas: z.string().nullable().optional(),
  tramos: z.array(tramoBody).optional(),
  gastos: z.array(gastoBody).optional(),
})

export const updateVueltaSchema = z.object({
  camionId: uuid.optional(),
  conductorPrincipalId: uuid.optional(),
  conductorSecundarioId: z.union([uuid, z.literal(''), z.null()]).optional(),
  baseSalida: z.string().min(1).optional(),
  fechaSalida: z.string().optional(),
  fechaRegreso: dateStr,
  estado: z.enum(ESTADOS_VUELTA).optional(),
  notas: z.string().nullable().optional(),
})

export const changeEstadoSchema = z.object({
  estado: z.enum(ESTADOS_VUELTA, { message: `Estado must be one of: ${ESTADOS_VUELTA.join(', ')}` }),
})

export const mergeVueltasSchema = z.object({
  vueltaIds: z.array(uuid).min(2, { message: 'At least 2 trips required to merge' }),
  camionId: uuid,
  conductorPrincipalId: uuid,
  conductorSecundarioId: optUuid,
  baseSalida: z.string().min(1),
  fechaSalida: z.string(),
})

// ── Tramo ─────────────────────────────────────────────────────────────────────

export const createTramoSchema = tramoBody

export const updateTramoSchema = z.object({
  orden: z.number().int().optional(),
  origen: z.string().min(1).optional(),
  destino: z.string().min(1).optional(),
  numeroCarga: z.string().nullable().optional(),
  kmRecorridos: z.number().nullable().optional(),
  cargaTon: z.number().nullable().optional(),
  fleteCobrado: z.number().optional(),
  tipo: z.string().optional(),
  fechaHora: dateStr,
  brokerId: optUuid,
  notas: z.string().nullable().optional(),
})

// ── Gasto ─────────────────────────────────────────────────────────────────────

export const createGastoSchema = gastoBody

export const updateGastoSchema = z.object({
  categoria: z.string().min(1).optional(),
  monto: z.number().optional(),
  descripcion: z.string().nullable().optional(),
  fecha: dateStr,
})

// ── Camion ────────────────────────────────────────────────────────────────────

const camionDateFields = z.object({
  fechaCompra: dateStr,
  vencimientoRegistracion: dateStr,
  vencimientoSeguro: dateStr,
  vencimientoInspeccion: dateStr,
  dotInspectionLastDate: dateStr,
  stateInspectionLastDate: dateStr,
  brakeInspectionLastDate: dateStr,
  ucrLastDate: dateStr,
  dotBiennualUpdate: dateStr,
  registrationExpiry: dateStr,
  iftaExpiry: dateStr,
  irpExpiry: dateStr,
  liabilityInsuranceExpiry: dateStr,
  cargoInsuranceExpiry: dateStr,
  bobtailInsuranceExpiry: dateStr,
  epaRefrigerantExpiry: dateStr,
})

export const createCamionSchema = camionDateFields.extend({
  placa: z.string().min(1),
  modelo: z.string().min(1),
  tipo: z.string().min(1),
  anio: z.number().int().nullable().optional(),
  capacidadTon: z.number().nullable().optional(),
  estado: z.string().optional(),
  vin: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  notas: z.string().nullable().optional(),
})

export const updateCamionSchema = camionDateFields.extend({
  placa: z.string().min(1).optional(),
  modelo: z.string().min(1).optional(),
  tipo: z.string().min(1).optional(),
  anio: z.number().int().nullable().optional(),
  capacidadTon: z.number().nullable().optional(),
  estado: z.string().optional(),
  vin: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  notas: z.string().nullable().optional(),
})

// ── Mantenimiento ─────────────────────────────────────────────────────────────

export const createMantenimientoSchema = z.object({
  tipo: z.string().min(1),
  descripcion: z.string().min(1),
  costo: z.number().optional(),
  proveedor: z.string().nullable().optional(),
  fecha: z.string(),
  proximoMantenimiento: z.string().nullable().optional(),
})

export const updateMantenimientoSchema = z.object({
  tipo: z.string().min(1).optional(),
  descripcion: z.string().min(1).optional(),
  costo: z.number().optional(),
  proveedor: z.string().nullable().optional(),
  fecha: z.string().optional(),
  proximoMantenimiento: z.string().nullable().optional(),
})

// ── Pieza ─────────────────────────────────────────────────────────────────────

export const createPiezaSchema = z.object({
  nombre: z.string().min(1),
  numeroParte: z.string().nullable().optional(),
  proveedor: z.string().nullable().optional(),
  costo: z.number(),
  cantidad: z.number().int().optional(),
  fecha: z.string(),
  notas: z.string().nullable().optional(),
})

// ── Conductor ─────────────────────────────────────────────────────────────────

const conductorDateFields = z.object({
  cdlExpiry: dateStr,
  medicalExamExpiry: dateStr,
  drugTestLastDate: dateStr,
  alcoholTestLastDate: dateStr,
  mvrLastDate: dateStr,
  hazmatExpiry: dateStr,
  twicExpiry: dateStr,
  annualReviewDate: dateStr,
  safetyTrainingDate: dateStr,
})

export const createConductorSchema = conductorDateFields.extend({
  nombre: z.string().min(1),
  licencia: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  estado: z.string().optional(),
  cdlNumber: z.string().nullable().optional(),
  cdlState: z.string().nullable().optional(),
})

export const updateConductorSchema = conductorDateFields.extend({
  nombre: z.string().min(1).optional(),
  licencia: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  estado: z.string().optional(),
  cdlNumber: z.string().nullable().optional(),
  cdlState: z.string().nullable().optional(),
})

// ── Broker ────────────────────────────────────────────────────────────────────

export const createBrokerSchema = z.object({
  nombre: z.string().min(1, { message: 'Broker name required' }),
})

// ── Usuario ───────────────────────────────────────────────────────────────────

export const inviteUsuarioSchema = z.object({
  nombre: z.string().min(1, { message: 'Name required' }),
  email: z.string().email({ message: 'Valid email required' }),
  rol: z.enum(ROLES, { message: `Role must be one of: ${ROLES.join(', ')}` }),
})

export const updateRolSchema = z.object({
  rol: z.enum(ROLES, { message: `Role must be one of: ${ROLES.join(', ')}` }),
})
