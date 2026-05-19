import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-60 flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
