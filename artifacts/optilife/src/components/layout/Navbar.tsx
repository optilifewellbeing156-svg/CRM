import { useLocation } from "wouter";
import { Menu } from "lucide-react";
import { clearMeCache } from "@/hooks/useMe";

interface NavbarProps {
  onMenuToggle: () => void;
}

export function Navbar({ onMenuToggle }: NavbarProps) {
  const [, setLocation] = useLocation();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    clearMeCache();
    setLocation("/login");
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>
      <div className="lg:hidden flex items-center gap-2">
        <img src="/logo.png" alt="OptiLifeWellbeing" className="h-7 w-7" />
        <span className="font-semibold text-sm" style={{ color: "hsl(170,42%,30%)" }}>OptiLifeWellbeing</span>
      </div>
      <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-800 transition-colors ml-auto">
        Sign out
      </button>
    </header>
  );
}
