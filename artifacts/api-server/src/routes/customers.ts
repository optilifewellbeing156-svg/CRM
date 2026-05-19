import { Router, Response } from "express";
import { db } from "@workspace/db";
import { customersTable, ordersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requirePermission, requireAnyPermission, isPrivileged, type AuthRequest } from "../lib/middleware";

const router = Router();

function maskCards(customers: any[], canViewCards: boolean) {
  return customers.map((c) => ({
    ...c,
    cardNumber: canViewCards ? c.cardNumber : (c.cardNumber ? `**** **** **** ${String(c.cardNumber).slice(-4)}` : null),
    cardExpiry: canViewCards ? c.cardExpiry : (c.cardExpiry ? "**/**" : null),
    cardHolder: canViewCards ? c.cardHolder : (c.cardHolder ? "****" : null),
  }));
}

router.get("/customers", requireAnyPermission("customers", "create-orders", "edit-orders"), async (req: AuthRequest, res: Response) => {
  try {
    const rawLimit = Number(req.query.limit ?? 200);
    const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 200 : rawLimit), 1000);
    const privileged = isPrivileged(req.auth!.role);
    const query = db.select().from(customersTable).orderBy(customersTable.createdAt).limit(limit);
    const customers = await (privileged
      ? query
      : query.where(eq(customersTable.createdById, req.auth!.userId)));
    const canView = privileged || (req.auth!.permissions ?? []).includes("view-card-details");
    res.json(maskCards(customers, canView));
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/customers", requirePermission("manage-customers"), async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, email, address, cardNumber, cardExpiry, cardHolder, status } = req.body;
    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }

    const dup = await db.select({ id: customersTable.id }).from(customersTable)
      .where(sql`
        lower(${customersTable.name}) = lower(${name})
        AND ${customersTable.phone} IS NOT DISTINCT FROM ${phone || null}
        AND lower(coalesce(${customersTable.email}, '')) = lower(coalesce(${email || null}, ''))
        AND lower(coalesce(${customersTable.address}, '')) = lower(coalesce(${address || null}, ''))
      `).limit(1);
    if (dup[0]) {
      res.status(409).json({ error: "A customer with the same name, phone, email and address already exists" });
      return;
    }

    const [customer] = await db.insert(customersTable).values({
      name,
      phone: phone || null,
      email: email || null,
      address: address || null,
      cardNumber: cardNumber || null,
      cardExpiry: cardExpiry || null,
      cardHolder: cardHolder || null,
      status: status === "dnc" ? "dnc" : "active",
      createdById: req.auth!.userId,
    }).returning();
    res.status(201).json(customer);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/customers/:id", requireAnyPermission("customers", "orders", "create-orders", "edit-orders"), async (req: AuthRequest, res: Response) => {
  try {
    const customers = await db.select().from(customersTable).where(eq(customersTable.id, req.params.id)).limit(1);
    if (!customers[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(customers[0]);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/customers/:id/orders", requireAnyPermission("customers", "orders"), async (req: AuthRequest, res: Response) => {
  try {
    const orders = await db.select().from(ordersTable)
      .where(eq(ordersTable.customerId, req.params.id))
      .orderBy(ordersTable.createdAt);
    res.json(orders);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/customers/:id/status", requirePermission("set-customer-status"), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (status !== "active" && status !== "dnc") {
      res.status(400).json({ error: "Status must be 'active' or 'dnc'" });
      return;
    }
    const updated = await db.update(customersTable)
      .set({ status })
      .where(eq(customersTable.id, req.params.id))
      .returning();
    if (!updated[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(updated[0]);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/customers/:id", requirePermission("manage-customers"), async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, email, address, cardNumber, cardExpiry, cardHolder } = req.body;

    if (name !== undefined) {
      const current = await db.select().from(customersTable).where(eq(customersTable.id, req.params.id)).limit(1);
      const merged = {
        name: name ?? current[0]?.name,
        phone: phone !== undefined ? (phone || null) : current[0]?.phone,
        email: email !== undefined ? (email || null) : current[0]?.email,
        address: address !== undefined ? (address || null) : current[0]?.address,
      };
      const dup = await db.select({ id: customersTable.id }).from(customersTable)
        .where(sql`
          lower(${customersTable.name}) = lower(${merged.name})
          AND ${customersTable.phone} IS NOT DISTINCT FROM ${merged.phone}
          AND lower(coalesce(${customersTable.email}, '')) = lower(coalesce(${merged.email}, ''))
          AND lower(coalesce(${customersTable.address}, '')) = lower(coalesce(${merged.address}, ''))
        `).limit(1);
      if (dup[0] && dup[0].id !== req.params.id) {
        res.status(409).json({ error: "A customer with the same name, phone, email and address already exists" });
        return;
      }
    }

    const updated = await db.update(customersTable)
      .set({
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(email !== undefined && { email: email || null }),
        ...(address !== undefined && { address: address || null }),
        ...(cardNumber !== undefined && { cardNumber: cardNumber || null }),
        ...(cardExpiry !== undefined && { cardExpiry: cardExpiry || null }),
        ...(cardHolder !== undefined && { cardHolder: cardHolder || null }),
      })
      .where(eq(customersTable.id, req.params.id))
      .returning();
    if (!updated[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(updated[0]);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/customers/:id", requirePermission("manage-customers"), async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await db.delete(customersTable).where(eq(customersTable.id, req.params.id)).returning();
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
