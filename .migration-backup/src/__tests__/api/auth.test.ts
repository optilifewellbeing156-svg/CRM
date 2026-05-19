import { POST as signupPOST } from '@/app/api/auth/signup/route'
import { POST as loginPOST } from '@/app/api/auth/login/route'
import { POST as logoutPOST } from '@/app/api/auth/logout/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}))

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars-long'
})

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/signup', () => {
  it('returns 400 when email is missing', async () => {
    const res = await signupPOST(makeRequest({ password: 'pass1234' }))
    expect(res.status).toBe(400)
  })

  it('returns 201 and sets cookie on success', async () => {
    ;(prisma.user.create as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'test@test.com',
      passwordHash: 'hash',
      createdAt: new Date(),
    })
    const res = await signupPOST(makeRequest({ email: 'test@test.com', password: 'password123' }))
    expect(res.status).toBe(201)
    expect(res.headers.get('set-cookie')).toContain('optilife_token')
  })
})

describe('POST /api/auth/login', () => {
  it('returns 401 for non-existent user', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await loginPOST(makeRequest({ email: 'no@no.com', password: 'pass' }))
    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/logout', () => {
  it('returns 200 and clears cookie', async () => {
    const res = await logoutPOST()
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie')).toContain('optilife_token=;')
  })
})
