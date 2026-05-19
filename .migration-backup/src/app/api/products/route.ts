import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(products)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, sku, costPrice, sellingPrice, stockQuantity, lowStockThreshold } = body

    if (!name || !sku || costPrice == null || sellingPrice == null) {
      return NextResponse.json({ error: 'name, sku, costPrice, and sellingPrice are required' }, { status: 400 })
    }

    const product = await prisma.product.create({
      data: { name, sku, costPrice, sellingPrice, stockQuantity: stockQuantity ?? 0, lowStockThreshold: lowStockThreshold ?? 10 },
    })
    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'SKU already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
