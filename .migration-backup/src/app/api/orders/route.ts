import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { COOKIE_NAME } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export async function GET() {
  const orders = await prisma.order.findMany({
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(orders)
}

export async function POST(request: NextRequest) {
  try {
    const { customerId, items, createdById: bodyCreatedById, invoiceDate, isPaid, paymentMethod } = await request.json()
    const token = request.cookies.get(COOKIE_NAME)?.value
    const payload = token ? await verifyToken(token) : null
    const createdById = bodyCreatedById || payload?.userId || null

    if (!customerId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'customerId and at least one item are required' }, { status: 400 })
    }

    // --- All reads + validation OUTSIDE the transaction ---

    // 1. Fetch all products in one query
    const productIds = (items as { productId: string; quantity: number }[]).map(i => i.productId)
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } })
    const productMap = new Map(products.map(p => [p.id, p]))

    // 2. Validate stock and build order items
    let totalAmount = 0
    const orderItemsData: { productId: string; quantity: number; price: number }[] = []

    for (const item of items as { productId: string; quantity: number; price?: number }[]) {
      const product = productMap.get(item.productId)
      if (!product) return NextResponse.json({ error: `Product not found` }, { status: 400 })
      if (product.stockQuantity < item.quantity) {
        return NextResponse.json({ error: `Insufficient stock for "${product.name}"` }, { status: 400 })
      }
      // Use manually provided price if given, otherwise fall back to product's selling price
      const unitPrice = item.price !== undefined && item.price >= 0 ? item.price : Number(product.sellingPrice)
      totalAmount += unitPrice * item.quantity
      orderItemsData.push({ productId: item.productId, quantity: item.quantity, price: unitPrice })
    }

    // --- Minimal batch transaction: writes only ---
    const orderId = crypto.randomUUID()

    const results = await prisma.$transaction([
      // Deduct stock for each item
      ...(items as { productId: string; quantity: number }[]).map(item =>
        prisma.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } },
        })
      ),
      // Create the order with items
      prisma.order.create({
        data: {
          id: orderId,
          customerId,
          totalAmount,
          createdById,
          status: 'PROCESSING',
          createdAt: invoiceDate ? new Date(invoiceDate) : new Date(),
          isPaid: isPaid ?? false,
          paymentMethod: paymentMethod ?? null,
          items: { create: orderItemsData },
        },
        include: { customer: true, items: { include: { product: true } } },
      }),
    ])

    // Last element is the created order
    const order = results[results.length - 1]
    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error'
    const status = msg.includes('not found') || msg.includes('Insufficient') ? 400 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
