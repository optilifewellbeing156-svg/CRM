import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { renderToBuffer } from '@react-pdf/renderer'
import { InvoicePDF } from '@/components/features/orders/InvoicePDF'
import React from 'react'
import type { DocumentProps } from '@react-pdf/renderer'

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

  try {
    const buffer = await renderToBuffer(React.createElement(InvoicePDF, { order }) as React.ReactElement<DocumentProps>)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${order.id.slice(0, 8)}.pdf"`,
      },
    })
  } catch (err) {
    console.error('PDF generation error:', err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
