# OptiLifeWellbeing ERP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready single-admin ERP for OptiLifeWellbeing covering inventory, customers, invoices, dashboard with revenue chart, and PDF invoice export.

**Architecture:** Single Next.js 14 (App Router) monorepo. API routes handle all backend logic with Prisma + Neon PostgreSQL. JWT stored in httpOnly cookie, verified by Next.js root middleware on all protected routes.

**Tech Stack:** Next.js 14, TypeScript, Prisma, Neon PostgreSQL, Tailwind CSS, jose (JWT), bcrypt, Recharts, @react-pdf/renderer, lucide-react, Jest, React Testing Library

---

## File Map

```
optilife-erp/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── products/page.tsx
│   │   │   ├── customers/page.tsx
│   │   │   ├── orders/page.tsx
│   │   │   ├── orders/new/page.tsx
│   │   │   └── orders/[id]/page.tsx
│   │   └── api/
│   │       ├── auth/signup/route.ts
│   │       ├── auth/login/route.ts
│   │       ├── auth/logout/route.ts
│   │       ├── dashboard/route.ts
│   │       ├── products/route.ts
│   │       ├── products/[id]/route.ts
│   │       ├── customers/route.ts
│   │       ├── customers/[id]/route.ts
│   │       ├── orders/route.ts
│   │       ├── orders/[id]/route.ts
│   │       └── orders/[id]/pdf/route.ts
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Spinner.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── SlideOver.tsx
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── Navbar.tsx
│   │   └── features/
│   │       ├── products/ProductForm.tsx
│   │       ├── customers/CustomerForm.tsx
│   │       ├── orders/OrderForm.tsx
│   │       └── orders/InvoicePDF.tsx
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── auth.ts
│   │   └── constants.ts
│   ├── types/
│   │   └── index.ts
│   └── middleware.ts
├── src/__tests__/
│   ├── lib/auth.test.ts
│   ├── api/products.test.ts
│   ├── api/customers.test.ts
│   ├── api/orders.test.ts
│   └── api/dashboard.test.ts
├── jest.config.ts
├── jest.setup.ts
├── .env.example
├── next.config.ts
├── tailwind.config.ts
└── postcss.config.js
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `jest.config.ts`
- Create: `jest.setup.ts`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "optilife-erp",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "jest",
    "test:watch": "jest --watch"
  },
  "dependencies": {
    "next": "14.2.3",
    "react": "^18",
    "react-dom": "^18",
    "@prisma/client": "^5.14.0",
    "bcrypt": "^5.1.1",
    "jose": "^5.6.3",
    "recharts": "^2.12.7",
    "@react-pdf/renderer": "^3.4.4",
    "lucide-react": "^0.395.0"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "@types/bcrypt": "^5.0.2",
    "prisma": "^5.14.0",
    "tailwindcss": "^3.4.4",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.5",
    "@types/jest": "^29.5.12",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.6",
    "jest-environment-jsdom": "^29.7.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create next.config.ts**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@react-pdf/renderer'],
  },
}

export default nextConfig
```

- [ ] **Step 4: Create tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2D7D6F',
        accent: '#4CAF7D',
        sidebar: '#1A4D44',
        background: '#F7FAF9',
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 5: Create postcss.config.js**

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 6: Create jest.config.ts**

```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'node',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testPathPattern: ['src/__tests__'],
}

export default createJestConfig(config)
```

- [ ] **Step 7: Create jest.setup.ts**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 8: Create .env.example**

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
JWT_SECRET="replace-with-a-long-random-secret-at-least-32-chars"
NODE_ENV="development"
```

- [ ] **Step 9: Create .gitignore**

```
node_modules/
.next/
.env
.env.local
```

- [ ] **Step 10: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 11: Commit**

```bash
git init
git add package.json tsconfig.json next.config.ts tailwind.config.ts postcss.config.js jest.config.ts jest.setup.ts .env.example .gitignore
git commit -m "chore: project scaffolding"
```

---

## Task 2: Prisma Schema + Database

**Files:**
- Create: `prisma/schema.prisma`
- Create: `.env` (from `.env.example`, filled in)

- [ ] **Step 1: Create prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
}

model Product {
  id            String      @id @default(uuid())
  name          String
  sku           String      @unique
  costPrice     Decimal     @db.Decimal(10, 2)
  sellingPrice  Decimal     @db.Decimal(10, 2)
  stockQuantity Int         @default(0)
  createdAt     DateTime    @default(now())
  orderItems    OrderItem[]
}

model Customer {
  id        String   @id @default(uuid())
  name      String
  phone     String?
  email     String?
  address   String?
  createdAt DateTime @default(now())
  orders    Order[]
}

model Order {
  id          String      @id @default(uuid())
  customerId  String
  customer    Customer    @relation(fields: [customerId], references: [id])
  totalAmount Decimal     @db.Decimal(10, 2)
  createdAt   DateTime    @default(now())
  items       OrderItem[]
}

model OrderItem {
  id        String  @id @default(uuid())
  orderId   String
  order     Order   @relation(fields: [orderId], references: [id])
  productId String
  product   Product @relation(fields: [productId], references: [id])
  quantity  Int
  price     Decimal @db.Decimal(10, 2)
}
```

- [ ] **Step 2: Copy .env.example to .env and fill in your Neon DATABASE_URL and a JWT_SECRET**

```bash
cp .env.example .env
# Edit .env and fill in:
# DATABASE_URL="postgresql://<user>:<password>@<host>/<db>?sslmode=require"
# JWT_SECRET="some-long-random-string-minimum-32-chars"
```

- [ ] **Step 3: Generate Prisma client and run migration**

```bash
npx prisma generate
npx prisma migrate dev --name init
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: prisma schema with User, Product, Customer, Order, OrderItem"
```

---

