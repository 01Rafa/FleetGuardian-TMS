import axios from 'axios'
import prisma from '../lib/prisma.js'
import { normalizeAddress } from '../utils/normalizeAddress.js'

const ORS_KEY = process.env.ORS_API_KEY
const ORS_BASE = 'https://api.openrouteservice.org'
const TIMEOUT = 5000

async function withRetry(fn) {
  try {
    return await fn()
  } catch {
    await new Promise(r => setTimeout(r, 1000))
    return await fn()
  }
}

export async function geocodeAddress(address) {
  const addressNormalized = normalizeAddress(address)

  const cached = await prisma.geoCache.findUnique({ where: { addressNormalized } })
  if (cached) return { lat: cached.lat, lng: cached.lng }

  let coords
  try {
    const { data } = await withRetry(() =>
      axios.get(`${ORS_BASE}/geocode/search`, {
        headers: { Authorization: ORS_KEY },
        params: { text: address, size: 1, 'boundary.country': 'US' },
        timeout: TIMEOUT,
      })
    )
    const [lng, lat] = data.features[0].geometry.coordinates
    coords = { lat, lng }
  } catch (err) {
    console.error(`[routing] geocode failed for "${address}":`, err.message)
    throw new Error('No se pudo calcular la distancia')
  }

  await prisma.geoCache.upsert({
    where: { addressNormalized },
    update: { lat: coords.lat, lng: coords.lng },
    create: { addressNormalized, lat: coords.lat, lng: coords.lng },
  })
  return coords
}

export async function getRouteMiles(origen, destino) {
  const origenNormalized = normalizeAddress(origen)
  const destinoNormalized = normalizeAddress(destino)

  const cached = await prisma.routeCache.findUnique({
    where: { origenNormalized_destinoNormalized: { origenNormalized, destinoNormalized } },
  })
  if (cached) {
    await prisma.routeCache.update({
      where: { origenNormalized_destinoNormalized: { origenNormalized, destinoNormalized } },
      data: { hitCount: { increment: 1 } },
    })
    return { distanceMillas: cached.distanceMillas, distanceKm: cached.distanceKm }
  }

  const [origenCoords, destinoCoords] = await Promise.all([
    geocodeAddress(origen),
    geocodeAddress(destino),
  ])

  let meters
  try {
    const { data } = await withRetry(() =>
      axios.post(
        `${ORS_BASE}/v2/directions/driving-hgv`,
        { coordinates: [[origenCoords.lng, origenCoords.lat], [destinoCoords.lng, destinoCoords.lat]] },
        { headers: { Authorization: ORS_KEY, 'Content-Type': 'application/json' }, timeout: TIMEOUT }
      )
    )
    meters = data.routes[0].summary.distance
  } catch (err) {
    console.error(`[routing] directions failed for "${origen}" → "${destino}":`, err.message)
    throw new Error('No se pudo calcular la distancia')
  }

  const distanceKm = meters / 1000
  const distanceMillas = meters / 1609.34

  await prisma.routeCache.upsert({
    where: { origenNormalized_destinoNormalized: { origenNormalized, destinoNormalized } },
    update: { distanceMillas, distanceKm },
    create: { origenNormalized, destinoNormalized, distanceMillas, distanceKm },
  })

  return { distanceMillas, distanceKm }
}
