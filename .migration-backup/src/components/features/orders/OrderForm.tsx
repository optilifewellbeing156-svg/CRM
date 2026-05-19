'use client'
import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { Customer, Product } from '@/types'

type LineItem = { productId: string; quantity: number; price: string }

export function OrderForm() {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [users, setUsers] = useState<{ id: string; username: string }[]>([])
  const [customerId, setCustomerId] = useState('')
  const [createdById, setCreatedById] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [isPaid, setIsPaid] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [items, setItems] = useState<LineItem[]>([{ productId: '', quantity: 1, price: '' }])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/customers').then(r => r.json()),
      fetch('/api/products').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([c, p, u]) => { setCustomers(c); setProducts(p); setUsers(u) })
  }, [])

  function addLine() {
    setItems(prev => [...prev, { productId: '', quantity: 1, price: '' }])
  }
  function removeLine(i: number) {
    setItems(prev => prev.filter((_, idx) => idx !== i))
  }
  function updateLine(i: number, field: keyof LineItem, value: string | number) {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item
      const updated = { ...item, [field]: value }
      // Auto-fill price when product changes
      if (field === 'productId') {
        const product = products.find(p => p.id === value)
        updated.price = product ? String(Number(product.sellingPrice)) : ''
      }
      return updated
    }))
  }

  const total = items.reduce((sum, item) => {
    const price = Number(item.price) || 0
    return sum + price * item.quantity
  }, 0)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!customerId) { setError('Please select a customer'); return }
    if (items.some(i => !i.productId)) { setError('Please select a product for each line'); return }
    if (items.some(i => i.price === '' || Number(i.price) < 0)) { setError('Please enter a price for each product (use 0 for free items)'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          items: items.map(i => ({ productId: i.productId, quantity: i.quantity, price: Number(i.price) })),
          createdById: createdById || null,
          invoiceDate,
          isPaid,
          paymentMethod: paymentMethod || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Failed to create order')
      else router.push(`/orders/${data.id}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
        <select value={customerId} onChange={e => setCustomerId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30" required>
          <option value="">Select a customer...</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Created By</label>
        <select value={createdById} onChange={e => setCreatedById(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30">
          <option value="">Select user...</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
        <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30" required />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30">
          <option value="">Select payment method...</option>
          <option value="Cash">Cash</option>
          <option value="Card">Card</option>
          <option value="Bank Transfer">Bank Transfer</option>
          <option value="UPI / Online">UPI / Online</option>
          <option value="Cheque">Cheque</option>
        </select>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setIsPaid(p => !p)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isPaid ? 'bg-primary' : 'bg-gray-300'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isPaid ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
        <span className="text-sm font-medium">
          {isPaid ? <span className="text-green-600">Paid</span> : <span className="text-gray-500">Unpaid</span>}
        </span>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">Products</label>
          <span className="text-xs text-gray-400">Price auto-fills from product — edit if needed</span>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_80px_110px_32px] gap-2 mb-1 px-1">
          <span className="text-xs text-gray-500">Product</span>
          <span className="text-xs text-gray-500 text-center">Qty</span>
          <span className="text-xs text-gray-500 text-center">Unit Price (£)</span>
          <span />
        </div>

        <div className="space-y-2">
          {items.map((item, i) => {
            const lineTotal = (Number(item.price) || 0) * item.quantity
            return (
              <div key={i} className="grid grid-cols-[1fr_80px_110px_32px] gap-2 items-center">
                <select value={item.productId} onChange={e => updateLine(i, 'productId', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">Select product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Stock: {p.stockQuantity})</option>
                  ))}
                </select>

                <input type="number" min={1} value={item.quantity}
                  onChange={e => updateLine(i, 'quantity', Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-center outline-none focus:ring-2 focus:ring-primary/30" />

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                  <input type="number" min={0} step="0.01" value={item.price}
                    onChange={e => updateLine(i, 'price', e.target.value)}
                    placeholder="0.00"
                    className={`w-full pl-7 pr-2 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30 ${
                      item.price === '0' || item.price === '0.00' ? 'border-green-400 bg-green-50 text-green-700 font-medium' : 'border-gray-300'
                    }`} />
                  {(item.price === '0' || item.price === '0.00') && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded">FREE</span>
                  )}
                </div>

                <button type="button" onClick={() => removeLine(i)}
                  className={`text-gray-400 hover:text-red-500 ${items.length === 1 ? 'invisible' : ''}`}>
                  <Trash2 size={15} />
                </button>
              </div>
            )
          })}
        </div>

        {/* Line totals summary when multiple lines */}
        {items.length > 1 && (
          <div className="mt-2 space-y-0.5">
            {items.map((item, i) => {
              const product = products.find(p => p.id === item.productId)
              const lineTotal = (Number(item.price) || 0) * item.quantity
              if (!product) return null
              return (
                <div key={i} className="flex justify-between text-xs text-gray-500 px-1">
                  <span>{product.name} × {item.quantity}</span>
                  <span>£{lineTotal.toFixed(2)}</span>
                </div>
              )
            })}
          </div>
        )}

        <button type="button" onClick={addLine} className="mt-3 flex items-center gap-1 text-sm text-primary hover:underline">
          <Plus size={14} /> Add product
        </button>
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <span className="text-lg font-semibold">Total: £{total.toFixed(2)}</span>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={() => router.push('/orders')}>Cancel</Button>
          <Button type="submit" loading={loading}>Create Invoice</Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  )
}
