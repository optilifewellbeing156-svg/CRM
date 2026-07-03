import { Router, type Response } from "express";
import ExcelJS from "exceljs";
import { db, ordersTable, customersTable, usersTable } from "@workspace/db";
import { eq, and, gte, lte, asc, type SQL } from "drizzle-orm";
import { requireSuperAdmin, requireAdmin, type AuthRequest } from "../lib/middleware";

const router = Router();

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function customerStatusLabel(status: string): string {
  return status === "dnc" ? "DNC" : "Active";
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
 * Super-admin-only export of all customers with their past orders.
 * One row per order; customers with no orders still get a single row.
 */
router.get("/export/customers", requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const customers = await db
      .select()
      .from(customersTable)
      .orderBy(asc(customersTable.name));

    const orders = await db
      .select({
        id: ordersTable.id,
        customerId: ordersTable.customerId,
        createdAt: ordersTable.createdAt,
        status: ordersTable.status,
        isPaid: ordersTable.isPaid,
        paymentMethod: ordersTable.paymentMethod,
        totalAmount: ordersTable.totalAmount,
      })
      .from(ordersTable)
      .orderBy(asc(ordersTable.createdAt));

    const ordersByCustomer = new Map<string, typeof orders>();
    for (const o of orders) {
      const list = ordersByCustomer.get(o.customerId);
      if (list) list.push(o);
      else ordersByCustomer.set(o.customerId, [o]);
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Customers");
    ws.columns = [
      { header: "Customer Name", key: "name", width: 26 },
      { header: "Contact Number", key: "phone", width: 18 },
      { header: "Email", key: "email", width: 26 },
      { header: "Address", key: "address", width: 42 },
      { header: "Customer Status", key: "cstatus", width: 16 },
      { header: "Order ID", key: "oid", width: 14 },
      { header: "Order Date", key: "odate", width: 14 },
      { header: "Order Status", key: "ostatus", width: 14 },
      { header: "Paid", key: "paid", width: 8 },
      { header: "Payment Method", key: "pm", width: 16 },
      { header: "Order Total (GBP)", key: "total", width: 16 },
    ];

    for (const c of customers) {
      const base = {
        name: c.name,
        phone: c.phone ?? "",
        email: c.email ?? "",
        address: c.address ?? "",
        cstatus: customerStatusLabel(c.status),
      };
      const cOrders = ordersByCustomer.get(c.id) ?? [];
      if (cOrders.length === 0) {
        ws.addRow(base);
      } else {
        for (const o of cOrders) {
          ws.addRow({
            ...base,
            oid: o.id.slice(0, 8).toUpperCase(),
            odate: fmtDate(o.createdAt),
            ostatus: o.status,
            paid: o.isPaid ? "Yes" : "No",
            pm: o.paymentMethod ?? "",
            total: Number(o.totalAmount),
          });
        }
      }
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

    const rows = await db
      .select({
        id: ordersTable.id,
        createdAt: ordersTable.createdAt,
        status: ordersTable.status,
        isPaid: ordersTable.isPaid,
        paymentMethod: ordersTable.paymentMethod,
        totalAmount: ordersTable.totalAmount,
        customerName: customersTable.name,
        customerPhone: customersTable.phone,
        takenBy: usersTable.username,
      })
      .from(ordersTable)
      .leftJoin(customersTable, eq(ordersTable.customerId, customersTable.id))
      .leftJoin(usersTable, eq(ordersTable.createdById, usersTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(ordersTable.createdAt));

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
      { header: "Total (GBP)", key: "total", width: 14 },
    ];

    for (const o of rows) {
      ws.addRow({
        oid: o.id.slice(0, 8).toUpperCase(),
        odate: fmtDate(o.createdAt),
        customer: o.customerName ?? "Unknown",
        phone: o.customerPhone ?? "",
        takenBy: o.takenBy ?? "—",
        status: o.status,
        paid: o.isPaid ? "Yes" : "No",
        pm: o.paymentMethod ?? "",
        total: Number(o.totalAmount),
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
