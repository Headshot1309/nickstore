import React, { useEffect, useMemo, useState } from 'react';
import { Search, Gamepad2, Sparkles, ShieldCheck, Zap } from 'lucide-react';
import Navbar from '@/components/public/Navbar';
import Footer from '@/components/public/Footer';
import { GameCard } from '@/components/public/GameCard';
import { useGames } from '@/hooks/useGames';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { debounce } from 'lodash';

const Games: React.FC = () => {
  const { games, loading } = useGames();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Debounced search to prevent UI blocking
  const debouncedSetSearch = useMemo(
    () =>
      debounce((value: string) => {
      setSearchQuery(value);
      setIsSearching(false);
      }, 300),
    []
  );

  useEffect(() => {
    return () => debouncedSetSearch.cancel();
  }, [debouncedSetSearch]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSearching(true);
    debouncedSetSearch(e.target.value);
  };

  const filteredGames = useMemo(() => {
    return games.filter((game) =>
      game.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [games, searchQuery]);

  const isLoading = loading || isSearching;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#020617]">
      <Navbar />

      <main className="pb-16 sm:pb-20">
        <section className="relative overflow-hidden border-b border-slate-800/80 bg-slate-950 py-12 sm:py-16">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(124,58,237,0.22),transparent_36%),linear-gradient(45deg,rgba(34,211,238,0.11),transparent_34%)]" />
          <div className="container relative mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center animate-slide-up">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-4 py-2">
                <Sparkles className="h-4 w-4 text-violet-300" />
                <span className="text-sm font-medium text-violet-200">Discover and top up</span>
              </div>
              <h1 className="text-4xl font-black leading-tight text-white sm:text-5xl">
                Find the game, pick the package, track the order.
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                A focused catalog for game credits, diamonds, UC, and passes with fast mobile search.
              </p>
            </div>

            <div className="mx-auto mt-8 grid max-w-3xl grid-cols-1 gap-3 text-sm text-slate-300 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <Zap className="mb-3 h-5 w-5 text-emerald-300" />
                Fast checkout
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <ShieldCheck className="mb-3 h-5 w-5 text-cyan-300" />
                Secure order flow
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <Gamepad2 className="mb-3 h-5 w-5 text-violet-300" />
                Player-first catalog
              </div>
            </div>
          </div>
        </section>

        <div className="container mx-auto mb-10 px-4 pt-8 animate-fade-in-up animation-delay-300">
          <div className="group relative mx-auto max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 transition-all duration-300 group-focus-within:text-violet-400" />
            <Input
              placeholder="Search games..."
              onChange={handleSearchChange}
              className="h-14 rounded-2xl border-slate-800 bg-slate-900/80 pl-12 text-base text-white shadow-xl shadow-slate-950/30 transition-all duration-300 placeholder:text-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            />
            {isSearching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Games Grid with staggered animations */}
        <div className="container mx-auto px-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="relative">
                <LoadingSpinner size="lg" className="text-violet-500" />
                <div className="absolute inset-0 animate-ping rounded-full bg-violet-500/20" />
              </div>
            </div>
          ) : filteredGames.length === 0 ? (
            <div className="animate-fade-in-up">
              <EmptyState
                title={searchQuery ? 'No games found' : 'No games available'}
                description={
                  searchQuery
                    ? `No results for "${searchQuery}". Try adjusting your search.`
                    : 'Check back later for new games!'
                }
                icon={<Gamepad2 className="w-8 h-8 text-slate-400" />}
              />
            </div>
          ) : (
            <>
              <div className="text-sm text-slate-500 mb-4 animate-fade-in-up animation-delay-400">
                Found {filteredGames.length} game{filteredGames.length !== 1 ? 's' : ''}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
                {filteredGames.map((game, index) => (
                  <div
                    key={game.$id}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${(index % 8) * 50 + 500}ms` }}
                  >
                    <GameCard game={game} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Games;
