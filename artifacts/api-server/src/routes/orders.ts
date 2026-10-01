import { Router, Response } from "express";
import { db } from "@workspace/db";
import { ordersTable, orderItemsTable, productsTable, customersTable } from "@workspace/db";
import { eq, and, sql, type SQL } from "drizzle-orm";
import { requirePermission, requireAnyPermission, isPrivileged, param, type AuthRequest } from "../lib/middleware";

const router = Router();

const VALID_STATUSES = ["PROCESSING", "PROCESSED", "DELIVERED", "CANCELLED", "REFUNDED"] as const;
type OrderStatus = (typeof VALID_STATUSES)[number];
const isValidStatus = (v: string): v is OrderStatus => (VALID_STATUSES as readonly string[]).includes(v);
const CANCELLED_STATUSES = ["CANCELLED", "REFUNDED"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Sum requested quantities per product. The form allows the same product on
 * several lines; checking each line against the full stock on its own lets the
 * combined quantity exceed stock and drive it negative.
 */
function quantitiesByProduct(items: { productId: string; quantity: number }[]): Map<string, number> {
  const byProduct = new Map<string, number>();
  for (const item of items) {
    byProduct.set(item.productId, (byProduct.get(item.productId) ?? 0) + Number(item.quantity));
  }
  return byProduct;
}

/**
 * 25-day per-customer order cooldown: once an order is placed for a customer,
 * no new order may be booked for that customer for 25 days. From day 26 a new
 * order is allowed, which restarts the window. Cancelled and refunded orders
 * do not count — a cancelled mistake must not block the real order.
 * Computed in Postgres so the comparison stays in a single timezone frame
 * (created_at is a naive `timestamp`, so mixing in JS Date would skew it).
 */
async function activeCooldown(customerId: string, excludeOrderId?: string) {
  const cooldownRes = await db.execute(sql`
    SELECT
      CEIL(EXTRACT(EPOCH FROM (created_at + interval '25 days' - now())) / 86400)::int AS days_remaining,
      to_char((created_at + interval '25 days')::date, 'DD/MM/YYYY') AS next_allowed
    FROM orders
    WHERE customer_id = ${customerId}
      AND created_at > now() - interval '25 days'
      AND (status IS NULL OR status::text NOT IN ('CANCELLED', 'REFUNDED'))
      ${excludeOrderId ? sql`AND id <> ${excludeOrderId}` : sql``}
    ORDER BY created_at DESC
    LIMIT 1
  `);
  return (cooldownRes.rows as any[])[0] as { days_remaining: number; next_allowed: string } | undefined;
}

function sendCooldown(res: Response, cooldown: { days_remaining: number; next_allowed: string }) {
  const daysRemaining = Math.max(1, Number(cooldown.days_remaining));
  res.status(409).json({
    error: `An order was already placed for this customer within the last 25 days. You can place a new order for them in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} (from ${cooldown.next_allowed}).`,
    cooldown: {
      daysRemaining,
      nextAllowedDate: cooldown.next_allowed,
    },
  });
}

router.get("/orders", requirePermission("orders"), async (req: AuthRequest, res: Response) => {
  try {
    const rawLimit = Number(req.query.limit ?? 200);
    const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 200 : rawLimit), 1000);
    const privileged = isPrivileged(req.auth!.role);

    // Server-side filters, so they search the whole history rather than the
    // rows that happened to be loaded.
    const conditions: SQL[] = [];
    if (!privileged) conditions.push(eq(ordersTable.createdById, req.auth!.userId));

    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    if (search) {
      // Matches the customer name anywhere, or the invoice number as a prefix
      // (the UI shows the first 8 characters of the id, uppercased).
      conditions.push(
        sql`(${customersTable.name} ILIKE ${"%" + search + "%"} OR ${ordersTable.id} ILIKE ${search.toLowerCase() + "%"})`
      );
    }

    const from = typeof req.query.from === "string" ? req.query.from : "";
    const to = typeof req.query.to === "string" ? req.query.to : "";
    if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
      res.status(400).json({ error: "Dates must be YYYY-MM-DD" });
      return;
    }
    if (from) conditions.push(sql`${ordersTable.createdAt} >= ${from}::date`);
    if (to) conditions.push(sql`${ordersTable.createdAt} < (${to}::date + interval '1 day')`);

    const status = typeof req.query.status === "string" ? req.query.status : "";
    if (status) {
      if (!isValidStatus(status)) {
        res.status(400).json({ error: "Invalid status" });
        return;
      }
      conditions.push(eq(ordersTable.status, status));
    }

    const paid = typeof req.query.paid === "string" ? req.query.paid : "";
    if (paid === "true" || paid === "false") {
      conditions.push(eq(ordersTable.isPaid, paid === "true"));
    }

    const query = db.select({
      id: ordersTable.id,
      customerId: ordersTable.customerId,
      createdById: ordersTable.createdById,
      totalAmount: ordersTable.totalAmount,
      status: ordersTable.status,
      isPaid: ordersTable.isPaid,
      paymentMethod: ordersTable.paymentMethod,
      createdAt: ordersTable.createdAt,
      customerName: customersTable.name,
    })
      .from(ordersTable)
      .leftJoin(customersTable, eq(ordersTable.customerId, customersTable.id))
      .orderBy(sql`${ordersTable.createdAt} desc`)
      .limit(limit);

    const orders = await (conditions.length ? query.where(and(...conditions)) : query);

    res.json(orders.map(o => ({
      ...o,
      customer: { name: o.customerName || "" },
      customerName: undefined,
    })));
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/orders", requirePermission("create-orders"), async (req: AuthRequest, res: Response) => {
  try {
    const { customerId, items, invoiceDate, isPaid, paymentMethod, note, roundOff, postage, createdById: requestedCreatedById } = req.body;
    // Privileged users may attribute the order to another user (the "Created By"
    // selection on the form); everyone else is recorded as themselves.
    const createdById = isPrivileged(req.auth!.role) && requestedCreatedById
      ? requestedCreatedById
      : req.auth!.userId;
    const roundOffAmount = Number.isFinite(Number(roundOff)) ? Number(roundOff) : 0;
    const postageAmount = Number.isFinite(Number(postage)) && Number(postage) > 0 ? Number(postage) : 0;
    if (!customerId || !items?.length) {
      res.status(400).json({ error: "Customer and items are required" });
      return;
    }

    const customerRows = await db.select({ status: customersTable.status }).from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
    if (!customerRows[0]) {
      res.status(400).json({ error: "Customer not found" });
      return;
    }
    if (customerRows[0].status === "dnc") {
      res.status(400).json({ error: "Cannot create an order for a DNC customer" });
      return;
    }

    const cooldown = await activeCooldown(customerId);
    if (cooldown) {
      sendCooldown(res, cooldown);
      return;
    }

    const productIds: string[] = items.map((i: any) => i.productId);

    const order = await db.transaction(async (tx) => {
      // Lock product rows for the duration of this transaction to prevent
      // concurrent orders from double-spending the same stock.
      const lockedRows = await tx.execute(
        sql`SELECT id, stock_quantity, name, selling_price FROM products WHERE id = ANY(ARRAY[${sql.join(productIds.map(id => sql`${id}`), sql`, `)}]) FOR UPDATE`
      );
      const productMap = new Map(
        (lockedRows.rows as any[]).map((p: any) => [
          p.id,
          { id: p.id, stockQuantity: Number(p.stock_quantity), name: p.name, sellingPrice: p.selling_price },
        ])
      );

      for (const [productId, quantity] of quantitiesByProduct(items)) {
        const product = productMap.get(productId);
        if (!product) {
          throw Object.assign(new Error(`Product not found`), { status: 400 });
        }
        if (product.stockQuantity < quantity) {
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

      // Add manual postage, then the round-off adjustment (can be negative);
      // never below 0.
      totalAmount = Math.max(0, totalAmount + postageAmount + roundOffAmount);

      const [created] = await tx.insert(ordersTable).values({
        customerId,
        createdById,
        totalAmount: String(totalAmount),
        postage: String(postageAmount),
        isPaid: !!isPaid,
        paymentMethod: paymentMethod || null,
        note: note || null,
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

router.get("/orders/:id", requireAnyPermission("orders", "create-orders", "edit-orders"), async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");
    const orders = await db.select({
      id: ordersTable.id,
      customerId: ordersTable.customerId,
      createdById: ordersTable.createdById,
      totalAmount: ordersTable.totalAmount,
      status: ordersTable.status,
      isPaid: ordersTable.isPaid,
      paymentMethod: ordersTable.paymentMethod,
      postage: ordersTable.postage,
      note: ordersTable.note,
      createdAt: ordersTable.createdAt,
      customerName: customersTable.name,
    })
      .from(ordersTable)
      .leftJoin(customersTable, eq(ordersTable.customerId, customersTable.id))
      .where(eq(ordersTable.id, id))
      .limit(1);

    // 404 rather than 403 for someone else's order: the list is scoped per
    // user, so revealing that the id exists would already leak information.
    if (!orders[0] || (!isPrivileged(req.auth!.role) && orders[0].createdById !== req.auth!.userId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const items = await db.select({
      id: orderItemsTable.id,
      orderId: orderItemsTable.orderId,
      productId: orderItemsTable.productId,
      quantity: orderItemsTable.quantity,
      price: orderItemsTable.price,
      productName: productsTable.name,
    })
      .from(orderItemsTable)
      .leftJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
      .where(eq(orderItemsTable.orderId, id));

    const order = orders[0];
    res.json({
      ...order,
      customer: { name: order.customerName || "" },
      customerName: undefined,
      items: items.map(i => ({ ...i, product: { name: i.productName || "" }, productName: undefined })),
    });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/orders/:id", requirePermission("delete-orders"), async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");
    const existing = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!existing[0] || (!isPrivileged(req.auth!.role) && existing[0].createdById !== req.auth!.userId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const order = existing[0];
    const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));

    const isActive = !(CANCELLED_STATUSES as readonly string[]).includes(order.status);

    await db.transaction(async (tx) => {
      if (isActive) {
        for (const item of items) {
          await tx.update(productsTable)
            .set({ stockQuantity: sql`${productsTable.stockQuantity} + ${Number(item.quantity)}` })
            .where(eq(productsTable.id, item.productId));
        }
      }
      await tx.delete(ordersTable).where(eq(ordersTable.id, id));
    });

    res.json({ success: true });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/orders/:id", requireAnyPermission("edit-orders", "change-order-status"), async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");
    const { customerId, items, invoiceDate, createdById: requestedCreatedById, status, isPaid, paymentMethod, roundOff, postage, note } = req.body;
    const privileged = isPrivileged(req.auth!.role);
    const permissions = req.auth!.permissions ?? [];

    if (status !== undefined && !isValidStatus(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    const existing = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!existing[0] || (!privileged && existing[0].createdById !== req.auth!.userId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const existingOrder = existing[0];

    // `change-order-status` on its own covers exactly the status buttons (plus
    // the paid toggle shown next to them) — not a full edit.
    const canEditOrders = privileged || permissions.includes("edit-orders");
    const statusOnlyBody = items === undefined && customerId === undefined && requestedCreatedById === undefined;
    if (!canEditOrders && !(statusOnlyBody && permissions.includes("change-order-status"))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    // Only privileged users may reassign who an order (and its commission)
    // belongs to — same rule as on create.
    const createdById = privileged && requestedCreatedById !== undefined && requestedCreatedById
      ? requestedCreatedById
      : existingOrder.createdById;

    // Moving the order to a different customer re-runs the same checks as
    // creating one for them (existence, DNC, cooldown excluding this order).
    if (customerId && customerId !== existingOrder.customerId) {
      const customerRows = await db.select({ status: customersTable.status }).from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
      if (!customerRows[0]) {
        res.status(400).json({ error: "Customer not found" });
        return;
      }
      if (customerRows[0].status === "dnc") {
        res.status(400).json({ error: "Cannot move an order to a DNC customer" });
        return;
      }
      const cooldown = await activeCooldown(customerId, id);
      if (cooldown) {
        sendCooldown(res, cooldown);
        return;
      }
    }

    // Stock movements depend on whether the order counts against stock before
    // and after this update. A cancelled order's quantities were already
    // restocked when it was cancelled, so editing it must not restock again.
    const wasActive = !(CANCELLED_STATUSES as readonly string[]).includes(existingOrder.status);
    const willBeActive = status !== undefined ? !(CANCELLED_STATUSES as readonly string[]).includes(status) : wasActive;

    const roundOffAmount = Number.isFinite(Number(roundOff)) ? Number(roundOff) : 0;
    const postageAmount = Number.isFinite(Number(postage)) && Number(postage) > 0 ? Number(postage) : 0;

    const sharedFields = {
      ...(status !== undefined && { status }),
      ...(isPaid !== undefined && { isPaid }),
      ...(paymentMethod !== undefined && { paymentMethod }),
      ...(note !== undefined && { note: note || null }),
      ...(invoiceDate ? { createdAt: new Date(invoiceDate) } : {}),
    };

    if (items) {
      const existingItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));
      const oldItemMap = new Map(existingItems.map(i => [i.productId, Number(i.quantity)]));
      const productIds = [...new Set<string>([...items.map((i: any) => i.productId), ...existingItems.map(i => i.productId)])];

      const updated = await db.transaction(async (tx) => {
        // Same row locks as on create, so concurrent orders can't double-spend
        // the stock this edit is reshuffling.
        const lockedRows = await tx.execute(
          sql`SELECT id, stock_quantity, name, selling_price FROM products WHERE id = ANY(ARRAY[${sql.join(productIds.map(pid => sql`${pid}`), sql`, `)}]) FOR UPDATE`
        );
        const productMap = new Map(
          (lockedRows.rows as any[]).map((p: any) => [
            p.id,
            { id: p.id, stockQuantity: Number(p.stock_quantity), name: p.name, sellingPrice: p.selling_price },
          ])
        );

        if (willBeActive) {
          for (const [productId, quantity] of quantitiesByProduct(items)) {
            const product = productMap.get(productId);
            if (!product) {
              throw Object.assign(new Error(`Product not found`), { status: 400 });
            }
            // The old quantities only come back into stock if the order was
            // active — a cancelled order's stock was restored at cancellation.
            const oldQty = wasActive ? (oldItemMap.get(productId) ?? 0) : 0;
            if (product.stockQuantity + oldQty < quantity) {
              throw Object.assign(new Error(`Insufficient stock for "${product.name}"`), { status: 400 });
            }
          }
        } else {
          for (const item of items) {
            if (!productMap.get(item.productId)) {
              throw Object.assign(new Error(`Product not found`), { status: 400 });
            }
          }
        }

        let totalAmount = 0;
        const orderItemsData = items.map((item: any) => {
          const product = productMap.get(item.productId)!;
          const unitPrice = item.price !== undefined && Number(item.price) >= 0 ? Number(item.price) : Number(product.sellingPrice);
          totalAmount += unitPrice * item.quantity;
          return { productId: item.productId, quantity: String(item.quantity), price: String(unitPrice) };
        });

        // Add manual postage, then the round-off adjustment (can be negative);
        // never below 0.
        totalAmount = Math.max(0, totalAmount + postageAmount + roundOffAmount);

        if (wasActive) {
          for (const item of existingItems) {
            await tx.update(productsTable)
              .set({ stockQuantity: sql`${productsTable.stockQuantity} + ${Number(item.quantity)}` })
              .where(eq(productsTable.id, item.productId));
          }
        }

        await tx.delete(orderItemsTable).where(eq(orderItemsTable.orderId, id));

        for (const item of orderItemsData) {
          await tx.insert(orderItemsTable).values({ orderId: id, ...item });
          if (willBeActive) {
            await tx.update(productsTable)
              .set({ stockQuantity: sql`${productsTable.stockQuantity} - ${Number(item.quantity)}` })
              .where(eq(productsTable.id, item.productId));
          }
        }

        const [u] = await tx.update(ordersTable)
          .set({
            customerId: customerId ?? existingOrder.customerId,
            totalAmount: String(totalAmount),
            postage: String(postageAmount),
            createdById,
            ...sharedFields,
          })
          .where(eq(ordersTable.id, id))
          .returning();

        return u;
      });

      res.json(updated);
      return;
    }

    // No items in the body: field updates and status transitions on the
    // existing lines (the status buttons on the order page land here).
    const existingItems = wasActive === willBeActive
      ? []
      : await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));

    const updated = await db.transaction(async (tx) => {
      if (wasActive && !willBeActive) {
        for (const item of existingItems) {
          await tx.update(productsTable)
            .set({ stockQuantity: sql`${productsTable.stockQuantity} + ${Number(item.quantity)}` })
            .where(eq(productsTable.id, item.productId));
        }
      } else if (!wasActive && willBeActive) {
        // Reactivating deducts stock again, so it needs the same availability
        // check (under lock) as a new order.
        const productIds = [...new Set(existingItems.map(i => i.productId))];
        if (productIds.length) {
          const lockedRows = await tx.execute(
            sql`SELECT id, stock_quantity, name FROM products WHERE id = ANY(ARRAY[${sql.join(productIds.map(pid => sql`${pid}`), sql`, `)}]) FOR UPDATE`
          );
          const stockMap = new Map((lockedRows.rows as any[]).map((p: any) => [p.id, { stock: Number(p.stock_quantity), name: p.name }]));
          for (const [productId, quantity] of quantitiesByProduct(existingItems.map(i => ({ productId: i.productId, quantity: Number(i.quantity) })))) {
            const entry = stockMap.get(productId);
            if (!entry || entry.stock < quantity) {
              throw Object.assign(new Error(`Insufficient stock to reactivate: "${entry?.name ?? "Unknown product"}"`), { status: 400 });
            }
          }
        }
        for (const item of existingItems) {
          await tx.update(productsTable)
            .set({ stockQuantity: sql`${productsTable.stockQuantity} - ${Number(item.quantity)}` })
            .where(eq(productsTable.id, item.productId));
        }
      }

      const [u] = await tx.update(ordersTable)
        .set({
          ...(customerId && { customerId }),
          createdById,
          ...sharedFields,
        })
        .where(eq(ordersTable.id, id))
        .returning();
      return u;
    });

    res.json(updated);
  } catch (e: any) {
    if (e?.status === 400) {
      res.status(400).json({ error: e.message });
      return;
    }
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
