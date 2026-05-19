# OptiLifeWellbeing ERP — Design Spec
**Date:** 2026-04-24  
**Status:** Approved

---

## Overview

A production-ready ERP web application for OptiLifeWellbeing, a single-admin business selling physical health/wellness products. Manages inventory, customers, invoices, and provides a revenue dashboard with PDF invoice export.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL via Neon |
| ORM | Prisma |
| Auth | JWT in httpOnly cookie |
| Styling | Tailwind CSS |
| Charts | Recharts |
| PDF | @react-pdf/renderer |
| Password hashing | bcrypt |

---

## Architecture

Single Next.js monorepo. API routes handle all backend logic (Prisma, auth, PDF generation). Frontend is React with Tailwind. JWT stored in httpOnly Secure SameSite=Strict cookie. Next.js root middleware protects all dashboard routes.

---

## Folder Structure

```
optilife-erp/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── products/page.tsx
│   │   │   ├── customers/page.tsx
│   │   │   ├── orders/page.tsx
│   │   │   └── orders/new/page.tsx
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
│   │   ├── ui/                  # Button, Input, Modal, Badge, Spinner
│   │   ├── layout/              # Sidebar, Navbar, PageHeader
│   │   └── features/            # ProductTable, CustomerForm, OrderForm, InvoiceView
│   ├── lib/
│   │   ├── prisma.ts            # singleton Prisma client
│   │   ├── auth.ts              # JWT sign/verify helpers
│   │   └── constants.ts         # LOW_STOCK_THRESHOLD = 10
│   └── middleware.ts            # JWT cookie check → redirect to /login
├── .env
├── .env.example
└── package.json
```

---

## Database Schema

```prisma
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
  costPrice     Decimal     @db.Decimal(10,2)
  sellingPrice  Decimal     @db.Decimal(10,2)
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
  customer    Customer    @relation(fields: [customerId], references: [id])
  customerId  String
  totalAmount Decimal     @db.Decimal(10,2)
  createdAt   DateTime    @default(now())
  items       OrderItem[]
}

model OrderItem {
  id        String  @id @default(uuid())
  order     Order   @relation(fields: [orderId], references: [id])
  orderId   String
  product   Product @relation(fields: [productId], references: [id])
  productId String
  quantity  Int
  price     Decimal @db.Decimal(10,2)
}
```

**Key invariants:**
- `OrderItem.price` is a snapshot of `Product.sellingPrice` at time of sale — price changes don't corrupt history
- All money fields use `Decimal(10,2)` — never Float
- Order creation deducts stock inside a Prisma transaction — rolls back fully on any failure
- Low stock threshold: quantity < 10

---

## Authentication

- Single admin user (no roles)
- Passwords hashed with bcrypt (salt rounds: 12)
- JWT signed with `JWT_SECRET` env var, expires in 7 days
- Stored as `httpOnly`, `Secure`, `SameSite=Strict` cookie named `optilife_token`
- Root `src/middleware.ts` intercepts all `/(dashboard)` routes, verifies cookie, redirects to `/login` on failure
- Logout clears the cookie via `POST /api/auth/logout`

---

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/signup` | Create user, set JWT cookie |
| POST | `/api/auth/login` | Verify credentials, set JWT cookie |
| POST | `/api/auth/logout` | Clear JWT cookie |
| GET | `/api/dashboard` | Stats + daily revenue for last 30 days |
| GET | `/api/products` | List all products |
| POST | `/api/products` | Create product |
| GET | `/api/products/[id]` | Get single product |
| PUT | `/api/products/[id]` | Update product |
| DELETE | `/api/products/[id]` | Delete product |
| GET | `/api/customers` | List all customers |
| POST | `/api/customers` | Create customer |
| GET | `/api/customers/[id]` | Get single customer |
| PUT | `/api/customers/[id]` | Update customer |
| DELETE | `/api/customers/[id]` | Delete customer |
| GET | `/api/orders` | List all orders (with customer name) |
| POST | `/api/orders` | Create order + deduct stock (transaction) |
| GET | `/api/orders/[id]` | Get order with items + product names |
| GET | `/api/orders/[id]/pdf` | Stream PDF invoice |

All protected routes verify the JWT cookie before executing. Return `401` if invalid/missing.

---

## UI Pages

### Branding
- Primary: `#2D7D6F` (deep teal-green)
- Accent: `#4CAF7D` (fresh green)
- Background: `#F7FAF9` (warm off-white)
- Sidebar: `#1A4D44` (dark forest green)
- Low stock warning: `#F59E0B` (amber)
- Danger/delete: `#EF4444` (red)
- Font: Inter (via next/font)

### Layout (protected pages)
Fixed dark sidebar (left, 240px) with nav links: Dashboard, Products, Customers, Orders. Top navbar with page title and logout. Main content area with card-based layout on warm off-white background.

### `/login`
Centered card. Email + password inputs. "Sign in" button. Error message on failure.

### `/dashboard`
- 3 stat cards: Total Revenue (all-time), Total Orders (all-time), Low Stock Products (count)
- Revenue chart (Recharts LineChart) with 7d / 30d toggle, dynamically imported to avoid SSR issues

### `/products`
- Searchable table: Name, SKU, Cost Price, Selling Price, Stock, Actions
- Low-stock rows highlighted amber (qty < 10) with badge
- "Add Product" button → slide-over form (create)
- Edit icon → slide-over form (update)
- Delete icon → confirmation modal

### `/customers`
- Searchable table: Name, Phone, Email, Address, Created, Actions
- "Add Customer" → slide-over form
- Edit / Delete with confirmation

### `/orders`
- Table: Invoice #, Customer, Total, Date, Actions
- Click row → order detail page

### `/orders/new`
- Customer dropdown (searchable)
- Add product rows: product dropdown + quantity input
- Running subtotal per row, grand total auto-calculated
- "Create Invoice" button → POST to API → redirect to order detail

### `/orders/[id]`
- Full invoice view: customer info, itemized table, total
- "Download PDF" button → fetches `/api/orders/[id]/pdf`

---

## PDF Invoice

Generated server-side via `@react-pdf/renderer` inside `/api/orders/[id]/pdf`. Streams as `application/pdf`. Contains: OptiLifeWellbeing header, invoice number, date, customer details, itemized product table with quantities and prices, total amount.

---

## Error Handling & Validation

- API routes validate required fields and return `400` with a message on bad input
- Prisma errors (unique constraint, not found) caught and mapped to `409` / `404`
- Frontend shows inline field errors from API responses
- Loading spinners on all async actions (form submit, table fetch)
- Empty states on all tables ("No products yet. Add your first product.")

---

## Environment Variables

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="..."
NODE_ENV="production"
```

---

## Setup Steps

1. `npm install`
2. Copy `.env.example` to `.env`, fill in `DATABASE_URL` and `JWT_SECRET`
3. `npx prisma generate`
4. `npx prisma migrate dev --name init`
5. `npm run dev`
