import { db, appSettingsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

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

/** Company details printed on invoices and the courier shipping label. */
export type CompanyDetails = {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  website: string;
  email: string;
};

export const COMPANY_FIELDS = ["name", "tagline", "address", "phone", "website", "email"] as const;

/** Field -> settings-store key. */
const COMPANY_KEY: Record<keyof CompanyDetails, string> = {
  name: "company_name",
  tagline: "company_tagline",
  address: "company_address",
  phone: "company_phone",
  website: "company_website",
  email: "company_email",
};

/** Fallback used until an admin saves their own details in Settings. */
export const COMPANY_DEFAULTS: CompanyDetails = {
  name: "OptiLifeWellbeing Ltd",
  tagline: "Health & Wellness Products",
  address: "PineTree House, Gardiners Close, Basildon SS14 3AN",
  phone: "020 8264 9244",
  website: "optilifewellbeing.co.uk",
  email: "customercare@optilifewellbeing.co.uk",
};

export async function getCompanyDetails(): Promise<CompanyDetails> {
  const rows = await db
    .select({ key: appSettingsTable.key, value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(inArray(appSettingsTable.key, Object.values(COMPANY_KEY)));
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  const pick = (field: keyof CompanyDetails) => {
    const v = stored.get(COMPANY_KEY[field]);
    // Empty/whitespace falls back so a label never prints a blank company.
    return v && v.trim() ? v : COMPANY_DEFAULTS[field];
  };
  return {
    name: pick("name"),
    tagline: pick("tagline"),
    address: pick("address"),
    phone: pick("phone"),
    website: pick("website"),
    email: pick("email"),
  };
}

export async function setCompanyDetails(partial: Partial<CompanyDetails>): Promise<void> {
  for (const field of COMPANY_FIELDS) {
    const value = partial[field];
    if (typeof value === "string") await setSetting(COMPANY_KEY[field], value);
  }
}
