import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { brokersApi } from '../api/brokers.api'

export default function BrokerAutocomplete({ value, onChange, placeholder = 'Broker', className }) {
  const { t } = useTranslation()
  const [inputText, setInputText] = useState(value?.nombre ?? '')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    setInputText(value?.nombre ?? '')
  }, [value?.id])

  const search = useCallback((q) => {
    clearTimeout(debounceRef.current)
    if (!q.trim()) { setSuggestions([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const results = await brokersApi.search(q)
        setSuggestions(results)
        setOpen(true)
      } catch {
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 250)
  }, [])

  const handleInput = (e) => {
    const val = e.target.value
    setInputText(val)
    if (!val) { onChange(null); setSuggestions([]); setOpen(false); return }
    search(val)
  }

  const selectBroker = (broker) => {
    onChange(broker)
    setInputText(broker.nombre)
    setOpen(false)
    setSuggestions([])
  }

  const handleCreate = async () => {
    const nombre = inputText.trim()
    if (!nombre) return
    try {
      const broker = await brokersApi.create(nombre)
      selectBroker(broker)
    } catch {}
  }

  const handleBlur = (e) => {
    if (containerRef.current?.contains(e.relatedTarget)) return
    setOpen(false)
    if (!inputText.trim()) {
      onChange(null)
    } else if (value && inputText !== value.nombre) {
      setInputText(value.nombre ?? '')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); setInputText(value?.nombre ?? '') }
  }

  const showCreate = inputText.trim() && !suggestions.some(s => s.nombre.toLowerCase() === inputText.trim().toLowerCase())

  return (
    <div ref={containerRef} className="relative" onBlur={handleBlur}>
      <input
        type="text"
        value={inputText}
        onChange={handleInput}
        onFocus={() => inputText && suggestions.length && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && (suggestions.length > 0 || showCreate) && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface border border-border-dim rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map(b => (
            <li
              key={b.id}
              onMouseDown={() => selectBroker(b)}
              className="px-3 py-2 text-sm text-text-primary hover:bg-surface-2 cursor-pointer"
            >
              {b.nombre}
            </li>
          ))}
          {showCreate && (
            <li
              onMouseDown={handleCreate}
              className="px-3 py-2 text-sm text-gold hover:bg-surface-2 cursor-pointer border-t border-border-dim"
            >
              {t('broker.create', { name: inputText.trim() })}
            </li>
          )}
        </ul>
      )}
      {loading && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">...</span>
      )}
    </div>
  )
}
