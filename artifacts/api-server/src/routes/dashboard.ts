import { Router, Response } from "express";
import { requirePermission, isPrivileged, type AuthRequest } from "../lib/middleware";
import { db } from "@workspace/db";
import { ordersTable } from "@workspace/db";
import { sql, eq, and, gte, lt, type SQL } from "drizzle-orm";

const router = Router();

const DAY_MS = 86_400_000;

/** Parse an ISO date/datetime query param. Returns null when absent or unparseable. */
function parseDate(v: unknown): Date | null {
  if (typeof v !== "string" || v.trim() === "") return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

router.get("/dashboard", requirePermission("dashboard"), async (req: AuthRequest, res: Response) => {
  try {
    const privileged = isPrivileged(req.auth!.role);
    const userId = req.auth!.userId;

    // Period window [from, to). The client sends explicit bounds computed in its
    // own timezone; falling back to the last 7 days keeps older clients working.
    const now = new Date();
    const to = parseDate(req.query.to) ?? now;
    const from = parseDate(req.query.from) ?? new Date(to.getTime() - 7 * DAY_MS);
    if (from.getTime() > to.getTime()) {
      res.status(400).json({ error: "'from' must be before 'to'" });
      return;
    }

    // Immediately preceding window of equal length, for the trend comparison.
    const span = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - span);

    const ownerCond = privileged ? undefined : eq(ordersTable.createdById, userId);
    const inWindow = (a: Date, b: Date): SQL =>
      and(gte(ordersTable.createdAt, a), lt(ordersTable.createdAt, b), ownerCond)!;

    const totals = (a: Date, b: Date) =>
      db
        .select({
          revenue: sql<number>`coalesce(sum(${ordersTable.totalAmount}), 0)`,
          orders: sql<number>`count(*)`,
        })
        .from(ordersTable)
        .where(inWindow(a, b));

    // Customers whose most recent order has aged past 30 days — a follow-up list.
    // Independent of the selected period, and excludes DNC ("do not contact") customers.
    const dormantSql = privileged
      ? sql`
          SELECT c.id, c.name, c.phone,
                 MAX(o.created_at) AS "lastOrderAt",
                 COUNT(o.id)::int AS "orderCount",
                 SUM(o.total_amount)::float AS "totalSpent"
          FROM customers c
          JOIN orders o ON o.customer_id = c.id
          WHERE coalesce(c.status, 'active') <> 'dnc'
          GROUP BY c.id, c.name, c.phone
          HAVING MAX(o.created_at) < NOW() - INTERVAL '30 days'
          ORDER BY MAX(o.created_at) DESC
          LIMIT 50
        `
      : sql`
          SELECT c.id, c.name, c.phone,
                 MAX(o.created_at) AS "lastOrderAt",
                 COUNT(o.id)::int AS "orderCount",
                 SUM(o.total_amount)::float AS "totalSpent"
          FROM customers c
          JOIN orders o ON o.customer_id = c.id
          WHERE coalesce(c.status, 'active') <> 'dnc'
            AND o.created_by_id = ${userId}
          GROUP BY c.id, c.name, c.phone
          HAVING MAX(o.created_at) < NOW() - INTERVAL '30 days'
          ORDER BY MAX(o.created_at) DESC
          LIMIT 50
        `;

    const [currentRows, previousRows, lowStockProducts, dailyRevenue, dormant] = await Promise.all([
      totals(from, to),
      totals(prevFrom, from),
      db.execute(sql`
        SELECT id, name, sku, stock_quantity AS "stockQuantity", low_stock_threshold AS "lowStockThreshold",
               cost_price AS "costPrice", selling_price AS "sellingPrice", created_at AS "createdAt"
        FROM products
        WHERE stock_quantity < low_stock_threshold
        ORDER BY stock_quantity ASC
      `),
      db
        .select({
          date: sql<string>`date(${ordersTable.createdAt})::text`,
          revenue: sql<number>`sum(${ordersTable.totalAmount})::float`,
          orders: sql<number>`count(*)::int`,
        })
        .from(ordersTable)
        .where(inWindow(from, to))
        .groupBy(sql`date(${ordersTable.createdAt})`)
        .orderBy(sql`date(${ordersTable.createdAt}) asc`),
      db.execute(dormantSql),
    ]);

    const revenue = Number(currentRows[0]?.revenue ?? 0);
    const orders = Number(currentRows[0]?.orders ?? 0);
    const prevRevenue = Number(previousRows[0]?.revenue ?? 0);
    const prevOrders = Number(previousRows[0]?.orders ?? 0);

    res.json({
      from: from.toISOString(),
      to: to.toISOString(),
      totalRevenue: revenue,
      totalOrders: orders,
      avgOrderValue: orders > 0 ? revenue / orders : 0,
      prevTotalRevenue: prevRevenue,
      prevTotalOrders: prevOrders,
      lowStockProducts: lowStockProducts.rows,
      dormantCustomers: (dormant.rows as any[]).map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        lastOrderAt: r.lastOrderAt,
        orderCount: Number(r.orderCount),
        totalSpent: Number(r.totalSpent ?? 0),
      })),
      dailyRevenue: dailyRevenue.map((r: { date: string; revenue: number; orders: number }) => ({
        date: r.date,
        revenue: Number(r.revenue),
        orders: Number(r.orders),
      })),
    });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
