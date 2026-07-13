import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";

type Company = {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  website: string;
  email: string;
};

const EMPTY_COMPANY: Company = { name: "", tagline: "", address: "", phone: "", website: "", email: "" };

const COMPANY_FIELDS: { key: keyof Company; label: string; placeholder: string; full?: boolean }[] = [
  { key: "name", label: "Company Name", placeholder: "OptiLifeWellbeing Ltd" },
  { key: "tagline", label: "Tagline", placeholder: "Health & Wellness Products" },
  { key: "address", label: "Address", placeholder: "PineTree House, Gardiners Close, Basildon SS14 3AN", full: true },
  { key: "phone", label: "Phone", placeholder: "020 8264 9244" },
  { key: "website", label: "Website", placeholder: "optilifewellbeing.co.uk" },
  { key: "email", label: "Email", placeholder: "customercare@optilifewellbeing.co.uk" },
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [invoiceShowVat, setInvoiceShowVat] = useState(false);
  const [savingVat, setSavingVat] = useState(false);
  const [savedVat, setSavedVat] = useState(false);

  const [company, setCompany] = useState<Company>(EMPTY_COMPANY);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savedCompany, setSavedCompany] = useState(false);
  const [companyError, setCompanyError] = useState(false);

  useEffect(() => {
    fetch("/api/settings", { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: { invoiceShowVat: boolean; company?: Company }) => {
        setInvoiceShowVat(!!data.invoiceShowVat);
        if (data.company) setCompany({ ...EMPTY_COMPANY, ...data.company });
        setError(false);
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  async function updateInvoiceShowVat(next: boolean) {
    const prev = invoiceShowVat;
    setInvoiceShowVat(next); // optimistic
    setSavingVat(true);
    setSavedVat(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ invoiceShowVat: next }),
      });
      if (!res.ok) throw new Error();
      setSavedVat(true);
      setTimeout(() => setSavedVat(false), 2000);
    } catch {
      setInvoiceShowVat(prev); // revert on failure
      setError(true);
    } finally {
      setSavingVat(false);
    }
  }

  async function saveCompany() {
    setSavingCompany(true);
    setSavedCompany(false);
    setCompanyError(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ company }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.company) setCompany({ ...EMPTY_COMPANY, ...data.company });
      setSavedCompany(true);
      setTimeout(() => setSavedCompany(false), 2500);
    } catch {
      setCompanyError(true);
    } finally {
      setSavingCompany(false);
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
        <div className="space-y-6 max-w-2xl">
          {/* Invoice */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
                  {savingVat && <span className="text-xs text-gray-400">Saving…</span>}
                  {savedVat && !savingVat && <span className="text-xs text-emerald-600">Saved</span>}
                </div>
              </div>
              <Switch
                id="invoice-show-vat"
                checked={invoiceShowVat}
                disabled={savingVat}
                onCheckedChange={updateInvoiceShowVat}
                className="mt-1"
              />
            </div>
          </div>

          {/* Company details */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="text-sm font-semibold text-gray-900">Company Details</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                These appear as the sender on invoices and on the courier shipping label. Blank fields fall back to the defaults.
              </p>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {COMPANY_FIELDS.map((f) => (
                  <div key={f.key} className={`flex flex-col gap-1 ${f.full ? "sm:col-span-2" : ""}`}>
                    <label htmlFor={`company-${f.key}`} className="text-xs font-medium text-gray-600">{f.label}</label>
                    <input
                      id={`company-${f.key}`}
                      type="text"
                      value={company[f.key]}
                      placeholder={f.placeholder}
                      onChange={(e) => setCompany((c) => ({ ...c, [f.key]: e.target.value }))}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-4">
                <Button loading={savingCompany} onClick={saveCompany}>Save company details</Button>
                {savedCompany && <span className="text-xs text-emerald-600">Saved</span>}
                {companyError && <span className="text-xs text-red-600">Couldn&rsquo;t save. Try again.</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
