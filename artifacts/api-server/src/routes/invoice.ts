import { Router, Response } from "express";
import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { db } from "@workspace/db";
import { ordersTable, orderItemsTable, productsTable, customersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { InvoicePDF } from "../lib/invoice-pdf";
import { requireAnyPermission, isPrivileged, param, type AuthRequest } from "../lib/middleware";
import { getInvoiceShowVat, getCompanyDetails } from "../lib/settings";

const router = Router();

router.get("/orders/:id/pdf", requireAnyPermission("orders", "create-orders", "edit-orders"), async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");
    const orders = await db.select({
      id: ordersTable.id,
      createdById: ordersTable.createdById,
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
      .where(eq(ordersTable.id, id))
      .limit(1);

    // Same scope as the orders list: a non-privileged user can only pull the
    // invoices of orders they created.
    if (!orders[0] || (!isPrivileged(req.auth!.role) && orders[0].createdById !== req.auth!.userId)) {
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
      .where(eq(orderItemsTable.orderId, id));

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
    // renderToBuffer's signature wants ReactElement<DocumentProps>; InvoicePDF
    // renders a <Document> but its own props differ, so assert the element type.
    const buffer = await renderToBuffer(
      React.createElement(InvoicePDF, { order, showVat, company }) as React.ReactElement<DocumentProps>
    );

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
