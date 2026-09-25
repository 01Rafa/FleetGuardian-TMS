import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cdlApi } from '../api/cdl.api'
import { summarizeCdl } from '../utils/cdl'

const MAX_BYTES = 10 * 1024 * 1024

// Lets the user upload a driver's CDL; the values found are handed to onExtracted(data)
// so the parent can fill its form. Nothing is saved from here.
export function CdlUpload({ onExtracted }) {
  const { t } = useTranslation()
  const inputRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [summary, setSummary] = useState(null)

  const handleFile = async (file) => {
    if (!file) return
    setError(null)
    setSummary(null)
    if (file.size > MAX_BYTES) return setError(t('cdl.tooBig'))
    setLoading(true)
    try {
      const data = await cdlApi.extract(file)
      onExtracted(data)
      setSummary(summarizeCdl(data))
    } catch (err) {
      setError(err?.response?.data?.error ?? t('cdl.error'))
    } finally {
      setLoading(false)
    }
  }

  const names = (keys) => keys.map(k => t(`cdl.fields.${k}`)).join(', ')

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-dashed border-gold/40 bg-gold/5 p-3 flex items-center gap-3 flex-wrap">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = '' }}
        />
        <button
          type="button"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
          className="bg-gold/20 text-gold border border-gold/30 rounded-lg text-sm px-3 py-1.5 hover:bg-gold/30 disabled:opacity-50 transition-colors"
        >
          {loading ? t('cdl.reading') : t('cdl.upload')}
        </button>
        <span className="text-text-muted text-xs">{t('cdl.hint')}</span>
      </div>

      {error && <p className="text-danger text-sm">{error}</p>}

      {summary && (
        <div className="text-xs space-y-0.5">
          {summary.filled.length > 0 && (
            <p className="text-success">✓ {t('cdl.filled')}: {names(summary.filled)}. {t('cdl.review')}</p>
          )}
          {summary.filled.length === 0 && <p className="text-yellow-400">{t('cdl.nothingFound')}</p>}
          {summary.missing.length > 0 && summary.filled.length > 0 && (
            <p className="text-text-muted">{t('cdl.missing')}: {names(summary.missing)}</p>
          )}
        </div>
      )}
    </div>
  )
}
