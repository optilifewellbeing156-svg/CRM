import { hashPassword, comparePassword, signToken, verifyToken } from '@/lib/auth'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars-long'
})

describe('hashPassword', () => {
  it('returns a bcrypt hash', async () => {
    const hash = await hashPassword('password123')
    expect(hash).toMatch(/^\$2[ab]\$/)
  })

  it('produces different hashes for the same input', async () => {
    const h1 = await hashPassword('password123')
    const h2 = await hashPassword('password123')
    expect(h1).not.toBe(h2)
  })
})

describe('comparePassword', () => {
  it('returns true for correct password', async () => {
    const hash = await hashPassword('secret')
    expect(await comparePassword('secret', hash)).toBe(true)
  })

  it('returns false for wrong password', async () => {
    const hash = await hashPassword('secret')
    expect(await comparePassword('wrong', hash)).toBe(false)
  })
})

describe('signToken / verifyToken', () => {
  it('round-trips a payload', async () => {
    const payload = { userId: 'abc', username: 'testuser', role: 'USER', permissions: ['dashboard'] }
    const token = await signToken(payload)
    const result = await verifyToken(token)
    expect(result?.userId).toBe('abc')
    expect(result?.username).toBe('testuser')
  })

  it('returns null for a garbage token', async () => {
    const result = await verifyToken('not.a.token')
    expect(result).toBeNull()
  })
})
