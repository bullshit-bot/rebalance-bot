import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AuthGuard } from "@/components/AuthGuard";
import OverviewPage from "./pages/OverviewPage";
import PortfolioPage from "./pages/PortfolioPage";
import RebalancePlanPage from "./pages/RebalancePlanPage";
import OrdersPage from "./pages/OrdersPage";
import AllocationsPage from "./pages/AllocationsPage";
import ExchangesPage from "./pages/ExchangesPage";
import StrategyConfigPage from "./pages/StrategyConfigPage";
import LogsPage from "./pages/LogsPage";
import AlertsPage from "./pages/AlertsPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import BacktestingPage from "./pages/BacktestingPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import TaxPage from "./pages/TaxPage";
import CapitalFlowsPage from "./pages/CapitalFlowsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/rebalance" element={<RebalancePlanPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/allocations" element={<AllocationsPage />} />
        <Route path="/exchanges" element={<ExchangesPage />} />
        <Route path="/strategy" element={<StrategyConfigPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/backtesting" element={<BacktestingPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/tax" element={<TaxPage />} />
        <Route path="/capital-flows" element={<CapitalFlowsPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
