import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { TrendingUp, TrendingDown, ShoppingCart, AlertTriangle, Download, Receipt, CalendarDays, UserRoundX, ChevronRight } from "lucide-react";
import type { DateRange } from "react-day-picker";
import {
  startOfDay, endOfDay, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format,
} from "date-fns";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CustomerOrderHistoryModal } from "@/components/features/customers/CustomerOrderHistoryModal";
import { useMe } from "@/hooks/useMe";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { DashboardData } from "@/types";

type Preset = "today" | "week" | "month" | "custom";

/** Resolve a preset (or a custom range) into the [from, to) window we query.
 *  `to` is exclusive, so an inclusive end date is pushed to the start of the next day. */
function resolveWindow(preset: Preset, custom?: DateRange): { from: Date; to: Date } {
  const now = new Date();
  if (preset === "today") return { from: startOfDay(now), to: addDays(startOfDay(now), 1) };
  if (preset === "week") {
    const start = startOfWeek(now, { weekStartsOn: 1 });
    return { from: start, to: addDays(start, 7) };
  }
  if (preset === "month") {
    return { from: startOfMonth(now), to: addDays(startOfDay(endOfMonth(now)), 1) };
  }
  const start = custom?.from ? startOfDay(custom.from) : startOfDay(now);
  const end = custom?.to ? custom.to : custom?.from ?? now;
  return { from: start, to: addDays(startOfDay(end), 1) };
}

function windowLabel(preset: Preset, w: { from: Date; to: Date }): string {
  const lastDay = addDays(w.to, -1);
  if (preset === "today") return format(w.from, "d MMM yyyy");
  const sameYear = w.from.getFullYear() === lastDay.getFullYear();
  return `${format(w.from, sameYear ? "d MMM" : "d MMM yyyy")} – ${format(lastDay, "d MMM yyyy")}`;
}

/** % change vs the immediately preceding window of equal length.
 *  Null when the prior window had nothing (a delta would be meaningless). */
function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

