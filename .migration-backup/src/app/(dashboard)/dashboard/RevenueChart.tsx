'use client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type Props = { data: { date: string; revenue: number }[] }

export default function RevenueChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-center text-gray-400 py-10 text-sm">No revenue data yet.</p>
  }

  const formatted = data.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
    revenue: Number(d.revenue.toFixed(2)),
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={formatted} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `£${v}`} />
        <Tooltip formatter={(v: number) => [`£${v.toFixed(2)}`, 'Revenue']} />
        <Line type="monotone" dataKey="revenue" stroke="#2D7D6F" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
