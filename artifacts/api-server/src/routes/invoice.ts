import { Router, Response } from "express";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@workspace/db";
import { ordersTable, orderItemsTable, productsTable, customersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { InvoicePDF } from "../lib/invoice-pdf";
import { requireAnyPermission, type AuthRequest } from "../lib/middleware";
import { getInvoiceShowVat, getCompanyDetails } from "../lib/settings";

const router = Router();

router.get("/orders/:id/pdf", requireAnyPermission("orders", "create-orders", "edit-orders"), async (req: AuthRequest, res: Response) => {
  try {
    const orders = await db.select({
      id: ordersTable.id,
      totalAmount: ordersTable.totalAmount,
      createdAt: ordersTable.createdAt,
      status: ordersTable.status,
      isPaid: ordersTable.isPaid,
      paymentMethod: ordersTable.paymentMethod,
      postage: ordersTable.postage,
      customerName: customersTable.name,
      customerEmail: customersTable.email,
      customerPhone: customersTable.phone,
      customerAddress: customersTable.address,
    })
      .from(ordersTable)
      .leftJoin(customersTable, eq(ordersTable.customerId, customersTable.id))
      .where(eq(ordersTable.id, req.params.id))
      .limit(1);

    if (!orders[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const o = orders[0];

    const items = await db.select({
      id: orderItemsTable.id,
      quantity: orderItemsTable.quantity,
      price: orderItemsTable.price,
      productName: productsTable.name,
    })
      .from(orderItemsTable)
      .leftJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
      .where(eq(orderItemsTable.orderId, req.params.id));

    const order = {
      id: o.id,
      createdAt: o.createdAt,
      totalAmount: o.totalAmount,
      status: o.status,
      isPaid: o.isPaid,
      paymentMethod: o.paymentMethod,
      postage: o.postage,
      customer: {
        name: o.customerName ?? "Unknown",
        email: o.customerEmail,
        phone: o.customerPhone,
        address: o.customerAddress,
      },
      items: items.map(i => ({
        id: i.id,
        quantity: i.quantity,
        price: i.price,
        product: { name: i.productName ?? "Unknown Product" },
      })),
    };

    const [showVat, company] = await Promise.all([getInvoiceShowVat(), getCompanyDetails()]);
    const buffer = await renderToBuffer(React.createElement(InvoicePDF, { order, showVat, company }));

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${o.id.slice(0, 8)}.pdf"`,
      "Content-Length": buffer.length,
    });
    res.send(buffer);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

export default router;
