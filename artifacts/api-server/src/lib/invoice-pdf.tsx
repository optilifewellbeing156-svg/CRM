import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const GREEN = "#2D7D6F";
const DARK_GREEN = "#1A4D44";
const LIGHT_GREEN = "#E8F4F2";

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, color: "#333", backgroundColor: "#fff" },
  headerBar: { backgroundColor: DARK_GREEN, paddingHorizontal: 40, paddingVertical: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brandName: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#fff" },
  brandTagline: { fontSize: 8, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  paidBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  paidText: { fontSize: 13, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  contactBar: { backgroundColor: LIGHT_GREEN, paddingHorizontal: 40, paddingVertical: 8, flexDirection: "row", justifyContent: "space-between" },
  contactText: { fontSize: 8, color: DARK_GREEN },
  body: { paddingHorizontal: 40, paddingTop: 24 },
  twoCol: { flexDirection: "row", marginBottom: 24 },
  col: { flex: 1 },
  sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#fff", backgroundColor: DARK_GREEN, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  fieldLabel: { fontSize: 8, color: "#888", marginBottom: 1 },
  fieldValue: { fontSize: 10, color: "#222", marginBottom: 4 },
  tableHead: { flexDirection: "row", backgroundColor: DARK_GREEN, paddingHorizontal: 8, paddingVertical: 6, marginBottom: 0 },
  tableHeadCell: { color: "#fff", fontSize: 9, fontFamily: "Helvetica-Bold" },
  tableRow: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 6, borderBottomColor: "#e5e5e5", borderBottomWidth: 1 },
  tableRowAlt: { backgroundColor: "#f9f9f9" },
  cell: { fontSize: 9, color: "#333" },
  totalsSection: { marginTop: 8, paddingHorizontal: 40 },
  totalLine: { flexDirection: "row", justifyContent: "flex-end", paddingVertical: 3 },
  totalLineLabel: { fontSize: 9, color: "#666", width: 120, textAlign: "right", marginRight: 16 },
  totalLineValue: { fontSize: 9, color: "#333", width: 80, textAlign: "right" },
  grandTotalLine: { flexDirection: "row", justifyContent: "flex-end", paddingVertical: 6, marginTop: 2, backgroundColor: LIGHT_GREEN },
  grandTotalLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: DARK_GREEN, width: 120, textAlign: "right", marginRight: 16 },
  grandTotalValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: DARK_GREEN, width: 80, textAlign: "right" },
  footer: { marginTop: 32, paddingHorizontal: 40, paddingVertical: 12, borderTopColor: "#ddd", borderTopWidth: 1 },
  footerText: { fontSize: 8, color: "#999", textAlign: "center" },
});

export type InvoiceOrder = {
  id: string;
  createdAt: Date | string;
  totalAmount: string | number;
  status?: string | null;
  isPaid?: boolean;
  paymentMethod?: string | null;
  customer: { name: string; email?: string | null; phone?: string | null; address?: string | null };
  items: Array<{ id: string; quantity: string | number; price: string | number; product: { name: string } }>;
};

