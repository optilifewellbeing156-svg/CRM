import { useState, FormEvent } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { Customer } from "@/types";

interface CustomerFormProps {
  initial?: Customer;
  onSuccess: () => void;
}

export function CustomerForm({ initial, onSuccess }: CustomerFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [cardNumber, setCardNumber] = useState(initial?.cardNumber ?? "");
  const [cardExpiry, setCardExpiry] = useState(initial?.cardExpiry ?? "");
  const [cardHolder, setCardHolder] = useState(initial?.cardHolder ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const url = initial ? `/api/customers/${initial.id}` : "/api/customers";
      const method = initial ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, phone, email, address, cardNumber, cardExpiry, cardHolder }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Failed to save");
      else onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input label="Phone" type="tel" value={phone ?? ""} onChange={(e) => setPhone(e.target.value)} />
      <Input label="Email" type="email" value={email ?? ""} onChange={(e) => setEmail(e.target.value)} />
      <Input label="Address" value={address ?? ""} onChange={(e) => setAddress(e.target.value)} />

      <div className="border-t pt-4 mt-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Card Details</p>
        <div className="space-y-3">
          <Input label="Card Number" value={cardNumber ?? ""} onChange={(e) => setCardNumber(e.target.value)} placeholder="1234 5678 9012 3456" maxLength={19} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Expiry (MM/YY)" value={cardExpiry ?? ""} onChange={(e) => setCardExpiry(e.target.value)} placeholder="MM/YY" maxLength={5} />
            <Input label="Card Holder Name" value={cardHolder ?? ""} onChange={(e) => setCardHolder(e.target.value)} placeholder="Name on card" />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" loading={loading} className="w-full">
        {initial ? "Update Customer" : "Add Customer"}
      </Button>
    </form>
  );
}
