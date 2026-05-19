import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { COOKIE_NAME } from '@/lib/constants'

export const dynamic = 'force-dynamic'

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value
  const payload = token ? await verifyToken(token) : null
  return payload?.role === 'ADMIN'
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const body = await request.json()
    const { productId, quantity, unitCost, reference, batchRef, vatEnabled, vatRate } = body

    const qty = Number(quantity)
    const cost = Number(unitCost)
    const vatR = vatEnabled ? Number(vatRate ?? 0) : 0
    const subTotal = qty * cost
    const vatAmount = vatEnabled ? subTotal * (vatR / 100) : 0
    const totalCost = subTotal + vatAmount

    // Get existing purchase to know old quantity for stock adjustment
    const existing = await prisma.purchase.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const qtyDiff = qty - existing.quantity
    const productChanged = productId !== existing.productId

    const ops: any[] = [
      prisma.purchase.update({
        where: { id: params.id },
        data: { productId, quantity: qty, unitCost: cost, totalCost, reference: reference || null, batchRef: batchRef || null, vatEnabled: !!vatEnabled, vatRate: vatR, vatAmount },
        include: { product: { select: { id: true, name: true, sku: true } } },
      }),
    ]

    if (productChanged) {
      // Restore old product stock fully, deduct from new product fully
      ops.push(prisma.product.update({ where: { id: existing.productId }, data: { stockQuantity: { decrement: existing.quantity } } }))
      ops.push(prisma.product.update({ where: { id: productId }, data: { stockQuantity: { increment: qty } } }))
    } else if (qtyDiff !== 0) {
      // Same product — just apply the difference
      ops.push(prisma.product.update({ where: { id: productId }, data: { stockQuantity: { increment: qtyDiff } } }))
    }

    const results = await prisma.$transaction(ops)
    return NextResponse.json(results[0])
  } catch (e: any) {
    if (e?.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const purchase = await prisma.purchase.findUnique({ where: { id: params.id } })
    if (!purchase) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.$transaction([
      prisma.purchase.delete({ where: { id: params.id } }),
      prisma.product.update({
        where: { id: purchase.productId },
        data: { stockQuantity: { decrement: purchase.quantity } },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e?.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
