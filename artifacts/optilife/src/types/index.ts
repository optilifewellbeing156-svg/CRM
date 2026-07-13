export type Product = {
  id: string;
  name: string;
  sku: string;
  costPrice: string;
  sellingPrice: string;
  stockQuantity: number;
  lowStockThreshold: number;
  createdAt: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  cardNumber: string | null;
  cardExpiry: string | null;
  cardHolder: string | null;
  status: "active" | "dnc";
  createdAt: string;
};

export type OrderItem = {
  id: string;
  productId: string;
  quantity: string | number;
  price: string;
  product?: { name: string };
};

export type Order = {
  id: string;
  customerId: string;
  createdById?: string | null;
  totalAmount: string;
  status?: string;
  isPaid?: boolean;
  paymentMethod?: string | null;
  createdAt: string;
  customer?: { name: string };
  items?: OrderItem[];
};

export type Purchase = {
  id: string;
  productId: string;
  product: { id: string; name: string; sku: string };
  quantity: number;
  unitCost: string | number;
  totalCost: string | number;
  vatEnabled: boolean;
  vatRate: string | number;
  vatAmount: string | number;
  reference: string | null;
  batchRef: string | null;
  createdAt: string;
};

export type User = {
  id: string;
  username: string;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
  isActive: boolean;
  commissionRate: string;
  permissions: string[];
  createdAt: string;
};

export type DashboardData = {
  totalRevenue: number;
  totalOrders: number;
  lowStockProducts: Product[];
  dailyRevenue: { date: string; revenue: number; orders: number }[];
};

export type Me = {
  userId: string;
  username: string;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
  permissions: string[];
} | null;

export const PERMISSIONS = [
  { key: "dashboard", label: "Dashboard", group: "Pages" },
  { key: "products", label: "View Products", group: "Pages" },
  { key: "purchases", label: "View Purchases", group: "Pages" },
  { key: "customers", label: "View Customers", group: "Pages" },
  { key: "orders", label: "View Orders", group: "Pages" },
  { key: "sales-report", label: "Sales Report", group: "Pages" },
  { key: "manage-products", label: "Add / Edit / Delete Products", group: "Products" },
  { key: "edit-products", label: "Edit Products", group: "Products" },
  { key: "delete-products", label: "Delete Products", group: "Products" },
  { key: "change-stock", label: "Change Stock", group: "Products" },
  { key: "manage-customers", label: "Add / Edit / Delete Customers", group: "Customers" },
  { key: "add-customers", label: "Add Customers", group: "Customers" },
  { key: "edit-customers", label: "Edit Customers", group: "Customers" },
  { key: "delete-customers", label: "Delete Customers", group: "Customers" },
  { key: "view-card-details", label: "View Customer Card Details", group: "Customers" },
  { key: "set-customer-status", label: "Set Customer Active / DNC", group: "Customers" },
  { key: "create-orders", label: "Create New Orders", group: "Orders" },
  { key: "edit-orders", label: "Edit Orders", group: "Orders" },
  { key: "delete-orders", label: "Delete Orders", group: "Orders" },
  { key: "change-order-status", label: "Change Order Status", group: "Orders" },
  { key: "add-purchases", label: "Add Purchases", group: "Purchases" },
  { key: "edit-purchases", label: "Edit Purchases", group: "Purchases" },
  { key: "delete-purchases", label: "Delete Purchases", group: "Purchases" },
] as const;

export type PermissionKey = typeof PERMISSIONS[number]["key"];
