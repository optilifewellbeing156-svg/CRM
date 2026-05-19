import { GET, POST } from '@/app/api/customers/route'
import { PUT, DELETE } from '@/app/api/customers/[id]/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

const mockCustomer = {
  id: 'c1',
  name: 'Jane Doe',
  phone: '9999999999',
  email: 'jane@doe.com',
  address: 'Goa',
  createdAt: new Date(),
}

function makeReq(method: string, body?: object) {
  return new NextRequest('http://localhost/api/customers', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('GET /api/customers', () => {
  it('returns customers list', async () => {
    ;(prisma.customer.findMany as jest.Mock).mockResolvedValue([mockCustomer])
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
  })
})

describe('POST /api/customers', () => {
  it('returns 400 when name missing', async () => {
    const res = await POST(makeReq('POST', { phone: '1234' }))
    expect(res.status).toBe(400)
  })

  it('returns 201 on success', async () => {
    ;(prisma.customer.create as jest.Mock).mockResolvedValue(mockCustomer)
    const res = await POST(makeReq('POST', { name: 'Jane Doe', phone: '9999999999' }))
    expect(res.status).toBe(201)
  })
})

describe('DELETE /api/customers/[id]', () => {
  it('returns 200 on success', async () => {
    ;(prisma.customer.delete as jest.Mock).mockResolvedValue(mockCustomer)
    const res = await DELETE(makeReq('DELETE'), { params: { id: 'c1' } })
    expect(res.status).toBe(200)
  })
})
