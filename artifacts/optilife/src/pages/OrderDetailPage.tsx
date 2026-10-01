import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { useMe } from "@/hooks/useMe";
import type { Order } from "@/types";

const STATUS_OPTIONS = ["PROCESSING", "PROCESSED", "DELIVERED", "CANCELLED", "REFUNDED"];

const STATUS_BADGE: Record<string, string> = {
  DELIVERED: "bg-green-100 text-green-700",
  PROCESSING: "bg-yellow-100 text-yellow-700",
  PROCESSED: "bg-gray-100 text-gray-700",
  CANCELLED: "bg-red-100 text-red-700",
  REFUNDED: "bg-red-100 text-red-700",
};

export default function OrderDetailPage({ id }: { id: string }) {
  const meState = useMe();
  // Narrow away the "loading" sentinel so property access typechecks.
  const me = meState === "loading" ? null : meState;
  const [, setLocation] = useLocation();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [actionError, setActionError] = useState("");

  const isAdmin = me?.role === "ADMIN" || me?.role === "SUPER_ADMIN";
  const canDelete = isAdmin || me?.permissions?.includes("delete-orders");
  const canEdit = isAdmin || me?.permissions?.includes("edit-orders");
  const canChangeStatus = isAdmin || me?.permissions?.includes("change-order-status");

  useEffect(() => {
    // A 404 or 403 body is `{error}`, not an order — storing it rendered a
    // broken invoice with "Invalid Date" instead of the not-found message.
    fetch(`/api/orders/${id}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { setOrder(data); setLoading(false); })
      .catch(() => { setOrder(null); setLoading(false); });
  }, [id]);

  async function handleDelete() {
    setDeleting(true);
    setActionError("");
    const res = await fetch(`/api/orders/${id}`, { method: "DELETE", credentials: "include" });
    setDeleting(false);
    setShowDeleteModal(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError(data.error ?? "Failed to delete order");
      return;
    }
    setLocation("/orders");
  }

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    setActionError("");
    try {
      const res = await fetch(`/api/orders/${id}/pdf`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setActionError("Could not generate the PDF. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function handleStatusChange(status: string) {
    if (!order) return;
    setUpdatingStatus(true);
    setActionError("");
    const res = await fetch(`/api/orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status }),
    });
    const updated = await res.json().catch(() => ({}));
    if (!res.ok) {
      // A failed change (403, insufficient stock on reactivation, …) used to
      // blank the badge and say nothing; keep the old status and explain.
      setActionError(updated.error ?? "Failed to change status");
    } else {
      setOrder((prev) => prev ? { ...prev, status: updated.status } : prev);
    }
    setUpdatingStatus(false);
  }

  async function handleTogglePaid() {
    if (!order) return;
    setActionError("");
    const res = await fetch(`/api/orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: order.status, isPaid: !order.isPaid }),
    });
    const updated = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActionError(updated.error ?? "Failed to update payment status");
      return;
    }
    setOrder((prev) => prev ? { ...prev, isPaid: updated.isPaid } : prev);
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!order) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <p className="text-gray-500 mb-4">Order not found. It may have been deleted, or the link is wrong.</p>
        <Link href="/orders"><a className="text-sm font-medium text-primary hover:underline">Back to Orders</a></Link>
      </div>
    );
  }

  // The stored total includes postage and the manual round-off; showing it
  // under line subtotals alone made the invoice look like it didn't add up.
  const itemsSubtotal = (order.items ?? []).reduce((sum, i) => sum + Number(i.quantity) * Number(i.price), 0);
  const postage = Number(order.postage) || 0;
  const adjustment = Number(order.totalAmount) - itemsSubtotal - postage;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <Link href="/orders">
          <a className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
            <ArrowLeft size={14} /> Back to Orders
          </a>
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="secondary" loading={downloadingPdf} onClick={handleDownloadPdf} className="flex items-center gap-2">
            <Download size={14} /> Download PDF
          </Button>
          {canDelete && (
            <Button variant="danger" onClick={() => setShowDeleteModal(true)} className="flex items-center gap-2">
              <Trash2 size={14} /> Delete
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <p className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{actionError}</p>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "hsl(170,42%,40%)" }}>OptiLifeWellbeing</h1>
            <p className="text-sm text-gray-500 mt-1">Invoice #{id.slice(0, 8).toUpperCase()}</p>
            <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString("en-GB", { dateStyle: "long" })}</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs uppercase text-gray-400 mb-1">Bill To</p>
          <p className="font-medium">{order.customer?.name}</p>
        </div>

        <div className="mb-6 flex items-center gap-6">
          <div>
            <p className="text-xs uppercase text-gray-400 mb-1">Payment Method</p>
            <p className="font-medium">{order.paymentMethod || "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-400 mb-1">Payment Status</p>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${order.isPaid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                {order.isPaid ? "PAID" : "UNPAID"}
              </span>
              {canEdit && (
                <button onClick={handleTogglePaid} className="text-xs text-primary hover:underline">
                  Mark as {order.isPaid ? "Unpaid" : "Paid"}
                </button>
              )}
            </div>
          </div>
        </div>

        {canChangeStatus && (
          <div className="mb-6">
            <p className="text-xs uppercase text-gray-400 mb-2">Status</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={updatingStatus}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${order.status === s ? STATUS_BADGE[s] + " ring-2 ring-offset-1 ring-current" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {order.note && (
          <div className="mb-6">
            <p className="text-xs uppercase text-gray-400 mb-1">Internal Note</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.note}</p>
          </div>
        )}

        {order.items && order.items.length > 0 && (
          <div className="mb-6 overflow-x-auto">
            <table className="w-full sm:min-w-[560px] text-sm table-cards">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left">Product</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-right">Unit Price</th>
                  <th className="px-4 py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3" data-label="Product">{item.product?.name ?? item.productId}</td>
                    <td className="px-4 py-3 text-right" data-label="Qty">{Number(item.quantity)}</td>
                    <td className="px-4 py-3 text-right" data-label="Unit Price">£{Number(item.price).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right" data-label="Subtotal">£{(Number(item.quantity) * Number(item.price)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200">
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-right text-gray-500">Sub-total</td>
                  <td className="px-4 py-2 text-right text-gray-700" data-label="Sub-total">£{itemsSubtotal.toFixed(2)}</td>
                </tr>
                {postage > 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-right text-gray-500">Postage</td>
                    <td className="px-4 py-2 text-right text-gray-700" data-label="Postage">£{postage.toFixed(2)}</td>
                  </tr>
                )}
                {Math.abs(adjustment) >= 0.005 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-right text-gray-500">Round off</td>
                    <td className="px-4 py-2 text-right text-gray-700" data-label="Round off">{adjustment < 0 ? "−" : ""}£{Math.abs(adjustment).toFixed(2)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right font-semibold">Total</td>
                  <td className="px-4 py-3 text-right font-bold" data-label="Total">£{Number(order.totalAmount).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <Modal open={showDeleteModal} title="Delete Order" onClose={() => setShowDeleteModal(false)}>
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete invoice <strong>#{id.slice(0, 8).toUpperCase()}</strong>? This cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
