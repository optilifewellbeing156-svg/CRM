import { useState, useEffect } from "react";
import { TrendingUp, ShoppingCart, AlertTriangle } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { DashboardData } from "@/types";

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function RevenueChart({ data }: { data: { date: string; revenue: number }[] }) {
  if (data.length === 0) {
    return <p className="text-center text-gray-400 py-10 text-sm">No revenue data yet.</p>;
  }
  const formatted = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-GB", { month: "short", day: "numeric" }),
    revenue: Number(d.revenue.toFixed(2)),
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={formatted} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `£${v}`} />
        <Tooltip formatter={(v: number) => [`£${v.toFixed(2)}`, "Revenue"]} />
        <Line type="monotone" dataKey="revenue" stroke="hsl(170,42%,40%)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [range, setRange] = useState<7 | 30>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard", { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (error) return <p className="text-center py-20 text-sm text-red-500">Failed to load dashboard data.</p>;
  if (!data) return null;

  const chartData = range === 7 ? data.dailyRevenue.slice(-7) : data.dailyRevenue;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={TrendingUp} label="Total Revenue" value={`£${data.totalRevenue.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`} color="bg-primary" />
        <StatCard icon={ShoppingCart} label="Total Orders" value={String(data.totalOrders)} color="bg-accent" />
        <StatCard icon={AlertTriangle} label="Low Stock Items" value={String(data.lowStockProducts.length)} color="bg-amber-500" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Revenue</h2>
          <div className="flex gap-1">
            {([7, 30] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${range === r ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {r}d
              </button>
            ))}
          </div>
        </div>
        <RevenueChart data={chartData} />
      </div>

      {data.lowStockProducts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b bg-amber-50">
            <h2 className="text-sm font-semibold text-amber-800">Low Stock Alert</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Product</th>
                <th className="px-4 py-2 text-left font-medium">SKU</th>
                <th className="px-4 py-2 text-left font-medium">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.lowStockProducts.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{p.name}</td>
                  <td className="px-4 py-3 text-gray-500">{p.sku}</td>
                  <td className="px-4 py-3">
                    <Badge variant="warning">{p.stockQuantity} left</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
