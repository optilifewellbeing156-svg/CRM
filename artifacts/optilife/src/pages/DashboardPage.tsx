import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, ShoppingCart, AlertTriangle, Download, Receipt } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/card";
import { useMe } from "@/hooks/useMe";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { DashboardData } from "@/types";

const gbp = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** % change of `key` over the last 7 days vs the previous 7 days. Null when the
 * prior window has no data (a delta would be meaningless / infinite). */
function computeTrend(rows: DashboardData["dailyRevenue"], key: "revenue" | "orders"): number | null {
  const now = Date.now();
  const DAY = 86_400_000;
  let last = 0, prev = 0;
  for (const r of rows) {
    const age = now - new Date(r.date).getTime();
    if (age <= 7 * DAY) last += r[key];
    else if (age <= 14 * DAY) prev += r[key];
  }
  if (prev === 0) return null;
  return ((last - prev) / prev) * 100;
}

function TrendChip({ pct }: { pct: number }) {
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        up ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
      }`}
    >
      <Icon size={12} />
      {up ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  iconClass,
  trend,
  caption,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  iconClass: string;
  trend?: number | null;
  caption?: string;
}) {
  return (
    <Card className="p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconClass}`}>
          <Icon size={20} />
        </div>
        {trend != null && <TrendChip pct={trend} />}
      </div>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">{value}</p>
      {caption && <p className="mt-1 text-xs text-muted-foreground">{caption}</p>}
    </Card>
  );
}

function MetricChart({
  data,
  metric,
}: {
  data: { date: string; revenue: number; orders: number }[];
  metric: "revenue" | "orders";
}) {
  if (data.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">No data for this period yet.</p>;
  }
  const formatted = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-GB", { month: "short", day: "numeric" }),
    value: metric === "revenue" ? Number(d.revenue.toFixed(2)) : d.orders,
  }));
  const isRev = metric === "revenue";
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={formatted} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="fillMetric" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(170,42%,40%)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="hsl(170,42%,40%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(160,15%,90%)" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(170,10%,50%)" }} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis
          tick={{ fontSize: 11, fill: "hsl(170,10%,50%)" }}
          tickLine={false}
          axisLine={false}
          width={isRev ? 48 : 32}
          tickFormatter={(v) => (isRev ? `£${v}` : String(v))}
        />
        <Tooltip
          cursor={{ stroke: "hsl(170,42%,40%)", strokeWidth: 1, strokeDasharray: "4 4" }}
          contentStyle={{ borderRadius: 12, border: "1px solid hsl(160,15%,88%)", fontSize: 12, boxShadow: "0 4px 14px rgba(0,0,0,0.08)" }}
          formatter={(v: number) => [isRev ? gbp(v) : `${v} orders`, isRev ? "Revenue" : "Orders"]}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="hsl(170,42%,40%)"
          strokeWidth={2.5}
          fill="url(#fillMetric)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function Toggle<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            value === o.value ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const me = useMe();
  const [data, setData] = useState<DashboardData | null>(null);
  const [range, setRange] = useState<7 | 30>(30);
  const [metric, setMetric] = useState<"revenue" | "orders">("revenue");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);

  const isSuperAdmin = me !== "loading" && me?.role === "SUPER_ADMIN";

  async function handleExportCustomers() {
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
  const revenueTrend = computeTrend(data.dailyRevenue, "revenue");
  const ordersTrend = computeTrend(data.dailyRevenue, "orders");
  const avgOrderValue = data.totalOrders > 0 ? data.totalRevenue / data.totalOrders : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your store's performance</p>
        </div>
        {isSuperAdmin && (
          <Button variant="secondary" loading={exporting} onClick={handleExportCustomers} className="flex items-center gap-2">
            <Download size={16} /> Export Customers
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={TrendingUp}
          label="Total Revenue"
          value={gbp(data.totalRevenue)}
          iconClass="bg-primary/10 text-primary"
          trend={revenueTrend}
          caption="Last 7d vs prior 7d"
        />
        <StatCard
          icon={ShoppingCart}
          label="Total Orders"
          value={String(data.totalOrders)}
          iconClass="bg-accent/10 text-accent"
          trend={ordersTrend}
          caption="Last 7d vs prior 7d"
        />
        <StatCard
          icon={Receipt}
          label="Avg Order Value"
          value={gbp(avgOrderValue)}
          iconClass="bg-sky-500/10 text-sky-600"
          caption="Revenue ÷ orders"
        />
        <StatCard
          icon={AlertTriangle}
          label="Low Stock Items"
          value={String(data.lowStockProducts.length)}
          iconClass="bg-amber-500/10 text-amber-600"
          caption={data.lowStockProducts.length > 0 ? "Need restocking" : "All stocked"}
        />
      </div>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">{metric === "revenue" ? "Revenue" : "Orders"} trend</h2>
          <div className="flex items-center gap-2">
            <Toggle
              value={metric}
              onChange={setMetric}
              options={[{ label: "Revenue", value: "revenue" }, { label: "Orders", value: "orders" }]}
            />
            <Toggle
              value={range}
              onChange={setRange}
              options={[{ label: "7d", value: 7 }, { label: "30d", value: 30 }]}
            />
          </div>
        </div>
        <MetricChart data={chartData} metric={metric} />
      </Card>

      {data.lowStockProducts.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-3">
            <AlertTriangle size={16} className="text-amber-600" />
            <h2 className="text-sm font-semibold text-amber-800">Low Stock Alert</h2>
            <Badge variant="warning" className="ml-auto">{data.lowStockProducts.length}</Badge>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Product</th>
                <th className="px-5 py-2.5 text-left font-medium">SKU</th>
                <th className="px-5 py-2.5 text-right font-medium">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.lowStockProducts.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-5 py-3 font-medium text-foreground">{p.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{p.sku}</td>
                  <td className="px-5 py-3 text-right">
                    <Badge variant="warning">{p.stockQuantity} left</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      )}
    </div>
  );
}
