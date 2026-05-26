import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, KeyRound, Mail, Phone, RefreshCw, Search, ShoppingCart, UserRound, Users } from 'lucide-react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { customersCollection } from '@/lib/mongodb';
import { useAuth } from '@/contexts/AuthContext';
import type { Customer, Order } from '@/types';

const formatCurrency = (amount?: number | string) => {
  const value = Number(amount || 0);
  return `RM ${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`;
};

const formatDate = (date?: string | null) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const Customers: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = React.useState<Order[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [ordersLoading, setOrdersLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [passwordResetting, setPasswordResetting] = React.useState(false);
  const [passwordMessage, setPasswordMessage] = React.useState('');

  const loadCustomers = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await customersCollection.list();
      const docs = (response.documents || []) as Customer[];
      setCustomers(docs);
      setSelectedCustomer((current) => current || docs[0] || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load customers.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate('/admin/login');
      return;
    }
    void loadCustomers();
  }, [isAuthenticated, loadCustomers, navigate]);

  React.useEffect(() => {
    if (!selectedCustomer?.$id) {
      setCustomerOrders([]);
      return;
    }

    setNewPassword('');
    setPasswordMessage('');
    setOrdersLoading(true);
    customersCollection.orders(selectedCustomer.$id)
      .then((response) => setCustomerOrders((response.documents || []) as Order[]))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load customer orders.'))
      .finally(() => setOrdersLoading(false));
  }, [selectedCustomer]);

  const resetCustomerPassword = async () => {
    if (!selectedCustomer?.$id) return;
    if (newPassword.length < 8) {
      setPasswordMessage('Password must be at least 8 characters.');
      return;
    }

    setPasswordResetting(true);
    setPasswordMessage('');
    try {
      const response = await customersCollection.resetPassword(selectedCustomer.$id, newPassword);
      setNewPassword('');
      setPasswordMessage(response.message || 'Password reset. Customer sessions were logged out.');
    } catch (err) {
      setPasswordMessage(err instanceof Error ? err.message : 'Could not reset password.');
    } finally {
      setPasswordResetting(false);
    }
  };

  const filteredCustomers = React.useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.email, customer.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [customers, search]);

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <AdminSidebar />
      <main className="min-h-screen lg:ml-64">
        <div className="h-16 lg:hidden" />
        <div className="p-4 sm:p-6">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white">Customers</h1>
              </div>
              <p className="text-slate-400">View customer accounts, order history, spend, and last activity.</p>
            </div>
            <Button
              variant="outline"
              onClick={loadCustomers}
              disabled={loading}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/50">
              <div className="border-b border-slate-800 p-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search name, email, or phone..."
                    className="h-12 rounded-xl border-slate-700 bg-slate-950/70 pl-12 text-white"
                  />
                </div>
              </div>

              <div className="max-h-[70vh] overflow-y-auto p-3">
                {loading ? (
                  <div className="py-16 text-center text-sm text-slate-400">Loading customers...</div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="py-16 text-center text-sm text-slate-400">No customers found.</div>
                ) : (
                  <div className="space-y-2">
                    {filteredCustomers.map((customer) => {
                      const active = selectedCustomer?.$id === customer.$id;
                      return (
                        <button
                          key={customer.$id}
                          type="button"
                          onClick={() => setSelectedCustomer(customer)}
                          className={`w-full rounded-xl border p-4 text-left transition ${
                            active ? 'border-cyan-400/40 bg-cyan-500/10' : 'border-slate-800 bg-slate-950/45 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-white">{customer.name}</p>
                              <p className="mt-1 truncate text-sm text-slate-400">{customer.email}</p>
                            </div>
                            <div className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-cyan-200">
                              {customer.order_count || 0} orders
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                            <span>{formatCurrency(customer.total_spend)}</span>
                            <span className="text-right">{formatDate(customer.last_order_at)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/50">
              {selectedCustomer ? (
                <>
                  <div className="border-b border-slate-800 p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
                        <UserRound className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-xl font-bold text-white">{selectedCustomer.name}</h2>
                        <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-400 sm:grid-cols-2">
                          <p className="flex min-w-0 items-center gap-2">
                            <Mail className="h-4 w-4 text-slate-500" />
                            <span className="truncate">{selectedCustomer.email}</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-slate-500" />
                            {selectedCustomer.phone || '-'}
                          </p>
                          <p className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-slate-500" />
                            Joined {formatDate(selectedCustomer.created_at)}
                          </p>
                          <p className="flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4 text-slate-500" />
                            {selectedCustomer.order_count || 0} orders, {formatCurrency(selectedCustomer.total_spend)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="mb-5 rounded-xl border border-slate-800 bg-slate-950/45 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-cyan-300" />
                        <h3 className="font-semibold text-white">Reset customer password</h3>
                      </div>
                      <p className="mb-3 text-xs text-slate-400">
                        Passwords are securely hashed and cannot be viewed. Set a new password here when a customer needs help signing in.
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          type="text"
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          placeholder="New password, minimum 8 characters"
                          className="h-11 rounded-xl border-slate-700 bg-slate-900 text-white"
                        />
                        <Button
                          type="button"
                          onClick={resetCustomerPassword}
                          disabled={passwordResetting || newPassword.length < 8}
                          className="h-11 shrink-0 bg-cyan-500 text-white hover:bg-cyan-400"
                        >
                          {passwordResetting ? 'Resetting...' : 'Reset Password'}
                        </Button>
                      </div>
                      {passwordMessage && (
                        <p className="mt-2 text-xs text-slate-300">{passwordMessage}</p>
                      )}
                    </div>

                    <h3 className="mb-3 font-semibold text-white">Order history</h3>
                    {ordersLoading ? (
                      <div className="py-16 text-center text-sm text-slate-400">Loading order history...</div>
                    ) : customerOrders.length === 0 ? (
                      <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-8 text-center text-sm text-slate-400">
                        This customer has not placed an order yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {customerOrders.map((order) => (
                          <div key={order.$id || order.order_number} className="rounded-xl border border-slate-800 bg-slate-950/45 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="font-mono text-sm font-semibold text-white">{order.order_number}</p>
                                <p className="mt-1 text-sm text-slate-300">{order.game_name} - {order.product_name}</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  Game ID: {order.user_game_id || '-'} {order.user_game_server ? `- Server: ${order.user_game_server}` : ''}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-3">
                                <p className="font-bold text-violet-300">{formatCurrency(order.total_amount)}</p>
                                <StatusBadge status={order.status} />
                              </div>
                            </div>
                            <p className="mt-3 text-xs text-slate-500">{formatDate(order.created_at)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex min-h-[24rem] items-center justify-center p-8 text-center text-sm text-slate-400">
                  Select a customer to view their account and orders.
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Customers;
