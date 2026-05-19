'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Download, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import type { Order } from '@/types'

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then(r => r.json())
      .then(data => { setOrder(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => { if (d?.role === 'ADMIN') setIsAdmin(true) })
  }, [])

  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await fetch(`/api/orders/${id}/pdf`)
      if (!res.ok) throw new Error(`PDF generation failed: ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice-${id?.slice(0, 8)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
    } finally {
      setDownloading(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/orders/${id}`, { method: 'DELETE' })
    setDeleting(false)
    setShowDeleteModal(false)
    router.push('/orders')
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (!order) return <p className="text-center py-20 text-gray-400">Order not found.</p>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <Link href="/orders" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft size={14} /> Back to Orders
        </Link>
        <div className="flex items-center gap-2">
          <Button onClick={handleDownload} loading={downloading} className="flex items-center gap-2">
            <Download size={14} /> Download PDF
          </Button>
          {isAdmin && (
            <Button variant="danger" onClick={() => setShowDeleteModal(true)} className="flex items-center gap-2">
              <Trash2 size={14} /> Delete
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-primary">OptiLifeWellbeing</h1>
            <p className="text-sm text-gray-500 mt-1">Invoice #{id?.slice(0, 8).toUpperCase()}</p>
            <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString('en-GB', { dateStyle: 'long' })}</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs uppercase text-gray-400 mb-1">Bill To</p>
          <p className="font-medium">{order.customer?.name}</p>
        </div>

        <div className="mb-6 flex items-center gap-6">
          <div>
            <p className="text-xs uppercase text-gray-400 mb-1">Payment Method</p>
            <p className="font-medium">{order.paymentMethod || '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-400 mb-1">Payment Status</p>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${order.isPaid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
              {order.isPaid ? 'PAID' : 'UNPAID'}
            </span>
          </div>
        </div>

        <table className="w-full text-sm mb-6">
          <thead className="bg-sidebar text-white text-xs">
            <tr>
              <th className="px-4 py-2 text-left">Product</th>
              <th className="px-4 py-2 text-center">Qty</th>
              <th className="px-4 py-2 text-right">Unit Price</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {order.items?.map(item => (
              <tr key={item.id}>
                <td className="px-4 py-3">{item.product?.name}</td>
                <td className="px-4 py-3 text-center">{item.quantity}</td>
                <td className="px-4 py-3 text-right">&#8377;{Number(item.price).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">&#8377;{(Number(item.price) * item.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="text-right">
            <span className="text-xs text-gray-400 uppercase">Total Amount</span>
            <p className="text-2xl font-bold text-primary">&#8377;{Number(order.totalAmount).toFixed(2)}</p>
          </div>
        </div>
      </div>

      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Invoice">
        <p className="text-sm text-gray-600 mb-6">
          Delete invoice <strong>#{id?.slice(0, 8).toUpperCase()}</strong>? This cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
