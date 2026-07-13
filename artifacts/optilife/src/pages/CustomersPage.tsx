import { useState, useEffect, useCallback } from "react";
import { Pencil, Trash2, Plus, History, Ban, CheckCircle2, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { SlideOver } from "@/components/ui/SlideOver";
import { Modal } from "@/components/ui/Modal";
import { CustomerForm } from "@/components/features/customers/CustomerForm";
import { useMe } from "@/hooks/useMe";
import type { Customer, Order } from "@/types";

const STATUS_BADGE: Record<string, string> = {
  DELIVERED: "bg-green-100 text-green-700",
  PROCESSING: "bg-yellow-100 text-yellow-700",
  PROCESSED: "bg-gray-100 text-gray-700",
  CANCELLED: "bg-red-100 text-red-700",
  REFUNDED: "bg-red-100 text-red-700",
};

export default function CustomersPage() {
  const me = useMe();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [history, setHistory] = useState<Order[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const isPrivileged = me?.role === "ADMIN" || me?.role === "SUPER_ADMIN";
  const hasManage = isPrivileged || me?.permissions?.includes("manage-customers");
  const canAdd = hasManage || me?.permissions?.includes("add-customers");
  const canEdit = hasManage || me?.permissions?.includes("edit-customers");
  const canDelete = hasManage || me?.permissions?.includes("delete-customers");
  const canViewCards = isPrivileged || me?.permissions?.includes("view-card-details");
  const canSetStatus = isPrivileged || me?.permissions?.includes("set-customer-status");
  const isSuperAdmin = me?.role === "SUPER_ADMIN";
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/export/customers", { credentials: "include" });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `customers-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/customers", { credentials: "include" });
    const data = await res.json();
    setCustomers(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone ?? "").includes(search) ||
      (c.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  async function openHistory(c: Customer) {
    setHistoryCustomer(c);
    setHistoryLoading(true);
    const res = await fetch(`/api/customers/${c.id}/orders`, { credentials: "include" });
    setHistory(await res.json());
    setHistoryLoading(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/customers/${deleteTarget.id}`, { method: "DELETE", credentials: "include" });
    setDeleteTarget(null);
    setDeleting(false);
    fetchCustomers();
  }

  async function toggleStatus(c: Customer) {
    const newStatus = c.status === "active" ? "dnc" : "active";
    await fetch(`/api/customers/${c.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: newStatus }),
    });
    fetchCustomers();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <Button variant="secondary" loading={exporting} onClick={handleExport} className="flex items-center gap-2" title="Export every customer with all their details and order summary">
              <Download size={16} /> Export All Details
            </Button>
          )}
          {canAdd && (
            <Button onClick={() => { setEditing(undefined); setSlideOpen(true); }} className="flex items-center gap-2">
              <Plus size={16} /> Add Customer
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b">
          <input
            className="w-full max-w-xs px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">No customers found. Add your first customer.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
              <tr>
                {["Name", "Phone", "Email", "Address", "Status", ...(canViewCards ? ["Card Number", "Expiry", "Holder"] : []), ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-gray-500">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{c.address ?? "—"}</td>
                  <td className="px-4 py-3">
                    {c.status === "dnc" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                        <Ban size={11} /> DNC
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                        <CheckCircle2 size={11} /> Active
                      </span>
                    )}
                  </td>
                  {canViewCards && <>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{c.cardNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{c.cardExpiry ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{c.cardHolder ?? "—"}</td>
                  </>}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openHistory(c)} className="text-gray-400 hover:text-primary" title="Order history">
                        <History size={15} />
                      </button>
                      {canSetStatus && (
                        <button
                          onClick={() => toggleStatus(c)}
                          className={c.status === "dnc" ? "text-red-400 hover:text-green-600" : "text-green-500 hover:text-red-500"}
                          title={c.status === "dnc" ? "Mark Active" : "Mark DNC"}
                        >
                          {c.status === "dnc" ? <CheckCircle2 size={15} /> : <Ban size={15} />}
                        </button>
                      )}
                      {canEdit && (
                        <button onClick={() => { setEditing(c); setSlideOpen(true); }} className="text-gray-400 hover:text-primary">
                          <Pencil size={15} />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => setDeleteTarget(c)} className="text-gray-400 hover:text-red-500">
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

      <SlideOver open={slideOpen} title={editing ? "Edit Customer" : "Add Customer"} onClose={() => setSlideOpen(false)}>
        <CustomerForm initial={editing} onSuccess={() => { setSlideOpen(false); fetchCustomers(); }} />
      </SlideOver>

      <Modal open={!!deleteTarget} title="Delete Customer" onClose={() => setDeleteTarget(null)}>
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>

      <Modal open={!!historyCustomer} title={`Orders — ${historyCustomer?.name}`} onClose={() => setHistoryCustomer(null)}>
        {historyLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No orders found.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {history.map((o) => (
              <div key={o.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs font-mono text-gray-500">#{o.id.slice(0, 8).toUpperCase()}</p>
                  <p className="text-sm font-medium">£{Number(o.totalAmount).toFixed(2)}</p>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[o.status ?? ""] ?? "bg-gray-100 text-gray-700"}`}>
                  {o.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
