import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, Phone, User, UserPlus } from 'lucide-react';
import Navbar from '@/components/public/Navbar';
import Footer from '@/components/public/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCustomer } from '@/contexts/CustomerContext';

const CustomerLogin: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as any)?.redirectTo || '/account';
  const pendingOrder = (location.state as any)?.pendingOrder;
  const { login, verifyLoginCode, register, requestPasswordReset, resetPassword, loading } = useCustomer();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      if (challengeId && mode === 'login') {
        await verifyLoginCode(challengeId, verificationCode);
        navigate(redirectTo, pendingOrder ? { state: pendingOrder } : undefined);
        return;
      }
      if (challengeId && mode === 'forgot') {
        const resetMessage = await resetPassword(challengeId, verificationCode);
        setMessage(resetMessage || 'Password updated. Please sign in.');
        setChallengeId('');
        setVerificationCode('');
        setMode('login');
        return;
      }
      if (mode === 'forgot') {
        const resetResult = await requestPasswordReset(form.email, form.password);
        setChallengeId(resetResult.challengeId || '');
        setMessage(resetResult.message || 'If the account exists, a reset code has been sent.');
        return;
      }
      if (mode === 'register') {
        await register(form);
      } else {
        const loginResult = await login(form.email, form.password);
        if (loginResult?.requires2fa && loginResult.challengeId) {
          setChallengeId(loginResult.challengeId);
          setMessage(loginResult.message || 'Verification code sent to your email.');
          return;
        }
      }
      navigate(redirectTo, pendingOrder ? { state: pendingOrder } : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="container mx-auto grid min-h-[calc(100vh-4rem)] grid-cols-1 gap-8 px-4 py-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <section>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-300">NickStore account</p>
          <h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">Save your details and track every top-up faster.</h1>
          <p className="mt-5 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
            Customer accounts are separate from the admin panel. You can use them to speed up checkout and see your own order history without exposing admin controls.
          </p>
          <div className="mt-8 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
            {['Fast repeat checkout', 'Private order history', 'Email/password login'].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm font-medium text-slate-300">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/30 sm:p-7">
          <div className="mb-6 grid grid-cols-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-1">
            {(['login', 'register'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  mode === item ? 'bg-violet-500 text-white shadow-lg shadow-violet-950/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                {item === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}
          {message && (
            <div className="mb-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && !challengeId && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-300">Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-12 rounded-xl border-slate-700 bg-slate-950 pl-10 text-white" required />
                </div>
              </div>
            )}

            {!challengeId && <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-12 rounded-xl border-slate-700 bg-slate-950 pl-10 text-white" required />
              </div>
            </div>}

            {mode === 'register' && !challengeId && (
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-300">Phone optional</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-12 rounded-xl border-slate-700 bg-slate-950 pl-10 text-white" />
                </div>
              </div>
            )}

            {!challengeId ? <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">{mode === 'forgot' ? 'New password' : 'Password'}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="h-12 rounded-xl border-slate-700 bg-slate-950 px-10 text-white"
                  minLength={8}
                  required
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {(mode === 'register' || mode === 'forgot') && <p className="text-xs text-slate-500">Use at least 8 characters.</p>}
            </div> : (
              <div className="space-y-2">
                <Label htmlFor="code" className="text-slate-300">Email verification code</Label>
                <Input
                  id="code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  className="h-12 rounded-xl border-slate-700 bg-slate-950 text-white"
                  placeholder="Enter 6-digit code"
                  required
                />
              </div>
            )}

            <Button disabled={loading} className="h-12 w-full rounded-xl bg-violet-500 font-semibold text-white hover:bg-violet-400">
              <UserPlus className="mr-2 h-4 w-4" />
              {challengeId ? 'Verify code' : mode === 'login' ? 'Sign in' : mode === 'forgot' ? 'Send reset code' : 'Create account'}
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'forgot' ? 'login' : 'forgot');
                setChallengeId('');
                setVerificationCode('');
                setError('');
                setMessage('');
              }}
              className="text-violet-300 hover:text-violet-200"
            >
              {mode === 'forgot' ? 'Back to sign in' : 'Forgot password?'}
            </button>
          </div>

          <p className="mt-5 text-center text-sm text-slate-500">
            Admin login is still at <Link to="/admin/login" className="text-violet-300 hover:text-violet-200">/admin/login</Link>.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default CustomerLogin;
