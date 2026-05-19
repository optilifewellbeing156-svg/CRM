'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, Users, ShoppingCart, UsersRound, BarChart3, PackagePlus } from 'lucide-react'

const allNavItems = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard, permission: 'dashboard' },
  { href: '/products', label: 'Products', Icon: Package, permission: 'products' },
  { href: '/purchases', label: 'Purchases', Icon: PackagePlus, permission: 'purchases' },
  { href: '/customers', label: 'Customers', Icon: Users, permission: 'customers' },
  { href: '/orders', label: 'Orders', Icon: ShoppingCart, permission: 'orders' },
  { href: '/sales-report', label: 'Sales Report', Icon: BarChart3, permission: 'sales-report' },
  { href: '/users', label: 'Users', Icon: UsersRound, permission: 'ADMIN_ONLY' },
]

export function Sidebar() {
  const pathname = usePathname()
  const [role, setRole] = useState<string>('USER')
  const [permissions, setPermissions] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setRole(data.role)
          setPermissions(data.permissions)
        }
      })
      .catch(() => {})
  }, [])

  const navItems = allNavItems.filter(item => {
    if (role === 'ADMIN') return true
    if (item.permission === 'ADMIN_ONLY') return false
    return permissions.includes(item.permission)
  })

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-sidebar flex flex-col z-40">
      <div className="px-6 py-5 border-b border-white/10">
        <h1 className="text-white font-bold text-base leading-snug">
          OptiLife<br />Wellbeing
        </h1>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}>
              <Icon size={17} />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
