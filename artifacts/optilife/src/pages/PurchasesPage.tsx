import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { SlideOver } from "@/components/ui/SlideOver";
import { Modal } from "@/components/ui/Modal";
import { useMe } from "@/hooks/useMe";
import type { Purchase, Product } from "@/types";

type LineItem = { id: number; productId: string; quantity: string; unitCost: string };
const VAT_RATES = [5, 20];
let lineIdSeq = 1;
function emptyLine(): LineItem { return { id: lineIdSeq++, productId: "", quantity: "", unitCost: "" }; }

export default function PurchasesPage() {
  const me = useMe();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [addRef, setAddRef] = useState("");
  const [addBatch, setAddBatch] = useState("");
  const [addVatEnabled, setAddVatEnabled] = useState(false);
  const [addVatRate, setAddVatRate] = useState<number>(20);
  const [addError, setAddError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editTarget, setEditTarget] = useState<Purchase | null>(null);
  const [editProductId, setEditProductId] = useState("");
  const [editQty, setEditQty] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editRef, setEditRef] = useState("");
  const [editBatch, setEditBatch] = useState("");
  const [editVatEnabled, setEditVatEnabled] = useState(false);
  const [editVatRate, setEditVatRate] = useState<number>(20);
  const [editError, setEditError] = useState("");
  const [updating, setUpdating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Purchase | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isSuperAdmin = me?.role === "SUPER_ADMIN";
  const isAdmin = isSuperAdmin || me?.role === "ADMIN";
  const canAdd = isAdmin || me?.permissions?.includes("add-purchases");
  const canEdit = isAdmin || me?.permissions?.includes("edit-purchases");
  const canDelete = isAdmin || me?.permissions?.includes("delete-purchases");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [pRes, prRes] = await Promise.all([
      fetch("/api/purchases", { credentials: "include" }),
      fetch("/api/products", { credentials: "include" }),
    ]);
    setPurchases(await pRes.json());
    setProducts(await prRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function openAdd() {
    setLines([emptyLine()]);
    setAddRef(""); setAddBatch(""); setAddVatEnabled(false); setAddVatRate(20); setAddError("");
    setAddOpen(true);
  }
  function updateLine(id: number, field: keyof LineItem, value: string) {
    setLines((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l));
  }

  const lineCalcs = lines.map((l) => {
    const q = Number(l.quantity) || 0, c = Number(l.unitCost) || 0;
    const sub = q * c;
    const vat = addVatEnabled ? sub * (addVatRate / 100) : 0;
    return { sub, vat, total: sub + vat };
  });
  const grandTotal = lineCalcs.reduce((s, l) => s + l.total, 0);

  async function handleAdd() {
    if (lines.some((l) => !l.productId || !l.quantity || !l.unitCost)) {
      setAddError("Please fill in all product lines"); return;
    }
    setSaving(true);
    setAddError("");
    const res = await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitCost: l.unitCost })),
        reference: addRef || null,
        batchRef: addBatch || null,
        vatEnabled: addVatEnabled,
        vatRate: addVatRate,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setAddError(data.error ?? "Failed"); return; }
    setAddOpen(false);
    fetchAll();
  }

  function openEdit(p: Purchase) {
    setEditTarget(p);
    setEditProductId(p.productId);
    setEditQty(String(p.quantity));
    setEditCost(String(Number(p.unitCost)));
    setEditRef(p.reference ?? "");
    setEditBatch(p.batchRef ?? "");
    setEditVatEnabled(p.vatEnabled);
    setEditVatRate(Number(p.vatRate) || 20);
    setEditError("");
  }

  async function handleEdit() {
    if (!editTarget) return;
    setUpdating(true);
    setEditError("");
    const res = await fetch(`/api/purchases/${editTarget.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        productId: editProductId,
        quantity: editQty,
        unitCost: editCost,
        reference: editRef || null,
        batchRef: editBatch || null,
        vatEnabled: editVatEnabled,
        vatRate: editVatRate,
      }),
    });
    const data = await res.json();
    setUpdating(false);
    if (!res.ok) { setEditError(data.error ?? "Failed"); return; }
    setEditTarget(null);
    fetchAll();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/purchases/${deleteTarget.id}`, { method: "DELETE", credentials: "include" });
    setDeleting(false);
    setDeleteTarget(null);
    fetchAll();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Purchases</h1>
        {canAdd && (
          <Button onClick={openAdd} className="flex items-center gap-2">
            <Plus size={16} /> Add Purchase
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : purchases.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">No purchases yet.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
              <tr>
                {["Product", "Qty", "Unit Cost", "VAT", "Total", "Ref", "Date", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {purchases.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{p.product?.name}</td>
                  <td className="px-4 py-3">{p.quantity}</td>
                  <td className="px-4 py-3">£{Number(p.unitCost).toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {p.vatEnabled ? `${Number(p.vatRate)}% (£${Number(p.vatAmount).toFixed(2)})` : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium">£{Number(p.totalCost).toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-500">{p.reference ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(p.createdAt).toLocaleDateString("en-GB")}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      {canEdit && (
                        <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-primary">
                          <Pencil size={15} />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => setDeleteTarget(p)} className="text-gray-400 hover:text-red-500">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <SlideOver open={addOpen} title="Add Purchases" onClose={() => setAddOpen(false)}>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Products</label>
              <button onClick={() => setLines((prev) => [...prev, emptyLine()])} className="text-sm text-primary hover:underline flex items-center gap-1">
                <Plus size={14} /> Add line
              </button>
            </div>
            {lines.map((l, idx) => (
              <div key={l.id} className="grid grid-cols-12 gap-2 items-center mb-2">
                <div className="col-span-5">
                  <select value={l.productId} onChange={(e) => updateLine(l.id, "productId", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">Product...</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                </div>
                <div className="col-span-3">
                  <input type="number" placeholder="Qty" value={l.quantity} onChange={(e) => updateLine(l.id, "quantity", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div className="col-span-3">
                  <input type="number" step="0.01" placeholder="Cost £" value={l.unitCost} onChange={(e) => updateLine(l.id, "unitCost", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <button onClick={() => setLines((prev) => prev.filter((x) => x.id !== l.id))} disabled={lines.length === 1}
                  className="col-span-1 p-1 text-gray-400 hover:text-red-500 disabled:opacity-30">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Reference</label>
              <input value={addRef} onChange={(e) => setAddRef(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Optional" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Batch Ref</label>
              <input value={addBatch} onChange={(e) => setAddBatch(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Optional" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input type="checkbox" id="vatEnabled" checked={addVatEnabled} onChange={(e) => setAddVatEnabled(e.target.checked)} className="rounded" />
            <label htmlFor="vatEnabled" className="text-sm text-gray-700">Apply VAT</label>
            {addVatEnabled && (
              <select value={addVatRate} onChange={(e) => setAddVatRate(Number(e.target.value))} className="px-2 py-1 border border-gray-300 rounded text-sm">
                {VAT_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
              </select>
            )}
          </div>

          <div className="text-right text-sm font-semibold">Grand Total: £{grandTotal.toFixed(2)}</div>
          {addError && <p className="text-sm text-red-500">{addError}</p>}
          <Button onClick={handleAdd} loading={saving} className="w-full">Save Purchases</Button>
        </div>
      </SlideOver>

      <SlideOver open={!!editTarget} title="Edit Purchase" onClose={() => setEditTarget(null)}>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Product</label>
            <select value={editProductId} onChange={(e) => setEditProductId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="">Select...</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Quantity</label>
              <input type="number" value={editQty} onChange={(e) => setEditQty(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Unit Cost £</label>
              <input type="number" step="0.01" value={editCost} onChange={(e) => setEditCost(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Reference</label>
              <input value={editRef} onChange={(e) => setEditRef(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Batch Ref</label>
              <input value={editBatch} onChange={(e) => setEditBatch(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" checked={editVatEnabled} onChange={(e) => setEditVatEnabled(e.target.checked)} className="rounded" />
            <span className="text-sm text-gray-700">Apply VAT</span>
            {editVatEnabled && (
              <select value={editVatRate} onChange={(e) => setEditVatRate(Number(e.target.value))} className="px-2 py-1 border border-gray-300 rounded text-sm">
                {VAT_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
              </select>
            )}
          </div>
          {editError && <p className="text-sm text-red-500">{editError}</p>}
          <Button onClick={handleEdit} loading={updating} className="w-full">Update Purchase</Button>
        </div>
      </SlideOver>

      <Modal open={!!deleteTarget} title="Delete Purchase" onClose={() => setDeleteTarget(null)}>
        <p className="text-sm text-gray-600 mb-4">Delete this purchase? Stock will be adjusted.</p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
