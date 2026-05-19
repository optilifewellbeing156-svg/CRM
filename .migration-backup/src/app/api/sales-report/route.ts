import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to) return NextResponse.json({ error: 'from and to are required' }, { status: 400 })

  const fromDate = new Date(from)
  const toDate = new Date(to)
  toDate.setHours(23, 59, 59, 999) // include full end day

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: fromDate, lte: toDate } },
    include: {
      customer: { select: { name: true } },
      items: { include: { product: { select: { name: true } } } },
      user: { select: { id: true, username: true, commissionRate: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0)
  const totalOrders = orders.length
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

  // top products
  const productMap = new Map<string, { name: string; unitsSold: number; revenue: number }>()
  for (const order of orders) {
    for (const item of order.items) {
      const key = item.productId
      const existing = productMap.get(key) ?? { name: item.product.name, unitsSold: 0, revenue: 0 }
      existing.unitsSold += item.quantity
      existing.revenue += Number(item.price) * item.quantity
      productMap.set(key, existing)
    }
  }
  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  // user-wise report with commission
  const userMap = new Map<string, {
    userId: string
    username: string
    totalSales: number
    totalOrders: number
    commissionRate: number
    commission: number
  }>()

  for (const order of orders) {
    if (!order.createdById || !order.user) continue
    const key = order.createdById
    const rate = Number(order.user.commissionRate)
    const amount = Number(order.totalAmount)
    const existing = userMap.get(key) ?? {
      userId: order.user.id,
      username: order.user.username,
      totalSales: 0,
      totalOrders: 0,
      commissionRate: rate,
      commission: 0,
    }
    existing.totalSales += amount
    existing.totalOrders += 1
    existing.commission += amount * (rate / 100)
    userMap.set(key, existing)
  }

  const userReport = Array.from(userMap.values()).sort((a, b) => b.totalSales - a.totalSales)

  return NextResponse.json({
    totalRevenue,
    totalOrders,
    avgOrderValue,
    orders: orders.map(o => ({
      id: o.id,
      customer: o.customer.name,
      createdBy: o.user?.username ?? null,
      itemCount: o.items.length,
      totalAmount: Number(o.totalAmount),
      createdAt: o.createdAt,
      status: o.status,
    })),
    topProducts,
    userReport,
  })
}
