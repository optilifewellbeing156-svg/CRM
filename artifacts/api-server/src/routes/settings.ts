import { Router, Response } from "express";
import { requireAdmin, type AuthRequest } from "../lib/middleware";
import { getInvoiceShowVat, setSetting, INVOICE_SHOW_VAT_KEY } from "../lib/settings";

const router = Router();

// Readable by any authenticated user (the invoice UI/actions may depend on it).
router.get("/settings", async (_req: AuthRequest, res: Response) => {
  const invoiceShowVat = await getInvoiceShowVat();
  res.json({ invoiceShowVat });
});

// Only admins can change global settings.
router.put("/settings", requireAdmin, async (req: AuthRequest, res: Response) => {
  const { invoiceShowVat } = req.body ?? {};
  if (typeof invoiceShowVat !== "boolean") {
    res.status(400).json({ error: "invoiceShowVat must be a boolean" });
    return;
  }
  await setSetting(INVOICE_SHOW_VAT_KEY, String(invoiceShowVat));
  res.json({ invoiceShowVat });
});

export default router;
