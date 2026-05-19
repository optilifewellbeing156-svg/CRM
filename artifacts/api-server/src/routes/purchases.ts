import { Router, Response } from "express";
import { db } from "@workspace/db";
import { purchasesTable, productsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAdmin, requirePermission, type AuthRequest } from "../lib/middleware";

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

router.put("/purchases/:id", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { productId, quantity, unitCost, reference, batchRef, vatEnabled, vatRate } = req.body;
    const qty = Number(quantity);
    const cost = Number(unitCost);
    const vatR = vatEnabled ? Number(vatRate ?? 0) : 0;
    const subTotal = qty * cost;
    const vatAmount = vatEnabled ? subTotal * (vatR / 100) : 0;
    const totalCost = subTotal + vatAmount;

    const existing = await db.select().from(purchasesTable).where(eq(purchasesTable.id, req.params.id)).limit(1);
    if (!existing[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const prev = existing[0];
    const qtyDiff = qty - prev.quantity;
    const productChanged = productId !== prev.productId;

    const updated = await db.transaction(async (tx) => {
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
        .where(eq(purchasesTable.id, req.params.id))
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
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

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
        req.log.warn(
          { purchaseId: req.params.id, productId: purchase.productId },
          "Deleted purchase references a missing product; stock not adjusted"
        );
      }
    });

    res.json({ success: true });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
