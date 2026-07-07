import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const INVOICE_SHOW_VAT_KEY = "invoice_show_vat";

export async function getSetting(key: string): Promise<string | null> {
  const rows = await db
    .select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, key))
    .limit(1);
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(appSettingsTable)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettingsTable.key,
      set: { value, updatedAt: new Date() },
    });
}

/**
 * Whether the "VAT (Included)" line should be printed on invoices.
 * Defaults to false (hidden) unless an admin has explicitly enabled it.
 */
export async function getInvoiceShowVat(): Promise<boolean> {
  return (await getSetting(INVOICE_SHOW_VAT_KEY)) === "true";
}
