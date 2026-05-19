export const LOW_STOCK_THRESHOLD = 10
export const COOKIE_NAME = 'optilife_token'
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export const PERMISSIONS = [
  // Pages
  { key: 'dashboard',        label: 'Dashboard',          group: 'Pages' },
  { key: 'products',         label: 'View Products',       group: 'Pages' },
  { key: 'purchases',        label: 'View Purchases',      group: 'Pages' },
  { key: 'customers',        label: 'View Customers',      group: 'Pages' },
  { key: 'orders',           label: 'View Orders',         group: 'Pages' },
  { key: 'sales-report',     label: 'Sales Report',        group: 'Pages' },
  // Products
  { key: 'manage-products',  label: 'Add / Edit / Delete Products',   group: 'Products' },
  // Customers
  { key: 'manage-customers', label: 'Add / Edit / Delete Customers',  group: 'Customers' },
  // Orders
  { key: 'create-orders',    label: 'Create New Orders',   group: 'Orders' },
  { key: 'edit-orders',      label: 'Edit Orders',         group: 'Orders' },
  { key: 'delete-orders',    label: 'Delete Orders',       group: 'Orders' },
  // Purchases
  { key: 'add-purchases',    label: 'Add Purchases',       group: 'Purchases' },
] as const

export type PermissionKey = typeof PERMISSIONS[number]['key']
