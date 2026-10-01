import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { Plus, Eye, Trash2, Pencil, Download, Search } from "lucide-react";
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

const STATUS_OPTIONS = ["PROCESSING", "PROCESSED", "DELIVERED", "CANCELLED", "REFUNDED"];

const FILTER_INPUT =
  "px-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-2 focus:ring-primary/30";

export default function OrdersPage() {
  const meState = useMe();
  // Narrow away the "loading" sentinel so property access typechecks.
  const me = meState === "loading" ? null : meState;
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const isPrivileged = me?.role === "ADMIN" || me?.role === "SUPER_ADMIN";
  const canCreate = isPrivileged || me?.permissions?.includes("create-orders");
  const canEdit = isPrivileged || me?.permissions?.includes("edit-orders");
  const canDelete = isPrivileged || me?.permissions?.includes("delete-orders");

  // Filters. The date range drives both the on-screen list and the Excel
  // export, so what you see is what you export.
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paidFilter, setPaidFilter] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const hasFilters = !!(search || from || to || statusFilter || paidFilter);

  const toISO = (d: Date) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD, local
  const currentMonth = from ? from.slice(0, 7) : "";

  // Fill the range to cover a whole calendar month, e.g. "2026-07".
  function selectMonth(month: string) {
    if (!month) return;
    const [y, m] = month.split("-").map(Number);
    setFrom(toISO(new Date(y, m - 1, 1)));
    setTo(toISO(new Date(y, m, 0))); // day 0 of next month = last day of this
  }

  function selectRelativeMonth(offset: number) {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    setFrom(toISO(first));
    setTo(toISO(new Date(first.getFullYear(), first.getMonth() + 1, 0)));
  }

  function clearFilters() {
    setSearch("");
    setFrom("");
    setTo("");
    setStatusFilter("");
    setPaidFilter("");
  }

  // Debounce only the text search; date and dropdown changes apply at once.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Guards against out-of-order responses when filters change quickly.
  const fetchSeq = useRef(0);

  const fetchOrders = useCallback(async () => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    setLoadError("");
    const params = new URLSearchParams({ limit: "1000" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (statusFilter) params.set("status", statusFilter);
    if (paidFilter) params.set("paid", paidFilter);
    try {
      const res = await fetch(`/api/orders?${params}`, { credentials: "include" });
      if (seq !== fetchSeq.current) return;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLoadError(data.error ?? "Failed to load orders.");
        setOrders([]);
      } else {
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      }
    } catch {
      if (seq !== fetchSeq.current) return;
      setLoadError("Could not reach the server.");
      setOrders([]);
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, [debouncedSearch, from, to, statusFilter, paidFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function handleExport() {
    setExporting(true);
    setExportError("");
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const qs = params.toString();
      const res = await fetch(`/api/export/orders${qs ? `?${qs}` : ""}`, { credentials: "include" });
      if (!res.ok) {
        setExportError("Export failed. Please try again.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders-${from || "start"}_to_${to || "end"}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    const res = await fetch(`/api/orders/${deleteTarget.id}`, { method: "DELETE", credentials: "include" });
    setDeleting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setDeleteError(data.error ?? "Failed to delete order");
      return;
    }
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

      <div className="bg-card rounded-xl border border-border p-4 mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[220px] flex-1 flex-col gap-1 sm:max-w-xs">
            <label className="text-xs font-medium text-muted-foreground">Search</label>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Invoice # or customer..."
                className={`${FILTER_INPUT} w-full pl-8`}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">From date</label>
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              className={FILTER_INPUT}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">To date</label>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              className={FILTER_INPUT}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={FILTER_INPUT}>
              <option value="">All</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Payment</label>
            <select value={paidFilter} onChange={(e) => setPaidFilter(e.target.value)} className={FILTER_INPUT}>
              <option value="">All</option>
              <option value="true">Paid</option>
              <option value="false">Unpaid</option>
            </select>
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="self-end pb-2.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>

        {isPrivileged && (
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Pick a month</label>
              <input type="month" value={currentMonth} onChange={(e) => selectMonth(e.target.value)} className={FILTER_INPUT} />
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
            <div className="mx-1 hidden h-8 w-px bg-border sm:block" />
            <Button variant="secondary" loading={exporting} onClick={handleExport} className="flex items-center gap-2">
              <Download size={16} /> Export Excel
            </Button>
            <p className="basis-full text-xs text-muted-foreground sm:basis-auto">
              The export uses the date range above — leave it blank to export every order.
            </p>
            {exportError && <p className="basis-full text-xs text-red-600">{exportError}</p>}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <p className="text-center text-sm text-red-600">{loadError}</p>
            <Button variant="secondary" onClick={fetchOrders}>Try again</Button>
          </div>
        ) : orders.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">
            {hasFilters ? "No orders match your search or filters." : "No orders yet. Create your first invoice."}
          </p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full sm:min-w-[720px] text-sm table-cards">
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
                  <td className="px-4 py-3 font-mono text-xs" data-label="Invoice #">{o.id.slice(0, 8).toUpperCase()}</td>
                  <td className="px-4 py-3 font-medium" data-label="Customer">{o.customer?.name}</td>
                  <td className="px-4 py-3" data-label="Total">£{Number(o.totalAmount).toFixed(2)}</td>
                  <td className="px-4 py-3" data-label="Status">
                    {o.status ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[o.status] ?? "bg-gray-100 text-gray-700"}`}>
                        {o.status}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3" data-label="Payment">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${o.isPaid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {o.isPaid ? "PAID" : "UNPAID"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500" data-label="Date">
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

      <Modal open={!!deleteTarget} title="Delete Order" onClose={() => { setDeleteTarget(null); setDeleteError(""); }}>
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete order <strong>#{deleteTarget?.id.slice(0, 8).toUpperCase()}</strong>?
        </p>
        {deleteError && <p className="text-sm text-red-500 mb-3">{deleteError}</p>}
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => { setDeleteTarget(null); setDeleteError(""); }}>Cancel</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
