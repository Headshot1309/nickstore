import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Gamepad2,
  Headphones,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react';
import Navbar from '@/components/public/Navbar';
import Footer from '@/components/public/Footer';
import { GameCard } from '@/components/public/GameCard';
import { useGames } from '@/hooks/useGames';
import { useCustomer } from '@/contexts/CustomerContext';
import { statsCollection, type PopularGameStat } from '@/lib/mongodb';
import { usePreference } from '@/contexts/PreferenceContext';
import { createGameVisualDataUrl } from '@/lib/gameVisuals';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';

const featuredFallback = [
  { name: 'Mobile Legends', image_url: createGameVisualDataUrl('Mobile Legends') },
  { name: 'Free Fire', image_url: createGameVisualDataUrl('Free Fire') },
  { name: 'PUBG Mobile', image_url: createGameVisualDataUrl('PUBG Mobile') },
];

const serviceStats = [
  { value: '5 min', label: 'average processing' },
  { value: '24/7', label: 'support coverage' },
  { value: '100+', label: 'supported games' },
];

const steps = [
  { icon: Search, title: 'Choose your game', text: 'Search the catalog and pick the title you want to top up.' },
  { icon: CreditCard, title: 'Select a package', text: 'Compare denominations, discounts, and payment options clearly.' },
  { icon: CheckCircle2, title: 'Track delivery', text: 'Submit details once and follow your order status anytime.' },
];

const guarantees = [
  { icon: Zap, title: 'Fast processing', text: 'Orders move into processing as soon as payment details are confirmed.' },
  { icon: ShieldCheck, title: 'Secure checkout', text: 'Top-up details and payment flow stay behind the site API.' },
  { icon: Headphones, title: 'Human support', text: 'WhatsApp support is visible throughout the buying journey.' },
];

