import { Router, Response } from "express";
import { requirePermission, isPrivileged, type AuthRequest } from "../lib/middleware";
import { db } from "@workspace/db";
import { ordersTable, productsTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";

const router = Router();

router.get("/dashboard", requirePermission("dashboard"), async (req: AuthRequest, res: Response) => {
  try {
    const privileged = isPrivileged(req.auth!.role);
    const userId = req.auth!.userId;

    const [revenueRows, totalOrdersRows, lowStockProducts, dailyRevenue] = await Promise.all([
      privileged
        ? db.select({ total: sql<number>`coalesce(sum(${ordersTable.totalAmount}), 0)` }).from(ordersTable)
        : db.select({ total: sql<number>`coalesce(sum(${ordersTable.totalAmount}), 0)` }).from(ordersTable).where(eq(ordersTable.createdById, userId)),
      privileged
        ? db.select({ count: sql<number>`count(*)` }).from(ordersTable)
        : db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.createdById, userId)),
      db.execute(sql`
        SELECT id, name, sku, stock_quantity AS "stockQuantity", low_stock_threshold AS "lowStockThreshold",
               cost_price AS "costPrice", selling_price AS "sellingPrice", created_at AS "createdAt"
        FROM products
        WHERE stock_quantity < low_stock_threshold
        ORDER BY stock_quantity ASC
      `),
      privileged
        ? db.execute(sql`
            SELECT
              DATE(created_at)::text AS date,
              SUM(total_amount)::float AS revenue,
              COUNT(*)::int AS orders
            FROM orders
            WHERE created_at >= NOW() - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY date ASC
          `)
        : db.execute(sql`
            SELECT
              DATE(created_at)::text AS date,
              SUM(total_amount)::float AS revenue,
              COUNT(*)::int AS orders
            FROM orders
            WHERE created_at >= NOW() - INTERVAL '30 days'
              AND created_by_id = ${userId}
            GROUP BY DATE(created_at)
            ORDER BY date ASC
          `),
    ]);

    res.json({
      totalRevenue: Number(revenueRows[0]?.total ?? 0),
      totalOrders: Number(totalOrdersRows[0]?.count ?? 0),
      lowStockProducts: lowStockProducts.rows,
      dailyRevenue: (dailyRevenue.rows as any[]).map(r => ({ date: r.date, revenue: Number(r.revenue), orders: Number(r.orders) })),
    });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
