import { GET, POST } from '@/app/api/products/route'
import { GET as GET_ONE, PUT, DELETE } from '@/app/api/products/[id]/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

const mockProduct = {
  id: 'p1',
  name: 'Test Product',
  sku: 'SKU001',
  costPrice: new Prisma.Decimal('10.00'),
  sellingPrice: new Prisma.Decimal('20.00'),
  stockQuantity: 50,
  createdAt: new Date(),
}

function makeReq(method: string, body?: object) {
  return new NextRequest('http://localhost/api/products', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('GET /api/products', () => {
  it('returns list of products', async () => {
    ;(prisma.product.findMany as jest.Mock).mockResolvedValue([mockProduct])
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
  })
})

describe('POST /api/products', () => {
  it('returns 400 when required fields missing', async () => {
    const res = await POST(makeReq('POST', { name: 'X' }))
    expect(res.status).toBe(400)
  })

  it('returns 201 on success', async () => {
    ;(prisma.product.create as jest.Mock).mockResolvedValue(mockProduct)
    const res = await POST(
      makeReq('POST', { name: 'Test', sku: 'SKU001', costPrice: 10, sellingPrice: 20, stockQuantity: 50 })
    )
    expect(res.status).toBe(201)
  })
})

describe('DELETE /api/products/[id]', () => {
  it('returns 200 on success', async () => {
    ;(prisma.product.delete as jest.Mock).mockResolvedValue(mockProduct)
    const res = await DELETE(makeReq('DELETE'), { params: { id: 'p1' } })
    expect(res.status).toBe(200)
  })
})
