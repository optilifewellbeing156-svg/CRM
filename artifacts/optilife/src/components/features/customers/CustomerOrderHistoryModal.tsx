import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import type { Order } from "@/types";

const STATUS_BADGE: Record<string, string> = {
  DELIVERED: "bg-green-100 text-green-700",
  PROCESSING: "bg-yellow-100 text-yellow-700",
  PROCESSED: "bg-gray-100 text-gray-700",
  CANCELLED: "bg-red-100 text-red-700",
  REFUNDED: "bg-red-100 text-red-700",
};

/** Order history for one customer. Each row is the invoice number and date, and
 *  links through to the full invoice (which lists the products purchased). */
export function CustomerOrderHistoryModal({
  customer,
  onClose,
}: {
  customer: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customer) return;
    let cancelled = false;
    setLoading(true);
    setOrders([]);
    fetch(`/api/customers/${customer.id}/orders`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { if (!cancelled) { setOrders(Array.isArray(d) ? d : []); setLoading(false); } })
      .catch(() => { if (!cancelled) { setOrders([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [customer?.id]);

  return (
    <Modal open={!!customer} title={`Orders — ${customer?.name ?? ""}`} onClose={onClose}>
      {loading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : orders.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">No orders found.</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {orders.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`}>
              <a
                onClick={onClose}
                title="View invoice"
                className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-mono font-medium text-gray-900">
                    #{o.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(o.createdAt).toLocaleDateString("en-GB")}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[o.status ?? ""] ?? "bg-gray-100 text-gray-700"}`}>
                    {o.status}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    £{Number(o.totalAmount).toFixed(2)}
                  </span>
                  <ChevronRight size={15} className="text-gray-400" />
                </div>
              </a>
            </Link>
          ))}
        </div>
      )}
    </Modal>
  );
}
