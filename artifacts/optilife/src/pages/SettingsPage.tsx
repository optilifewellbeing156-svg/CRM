import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/Spinner";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [invoiceShowVat, setInvoiceShowVat] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings", { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: { invoiceShowVat: boolean }) => {
        setInvoiceShowVat(!!data.invoiceShowVat);
        setError(false);
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  async function updateInvoiceShowVat(next: boolean) {
    const prev = invoiceShowVat;
    setInvoiceShowVat(next); // optimistic
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ invoiceShowVat: next }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setInvoiceShowVat(prev); // revert on failure
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          Failed to load settings. Please refresh and try again.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden max-w-2xl">
          <div className="p-4 border-b">
            <h2 className="text-sm font-semibold text-gray-900">Invoice</h2>
            <p className="text-xs text-gray-500 mt-0.5">Control what appears on generated invoice PDFs.</p>
          </div>
          <div className="p-4 flex items-start justify-between gap-4">
            <div>
              <label htmlFor="invoice-show-vat" className="text-sm font-medium text-gray-900">
                Show &ldquo;VAT (Included)&rdquo; line
              </label>
              <p className="text-xs text-gray-500 mt-0.5">
                When on, invoices print a &ldquo;VAT (Included)&rdquo; row in the totals. Turn off to hide it entirely.
              </p>
              <div className="h-4 mt-1">
                {saving && <span className="text-xs text-gray-400">Saving…</span>}
                {saved && !saving && <span className="text-xs text-emerald-600">Saved</span>}
              </div>
            </div>
            <Switch
              id="invoice-show-vat"
              checked={invoiceShowVat}
              disabled={saving}
              onCheckedChange={updateInvoiceShowVat}
              className="mt-1"
            />
          </div>
        </div>
      )}
    </div>
  );
}
