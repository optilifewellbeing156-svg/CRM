export type Product = {
  id: string
  name: string
  sku: string
  costPrice: string
  sellingPrice: string
  stockQuantity: number
  lowStockThreshold: number
  createdAt: string
}

export type Customer = {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  createdAt: string
}

export type OrderItem = {
  id: string
  productId: string
  quantity: number
  price: string
  product?: { name: string }
}

export type Order = {
  id: string
  customerId: string
  totalAmount: string
  status?: string
  isPaid?: boolean
  paymentMethod?: string | null
  createdAt: string
  customer?: { name: string }
  items?: OrderItem[]
}

export type User = {
  id: string
  username: string
  role: 'ADMIN' | 'USER'
  isActive: boolean
  commissionRate: string
  createdAt: string
}

export type DashboardData = {
  totalRevenue: number
  totalOrders: number
  lowStockProducts: Product[]
  dailyRevenue: { date: string; revenue: number }[]
}
