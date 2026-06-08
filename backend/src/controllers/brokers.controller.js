import prisma from '../lib/prisma.js'
import { catchAsync } from '../middleware/errorHandler.js'

export const listBrokers = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const { q } = req.query
  const brokers = await prisma.broker.findMany({
    where: {
      empresaId,
      ...(q ? { nombre: { contains: q, mode: 'insensitive' } } : {}),
    },
    orderBy: { nombre: 'asc' },
    take: 20,
  })
  res.json(brokers)
})

export const createBroker = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const { nombre } = req.body
  if (!nombre?.trim()) return res.status(400).json({ error: 'nombre is required' })
  const broker = await prisma.broker.upsert({
    where: { empresaId_nombre: { empresaId, nombre: nombre.trim() } },
    update: {},
    create: { empresaId, nombre: nombre.trim() },
  })
  res.status(201).json(broker)
})
