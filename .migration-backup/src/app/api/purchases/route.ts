import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const purchases = await prisma.purchase.findMany({
    include: { product: { select: { id: true, name: true, sku: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(purchases)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items, reference, batchRef, vatEnabled, vatRate } = body

    // Support both single item (legacy) and multi-item array
    const lineItems: { productId: string; quantity: number; unitCost: number }[] =
      Array.isArray(items)
        ? items
        : [{ productId: body.productId, quantity: Number(body.quantity), unitCost: Number(body.unitCost) }]

    if (!lineItems.length) return NextResponse.json({ error: 'No items provided' }, { status: 400 })

    for (const item of lineItems) {
      if (!item.productId || !item.quantity || !item.unitCost) {
        return NextResponse.json({ error: 'Each item requires productId, quantity, and unitCost' }, { status: 400 })
      }
    }

    const vatR = vatEnabled ? Number(vatRate ?? 0) : 0

    // Validate all products exist
    const productIds = lineItems.map(i => i.productId)
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } })
    if (products.length !== new Set(productIds).size) {
      return NextResponse.json({ error: 'One or more products not found' }, { status: 404 })
    }

    // Build all DB operations
    const ops: any[] = []
    const createdPurchases: any[] = []

    for (const item of lineItems) {
      const qty = item.quantity
      const cost = item.unitCost
      const subTotal = qty * cost
      const vatAmount = vatEnabled ? subTotal * (vatR / 100) : 0
      const totalCost = subTotal + vatAmount

      ops.push(
        prisma.purchase.create({
          data: {
            productId: item.productId,
            quantity: qty,
            unitCost: cost,
            totalCost,
            reference: reference || null,
            batchRef: batchRef || null,
            vatEnabled: !!vatEnabled,
            vatRate: vatR,
            vatAmount,
          },
          include: { product: { select: { id: true, name: true, sku: true } } },
        })
      )
      ops.push(
        prisma.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: qty } },
        })
      )
    }

    const results = await prisma.$transaction(ops as any)
    // purchases are at even indices (0, 2, 4 …)
    for (let i = 0; i < results.length; i += 2) createdPurchases.push(results[i])

    return NextResponse.json(createdPurchases, { status: 201 })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
