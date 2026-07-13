import { Router, type Response } from "express";
import ExcelJS from "exceljs";
import { db, ordersTable, orderItemsTable, productsTable, customersTable, usersTable } from "@workspace/db";
import { eq, and, gte, lte, asc, type SQL } from "drizzle-orm";
import { requireSuperAdmin, requireAdmin, type AuthRequest } from "../lib/middleware";

const router = Router();

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Orders that don't count towards a customer's real spend. */
const NON_REVENUE_STATUSES = new Set(["CANCELLED", "REFUNDED"]);

function customerStatusLabel(status: string): string {
  return status === "dnc" ? "DNC" : "Active";
}

/** Mask a card number down to its last 4 digits — full PANs never leave the DB. */
function maskCard(card: string | null): string {
  if (!card) return "";
  const digits = card.replace(/\D/g, "");
  if (digits.length < 4) return "•••• ••••";
  return `•••• •••• •••• ${digits.slice(-4)}`;
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

async function sendWorkbook(res: Response, wb: ExcelJS.Workbook, filename: string): Promise<void> {
  res.setHeader("Content-Type", XLSX_MIME);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

/**
 * Super-admin-only export of every customer with all of their details, one row
 * per customer, plus a rolled-up summary of their order history (order count,
 * lifetime spend excluding cancelled/refunded, and last order date). This is
 * customer-centric — for a line-by-line order breakdown, use /export/orders.
 */
router.get("/export/customers", requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const customers = await db
      .select({
        id: customersTable.id,
        name: customersTable.name,
        phone: customersTable.phone,
        email: customersTable.email,
        address: customersTable.address,
        cardNumber: customersTable.cardNumber,
        cardExpiry: customersTable.cardExpiry,
        cardHolder: customersTable.cardHolder,
        status: customersTable.status,
        createdAt: customersTable.createdAt,
        addedBy: usersTable.username,
      })
      .from(customersTable)
      .leftJoin(usersTable, eq(customersTable.createdById, usersTable.id))
      .orderBy(asc(customersTable.name));

    const orders = await db
      .select({
        customerId: ordersTable.customerId,
        createdAt: ordersTable.createdAt,
        status: ordersTable.status,
        totalAmount: ordersTable.totalAmount,
      })
      .from(ordersTable);

    // Roll each customer's orders up into count / spend / last-order-date.
    const summary = new Map<string, { count: number; spent: number; last: Date | null }>();
    for (const o of orders) {
      const s = summary.get(o.customerId) ?? { count: 0, spent: 0, last: null };
      s.count += 1;
      if (!NON_REVENUE_STATUSES.has(o.status)) s.spent += Number(o.totalAmount);
      if (!s.last || o.createdAt > s.last) s.last = o.createdAt;
      summary.set(o.customerId, s);
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Customers");
    ws.columns = [
      { header: "Customer Name", key: "name", width: 26 },
      { header: "Contact Number", key: "phone", width: 18 },
      { header: "Email", key: "email", width: 28 },
      { header: "Address", key: "address", width: 42 },
      { header: "Card Holder", key: "cardHolder", width: 22 },
      { header: "Card Number", key: "cardNumber", width: 22 },
      { header: "Card Expiry", key: "cardExpiry", width: 12 },
      { header: "Status", key: "status", width: 12 },
      { header: "Added By", key: "addedBy", width: 18 },
      { header: "Date Added", key: "createdAt", width: 14 },
      { header: "Total Orders", key: "totalOrders", width: 14 },
      { header: "Total Spent (GBP)", key: "totalSpent", width: 18 },
      { header: "Last Order Date", key: "lastOrder", width: 16 },
    ];

    for (const c of customers) {
      const s = summary.get(c.id);
      ws.addRow({
        name: c.name,
        phone: c.phone ?? "",
        email: c.email ?? "",
        address: c.address ?? "",
        cardHolder: c.cardHolder ?? "",
        cardNumber: maskCard(c.cardNumber),
        cardExpiry: c.cardExpiry ?? "",
        status: customerStatusLabel(c.status),
        addedBy: c.addedBy ?? "—",
        createdAt: fmtDate(c.createdAt),
        totalOrders: s?.count ?? 0,
        totalSpent: s ? Number(s.spent.toFixed(2)) : 0,
        lastOrder: s?.last ? fmtDate(s.last) : "",
      });
    }

    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];

    await sendWorkbook(res, wb, `customers-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to export customers" });
  }
});

/**
 * Export orders within an optional date range, including which user took
 * each order. Available to privileged users (ADMIN / SUPER_ADMIN).
 * Query params: from=YYYY-MM-DD, to=YYYY-MM-DD (both inclusive, optional).
 */
router.get("/export/orders", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const fromStr = typeof req.query.from === "string" ? req.query.from : "";
    const toStr = typeof req.query.to === "string" ? req.query.to : "";

    const conditions: SQL[] = [];
    if (fromStr) {
      const from = new Date(`${fromStr}T00:00:00`);
      if (!Number.isNaN(from.getTime())) conditions.push(gte(ordersTable.createdAt, from));
    }
    if (toStr) {
      const to = new Date(`${toStr}T23:59:59.999`);
      if (!Number.isNaN(to.getTime())) conditions.push(lte(ordersTable.createdAt, to));
    }

    // One row per order LINE ITEM. Order-level fields repeat on each of an
    // order's lines; orders with no items still produce a single row (left
    // joins keep them). Products are joined in so the sheet carries the full
    // detail — product name, SKU, quantity, unit price and line total.
    const rows = await db
      .select({
        id: ordersTable.id,
        createdAt: ordersTable.createdAt,
        status: ordersTable.status,
        isPaid: ordersTable.isPaid,
        paymentMethod: ordersTable.paymentMethod,
        postage: ordersTable.postage,
        totalAmount: ordersTable.totalAmount,
        note: ordersTable.note,
        customerName: customersTable.name,
        customerPhone: customersTable.phone,
        takenBy: usersTable.username,
        productName: productsTable.name,
        productSku: productsTable.sku,
        quantity: orderItemsTable.quantity,
        unitPrice: orderItemsTable.price,
        itemId: orderItemsTable.id,
      })
      .from(ordersTable)
      .leftJoin(customersTable, eq(ordersTable.customerId, customersTable.id))
      .leftJoin(usersTable, eq(ordersTable.createdById, usersTable.id))
      .leftJoin(orderItemsTable, eq(orderItemsTable.orderId, ordersTable.id))
      .leftJoin(productsTable, eq(productsTable.id, orderItemsTable.productId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(ordersTable.createdAt), asc(orderItemsTable.id));

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Orders");
    ws.columns = [
      { header: "Order ID", key: "oid", width: 14 },
      { header: "Order Date", key: "odate", width: 14 },
      { header: "Customer Name", key: "customer", width: 26 },
      { header: "Contact Number", key: "phone", width: 18 },
      { header: "Taken By (User)", key: "takenBy", width: 20 },
      { header: "Order Status", key: "status", width: 14 },
      { header: "Paid", key: "paid", width: 8 },
      { header: "Payment Method", key: "pm", width: 16 },
      { header: "Product", key: "product", width: 28 },
      { header: "SKU", key: "sku", width: 16 },
      { header: "Quantity", key: "qty", width: 10 },
      { header: "Unit Price (GBP)", key: "unit", width: 16 },
      { header: "Line Total (GBP)", key: "lineTotal", width: 16 },
      { header: "Postage (GBP)", key: "postage", width: 14 },
      { header: "Order Total (GBP)", key: "total", width: 16 },
      { header: "Note", key: "note", width: 34 },
    ];

    for (const o of rows) {
      const qty = o.quantity != null ? Number(o.quantity) : null;
      const unit = o.unitPrice != null ? Number(o.unitPrice) : null;
      ws.addRow({
        oid: o.id.slice(0, 8).toUpperCase(),
        odate: fmtDate(o.createdAt),
        customer: o.customerName ?? "Unknown",
        phone: o.customerPhone ?? "",
        takenBy: o.takenBy ?? "—",
        status: o.status,
        paid: o.isPaid ? "Yes" : "No",
        pm: o.paymentMethod ?? "",
        product: o.productName ?? "",
        sku: o.productSku ?? "",
        qty: qty ?? "",
        unit: unit ?? "",
        lineTotal: qty != null && unit != null ? Number((qty * unit).toFixed(2)) : "",
        postage: Number(o.postage),
        total: Number(o.totalAmount),
        note: o.note ?? "",
      });
    }

    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];

    const range = fromStr || toStr ? `${fromStr || "start"}_to_${toStr || "end"}` : "all";
    await sendWorkbook(res, wb, `orders-${range}.xlsx`);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to export orders" });
  }
});

export default router;
