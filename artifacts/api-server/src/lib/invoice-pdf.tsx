import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { LOGO_DATA_URI } from "./logo-data";

const GREEN = "#2D7D6F";
const DARK_GREEN = "#1A4D44";
const LIGHT_GREEN = "#E8F4F2";

/** Single source of truth for our own company details, used on both the
 * invoice and the courier shipping label. */
const COMPANY = {
  name: "OptiLifeWellbeing Ltd",
  tagline: "Health & Wellness Products",
  address: "PineTree House, Gardiners Close, Basildon SS14 3AN",
  phone: "020 8264 9244",
  website: "optilifewellbeing.co.uk",
  email: "customercare@optilifewellbeing.co.uk",
};

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, color: "#333", backgroundColor: "#fff" },
  headerBar: { backgroundColor: DARK_GREEN, paddingHorizontal: 40, paddingVertical: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brandName: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#fff" },
  brandTagline: { fontSize: 8, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  logo: { width: 56, height: 56 },
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

  // ── 4x6" courier shipping label (portrait 288 x 432 pt) ──
  label: { padding: 16, fontFamily: "Helvetica", color: "#000", backgroundColor: "#fff" },
  labelBox: { flexGrow: 1, borderWidth: 2, borderColor: "#000", borderRadius: 6, padding: 16, flexDirection: "column" },
  fromLabel: { fontSize: 7, letterSpacing: 1.5, color: "#555", fontFamily: "Helvetica-Bold", marginBottom: 3 },
  fromName: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#000" },
  fromText: { fontSize: 9, color: "#333", lineHeight: 1.35 },
  labelDivider: { borderBottomWidth: 1.5, borderBottomColor: "#000", marginVertical: 14 },
  toLabel: { fontSize: 10, letterSpacing: 2.5, color: "#000", fontFamily: "Helvetica-Bold", marginBottom: 8 },
  toName: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#000", marginBottom: 8, lineHeight: 1.15 },
  toText: { fontSize: 14, color: "#000", marginBottom: 4, lineHeight: 1.35 },
  labelFooter: { marginTop: "auto", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderTopWidth: 1.5, borderTopColor: "#000", paddingTop: 10 },
  labelMetaLabel: { fontSize: 7, letterSpacing: 1, color: "#666", fontFamily: "Helvetica-Bold" },
  labelMetaValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#000" },
});

export type InvoiceOrder = {
  id: string;
  createdAt: Date | string;
  totalAmount: string | number;
  status?: string | null;
  isPaid?: boolean;
  paymentMethod?: string | null;
  postage?: string | number | null;
  customer: { name: string; email?: string | null; phone?: string | null; address?: string | null };
  items: Array<{ id: string; quantity: string | number; price: string | number; product: { name: string } }>;
};

export function InvoicePDF({ order, showVat = false }: { order: InvoiceOrder; showVat?: boolean }) {
  const subTotal = order.items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  const postage = Number(order.postage) || 0;
  const roundOff = Number(order.totalAmount) - subTotal - postage;
  const date = new Date(order.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  const invoiceNo = order.id.slice(0, 8).toUpperCase();

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerBar}>
          <View>
            <Text style={s.brandName}>{COMPANY.name}</Text>
            <Text style={s.brandTagline}>{COMPANY.tagline}</Text>
          </View>
          <Image src={LOGO_DATA_URI} style={s.logo} />
        </View>

        <View style={s.contactBar}>
          <Text style={s.contactText}>Phone: {COMPANY.phone}</Text>
          <Text style={s.contactText}>Website: {COMPANY.website}</Text>
          <Text style={s.contactText}>Email: {COMPANY.email}</Text>
        </View>

        <View style={{ paddingHorizontal: 40, paddingVertical: 8, backgroundColor: "#f5f5f5" }}>
          <Text style={{ fontSize: 8, color: "#666" }}>{COMPANY.address}</Text>
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
          {showVat ? (
            <View style={s.totalLine}>
              <Text style={s.totalLineLabel}>VAT (Included)</Text>
              <Text style={s.totalLineValue}>£0.00</Text>
            </View>
          ) : null}
          <View style={s.totalLine}>
            <Text style={s.totalLineLabel}>Postage</Text>
            <Text style={s.totalLineValue}>£{postage.toFixed(2)}</Text>
          </View>
          {Math.abs(roundOff) >= 0.005 ? (
            <View style={s.totalLine}>
              <Text style={s.totalLineLabel}>Round Off</Text>
              <Text style={s.totalLineValue}>
                {roundOff < 0 ? "-" : ""}£{Math.abs(roundOff).toFixed(2)}
              </Text>
            </View>
          ) : null}
          <View style={[s.grandTotalLine, { paddingHorizontal: 8 }]}>
            <Text style={s.grandTotalLabel}>TOTAL</Text>
            <Text style={s.grandTotalValue}>£{Number(order.totalAmount).toFixed(2)}</Text>
          </View>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>Thank you for your order. For queries please contact {COMPANY.email}</Text>
          <Text style={[s.footerText, { marginTop: 3 }]}>{COMPANY.name} | {COMPANY.address} | Phone: {COMPANY.phone}</Text>
        </View>
      </Page>

      {/* ── Page 2: 4x6" courier shipping label — stick this on the parcel ── */}
      <Page size={[288, 432]} style={s.label}>
        <View style={s.labelBox}>
          <Text style={s.fromLabel}>FROM</Text>
          <Text style={s.fromName}>{COMPANY.name}</Text>
          <Text style={s.fromText}>{COMPANY.address}</Text>
          <Text style={s.fromText}>Tel: {COMPANY.phone}</Text>

          <View style={s.labelDivider} />

          <Text style={s.toLabel}>SHIP TO</Text>
          <Text style={s.toName}>{order.customer.name}</Text>
          {order.customer.address ? <Text style={s.toText}>{order.customer.address}</Text> : null}
          {order.customer.phone ? <Text style={s.toText}>Tel: {order.customer.phone}</Text> : null}

          <View style={s.labelFooter}>
            <View>
              <Text style={s.labelMetaLabel}>ORDER</Text>
              <Text style={s.labelMetaValue}>#{invoiceNo}</Text>
            </View>
            <View>
              <Text style={[s.labelMetaLabel, { textAlign: "right" }]}>DATE</Text>
              <Text style={s.labelMetaValue}>{date}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
