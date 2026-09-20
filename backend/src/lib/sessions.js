import prisma from './prisma.js'
import { createSessionService, createPrismaSessionDb } from '../services/session.service.js'

export const sessions = createSessionService({ db: createPrismaSessionDb(prisma) })
