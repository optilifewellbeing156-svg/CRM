'use client'
import { useRouter } from 'next/navigation'

export function Navbar() {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-end px-6">
      <button
        onClick={handleLogout}
        className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        Sign out
      </button>
    </header>
  )
}