## Task 3: Core Libraries

**Files:**
- Create: `src/lib/prisma.ts`
- Create: `src/lib/auth.ts`
- Create: `src/lib/constants.ts`
- Create: `src/types/index.ts`
- Create: `src/__tests__/lib/auth.test.ts`

- [ ] **Step 1: Write failing test for auth library**

Create `src/__tests__/lib/auth.test.ts`:

```typescript
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
    const payload = { userId: 'abc', email: 'a@b.com' }
    const token = await signToken(payload)
    const result = await verifyToken(token)
    expect(result?.userId).toBe('abc')
    expect(result?.email).toBe('a@b.com')
  })

  it('returns null for a garbage token', async () => {
    const result = await verifyToken('not.a.token')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run test — expect FAIL (module not found)**

```bash
npx jest src/__tests__/lib/auth.test.ts
```

Expected: `Cannot find module '@/lib/auth'`

- [ ] **Step 3: Create src/lib/auth.ts**

```typescript
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcrypt'

const SALT_ROUNDS = 12

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET!)
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function signToken(payload: { userId: string; email: string }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<{ userId: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as { userId: string; email: string }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx jest src/__tests__/lib/auth.test.ts
```

Expected: `4 passed`

- [ ] **Step 5: Create src/lib/prisma.ts**

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 6: Create src/lib/constants.ts**

```typescript
export const LOW_STOCK_THRESHOLD = 10
export const COOKIE_NAME = 'optilife_token'
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days
```

- [ ] **Step 7: Create src/types/index.ts**

```typescript
export type Product = {
  id: string
  name: string
  sku: string
  costPrice: string
  sellingPrice: string
  stockQuantity: number
  createdAt: string
}

export type Customer = {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  createdAt: string
}

export type OrderItem = {
  id: string
  productId: string
  quantity: number
  price: string
  product?: { name: string }
}

export type Order = {
  id: string
  customerId: string
  totalAmount: string
  createdAt: string
  customer?: { name: string }
  items?: OrderItem[]
}

export type DashboardData = {
  totalRevenue: number
  totalOrders: number
  lowStockProducts: Product[]
  dailyRevenue: { date: string; revenue: number }[]
}
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/ src/types/ src/__tests__/lib/
git commit -m "feat: auth library, prisma singleton, shared types"
```

---

## Task 4: Auth API Routes

**Files:**
- Create: `src/app/api/auth/signup/route.ts`
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/__tests__/api/auth.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/api/auth.test.ts`:

```typescript
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

const mockPrisma = prisma as jest.Mocked<typeof prisma>

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
    ;(mockPrisma.user.create as jest.Mock).mockResolvedValue({
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
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null)
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
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx jest src/__tests__/api/auth.test.ts
```

Expected: `Cannot find module '@/app/api/auth/signup/route'`

- [ ] **Step 3: Create src/app/api/auth/signup/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, signToken } from '@/lib/auth'
import { COOKIE_NAME, COOKIE_MAX_AGE } from '@/lib/constants'
import { Prisma } from '@prisma/client'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { email, password } = body

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  try {
    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({ data: { email, passwordHash } })
    const token = await signToken({ userId: user.id, email: user.email })

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
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Create src/app/api/auth/login/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { comparePassword, signToken } from '@/lib/auth'
import { COOKIE_NAME, COOKIE_MAX_AGE } from '@/lib/constants'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { email, password } = body

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const valid = await comparePassword(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = await signToken({ userId: user.id, email: user.email })
  const response = NextResponse.json({ success: true })
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
  return response
}
```

- [ ] **Step 5: Create src/app/api/auth/logout/route.ts**

```typescript
import { NextResponse } from 'next/server'
import { COOKIE_NAME } from '@/lib/constants'

export async function POST() {
  const response = NextResponse.json({ success: true })
  response.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' })
  return response
}
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
npx jest src/__tests__/api/auth.test.ts
```

Expected: `5 passed`

- [ ] **Step 7: Commit**

```bash
git add src/app/api/auth/ src/__tests__/api/auth.test.ts
git commit -m "feat: auth API routes (signup, login, logout)"
```

---

## Task 5: Middleware (Route Protection)

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create src/middleware.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { COOKIE_NAME } from '@/lib/constants'

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET!)
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    await jwtVerify(token, getSecret())
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/products/:path*',
    '/customers/:path*',
    '/orders/:path*',
  ],
}
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: JWT middleware protecting dashboard routes"
```

---

## Task 6: Global CSS + App Root

**Files:**
- Create: `src/app/globals.css`
- Create: `src/app/layout.tsx`

- [ ] **Step 1: Create src/app/globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #F7FAF9;
}
```

- [ ] **Step 2: Create src/app/layout.tsx**

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'OptiLifeWellbeing ERP',
  description: 'Inventory, customers and invoices',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 3: Create src/app/page.tsx (root redirect)**

```typescript
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/dashboard')
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/
git commit -m "feat: root layout and global CSS"
```

---

## Task 7: UI Primitives

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Input.tsx`
- Create: `src/components/ui/Badge.tsx`
- Create: `src/components/ui/Spinner.tsx`
- Create: `src/components/ui/Modal.tsx`
- Create: `src/components/ui/SlideOver.tsx`

- [ ] **Step 1: Create src/components/ui/Button.tsx**

```typescript
import { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
}

const variants: Record<Variant, string> = {
  primary: 'bg-primary hover:bg-primary/90 text-white',
  secondary: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300',
  danger: 'bg-red-500 hover:bg-red-600 text-white',
}

export function Button({ variant = 'primary', loading, children, className = '', disabled, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          {children}
        </span>
      ) : children}
    </button>
  )
}
```

- [ ] **Step 2: Create src/components/ui/Input.tsx**

```typescript
import { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <input
        {...props}
        className={`px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${error ? 'border-red-400' : 'border-gray-300'} ${className}`}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
```

- [ ] **Step 3: Create src/components/ui/Badge.tsx**

```typescript
type BadgeVariant = 'success' | 'warning' | 'danger' | 'default'

const variants: Record<BadgeVariant, string> = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
  default: 'bg-gray-100 text-gray-700',
}

export function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: BadgeVariant }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  )
}
```

- [ ] **Step 4: Create src/components/ui/Spinner.tsx**

```typescript
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' }
  return (
    <svg className={`animate-spin text-primary ${sizes[size]}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}
