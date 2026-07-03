import { Router, Response } from "express";
import { db } from "@workspace/db";
import { ordersTable, orderItemsTable, productsTable, customersTable, usersTable } from "@workspace/db";
import { eq, gte, lte, and, inArray } from "drizzle-orm";
import { requirePermission, isPrivileged, type AuthRequest } from "../lib/middleware";

const router = Router();

router.get("/sales-report", requirePermission("sales-report"), async (req: AuthRequest, res: Response) => {
  try {
    const { from, to, userId } = req.query;
    if (!from || !to) {
      res.status(400).json({ error: "from and to are required" });
      return;
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

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const productMap = new Map<string, { name: string; unitsSold: number; revenue: number }>();
    for (const order of orders) {
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
      const rate = Number(order.userCommissionRate ?? 0);
      const amount = Number(order.totalAmount);
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

    res.json({
      totalRevenue,
      totalOrders,
      avgOrderValue,
      orders: orders.map(o => ({
        id: o.id,
        customer: o.customerName || "",
        createdBy: o.userUsername ?? null,
        itemCount: (itemsByOrder.get(o.id) ?? []).length,
        totalAmount: Number(o.totalAmount),
        createdAt: o.createdAt,
        status: o.status,
      })),
      topProducts,
      userReport: Array.from(userMap.values()).sort((a, b) => b.totalSales - a.totalSales),
    });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
