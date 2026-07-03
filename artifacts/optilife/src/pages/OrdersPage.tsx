import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Plus, Eye, Trash2, Pencil, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { useMe } from "@/hooks/useMe";
import type { Order } from "@/types";

const STATUS_BADGE: Record<string, string> = {
  DELIVERED: "bg-green-100 text-green-700",
  PROCESSING: "bg-yellow-100 text-yellow-700",
  PROCESSED: "bg-gray-100 text-gray-700",
  CANCELLED: "bg-red-100 text-red-700",
  REFUNDED: "bg-red-100 text-red-700",
};

export default function OrdersPage() {
  const me = useMe();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isSuperAdmin = me?.role === "SUPER_ADMIN";
  const isPrivileged = isSuperAdmin || me?.role === "ADMIN";
  const canCreate = isPrivileged || me?.permissions?.includes("create-orders");
  const canEdit = isPrivileged || me?.permissions?.includes("edit-orders");
  const canDelete = isPrivileged || me?.permissions?.includes("delete-orders");

  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (exportFrom) params.set("from", exportFrom);
      if (exportTo) params.set("to", exportTo);
      const qs = params.toString();
      const res = await fetch(`/api/export/orders${qs ? `?${qs}` : ""}`, { credentials: "include" });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders-${exportFrom || "start"}_to_${exportTo || "end"}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/orders", { credentials: "include" });
    setOrders(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/orders/${deleteTarget.id}`, { method: "DELETE", credentials: "include" });
    setDeleting(false);
    setDeleteTarget(null);
    fetchOrders();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        {canCreate && (
          <Link href="/orders/new">
            <a>
              <Button className="flex items-center gap-2"><Plus size={16} /> New Order</Button>
            </a>
          </Link>
        )}
      </div>

      {isPrivileged && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">From date</label>
            <input
              type="date"
              value={exportFrom}
              max={exportTo || undefined}
              onChange={(e) => setExportFrom(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">To date</label>
            <input
              type="date"
              value={exportTo}
              min={exportFrom || undefined}
              onChange={(e) => setExportTo(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <Button variant="secondary" loading={exporting} onClick={handleExport} className="flex items-center gap-2">
            <Download size={16} /> Export Excel
          </Button>
          {(exportFrom || exportTo) && (
            <button
              type="button"
              onClick={() => { setExportFrom(""); setExportTo(""); }}
              className="text-sm text-gray-500 hover:text-gray-800 self-center"
            >
              Clear
            </button>
          )}
          <span className="text-xs text-gray-400 self-center ml-auto">
            Leave dates blank to export all orders. Export includes which user took each order.
          </span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : orders.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">No orders yet. Create your first invoice.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
              <tr>
                {["Invoice #", "Customer", "Total", "Status", "Payment", "Date", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8).toUpperCase()}</td>
                  <td className="px-4 py-3 font-medium">{o.customer?.name}</td>
                  <td className="px-4 py-3">£{Number(o.totalAmount).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {o.status ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[o.status] ?? "bg-gray-100 text-gray-700"}`}>
                        {o.status}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${o.isPaid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {o.isPaid ? "PAID" : "UNPAID"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(o.createdAt).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Link href={`/orders/${o.id}`}>
                        <a className="text-gray-400 hover:text-primary"><Eye size={15} /></a>
                      </Link>
                      {canEdit && (
                        <Link href={`/orders/${o.id}/edit`}>
                          <a className="text-gray-400 hover:text-primary"><Pencil size={15} /></a>
                        </Link>
                      )}
                      {canDelete && (
                        <button onClick={() => setDeleteTarget(o)} className="text-gray-400 hover:text-red-500">
                          <Trash2 size={15} />
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

      <Modal open={!!deleteTarget} title="Delete Order" onClose={() => setDeleteTarget(null)}>
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete order <strong>#{deleteTarget?.id.slice(0, 8).toUpperCase()}</strong>?
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
