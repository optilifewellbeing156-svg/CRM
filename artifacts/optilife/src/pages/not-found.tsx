import { Link } from "wouter";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <AlertCircle className="h-10 w-10 text-red-400 mb-3" />
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Page not found</h1>
      <p className="text-sm text-gray-500 mb-6">The page you are looking for does not exist or has moved.</p>
      <Link href="/dashboard">
        <a className="text-sm font-medium text-primary hover:underline">Back to Dashboard</a>
      </Link>
    </div>
  );
}
