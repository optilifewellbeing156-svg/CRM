import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { LOW_STOCK_THRESHOLD } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [revenueResult, totalOrders, lowStockProducts, dailyRevenue] = await Promise.all([
    prisma.order.aggregate({ _sum: { totalAmount: true } }),
    prisma.order.count(),
    prisma.product.findMany({
      where: { stockQuantity: { lt: LOW_STOCK_THRESHOLD } },
      orderBy: { stockQuantity: 'asc' },
    }),
    prisma.$queryRaw<{ date: string; revenue: number }[]>`
      SELECT
        DATE(created_at)::text AS date,
        SUM(total_amount)::float AS revenue
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `,
  ])

  return NextResponse.json({
    totalRevenue: Number(revenueResult._sum.totalAmount ?? 0),
    totalOrders,
    lowStockProducts,
    dailyRevenue,
  })
}
