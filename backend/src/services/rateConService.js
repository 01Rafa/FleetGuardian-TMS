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

export async function extractRateConfirmation(fileBuffer, mimeType) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const base64 = fileBuffer.toString('base64')

  const result = await model.generateContent([
    { inlineData: { data: base64, mimeType } },
    PROMPT,
  ])

  const text = result.response.text().trim()

  // Strip accidental markdown fences if Gemini wraps them
  const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  try {
    return JSON.parse(clean)
  } catch {
    throw new Error('No se pudo leer el rate confirmation')
  }
}
