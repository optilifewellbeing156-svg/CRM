# Security & Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all issues identified in the code review: CORS misconfiguration, missing rate limiting, unenforced `isActive`, stock-check race condition, `createdById` spoofing, per-product low-stock threshold, admin self-lockout, password minimum inconsistency, `/auth/me` auth duplication, `useMe` duplicate fetch, and ProtectedRoute flash.

**Architecture:** All changes are surgical — no new abstractions introduced beyond a dedicated `rate-limit.ts` helper. Backend fixes are in `artifacts/api-server/src`; frontend fixes are in `artifacts/optilife/src`. The project uses pnpm workspaces; run `pnpm --filter @workspace/<pkg> <cmd>` to target specific packages.

**Tech Stack:** Express 5, Drizzle ORM + PostgreSQL, TypeScript ESM, React + Vite (wouter), pino logging, jose JWT, bcrypt

---

## File Map

| File | What changes |
|---|---|
| `artifacts/api-server/src/app.ts` | CORS origin locked to env var; rate limiter applied to auth routes |
| `artifacts/api-server/src/lib/middleware.ts` | `requireAuth` queries DB to enforce `isActive` |
| `artifacts/api-server/src/routes/auth.ts` | `/auth/me` uses shared middleware; password min → 12; rate limiter wired |
| `artifacts/api-server/src/routes/orders.ts` | `createdById` from `req.auth`; stock check moved inside TX with `FOR UPDATE` |
| `artifacts/api-server/src/routes/users.ts` | Guard against self-demotion / last-admin deletion |
| `artifacts/api-server/src/routes/dashboard.ts` | Use per-product `lowStockThreshold` instead of hardcoded 10 |
| `artifacts/api-server/src/routes/purchases.ts` | Guard delete when referenced product is gone |
| `artifacts/optilife/src/hooks/useMe.ts` | `fetching` flag prevents concurrent `/auth/me` requests |
| `artifacts/optilife/src/App.tsx` | `ProtectedRoute` redirect becomes synchronous |

---

## Task 1 — Lock down CORS origin

**Files:**
- Modify: `artifacts/api-server/src/app.ts`

- [ ] **Step 1.1: Read current CORS config**

Open `artifacts/api-server/src/app.ts`. Line 29 reads:
```ts
app.use(cors({ origin: true, credentials: true }));
```
`origin: true` mirrors any request origin back and, combined with `credentials: true`, allows cookies to be sent cross-origin from anywhere.

- [ ] **Step 1.2: Update CORS to use an explicit allowlist from env**

Replace line 29 in `artifacts/api-server/src/app.ts`:
```ts
// Before
app.use(cors({ origin: true, credentials: true }));

// After
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server / same-origin requests (no Origin header)
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }),
);
```

- [ ] **Step 1.3: Update `.env.example` (in repo root or migration-backup) to document the new var**

In `.migration-backup/.env.example` (or create `artifacts/api-server/.env.example` if absent), add:
```
CORS_ORIGINS=http://localhost:18924
```
For production this would be the deployed frontend URL.

- [ ] **Step 1.4: Typecheck**
```bash
cd /tmp/OPLERP_review/OPLERP
pnpm --filter @workspace/api-server run typecheck
```
Expected: no errors.

- [ ] **Step 1.5: Commit**
```bash
git -C /tmp/OPLERP_review/OPLERP add artifacts/api-server/src/app.ts
git -C /tmp/OPLERP_review/OPLERP commit -m "fix: lock CORS origin to CORS_ORIGINS env var"
```

---

## Task 2 — Rate-limit auth endpoints

**Files:**
- Modify: `artifacts/api-server/src/app.ts`
- Modify: `artifacts/api-server/package.json` (add dependency)

- [ ] **Step 2.1: Install express-rate-limit**
```bash
pnpm --filter @workspace/api-server add express-rate-limit
```
Expected: package added, `pnpm-lock.yaml` updated.

