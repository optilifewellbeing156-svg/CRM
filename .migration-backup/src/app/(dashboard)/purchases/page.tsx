'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, PackagePlus, X, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { SlideOver } from '@/components/ui/SlideOver'
import { Modal } from '@/components/ui/Modal'

type Product = { id: string; name: string; sku: string }
type Purchase = {
  id: string
  productId: string
  product: Product
  quantity: number
  unitCost: string | number
  totalCost: string | number
  vatEnabled: boolean
  vatRate: string | number
  vatAmount: string | number
  reference: string | null
  batchRef: string | null
  createdAt: string
}

type LineItem = { id: number; productId: string; quantity: string; unitCost: string }

const VAT_RATES = [5, 20]
let lineIdSeq = 1
function emptyLine(): LineItem {
  return { id: lineIdSeq++, productId: '', quantity: '', unitCost: '' }
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  // Add form
  const [addOpen, setAddOpen] = useState(false)
  const [lines, setLines] = useState<LineItem[]>([emptyLine()])
  const [addRef, setAddRef] = useState('')
  const [addBatch, setAddBatch] = useState('')
  const [addVatEnabled, setAddVatEnabled] = useState(false)
  const [addVatRate, setAddVatRate] = useState<number>(20)
  const [addError, setAddError] = useState('')
  const [saving, setSaving] = useState(false)

  // Edit form
  const [editTarget, setEditTarget] = useState<Purchase | null>(null)
  const [editProductId, setEditProductId] = useState('')
  const [editQty, setEditQty] = useState('')
  const [editCost, setEditCost] = useState('')
  const [editRef, setEditRef] = useState('')
  const [editBatch, setEditBatch] = useState('')
  const [editVatEnabled, setEditVatEnabled] = useState(false)
  const [editVatRate, setEditVatRate] = useState<number>(20)
  const [editError, setEditError] = useState('')
  const [updating, setUpdating] = useState(false)

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Purchase | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [pRes, prRes, meRes] = await Promise.all([
      fetch('/api/purchases'),
      fetch('/api/products'),
      fetch('/api/auth/me'),
    ])
    setPurchases(await pRes.json())
    setProducts(await prRes.json())
    const me = meRes.ok ? await meRes.json() : null
    if (me) setIsAdmin(me.role === 'ADMIN' || me.permissions?.includes('add-purchases'))
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Add ──
  function openAdd() {
    setLines([emptyLine()])
    setAddRef(''); setAddBatch(''); setAddVatEnabled(false); setAddVatRate(20); setAddError('')
    setAddOpen(true)
  }
  function updateLine(id: number, field: keyof LineItem, value: string) {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l))
  }

  const lineCalcs = lines.map(l => {
    const q = Number(l.quantity) || 0, c = Number(l.unitCost) || 0
    const sub = q * c
    const vat = addVatEnabled ? sub * (addVatRate / 100) : 0
    return { sub, vat, total: sub + vat }
  })
  const grandSub = lineCalcs.reduce((s, l) => s + l.sub, 0)
  const grandVat = lineCalcs.reduce((s, l) => s + l.vat, 0)
  const grandTotal = grandSub + grandVat

  async function handleSave() {
    const valid = lines.filter(l => l.productId && Number(l.quantity) > 0 && Number(l.unitCost) > 0)
    if (!valid.length) { setAddError('Add at least one product with quantity and cost'); return }
    if (lines.find(l => l.productId && (!Number(l.quantity) || !Number(l.unitCost)))) {
      setAddError('All added products need a quantity and unit cost'); return
    }
    setAddError(''); setSaving(true)
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: valid.map(l => ({ productId: l.productId, quantity: Number(l.quantity), unitCost: Number(l.unitCost) })),
          reference: addRef, batchRef: addBatch, vatEnabled: addVatEnabled, vatRate: addVatRate,
        }),
      })
      if (!res.ok) { const e = await res.json(); setAddError(e.error ?? 'Failed to save'); return }
      setAddOpen(false); fetchAll()
    } finally { setSaving(false) }
  }

  // ── Edit ──
  function openEdit(p: Purchase) {
    setEditTarget(p)
    setEditProductId(p.productId)
    setEditQty(String(p.quantity))
    setEditCost(String(Number(p.unitCost)))
    setEditRef(p.reference ?? '')
    setEditBatch(p.batchRef ?? '')
    setEditVatEnabled(p.vatEnabled)
    setEditVatRate(Number(p.vatRate) || 20)
    setEditError('')
  }

  const editSubTotal = (Number(editQty) || 0) * (Number(editCost) || 0)
  const editVatAmt = editVatEnabled ? editSubTotal * (editVatRate / 100) : 0
  const editTotal = editSubTotal + editVatAmt

  async function handleUpdate() {
    if (!editTarget) return
    if (!editProductId) { setEditError('Select a product'); return }
    if (!Number(editQty) || Number(editQty) <= 0) { setEditError('Enter a valid quantity'); return }
    if (!Number(editCost) || Number(editCost) <= 0) { setEditError('Enter a valid unit cost'); return }
    setEditError(''); setUpdating(true)
    try {
      const res = await fetch(`/api/purchases/${editTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: editProductId,
          quantity: Number(editQty),
          unitCost: Number(editCost),
          reference: editRef,
          batchRef: editBatch,
          vatEnabled: editVatEnabled,
          vatRate: editVatRate,
        }),
      })
      if (!res.ok) { const e = await res.json(); setEditError(e.error ?? 'Failed to update'); return }
      setEditTarget(null); fetchAll()
    } finally { setUpdating(false) }
  }

  // ── Delete ──
  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await fetch(`/api/purchases/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleteTarget(null); setDeleting(false); fetchAll()
  }

  const totalSpend = purchases.reduce((s, p) => s + Number(p.totalCost), 0)
  const totalVat = purchases.reduce((s, p) => s + Number(p.vatAmount), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchases</h1>
          <p className="text-sm text-gray-500 mt-0.5">Record stock purchases — stock is updated automatically</p>
        </div>
        {isAdmin && (
          <Button onClick={openAdd} className="flex items-center gap-2">
            <Plus size={16} /> Add Purchase
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Records</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{purchases.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Spend (inc. VAT)</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">£{totalSpend.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total VAT Paid</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">£{totalVat.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : purchases.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400 gap-3">
            <PackagePlus size={40} className="text-gray-300" />
            <p className="text-sm">No purchases yet. Add your first purchase.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Product</th>
                <th className="px-4 py-3 text-left font-medium">SKU</th>
                <th className="px-4 py-3 text-center font-medium">Qty</th>
                <th className="px-4 py-3 text-right font-medium">Unit Cost</th>
                <th className="px-4 py-3 text-right font-medium">Sub-total</th>
                <th className="px-4 py-3 text-right font-medium">VAT</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-left font-medium">Ref</th>
                <th className="px-4 py-3 text-left font-medium">Batch</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                {isAdmin && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {purchases.map(p => {
                const sub = Number(p.unitCost) * p.quantity
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{p.product.name}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.product.sku}</td>
                    <td className="px-4 py-3 text-center">{p.quantity}</td>
                    <td className="px-4 py-3 text-right">£{Number(p.unitCost).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">£{sub.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      {p.vatEnabled
                        ? <span className="text-blue-600">£{Number(p.vatAmount).toFixed(2)} <span className="text-xs text-gray-400">({Number(p.vatRate)}%)</span></span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">£{Number(p.totalCost).toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-500">{p.reference ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{p.batchRef ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(p.createdAt).toLocaleDateString('en-GB')}</td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-primary" title="Edit">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => setDeleteTarget(p)} className="text-gray-400 hover:text-red-500" title="Delete">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Add Purchase SlideOver ── */}
      <SlideOver open={addOpen} title="Add Purchase" onClose={() => setAddOpen(false)}>
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Products <span className="text-red-500">*</span></label>
              <button type="button" onClick={() => setLines(prev => [...prev, emptyLine()])}
                className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                <Plus size={13} /> Add product
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((line, idx) => {
                const calc = lineCalcs[idx]
                return (
                  <div key={line.id} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500">Item {idx + 1}</span>
                      {lines.length > 1 && (
                        <button type="button" onClick={() => setLines(prev => prev.filter(l => l.id !== line.id))} className="text-gray-400 hover:text-red-500">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <select value={line.productId} onChange={e => updateLine(line.id, 'productId', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                      <option value="">Select a product…</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} — {p.sku}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Quantity</label>
                        <input type="number" min="1" value={line.quantity} onChange={e => updateLine(line.id, 'quantity', e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-white" placeholder="0" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Unit Cost (£)</label>
                        <input type="number" min="0" step="0.01" value={line.unitCost} onChange={e => updateLine(line.id, 'unitCost', e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-white" placeholder="0.00" />
                      </div>
                    </div>
                    {calc.sub > 0 && (
                      <div className="text-xs text-gray-500 flex justify-between pt-1 border-t border-gray-200">
                        <span>Line total{addVatEnabled ? ` (inc. ${addVatRate}% VAT)` : ''}</span>
                        <span className="font-medium text-gray-700">£{calc.total.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
              <input type="text" value={addRef} onChange={e => setAddRef(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30" placeholder="PO-001" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch Ref</label>
              <input type="text" value={addBatch} onChange={e => setAddBatch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30" placeholder="BATCH-001" />
            </div>
          </div>

          <VatSection vatEnabled={addVatEnabled} vatRate={addVatRate} onToggle={() => setAddVatEnabled(v => !v)} onRateChange={setAddVatRate} />

          {grandSub > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Order Summary</p>
              <div className="flex justify-between text-gray-600">
                <span>Sub-total ({lines.filter(l => l.productId).length} item{lines.filter(l => l.productId).length !== 1 ? 's' : ''})</span>
                <span>£{grandSub.toFixed(2)}</span>
              </div>
              {addVatEnabled && <div className="flex justify-between text-blue-600"><span>VAT ({addVatRate}%)</span><span>£{grandVat.toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 text-base">
                <span>Total</span><span>£{grandTotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          {addError && <p className="text-sm text-red-500">{addError}</p>}
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button className="flex-1" loading={saving} onClick={handleSave}>Save Purchase</Button>
          </div>
        </div>
      </SlideOver>

      {/* ── Edit Purchase SlideOver ── */}
      <SlideOver open={!!editTarget} title="Edit Purchase" onClose={() => setEditTarget(null)}>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product <span className="text-red-500">*</span></label>
            <select value={editProductId} onChange={e => setEditProductId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">Select a product…</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} — {p.sku}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity <span className="text-red-500">*</span></label>
              <input type="number" min="1" value={editQty} onChange={e => setEditQty(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Cost (£) <span className="text-red-500">*</span></label>
              <input type="number" min="0" step="0.01" value={editCost} onChange={e => setEditCost(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30" placeholder="0.00" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
              <input type="text" value={editRef} onChange={e => setEditRef(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30" placeholder="PO-001" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch Ref</label>
              <input type="text" value={editBatch} onChange={e => setEditBatch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30" placeholder="BATCH-001" />
            </div>
          </div>

          <VatSection vatEnabled={editVatEnabled} vatRate={editVatRate} onToggle={() => setEditVatEnabled(v => !v)} onRateChange={setEditVatRate} />

          {editSubTotal > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600"><span>Sub-total</span><span>£{editSubTotal.toFixed(2)}</span></div>
              {editVatEnabled && <div className="flex justify-between text-blue-600"><span>VAT ({editVatRate}%)</span><span>£{editVatAmt.toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 text-base">
                <span>Total</span><span>£{editTotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          {editError && <p className="text-sm text-red-500">{editError}</p>}
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button className="flex-1" loading={updating} onClick={handleUpdate}>Save Changes</Button>
          </div>
        </div>
      </SlideOver>

      {/* Delete Confirm */}
      <Modal open={!!deleteTarget} title="Delete Purchase" onClose={() => setDeleteTarget(null)}>
        <p className="text-sm text-gray-600 mb-2">
          Delete purchase of <strong>{deleteTarget?.quantity} × {deleteTarget?.product.name}</strong>?
        </p>
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-6">
          ⚠️ This will also deduct {deleteTarget?.quantity} unit{(deleteTarget?.quantity ?? 0) > 1 ? 's' : ''} from stock.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}

// Shared VAT section component
function VatSection({ vatEnabled, vatRate, onToggle, onRateChange }: {
  vatEnabled: boolean; vatRate: number
  onToggle: () => void; onRateChange: (r: number) => void
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">Add VAT</p>
          <p className="text-xs text-gray-400">Applies to this purchase</p>
        </div>
        <button type="button" onClick={onToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${vatEnabled ? 'bg-primary' : 'bg-gray-200'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${vatEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
      {vatEnabled && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">VAT Rate</label>
          <div className="flex gap-2">
            {VAT_RATES.map(r => (
              <button key={r} type="button" onClick={() => onRateChange(r)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  vatRate === r ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-300 hover:border-primary'
                }`}>
                {r}%
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
