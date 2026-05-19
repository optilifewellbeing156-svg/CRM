'use client'
import { useState } from 'react'
import { DateRange } from 'react-day-picker'
import { format } from 'date-fns'
import { TrendingUp, ShoppingCart, BarChart3, Users, Download } from 'lucide-react'
import { DateRangePicker } from '@/components/ui/DateRangePicker'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(cell => {
    const s = String(cell ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

type UserReportRow = {
  userId: string
  username: string
  totalOrders: number
  totalSales: number
  commissionRate: number
  commission: number
}

type ReportData = {
  totalRevenue: number
  totalOrders: number
  avgOrderValue: number
  orders: {
    id: string
    customer: string
    createdBy: string | null
    itemCount: number
    totalAmount: number
    createdAt: string
    status: string
  }[]
  topProducts: { name: string; unitsSold: number; revenue: number }[]
  userReport: UserReportRow[]
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  DELIVERED: 'success',
  PROCESSING: 'warning',
  PROCESSED: 'default',
  CANCELLED: 'danger',
  REFUNDED: 'danger',
}

export default function SalesReportPage() {
  const [range, setRange] = useState<DateRange | undefined>(undefined)
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGenerate() {
    if (!range?.from || !range?.to) { setError('Please select a date range'); return }
    setError('')
    setLoading(true)
    try {
      const from = format(range.from, 'yyyy-MM-dd')
      const to = format(range.to, 'yyyy-MM-dd')
      const res = await fetch(`/api/sales-report?from=${from}&to=${to}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      setError('Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  const totalCommission = data?.userReport.reduce((s, r) => s + r.commission, 0) ?? 0

  function handleExport() {
    if (!data) return
    const from = range?.from ? format(range.from, 'dd-MM-yyyy') : 'start'
    const to = range?.to ? format(range.to, 'dd-MM-yyyy') : 'end'

    // Sheet 1 — Orders
    const ordersRows: string[][] = [
      [`Sales Report: ${from} to ${to}`],
      [],
      ['ORDERS'],
      ['Invoice', 'Customer', 'Created By', 'Items', 'Status', 'Total (£)', 'Date'],
      ...data.orders.map(o => [
        '#' + o.id.slice(0, 8).toUpperCase(),
        o.customer,
        o.createdBy ?? '',
        String(o.itemCount),
        o.status,
        o.totalAmount.toFixed(2),
        new Date(o.createdAt).toLocaleDateString('en-GB'),
      ]),
      [],
      ['', '', '', '', 'Total Revenue', data.totalRevenue.toFixed(2)],
      ['', '', '', '', 'Total Orders', String(data.totalOrders)],
      ['', '', '', '', 'Avg Order Value', data.avgOrderValue.toFixed(2)],
      [],
      ['USER COMMISSION REPORT'],
      ['Sales Person', 'Orders', 'Total Sales (£)', 'Commission Rate (%)', 'Commission Earned (£)'],
      ...data.userReport.map(r => [
        r.username,
        String(r.totalOrders),
        r.totalSales.toFixed(2),
        Number(r.commissionRate).toFixed(1),
        r.commission.toFixed(2),
      ]),
      ['', '', '', 'Total Commission Payable', totalCommission.toFixed(2)],
      [],
      ['TOP PRODUCTS'],
      ['Product', 'Units Sold', 'Revenue (£)'],
      ...data.topProducts.map(p => [p.name, String(p.unitsSold), p.revenue.toFixed(2)]),
    ]

    downloadCSV(`sales-report-${from}-to-${to}.csv`, ordersRows)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Sales Report</h1>

      {/* Date Range Selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
        <DateRangePicker range={range} onChange={setRange} />
        <Button onClick={handleGenerate} loading={loading}>Generate Report</Button>
        {data && !loading && (
          <Button variant="secondary" onClick={handleExport} className="flex items-center gap-2">
            <Download size={15} /> Export CSV
          </Button>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      {loading && <div className="flex justify-center py-16"><Spinner size="lg" /></div>}

      {data && !loading && (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { icon: TrendingUp, label: 'Total Revenue', value: `£${data.totalRevenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, color: 'bg-primary' },
              { icon: ShoppingCart, label: 'Total Orders', value: String(data.totalOrders), color: 'bg-accent' },
              { icon: BarChart3, label: 'Avg Order Value', value: `£${data.avgOrderValue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, color: 'bg-sidebar' },
              { icon: Users, label: 'Total Commission', value: `£${totalCommission.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, color: 'bg-amber-500' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
                <div className={`p-3 rounded-lg ${color}`}><Icon size={20} className="text-white" /></div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* User Commission Report */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">Sales by User &amp; Commission</h2>
            </div>
            {data.userReport.length === 0 ? (
              <p className="text-center py-10 text-sm text-gray-400">No user-linked orders in this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Sales Person</th>
                    <th className="px-4 py-2 text-center font-medium">Orders</th>
                    <th className="px-4 py-2 text-right font-medium">Total Sales</th>
                    <th className="px-4 py-2 text-center font-medium">Commission Rate</th>
                    <th className="px-4 py-2 text-right font-medium">Commission Earned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.userReport.map(r => (
                    <tr key={r.userId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium capitalize">{r.username}</td>
                      <td className="px-4 py-3 text-center">{r.totalOrders}</td>
                      <td className="px-4 py-3 text-right">£{r.totalSales.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          {Number(r.commissionRate).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-700">
                        £{r.commission.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-gray-700" colSpan={4}>Total Commission Payable</td>
                    <td className="px-4 py-3 text-right font-bold text-green-700 text-base">
                      £{totalCommission.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b">
              <h2 className="text-sm font-semibold text-gray-700">Orders ({data.totalOrders})</h2>
            </div>
            {data.orders.length === 0 ? (
              <p className="text-center py-10 text-sm text-gray-400">No orders in this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Invoice</th>
                    <th className="px-4 py-2 text-left font-medium">Customer</th>
                    <th className="px-4 py-2 text-left font-medium">Created By</th>
                    <th className="px-4 py-2 text-center font-medium">Items</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                    <th className="px-4 py-2 text-left font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.orders.map(o => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">#{o.id.slice(0, 8).toUpperCase()}</td>
                      <td className="px-4 py-3 font-medium">{o.customer}</td>
                      <td className="px-4 py-3 text-gray-500 capitalize">{o.createdBy ?? '—'}</td>
                      <td className="px-4 py-3 text-center">{o.itemCount}</td>
                      <td className="px-4 py-3"><Badge variant={STATUS_VARIANT[o.status] ?? 'default'}>{o.status}</Badge></td>
                      <td className="px-4 py-3 text-right font-medium">£{o.totalAmount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-gray-500">{new Date(o.createdAt).toLocaleDateString('en-GB')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Top Products */}
          {data.topProducts.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b">
                <h2 className="text-sm font-semibold text-gray-700">Top Products</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Product</th>
                    <th className="px-4 py-2 text-center font-medium">Units Sold</th>
                    <th className="px-4 py-2 text-right font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.topProducts.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-center">{p.unitsSold}</td>
                      <td className="px-4 py-3 text-right">£{p.revenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
