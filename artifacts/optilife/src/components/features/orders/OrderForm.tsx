import { useState, useEffect, useRef, FormEvent } from "react";
import { useLocation } from "wouter";
import { Plus, Trash2, Ban } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Customer, Product } from "@/types";

type LineItem = { productId: string; quantity: number; price: string };

export type EditableOrder = {
  id: string;
  customerId: string;
  createdById: string | null;
  totalAmount: string | number;
  isPaid: boolean;
  paymentMethod: string | null;
  postage?: string | number | null;
  createdAt: string;
  note?: string | null;
  customer?: { name: string };
  items: Array<{ productId: string; quantity: string | number; price: string | number }>;
};

export function OrderForm({ order }: { order?: EditableOrder } = {}) {
  const isEdit = !!order;
  const [, setLocation] = useLocation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<{ id: string; username: string }[]>([]);
  const [customerId, setCustomerId] = useState(order?.customerId ?? "");
  const [customerSearch, setCustomerSearch] = useState(order?.customer?.name ?? "");
  const [customerOpen, setCustomerOpen] = useState(false);
  const customerRef = useRef<HTMLDivElement>(null);
  const [createdById, setCreatedById] = useState(order?.createdById ?? "");
  const [invoiceDate, setInvoiceDate] = useState(() =>
    (order ? new Date(order.createdAt) : new Date()).toISOString().slice(0, 10));
  const [isPaid, setIsPaid] = useState(order?.isPaid ?? false);
  const [paymentMethod, setPaymentMethod] = useState(order?.paymentMethod ?? "");
  const [items, setItems] = useState<LineItem[]>(
    order && order.items.length
      ? order.items.map((i) => ({ productId: i.productId, quantity: Number(i.quantity), price: String(Number(i.price)) }))
      : [{ productId: "", quantity: 1, price: "" }]);
  const [postage, setPostage] = useState(order && Number(order.postage) > 0 ? String(Number(order.postage)) : "");
  const [roundOff, setRoundOff] = useState(() => {
    if (!order) return "";
    const sub = order.items.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0);
    const ro = Number(order.totalAmount) - sub - (Number(order.postage) || 0);
    return Math.abs(ro) >= 0.005 ? ro.toFixed(2) : "";
  });
  const [note, setNote] = useState(order?.note ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (customerRef.current && !customerRef.current.contains(e.target as Node)) {
        setCustomerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchUsers = fetch("/api/users", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);

    Promise.all([
      fetch("/api/customers", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/products", { credentials: "include" }).then((r) => r.json()),
      fetchUsers,
    ]).then(([c, p, u]) => {
      setCustomers(Array.isArray(c) ? c : []);
      setProducts(Array.isArray(p) ? p : []);
      setUsers(Array.isArray(u) ? u : []);
    });
  }, []);

  function addLine() {
    setItems((prev) => [...prev, { productId: "", quantity: 1, price: "" }]);
  }
  function removeLine(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateLine(i: number, field: keyof LineItem, value: string | number) {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== i) return item;
        const updated = { ...item, [field]: value };
        if (field === "productId") {
          const product = products.find((p) => p.id === value);
          updated.price = product ? String(Number(product.sellingPrice)) : "";
        }
        return updated;
      })
    );
  }

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const isDNC = selectedCustomer?.status === "dnc";

  const subtotal = items.reduce((sum, item) => {
    const price = Number(item.price) || 0;
    return sum + price * item.quantity;
  }, 0);
  const postageValue = Number(postage) > 0 ? Number(postage) : 0;
  const roundOffValue = Number(roundOff) || 0;
  const finalTotal = subtotal + postageValue + roundOffValue;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!customerId) { setError("Please select a customer"); return; }
    if (!isEdit && isDNC) { setError("Cannot create an order for a DNC customer"); return; }
    if (items.some((i) => !i.productId)) { setError("Please select a product for each line"); return; }
    if (items.some((i) => i.price === "" || Number(i.price) < 0)) {
      setError("Please enter a price for each product");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(isEdit ? `/api/orders/${order!.id}` : "/api/orders", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          customerId,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, price: Number(i.price) })),
          postage: postageValue,
          roundOff: roundOffValue,
          createdById: createdById || null,
          invoiceDate,
          isPaid,
          paymentMethod: paymentMethod || null,
          note: note || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? (isEdit ? "Failed to update order" : "Failed to create order"));
      else setLocation(`/orders/${isEdit ? order!.id : data.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div ref={customerRef} className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
        <div
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus-within:ring-2 focus-within:ring-primary/30 bg-white flex items-center gap-2 cursor-pointer"
          onClick={() => setCustomerOpen((o) => !o)}
        >
          <input
            type="text"
            placeholder={customerId ? customers.find((c) => c.id === customerId)?.name ?? "Select a customer..." : "Search customer..."}
            value={customerOpen ? customerSearch : (customers.find((c) => c.id === customerId)?.name ?? "")}
            onChange={(e) => { setCustomerSearch(e.target.value); setCustomerOpen(true); }}
            onFocus={() => { setCustomerSearch(""); setCustomerOpen(true); }}
            className="flex-1 outline-none bg-transparent text-gray-900 placeholder-gray-400 cursor-pointer"
          />
          <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${customerOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
        {customerOpen && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
            {customers
              .filter((c) => c.name.toLowerCase().includes(customerSearch.toLowerCase()))
              .map((c) => (
                <div
                  key={c.id}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-primary/10 flex items-center justify-between ${c.id === customerId ? "bg-primary/10 font-medium" : ""}`}
                  onMouseDown={(e) => { e.preventDefault(); setCustomerId(c.id); setCustomerSearch(""); setCustomerOpen(false); }}
                >
                  <span>{c.name}</span>
                  {c.status === "dnc" && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-600 ml-2">
                      <Ban size={10} /> DNC
                    </span>
                  )}
                </div>
              ))}
            {customers.filter((c) => c.name.toLowerCase().includes(customerSearch.toLowerCase())).length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-400">No customers found</div>
            )}
          </div>
        )}
        <input type="hidden" value={customerId} required />
        {isDNC && (
          <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium">
            <Ban size={15} className="shrink-0" />
            This customer is on the Do Not Contact list — orders cannot be created.
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Created By</label>
        <select
          value={createdById}
          onChange={(e) => setCreatedById(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Select user...</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.username}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
          <input
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Select...</option>
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isPaid"
          checked={isPaid}
          onChange={(e) => setIsPaid(e.target.checked)}
          className="rounded border-gray-300 text-primary"
        />
        <label htmlFor="isPaid" className="text-sm text-gray-700">Mark as Paid</label>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Products</label>
          <button type="button" onClick={addLine} className="text-sm text-primary hover:underline flex items-center gap-1">
            <Plus size={14} /> Add line
          </button>
        </div>
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5">
                <select
                  value={item.productId}
                  onChange={(e) => updateLine(i, "productId", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  required
                >
                  <option value="">Product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — {p.stockQuantity} in stock
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateLine(i, "quantity", Number(e.target.value))}
                  placeholder="Qty"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  required
                />
              </div>
              <div className="col-span-4">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.price}
                  onChange={(e) => updateLine(i, "price", e.target.value)}
                  placeholder="Price £"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  required
                />
              </div>
              <div className="col-span-1">
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  disabled={items.length === 1}
                  className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 ml-auto w-full max-w-xs space-y-1.5 text-sm">
          <div className="flex items-center justify-between text-gray-600">
            <span>Sub-total</span>
            <span>£{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-600">Postage</span>
            <div className="flex items-center gap-1">
              <span className="text-gray-400">£</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={postage}
                onChange={(e) => setPostage(e.target.value)}
                placeholder="0.00"
                className="w-24 px-2 py-1 text-right border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-600">Round off (±)</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setRoundOff((Math.round(subtotal) - subtotal).toFixed(2))}
                className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                title="Round total to the nearest whole pound"
              >
                Nearest £1
              </button>
              <input
                type="number"
                step="0.01"
                value={roundOff}
                onChange={(e) => setRoundOff(e.target.value)}
                placeholder="0.00"
                className="w-24 px-2 py-1 text-right border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-gray-200 text-base font-semibold text-gray-900">
            <span>Total</span>
            <span>£{finalTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Internal Note <span className="text-gray-400 font-normal">(not shown on invoice)</span></label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Add a private note about this order..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium">
          <Ban size={15} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <Button type="submit" loading={loading} disabled={!isEdit && isDNC}>
        {isEdit ? "Save Changes" : "Create Invoice"}
      </Button>
    </form>
  );
}
