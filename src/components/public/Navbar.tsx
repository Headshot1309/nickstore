import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Gamepad2, Menu, Search, UserRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCustomer } from '@/contexts/CustomerContext';
import { supportedCurrencies, supportedLanguages, usePreference } from '@/contexts/PreferenceContext';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';

const Navbar: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { customer } = useCustomer();
  const { currency, language, setCurrency, setLanguage } = usePreference();

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/games', label: 'Games' },
    { path: '/track-order', label: 'Track Order' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/82 backdrop-blur-xl supports-[backdrop-filter]:bg-slate-950/70">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 focus:ring-offset-slate-950">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-950/40">
              <Gamepad2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">NickStore</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 focus:ring-offset-slate-950',
                  isActive(link.path)
                    ? 'bg-violet-500/12 text-white shadow-inner shadow-violet-500/10'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 lg:flex">
              <select
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                className="h-10 rounded-xl border border-slate-700 bg-slate-950/70 px-2 text-xs font-semibold text-slate-200 outline-none"
                aria-label="Currency"
              >
                {supportedCurrencies.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="h-10 rounded-xl border border-slate-700 bg-slate-950/70 px-2 text-xs font-semibold text-slate-200 outline-none"
                aria-label="Language"
              >
                {supportedLanguages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
              </select>
            </div>
            <Link to={customer ? '/account' : '/login'} className="hidden sm:block">
              <Button variant="outline" className="h-10 border-slate-700 bg-slate-950/40 px-4 text-slate-200 hover:bg-slate-800">
                <UserRound className="mr-2 h-4 w-4" />
                {customer ? 'Account' : 'Login'}
              </Button>
            </Link>
            {/* Mobile Menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu" className="text-slate-300 hover:bg-slate-800/70 hover:text-white md:hidden">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[min(20rem,calc(100vw-2rem))] border-l border-slate-800 bg-slate-950 p-0">
                <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
                      <Gamepad2 className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-semibold text-white">NickStore</span>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Close menu" onClick={() => setMobileOpen(false)} className="text-slate-400 hover:bg-slate-800 hover:text-white">
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <div className="flex flex-col gap-2 p-4">
                  <Link
                    to="/games"
                    onClick={() => setMobileOpen(false)}
                    className="mb-2 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-400"
                  >
                    <Search className="h-4 w-4 text-violet-400" />
                    Search games and top up
                  </Link>
                  {navLinks.map((link) => (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'rounded-xl px-4 py-3 text-base font-medium transition-colors',
                        isActive(link.path)
                          ? 'bg-violet-500/12 text-white'
                          : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                      )}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={currency}
                      onChange={(event) => setCurrency(event.target.value)}
                      className="h-11 rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm text-slate-200"
                    >
                      {supportedCurrencies.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <select
                      value={language}
                      onChange={(event) => setLanguage(event.target.value)}
                      className="h-11 rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm text-slate-200"
                    >
                      {supportedLanguages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
                    </select>
                  </div>
                  <Link
                    to={customer ? '/account' : '/login'}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-xl bg-violet-500 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-violet-400"
                  >
                    {customer ? 'My Account' : 'Customer Login'}
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
