import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { OrderForm, type EditableOrder } from "@/components/features/orders/OrderForm";
import { Spinner } from "@/components/ui/Spinner";

export default function EditOrderPage({ id }: { id: string }) {
  const [order, setOrder] = useState<EditableOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/orders/${id}`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load order");
        return r.json();
      })
      .then((data) => setOrder(data))
      .catch(() => setError("Could not load this order."))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div>
      <Link href={`/orders/${id}`}>
        <a className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4">
          <ArrowLeft size={15} /> Back to order
        </a>
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Order</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : error || !order ? (
          <p className="text-sm text-red-500">{error || "Order not found."}</p>
        ) : (
          <OrderForm order={order} />
        )}
      </div>
    </div>
  );
}