```

- [ ] **Step 5: Create src/components/ui/Modal.tsx**

```typescript
'use client'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}

export function Modal({ open, title, onClose, children }: ModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-semibold mb-4">{title}</h2>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create src/components/ui/SlideOver.tsx**

```typescript
'use client'

interface SlideOverProps {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}

export function SlideOver({ open, title, onClose, children }: SlideOverProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md h-full shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/
git commit -m "feat: UI primitives (Button, Input, Badge, Spinner, Modal, SlideOver)"
```

---

## Task 8: Layout + Login Page

**Files:**
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/components/layout/Navbar.tsx`
- Create: `src/app/(dashboard)/layout.tsx`
- Create: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Create src/components/layout/Sidebar.tsx**

```typescript
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, Users, ShoppingCart } from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/products', label: 'Products', Icon: Package },
  { href: '/customers', label: 'Customers', Icon: Users },
  { href: '/orders', label: 'Orders', Icon: ShoppingCart },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-sidebar flex flex-col z-40">
      <div className="px-6 py-5 border-b border-white/10">
        <h1 className="text-white font-bold text-base leading-snug">
          OptiLife<br />Wellbeing
        </h1>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={17} />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 2: Create src/components/layout/Navbar.tsx**

```typescript
'use client'
import { useRouter } from 'next/navigation'

export function Navbar() {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-end px-6">
      <button
        onClick={handleLogout}
        className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        Sign out
      </button>
    </header>
  )
}
```

- [ ] **Step 3: Create src/app/(dashboard)/layout.tsx**

```typescript
import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-60 flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create src/app/(auth)/login/page.tsx**

```typescript
'use client'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Login failed')
      } else {
        router.push('/dashboard')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-sm p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-primary">OptiLifeWellbeing</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" loading={loading} className="w-full">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/ src/app/\(dashboard\)/ src/app/\(auth\)/
git commit -m "feat: sidebar, navbar, dashboard layout, login page"
```

---

## Task 9: Products API

**Files:**
- Create: `src/app/api/products/route.ts`
- Create: `src/app/api/products/[id]/route.ts`
- Create: `src/__tests__/api/products.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/api/products.test.ts`:

```typescript
import { GET, POST } from '@/app/api/products/route'
import { GET as GET_ONE, PUT, DELETE } from '@/app/api/products/[id]/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockProduct = {
  id: 'p1',
  name: 'Test Product',
  sku: 'SKU001',
  costPrice: new Prisma.Decimal('10.00'),
  sellingPrice: new Prisma.Decimal('20.00'),
  stockQuantity: 50,
  createdAt: new Date(),
}