- [ ] **Step 2.2: Add rate-limiter middleware in app.ts**

In `artifacts/api-server/src/app.ts`, add the import at the top:
```ts
import rateLimit from "express-rate-limit";
```

Then add the limiter **before** `app.use("/api", router)`:
```ts
// 20 auth attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);
```

Full file after changes:
```ts
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);

app.use("/api", router);

export default app;
```

- [ ] **Step 2.3: Typecheck**
```bash
pnpm --filter @workspace/api-server run typecheck
```
Expected: no errors.

- [ ] **Step 2.4: Commit**
```bash
git -C /tmp/OPLERP_review/OPLERP add artifacts/api-server/src/app.ts artifacts/api-server/package.json pnpm-lock.yaml
git -C /tmp/OPLERP_review/OPLERP commit -m "fix: rate-limit auth endpoints to 20 req/15 min per IP"
```

---

## Task 3 — Enforce `isActive` in `requireAuth`

**Files:**
- Modify: `artifacts/api-server/src/lib/middleware.ts`
- Modify: `artifacts/api-server/src/lib/auth.ts` (update `signToken` / `verifyToken` types — no change needed, `isActive` is checked via DB)

The cleanest approach that gives immediate deactivation (not deferred to token expiry) is a single DB lookup in `requireAuth`. One extra SELECT per authenticated request; acceptable for an ERP.

- [ ] **Step 3.1: Update requireAuth to check isActive from DB**

Replace the entire `requireAuth` function in `artifacts/api-server/src/lib/middleware.ts`:

```ts
import { Request, Response, NextFunction } from "express";
import { verifyToken, COOKIE_NAME } from "./auth";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface AuthRequest extends Request {
  auth?: {
    userId: string;
    username: string;
    role: string;
    permissions: string[];
  };
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const payload = await verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  // Verify the user still exists and is active (catches deactivations within token lifetime)
  const rows = await db
    .select({ isActive: usersTable.isActive })
    .from(usersTable)
    .where(eq(usersTable.id, payload.userId))
    .limit(1);
  if (!rows[0] || !rows[0].isActive) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.auth = payload;
  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.auth?.role !== "ADMIN") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

export function requirePermission(permission: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (req.auth?.role === "ADMIN") { next(); return; }
    if (!req.auth?.permissions?.includes(permission)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export function requireAnyPermission(...permissions: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (req.auth?.role === "ADMIN") { next(); return; }
    if (permissions.some(p => req.auth?.permissions?.includes(p))) {
      next(); return;
    }
    res.status(403).json({ error: "Forbidden" });
  };
}
```

- [ ] **Step 3.2: Typecheck**
```bash
pnpm --filter @workspace/api-server run typecheck
```
Expected: no errors.

- [ ] **Step 3.3: Commit**
```bash
git -C /tmp/OPLERP_review/OPLERP add artifacts/api-server/src/lib/middleware.ts
git -C /tmp/OPLERP_review/OPLERP commit -m "fix: requireAuth now checks isActive in DB for immediate deactivation"
```

---

## Task 4 — Refactor `/auth/me` to use shared middleware

**Files:**
- Modify: `artifacts/api-server/src/routes/auth.ts`
- Modify: `artifacts/api-server/src/routes/index.ts` (move `/auth/me` after `requireAuth`)

Currently `/auth/me` is in `authRouter` which is registered *before* `requireAuth` in `routes/index.ts`. We need to move it out.

- [ ] **Step 4.1: Remove inline /auth/me from routes/auth.ts**

In `artifacts/api-server/src/routes/auth.ts`, delete the entire `router.get("/auth/me", ...)` handler (lines 130–147). The file should end after the logout handler:

```ts
router.post("/auth/logout", (_req: Request, res: Response) => {
  res.cookie(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
  res.json({ success: true });
});

export default router;
```

Also remove the now-unused `verifyToken` import from the top of `routes/auth.ts` if it's only used there. (Keep `signToken`, `comparePassword`, `hashPassword`, `COOKIE_NAME`, `COOKIE_MAX_AGE`.)

