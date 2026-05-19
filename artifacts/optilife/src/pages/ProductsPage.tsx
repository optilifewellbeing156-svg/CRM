import { useState, useEffect, useCallback } from "react";
import { Pencil, Trash2, Plus, Bell, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { SlideOver } from "@/components/ui/SlideOver";
import { Modal } from "@/components/ui/Modal";
import { ProductForm } from "@/components/features/products/ProductForm";
import { useMe } from "@/hooks/useMe";
import type { Product } from "@/types";

export default function ProductsPage() {
  const me = useMe();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState<Product | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [stockTarget, setStockTarget] = useState<Product | null>(null);
  const [stockValue, setStockValue] = useState("");
  const [updatingStock, setUpdatingStock] = useState(false);

  const isSuperAdmin = me?.role === "SUPER_ADMIN";
  const isAdmin = isSuperAdmin || me?.role === "ADMIN";
  const hasManage = isAdmin || me?.permissions?.includes("manage-products");
  const canAdd = hasManage;
  const canEdit = hasManage || me?.permissions?.includes("edit-products");
  const canDelete = hasManage || me?.permissions?.includes("delete-products");
  const canChangeStock = hasManage || me?.permissions?.includes("change-stock");

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    fetch("/api/products", { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); })
      .then((data: Product[]) => { setError(false); setProducts(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() { setEditing(undefined); setSlideOpen(true); }
  function openEdit(p: Product) { setEditing(p); setSlideOpen(true); }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/products/${deleteTarget.id}`, { method: "DELETE", credentials: "include" });
    setDeleteTarget(null);
    setDeleting(false);
    fetchProducts();
  }

  async function handleStockUpdate() {
    if (!stockTarget) return;
    setUpdatingStock(true);
    await fetch(`/api/products/${stockTarget.id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stockQuantity: Number(stockValue) }),
    });
    setUpdatingStock(false);
    setStockTarget(null);
    fetchProducts();
  }

  if (error) return <p className="text-center py-20 text-sm text-red-500">Failed to load products.</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        {canAdd && (
          <Button onClick={openCreate} className="flex items-center gap-2">
            <Plus size={16} /> Add Product
          </Button>
        )}
      </div>

      {!loading && products.filter((p) => p.stockQuantity <= p.lowStockThreshold).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
          <Bell size={16} className="text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">
            <strong>{products.filter((p) => p.stockQuantity <= p.lowStockThreshold).length} product{products.filter((p) => p.stockQuantity <= p.lowStockThreshold).length !== 1 ? "s" : ""}</strong> at or below low stock threshold:&nbsp;
            {products.filter((p) => p.stockQuantity <= p.lowStockThreshold).map((p) => p.name).join(", ")}
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b">
          <input
            className="w-full max-w-xs px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">No products found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
              <tr>
                {["Name", "SKU", "Cost", "Selling Price", "Stock", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((p) => {
                const lowStock = p.stockQuantity <= p.lowStockThreshold;
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.sku}</td>
                    <td className="px-4 py-3">£{Number(p.costPrice).toFixed(2)}</td>
                    <td className="px-4 py-3">£{Number(p.sellingPrice).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      {lowStock ? (
                        <Badge variant="warning">{p.stockQuantity} ⚠</Badge>
                      ) : (
                        <span>{p.stockQuantity}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {canEdit && (
                          <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-primary">
                            <Pencil size={15} />
                          </button>
                        )}
                        {canChangeStock && !canEdit && (
                          <button onClick={() => { setStockTarget(p); setStockValue(String(p.stockQuantity)); }} className="text-gray-400 hover:text-primary">
                            <PackagePlus size={15} />
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
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <SlideOver
        open={slideOpen}
        title={editing ? "Edit Product" : "Add Product"}
        onClose={() => setSlideOpen(false)}
      >
        <ProductForm
          initial={editing}
          onSuccess={() => { setSlideOpen(false); fetchProducts(); }}
        />
      </SlideOver>

      <Modal open={!!deleteTarget} title="Delete Product" onClose={() => setDeleteTarget(null)}>
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>

      <Modal open={!!stockTarget} title="Change Stock" onClose={() => setStockTarget(null)}>
        <p className="text-sm text-gray-600 mb-3">Update stock quantity for <strong>{stockTarget?.name}</strong>.</p>
        <input
          type="number"
          min="0"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary/30 mb-4"
          value={stockValue}
          onChange={(e) => setStockValue(e.target.value)}
        />
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setStockTarget(null)}>Cancel</Button>
          <Button loading={updatingStock} onClick={handleStockUpdate}>Update Stock</Button>
        </div>
      </Modal>
    </div>
  );
}
