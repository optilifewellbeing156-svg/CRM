import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      items: { include: { product: { select: { name: true } } } },
    },
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(order)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: { items: true },
    })
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const cancelledStatuses = ['CANCELLED', 'REFUNDED']
    const isActive = !cancelledStatuses.includes(order.status)

    // Only restore stock if order was still active (not already cancelled/refunded)
    const ops: any[] = []
    if (isActive) {
      for (const item of order.items) {
        ops.push(prisma.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } },
        }))
      }
    }
    ops.push(prisma.order.delete({ where: { id: params.id } }))

    await prisma.$transaction(ops)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e?.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { customerId, items, invoiceDate, createdById, status, isPaid, paymentMethod } = body

    // If only status is being updated (no items), handle simple status update
    if (status && !items && !customerId) {
      const validStatuses = ['PROCESSING', 'PROCESSED', 'DELIVERED', 'CANCELLED', 'REFUNDED']
      if (!validStatuses.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

      // Fetch current order to check status transition
      const current = await prisma.order.findUnique({
        where: { id: params.id },
        include: { items: true },
      })
      if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const cancelledStatuses = ['CANCELLED', 'REFUNDED']
      const wasActive = !cancelledStatuses.includes(current.status)
      const willBeActive = !cancelledStatuses.includes(status)

      const stockOps: any[] = []

      if (wasActive && !willBeActive) {
        // Active → Cancelled/Refunded: restore stock
        for (const item of current.items) {
          stockOps.push(prisma.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { increment: item.quantity } },
          }))
        }
      } else if (!wasActive && willBeActive) {
        // Cancelled/Refunded → Active: re-deduct stock
        for (const item of current.items) {
          stockOps.push(prisma.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { decrement: item.quantity } },
          }))
        }
      }

      const results = await prisma.$transaction([
        ...stockOps,
        prisma.order.update({
          where: { id: params.id },
          data: { status, ...(isPaid !== undefined && { isPaid }) },
          include: { customer: true, items: { include: { product: true } } },
        }),
      ])

      return NextResponse.json(results[results.length - 1])
    }

    // --- All reads + validation OUTSIDE the transaction ---

    // 1. Fetch existing order
    const existing = await prisma.order.findUnique({
      where: { id: params.id },
      include: { items: true },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // 2. Fetch all affected products in one query
    const newProductIds = items.map((i: any) => i.productId)
    const oldProductIds = existing.items.map(i => i.productId)
    const allProductIds = Array.from(new Set([...newProductIds, ...oldProductIds]))
    const products = await prisma.product.findMany({ where: { id: { in: allProductIds } } })
    const productMap = new Map(products.map(p => [p.id, p]))

    // 3. Calculate effective stock (current + restored old - new)
    const stockDelta = new Map<string, number>()
    for (const item of existing.items) {
      stockDelta.set(item.productId, (stockDelta.get(item.productId) ?? 0) + item.quantity)
    }
    for (const item of items) {
      stockDelta.set(item.productId, (stockDelta.get(item.productId) ?? 0) - item.quantity)
    }

    // 4. Validate stock
    for (const item of items) {
      const product = productMap.get(item.productId)
      if (!product) return NextResponse.json({ error: `Product not found` }, { status: 400 })
      const effectiveStock = Number(product.stockQuantity) + (stockDelta.get(item.productId) ?? 0) + item.quantity
      const netChange = stockDelta.get(item.productId) ?? 0
      const availableAfterRestore = Number(product.stockQuantity) + existing.items.filter(i => i.productId === item.productId).reduce((s, i) => s + i.quantity, 0)
      if (availableAfterRestore < item.quantity) {
        return NextResponse.json({ error: `Insufficient stock for "${product.name}"` }, { status: 400 })
      }
    }

    // 5. Build order items data (use manually provided price if given, else product selling price)
    let totalAmount = 0
    const orderItemsData = items.map((item: any) => {
      const product = productMap.get(item.productId)!
      const unitPrice = item.price !== undefined && Number(item.price) >= 0 ? Number(item.price) : Number(product.sellingPrice)
      totalAmount += unitPrice * item.quantity
      return { productId: item.productId, quantity: item.quantity, price: unitPrice }
    })

    // --- Minimal transaction: only writes ---
    const updated = await prisma.$transaction([
      // Delete old items
      prisma.orderItem.deleteMany({ where: { orderId: params.id } }),
      // Restore stock for old items
      ...existing.items.map(item =>
        prisma.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } },
        })
      ),
      // Deduct stock for new items
      ...items.map((item: any) =>
        prisma.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } },
        })
      ),
      // Update order + create new items
      prisma.order.update({
        where: { id: params.id },
        data: {
          customerId: customerId ?? existing.customerId,
          totalAmount,
          createdById: createdById !== undefined ? createdById : existing.createdById,
          createdAt: invoiceDate ? new Date(invoiceDate) : existing.createdAt,
          status: status ?? existing.status,
          isPaid: isPaid !== undefined ? isPaid : existing.isPaid,
          paymentMethod: paymentMethod !== undefined ? paymentMethod : existing.paymentMethod,
          items: { create: orderItemsData },
        },
        include: {
          customer: true,
          items: { include: { product: { select: { name: true } } } },
        },
      }),
    ])

    // Last element is the updated order
    return NextResponse.json(updated[updated.length - 1])
  } catch (e: any) {
    if (e?.message === 'NOT_FOUND' || e?.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (e?.message?.startsWith('Insufficient stock') || e?.message?.includes('not found')) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
