import { Router, Response } from "express";
import { db } from "@workspace/db";
import { productsTable, orderItemsTable, purchasesTable } from "@workspace/db";
import { eq, ilike, or, sql } from "drizzle-orm";
import { requirePermission, requireAnyPermission, isPrivileged, param, type AuthRequest } from "../lib/middleware";

const router = Router();

/** Parse an integer field; null when absent/blank, NaN when not a number. */
function toInt(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  return Number(v);
}

router.get("/products", requireAnyPermission("products", "create-orders", "edit-orders"), async (req: AuthRequest, res: Response) => {
  try {
    const { search } = req.query;
    const rawLimit = Number(req.query.limit ?? 200);
    const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 200 : rawLimit), 1000);
    // Newest first, so rows past the limit drop off the old end, not the new.
    const order = sql`${productsTable.createdAt} desc`;
    let products;
    if (search && typeof search === "string") {
      products = await db.select().from(productsTable).where(
        or(
          ilike(productsTable.name, `%${search}%`),
          ilike(productsTable.sku, `%${search}%`)
        )
      ).orderBy(order).limit(limit);
    } else {
      products = await db.select().from(productsTable).orderBy(order).limit(limit);
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
    const stock = toInt(stockQuantity);
    const threshold = toInt(lowStockThreshold);
    if ((stock !== null && (!Number.isInteger(stock) || stock < 0)) ||
        (threshold !== null && (!Number.isInteger(threshold) || threshold < 0))) {
      res.status(400).json({ error: "Stock and low-stock threshold must be whole numbers of 0 or more" });
      return;
    }
    const [product] = await db.insert(productsTable).values({
      name,
      sku,
      costPrice: String(costPrice),
      sellingPrice: String(sellingPrice),
      stockQuantity: stock ?? 0,
      // `?? 10` not `|| 10`: a threshold of 0 ("never flag this product") is a
      // valid choice and used to be silently turned into 10.
      lowStockThreshold: threshold ?? 10,
    }).returning();
    res.status(201).json(product);
  } catch (e: any) {
    if (e?.code === "23505" || e?.cause?.code === "23505") {
      res.status(409).json({ error: "A product with this SKU already exists" });
      return;
    }
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/products/:id", requireAnyPermission("products", "create-orders", "edit-orders"), async (req: AuthRequest, res: Response) => {
  try {
    const products = await db.select().from(productsTable).where(eq(productsTable.id, param(req, "id"))).limit(1);
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

router.put("/products/:id", requireAnyPermission("manage-products", "edit-products", "change-stock"), async (req: AuthRequest, res: Response) => {
  try {
    const { name, sku, costPrice, sellingPrice, stockQuantity, lowStockThreshold } = req.body;

    // `change-stock` on its own covers exactly the stock adjustment modal; it
    // must not unlock price or detail edits through the same endpoint.
    const permissions = req.auth!.permissions ?? [];
    const canEditDetails = isPrivileged(req.auth!.role)
      || permissions.includes("manage-products")
      || permissions.includes("edit-products");
    const touchesDetails = [name, sku, costPrice, sellingPrice, lowStockThreshold].some(v => v !== undefined);
    if (!canEditDetails && touchesDetails) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const stock = stockQuantity !== undefined ? toInt(stockQuantity) : null;
    const threshold = lowStockThreshold !== undefined ? toInt(lowStockThreshold) : null;
    if ((stock !== null && (!Number.isInteger(stock) || stock < 0)) ||
        (threshold !== null && (!Number.isInteger(threshold) || threshold < 0))) {
      res.status(400).json({ error: "Stock and low-stock threshold must be whole numbers of 0 or more" });
      return;
    }

    const updated = await db.update(productsTable)
      .set({
        ...(name !== undefined && { name }),
        ...(sku !== undefined && { sku }),
        ...(costPrice !== undefined && { costPrice: String(costPrice) }),
        ...(sellingPrice !== undefined && { sellingPrice: String(sellingPrice) }),
        ...(stock !== null && { stockQuantity: stock }),
        ...(threshold !== null && { lowStockThreshold: threshold }),
      })
      .where(eq(productsTable.id, param(req, "id")))
      .returning();
    if (!updated[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(updated[0]);
  } catch (e: any) {
    if (e?.code === "23505" || e?.cause?.code === "23505") {
      res.status(409).json({ error: "A product with this SKU already exists" });
      return;
    }
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/products/:id", requireAnyPermission("manage-products", "delete-products"), async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");
    // order_items has no database-level FK on product_id, so without this
    // check the delete "succeeds" and existing invoices lose the product name.
    const [refs] = await db.select({
      orderLines: sql<number>`(select count(*)::int from ${orderItemsTable} where ${orderItemsTable.productId} = ${id})`,
      purchases: sql<number>`(select count(*)::int from ${purchasesTable} where ${purchasesTable.productId} = ${id})`,
    }).from(sql`(select 1) as one`);
    if (Number(refs?.orderLines) > 0 || Number(refs?.purchases) > 0) {
      res.status(409).json({ error: "This product appears on orders or purchases and cannot be deleted. Set its stock to 0 instead." });
      return;
    }

    const deleted = await db.delete(productsTable).where(eq(productsTable.id, id)).returning();
    if (!deleted[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ success: true });
  } catch (e: any) {
    const pgCode = e?.code ?? e?.cause?.code;
    if (pgCode === "23503") {
      res.status(409).json({ error: "This product appears on orders or purchases and cannot be deleted. Set its stock to 0 instead." });
      return;
    }
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
