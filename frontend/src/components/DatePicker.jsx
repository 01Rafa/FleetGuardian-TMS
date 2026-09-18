import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import './DatePicker.css'

// Parse "YYYY-MM-DD" into a local Date — avoids UTC timezone shift
function parseLocalDate(iso) {
  if (!iso) return undefined
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

function toIso(date) {
  if (!date) return ''
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

// "YYYY-MM-DD" → "MM/DD/YYYY"
function formatDisplay(iso) {
  if (!iso) return ''
  const parts = iso.split('-')
  if (parts.length !== 3) return ''
  return `${parts[1]}/${parts[2]}/${parts[0]}`
}

// Digits-only string → masked "MM/DD/YYYY", inserting slashes as the user types
function maskDate(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return digits
}

// Complete "MM/DD/YYYY" → "YYYY-MM-DD", or null if not a valid calendar date
function parseTypedDate(text) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text)
  if (!match) return null
  const [, mm, dd, yyyy] = match
  const month = Number(mm)
  const day = Number(dd)
  const year = Number(yyyy)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return toIso(date)
}

const INPUT_CLS = 'bg-[#161616] border border-[rgba(201,168,76,0.18)] text-[#F0EDE6] rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-[rgba(201,168,76,0.6)] placeholder:text-[#888580]'

export function DatePicker({ value, onChange, placeholder = 'MM/DD/YYYY' }) {
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [text, setText] = useState(formatDisplay(value))
  const [month, setMonth] = useState(() => parseLocalDate(value))
  const ref = useRef(null)

  useEffect(() => {
    if (!focused) setText(formatDisplay(value))
  }, [value, focused])

  useEffect(() => {
    const parsed = parseLocalDate(value)
    if (parsed) setMonth(parsed)
  }, [value])

  useEffect(() => {
    if (!open) return
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onEsc(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const selected = parseLocalDate(value)

  function handleSelect(date) {
    onChange(toIso(date ?? null))
    if (date) setOpen(false)
  }

  function handleTextChange(e) {
    const masked = maskDate(e.target.value)
    setText(masked)
    const iso = parseTypedDate(masked)
    if (iso) onChange(iso)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.currentTarget.blur()
      setOpen(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <input
        inputMode="numeric"
        value={text}
        placeholder={placeholder}
        onFocus={() => { setFocused(true); setOpen(true) }}
        onBlur={() => setFocused(false)}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        className={INPUT_CLS}
      />
      {open && (
        <div className="absolute z-50 top-full mt-1 bg-[#1E1E1E] border border-[rgba(201,168,76,0.18)] rounded-xl shadow-2xl p-3 fleet-dp">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            month={month}
            onMonthChange={setMonth}
          />
        </div>
      )}
    </div>
  )
}

export function DateTimePicker({ value, onChange }) {
  const datePart = value ? value.split('T')[0] : ''
  const timePart = value ? (value.split('T')[1] ?? '').slice(0, 5) : ''

  function handleDateChange(newDateIso) {
    if (!newDateIso) { onChange(''); return }
    onChange(`${newDateIso}T${timePart || '00:00'}`)
  }

  function handleTimeChange(e) {
    const newTime = e.target.value
    const date = datePart || toIso(new Date())
    onChange(newTime ? `${date}T${newTime}` : '')
  }

  return (
    <div className="flex gap-2">
      <div className="flex-1 min-w-0">
        <DatePicker value={datePart} onChange={handleDateChange} />
      </div>
      <input
        type="time"
        value={timePart}
        onChange={handleTimeChange}
        className="bg-[#161616] border border-[rgba(201,168,76,0.18)] text-[#F0EDE6] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[rgba(201,168,76,0.6)] w-[7.5rem] shrink-0"
      />
    </div>
  )
}
