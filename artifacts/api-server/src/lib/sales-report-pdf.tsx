import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { LOGO_DATA_URI } from "./logo-data";
import type { CompanyDetails } from "./settings";

const DARK_GREEN = "#1A4D44";
const LIGHT_GREEN = "#E8F4F2";

/** Shares the invoice's visual language: dark-green header bar with the logo,
 * light-green contact strip, dark table headers, zebra rows. */
const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, color: "#333", backgroundColor: "#fff", paddingBottom: 46 },
  headerBar: { backgroundColor: DARK_GREEN, paddingHorizontal: 40, paddingVertical: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brandName: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#fff" },
  brandTagline: { fontSize: 8, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  logo: { width: 56, height: 56 },
  contactBar: { backgroundColor: LIGHT_GREEN, paddingHorizontal: 40, paddingVertical: 8, flexDirection: "row", justifyContent: "space-between" },
  contactText: { fontSize: 8, color: DARK_GREEN },
  body: { paddingHorizontal: 40, paddingTop: 22 },
  reportTitle: { fontSize: 15, fontFamily: "Helvetica-Bold", color: DARK_GREEN },
  reportMeta: { fontSize: 9, color: "#666", marginTop: 3, marginBottom: 16 },
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  summaryBox: { flex: 1, backgroundColor: LIGHT_GREEN, borderRadius: 4, paddingVertical: 8, paddingHorizontal: 10 },
  summaryLabel: { fontSize: 7, color: DARK_GREEN, textTransform: "uppercase", letterSpacing: 0.5 },
  summaryValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: DARK_GREEN, marginTop: 3 },
  sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#fff", backgroundColor: DARK_GREEN, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 0, textTransform: "uppercase", letterSpacing: 0.5 },
  tableHead: { flexDirection: "row", backgroundColor: "#2D7D6F", paddingHorizontal: 8, paddingVertical: 5 },
  tableHeadCell: { color: "#fff", fontSize: 8, fontFamily: "Helvetica-Bold" },
  tableRow: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 5, borderBottomColor: "#e5e5e5", borderBottomWidth: 1 },
  tableRowAlt: { backgroundColor: "#f9f9f9" },
  cell: { fontSize: 8.5, color: "#333" },
  sectionGap: { marginBottom: 18 },
  footer: { position: "absolute", bottom: 14, left: 40, right: 40, borderTopColor: "#ddd", borderTopWidth: 1, paddingTop: 6 },
  footerText: { fontSize: 7.5, color: "#999", textAlign: "center" },
});

export type SalesReportData = {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  cancelledRefundedAmount: number;
  cancelledRefundedCount: number;
  orders: Array<{ id: string; customer: string; createdBy: string | null; itemCount: number; totalAmount: number; createdAt: Date | string; status: string | null }>;
  topProducts: Array<{ name: string; unitsSold: number; revenue: number }>;
  userReport: Array<{ username: string; totalOrders: number; totalSales: number; commissionRate: number; commission: number }>;
};

const gbp = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dmy = (d: Date | string) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });

