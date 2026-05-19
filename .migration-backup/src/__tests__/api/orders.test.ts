import { GET, POST } from '@/app/api/orders/route'
import { GET as GET_ONE } from '@/app/api/orders/[id]/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    product: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}))

const mockOrder = {
  id: 'o1',
  customerId: 'c1',
  totalAmount: new Prisma.Decimal('100.00'),
  createdAt: new Date(),
  customer: { name: 'Jane' },
}

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/orders', () => {
  it('returns orders list', async () => {
    ;(prisma.order.findMany as jest.Mock).mockResolvedValue([mockOrder])
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
  })
})

describe('POST /api/orders', () => {
  it('returns 400 when items missing', async () => {
    const res = await POST(makeReq({ customerId: 'c1' }))
    expect(res.status).toBe(400)
  })

  it('returns 201 on success', async () => {
    ;(prisma.$transaction as jest.Mock).mockResolvedValue({ ...mockOrder, items: [] })
    const res = await POST(makeReq({
      customerId: 'c1',
      items: [{ productId: 'p1', quantity: 2 }],
    }))
    expect(res.status).toBe(201)
  })
})
