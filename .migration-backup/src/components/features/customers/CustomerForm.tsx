'use client'
import { useState, FormEvent } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { Customer } from '@/types'

interface CustomerFormProps {
  initial?: Customer
  onSuccess: () => void
}

export function CustomerForm({ initial, onSuccess }: CustomerFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const url = initial ? `/api/customers/${initial.id}` : '/api/customers'
      const method = initial ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, address }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Failed to save')
      else onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Full Name" value={name} onChange={e => setName(e.target.value)} required />
      <Input label="Phone" type="tel" value={phone ?? ''} onChange={e => setPhone(e.target.value)} />
      <Input label="Email" type="email" value={email ?? ''} onChange={e => setEmail(e.target.value)} />
      <Input label="Address" value={address ?? ''} onChange={e => setAddress(e.target.value)} />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" loading={loading} className="w-full">
        {initial ? 'Update Customer' : 'Add Customer'}
      </Button>
    </form>
  )
}
