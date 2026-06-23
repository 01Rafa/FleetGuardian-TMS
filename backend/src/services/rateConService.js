import { GoogleGenerativeAI } from '@google/generative-ai'

const PROMPT = `You are a data extraction assistant for a trucking management system. Extract fields from this rate confirmation document and return ONLY a valid JSON object with no markdown, no backticks, no explanation.
If a field is not found, use null.

IMPORTANT — brokerName and brokerMC rules:
- brokerName: the freight BROKER or logistics company that is ARRANGING this load and paying the carrier. This is NOT the shipper, NOT the consignee, NOT the pickup location company, NOT the delivery location company. Look for labels like "Broker:", "Arranged by:", "Booking Agent:", "Logistics:", "Transportation:", or a company name near an MC# or broker authority field. If the document does not clearly identify a separate broker entity, return null.
- brokerMC: the MC number belonging to the BROKER (not the carrier's MC). Usually labeled "Broker MC#", "MC#", "Authority:", or found directly next to the broker company name. If not found, return null.

Return this exact structure:
{
  "brokerName": "string or null",
  "brokerMC": "string or null",
  "loadNumber": "string or null",
  "origin": "string or null",
  "originDate": "ISO date string or null",
  "destination": "string or null",
  "destinationDate": "ISO date string or null",
  "freightAmount": "number or null",
  "commodity": "string or null",
  "weight": "string or null",
  "equipment": "string or null",
  "specialInstructions": "string or null"
}`

function is503(err) {
  return (
    err?.status === 503 ||
    err?.httpError?.status === 503 ||
    String(err?.message ?? '').includes('503') ||
    String(err?.message ?? '').toLowerCase().includes('service unavailable') ||
    String(err?.message ?? '').toLowerCase().includes('overloaded')
  )
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function extractRateConfirmation(fileBuffer, mimeType) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const base64 = fileBuffer.toString('base64')

  const delays = [2000, 4000, 8000]
  let lastError

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const result = await model.generateContent([
        { inlineData: { data: base64, mimeType } },
        PROMPT,
      ])

      const text = result.response.text().trim()
      const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

      try {
        return JSON.parse(clean)
      } catch {
        throw new Error('No se pudo leer el rate confirmation')
      }
    } catch (err) {
      lastError = err
      if (!is503(err) || attempt === delays.length) break
      await sleep(delays[attempt])
    }
  }

  if (is503(lastError)) {
    throw new Error('El servicio de extracción está ocupado. Intenta de nuevo en unos segundos.')
  }
  throw lastError
}
