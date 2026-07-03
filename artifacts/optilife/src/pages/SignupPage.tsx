import { useState, FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { clearMeCache } from "@/hooks/useMe";

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Signup failed");
      } else {
        clearMeCache();
        setLocation("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "hsl(160,30%,97%)" }}>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-sm p-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/logo.png" alt="OptiLifeWellbeing" className="h-20 w-20 mb-3" />
          <h1 className="text-2xl font-bold" style={{ color: "hsl(170,42%,40%)" }}>
            OptiLifeWellbeing
          </h1>
          <p className="text-sm text-gray-500 mt-1">Create your account</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="choose a username"
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="at least 8 characters"
            required
            minLength={8}
          />
          <Input
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={8}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" loading={loading} className="w-full">
            Create account
          </Button>
        </form>
        <p className="text-sm text-gray-500 mt-6 text-center">
          Already have an account?{" "}
          <Link href="/login">
            <a className="font-medium hover:underline" style={{ color: "hsl(170,42%,40%)" }}>Sign in</a>
          </Link>
        </p>
      </div>
    </div>
  );
}
