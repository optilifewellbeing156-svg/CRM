'use client'
import { useState, FormEvent } from 'react'
import { Bell } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { Product } from '@/types'

interface ProductFormProps {
  initial?: Product
  onSuccess: () => void
}

export function ProductForm({ initial, onSuccess }: ProductFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [sku, setSku] = useState(initial?.sku ?? '')
  const [costPrice, setCostPrice] = useState(initial?.costPrice ?? '')
  const [sellingPrice, setSellingPrice] = useState(initial?.sellingPrice ?? '')
  const [stockQuantity, setStockQuantity] = useState(String(initial?.stockQuantity ?? ''))
  const [lowStockThreshold, setLowStockThreshold] = useState(String(initial?.lowStockThreshold ?? '10'))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const url = initial ? `/api/products/${initial.id}` : '/api/products'
      const method = initial ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          sku,
          costPrice: Number(costPrice),
          sellingPrice: Number(sellingPrice),
          stockQuantity: Number(stockQuantity),
          lowStockThreshold: Number(lowStockThreshold) || 10,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to save product')
      } else {
        onSuccess()
      }
    } finally {
      setLoading(false)
    }
  }

  const stock = Number(stockQuantity) || 0
  const threshold = Number(lowStockThreshold) || 10
  const isLow = stock > 0 && stock <= threshold

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Product Name" value={name} onChange={e => setName(e.target.value)} required />
      <Input label="SKU" value={sku} onChange={e => setSku(e.target.value)} required />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Cost Price (£)" type="number" step="0.01" value={costPrice} onChange={e => setCostPrice(e.target.value)} required />
        <Input label="Selling Price (£)" type="number" step="0.01" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} required />
      </div>
      <Input label="Stock Quantity" type="number" value={stockQuantity} onChange={e => setStockQuantity(e.target.value)} required />

      {/* Low Stock Threshold */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
          <Bell size={13} className="text-amber-500" />
          Low Stock Alert Threshold
        </label>
        <input
          type="number"
          min="0"
          value={lowStockThreshold}
          onChange={e => setLowStockThreshold(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="10"
        />
        <p className="text-xs text-gray-400 mt-1">
          You'll see a low stock warning when quantity drops to or below this number.
        </p>
        {isLow && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2 flex items-center gap-1.5">
            <Bell size={12} /> Current stock ({stock}) is at or below the alert threshold ({threshold}).
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" loading={loading} className="w-full">
        {initial ? 'Update Product' : 'Add Product'}
      </Button>
    </form>
  )
}