- [ ] **Step 4.2: Add /auth/me to routes/index.ts after requireAuth**

In `artifacts/api-server/src/routes/index.ts`, add the `/auth/me` route inline after `router.use(requireAuth)`:

```ts
import { Router, type IRouter, type Request, type Response } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import productsRouter from "./products";
import customersRouter from "./customers";
import ordersRouter from "./orders";
import purchasesRouter from "./purchases";
import usersRouter from "./users";
import dashboardRouter from "./dashboard";
import salesReportRouter from "./sales-report";
import invoiceRouter from "./invoice";
import { requireAuth, type AuthRequest } from "../lib/middleware";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);

router.use(requireAuth);

// /auth/me must be after requireAuth so the isActive check is enforced
router.get("/auth/me", (req: AuthRequest, res: Response) => {
  const auth = req.auth!;
  res.json({
    userId: auth.userId,
    username: auth.username,
    role: auth.role,
    permissions: auth.permissions,
  });
});

router.use(productsRouter);
router.use(customersRouter);
router.use(ordersRouter);
router.use(purchasesRouter);
router.use(usersRouter);
router.use(dashboardRouter);
router.use(salesReportRouter);
router.use(invoiceRouter);

export default router;
```

- [ ] **Step 4.3: Typecheck**
```bash
pnpm --filter @workspace/api-server run typecheck
```
Expected: no errors.

- [ ] **Step 4.4: Commit**
```bash
git -C /tmp/OPLERP_review/OPLERP add artifacts/api-server/src/routes/auth.ts artifacts/api-server/src/routes/index.ts
git -C /tmp/OPLERP_review/OPLERP commit -m "fix: /auth/me now goes through requireAuth middleware"
```

---

## Task 5 — Consistent password minimum (8 → 12 chars)

**Files:**
- Modify: `artifacts/api-server/src/routes/auth.ts` (signup)
- Modify: `artifacts/api-server/src/routes/users.ts` (create & update user)

- [ ] **Step 5.1: Update signup password check in routes/auth.ts**

In `artifacts/api-server/src/routes/auth.ts`, find:
```ts
if (password.length < 8) {
  res.status(400).json({ error: "Password must be at least 8 characters" });
  return;
}
```
Change to:
```ts
if (password.length < 12) {
  res.status(400).json({ error: "Password must be at least 12 characters" });
  return;
}
```

- [ ] **Step 5.2: Update user-create password check in routes/users.ts**

In `artifacts/api-server/src/routes/users.ts`, find both password checks and update them:

In `router.post("/users", ...)`:
```ts
// Before
if (password.length < 8) {
  res.status(400).json({ error: "Password must be at least 8 characters" });
  return;
}
// After
if (password.length < 12) {
  res.status(400).json({ error: "Password must be at least 12 characters" });
  return;
}
```

In `router.put("/users/:id", ...)`:
```ts
// Before
if (password !== undefined && password !== "" && password.length < 8) {
  res.status(400).json({ error: "Password must be at least 8 characters" });
  return;
}
// ...
if (password && password.length >= 8) updateData.password = await hashPassword(password);

// After
if (password !== undefined && password !== "" && password.length < 12) {
  res.status(400).json({ error: "Password must be at least 12 characters" });
  return;
}
// ...
if (password && password.length >= 12) updateData.password = await hashPassword(password);
```

- [ ] **Step 5.3: Typecheck**
```bash
pnpm --filter @workspace/api-server run typecheck
```

- [ ] **Step 5.4: Commit**
```bash
git -C /tmp/OPLERP_review/OPLERP add artifacts/api-server/src/routes/auth.ts artifacts/api-server/src/routes/users.ts
git -C /tmp/OPLERP_review/OPLERP commit -m "fix: unify password minimum to 12 characters across all auth paths"
```

---

## Task 6 — Fix `createdById` spoofing in POST /orders