function makeReq(method: string, body?: object) {
  return new NextRequest('http://localhost/api/products', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('GET /api/products', () => {
  it('returns list of products', async () => {
    ;(mockPrisma.product.findMany as jest.Mock).mockResolvedValue([mockProduct])
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
  })
})

describe('POST /api/products', () => {
  it('returns 400 when required fields missing', async () => {
    const res = await POST(makeReq('POST', { name: 'X' }))
    expect(res.status).toBe(400)
  })

  it('returns 201 on success', async () => {
    ;(mockPrisma.product.create as jest.Mock).mockResolvedValue(mockProduct)
    const res = await POST(
      makeReq('POST', { name: 'Test', sku: 'SKU001', costPrice: 10, sellingPrice: 20, stockQuantity: 50 })
    )
    expect(res.status).toBe(201)
  })
})

describe('DELETE /api/products/[id]', () => {
  it('returns 200 on success', async () => {
    ;(mockPrisma.product.delete as jest.Mock).mockResolvedValue(mockProduct)
    const res = await DELETE(makeReq('DELETE'), { params: { id: 'p1' } })
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx jest src/__tests__/api/products.test.ts
```

Expected: `Cannot find module '@/app/api/products/route'`

- [ ] **Step 3: Create src/app/api/products/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function GET() {
  const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(products)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, sku, costPrice, sellingPrice, stockQuantity } = body

  if (!name || !sku || costPrice == null || sellingPrice == null) {
    return NextResponse.json({ error: 'name, sku, costPrice, and sellingPrice are required' }, { status: 400 })
  }

  try {
    const product = await prisma.product.create({
      data: { name, sku, costPrice, sellingPrice, stockQuantity: stockQuantity ?? 0 },
    })
    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'SKU already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Create src/app/api/products/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const product = await prisma.product.findUnique({ where: { id: params.id } })
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(product)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()
  const { name, sku, costPrice, sellingPrice, stockQuantity } = body

  try {
    const product = await prisma.product.update({
      where: { id: params.id },
      data: { name, sku, costPrice, sellingPrice, stockQuantity },
    })
    return NextResponse.json(product)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.product.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
npx jest src/__tests__/api/products.test.ts
```

Expected: `4 passed`

- [ ] **Step 6: Commit**

```bash
git add src/app/api/products/ src/__tests__/api/products.test.ts
git commit -m "feat: products CRUD API routes"
```

---

## Task 10: Products Page

**Files:**
- Create: `src/components/features/products/ProductForm.tsx`
- Create: `src/app/(dashboard)/products/page.tsx`

- [ ] **Step 1: Create src/components/features/products/ProductForm.tsx**

```typescript
'use client'
import { useState, FormEvent } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { Product } from '@/types'

interface ProductFormProps {
  initial?: Product
  onSuccess: () => void
}

export function ProductForm({ initial, onSuccess }: ProductFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [sku, setSku] = useState(initial?.sku ?? '')
  const [costPrice, setCostPrice] = useState(initial?.costPrice ?? '')
  const [sellingPrice, setSellingPrice] = useState(initial?.sellingPrice ?? '')
  const [stockQuantity, setStockQuantity] = useState(String(initial?.stockQuantity ?? ''))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const url = initial ? `/api/products/${initial.id}` : '/api/products'
      const method = initial ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          sku,
          costPrice: Number(costPrice),
          sellingPrice: Number(sellingPrice),
          stockQuantity: Number(stockQuantity),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to save product')
      } else {
        onSuccess()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Product Name" value={name} onChange={e => setName(e.target.value)} required />
      <Input label="SKU" value={sku} onChange={e => setSku(e.target.value)} required />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Cost Price (₹)" type="number" step="0.01" value={costPrice} onChange={e => setCostPrice(e.target.value)} required />
        <Input label="Selling Price (₹)" type="number" step="0.01" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} required />
      </div>
      <Input label="Stock Quantity" type="number" value={stockQuantity} onChange={e => setStockQuantity(e.target.value)} required />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" loading={loading} className="w-full">
        {initial ? 'Update Product' : 'Add Product'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Create src/app/(dashboard)/products/page.tsx**

```typescript
'use client'
import { useState, useEffect, useCallback } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { SlideOver } from '@/components/ui/SlideOver'
import { Modal } from '@/components/ui/Modal'
import { ProductForm } from '@/components/features/products/ProductForm'
import { LOW_STOCK_THRESHOLD } from '@/lib/constants'
import type { Product } from '@/types'

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [slideOpen, setSlideOpen] = useState(false)
  const [editing, setEditing] = useState<Product | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/products')
    const data = await res.json()
    setProducts(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  )

  function openCreate() { setEditing(undefined); setSlideOpen(true) }
  function openEdit(p: Product) { setEditing(p); setSlideOpen(true) }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await fetch(`/api/products/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleteTarget(null)
    setDeleting(false)
    fetchProducts()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <Button onClick={openCreate} className="flex items-center gap-2">
          <Plus size={16} /> Add Product
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b">
          <input
            className="w-full max-w-xs px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">No products found. Add your first product.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
              <tr>
                {['Name', 'SKU', 'Cost Price', 'Selling Price', 'Stock', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(p => {
                const lowStock = p.stockQuantity < LOW_STOCK_THRESHOLD
                return (
                  <tr key={p.id} className={lowStock ? 'bg-amber-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500">{p.sku}</td>
                    <td className="px-4 py-3">₹{Number(p.costPrice).toFixed(2)}</td>
                    <td className="px-4 py-3">₹{Number(p.sellingPrice).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className="mr-2">{p.stockQuantity}</span>
                      {lowStock && <Badge variant="warning">Low Stock</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-primary">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => setDeleteTarget(p)} className="text-gray-400 hover:text-red-500">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <SlideOver
        open={slideOpen}
        title={editing ? 'Edit Product' : 'Add Product'}
        onClose={() => setSlideOpen(false)}
      >
        <ProductForm
          initial={editing}
          onSuccess={() => { setSlideOpen(false); fetchProducts() }}
        />
      </SlideOver>

      <Modal open={!!deleteTarget} title="Delete Product" onClose={() => setDeleteTarget(null)}>
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
```

- [ ] **Step 3: Start dev server and verify Products page loads**

```bash
npm run dev
```

Open `http://localhost:3000/login`, sign in (create a user via signup first), then navigate to `/products`. Verify: table renders, Add Product slide-over opens, form submits and new product appears.

- [ ] **Step 4: Commit**

```bash
git add src/components/features/products/ src/app/\(dashboard\)/products/
git commit -m "feat: products page with CRUD UI"
```

---

## Task 11: Customers API

**Files:**
- Create: `src/app/api/customers/route.ts`
- Create: `src/app/api/customers/[id]/route.ts`
- Create: `src/__tests__/api/customers.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/api/customers.test.ts`:

```typescript
import { GET, POST } from '@/app/api/customers/route'
import { PUT, DELETE } from '@/app/api/customers/[id]/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockCustomer = { id: 'c1', name: 'Jane Doe', phone: '9999999999', email: 'jane@doe.com', address: 'Goa', createdAt: new Date() }

function makeReq(method: string, body?: object) {
  return new NextRequest('http://localhost/api/customers', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('GET /api/customers', () => {
  it('returns customers list', async () => {
    ;(mockPrisma.customer.findMany as jest.Mock).mockResolvedValue([mockCustomer])
    const res = await GET()
    expect(res.status).toBe(200)
  })
})

describe('POST /api/customers', () => {
  it('returns 400 when name missing', async () => {
    const res = await POST(makeReq('POST', { phone: '1234' }))
    expect(res.status).toBe(400)
  })

  it('returns 201 on success', async () => {
    ;(mockPrisma.customer.create as jest.Mock).mockResolvedValue(mockCustomer)
    const res = await POST(makeReq('POST', { name: 'Jane Doe', phone: '9999999999' }))
    expect(res.status).toBe(201)
  })
})

describe('DELETE /api/customers/[id]', () => {
  it('returns 200 on success', async () => {
    ;(mockPrisma.customer.delete as jest.Mock).mockResolvedValue(mockCustomer)
    const res = await DELETE(makeReq('DELETE'), { params: { id: 'c1' } })
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx jest src/__tests__/api/customers.test.ts
```

- [ ] **Step 3: Create src/app/api/customers/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const customers = await prisma.customer.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(customers)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, phone, email, address } = body

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const customer = await prisma.customer.create({ data: { name, phone, email, address } })
  return NextResponse.json(customer, { status: 201 })
}
```

- [ ] **Step 4: Create src/app/api/customers/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const customer = await prisma.customer.findUnique({ where: { id: params.id } })
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(customer)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()
  try {
    const customer = await prisma.customer.update({
      where: { id: params.id },
      data: { name: body.name, phone: body.phone, email: body.email, address: body.address },
    })
    return NextResponse.json(customer)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.customer.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
npx jest src/__tests__/api/customers.test.ts
```

Expected: `4 passed`

- [ ] **Step 6: Commit**

```bash
git add src/app/api/customers/ src/__tests__/api/customers.test.ts
git commit -m "feat: customers CRUD API routes"
```

---

## Task 12: Customers Page

**Files:**
- Create: `src/components/features/customers/CustomerForm.tsx`
- Create: `src/app/(dashboard)/customers/page.tsx`

- [ ] **Step 1: Create src/components/features/customers/CustomerForm.tsx**

```typescript
'use client'
import { useState, FormEvent } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { Customer } from '@/types'

interface CustomerFormProps {
  initial?: Customer
  onSuccess: () => void
}

export function CustomerForm({ initial, onSuccess }: CustomerFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const url = initial ? `/api/customers/${initial.id}` : '/api/customers'
      const method = initial ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, address }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Failed to save')
      else onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Full Name" value={name} onChange={e => setName(e.target.value)} required />
      <Input label="Phone" type="tel" value={phone ?? ''} onChange={e => setPhone(e.target.value)} />
      <Input label="Email" type="email" value={email ?? ''} onChange={e => setEmail(e.target.value)} />
      <Input label="Address" value={address ?? ''} onChange={e => setAddress(e.target.value)} />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" loading={loading} className="w-full">
        {initial ? 'Update Customer' : 'Add Customer'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Create src/app/(dashboard)/customers/page.tsx**

```typescript
'use client'
import { useState, useEffect, useCallback } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { SlideOver } from '@/components/ui/SlideOver'
import { Modal } from '@/components/ui/Modal'
import { CustomerForm } from '@/components/features/customers/CustomerForm'
import type { Customer } from '@/types'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [slideOpen, setSlideOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/customers')
    setCustomers(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? '').includes(search) ||
    (c.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await fetch(`/api/customers/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleteTarget(null)
    setDeleting(false)
    fetchCustomers()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <Button onClick={() => { setEditing(undefined); setSlideOpen(true) }} className="flex items-center gap-2">
          <Plus size={16} /> Add Customer
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b">
          <input
            className="w-full max-w-xs px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Search customers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">No customers found. Add your first customer.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
              <tr>
                {['Name', 'Phone', 'Email', 'Address', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-gray-500">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.address ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => { setEditing(c); setSlideOpen(true) }} className="text-gray-400 hover:text-primary">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => setDeleteTarget(c)} className="text-gray-400 hover:text-red-500">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SlideOver open={slideOpen} title={editing ? 'Edit Customer' : 'Add Customer'} onClose={() => setSlideOpen(false)}>
        <CustomerForm initial={editing} onSuccess={() => { setSlideOpen(false); fetchCustomers() }} />
      </SlideOver>

      <Modal open={!!deleteTarget} title="Delete Customer" onClose={() => setDeleteTarget(null)}>
        <p className="text-sm text-gray-600 mb-6">Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.</p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/features/customers/ src/app/\(dashboard\)/customers/
git commit -m "feat: customers page with CRUD UI"
```

---

## Task 13: Orders API

**Files:**
- Create: `src/app/api/orders/route.ts`
- Create: `src/app/api/orders/[id]/route.ts`
- Create: `src/__tests__/api/orders.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/api/orders.test.ts`:

```typescript
import { GET, POST } from '@/app/api/orders/route'
import { GET as GET_ONE } from '@/app/api/orders/[id]/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    product: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}))

const mockPrisma = prisma as jest.Mocked<typeof prisma>

const mockOrder = {
  id: 'o1',
  customerId: 'c1',
  totalAmount: new Prisma.Decimal('100.00'),
  createdAt: new Date(),
  customer: { name: 'Jane' },
}

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/orders', () => {
  it('returns orders list', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([mockOrder])
    const res = await GET()
    expect(res.status).toBe(200)
  })
})

describe('POST /api/orders', () => {
  it('returns 400 when items missing', async () => {
    const res = await POST(makeReq({ customerId: 'c1' }))
    expect(res.status).toBe(400)
  })

  it('returns 201 on success', async () => {
    ;(mockPrisma.$transaction as jest.Mock).mockResolvedValue({ ...mockOrder, items: [] })
    const res = await POST(makeReq({
      customerId: 'c1',
      items: [{ productId: 'p1', quantity: 2 }],
    }))
    expect(res.status).toBe(201)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx jest src/__tests__/api/orders.test.ts
```

- [ ] **Step 3: Create src/app/api/orders/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const orders = await prisma.order.findMany({
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(orders)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { customerId, items } = body

  if (!customerId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'customerId and at least one item are required' }, { status: 400 })
  }

  try {
    const order = await prisma.$transaction(async tx => {
      let totalAmount = 0
      const orderItemsData: { productId: string; quantity: number; price: unknown }[] = []

      for (const item of items as { productId: string; quantity: number }[]) {
        const product = await tx.product.findUnique({ where: { id: item.productId } })
        if (!product) throw new Error(`Product ${item.productId} not found`)
        if (product.stockQuantity < item.quantity) {
          throw new Error(`Insufficient stock for "${product.name}"`)
        }
        totalAmount += Number(product.sellingPrice) * item.quantity
        orderItemsData.push({ productId: item.productId, quantity: item.quantity, price: product.sellingPrice })
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } },
        })
      }

      return tx.order.create({
        data: {
          customerId,
          totalAmount,
          items: { create: orderItemsData },
        },
        include: { customer: true, items: { include: { product: true } } },
      })
    })

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error'
    const status = msg.includes('not found') || msg.includes('Insufficient') ? 400 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
```

- [ ] **Step 4: Create src/app/api/orders/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      items: { include: { product: { select: { name: true } } } },
    },
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(order)
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
npx jest src/__tests__/api/orders.test.ts
```

Expected: `3 passed`

- [ ] **Step 6: Commit**

```bash
git add src/app/api/orders/ src/__tests__/api/orders.test.ts
git commit -m "feat: orders API with transactional stock deduction"
```

---

## Task 14: Orders List Page + New Order Page

**Files:**
- Create: `src/components/features/orders/OrderForm.tsx`
- Create: `src/app/(dashboard)/orders/page.tsx`
- Create: `src/app/(dashboard)/orders/new/page.tsx`

- [ ] **Step 1: Create src/components/features/orders/OrderForm.tsx**

```typescript
'use client'
import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { Customer, Product } from '@/types'

type LineItem = { productId: string; quantity: number }

export function OrderForm() {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [customerId, setCustomerId] = useState('')
  const [items, setItems] = useState<LineItem[]>([{ productId: '', quantity: 1 }])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([fetch('/api/customers').then(r => r.json()), fetch('/api/products').then(r => r.json())]).then(
      ([c, p]) => { setCustomers(c); setProducts(p) }
    )
  }, [])

  function addLine() { setItems(prev => [...prev, { productId: '', quantity: 1 }]) }
  function removeLine(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)) }
  function updateLine(i: number, field: keyof LineItem, value: string | number) {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item))
  }

  const total = items.reduce((sum, item) => {
    const product = products.find(p => p.id === item.productId)
    return sum + (product ? Number(product.sellingPrice) * item.quantity : 0)
  }, 0)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!customerId) { setError('Please select a customer'); return }
    if (items.some(i => !i.productId)) { setError('Please select a product for each line'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, items }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Failed to create order')
      else router.push(`/orders/${data.id}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
        <select
          value={customerId}
          onChange={e => setCustomerId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30"
          required
        >
          <option value="">Select a customer...</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Products</label>
        <div className="space-y-3">
          {items.map((item, i) => {
            const product = products.find(p => p.id === item.productId)
            return (
              <div key={i} className="flex items-center gap-3">
                <select
                  value={item.productId}
                  onChange={e => updateLine(i, 'productId', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Select product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Stock: {p.stockQuantity})</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={e => updateLine(i, 'quantity', Number(e.target.value))}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center outline-none focus:ring-2 focus:ring-primary/30"
                />
                <span className="w-24 text-sm text-right text-gray-600">
                  {product ? `₹${(Number(product.sellingPrice) * item.quantity).toFixed(2)}` : '—'}
                </span>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeLine(i)} className="text-gray-400 hover:text-red-500">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <button type="button" onClick={addLine} className="mt-3 flex items-center gap-1 text-sm text-primary hover:underline">
          <Plus size={14} /> Add product
        </button>
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <span className="text-lg font-semibold">Total: ₹{total.toFixed(2)}</span>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={() => router.push('/orders')}>Cancel</Button>
          <Button type="submit" loading={loading}>Create Invoice</Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  )
}
```

- [ ] **Step 2: Create src/app/(dashboard)/orders/page.tsx**

```typescript
'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Eye } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import type { Order } from '@/types'

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/orders')
    setOrders(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <Link href="/orders/new">
          <Button className="flex items-center gap-2"><Plus size={16} /> New Order</Button>
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : orders.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">No orders yet. Create your first invoice.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
              <tr>
                {['Invoice #', 'Customer', 'Total', 'Date', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8).toUpperCase()}</td>
                  <td className="px-4 py-3 font-medium">{o.customer?.name}</td>
                  <td className="px-4 py-3">₹{Number(o.totalAmount).toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <Link href={`/orders/${o.id}`} className="inline-flex items-center gap-1 text-primary hover:underline text-xs">
                      <Eye size={13} /> View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create src/app/(dashboard)/orders/new/page.tsx**

```typescript
import { OrderForm } from '@/components/features/orders/OrderForm'

export default function NewOrderPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Invoice</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <OrderForm />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/features/orders/ src/app/\(dashboard\)/orders/
git commit -m "feat: orders list, new order form"
```

---

## Task 15: Order Detail + PDF

**Files:**
- Create: `src/components/features/orders/InvoicePDF.tsx`
- Create: `src/app/api/orders/[id]/pdf/route.ts`
- Create: `src/app/(dashboard)/orders/[id]/page.tsx`

- [ ] **Step 1: Create src/components/features/orders/InvoicePDF.tsx**

```typescript
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const s = StyleSheet.create({
  page: { padding: 48, fontFamily: 'Helvetica', fontSize: 10, color: '#333' },
  header: { marginBottom: 28 },
  brand: { fontSize: 22, color: '#2D7D6F', fontFamily: 'Helvetica-Bold' },
  meta: { fontSize: 9, color: '#666', marginTop: 2 },
  section: { marginBottom: 20 },
  label: { fontSize: 9, color: '#888', marginBottom: 2, textTransform: 'uppercase' },
  value: { fontSize: 10 },
  tableHead: { flexDirection: 'row', backgroundColor: '#1A4D44', padding: '6 8', marginTop: 8 },
  tableHeadCell: { color: '#fff', fontSize: 9, fontFamily: 'Helvetica-Bold' },
  row: { flexDirection: 'row', borderBottomColor: '#eee', borderBottomWidth: 1, padding: '6 8' },
  cell: { fontSize: 9 },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  totalLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginRight: 16, color: '#2D7D6F' },
  totalValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#2D7D6F' },
})

type Props = {
  order: {
    id: string
    createdAt: Date | string
    totalAmount: unknown
    customer: { name: string; email?: string | null; phone?: string | null; address?: string | null }
    items: Array<{ quantity: number; price: unknown; product: { name: string } }>
  }
}

export function InvoicePDF({ order }: Props) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.brand}>OptiLifeWellbeing</Text>
          <Text style={s.meta}>Invoice #{order.id.slice(0, 8).toUpperCase()}</Text>
          <Text style={s.meta}>Date: {new Date(order.createdAt).toLocaleDateString('en-IN')}</Text>
        </View>

        <View style={s.section}>
          <Text style={s.label}>Bill To</Text>
          <Text style={s.value}>{order.customer.name}</Text>
          {order.customer.email && <Text style={s.meta}>{order.customer.email}</Text>}
          {order.customer.phone && <Text style={s.meta}>{order.customer.phone}</Text>}
          {order.customer.address && <Text style={s.meta}>{order.customer.address}</Text>}
        </View>

        <View style={s.tableHead}>
          <Text style={[s.tableHeadCell, { flex: 4 }]}>Product</Text>
          <Text style={[s.tableHeadCell, { flex: 1, textAlign: 'center' }]}>Qty</Text>
          <Text style={[s.tableHeadCell, { flex: 2, textAlign: 'right' }]}>Unit Price</Text>
          <Text style={[s.tableHeadCell, { flex: 2, textAlign: 'right' }]}>Amount</Text>
        </View>

        {order.items.map((item, i) => (
          <View key={i} style={s.row}>
            <Text style={[s.cell, { flex: 4 }]}>{item.product.name}</Text>
            <Text style={[s.cell, { flex: 1, textAlign: 'center' }]}>{item.quantity}</Text>
            <Text style={[s.cell, { flex: 2, textAlign: 'right' }]}>₹{Number(item.price).toFixed(2)}</Text>
            <Text style={[s.cell, { flex: 2, textAlign: 'right' }]}>₹{(Number(item.price) * item.quantity).toFixed(2)}</Text>
          </View>
        ))}

        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Total</Text>
          <Text style={s.totalValue}>₹{Number(order.totalAmount).toFixed(2)}</Text>
        </View>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 2: Create src/app/api/orders/[id]/pdf/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { renderToBuffer } from '@react-pdf/renderer'
import { InvoicePDF } from '@/components/features/orders/InvoicePDF'
import React from 'react'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      items: { include: { product: { select: { name: true } } } },
    },
  })

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const buffer = await renderToBuffer(React.createElement(InvoicePDF, { order }))

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${order.id.slice(0, 8)}.pdf"`,
    },
  })
}
```

- [ ] **Step 3: Create src/app/(dashboard)/orders/[id]/page.tsx**

```typescript
'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import type { Order } from '@/types'

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then(r => r.json())
      .then(data => { setOrder(data); setLoading(false) })
  }, [id])

  async function handleDownload() {
    setDownloading(true)
    const res = await fetch(`/api/orders/${id}/pdf`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invoice-${id?.slice(0, 8)}.pdf`
    a.click()
    URL.revokeObjectURL(url)
    setDownloading(false)
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (!order) return <p className="text-center py-20 text-gray-400">Order not found.</p>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <Link href="/orders" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft size={14} /> Back to Orders
        </Link>
        <Button onClick={handleDownload} loading={downloading} className="flex items-center gap-2">
          <Download size={14} /> Download PDF
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-primary">OptiLifeWellbeing</h1>
            <p className="text-sm text-gray-500 mt-1">Invoice #{id?.slice(0, 8).toUpperCase()}</p>
            <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs uppercase text-gray-400 mb-1">Bill To</p>
          <p className="font-medium">{order.customer?.name}</p>
        </div>

        <table className="w-full text-sm mb-6">
          <thead className="bg-sidebar text-white text-xs">
            <tr>
              <th className="px-4 py-2 text-left">Product</th>
              <th className="px-4 py-2 text-center">Qty</th>
              <th className="px-4 py-2 text-right">Unit Price</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {order.items?.map(item => (
              <tr key={item.id}>
                <td className="px-4 py-3">{item.product?.name}</td>
                <td className="px-4 py-3 text-center">{item.quantity}</td>
                <td className="px-4 py-3 text-right">₹{Number(item.price).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">₹{(Number(item.price) * item.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="text-right">
            <span className="text-xs text-gray-400 uppercase">Total Amount</span>
            <p className="text-2xl font-bold text-primary">₹{Number(order.totalAmount).toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Test PDF download**

Start the dev server (`npm run dev`), create an order, open the order detail page, click Download PDF. Verify a PDF file downloads with correct line items and total.

- [ ] **Step 5: Commit**

```bash
git add src/components/features/orders/InvoicePDF.tsx src/app/api/orders/\[id\]/pdf/ src/app/\(dashboard\)/orders/\[id\]/
git commit -m "feat: order detail page and PDF invoice generation"
```

---

## Task 16: Dashboard API

**Files:**
- Create: `src/app/api/dashboard/route.ts`
- Create: `src/__tests__/api/dashboard.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/api/dashboard.test.ts`:

```typescript
import { GET } from '@/app/api/dashboard/route'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      aggregate: jest.fn(),
      count: jest.fn(),
    },
    product: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  },
}))

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('GET /api/dashboard', () => {
  it('returns stats and daily revenue', async () => {
    ;(mockPrisma.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { totalAmount: new Prisma.Decimal('5000') } })
    ;(mockPrisma.order.count as jest.Mock).mockResolvedValue(10)
    ;(mockPrisma.product.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([])

    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.totalOrders).toBe(10)
    expect(data.lowStockProducts).toEqual([])
    expect(Array.isArray(data.dailyRevenue)).toBe(true)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx jest src/__tests__/api/dashboard.test.ts
```

- [ ] **Step 3: Create src/app/api/dashboard/route.ts**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { LOW_STOCK_THRESHOLD } from '@/lib/constants'

export async function GET() {
  const [revenueResult, totalOrders, lowStockProducts, dailyRevenue] = await Promise.all([
    prisma.order.aggregate({ _sum: { totalAmount: true } }),
    prisma.order.count(),
    prisma.product.findMany({
      where: { stockQuantity: { lt: LOW_STOCK_THRESHOLD } },
      orderBy: { stockQuantity: 'asc' },
    }),
    prisma.$queryRaw<{ date: string; revenue: number }[]>`
      SELECT
        DATE("createdAt")::text AS date,
        SUM("totalAmount")::float AS revenue
      FROM "Order"
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `,
  ])

  return NextResponse.json({
    totalRevenue: Number(revenueResult._sum.totalAmount ?? 0),
    totalOrders,
    lowStockProducts,
    dailyRevenue,
  })
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx jest src/__tests__/api/dashboard.test.ts
```

Expected: `1 passed`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/dashboard/ src/__tests__/api/dashboard.test.ts
git commit -m "feat: dashboard API (revenue, orders, low stock, daily chart)"
```

---

## Task 17: Dashboard Page

**Files:**
- Create: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Create src/app/(dashboard)/dashboard/page.tsx**

```typescript
'use client'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { TrendingUp, ShoppingCart, AlertTriangle } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import type { DashboardData } from '@/types'

const RevenueChart = dynamic(() => import('./RevenueChart'), { ssr: false })

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [range, setRange] = useState<7 | 30>(30)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [])

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (!data) return null

  const chartData = range === 7 ? data.dailyRevenue.slice(-7) : data.dailyRevenue

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={TrendingUp} label="Total Revenue" value={`₹${data.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} color="bg-primary" />
        <StatCard icon={ShoppingCart} label="Total Orders" value={String(data.totalOrders)} color="bg-accent" />
        <StatCard icon={AlertTriangle} label="Low Stock Items" value={String(data.lowStockProducts.length)} color="bg-amber-500" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Revenue</h2>
          <div className="flex gap-1">
            {([7, 30] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${range === r ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {r}d
              </button>
            ))}
          </div>
        </div>
        <RevenueChart data={chartData} />
      </div>

      {data.lowStockProducts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b bg-amber-50">
            <h2 className="text-sm font-semibold text-amber-800">Low Stock Alert</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Product</th>
                <th className="px-4 py-2 text-left font-medium">SKU</th>
                <th className="px-4 py-2 text-left font-medium">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.lowStockProducts.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{p.name}</td>
                  <td className="px-4 py-3 text-gray-500">{p.sku}</td>
                  <td className="px-4 py-3"><Badge variant="warning">{p.stockQuantity} left</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create src/app/(dashboard)/dashboard/RevenueChart.tsx**

```typescript
'use client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type Props = { data: { date: string; revenue: number }[] }

export default function RevenueChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-center text-gray-400 py-10 text-sm">No revenue data yet.</p>
  }

  const formatted = data.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    revenue: Number(d.revenue.toFixed(2)),
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={formatted} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${v}`} />
        <Tooltip formatter={(v: number) => [`₹${v.toFixed(2)}`, 'Revenue']} />
        <Line type="monotone" dataKey="revenue" stroke="#2D7D6F" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 3: Start dev server and verify full app flow**

```bash
npm run dev
```

Verify end-to-end:
1. `/login` → sign in
2. `/dashboard` → stat cards show, chart renders
3. `/products` → add a product, edit it, see low-stock badge for qty < 10
4. `/customers` → add a customer
5. `/orders/new` → select customer + products, create invoice → redirects to detail
6. `/orders/[id]` → invoice shows, Download PDF works
7. `/dashboard` → total revenue and orders updated

- [ ] **Step 4: Run full test suite**

```bash
npx jest
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/
git commit -m "feat: dashboard page with stat cards and revenue chart"
```

---

## Setup Steps (Quick Reference)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Fill in DATABASE_URL (Neon connection string) and JWT_SECRET

# 3. Set up database
npx prisma generate
npx prisma migrate dev --name init

# 4. Create your admin user
# POST /api/auth/signup with { "email": "...", "password": "..." }
# Use curl or the /login page

# 5. Start development server
npm run dev
# Open http://localhost:3000
```

---

## Self-Review Checklist

- [x] Auth API (signup, login, logout) — Task 4
- [x] JWT middleware protecting all /dashboard, /products, /customers, /orders routes — Task 5
- [x] Products CRUD (list, create, update, delete) — Tasks 9–10
- [x] Low stock warning (amber highlight + badge, qty < 10) — Task 10
- [x] Customers CRUD — Tasks 11–12
- [x] Orders creation with transactional stock deduction — Task 13
- [x] Order detail page — Task 15
- [x] PDF invoice download — Task 15
- [x] Dashboard: total revenue, total orders, low stock count + list — Tasks 16–17
- [x] Revenue chart with 7d/30d toggle — Task 17
- [x] Searchable tables for products and customers — Tasks 10, 12
- [x] Loading states on all async actions — all page tasks
- [x] Empty states on all tables — all page tasks
- [x] Error messages on form failures — all form tasks
- [x] bcrypt password hashing (12 rounds) — Task 3
- [x] httpOnly Secure cookie — Task 4
- [x] Decimal(10,2) for all money fields — Task 2
- [x] OrderItem.price is a price snapshot — Tasks 2, 13
