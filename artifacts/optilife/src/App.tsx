import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { Suspense } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Spinner } from "@/components/ui/Spinner";
import { useMe, clearMeCache } from "@/hooks/useMe";

import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import ProductsPage from "@/pages/ProductsPage";
import CustomersPage from "@/pages/CustomersPage";
import OrdersPage from "@/pages/OrdersPage";
import NewOrderPage from "@/pages/NewOrderPage";
import EditOrderPage from "@/pages/EditOrderPage";
import OrderDetailPage from "@/pages/OrderDetailPage";
import PurchasesPage from "@/pages/PurchasesPage";
import SalesReportPage from "@/pages/SalesReportPage";
import UsersPage from "@/pages/UsersPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const me = useMe();

  if (me === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "hsl(160,30%,97%)" }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (me === null) {
    return <Redirect to="/login" />;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/signup"><Redirect to="/login" /></Route>
      <Route path="/dashboard">
        <ProtectedRoute><DashboardPage /></ProtectedRoute>
      </Route>
      <Route path="/products">
        <ProtectedRoute><ProductsPage /></ProtectedRoute>
      </Route>
      <Route path="/customers">
        <ProtectedRoute><CustomersPage /></ProtectedRoute>
      </Route>
      <Route path="/orders/new">
        <ProtectedRoute><NewOrderPage /></ProtectedRoute>
      </Route>
      <Route path="/orders/:id/edit">
        {(params) => (
          <ProtectedRoute><EditOrderPage id={params.id} /></ProtectedRoute>
        )}
      </Route>
      <Route path="/orders/:id">
        {(params) => (
          <ProtectedRoute><OrderDetailPage id={params.id} /></ProtectedRoute>
        )}
      </Route>
      <Route path="/orders">
        <ProtectedRoute><OrdersPage /></ProtectedRoute>
      </Route>
      <Route path="/purchases">
        <ProtectedRoute><PurchasesPage /></ProtectedRoute>
      </Route>
      <Route path="/sales-report">
        <ProtectedRoute><SalesReportPage /></ProtectedRoute>
      </Route>
      <Route path="/users">
        <ProtectedRoute><UsersPage /></ProtectedRoute>
      </Route>
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <AppRouter />
    </WouterRouter>
  );
}

export default App;
