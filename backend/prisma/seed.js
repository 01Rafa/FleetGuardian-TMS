import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'

dotenv.config()

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  await prisma.gasto.deleteMany()
  await prisma.tramo.deleteMany()
  await prisma.vuelta.deleteMany()
  await prisma.conductor.deleteMany()
  await prisma.camion.deleteMany()
  await prisma.usuario.deleteMany()
  await prisma.empresa.deleteMany()

  const empresa = await prisma.empresa.create({
    data: { nombre: 'Fleet Guardian LLC', ruc: '20123456789' },
  })

  await prisma.usuario.create({
    data: {
      empresaId: empresa.id,
      nombre: 'Admin Demo',
      email: 'admin@demo.com',
      password: await bcrypt.hash('demo1234', 10),
      rol: 'admin',
    },
  })

  const [c1, c2, c3] = await Promise.all([
    prisma.camion.create({ data: { empresaId: empresa.id, placa: 'FL-1234', modelo: 'Peterbilt 389', anio: 2021, capacidadTon: 30, tipo: 'reefer', estado: 'en_ruta' } }),
    prisma.camion.create({ data: { empresaId: empresa.id, placa: 'TX-5678', modelo: 'Kenworth T680', anio: 2020, capacidadTon: 28, tipo: 'flatbed', estado: 'disponible' } }),
    prisma.camion.create({ data: { empresaId: empresa.id, placa: 'GA-9012', modelo: 'Freightliner Cascadia', anio: 2022, capacidadTon: 25, tipo: 'dry_van', estado: 'disponible' } }),
  ])

  const [d1, d2, d3] = await Promise.all([
    prisma.conductor.create({ data: { empresaId: empresa.id, nombre: 'Mike Johnson', licencia: 'CDL-FL-001', telefono: '305-555-0101' } }),
    prisma.conductor.create({ data: { empresaId: empresa.id, nombre: 'David Martinez', licencia: 'CDL-TX-002', telefono: '713-555-0202' } }),
    prisma.conductor.create({ data: { empresaId: empresa.id, nombre: 'Sarah Williams', licencia: 'CDL-GA-003', telefono: '404-555-0303' } }),
  ])

  const routes = [
    { camion: c1, conductor: d1, estado: 'en_curso', base: 'Miami, FL', dias: -2,
      tramos: [
        { origen: 'Miami, FL', destino: 'Atlanta, GA', kmRecorridos: 662, cargaTon: 22, fleteCobrado: 3200, tipo: 'carga' },
        { origen: 'Atlanta, GA', destino: 'Nashville, TN', kmRecorridos: 402, cargaTon: 18, fleteCobrado: 2100, tipo: 'carga' },
        { origen: 'Nashville, TN', destino: 'Miami, FL', kmRecorridos: 1101, cargaTon: 0, fleteCobrado: 0, tipo: 'regreso' },
      ],
      gastos: [
        { categoria: 'combustible', monto: 980, descripcion: 'Diesel Miami-Atlanta' },
        { categoria: 'peaje', monto: 145, descripcion: 'I-75 tolls' },
        { categoria: 'viatico', monto: 210, descripcion: 'Hotel and meals' },
        { categoria: 'mantenimiento', monto: 95, descripcion: 'Oil change' },
        { categoria: 'otro', monto: 40, descripcion: 'Truck wash' },
      ],
    },
    { camion: c2, conductor: d2, estado: 'completada', base: 'Houston, TX', dias: -7,
      tramos: [
        { origen: 'Houston, TX', destino: 'Dallas, TX', kmRecorridos: 386, cargaTon: 25, fleteCobrado: 2400, tipo: 'carga' },
        { origen: 'Dallas, TX', destino: 'Oklahoma City, OK', kmRecorridos: 338, cargaTon: 20, fleteCobrado: 1900, tipo: 'carga' },
        { origen: 'Oklahoma City, OK', destino: 'Houston, TX', kmRecorridos: 720, cargaTon: 0, fleteCobrado: 0, tipo: 'regreso' },
      ],
      gastos: [
        { categoria: 'combustible', monto: 820, descripcion: 'Diesel Houston-Dallas' },
        { categoria: 'peaje', monto: 110, descripcion: 'I-45 tolls' },
        { categoria: 'viatico', monto: 190, descripcion: 'Meals and lodging' },
        { categoria: 'mantenimiento', monto: 80, descripcion: 'Tire inspection' },
        { categoria: 'otro', monto: 35, descripcion: 'Truck wash' },
      ],
    },
    { camion: c3, conductor: d3, estado: 'planificada', base: 'Atlanta, GA', dias: 1,
      tramos: [
        { origen: 'Atlanta, GA', destino: 'Charlotte, NC', kmRecorridos: 434, cargaTon: 20, fleteCobrado: 2600, tipo: 'carga' },
        { origen: 'Charlotte, NC', destino: 'Richmond, VA', kmRecorridos: 476, cargaTon: 15, fleteCobrado: 2200, tipo: 'carga' },
        { origen: 'Richmond, VA', destino: 'Atlanta, GA', kmRecorridos: 900, cargaTon: 0, fleteCobrado: 0, tipo: 'regreso' },
      ],
      gastos: [
        { categoria: 'combustible', monto: 870, descripcion: 'Diesel Atlanta-Charlotte' },
        { categoria: 'peaje', monto: 160, descripcion: 'I-85 tolls' },
        { categoria: 'viatico', monto: 220, descripcion: 'Hotel and meals' },
        { categoria: 'mantenimiento', monto: 110, descripcion: 'Brake check' },
        { categoria: 'otro', monto: 45, descripcion: 'Truck wash' },
      ],
    },
    { camion: c1, conductor: d1, estado: 'facturada', base: 'Miami, FL', dias: -14,
      tramos: [
        { origen: 'Miami, FL', destino: 'Jacksonville, FL', kmRecorridos: 528, cargaTon: 28, fleteCobrado: 2900, tipo: 'carga' },
        { origen: 'Jacksonville, FL', destino: 'Savannah, GA', kmRecorridos: 172, cargaTon: 22, fleteCobrado: 1400, tipo: 'carga' },
        { origen: 'Savannah, GA', destino: 'Miami, FL', kmRecorridos: 700, cargaTon: 0, fleteCobrado: 0, tipo: 'regreso' },
      ],
      gastos: [
        { categoria: 'combustible', monto: 750, descripcion: 'Diesel Miami-Jacksonville' },
        { categoria: 'peaje', monto: 130, descripcion: 'Florida Turnpike tolls' },
        { categoria: 'viatico', monto: 180, descripcion: 'Meals and rest stop' },
        { categoria: 'mantenimiento', monto: 90, descripcion: 'Filter replacement' },
        { categoria: 'otro', monto: 30, descripcion: 'Truck wash' },
      ],
    },
    { camion: c2, conductor: d2, estado: 'completada', base: 'Houston, TX', dias: -10,
      tramos: [
        { origen: 'Houston, TX', destino: 'San Antonio, TX', kmRecorridos: 317, cargaTon: 24, fleteCobrado: 2100, tipo: 'carga' },
        { origen: 'San Antonio, TX', destino: 'El Paso, TX', kmRecorridos: 858, cargaTon: 18, fleteCobrado: 3500, tipo: 'carga' },
        { origen: 'El Paso, TX', destino: 'Houston, TX', kmRecorridos: 1175, cargaTon: 0, fleteCobrado: 0, tipo: 'regreso' },
      ],
      gastos: [
        { categoria: 'combustible', monto: 1100, descripcion: 'Diesel Houston-El Paso' },
        { categoria: 'peaje', monto: 90, descripcion: 'I-10 tolls' },
        { categoria: 'viatico', monto: 260, descripcion: 'Hotel two nights' },
        { categoria: 'mantenimiento', monto: 130, descripcion: 'Oil and filter change' },
        { categoria: 'otro', monto: 50, descripcion: 'Truck wash' },
      ],
    },
  ]

  for (let i = 0; i < routes.length; i++) {
    const v = routes[i]
    const year = new Date().getFullYear()
    const codigo = `VLT-${year}-${String(i + 1).padStart(3, '0')}`
    const fechaSalida = new Date()
    fechaSalida.setDate(fechaSalida.getDate() + v.dias)

    const vuelta = await prisma.vuelta.create({
      data: {
        empresaId: empresa.id,
        camionId: v.camion.id,
        conductorPrincipalId: v.conductor.id,
        codigo,
        baseSalida: v.base,
        fechaSalida,
        estado: v.estado,
      },
    })

    await prisma.tramo.createMany({
      data: v.tramos.map((tramo, idx) => ({ vueltaId: vuelta.id, orden: idx + 1, ...tramo })),
    })

    await prisma.gasto.createMany({
      data: v.gastos.map(gasto => ({ vueltaId: vuelta.id, ...gasto })),
    })

    // Recalculate vuelta financials after creating tramos and gastos
    const [tramoAgg, gastoAgg] = await Promise.all([
      prisma.tramo.aggregate({ where: { vueltaId: vuelta.id }, _sum: { fleteCobrado: true } }),
      prisma.gasto.aggregate({ where: { vueltaId: vuelta.id }, _sum: { monto: true } }),
    ])
    const ingresoTotal = tramoAgg._sum.fleteCobrado ?? 0
    const gastoTotal = gastoAgg._sum.monto ?? 0
    await prisma.vuelta.update({
      where: { id: vuelta.id },
      data: { ingresoTotal, gastoTotal, rentabilidadNeta: ingresoTotal - gastoTotal },
    })
  }

  console.log('Seed completed.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
