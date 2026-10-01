import { Router, Response } from "express";
import { db } from "@workspace/db";
import { purchasesTable, productsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requirePermission, param, type AuthRequest } from "../lib/middleware";

const router = Router();

router.get("/purchases", requirePermission("purchases"), async (req: AuthRequest, res: Response) => {
  try {
    const rawLimit = Number(req.query.limit ?? 200);
    const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 200 : rawLimit), 1000);
    const purchases = await db.select({
      id: purchasesTable.id,
      productId: purchasesTable.productId,
      quantity: purchasesTable.quantity,
      unitCost: purchasesTable.unitCost,
      totalCost: purchasesTable.totalCost,
      reference: purchasesTable.reference,
      batchRef: purchasesTable.batchRef,
      vatAmount: purchasesTable.vatAmount,
      vatEnabled: purchasesTable.vatEnabled,
      vatRate: purchasesTable.vatRate,
      createdAt: purchasesTable.createdAt,
      productName: productsTable.name,
      productSku: productsTable.sku,
    })
      .from(purchasesTable)
      .leftJoin(productsTable, eq(purchasesTable.productId, productsTable.id))
      .orderBy(sql`${purchasesTable.createdAt} desc`)
      .limit(limit);

    res.json(purchases.map(p => ({
      ...p,
      product: { id: p.productId, name: p.productName || "", sku: p.productSku || "" },
      productName: undefined,
      productSku: undefined,
    })));
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/purchases", requirePermission("add-purchases"), async (req: AuthRequest, res: Response) => {
  try {
    const { items, reference, batchRef, vatEnabled, vatRate } = req.body;
    if (!items?.length) {
      res.status(400).json({ error: "Items are required" });
      return;
    }

    const vatR = vatEnabled ? Number(vatRate ?? 0) : 0;

    for (const lineItem of items) {
      const qty = Number(lineItem.quantity);
      const cost = Number(lineItem.unitCost);
      if (!Number.isInteger(qty) || qty <= 0) {
        res.status(400).json({ error: "Quantity must be a whole number of 1 or more" });
        return;
      }
      if (!Number.isFinite(cost) || cost < 0) {
        res.status(400).json({ error: "Unit cost must be 0 or more" });
        return;
      }
    }

    const created = await db.transaction(async (tx) => {
      const results = [];
      for (const lineItem of items) {
        const { productId, quantity, unitCost } = lineItem;
        const qty = Number(quantity);
        const cost = Number(unitCost);
        const subTotal = qty * cost;
        const vatAmount = vatEnabled ? subTotal * (vatR / 100) : 0;
        const totalCost = subTotal + vatAmount;

        const [purchase] = await tx.insert(purchasesTable).values({
          productId,
          quantity: qty,
          unitCost: String(cost),
          totalCost: String(totalCost),
          reference: reference || null,
          batchRef: batchRef || null,
          vatEnabled: !!vatEnabled,
          vatRate: String(vatR),
          vatAmount: String(vatAmount),
        }).returning();

        await tx.update(productsTable)
          .set({ stockQuantity: sql`${productsTable.stockQuantity} + ${qty}` })
          .where(eq(productsTable.id, productId));

        results.push(purchase);
      }
      return results;
    });

    res.status(201).json(created);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/purchases/:id", requirePermission("edit-purchases"), async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");
    const { productId, quantity, unitCost, reference, batchRef, vatEnabled, vatRate } = req.body;
    const qty = Number(quantity);
    const cost = Number(unitCost);
    if (!Number.isInteger(qty) || qty <= 0) {
      res.status(400).json({ error: "Quantity must be a whole number of 1 or more" });
      return;
    }
    if (!Number.isFinite(cost) || cost < 0) {
      res.status(400).json({ error: "Unit cost must be 0 or more" });
      return;
    }
    const vatR = vatEnabled ? Number(vatRate ?? 0) : 0;
    const subTotal = qty * cost;
    const vatAmount = vatEnabled ? subTotal * (vatR / 100) : 0;
    const totalCost = subTotal + vatAmount;

    const existing = await db.select().from(purchasesTable).where(eq(purchasesTable.id, id)).limit(1);
    if (!existing[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const prev = existing[0];
    const qtyDiff = qty - prev.quantity;
    const productChanged = productId !== prev.productId;

    const updated = await db.transaction(async (tx) => {
      // Reducing or moving a purchase takes stock back out; if those units
      // have already been sold, the adjustment would drive stock negative.
      const removals: { productId: string; amount: number }[] = [];
      if (productChanged) removals.push({ productId: prev.productId, amount: prev.quantity });
      else if (qtyDiff < 0) removals.push({ productId, amount: -qtyDiff });
      for (const removal of removals) {
        const rows = await tx.execute(
          sql`SELECT stock_quantity, name FROM products WHERE id = ${removal.productId} FOR UPDATE`
        );
        const row = (rows.rows as any[])[0];
        if (row && Number(row.stock_quantity) < removal.amount) {
          throw Object.assign(
            new Error(`Cannot adjust: ${removal.amount - Number(row.stock_quantity)} of the ${removal.amount} units from this purchase of "${row.name}" have already been sold`),
            { status: 409 }
          );
        }
      }

      const [u] = await tx.update(purchasesTable)
        .set({
          productId,
          quantity: qty,
          unitCost: String(cost),
          totalCost: String(totalCost),
          reference: reference || null,
          batchRef: batchRef || null,
          vatEnabled: !!vatEnabled,
          vatRate: String(vatR),
          vatAmount: String(vatAmount),
        })
        .where(eq(purchasesTable.id, id))
        .returning();

      if (productChanged) {
        await tx.update(productsTable)
          .set({ stockQuantity: sql`${productsTable.stockQuantity} - ${prev.quantity}` })
          .where(eq(productsTable.id, prev.productId));
        await tx.update(productsTable)
          .set({ stockQuantity: sql`${productsTable.stockQuantity} + ${qty}` })
          .where(eq(productsTable.id, productId));
      } else if (qtyDiff !== 0) {
        await tx.update(productsTable)
          .set({ stockQuantity: sql`${productsTable.stockQuantity} + ${qtyDiff}` })
          .where(eq(productsTable.id, productId));
      }

      return u;
    });

    res.json(updated);
  } catch (e: any) {
    if (e?.status === 409) {
      res.status(409).json({ error: e.message });
      return;
    }
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/purchases/:id", requirePermission("delete-purchases"), async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");
    const purchaseRows = await db.select().from(purchasesTable).where(eq(purchasesTable.id, id)).limit(1);
    if (!purchaseRows[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const purchase = purchaseRows[0];

    await db.transaction(async (tx) => {
      // Deleting a purchase takes its units back out of stock; refuse when
      // they have already been sold, instead of going negative.
      const rows = await tx.execute(
        sql`SELECT stock_quantity, name FROM products WHERE id = ${purchase.productId} FOR UPDATE`
      );
      const row = (rows.rows as any[])[0];
      if (row && Number(row.stock_quantity) < purchase.quantity) {
        throw Object.assign(
          new Error(`Cannot delete: ${purchase.quantity - Number(row.stock_quantity)} of the ${purchase.quantity} units from this purchase of "${row.name}" have already been sold`),
          { status: 409 }
        );
      }
      await tx.delete(purchasesTable).where(eq(purchasesTable.id, id));
      const updated = await tx.update(productsTable)
        .set({ stockQuantity: sql`${productsTable.stockQuantity} - ${purchase.quantity}` })
        .where(eq(productsTable.id, purchase.productId))
        .returning({ id: productsTable.id });
      if (!updated[0]) {
        req.log.warn(
          { purchaseId: req.params.id, productId: purchase.productId },
          "Deleted purchase references a missing product; stock not adjusted"
        );
      }
    });

    res.json({ success: true });
  } catch (e: any) {
    if (e?.status === 409) {
      res.status(409).json({ error: e.message });
      return;
    }
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
