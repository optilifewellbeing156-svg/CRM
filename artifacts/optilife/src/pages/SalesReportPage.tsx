import { useState, useEffect } from "react";
import { TrendingUp, ShoppingCart, BarChart3, Users, Download, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { useMe } from "@/hooks/useMe";

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((cell) => {
    const s = String(cell ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "default"> = {
  DELIVERED: "success",
  PROCESSING: "warning",
  PROCESSED: "default",
  CANCELLED: "danger",
  REFUNDED: "danger",
};

type ReportData = {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  cancelledRefundedAmount: number;
  cancelledRefundedCount: number;
  orders: { id: string; customer: string; createdBy: string | null; itemCount: number; totalAmount: number; createdAt: string; status: string }[];
  topProducts: { name: string; unitsSold: number; revenue: number }[];
  userReport: { userId: string; username: string; totalOrders: number; totalSales: number; commissionRate: number; commission: number }[];
};

export default function SalesReportPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(today);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState("");
  const [users, setUsers] = useState<{ id: string; username: string }[]>([]);

  const me = useMe();
  const isPrivileged = me !== "loading" && (me?.role === "ADMIN" || me?.role === "SUPER_ADMIN");

  useEffect(() => {
    if (!isPrivileged) return;
    fetch("/api/users", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]));
  }, [isPrivileged]);

  async function fetchReport() {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ from, to });
    if (isPrivileged && userId) params.set("userId", userId);
    const res = await fetch(`/api/sales-report?${params.toString()}`, { credentials: "include" });
    if (!res.ok) { setError("Failed to fetch report"); setLoading(false); return; }
    setData(await res.json());
    setLoading(false);
  }

  function handleExport() {
    if (!data) return;
    const rows: string[][] = [
      ["Invoice #", "Customer", "Order Taken By", "Items", "Total (£)", "Date", "Status"],
      ...data.orders.map((o) => [
        o.id.slice(0, 8).toUpperCase(),
        o.customer,
        o.createdBy ?? "—",
        String(o.itemCount),
        o.totalAmount.toFixed(2),
        new Date(o.createdAt).toLocaleDateString("en-GB"),
        o.status,
      ]),
    ];
    downloadCSV(`sales-report-${from}-to-${to}.csv`, rows);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Sales Report</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block uppercase tracking-wide">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block uppercase tracking-wide">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        {isPrivileged && (
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block uppercase tracking-wide">User</label>
            <select value={userId} onChange={(e) => setUserId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-white min-w-[160px]">
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.username}</option>
              ))}
            </select>
          </div>
        )}
        <Button onClick={fetchReport} loading={loading}>Generate Report</Button>
        {data && (
          <Button variant="secondary" onClick={handleExport} className="flex items-center gap-2">
            <Download size={14} /> Export CSV
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {loading && <div className="flex justify-center py-12"><Spinner size="lg" /></div>}

      {data && !loading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: TrendingUp, label: "Net Revenue", value: `£${data.totalRevenue.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`, color: "bg-primary" },
              { icon: ShoppingCart, label: "Total Orders", value: String(data.totalOrders), color: "bg-accent" },
              { icon: BarChart3, label: "Avg Order Value", value: `£${data.avgOrderValue.toFixed(2)}`, color: "bg-green-500" },
              { icon: XCircle, label: `Cancelled / Refunded (${data.cancelledRefundedCount})`, value: `-£${data.cancelledRefundedAmount.toFixed(2)}`, color: "bg-red-500" },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
                <div className={`p-3 rounded-lg ${color}`}>
                  <Icon size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {data.topProducts.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><BarChart3 size={16} /> Top Products</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Product</th>
                    <th className="px-4 py-2 text-right">Units Sold</th>
                    <th className="px-4 py-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.topProducts.map((p) => (
                    <tr key={p.name} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{p.name}</td>
                      <td className="px-4 py-3 text-right">{p.unitsSold}</td>
                      <td className="px-4 py-3 text-right font-medium">£{p.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.userReport.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Users size={16} /> User Performance</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">User</th>
                    <th className="px-4 py-2 text-right">Orders</th>
                    <th className="px-4 py-2 text-right">Total Sales</th>
                    <th className="px-4 py-2 text-right">Commission Rate</th>
                    <th className="px-4 py-2 text-right">Commission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.userReport.map((u) => (
                    <tr key={u.userId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{u.username}</td>
                      <td className="px-4 py-3 text-right">{u.totalOrders}</td>
                      <td className="px-4 py-3 text-right">£{u.totalSales.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">{u.commissionRate}%</td>
                      <td className="px-4 py-3 text-right font-medium">£{u.commission.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b">
              <h2 className="text-sm font-semibold text-gray-700">All Orders</h2>
            </div>
            {data.orders.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">No orders in this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Invoice #</th>
                    <th className="px-4 py-2 text-left">Customer</th>
                    <th className="px-4 py-2 text-left">Order Taken By</th>
                    <th className="px-4 py-2 text-right">Total</th>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.orders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8).toUpperCase()}</td>
                      <td className="px-4 py-3">{o.customer}</td>
                      <td className="px-4 py-3 text-gray-500">{o.createdBy ?? "—"}</td>
                      <td className={`px-4 py-3 text-right font-medium ${o.totalAmount < 0 ? "text-red-600" : ""}`}>
                        {o.totalAmount < 0 ? `-£${Math.abs(o.totalAmount).toFixed(2)}` : `£${o.totalAmount.toFixed(2)}`}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{new Date(o.createdAt).toLocaleDateString("en-GB")}</td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[o.status] ?? "default"}>{o.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