const gbp = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  const [preset, setPreset] = useState<Preset>("week");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<{ id: string; name: string } | null>(null);
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

  // react-day-picker reports `to === from` after the first click, so a range is
  // only treated as settled once the picker closes — that also lets a deliberate
  // single-day range through.
  const pendingCustom = preset === "custom" && (pickerOpen || !customRange?.from);
  const period = useMemo(
    () => resolveWindow(preset, customRange),
    [preset, customRange?.from?.getTime(), customRange?.to?.getTime()],
  );

  const reqId = useRef(0);
  const load = useCallback((w: { from: Date; to: Date }) => {
    const id = ++reqId.current;
    const fresh = () => id === reqId.current;
    setLoading(true);
    setError(false);
    const qs = new URLSearchParams({ from: w.from.toISOString(), to: w.to.toISOString() });
    fetch(`/api/dashboard?${qs}`, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { if (fresh()) { setData(d); setLoading(false); } })
      .catch(() => { if (fresh()) { setError(true); setLoading(false); } });
  }, []);

  useEffect(() => {
    if (pendingCustom) return;
    load(period);
  }, [load, period, pendingCustom]);

  const revenueTrend = data ? pctChange(data.totalRevenue, data.prevTotalRevenue) : null;
  const ordersTrend = data ? pctChange(data.totalOrders, data.prevTotalOrders) : null;
  const periodCaption = windowLabel(preset, period);
  const comparisonCaption = "vs previous period";

  const periodControls = (
    <div className="flex flex-wrap items-center gap-2">
      <Toggle
        value={preset}
        onChange={(v) => {
          setPreset(v);
          if (v !== "custom") setCustomRange(undefined);
          else setPickerOpen(true);
        }}
        options={[
          { label: "Today", value: "today" as Preset },
          { label: "Weekly", value: "week" as Preset },
          { label: "Monthly", value: "month" as Preset },
          { label: "Custom", value: "custom" as Preset },
        ]}
      />
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={() => setPreset("custom")}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              preset === "custom"
                ? "border-primary/40 bg-primary/5 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarDays size={14} />
            {preset === "custom" && customRange?.from
              ? windowLabel("custom", period)
              : "Pick dates"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="end">
          <Calendar
            mode="range"
            numberOfMonths={2}
            defaultMonth={customRange?.from ?? new Date()}
            selected={customRange}
            onSelect={(r: DateRange | undefined) => {
              setPreset("custom");
              setCustomRange(r);
              if (r?.from && r?.to && r.to.getTime() !== r.from.getTime()) setPickerOpen(false);
            }}
            disabled={{ after: endOfDay(new Date()) }}
          />
          <p className="px-2 pb-1 pt-2 text-xs text-muted-foreground">
            {customRange?.from
              ? "Pick the end date, or close to use just this day."
              : "Select a start and end date."}
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Showing {periodCaption}</p>
        </div>
        {isSuperAdmin && (
          <Button variant="secondary" loading={exporting} onClick={handleExportCustomers} className="flex items-center gap-2">
            <Download size={16} /> Export Customers
          </Button>
        )}
      </div>

      {periodControls}

      {pendingCustom ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Pick an end date to see the figures for that range.
        </Card>
      ) : loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : error || !data ? (
        <p className="py-20 text-center text-sm text-red-500">Failed to load dashboard data.</p>
      ) : (
      <div className="space-y-6">

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={TrendingUp}
          label="Revenue"
          value={gbp(data.totalRevenue)}
          iconClass="bg-primary/10 text-primary"
          trend={revenueTrend}
          caption={comparisonCaption}
        />
        <StatCard
          icon={ShoppingCart}
          label="Orders"
          value={String(data.totalOrders)}
          iconClass="bg-accent/10 text-accent"
          trend={ordersTrend}
          caption={comparisonCaption}
        />
        <StatCard
          icon={Receipt}
          label="Avg Order Value"
          value={gbp(data.avgOrderValue)}
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

      {(() => {
      // Tolerate an API that predates this field: the frontend (Netlify) and the
      // API (Render) deploy independently, so one can be live before the other.
      const dormant = data.dormantCustomers ?? [];
      return (
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <UserRoundX size={16} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Due for follow-up</h2>
          <span className="text-xs text-muted-foreground">No order in the last 30 days</span>
          <Badge variant="warning" className="ml-auto">{dormant.length}</Badge>
        </div>
        {dormant.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Every customer has ordered within the last 30 days.
          </p>
        ) : (
          <ul className="max-h-72 divide-y divide-border overflow-y-auto">
            {dormant.map((c) => {
              const days = Math.floor((Date.now() - new Date(c.lastOrderAt).getTime()) / 86_400_000);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setHistoryCustomer({ id: c.id, name: c.name })}
                    title={`View ${c.name}'s order history and invoices`}
                    className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Last order {new Date(c.lastOrderAt).toLocaleDateString("en-GB")} · {days} days ago
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {c.orderCount} {c.orderCount === 1 ? "order" : "orders"}
                      </span>
                      <span className="text-sm font-medium text-foreground">{gbp(c.totalSpent)}</span>
                      <ChevronRight size={15} className="text-muted-foreground" />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      );
      })()}

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">{metric === "revenue" ? "Revenue" : "Orders"} trend</h2>
          <div className="flex items-center gap-2">
            <Toggle
              value={metric}
              onChange={setMetric}
              options={[{ label: "Revenue", value: "revenue" }, { label: "Orders", value: "orders" }]}
            />
          </div>
        </div>
        <MetricChart data={data.dailyRevenue} metric={metric} />
      </Card>

      {data.lowStockProducts.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-3">
            <AlertTriangle size={16} className="text-amber-600" />
            <h2 className="text-sm font-semibold text-amber-800">Low Stock Alert</h2>
            <Badge variant="warning" className="ml-auto">{data.lowStockProducts.length}</Badge>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full sm:min-w-[480px] text-sm table-cards">
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
                  <td className="px-5 py-3 font-medium text-foreground" data-label="Product">{p.name}</td>
                  <td className="px-5 py-3 text-muted-foreground" data-label="SKU">{p.sku}</td>
                  <td className="px-5 py-3 text-right" data-label="Stock">
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
      )}

      <CustomerOrderHistoryModal customer={historyCustomer} onClose={() => setHistoryCustomer(null)} />
    </div>
  );
}
