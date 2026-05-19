import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const customer = await prisma.customer.findUnique({ where: { id: params.id } })
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(customer)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { name, phone } = body

    if (phone) {
      const byPhone = await prisma.customer.findFirst({ where: { phone, NOT: { id: params.id } } })
      if (byPhone) return NextResponse.json({ error: `Another customer with phone ${phone} already exists` }, { status: 409 })
    }
    if (name) {
      const byName = await prisma.customer.findFirst({ where: { name: { equals: name, mode: 'insensitive' }, NOT: { id: params.id } } })
      if (byName) return NextResponse.json({ error: `Another customer named "${name}" already exists` }, { status: 409 })
    }

    const customer = await prisma.customer.update({
      where: { id: params.id },
      data: { name: body.name, phone: body.phone, email: body.email, address: body.address },
    })
    return NextResponse.json(customer)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.customer.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
