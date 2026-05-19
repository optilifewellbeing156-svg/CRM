import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { COOKIE_NAME } from '@/lib/constants'

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is not set')
  return new TextEncoder().encode(secret)
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value

  if (!token) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const { payload } = await jwtVerify(token, getSecret())

    const role = typeof payload.role === 'string' ? payload.role : 'USER'
    const permissions = Array.isArray(payload.permissions) ? payload.permissions as string[] : []

    // ADMIN bypasses all permission checks
    if (role === 'ADMIN') {
      return NextResponse.next()
    }

    // For USER role, check permissions
    const pathname = request.nextUrl.pathname

    const routePermissions: Record<string, string> = {
      '/dashboard': 'dashboard',
      '/products': 'products',
      '/purchases': 'purchases',
      '/customers': 'customers',
      '/orders': 'orders',
      '/sales-report': 'sales-report',
      '/api/products': 'products',
      '/api/purchases': 'purchases',
      '/api/customers': 'customers',
      '/api/orders': 'orders',
      '/api/dashboard': 'dashboard',
      '/api/sales-report': 'sales-report',
      '/users': 'ADMIN_ONLY',
      '/api/users': 'ADMIN_ONLY',
    }

    // More granular route checks (checked before the above map)
    if (pathname === '/orders/new' && !permissions.includes('create-orders')) {
      return NextResponse.redirect(new URL('/orders', request.url))
    }
    if (pathname.match(/^\/orders\/[^/]+\/edit$/) && !permissions.includes('edit-orders')) {
      return NextResponse.redirect(new URL('/orders', request.url))
    }

    for (const [prefix, requiredPerm] of Object.entries(routePermissions)) {
      if (pathname.startsWith(prefix)) {
        if (requiredPerm === 'ADMIN_ONLY') {
          if (pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
          }
          return NextResponse.redirect(new URL('/dashboard', request.url))
        }
        if (!permissions.includes(requiredPerm)) {
          if (pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
          }
          return NextResponse.redirect(new URL('/dashboard', request.url))
        }
        break
      }
    }

    return NextResponse.next()
  } catch {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/products/:path*',
    '/purchases/:path*',
    '/customers/:path*',
    '/orders/:path*',
    '/users/:path*',
    '/api/products/:path*',
    '/api/purchases/:path*',
    '/api/customers/:path*',
    '/api/orders/:path*',
    '/api/users/:path*',
    '/api/dashboard',
    '/api/auth/me',
    '/sales-report/:path*',
    '/api/sales-report',
  ],
}
