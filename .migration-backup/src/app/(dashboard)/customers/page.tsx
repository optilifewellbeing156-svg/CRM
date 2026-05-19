'use client'
import { useState, useEffect, useCallback } from 'react'
import { Pencil, Trash2, Plus, History } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { SlideOver } from '@/components/ui/SlideOver'
import { Modal } from '@/components/ui/Modal'
import { CustomerForm } from '@/components/features/customers/CustomerForm'
import type { Customer } from '@/types'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [slideOpen, setSlideOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [canManage, setCanManage] = useState(false)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/customers')
    setCustomers(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (d) setCanManage(d.role === 'ADMIN' || d.permissions?.includes('manage-customers'))
    })
  }, [])

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? '').includes(search) ||
    (c.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  async function openHistory(c: Customer) {
    setHistoryCustomer(c)
    setHistoryLoading(true)
    const res = await fetch(`/api/customers/${c.id}/orders`)
    setHistory(await res.json())
    setHistoryLoading(false)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await fetch(`/api/customers/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleteTarget(null)
    setDeleting(false)
    fetchCustomers()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        {canManage && (
          <Button onClick={() => { setEditing(undefined); setSlideOpen(true) }} className="flex items-center gap-2">
            <Plus size={16} /> Add Customer
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b">
          <input
            className="w-full max-w-xs px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Search customers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">No customers found. Add your first customer.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
              <tr>
                {['Name', 'Phone', 'Email', 'Address', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-gray-500">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.address ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openHistory(c)} className="text-gray-400 hover:text-primary" title="Order history">
                        <History size={15} />
                      </button>
                      {canManage && (
                        <>
                          <button onClick={() => { setEditing(c); setSlideOpen(true) }} className="text-gray-400 hover:text-primary">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => setDeleteTarget(c)} className="text-gray-400 hover:text-red-500">
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SlideOver open={slideOpen} title={editing ? 'Edit Customer' : 'Add Customer'} onClose={() => setSlideOpen(false)}>
        <CustomerForm initial={editing} onSuccess={() => { setSlideOpen(false); fetchCustomers() }} />
      </SlideOver>

      <SlideOver open={!!historyCustomer} onClose={() => setHistoryCustomer(null)} title={`${historyCustomer?.name} — Order History`}>
        {historyLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">No orders yet.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">{history.length} order{history.length !== 1 ? 's' : ''} total</p>
            {history.map((o: any) => (
              <div key={o.id} className="border border-gray-200 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-gray-500">#{o.id.slice(0,8).toUpperCase()}</span>
                  <span className="text-sm font-semibold text-primary">£{Number(o.totalAmount).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    o.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                    o.status === 'PROCESSING' ? 'bg-yellow-100 text-yellow-700' :
                    o.status === 'CANCELLED' || o.status === 'REFUNDED' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>{o.status ?? 'PROCESSING'}</span>
                  <span className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleDateString('en-GB')}</span>
                </div>
                <ul className="text-xs text-gray-500 space-y-0.5 pt-1 border-t border-gray-100">
                  {o.items.map((item: any) => (
                    <li key={item.id} className="flex justify-between">
                      <span>{item.product?.name}</span>
                      <span>×{item.quantity} — £{(Number(item.price) * item.quantity).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </SlideOver>

      <Modal open={!!deleteTarget} title="Delete Customer" onClose={() => setDeleteTarget(null)}>
        <p className="text-sm text-gray-600 mb-6">Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.</p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