const Home: React.FC = () => {
  const { games, loading } = useGames();
  const { customer } = useCustomer();
  const { formatMoney } = usePreference();
  const [selectedDeskIndex, setSelectedDeskIndex] = useState(0);
  const [globalPopular, setGlobalPopular] = useState<PopularGameStat[]>([]);
  const [customerPopular, setCustomerPopular] = useState<PopularGameStat[]>([]);

  const heroGames = useMemo(() => {
    const availableGames = games.length > 0 ? games : featuredFallback;
    return availableGames.slice(0, 3);
  }, [games]);
  const selectedDeskGame = heroGames[selectedDeskIndex] || heroGames[0];
  const selectedDeskGameId = selectedDeskGame && '$id' in selectedDeskGame ? selectedDeskGame.$id : '';
  const deskPackages = ['Starter pack', 'Best value', 'Instant bundle'];
  const liveRanking = customerPopular.length > 0 ? customerPopular : globalPopular;

  useEffect(() => {
    statsCollection.popularGames()
      .then((response) => setGlobalPopular(response.documents || []))
      .catch(() => setGlobalPopular([]));
  }, []);

  useEffect(() => {
    if (!customer) {
      setCustomerPopular([]);
      return;
    }
    statsCollection.customerPopularGames()
      .then((response) => setCustomerPopular(response.documents || []))
      .catch(() => setCustomerPopular([]));
  }, [customer]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#020617] text-white">
      <Navbar />

      <main>
        <section className="relative overflow-hidden border-b border-slate-800/80">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(124,58,237,0.24),transparent_34%),linear-gradient(180deg,#020617_0%,#0f172a_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#020617] to-transparent" />

          <div className="container relative mx-auto grid min-h-[calc(100vh-4rem)] grid-cols-1 items-center gap-10 px-4 py-12 lg:grid-cols-[1.02fr_0.98fr] lg:py-16">
            <div className="max-w-3xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-4 py-2 text-sm text-violet-200 shadow-lg shadow-violet-950/20">
                <Sparkles className="h-4 w-4" />
                Malaysia game top-up storefront
              </div>

              <h1 className="text-balance text-4xl font-black leading-[1.02] tracking-tight sm:text-5xl lg:text-7xl">
                Game credits delivered with speed, clarity, and trust.
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                NickStore helps players buy diamonds, UC, crystals, and game credits with a focused checkout flow, secure payment steps, and easy order tracking.
              </p>

              <div className="mt-8 flex max-w-md flex-col gap-3 sm:max-w-none sm:flex-row">
                <Link to="/games" className="w-full sm:w-auto">
                  <Button className="h-12 w-full bg-violet-500 px-7 font-semibold text-white shadow-xl shadow-violet-950/35 transition-all hover:-translate-y-0.5 hover:bg-violet-400 sm:w-auto">
                    <Gamepad2 className="mr-2 h-5 w-5" />
                    Browse top-ups
                  </Button>
                </Link>
                <Link to="/track-order" className="w-full sm:w-auto">
                  <Button variant="outline" className="h-12 w-full border-slate-700 bg-slate-950/45 px-7 font-semibold text-slate-100 transition-all hover:-translate-y-0.5 hover:bg-slate-800 sm:w-auto">
                    Track order
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>

              <div className="mt-10 grid max-w-2xl grid-cols-3 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/55 shadow-2xl shadow-slate-950/40">
                {serviceStats.map((stat) => (
                  <div key={stat.label} className="border-r border-slate-800 px-3 py-4 last:border-r-0 sm:px-5">
                    <p className="text-xl font-bold text-white sm:text-2xl">{stat.value}</p>
                    <p className="mt-1 text-[11px] leading-4 text-slate-500 sm:text-sm">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="overflow-hidden rounded-[2rem] border border-slate-700/80 bg-slate-950/80 shadow-2xl shadow-slate-950/60 backdrop-blur">
                <div className="border-b border-slate-800 bg-slate-900/70 px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">Live top-up desk</p>
                      <p className="mt-1 text-xs text-slate-500">Fast checkout preview</p>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                      <span className="h-2 w-2 rounded-full bg-emerald-300" />
                      Online
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-5">
                  <div className="grid grid-cols-3 gap-3">
                    {heroGames.map((game, index) => (
                      <button
                        key={game.name}
                        type="button"
                        onClick={() => setSelectedDeskIndex(index)}
                        className={`${index === 0 ? 'col-span-2 row-span-2' : ''} relative overflow-hidden rounded-2xl border bg-slate-900 text-left transition hover:-translate-y-0.5 ${
                          selectedDeskIndex === index ? 'border-violet-300 shadow-lg shadow-violet-950/30' : 'border-slate-800'
                        }`}
                      >
                        {game.image_url ? (
                          <img src={game.image_url} alt={game.name} className="h-full min-h-28 w-full object-cover" />
                        ) : (
                          <div className="flex h-full min-h-28 items-center justify-center bg-slate-900">
                            <Gamepad2 className="h-8 w-8 text-slate-700" />
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent p-3">
                          <p className="text-xs font-semibold text-white">{game.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-slate-400">Selected package</p>
                        <p className="mt-1 text-xl font-bold text-white">{selectedDeskGame?.name || 'NickStore'} {deskPackages[selectedDeskIndex]}</p>
                      </div>
                      <p className="rounded-full bg-violet-500 px-3 py-1 text-sm font-semibold text-white">Live</p>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-slate-400">
                      {['Details', 'Payment', 'Processing'].map((label, index) => (
                        <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/65 px-2 py-3">
                          <div className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/15 text-violet-300">
                            {index + 1}
                          </div>
                          {label}
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/55 p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {customerPopular.length > 0 ? 'Your ranking' : 'Store ranking'}
                        </p>
                        <p className="text-xs text-slate-500">Top 5</p>
                      </div>
                      <div className="space-y-2">
                        {(liveRanking.length > 0 ? liveRanking : heroGames.map((game, index) => ({
                          rank: index + 1,
                          game_id: '$id' in game ? game.$id || '' : '',
                          game_name: game.name,
                          order_count: 0,
                          total_spend: 0,
                        }))).slice(0, 5).map((row) => (
                          <div key={`${row.rank}-${row.game_name}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-900/75 px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">#{row.rank} {row.game_name}</p>
                              <p className="text-xs text-slate-500">{row.order_count} orders</p>
                            </div>
                            <p className="shrink-0 text-sm font-bold text-emerald-300">{formatMoney(row.total_spend)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Link to={selectedDeskGameId ? `/game/${selectedDeskGameId}` : '/games'}>
                        <Button className="h-10 w-full bg-violet-500 text-white hover:bg-violet-400">Top up</Button>
                      </Link>
                      <Link to="/account">
                        <Button variant="outline" className="h-10 w-full border-slate-700 bg-slate-950/60 text-slate-200 hover:bg-slate-800">Account</Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-800/80 bg-slate-950 py-5">
          <div className="container mx-auto grid grid-cols-2 gap-3 px-4 text-sm text-slate-400 sm:grid-cols-4">
            {['Mobile Legends', 'Free Fire', 'PUBG Mobile', 'Genshin Impact'].map((name) => (
              <div key={name} className="rounded-xl border border-slate-800 bg-slate-900/45 px-3 py-3 text-center font-medium">
                {name}
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#020617] py-16 sm:py-20">
          <div className="container mx-auto px-4">
            <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-300">How it works</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Top up in three clean steps</h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-slate-400">
                The buying path is intentionally short on mobile, with clear package selection, payment proof, and order tracking.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5 shadow-xl shadow-slate-950/20">
                    <div className="flex items-center justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/12 text-violet-300">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-semibold text-slate-600">0{index + 1}</span>
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-white">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{step.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-800/80 bg-slate-900/35 py-16 sm:py-20">
          <div className="container mx-auto px-4">
            <div className="mb-10 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-300">Catalog</p>
                <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Popular top-ups ranked 1-5</h2>
              </div>
              <Link to="/games" className="hidden items-center gap-2 text-sm font-semibold text-violet-300 transition-colors hover:text-violet-200 sm:flex">
                View all games
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <LoadingSpinner size="lg" className="text-violet-500" />
              </div>
            ) : games.length === 0 ? (
              <EmptyState title="No games available" description="Check back later for new games!" />
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-4">
                {(globalPopular.length > 0
                  ? globalPopular.map((row) => games.find((game) => game.$id === row.game_id || game.name === row.game_name)).filter(Boolean)
                  : games.slice(0, 5)
                ).slice(0, 5).map((game, index) => (
                  <div key={game!.$id || game!.name} className="relative">
                    <div className="absolute left-3 top-3 z-10 rounded-full bg-violet-500 px-3 py-1 text-xs font-black text-white shadow-lg">
                      #{index + 1}
                    </div>
                    <GameCard game={game!} />
                    {globalPopular[index] && (
                      <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
                        {globalPopular[index].order_count} orders - {formatMoney(globalPopular[index].total_spend)} spent
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="bg-[#020617] py-16 sm:py-20">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-300">Why players trust us</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">A checkout built for repeat buyers</h2>
                <p className="mt-4 text-sm leading-6 text-slate-400">
                  Professional top-up stores need more than a pretty page. NickStore keeps the important signals visible: status, price, payment instructions, and support.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {guarantees.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5">
                      <Icon className="h-6 w-6 text-violet-300" />
                      <h3 className="mt-4 font-semibold text-white">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{item.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-20">
          <div className="container mx-auto px-4">
            <div className="overflow-hidden rounded-[2rem] border border-violet-400/20 bg-gradient-to-r from-violet-600 to-fuchsia-600 p-6 shadow-2xl shadow-violet-950/35 sm:p-10 lg:p-14">
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white">
                    <Star className="h-4 w-4 fill-white" />
                    Ready for your next match
                  </div>
                  <h2 className="text-3xl font-bold text-white sm:text-4xl">Start a top-up and get back in game.</h2>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-violet-100 sm:text-base">
                    Browse packages, submit your player details, and keep your order number for tracking.
                  </p>
                </div>
                <Link to="/games" className="w-full sm:w-auto">
                  <Button className="h-12 w-full bg-white px-7 font-semibold text-violet-700 transition-all hover:-translate-y-0.5 hover:bg-violet-50 sm:w-auto">
                    Browse games
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Home;
