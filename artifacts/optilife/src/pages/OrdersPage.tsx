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

  const toISO = (d: Date) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD, local
  const currentMonth = exportFrom ? exportFrom.slice(0, 7) : "";

  // Fill the range to cover a whole calendar month, e.g. "2026-07".
  function selectMonth(month: string) {
    if (!month) return;
    const [y, m] = month.split("-").map(Number);
    setExportFrom(toISO(new Date(y, m - 1, 1)));
    setExportTo(toISO(new Date(y, m, 0))); // day 0 of next month = last day of this
  }

  function selectRelativeMonth(offset: number) {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    setExportFrom(toISO(first));
    setExportTo(toISO(new Date(first.getFullYear(), first.getMonth() + 1, 0)));
  }

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
        <div className="bg-card rounded-xl border border-border p-4 mb-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Pick a month</label>
              <input
                type="month"
                value={currentMonth}
                onChange={(e) => selectMonth(e.target.value)}
                className="px-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex items-center gap-1.5 self-end pb-0.5">
              <button
                type="button"
                onClick={() => selectRelativeMonth(0)}
                className="px-3 py-2 text-xs font-medium rounded-lg bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              >
                This month
              </button>
              <button
                type="button"
                onClick={() => selectRelativeMonth(-1)}
                className="px-3 py-2 text-xs font-medium rounded-lg bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              >
                Last month
              </button>
            </div>

            <div className="mx-1 hidden h-9 w-px self-end bg-border sm:block" />

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">From date</label>
              <input
                type="date"
                value={exportFrom}
                max={exportTo || undefined}
                onChange={(e) => setExportFrom(e.target.value)}
                className="px-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">To date</label>
              <input
                type="date"
                value={exportTo}
                min={exportFrom || undefined}
                onChange={(e) => setExportTo(e.target.value)}
                className="px-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <Button variant="secondary" loading={exporting} onClick={handleExport} className="flex items-center gap-2">
              <Download size={16} /> Export Excel
            </Button>
            {(exportFrom || exportTo) && (
              <button
                type="button"
                onClick={() => { setExportFrom(""); setExportTo(""); }}
                className="text-sm text-muted-foreground hover:text-foreground self-center"
              >
                Clear
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Pick a month or set a custom range — leave both blank to export every order. The file lists one row per product line with quantity, unit price, line total, postage and order total.
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : orders.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">No orders yet. Create your first invoice.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
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
          </div>
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
