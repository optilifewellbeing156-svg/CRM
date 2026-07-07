import { useLocation, Link } from "wouter";
import { LayoutDashboard, Package, Users, ShoppingCart, UsersRound, BarChart3, PackagePlus, Settings, X } from "lucide-react";
import { useMe } from "@/hooks/useMe";

const allNavItems = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard, permission: "dashboard" },
  { href: "/products", label: "Products", Icon: Package, permission: "products" },
  { href: "/purchases", label: "Purchases", Icon: PackagePlus, permission: "purchases" },
  { href: "/customers", label: "Customers", Icon: Users, permission: "customers" },
  { href: "/orders", label: "Orders", Icon: ShoppingCart, permission: "orders" },
  { href: "/sales-report", label: "Sales Report", Icon: BarChart3, permission: "sales-report" },
  { href: "/users", label: "Users", Icon: UsersRound, permission: "ADMIN_ONLY" },
  { href: "/settings", label: "Settings", Icon: Settings, permission: "ADMIN_ONLY" },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const [location] = useLocation();
  const me = useMe();

  const navItems = allNavItems.filter((item) => {
    if (me === "loading" || me === null) return false;
    if (me.role === "ADMIN" || me.role === "SUPER_ADMIN") return true;
    if (item.permission === "ADMIN_ONLY") return false;
    return me.permissions?.includes(item.permission) ?? false;
  });

  const sidebarContent = (
    <aside className="w-60 flex flex-col h-full" style={{ backgroundColor: "hsl(170,42%,30%)" }}>
      <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="" className="h-9 w-9 shrink-0" />
          <h1 className="text-white font-bold text-base leading-snug">
            OptiLife<br />Wellbeing
          </h1>
        </div>
        <button onClick={onClose} className="text-white/70 hover:text-white lg:hidden" aria-label="Close menu">
          <X size={18} />
        </button>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, Icon }) => {
          const active = location === href || location.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={17} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );

  return (
    <>
      {/* Desktop: always visible fixed sidebar */}
      <div className="hidden lg:flex fixed inset-y-0 left-0 w-60 z-40 flex-col" style={{ backgroundColor: "hsl(170,42%,30%)" }}>
        {sidebarContent}
      </div>

      {/* Mobile: overlay drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <div className="relative z-10 flex flex-col h-full shadow-xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
