import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, ChevronRight, Mail, Phone, Server, ShieldCheck, User, Zap } from 'lucide-react';
import Navbar from '@/components/public/Navbar';
import Footer from '@/components/public/Footer';
import { StepProgress } from '@/components/public/StepProgress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useCustomer } from '@/contexts/CustomerContext';

const OrderForm: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { game, product } = location.state || {};
  const { customer } = useCustomer();

  const [formData, setFormData] = useState({
    userGameId: '',
    userGameServer: '',
    userNickname: '',
    userEmail: '',
    userPhone: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (customer) {
      setFormData((current) => ({
        ...current,
        userEmail: current.userEmail || customer.email || '',
        userPhone: current.userPhone || customer.phone || '',
      }));
    }
  }, [customer]);

  // Redirect if no game/product selected
  React.useEffect(() => {
    if (!game || !product) {
      navigate('/games');
    }
  }, [game, product, navigate]);

  if (!game || !product) return null;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.userGameId.trim()) {
      newErrors.userGameId = 'Game ID is required';
    }
    
    if (formData.userEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.userEmail)) {
      newErrors.userEmail = 'Invalid email address';
    }
    
    if (formData.userPhone && !/^\+?[\d\s-]{10,}$/.test(formData.userPhone)) {
      newErrors.userPhone = 'Invalid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      navigate('/payment', {
        state: {
          game,
          product,
          userDetails: formData,
        },
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />

      <main className="pt-6 pb-16 sm:pt-8 sm:pb-20">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Back Button */}
          <button
            onClick={() => navigate(-1)}
            className="mb-6 flex items-center gap-2 rounded-lg text-slate-400 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>

          {/* Progress */}
          <StepProgress currentStep={1} />

          <div className="mb-6 rounded-3xl border border-slate-800 bg-slate-900/55 p-5 shadow-xl shadow-slate-950/20">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-300">Player details</p>
                <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Confirm where we should deliver.</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Enter the same game ID and server shown in your account. This keeps checkout short and helps avoid delivery mistakes.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs text-slate-400 md:min-w-80">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-3">
                  <Zap className="mx-auto mb-2 h-5 w-5 text-emerald-300" />
                  Fast check
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-3">
                  <ShieldCheck className="mx-auto mb-2 h-5 w-5 text-cyan-300" />
                  Secure
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-3">
                  <BadgeCheck className="mx-auto mb-2 h-5 w-5 text-violet-300" />
                  Tracked
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
            {/* Form */}
            <div className="lg:col-span-2">
              <Card className="rounded-3xl border-slate-800 bg-slate-900/70 shadow-xl shadow-slate-950/20">
                <CardHeader>
                  <CardTitle className="text-white">Enter game account details</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="userGameId" className="text-slate-300">
                          <User className="w-4 h-4 inline mr-2" />
                          Game ID *
                        </Label>
                        <Input
                          id="userGameId"
                          value={formData.userGameId}
                          onChange={(e) => setFormData({ ...formData, userGameId: e.target.value })}
                          placeholder="Enter your game ID"
                          className={`h-12 rounded-xl bg-slate-950 border-slate-700 text-white ${
                            errors.userGameId ? 'border-red-500' : ''
                          }`}
                        />
                        {errors.userGameId && (
                          <p className="text-red-400 text-sm">{errors.userGameId}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="userGameServer" className="text-slate-300">
                          <Server className="w-4 h-4 inline mr-2" />
                          Server (Optional)
                        </Label>
                        <Input
                          id="userGameServer"
                          value={formData.userGameServer}
                          onChange={(e) => setFormData({ ...formData, userGameServer: e.target.value })}
                          placeholder="e.g., Server 1"
                          className="h-12 rounded-xl bg-slate-950 border-slate-700 text-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="userNickname" className="text-slate-300">
                        <User className="w-4 h-4 inline mr-2" />
                        In-Game Nickname (Optional)
                      </Label>
                      <Input
                        id="userNickname"
                        value={formData.userNickname}
                        onChange={(e) => setFormData({ ...formData, userNickname: e.target.value })}
                        placeholder="Your in-game name"
                        className="h-12 rounded-xl bg-slate-950 border-slate-700 text-white"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="userEmail" className="text-slate-300">
                          <Mail className="w-4 h-4 inline mr-2" />
                          Email (Optional)
                        </Label>
                        <Input
                          id="userEmail"
                          type="email"
                          value={formData.userEmail}
                          onChange={(e) => setFormData({ ...formData, userEmail: e.target.value })}
                          placeholder="your@email.com"
                          className={`h-12 rounded-xl bg-slate-950 border-slate-700 text-white ${
                            errors.userEmail ? 'border-red-500' : ''
                          }`}
                        />
                        {errors.userEmail && (
                          <p className="text-red-400 text-sm">{errors.userEmail}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="userPhone" className="text-slate-300">
                          <Phone className="w-4 h-4 inline mr-2" />
                          Phone (Optional)
                        </Label>
                        <Input
                          id="userPhone"
                          type="tel"
                          value={formData.userPhone}
                          onChange={(e) => setFormData({ ...formData, userPhone: e.target.value })}
                          placeholder="+60 12-345 6789"
                          className={`bg-slate-800 border-slate-700 text-white ${
                            errors.userPhone ? 'border-red-500' : ''
                          }`}
                        />
                        {errors.userPhone && (
                          <p className="text-red-400 text-sm">{errors.userPhone}</p>
                        )}
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="h-12 w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 py-6 text-white shadow-lg shadow-violet-950/25 transition-transform hover:scale-[1.01] hover:from-violet-600 hover:to-fuchsia-600"
                    >
                      Continue to Payment
                      <ChevronRight className="w-5 h-5 ml-2" />
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Order Summary */}
            <div>
              <Card className="sticky top-24 rounded-3xl border-slate-800 bg-slate-900/70 shadow-xl shadow-slate-950/20">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    {game.image_url ? (
                      <img
                        src={game.image_url}
                        alt={game.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-slate-800 flex items-center justify-center">
                        <span className="text-xl font-bold text-slate-600">{game.name.charAt(0)}</span>
                      </div>
                    )}
                    <div>
                      <p className="text-white font-medium">{game.name}</p>
                      <p className="text-sm text-slate-400">{product.name}</p>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-400">Denomination</span>
                      <span className="text-white">{product.denomination}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-400">Quantity</span>
                      <span className="text-white">1</span>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Total</span>
                      <span className="text-2xl font-bold text-violet-400">
                        RM {product.price.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default OrderForm;
