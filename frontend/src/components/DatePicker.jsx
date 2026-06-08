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

const INPUT_CLS = 'bg-[#161616] border border-[rgba(201,168,76,0.18)] text-[#F0EDE6] rounded-lg px-3 py-2 text-sm w-full cursor-pointer focus:outline-none focus:border-[rgba(201,168,76,0.6)] placeholder:text-[#888580] select-none'

export function DatePicker({ value, onChange, placeholder = 'MM/DD/YYYY' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

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

  return (
    <div ref={ref} className="relative">
      <input
        readOnly
        value={formatDisplay(value)}
        placeholder={placeholder}
        onClick={() => setOpen(v => !v)}
        className={INPUT_CLS}
        onChange={() => {}}
      />
      {open && (
        <div className="absolute z-50 top-full mt-1 bg-[#1E1E1E] border border-[rgba(201,168,76,0.18)] rounded-xl shadow-2xl p-3 fleet-dp">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={selected}
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
