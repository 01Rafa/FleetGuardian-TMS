import { GoogleGenerativeAI } from '@google/generative-ai'

const PROMPT = `You are a data extraction assistant for a trucking management system. Extract fields from this rate confirmation document and return ONLY a valid JSON object with no markdown, no backticks, no explanation.
If a field is not found, use null.

FIELD-BY-FIELD RULES:

brokerName:
- The freight BROKER or logistics COMPANY arranging this load and paying the carrier.
- Return the COMPANY name, NOT an individual person's name (e.g. "MegaCorp Logistics" not "John Smith").
- NOT the shipper, NOT the consignee, NOT the pickup/delivery facility name.
- Look for labels: "Broker:", "Arranged by:", "Booking Agent:", "Logistics:", or a company name near MC# / broker authority.
- If not clearly identified as a separate broker entity, return null.

brokerMC:
- The MC number of the BROKER only (not the carrier's MC).
- Usually labeled "Broker MC#", "MC#", "Authority:", near the broker company name.
- If not found, return null.

loadNumber:
- The primary reference number for this load.
- Look for labels: "PO #", "MCL PO #", "Load #", "Load Number", "Reference #", "Ref #", "Confirmation #", "Order #".
- Extract the alphanumeric value only, no label text.

origin:
- The CITY and STATE of the first pickup stop.
- Format: "City, ST" (e.g. "Palm Bay, FL").
- Extract ONLY city and state — do NOT include shed name, facility name, street address, zip code, or country.
- Look in the STOPS table or pickup section. The city/state is usually in an "Address" or "City/State" column.

originDate:
- The pickup date at the origin stop.
- Return as ISO date string "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM:SS" if time is given.

destination:
- The CITY and STATE of the final delivery stop.
- Format: "City, ST" (e.g. "Lexington, MI").
- Same rules as origin — city and state only, no address details.

destinationDate:
- The delivery date at the destination stop.
- Return as ISO date string.

freightAmount:
- The total payment amount for this load.
- Look in a RATE, CHARGES, or PAYMENT table. Labels: "Total", "Rate", "Amount", "Flat Rate", "Line Haul", "All-In Rate".
- Return a number only — no currency symbols, no "USD", no "Flat".
- If multiple line items exist, return the grand total.

commodity:
- The type of freight/cargo being hauled (e.g. "CUKES SIZED", "Produce", "Frozen Food").

weight:
- The shipment weight as a string including units (e.g. "42000 lbs").

equipment:
- The required trailer type (e.g. "Reefer 53FT", "Dry Van 53'", "Flatbed").

specialInstructions:
- Any special handling notes, temperature requirements, or carrier instructions.

Return this exact JSON structure:
{
  "brokerName": "string or null",
  "brokerMC": "string or null",
  "loadNumber": "string or null",
  "origin": "string or null",
  "originDate": "ISO date string or null",
  "destination": "string or null",
  "destinationDate": "ISO date string or null",
  "freightAmount": number or null,
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
