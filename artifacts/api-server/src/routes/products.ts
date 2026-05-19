import { Router, Response } from "express";
import { db } from "@workspace/db";
import { productsTable } from "@workspace/db";
import { eq, ilike, or } from "drizzle-orm";
import { requirePermission, requireAnyPermission, type AuthRequest } from "../lib/middleware";

const router = Router();

router.get("/products", requireAnyPermission("products", "create-orders", "edit-orders"), async (req: AuthRequest, res: Response) => {
  try {
    const { search } = req.query;
    const rawLimit = Number(req.query.limit ?? 200);
    const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 200 : rawLimit), 1000);
    let products;
    if (search && typeof search === "string") {
      products = await db.select().from(productsTable).where(
        or(
          ilike(productsTable.name, `%${search}%`),
          ilike(productsTable.sku, `%${search}%`)
        )
      ).orderBy(productsTable.createdAt).limit(limit);
    } else {
      products = await db.select().from(productsTable).orderBy(productsTable.createdAt).limit(limit);
    }
    res.json(products);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/products", requirePermission("manage-products"), async (req: AuthRequest, res: Response) => {
  try {
    const { name, sku, costPrice, sellingPrice, stockQuantity, lowStockThreshold } = req.body;
    if (!name || !sku || costPrice == null || sellingPrice == null) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    const [product] = await db.insert(productsTable).values({
      name,
      sku,
      costPrice: String(costPrice),
      sellingPrice: String(sellingPrice),
      stockQuantity: Number(stockQuantity) || 0,
      lowStockThreshold: Number(lowStockThreshold) || 10,
    }).returning();
    res.status(201).json(product);
  } catch (e: any) {
    if (e?.code === "23505") {
      res.status(409).json({ error: "A product with this SKU already exists" });
      return;
    }
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/products/:id", requireAnyPermission("products", "create-orders", "edit-orders"), async (req: AuthRequest, res: Response) => {
  try {
    const products = await db.select().from(productsTable).where(eq(productsTable.id, req.params.id)).limit(1);
    if (!products[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(products[0]);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/products/:id", requirePermission("manage-products"), async (req: AuthRequest, res: Response) => {
  try {
    const { name, sku, costPrice, sellingPrice, stockQuantity, lowStockThreshold } = req.body;
    const updated = await db.update(productsTable)
      .set({
        ...(name !== undefined && { name }),
        ...(sku !== undefined && { sku }),
        ...(costPrice !== undefined && { costPrice: String(costPrice) }),
        ...(sellingPrice !== undefined && { sellingPrice: String(sellingPrice) }),
        ...(stockQuantity !== undefined && { stockQuantity: Number(stockQuantity) }),
        ...(lowStockThreshold !== undefined && { lowStockThreshold: Number(lowStockThreshold) }),
      })
      .where(eq(productsTable.id, req.params.id))
      .returning();
    if (!updated[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(updated[0]);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/products/:id", requirePermission("manage-products"), async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await db.delete(productsTable).where(eq(productsTable.id, req.params.id)).returning();
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

export default router;
