'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Eye, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import type { Order } from '@/types'

const STATUS_BADGE: Record<string, string> = {
  DELIVERED: 'bg-green-100 text-green-700',
  PROCESSING: 'bg-yellow-100 text-yellow-700',
  PROCESSED: 'bg-gray-100 text-gray-700',
  CANCELLED: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-red-100 text-red-700',
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [canCreate, setCanCreate] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [canDelete, setCanDelete] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/orders')
    setOrders(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (!d) return
      const admin = d.role === 'ADMIN'
      setIsAdmin(admin)
      setCanCreate(admin || d.permissions?.includes('create-orders'))
      setCanEdit(admin || d.permissions?.includes('edit-orders'))
      setCanDelete(admin || d.permissions?.includes('delete-orders'))
    })
  }, [])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await fetch(`/api/orders/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleting(false)
    setDeleteTarget(null)
    fetchOrders()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        {canCreate && (
          <Link href="/orders/new">
            <Button className="flex items-center gap-2"><Plus size={16} /> New Order</Button>
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : orders.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">No orders yet. Create your first invoice.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
              <tr>
                {['Invoice #', 'Customer', 'Total', 'Status', 'Payment', 'Date', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8).toUpperCase()}</td>
                  <td className="px-4 py-3 font-medium">{o.customer?.name}</td>
                  <td className="px-4 py-3">£{Number(o.totalAmount).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {o.status ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[o.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {o.status}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${o.isPaid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {o.isPaid ? 'PAID' : 'UNPAID'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link href={`/orders/${o.id}`} className="inline-flex items-center gap-1 text-primary hover:underline text-xs">
                        <Eye size={13} /> View
                      </Link>
                      {canEdit && (
                        <Link href={`/orders/${o.id}/edit`} className="p-1.5 rounded text-gray-500 hover:bg-gray-100 inline-flex">
                          <Pencil size={14} />
                        </Link>
                      )}
                      {canDelete && (
                        <button onClick={() => setDeleteTarget(o)} className="p-1.5 rounded text-red-500 hover:bg-red-50">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Invoice">
        <p className="text-sm text-gray-600 mb-6">
          Delete invoice <strong>#{deleteTarget?.id.slice(0, 8).toUpperCase()}</strong>? This cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
