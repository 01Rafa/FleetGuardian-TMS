import { GoogleGenerativeAI } from '@google/generative-ai'

const MODEL = 'gemini-2.5-flash'
const RETRY_DELAYS_MS = [2000, 4000, 8000]

function is503(err) {
  const msg = String(err?.message ?? '').toLowerCase()
  return (
    err?.status === 503 ||
    err?.httpError?.status === 503 ||
    msg.includes('503') ||
    msg.includes('service unavailable') ||
    msg.includes('overloaded')
  )
}

// Connection problems and timeouts. An error that carries an HTTP status is an answer from the API, not a connection
// problem (the SDK prefixes every HTTP error with "Error fetching from ...", so that text is not a reliable signal).
function isNetworkError(err) {
  if (err?.status) return false
  const msg = String(err?.message ?? '').toLowerCase()
  return ['fetch failed', 'econnreset', 'etimedout', 'enotfound', 'socket', 'aborted', 'timeout']
    .some(text => msg.includes(text))
}

function isQuotaError(err) {
  return err?.status === 429 || /\[429 |too many requests|exceeded your current quota/i.test(String(err?.message ?? ''))
}

const MAX_NETWORK_RETRIES = 2

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function generateWithGemini({ buffer, mimeType, prompt, generationConfig, timeoutMs }) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel(
    { model: MODEL, ...(generationConfig ? { generationConfig } : {}) },
    timeoutMs ? { timeout: timeoutMs } : undefined,
  )
  const result = await model.generateContent([
    { inlineData: { data: buffer.toString('base64'), mimeType } },
    prompt,
  ])
  return result.response.text()
}

// Sends a document (PDF or image) plus a prompt to Gemini and returns the parsed JSON answer.
// Retries when the service is overloaded (503) and, at most twice, on network failures or timeouts.
// `generationConfig` and `timeoutMs` are passed to the model; `generate`, `delays` and `sleepFn` are injectable for tests.
export async function extractJsonFromDocument({
  buffer, mimeType, prompt, parseError, generationConfig, timeoutMs,
  generate = generateWithGemini, delays = RETRY_DELAYS_MS, sleepFn = sleep,
}) {
  let lastError
  let networkRetries = 0

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const text = (await generate({ buffer, mimeType, prompt, generationConfig, timeoutMs })).trim()
      const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
      try {
        return JSON.parse(clean)
      } catch {
        throw new Error(parseError)
      }
    } catch (err) {
      lastError = err
      if (attempt === delays.length) break
      if (isNetworkError(err) && !is503(err)) {
        if (networkRetries >= MAX_NETWORK_RETRIES) break
        networkRetries++
      } else if (!is503(err)) {
        break
      }
      await sleepFn(delays[attempt])
    }
  }

  if (is503(lastError)) {
    throw new Error('El servicio de extracción está ocupado. Intenta de nuevo en unos segundos.')
  }
  if (isQuotaError(lastError)) {
    throw new Error('El servicio de lectura alcanzó su límite de uso. Intenta de nuevo en un minuto.')
  }
  if (isNetworkError(lastError)) {
    throw new Error('No se pudo conectar con el servicio de lectura. Intenta de nuevo en unos segundos.')
  }
  throw lastError
}
