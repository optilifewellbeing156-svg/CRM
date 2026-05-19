import { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <input
        {...props}
        className={`px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${error ? 'border-red-400' : 'border-gray-300'} ${className}`}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
