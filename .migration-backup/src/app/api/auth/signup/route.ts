import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, signToken } from '@/lib/auth'
import { COOKIE_NAME, COOKIE_MAX_AGE } from '@/lib/constants'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { username, password } = body

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  try {
    const hashedPassword = await hashPassword(password)
    const user = await prisma.user.create({
      data: { id: crypto.randomUUID(), username, password: hashedPassword },
      select: { id: true, username: true, role: true, permissions: true },
    })
    const token = await signToken({ userId: user.id, username: user.username, role: user.role, permissions: user.permissions })

    const response = NextResponse.json({ success: true }, { status: 201 })
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    })
    return response
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Username already in use' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