export function InvoicePDF({ order }: { order: InvoiceOrder }) {
  const isPaid = order.isPaid ?? false;
  const subTotal = order.items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  const date = new Date(order.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  const invoiceNo = order.id.slice(0, 8).toUpperCase();

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerBar}>
          <View>
            <Text style={s.brandName}>OptiLifeWellbeing Ltd</Text>
            <Text style={s.brandTagline}>Health & Wellness Products</Text>
          </View>
          <View style={[s.paidBadge, { backgroundColor: isPaid ? "#22c55e" : "#ef4444" }]}>
            <Text style={[s.paidText, { color: "#fff" }]}>{isPaid ? "PAID" : "UNPAID"}</Text>
          </View>
        </View>

        <View style={s.contactBar}>
          <Text style={s.contactText}>Phone: 020 8264 9244</Text>
          <Text style={s.contactText}>Website: optilifewellbeing.co.uk</Text>
          <Text style={s.contactText}>Email: customercare@optilifewellbeing.co.uk</Text>
        </View>

        <View style={{ paddingHorizontal: 40, paddingVertical: 8, backgroundColor: "#f5f5f5" }}>
          <Text style={{ fontSize: 8, color: "#666" }}>PineTree House, Gardiners Close, Basildon SS14 3AN</Text>
        </View>

        <View style={[s.body, { paddingTop: 20 }]}>
          <View style={s.twoCol}>
            <View style={[s.col, { marginRight: 16 }]}>
              <Text style={s.sectionTitle}>Bill To</Text>
              <Text style={s.fieldValue}>{order.customer.name}</Text>
              {order.customer.address ? <Text style={{ fontSize: 9, color: "#555", marginBottom: 2 }}>{order.customer.address}</Text> : null}
              {order.customer.email ? <Text style={{ fontSize: 9, color: "#555", marginBottom: 2 }}>{order.customer.email}</Text> : null}
              {order.customer.phone ? <Text style={{ fontSize: 9, color: "#555" }}>{order.customer.phone}</Text> : null}
            </View>
            <View style={s.col}>
              <Text style={s.sectionTitle}>Order Details</Text>
              <Text style={s.fieldLabel}>Order ID</Text>
              <Text style={s.fieldValue}>{invoiceNo}</Text>
              <Text style={s.fieldLabel}>Order Date</Text>
              <Text style={s.fieldValue}>{date}</Text>
              <Text style={s.fieldLabel}>Status</Text>
              <Text style={[s.fieldValue, { color: isPaid ? "#16a34a" : "#dc2626", fontFamily: "Helvetica-Bold" }]}>
                {order.status ?? "PROCESSING"}
              </Text>
            </View>
          </View>

          <View style={s.tableHead}>
            <Text style={[s.tableHeadCell, { flex: 5 }]}>Item Description</Text>
            <Text style={[s.tableHeadCell, { flex: 1, textAlign: "center" }]}>Qty</Text>
            <Text style={[s.tableHeadCell, { flex: 2, textAlign: "right" }]}>Unit Price</Text>
            <Text style={[s.tableHeadCell, { flex: 2, textAlign: "right" }]}>Total</Text>
          </View>

          {order.items.map((item, i) => (
            <View key={item.id} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
              <Text style={[s.cell, { flex: 5 }]}>{item.product.name}</Text>
              <Text style={[s.cell, { flex: 1, textAlign: "center" }]}>{Number(item.quantity)}</Text>
              <Text style={[s.cell, { flex: 2, textAlign: "right" }]}>£{Number(item.price).toFixed(2)}</Text>
              <Text style={[s.cell, { flex: 2, textAlign: "right" }]}>£{(Number(item.price) * Number(item.quantity)).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        <View style={s.totalsSection}>
          <View style={s.totalLine}>
            <Text style={s.totalLineLabel}>Sub-total</Text>
            <Text style={s.totalLineValue}>£{subTotal.toFixed(2)}</Text>
          </View>
          <View style={s.totalLine}>
            <Text style={s.totalLineLabel}>VAT (Included)</Text>
            <Text style={s.totalLineValue}>£0.00</Text>
          </View>
          <View style={s.totalLine}>
            <Text style={s.totalLineLabel}>Postage</Text>
            <Text style={s.totalLineValue}>£0.00</Text>
          </View>
          <View style={[s.grandTotalLine, { paddingHorizontal: 8 }]}>
            <Text style={s.grandTotalLabel}>TOTAL</Text>
            <Text style={s.grandTotalValue}>£{Number(order.totalAmount).toFixed(2)}</Text>
          </View>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>Thank you for your order. For queries please contact customercare@optilifewellbeing.co.uk</Text>
          <Text style={[s.footerText, { marginTop: 3 }]}>OptiLifeWellbeing Ltd | PineTree House, Gardiners Close, Basildon SS14 3AN | Phone: 020 8264 9244</Text>
        </View>
      </Page>
    </Document>
  );
}
