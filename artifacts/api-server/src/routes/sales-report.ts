import { Router, Response } from "express";
import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { db } from "@workspace/db";
import { ordersTable, orderItemsTable, productsTable, customersTable, usersTable } from "@workspace/db";
import { eq, gte, lte, and, inArray } from "drizzle-orm";
import { requirePermission, isPrivileged, type AuthRequest } from "../lib/middleware";
import { SalesReportPDF } from "../lib/sales-report-pdf";
import { getCompanyDetails } from "../lib/settings";

const router = Router();

/** Builds the full report payload; shared by the JSON endpoint and the PDF. */
async function computeSalesReport(req: AuthRequest) {
  {
    const { from, to, userId } = req.query;
    if (!from || !to) {
      return { ok: false as const, status: 400, error: "from and to are required" };
    }

    const fromDate = new Date(String(from));
    const toDate = new Date(String(to));
    toDate.setHours(23, 59, 59, 999);
    const privileged = isPrivileged(req.auth!.role);
    const dateFilter = and(gte(ordersTable.createdAt, fromDate), lte(ordersTable.createdAt, toDate));
    // Privileged users see all users by default, or a single user when a
    // userId filter is supplied. Non-privileged users are always scoped to
    // their own orders.
    const scopedUserId = privileged
      ? (typeof userId === "string" && userId ? userId : null)
      : req.auth!.userId;
    const whereClause = scopedUserId
      ? and(dateFilter, eq(ordersTable.createdById, scopedUserId))
      : dateFilter;

    const orders = await db.select({
      id: ordersTable.id,
      totalAmount: ordersTable.totalAmount,
      createdAt: ordersTable.createdAt,
      status: ordersTable.status,
      customerId: ordersTable.customerId,
      createdById: ordersTable.createdById,
      customerName: customersTable.name,
      userUsername: usersTable.username,
      userCommissionRate: usersTable.commissionRate,
    })
      .from(ordersTable)
      .leftJoin(customersTable, eq(ordersTable.customerId, customersTable.id))
      .leftJoin(usersTable, eq(ordersTable.createdById, usersTable.id))
      .where(whereClause);

    const orderIds = orders.map(o => o.id);
    let allItemsData: {
      orderId: string;
      productId: string;
      quantity: string;
      price: string;
      productName: string | null;
    }[] = [];

    if (orderIds.length > 0) {
      allItemsData = await db.select({
        orderId: orderItemsTable.orderId,
        productId: orderItemsTable.productId,
        quantity: orderItemsTable.quantity,
        price: orderItemsTable.price,
        productName: productsTable.name,
      })
        .from(orderItemsTable)
        .leftJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
        .where(inArray(orderItemsTable.orderId, orderIds));
    }

    const itemsByOrder = new Map<string, typeof allItemsData>();
    for (const item of allItemsData) {
      if (!itemsByOrder.has(item.orderId)) itemsByOrder.set(item.orderId, []);
      itemsByOrder.get(item.orderId)!.push(item);
    }

    // Cancelled / refunded orders are excluded from net sales (they contribute
    // 0, not a negative) and reported separately in their own total. For the
    // per-order display they show as a negative so the reversal is visible.
    const REVERSED = new Set(["CANCELLED", "REFUNDED"]);
    const isReversed = (o: { status: string | null }) => !!o.status && REVERSED.has(o.status);
    const activeAmount = (o: { status: string | null; totalAmount: string | number }) =>
      isReversed(o) ? 0 : Number(o.totalAmount);
    const displayAmount = (o: { status: string | null; totalAmount: string | number }) =>
      (isReversed(o) ? -1 : 1) * Number(o.totalAmount);

    const totalRevenue = orders.reduce((sum, o) => sum + activeAmount(o), 0);
    const totalOrders = orders.length;
    const activeOrderCount = orders.filter(o => !isReversed(o)).length;
    // Averaged over the orders that actually contribute revenue; dividing by a
    // count that includes reversed orders understates it.
    const avgOrderValue = activeOrderCount > 0 ? totalRevenue / activeOrderCount : 0;

    const reversedOrders = orders.filter(isReversed);
    const cancelledRefundedAmount = reversedOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const cancelledRefundedCount = reversedOrders.length;

    const productMap = new Map<string, { name: string; unitsSold: number; revenue: number }>();
    for (const order of orders) {
      if (isReversed(order)) continue; // cancelled units were never sold
      const items = itemsByOrder.get(order.id) ?? [];
      for (const item of items) {
        const key = item.productId;
        const existing = productMap.get(key) ?? { name: item.productName || "", unitsSold: 0, revenue: 0 };
        existing.unitsSold += Number(item.quantity);
        existing.revenue += Number(item.price) * Number(item.quantity);
        productMap.set(key, existing);
      }
    }
    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const userMap = new Map<string, {
      userId: string;
      username: string;
      totalSales: number;
      totalOrders: number;
      commissionRate: number;
      commission: number;
    }>();

    for (const order of orders) {
      if (!order.createdById || !order.userUsername) continue;
      if (isReversed(order)) continue; // keep per-user counts consistent with their sales
      const rate = Number(order.userCommissionRate ?? 0);
      const amount = activeAmount(order);
      const existing = userMap.get(order.createdById) ?? {
        userId: order.createdById,
        username: order.userUsername,
        totalSales: 0,
        totalOrders: 0,
        commissionRate: rate,
        commission: 0,
      };
      existing.totalSales += amount;
      existing.totalOrders += 1;
      existing.commission += amount * (rate / 100);
      userMap.set(order.createdById, existing);
    }

    let scopedUsername: string | null = null;
    if (scopedUserId) {
      const u = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, scopedUserId)).limit(1);
      scopedUsername = u[0]?.username ?? null;
    }

    const payload = {
      totalRevenue,
      totalOrders,
      avgOrderValue,
      cancelledRefundedAmount,
      cancelledRefundedCount,
      orders: orders.map(o => ({
        id: o.id,
        customer: o.customerName || "",
        createdBy: o.userUsername ?? null,
        itemCount: (itemsByOrder.get(o.id) ?? []).length,
        totalAmount: displayAmount(o),
        createdAt: o.createdAt,
        status: o.status,
      })),
      topProducts,
      userReport: Array.from(userMap.values()).sort((a, b) => b.totalSales - a.totalSales),
    };
    return { ok: true as const, payload, from: String(from), to: String(to), scopedUsername };
  }
}

router.get("/sales-report", requirePermission("sales-report"), async (req: AuthRequest, res: Response) => {
  try {
    const result = await computeSalesReport(req);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json(result.payload);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// The same report as a company-branded PDF document (header, summary, top
// products, user performance and the order list), for sharing and filing.
router.get("/sales-report/pdf", requirePermission("sales-report"), async (req: AuthRequest, res: Response) => {
  try {
    const result = await computeSalesReport(req);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    const company = await getCompanyDetails();
    const buffer = await renderToBuffer(
      React.createElement(SalesReportPDF, {
        data: result.payload,
        company,
        from: result.from,
        to: result.to,
        scopedUsername: result.scopedUsername,
      }) as React.ReactElement<DocumentProps>
    );
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="sales-report-${result.from}_to_${result.to}.pdf"`,
      "Content-Length": buffer.length,
    });
    res.send(buffer);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