**Files:**
- Modify: `artifacts/api-server/src/routes/orders.ts`

Currently `createdById` is accepted from `req.body`, allowing any user to attribute orders to arbitrary other users. It must be taken from the verified JWT payload.

- [ ] **Step 6.1: Replace body createdById with req.auth.userId in POST /orders**

In `artifacts/api-server/src/routes/orders.ts`, in the `router.post("/orders", ...)` handler, find:
```ts
const { customerId, items, invoiceDate, createdById, isPaid, paymentMethod } = req.body;
```
Change to:
```ts
const { customerId, items, invoiceDate, isPaid, paymentMethod } = req.body;
const createdById = req.auth!.userId;
```

The rest of the handler already uses `createdById` correctly, so no other changes are needed in this block.

- [ ] **Step 6.2: Keep createdById in PUT /orders (edit) for admin override, but default to existing value**

In `router.put("/orders/:id", ...)`, the `createdById` from body is already guarded as:
```ts
createdById: createdById !== undefined ? createdById : existingOrder.createdById,
```
This is admin-controlled editing of existing orders, which is acceptable. Leave it as-is.

- [ ] **Step 6.3: Typecheck**
```bash
pnpm --filter @workspace/api-server run typecheck
```

- [ ] **Step 6.4: Commit**
```bash
git -C /tmp/OPLERP_review/OPLERP add artifacts/api-server/src/routes/orders.ts
git -C /tmp/OPLERP_review/OPLERP commit -m "fix: createdById on new orders set from JWT, not client body"
```

---

## Task 7 — Fix stock-check race condition in POST /orders

**Files:**
- Modify: `artifacts/api-server/src/routes/orders.ts`

The current flow checks stock *outside* the transaction, then decrements inside. Two concurrent requests for the same product both pass the check, then both decrement, producing negative stock. Fix: lock the product rows with `SELECT ... FOR UPDATE` inside the transaction so the check and decrement are atomic.

- [ ] **Step 7.1: Move the stock check inside the transaction with row-level locking**

In `artifacts/api-server/src/routes/orders.ts`, replace the entire `router.post("/orders", ...)` handler with:

```ts
router.post("/orders", requirePermission("create-orders"), async (req: AuthRequest, res: Response) => {
  try {
    const { customerId, items, invoiceDate, isPaid, paymentMethod } = req.body;
    const createdById = req.auth!.userId;
    if (!customerId || !items?.length) {
      res.status(400).json({ error: "Customer and items are required" });
      return;
    }

    const productIds: string[] = items.map((i: any) => i.productId);

    const order = await db.transaction(async (tx) => {
      // Lock product rows for the duration of this transaction to prevent
      // concurrent orders from double-spending the same stock.
      const lockedRows = await tx.execute(
        sql`SELECT id, stock_quantity, name, selling_price FROM products WHERE id = ANY(${productIds}::text[]) FOR UPDATE`
      );
      const productMap = new Map(
        (lockedRows.rows as any[]).map((p) => [
          p.id,
          { id: p.id, stockQuantity: Number(p.stock_quantity), name: p.name, sellingPrice: p.selling_price },
        ])
      );

      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product) {
          throw Object.assign(new Error(`Product not found`), { status: 400 });
        }
        if (product.stockQuantity < item.quantity) {
          throw Object.assign(new Error(`Insufficient stock for "${product.name}"`), { status: 400 });
        }
      }

      let totalAmount = 0;
      const orderItemsData = items.map((item: any) => {
        const product = productMap.get(item.productId)!;
        const unitPrice = item.price !== undefined && Number(item.price) >= 0 ? Number(item.price) : Number(product.sellingPrice);
        totalAmount += unitPrice * item.quantity;
        return { productId: item.productId, quantity: String(item.quantity), price: String(unitPrice) };
      });

      const [created] = await tx.insert(ordersTable).values({
        customerId,
        createdById,
        totalAmount: String(totalAmount),
        isPaid: !!isPaid,
        paymentMethod: paymentMethod || null,
        ...(invoiceDate ? { createdAt: new Date(invoiceDate) } : {}),
      }).returning();

      for (const item of orderItemsData) {
        await tx.insert(orderItemsTable).values({ orderId: created.id, ...item });
        await tx.update(productsTable)
          .set({ stockQuantity: sql`${productsTable.stockQuantity} - ${Number(item.quantity)}` })
          .where(eq(productsTable.id, item.productId));
      }

      return created;
    });

    res.status(201).json(order);
  } catch (e: any) {
    if (e?.status === 400) {
      res.status(400).json({ error: e.message });
      return;
    }
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

- [ ] **Step 7.2: Verify the `sql` import is present at top of orders.ts**

The file already imports `sql` from `drizzle-orm`:
```ts
import { eq, inArray, sql } from "drizzle-orm";
```
No change needed.

- [ ] **Step 7.3: Typecheck**
```bash
pnpm --filter @workspace/api-server run typecheck
```
Expected: no errors.

- [ ] **Step 7.4: Commit**
```bash
git -C /tmp/OPLERP_review/OPLERP add artifacts/api-server/src/routes/orders.ts
git -C /tmp/OPLERP_review/OPLERP commit -m "fix: move stock check inside transaction with FOR UPDATE to prevent race condition"
```

---

## Task 8 — Dashboard: use per-product lowStockThreshold

**Files:**
- Modify: `artifacts/api-server/src/routes/dashboard.ts`

The `LOW_STOCK_THRESHOLD = 10` constant is used for the low-stock query, ignoring each product's `lowStockThreshold` field.

- [ ] **Step 8.1: Replace hardcoded threshold with per-product column**

In `artifacts/api-server/src/routes/dashboard.ts`, replace the whole file with:

```ts
import { Router, Response } from "express";
import { requirePermission, type AuthRequest } from "../lib/middleware";
import { db } from "@workspace/db";
import { ordersTable, productsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/dashboard", requirePermission("dashboard"), async (req: AuthRequest, res: Response) => {
  try {
    const [revenueRows, totalOrdersRows, lowStockProducts, dailyRevenue] = await Promise.all([
      db.select({ total: sql<number>`coalesce(sum(${ordersTable.totalAmount}), 0)` }).from(ordersTable),
      db.select({ count: sql<number>`count(*)` }).from(ordersTable),
      db.execute(sql`
        SELECT id, name, sku, stock_quantity AS "stockQuantity", low_stock_threshold AS "lowStockThreshold",
               cost_price AS "costPrice", selling_price AS "sellingPrice", created_at AS "createdAt"
        FROM products
        WHERE stock_quantity < low_stock_threshold
        ORDER BY stock_quantity ASC
      `),
      db.execute(sql`
        SELECT
          DATE(created_at)::text AS date,
          SUM(total_amount)::float AS revenue
        FROM orders
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `),
    ]);

    res.json({
      totalRevenue: Number(revenueRows[0]?.total ?? 0),
      totalOrders: Number(totalOrdersRows[0]?.count ?? 0),
      lowStockProducts: lowStockProducts.rows,
      dailyRevenue: (dailyRevenue.rows as any[]).map(r => ({ date: r.date, revenue: Number(r.revenue) })),
    });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
```

- [ ] **Step 8.2: Typecheck**
```bash
pnpm --filter @workspace/api-server run typecheck
```
Expected: no errors. (The `lt` import from `drizzle-orm` in the old file is removed; if it causes an unused-import warning, remove it.)

- [ ] **Step 8.3: Commit**
```bash
git -C /tmp/OPLERP_review/OPLERP add artifacts/api-server/src/routes/dashboard.ts
git -C /tmp/OPLERP_review/OPLERP commit -m "fix: dashboard low-stock query uses per-product threshold, not hardcoded 10"
```

---

## Task 9 — Guard admin self-lockout and last-admin deletion

**Files:**
- Modify: `artifacts/api-server/src/routes/users.ts`

Prevent an admin from: (a) deleting themselves, (b) demoting/deactivating themselves, (c) deleting the only remaining admin.

- [ ] **Step 9.1: Add self-lockout guards to PUT /users/:id**

In `artifacts/api-server/src/routes/users.ts`, inside `router.put("/users/:id", requireAdmin, ...)`, add these guards right after the password length check:

```ts
// Prevent admin from deactivating or demoting themselves
if (req.params.id === req.auth!.userId) {
  if (isActive === false) {
    res.status(400).json({ error: "You cannot deactivate your own account" });
    return;
  }
  if (role && role !== "ADMIN") {
    res.status(400).json({ error: "You cannot demote your own account" });
    return;
  }
}
```

Place this block just before the `const updateData: Record<string, unknown> = {};` line.

- [ ] **Step 9.2: Add last-admin guard to DELETE /users/:id**

In `router.delete("/users/:id", requireAdmin, ...)`, add a check before the delete:

```ts
router.delete("/users/:id", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // Prevent self-deletion
    if (req.params.id === req.auth!.userId) {
      res.status(400).json({ error: "You cannot delete your own account" });
      return;
    }

    // Prevent deleting the last admin
    const [adminCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(eq(usersTable.role, "ADMIN"));
    const targetUser = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.params.id)).limit(1);
    if (targetUser[0]?.role === "ADMIN" && (adminCount?.count ?? 0) <= 1) {
      res.status(400).json({ error: "Cannot delete the last admin account" });
      return;
    }

    const deleted = await db.delete(usersTable).where(eq(usersTable.id, req.params.id)).returning();
    if (!deleted[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ success: true });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

You'll need to add `sql` to the drizzle-orm import at the top of `users.ts`:
```ts
import { eq, sql } from "drizzle-orm";
```

- [ ] **Step 9.3: Typecheck**
```bash
pnpm --filter @workspace/api-server run typecheck
```

- [ ] **Step 9.4: Commit**
```bash
git -C /tmp/OPLERP_review/OPLERP add artifacts/api-server/src/routes/users.ts
git -C /tmp/OPLERP_review/OPLERP commit -m "fix: prevent admin self-demotion/deactivation and last-admin deletion"
```

---

## Task 10 — Guard purchase delete when product is missing

**Files:**
- Modify: `artifacts/api-server/src/routes/purchases.ts`

When deleting a purchase, if the referenced product has been deleted, the stock update silently does nothing. Add a warning log so the failure is observable.

- [ ] **Step 10.1: Log a warning when product not found on purchase delete**

In `artifacts/api-server/src/routes/purchases.ts`, update `router.delete("/purchases/:id", ...)`:

```ts
router.delete("/purchases/:id", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const purchaseRows = await db.select().from(purchasesTable).where(eq(purchasesTable.id, req.params.id)).limit(1);
    if (!purchaseRows[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const purchase = purchaseRows[0];

    await db.transaction(async (tx) => {
      await tx.delete(purchasesTable).where(eq(purchasesTable.id, req.params.id));
      const updated = await tx.update(productsTable)
        .set({ stockQuantity: sql`${productsTable.stockQuantity} - ${purchase.quantity}` })
        .where(eq(productsTable.id, purchase.productId))
        .returning({ id: productsTable.id });
      if (!updated[0]) {
        // Product was deleted; log so the discrepancy is visible in monitoring.
        req.log.warn({ purchaseId: req.params.id, productId: purchase.productId },
          "Deleted purchase references a missing product; stock not adjusted");
      }
    });

    res.json({ success: true });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

- [ ] **Step 10.2: Typecheck**
```bash
pnpm --filter @workspace/api-server run typecheck
```

- [ ] **Step 10.3: Commit**
```bash
git -C /tmp/OPLERP_review/OPLERP add artifacts/api-server/src/routes/purchases.ts
git -C /tmp/OPLERP_review/OPLERP commit -m "fix: log warning when purchase delete references a missing product"
```

---

## Task 11 — Fix `useMe` duplicate fetch on concurrent mounts

**Files:**
- Modify: `artifacts/optilife/src/hooks/useMe.ts`

If multiple components mount while `cache === "loading"`, each fires its own `fetch("/api/auth/me")`. A module-level `fetching` flag prevents this.

- [ ] **Step 11.1: Add in-flight deduplication to useMe**

Replace the entire content of `artifacts/optilife/src/hooks/useMe.ts`:

```ts
import { useState, useEffect } from "react";
import type { Me } from "@/types";

type AuthState = Me | "loading";

let cache: AuthState = "loading";
let fetching = false;
const listeners = new Set<(state: AuthState) => void>();

function notify(state: AuthState) {
  cache = state;
  fetching = false;
  listeners.forEach((l) => l(state));
}

export function clearMeCache() {
  cache = "loading";
  fetching = false;
  listeners.forEach((l) => l("loading"));
}

export function useMe(): Me | "loading" {
  const [state, setState] = useState<AuthState>(cache);

  useEffect(() => {
    listeners.add(setState);
    if (cache === "loading" && !fetching) {
      fetching = true;
      fetch("/api/auth/me", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => notify(data as Me))
        .catch(() => notify(null));
    } else {
      setState(cache);
    }
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return state;
}
```

- [ ] **Step 11.2: Typecheck frontend**
```bash
pnpm --filter @workspace/optilife run typecheck 2>/dev/null || pnpm --filter @workspace/optilife exec tsc --noEmit
```
Expected: no errors. (If the frontend has no typecheck script, skip.)

- [ ] **Step 11.3: Commit**
```bash
git -C /tmp/OPLERP_review/OPLERP add artifacts/optilife/src/hooks/useMe.ts
git -C /tmp/OPLERP_review/OPLERP commit -m "fix: deduplicate /auth/me fetch when multiple components mount concurrently"
```

---

## Task 12 — ProtectedRoute: synchronous redirect

**Files:**
- Modify: `artifacts/optilife/src/App.tsx`

The `useEffect` redirect causes a one-frame flash of protected content before navigating to `/login`. A synchronous return of `<Redirect>` eliminates the flash.

- [ ] **Step 12.1: Replace useEffect redirect with synchronous check**

In `artifacts/optilife/src/App.tsx`, replace the `ProtectedRoute` component:

```tsx
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const me = useMe();

  if (me === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "hsl(160,30%,97%)" }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (me === null) {
    return <Redirect to="/login" />;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
```

Remove the `useEffect` and `useLocation` imports from this component. The `useLocation` import can be removed from the `wouter` import entirely if it's only used in `ProtectedRoute`. Update the wouter import:
```ts
// Before
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
// After
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
```

- [ ] **Step 12.2: Typecheck**
```bash
pnpm --filter @workspace/optilife exec tsc --noEmit 2>/dev/null || true
```

- [ ] **Step 12.3: Commit**
```bash
git -C /tmp/OPLERP_review/OPLERP add artifacts/optilife/src/App.tsx
git -C /tmp/OPLERP_review/OPLERP commit -m "fix: ProtectedRoute uses synchronous redirect to eliminate login flash"
```

---

## Task 13 — Add default pagination limit to list endpoints

**Files:**
- Modify: `artifacts/api-server/src/routes/orders.ts`
- Modify: `artifacts/api-server/src/routes/products.ts`
- Modify: `artifacts/api-server/src/routes/customers.ts`
- Modify: `artifacts/api-server/src/routes/purchases.ts`

Add an optional `?limit=` query param (default 200, max 1000) to all list endpoints to prevent unbounded responses. The frontend doesn't need changes since it doesn't send `limit` today — it will simply receive up to 200 items by default, which is the current expected behaviour for a new deployment.

- [ ] **Step 13.1: Add limit to GET /orders**

In `artifacts/api-server/src/routes/orders.ts`, in `router.get("/orders", ...)`:
```ts
// Add after: const orders = await db.select({...})
// Change the query to add .limit():

const rawLimit = Number(req.query.limit ?? 200);
const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 200 : rawLimit), 1000);

const orders = await db.select({
  // ... existing fields unchanged ...
})
  .from(ordersTable)
  .leftJoin(customersTable, eq(ordersTable.customerId, customersTable.id))
  .orderBy(sql`${ordersTable.createdAt} desc`)
  .limit(limit);
```

- [ ] **Step 13.2: Add limit to GET /products**

In `artifacts/api-server/src/routes/products.ts`, in `router.get("/products", ...)`, add:
```ts
const rawLimit = Number(req.query.limit ?? 200);
const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 200 : rawLimit), 1000);
```
Then chain `.limit(limit)` on both the search and non-search `db.select()` queries.

For the non-search path:
```ts
products = await db.select().from(productsTable).orderBy(productsTable.createdAt).limit(limit);
```

For the search path:
```ts
products = await db.select().from(productsTable).where(
  or(
    ilike(productsTable.name, `%${search}%`),
    ilike(productsTable.sku, `%${search}%`)
  )
).orderBy(productsTable.createdAt).limit(limit);
```

- [ ] **Step 13.3: Add limit to GET /customers**

In `artifacts/api-server/src/routes/customers.ts`, in `router.get("/customers", ...)`:
```ts
const rawLimit = Number(req.query.limit ?? 200);
const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 200 : rawLimit), 1000);

