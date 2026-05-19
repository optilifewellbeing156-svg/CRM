import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcrypt'

export const dynamic = 'force-dynamic'

export async function GET() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      role: true,
      isActive: true,
      commissionRate: true,
      permissions: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(users)
}

export async function POST(request: NextRequest) {
  try {
    const { username, password, role, commissionRate, permissions } = await request.json()
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const exists = await prisma.user.findUnique({ where: { username } })
    if (exists) {
      return NextResponse.json({ error: 'Username already in use' }, { status: 409 })
    }

    const hash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        username,
        password: hash,
        role: role === 'ADMIN' ? 'ADMIN' : 'USER',
        commissionRate: commissionRate ?? 0,
        permissions: Array.isArray(permissions) ? permissions : [],
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
    return NextResponse.json(user, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
