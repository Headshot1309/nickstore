import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, LogOut, Package, ReceiptText, UserRound } from 'lucide-react';
import Navbar from '@/components/public/Navbar';
import Footer from '@/components/public/Footer';
import { Button } from '@/components/ui/button';
import { useCustomer } from '@/contexts/CustomerContext';
import { useOrders } from '@/hooks/useOrders';
import { usePreference } from '@/contexts/PreferenceContext';

const CustomerAccount: React.FC = () => {
  const navigate = useNavigate();
  const { customer, isCustomerAuthenticated, loading, logout } = useCustomer();
  const { orders, loading: ordersLoading, refresh } = useOrders();
  const { formatMoney } = usePreference();

  useEffect(() => {
    if (!loading && !isCustomerAuthenticated) {
      navigate('/login');
    }
  }, [isCustomerAuthenticated, loading, navigate]);

  useEffect(() => {
    if (isCustomerAuthenticated) {
      void refresh();
    }
  }, [isCustomerAuthenticated, refresh]);

  if (loading || !customer) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="container mx-auto px-4 py-8 sm:py-12">
        <section className="mb-8 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70 shadow-2xl shadow-black/25">
          <div className="h-1 bg-gradient-to-r from-violet-400 via-cyan-300 to-emerald-300" />
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-200">
                <UserRound className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Signed in as</p>
                <h1 className="text-2xl font-bold">{customer.name}</h1>
                <p className="text-sm text-slate-500">{customer.email}</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                void logout().then(() => navigate('/'));
              }}
              className="h-11 border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </section>

        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-300">My orders</p>
            <h2 className="mt-2 text-3xl font-bold">Your top-up history</h2>
          </div>
          <Link to="/games">
            <Button className="h-11 bg-violet-500 text-white hover:bg-violet-400">
              New top-up
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {ordersLoading ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-400">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8 text-center">
            <Package className="mx-auto mb-4 h-10 w-10 text-slate-600" />
            <h3 className="text-lg font-semibold">No orders yet</h3>
            <p className="mt-2 text-sm text-slate-400">Start your first top-up and it will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {orders.map((order) => (
              <Link
                key={order.$id || order.order_number}
                to={`/order-status/${order.order_number}`}
                className="rounded-2xl border border-slate-800 bg-slate-900/65 p-5 transition hover:border-violet-400/50 hover:bg-slate-900"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-200">
                      <ReceiptText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{order.game_name}</p>
                      <p className="mt-1 text-sm text-slate-400">{order.product_name} - {order.order_number}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold capitalize text-slate-300">{order.status}</span>
                    <span className="text-lg font-bold text-violet-300">{formatMoney(order.total_amount || 0)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default CustomerAccount;
