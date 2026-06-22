import prisma from '../lib/prisma.js'
import { normalizeAddress } from '../utils/normalizeAddress.js'
import { TRUCKING_CITIES } from './truckingCities.js'

export async function runSeed() {
  let loaded = 0
  for (const [city, state, lat, lng] of TRUCKING_CITIES) {
    const addressNormalized = normalizeAddress(`${city}, ${state}`)
    await prisma.geoCache.upsert({
      where: { addressNormalized },
      update: { lat, lng },
      create: { addressNormalized, lat, lng },
    })
    loaded++
  }
  console.log(`[seed] Pre-loaded ${loaded} trucking cities into GeoCache`)
}
