import { GET } from '@/app/api/dashboard/route'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      aggregate: jest.fn(),
      count: jest.fn(),
    },
    product: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  },
}))

describe('GET /api/dashboard', () => {
  it('returns stats and daily revenue', async () => {
    ;(prisma.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { totalAmount: new Prisma.Decimal('5000') } })
    ;(prisma.order.count as jest.Mock).mockResolvedValue(10)
    ;(prisma.product.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([])

    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.totalOrders).toBe(10)
    expect(data.lowStockProducts).toEqual([])
    expect(Array.isArray(data.dailyRevenue)).toBe(true)
  })
})
