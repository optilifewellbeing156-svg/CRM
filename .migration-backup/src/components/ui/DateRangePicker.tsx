'use client'
import { useState, useRef, useEffect } from 'react'
import { DayPicker, DateRange } from 'react-day-picker'
import { format } from 'date-fns'
import { CalendarDays, ChevronDown } from 'lucide-react'
import 'react-day-picker/style.css'

type Props = {
  range: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
}

export function DateRangePicker({ range, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const label = range?.from
    ? range.to
      ? `${format(range.from, 'dd MMM yyyy')} – ${format(range.to, 'dd MMM yyyy')}`
      : format(range.from, 'dd MMM yyyy')
    : 'Select date range'

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-700 hover:border-primary transition-colors shadow-sm"
      >
        <CalendarDays size={15} className="text-primary" />
        <span>{label}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl p-3 left-0">
          <DayPicker
            mode="range"
            selected={range}
            onSelect={onChange}
            numberOfMonths={2}
            captionLayout="dropdown"
            startMonth={new Date(2020, 0)}
            endMonth={new Date(new Date().getFullYear() + 1, 11)}
          />
        </div>
      )}
    </div>
  )
}