export function SalesReportPDF({
  data,
  company,
  from,
  to,
  scopedUsername,
}: {
  data: SalesReportData;
  company: CompanyDetails;
  from: string;
  to: string;
  scopedUsername?: string | null;
}) {
  const generated = new Date().toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerBar} fixed>
          <View>
            <Text style={s.brandName}>{company.name}</Text>
            <Text style={s.brandTagline}>{company.tagline}</Text>
          </View>
          <Image style={s.logo} src={LOGO_DATA_URI} />
        </View>
        <View style={s.contactBar} fixed>
          <Text style={s.contactText}>{company.address}</Text>
          <Text style={s.contactText}>{company.phone}  ·  {company.email}  ·  {company.website}</Text>
        </View>

        <View style={s.body}>
          <Text style={s.reportTitle}>Sales Report</Text>
          <Text style={s.reportMeta}>
            Period {dmy(from)} – {dmy(to)}
            {scopedUsername ? `  ·  User: ${scopedUsername}` : "  ·  All users"}
            {`  ·  Generated ${generated}`}
          </Text>

          <View style={s.summaryRow}>
            <View style={s.summaryBox}>
              <Text style={s.summaryLabel}>Net Revenue</Text>
              <Text style={s.summaryValue}>{gbp(data.totalRevenue)}</Text>
            </View>
            <View style={s.summaryBox}>
              <Text style={s.summaryLabel}>Total Orders</Text>
              <Text style={s.summaryValue}>{data.totalOrders}</Text>
            </View>
            <View style={s.summaryBox}>
              <Text style={s.summaryLabel}>Avg Order Value</Text>
              <Text style={s.summaryValue}>{gbp(data.avgOrderValue)}</Text>
            </View>
            <View style={s.summaryBox}>
              <Text style={s.summaryLabel}>Cancelled / Refunded ({data.cancelledRefundedCount})</Text>
              <Text style={s.summaryValue}>-{gbp(data.cancelledRefundedAmount)}</Text>
            </View>
          </View>

          {data.topProducts.length > 0 && (
            <View style={s.sectionGap}>
              <Text style={s.sectionTitle}>Top Products</Text>
              <View style={s.tableHead}>
                <Text style={[s.tableHeadCell, { flex: 3 }]}>Product</Text>
                <Text style={[s.tableHeadCell, { flex: 1, textAlign: "right" }]}>Units Sold</Text>
                <Text style={[s.tableHeadCell, { flex: 1, textAlign: "right" }]}>Revenue</Text>
              </View>
              {data.topProducts.map((p, i) => (
                <View key={p.name + i} style={[s.tableRow, ...(i % 2 ? [s.tableRowAlt] : [])]} wrap={false}>
                  <Text style={[s.cell, { flex: 3 }]}>{p.name}</Text>
                  <Text style={[s.cell, { flex: 1, textAlign: "right" }]}>{p.unitsSold}</Text>
                  <Text style={[s.cell, { flex: 1, textAlign: "right" }]}>{gbp(p.revenue)}</Text>
                </View>
              ))}
            </View>
          )}

          {data.userReport.length > 0 && (
            <View style={s.sectionGap}>
              <Text style={s.sectionTitle}>User Performance</Text>
              <View style={s.tableHead}>
                <Text style={[s.tableHeadCell, { flex: 2 }]}>User</Text>
                <Text style={[s.tableHeadCell, { flex: 1, textAlign: "right" }]}>Orders</Text>
                <Text style={[s.tableHeadCell, { flex: 1.4, textAlign: "right" }]}>Total Sales</Text>
                <Text style={[s.tableHeadCell, { flex: 1.2, textAlign: "right" }]}>Commission Rate</Text>
                <Text style={[s.tableHeadCell, { flex: 1.2, textAlign: "right" }]}>Commission</Text>
              </View>
              {data.userReport.map((u, i) => (
                <View key={u.username + i} style={[s.tableRow, ...(i % 2 ? [s.tableRowAlt] : [])]} wrap={false}>
                  <Text style={[s.cell, { flex: 2 }]}>{u.username}</Text>
                  <Text style={[s.cell, { flex: 1, textAlign: "right" }]}>{u.totalOrders}</Text>
                  <Text style={[s.cell, { flex: 1.4, textAlign: "right" }]}>{gbp(u.totalSales)}</Text>
                  <Text style={[s.cell, { flex: 1.2, textAlign: "right" }]}>{u.commissionRate}%</Text>
                  <Text style={[s.cell, { flex: 1.2, textAlign: "right" }]}>{gbp(u.commission)}</Text>
                </View>
              ))}
            </View>
          )}

          <View>
            <Text style={s.sectionTitle}>All Orders ({data.orders.length})</Text>
            <View style={s.tableHead}>
              <Text style={[s.tableHeadCell, { flex: 1.1 }]}>Invoice #</Text>
              <Text style={[s.tableHeadCell, { flex: 2.4 }]}>Customer</Text>
              <Text style={[s.tableHeadCell, { flex: 1.3 }]}>Taken By</Text>
              <Text style={[s.tableHeadCell, { flex: 0.7, textAlign: "right" }]}>Items</Text>
              <Text style={[s.tableHeadCell, { flex: 1.2, textAlign: "right" }]}>Total</Text>
              <Text style={[s.tableHeadCell, { flex: 1.2, textAlign: "right" }]}>Date</Text>
              <Text style={[s.tableHeadCell, { flex: 1.3, textAlign: "right" }]}>Status</Text>
            </View>
            {data.orders.map((o, i) => (
              <View key={o.id} style={[s.tableRow, ...(i % 2 ? [s.tableRowAlt] : [])]} wrap={false}>
                <Text style={[s.cell, { flex: 1.1 }]}>{o.id.slice(0, 8).toUpperCase()}</Text>
                <Text style={[s.cell, { flex: 2.4 }]}>{o.customer || "—"}</Text>
                <Text style={[s.cell, { flex: 1.3 }]}>{o.createdBy ?? "—"}</Text>
                <Text style={[s.cell, { flex: 0.7, textAlign: "right" }]}>{o.itemCount}</Text>
                <Text style={[s.cell, { flex: 1.2, textAlign: "right" }]}>{gbp(o.totalAmount)}</Text>
                <Text style={[s.cell, { flex: 1.2, textAlign: "right" }]}>{dmy(o.createdAt)}</Text>
                <Text style={[s.cell, { flex: 1.3, textAlign: "right" }]}>{o.status ?? "—"}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) =>
              `${company.name} — Sales Report ${dmy(from)} to ${dmy(to)} — page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