const customers = await db.select().from(customersTable).orderBy(customersTable.createdAt).limit(limit);
```

- [ ] **Step 13.4: Add limit to GET /purchases**

In `artifacts/api-server/src/routes/purchases.ts`, in `router.get("/purchases", ...)`:
```ts
const rawLimit = Number(req.query.limit ?? 200);
const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 200 : rawLimit), 1000);
```
Chain `.limit(limit)` on the purchases query.

- [ ] **Step 13.5: Typecheck**
```bash
pnpm --filter @workspace/api-server run typecheck
```
Expected: no errors.

- [ ] **Step 13.6: Commit**
```bash
git -C /tmp/OPLERP_review/OPLERP add \
  artifacts/api-server/src/routes/orders.ts \
  artifacts/api-server/src/routes/products.ts \
  artifacts/api-server/src/routes/customers.ts \
  artifacts/api-server/src/routes/purchases.ts
git -C /tmp/OPLERP_review/OPLERP commit -m "fix: cap list endpoints at 200 rows by default (max 1000 via ?limit=)"
```

---

## Self-Review

### Spec coverage check

| Issue from review | Task |
|---|---|
| CORS `origin: true` | Task 1 |
| No rate limiting on auth | Task 2 |
| `isActive` not enforced | Task 3 |
| `/auth/me` duplicates auth logic | Task 4 |
| Password min inconsistency | Task 5 |
| `createdById` from client body | Task 6 |
| Stock-check race condition | Task 7 |
| Dashboard hardcoded threshold | Task 8 |
| Admin self-lockout | Task 9 |
| Purchase delete missing product | Task 10 |
| `useMe` duplicate fetch | Task 11 |
| ProtectedRoute flash | Task 12 |
| No pagination | Task 13 |

All 13 issues covered. ✓

### Out of scope (intentional)

- **`orderItemsTable.productId` missing FK**: Likely intentional — preserves order history after product deletion. Flagged in review but not fixed here since adding the FK would require a migration and cascade policy decision.
- **JWT stale permissions**: Requires a token blocklist (Redis or DB table), which is a significant new subsystem. The `isActive` DB check in Task 3 partially addresses this for deactivations.
- **`lib/api-client-react` / `lib/api-zod` dead code**: Removal is safe but out of scope for a bug-fix pass.
- **`PERMISSIONS` constant duplication**: Frontend and backend duplicating the list is a cleanup, not a bug.
