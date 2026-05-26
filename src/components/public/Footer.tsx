import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, Gamepad2, MessageCircle, Phone, ShieldCheck, Zap } from 'lucide-react';

const Footer: React.FC = () => {
  const whatsappNumber = '60197661697';
  const whatsappLink = `https://wa.me/${whatsappNumber}`;

  return (
    <footer className="border-t border-slate-800 bg-slate-950">
      <div className="container mx-auto px-4 py-12">
        <div className="mb-10 grid grid-cols-1 gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-3 sm:grid-cols-3">
          {[
            { icon: Zap, label: 'Fast delivery', text: 'Most top-ups start processing right after payment.' },
            { icon: ShieldCheck, label: 'Secure checkout', text: 'Payments and order details stay in the API flow.' },
            { icon: Clock, label: 'Order tracking', text: 'Track your status anytime with your order number.' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex gap-3 rounded-xl px-3 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{item.text}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link
              to="/"
              className="mb-4 flex w-fit items-center gap-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
                <Gamepad2 className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">NickStore</span>
            </Link>
            <p className="max-w-sm text-sm leading-6 text-slate-400">
              Your trusted source for instant game top-ups. We provide fast, secure, and reliable service for all your gaming needs.
            </p>
          </div>

          <div>
            <h4 className="mb-4 font-semibold text-white">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-sm text-slate-400 transition-colors hover:text-violet-400">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/games" className="text-sm text-slate-400 transition-colors hover:text-violet-400">
                  Games
                </Link>
              </li>
              <li>
                <Link to="/track-order" className="text-sm text-slate-400 transition-colors hover:text-violet-400">
                  Track Order
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold text-white">Contact Us</h4>
            <ul className="space-y-3">
              <li>
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-green-400"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-400">
                <Phone className="h-4 w-4" />
                60197661697
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-800 pt-6 text-center">
          <p className="text-sm text-slate-500">
            Copyright {new Date().getFullYear()} NickStore. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
