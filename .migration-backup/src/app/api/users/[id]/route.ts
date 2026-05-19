import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { username, role, commissionRate, isActive, permissions, password } = await request.json()

    if (password !== undefined && password !== '' && password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...(username && { username }),
        ...(role && { role: role === 'ADMIN' ? 'ADMIN' : 'USER' }),
        ...(commissionRate !== undefined && { commissionRate }),
        ...(isActive !== undefined && { isActive }),
        ...(permissions !== undefined && { permissions }),
        ...(password && password.length >= 8 && { password: await bcrypt.hash(password, 12) }),
      },
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        commissionRate: true,
        permissions: true,
        createdAt: true,
      },
    })
    return NextResponse.json(user)
  } catch (e: unknown) {
    const err = e as { code?: string }
    if (err?.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (err?.code === 'P2002') return NextResponse.json({ error: 'Username already in use' }, { status: 409 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.user.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const err = e as { code?: string }
    if (err?.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
