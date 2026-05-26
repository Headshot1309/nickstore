import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { CustomerProvider, useCustomer } from '@/contexts/CustomerContext';
import { PreferenceProvider } from '@/contexts/PreferenceContext';
import { Toaster } from '@/components/ui/sonner';
import InstallPrompt from '@/components/shared/InstallPrompt';

// Public Pages
import Home from '@/pages/public/Home';
import Games from '@/pages/public/Games';
import GameDetail from '@/pages/public/GameDetail';
import OrderForm from '@/pages/public/OrderForm';
import Payment from '@/pages/public/Payment';
import OrderStatus from '@/pages/public/OrderStatus';
import OrderSuccess from '@/pages/public/OrderSuccess';
import CustomerLogin from '@/pages/public/CustomerLogin';
import CustomerAccount from '@/pages/public/CustomerAccount';

// Admin Pages
import AdminLogin from '@/pages/admin/Login';
import AdminDashboard from '@/pages/admin/Dashboard';
import AdminOrders from '@/pages/admin/Orders';
import AdminGames from '@/pages/admin/Games';
import AdminProducts from '@/pages/admin/Products';
import AdminPaymentMethods from '@/pages/admin/PaymentMethods';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }
  
  return <>{children}</>;
};

const ProtectedCustomerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isCustomerAuthenticated, loading } = useCustomer();

  if (loading) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  if (!isCustomerAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function App() {
  // Check if we're on mobile device
  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  // Request notification permission on app load (only for desktop)
  useEffect(() => {
    if (!isMobile() && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <AuthProvider>
      <CustomerProvider>
        <PreferenceProvider>
          <BrowserRouter>
            <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/games" element={<Games />} />
            <Route path="/game/:gameId" element={<GameDetail />} />
            <Route path="/order" element={<ProtectedCustomerRoute><OrderForm /></ProtectedCustomerRoute>} />
            <Route path="/payment" element={<ProtectedCustomerRoute><Payment /></ProtectedCustomerRoute>} />
            <Route path="/track-order" element={<OrderStatus />} />
            <Route path="/order-status/:orderNumber" element={<OrderStatus />} />
            <Route path="/order-success" element={<OrderSuccess />} />
            <Route path="/login" element={<CustomerLogin />} />
            <Route path="/account" element={<ProtectedCustomerRoute><CustomerAccount /></ProtectedCustomerRoute>} />

          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/orders"
            element={
              <ProtectedRoute>
                <AdminOrders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/games"
            element={
              <ProtectedRoute>
                <AdminGames />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/products"
            element={
              <ProtectedRoute>
                <AdminProducts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/payment-methods"
            element={
              <ProtectedRoute>
                <AdminPaymentMethods />
              </ProtectedRoute>
            }
          />

          {/* 404 - Redirect to Home */}
          <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <InstallPrompt />
          </BrowserRouter>
        </PreferenceProvider>
      </CustomerProvider>
      <Analytics />
      <Toaster position="top-right" />
    </AuthProvider>
  );
}

export default App;
