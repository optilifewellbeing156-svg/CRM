import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { COOKIE_NAME } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    userId: payload.userId,
    username: payload.username,
    role: payload.role,
    permissions: payload.permissions,
  })
}
