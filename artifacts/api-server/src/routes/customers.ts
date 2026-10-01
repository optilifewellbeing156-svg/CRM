import { Router, Response } from "express";
import { db } from "@workspace/db";
import { customersTable, ordersTable } from "@workspace/db";
import { eq, and, sql, type SQL } from "drizzle-orm";
import { requirePermission, requireAnyPermission, isPrivileged, param, type AuthRequest } from "../lib/middleware";

const router = Router();

function maskCards(customers: any[], canViewCards: boolean) {
  return customers.map((c) => ({
    ...c,
    cardNumber: canViewCards ? c.cardNumber : (c.cardNumber ? `**** **** **** ${String(c.cardNumber).slice(-4)}` : null),
    cardExpiry: canViewCards ? c.cardExpiry : (c.cardExpiry ? "**/**" : null),
    cardHolder: canViewCards ? c.cardHolder : (c.cardHolder ? "****" : null),
  }));
}

function canViewCards(req: AuthRequest): boolean {
  return isPrivileged(req.auth!.role) || (req.auth!.permissions ?? []).includes("view-card-details");
}

/** A masked value round-tripped from the UI; never something to store. */
function isMasked(value: unknown): boolean {
  return typeof value === "string" && value.includes("*");
}

router.get("/customers", requireAnyPermission("customers", "create-orders", "edit-orders"), async (req: AuthRequest, res: Response) => {
  try {
    const rawLimit = Number(req.query.limit ?? 200);
    const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 200 : rawLimit), 1000);
    const privileged = isPrivileged(req.auth!.role);

    const conditions: SQL[] = [];
    if (!privileged) conditions.push(eq(customersTable.createdById, req.auth!.userId));

    // Server-side search, so it covers the whole book rather than the rows the
    // page happened to load. Phone matching ignores spaces on both sides.
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    if (search) {
      const pattern = `%${search}%`;
      const phonePattern = `%${search.replace(/\s+/g, "")}%`;
      conditions.push(sql`(
        ${customersTable.name} ILIKE ${pattern}
        OR coalesce(${customersTable.email}, '') ILIKE ${pattern}
        OR coalesce(${customersTable.address}, '') ILIKE ${pattern}
        OR replace(coalesce(${customersTable.phone}, ''), ' ', '') ILIKE ${phonePattern}
      )`);
    }

    const query = db.select().from(customersTable)
      // Newest first: with the oldest first, anyone past the row limit never
      // sees the customers they just added.
      .orderBy(sql`${customersTable.createdAt} desc`)
      .limit(limit);
    const customers = await (conditions.length ? query.where(and(...conditions)) : query);
    res.json(maskCards(customers, canViewCards(req)));
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/customers", requireAnyPermission("manage-customers", "add-customers"), async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, email, address, cardNumber, cardExpiry, cardHolder, status } = req.body;
    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }

    // Scoped to the customers this user can see: the list is per-user for
    // non-privileged accounts, so a collision with a colleague's invisible
    // customer would otherwise be an unfixable dead end.
    const privileged = isPrivileged(req.auth!.role);
    const dup = await db.select({ id: customersTable.id }).from(customersTable)
      .where(sql`
        lower(${customersTable.name}) = lower(${name})
        AND ${customersTable.phone} IS NOT DISTINCT FROM ${phone || null}
        AND lower(coalesce(${customersTable.email}, '')) = lower(coalesce(${email || null}, ''))
        AND lower(coalesce(${customersTable.address}, '')) = lower(coalesce(${address || null}, ''))
        ${privileged ? sql`` : sql`AND ${customersTable.createdById} = ${req.auth!.userId}`}
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
      cardNumber: !isMasked(cardNumber) && cardNumber ? cardNumber : null,
      cardExpiry: !isMasked(cardExpiry) && cardExpiry ? cardExpiry : null,
      cardHolder: !isMasked(cardHolder) && cardHolder ? cardHolder : null,
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
    const customers = await db.select().from(customersTable).where(eq(customersTable.id, param(req, "id"))).limit(1);
    if (!customers[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    // Same masking as the list — this endpoint used to hand out the full card
    // number to anyone who could place an order.
    res.json(maskCards(customers, canViewCards(req))[0]);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/customers/:id/orders", requireAnyPermission("customers", "orders"), async (req: AuthRequest, res: Response) => {
  try {
    const customerCond = eq(ordersTable.customerId, param(req, "id"));
    // Non-privileged users see a customer's history only as far as their own
    // orders — the same scope as the orders list itself.
    const where = isPrivileged(req.auth!.role)
      ? customerCond
      : and(customerCond, eq(ordersTable.createdById, req.auth!.userId));
    const orders = await db.select().from(ordersTable)
      .where(where)
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
      .where(eq(customersTable.id, param(req, "id")))
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

router.put("/customers/:id", requireAnyPermission("manage-customers", "edit-customers"), async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");
    const { name, phone, email, address, cardNumber, cardExpiry, cardHolder } = req.body;

    if (name !== undefined) {
      const current = await db.select().from(customersTable).where(eq(customersTable.id, id)).limit(1);
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
      if (dup[0] && dup[0].id !== id) {
        res.status(409).json({ error: "A customer with the same name, phone, email and address already exists" });
        return;
      }
    }

    // Card fields are only writable by users who can see the real values, and
    // a masked value is never stored: users without view-card-details receive
    // "**** **** **** 1234" from the API, and their edit form used to echo it
    // back on save — permanently replacing the stored card with asterisks.
    const mayWriteCards = canViewCards(req);

    const updated = await db.update(customersTable)
      .set({
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(email !== undefined && { email: email || null }),
        ...(address !== undefined && { address: address || null }),
        ...(mayWriteCards && cardNumber !== undefined && !isMasked(cardNumber) && { cardNumber: cardNumber || null }),
        ...(mayWriteCards && cardExpiry !== undefined && !isMasked(cardExpiry) && { cardExpiry: cardExpiry || null }),
        ...(mayWriteCards && cardHolder !== undefined && !isMasked(cardHolder) && { cardHolder: cardHolder || null }),
      })
      .where(eq(customersTable.id, id))
      .returning();
    if (!updated[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(maskCards(updated, canViewCards(req))[0]);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/customers/:id", requireAnyPermission("manage-customers", "delete-customers"), async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await db.delete(customersTable).where(eq(customersTable.id, param(req, "id"))).returning();
    if (!deleted[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ success: true });
  } catch (e: any) {
    const pgCode = e?.code ?? e?.cause?.code;
    if (pgCode === "23503") {
      res.status(409).json({ error: "This customer has orders. Delete or reassign their orders first." });
      return;
    }
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
