import { Router, Response } from "express";
import { db } from "@workspace/db";
import { ordersTable, orderItemsTable, productsTable, customersTable } from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";
import { requirePermission, requireAnyPermission, isPrivileged, type AuthRequest } from "../lib/middleware";

const router = Router();

router.get("/orders", requirePermission("orders"), async (req: AuthRequest, res: Response) => {
  try {
    const rawLimit = Number(req.query.limit ?? 200);
    const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 200 : rawLimit), 1000);
    const privileged = isPrivileged(req.auth!.role);
    const baseQuery = db.select({
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
    const orders = await (privileged
      ? baseQuery
      : baseQuery.where(eq(ordersTable.createdById, req.auth!.userId)));

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
    const { customerId, items, invoiceDate, isPaid, paymentMethod, note } = req.body;
    const createdById = req.auth!.userId;
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
    const orders = await db.select({
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
      .where(eq(ordersTable.id, req.params.id))
      .limit(1);

    if (!orders[0]) {
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
      .where(eq(orderItemsTable.orderId, req.params.id));

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
    const existing = await db.select().from(ordersTable).where(eq(ordersTable.id, req.params.id)).limit(1);
    if (!existing[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const order = existing[0];
    const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, req.params.id));

    const cancelledStatuses = ["CANCELLED", "REFUNDED"];
    const isActive = !cancelledStatuses.includes(order.status);

    await db.transaction(async (tx) => {
      if (isActive) {
        for (const item of items) {
          await tx.update(productsTable)
            .set({ stockQuantity: sql`${productsTable.stockQuantity} + ${Number(item.quantity)}` })
            .where(eq(productsTable.id, item.productId));
        }
      }
      await tx.delete(ordersTable).where(eq(ordersTable.id, req.params.id));
    });

    res.json({ success: true });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/orders/:id", requirePermission("edit-orders"), async (req: AuthRequest, res: Response) => {
  try {
    const { customerId, items, invoiceDate, createdById, status, isPaid, paymentMethod } = req.body;

    const existing = await db.select().from(ordersTable).where(eq(ordersTable.id, req.params.id)).limit(1);
    if (!existing[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const existingOrder = existing[0];

    if (status && !items && !customerId) {
      const validStatuses = ["PROCESSING", "PROCESSED", "DELIVERED", "CANCELLED", "REFUNDED"];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ error: "Invalid status" });
        return;
      }

      const cancelledStatuses = ["CANCELLED", "REFUNDED"];
      const wasActive = !cancelledStatuses.includes(existingOrder.status);
      const willBeActive = !cancelledStatuses.includes(status);

      const existingItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, req.params.id));

      const updated = await db.transaction(async (tx) => {
        if (wasActive && !willBeActive) {
          for (const item of existingItems) {
            await tx.update(productsTable)
              .set({ stockQuantity: sql`${productsTable.stockQuantity} + ${Number(item.quantity)}` })
              .where(eq(productsTable.id, item.productId));
          }
        } else if (!wasActive && willBeActive) {
          for (const item of existingItems) {
            await tx.update(productsTable)
              .set({ stockQuantity: sql`${productsTable.stockQuantity} - ${Number(item.quantity)}` })
              .where(eq(productsTable.id, item.productId));
          }
        }
        const [u] = await tx.update(ordersTable)
          .set({ status, ...(isPaid !== undefined && { isPaid }) })
          .where(eq(ordersTable.id, req.params.id))
          .returning();
        return u;
      });

      res.json(updated);
      return;
    }

    if (items) {
      const existingItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, req.params.id));

      const productIds = items.map((i: any) => i.productId);
      const products = await db.select().from(productsTable).where(inArray(productsTable.id, productIds));
      const productMap = new Map(products.map(p => [p.id, p]));
      const oldItemMap = new Map(existingItems.map(i => [i.productId, Number(i.quantity)]));

      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product) {
          res.status(400).json({ error: `Product not found` });
          return;
        }
        const oldQty = oldItemMap.get(item.productId) ?? 0;
        const effectiveAvailable = product.stockQuantity + oldQty;
        if (effectiveAvailable < item.quantity) {
          res.status(400).json({ error: `Insufficient stock for "${product.name}"` });
          return;
        }
      }

      let totalAmount = 0;
      const orderItemsData = items.map((item: any) => {
        const product = productMap.get(item.productId)!;
        const unitPrice = item.price !== undefined && Number(item.price) >= 0 ? Number(item.price) : Number(product.sellingPrice);
        totalAmount += unitPrice * item.quantity;
        return { productId: item.productId, quantity: String(item.quantity), price: String(unitPrice) };
      });

      const updated = await db.transaction(async (tx) => {
        for (const item of existingItems) {
          await tx.update(productsTable)
            .set({ stockQuantity: sql`${productsTable.stockQuantity} + ${Number(item.quantity)}` })
            .where(eq(productsTable.id, item.productId));
        }

        await tx.delete(orderItemsTable).where(eq(orderItemsTable.orderId, req.params.id));

        for (const item of orderItemsData) {
          await tx.insert(orderItemsTable).values({ orderId: req.params.id, ...item });
          await tx.update(productsTable)
            .set({ stockQuantity: sql`${productsTable.stockQuantity} - ${Number(item.quantity)}` })
            .where(eq(productsTable.id, item.productId));
        }

        const [u] = await tx.update(ordersTable)
          .set({
            customerId: customerId ?? existingOrder.customerId,
            totalAmount: String(totalAmount),
            createdById: createdById !== undefined ? createdById : existingOrder.createdById,
            ...(invoiceDate ? { createdAt: new Date(invoiceDate) } : {}),
            ...(status && { status }),
            ...(isPaid !== undefined && { isPaid }),
            ...(paymentMethod !== undefined && { paymentMethod }),
          })
          .where(eq(ordersTable.id, req.params.id))
          .returning();

        return u;
      });

      res.json(updated);
      return;
    }

    const [updated] = await db.update(ordersTable)
      .set({
        ...(customerId && { customerId }),
        ...(status && { status }),
        ...(isPaid !== undefined && { isPaid }),
        ...(paymentMethod !== undefined && { paymentMethod }),
        ...(invoiceDate && { createdAt: new Date(invoiceDate) }),
      })
      .where(eq(ordersTable.id, req.params.id))
      .returning();

    res.json(updated);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
