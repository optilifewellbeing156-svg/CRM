import { OrderForm } from '@/components/features/orders/OrderForm'

export default function NewOrderPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Invoice</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <OrderForm />
      </div>
    </div>
  )
}
