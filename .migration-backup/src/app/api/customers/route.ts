import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const customers = await prisma.customer.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(customers)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, phone, email, address } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Duplicate check
    if (phone) {
      const byPhone = await prisma.customer.findFirst({ where: { phone } })
      if (byPhone) return NextResponse.json({ error: `A customer with phone ${phone} already exists` }, { status: 409 })
    }
    const byName = await prisma.customer.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } })
    if (byName) return NextResponse.json({ error: `A customer named "${name}" already exists` }, { status: 409 })

    const customer = await prisma.customer.create({ data: { name, phone, email, address } })
    return NextResponse.json(customer, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
