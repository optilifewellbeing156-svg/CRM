import { Router, Response } from "express";
import { requireAdmin, type AuthRequest } from "../lib/middleware";
import {
  getInvoiceShowVat,
  setSetting,
  INVOICE_SHOW_VAT_KEY,
  getCompanyDetails,
  setCompanyDetails,
  COMPANY_FIELDS,
  type CompanyDetails,
} from "../lib/settings";

const router = Router();

// Readable by any authenticated user (the invoice UI/actions may depend on it).
router.get("/settings", async (_req: AuthRequest, res: Response) => {
  const [invoiceShowVat, company] = await Promise.all([getInvoiceShowVat(), getCompanyDetails()]);
  res.json({ invoiceShowVat, company });
});

// Only admins can change global settings. Both fields are optional so the VAT
// toggle and the company form can save independently.
router.put("/settings", requireAdmin, async (req: AuthRequest, res: Response) => {
  const { invoiceShowVat, company } = req.body ?? {};

  if (invoiceShowVat !== undefined) {
    if (typeof invoiceShowVat !== "boolean") {
      res.status(400).json({ error: "invoiceShowVat must be a boolean" });
      return;
    }
    await setSetting(INVOICE_SHOW_VAT_KEY, String(invoiceShowVat));
  }

  if (company !== undefined) {
    if (typeof company !== "object" || company === null) {
      res.status(400).json({ error: "company must be an object" });
      return;
    }
    const partial: Partial<CompanyDetails> = {};
    for (const field of COMPANY_FIELDS) {
      const v = (company as Record<string, unknown>)[field];
      if (v !== undefined && typeof v !== "string") {
        res.status(400).json({ error: `company.${field} must be a string` });
        return;
      }
      if (typeof v === "string") partial[field] = v.trim();
    }
    await setCompanyDetails(partial);
  }

  const [invoiceShowVatNow, companyNow] = await Promise.all([getInvoiceShowVat(), getCompanyDetails()]);
  res.json({ invoiceShowVat: invoiceShowVatNow, company: companyNow });
});

export default router;
