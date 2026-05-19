import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcrypt'

const SALT_ROUNDS = 12

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is not set')
  return new TextEncoder().encode(secret)
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function signToken(payload: { userId: string; username: string; role: string; permissions: string[] }): Promise<string> {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<{ userId: string; username: string; role: string; permissions: string[] } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    const { userId, username, role, permissions } = payload
    if (typeof userId !== 'string' || typeof username !== 'string') return null
    return {
      userId,
      username,
      role: typeof role === 'string' ? role : 'USER',
      permissions: Array.isArray(permissions) ? permissions as string[] : [],
    }
  } catch {
    return null
  }
}
