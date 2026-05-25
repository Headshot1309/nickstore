import React, { useMemo, useState } from 'react';
import { BadgeCheck, Gamepad2, Loader2, Search, Server, ShieldCheck, UserCheck, XCircle } from 'lucide-react';
import Navbar from '@/components/public/Navbar';
import Footer from '@/components/public/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGames } from '@/hooks/useGames';

type CheckerResult = {
  success: boolean;
  username?: string;
  userId?: string;
  game?: string;
  avatar?: string;
  message?: string;
};

const fallbackGames = [
  'Mobile Legends',
  'Free Fire',
  'PUBG Mobile',
  'Genshin Impact',
  'Brawl Stars',
  'Clash of Clans',
  'Clash Royale',
];

const GameIdChecker: React.FC = () => {
  const { games } = useGames();
  const gameOptions = useMemo(() => {
    const activeGames = games.filter((game) => game.is_active !== false).map((game) => game.name);
    return activeGames.length > 0 ? activeGames : fallbackGames;
  }, [games]);

  const [game, setGame] = useState(gameOptions[0] || fallbackGames[0]);
  const [userId, setUserId] = useState('');
  const [region, setRegion] = useState('');
  const [result, setResult] = useState<CheckerResult | null>(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  React.useEffect(() => {
    if (!game && gameOptions.length > 0) {
      setGame(gameOptions[0]);
    }
  }, [game, gameOptions]);

  const handleCheck = async (event: React.FormEvent) => {
    event.preventDefault();
    setResult(null);
    setError('');

    if (!game.trim() || !userId.trim()) {
      setError('Choose a game and enter the player ID first.');
      return;
    }

    setChecking(true);

    try {
      const response = await fetch('/api/check-game-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game, userId, region }),
      });
      const data = await response.json();

      if (!response.ok && !data.success) {
        throw new Error(data.message || 'Unable to verify this ID right now.');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify this ID right now.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <Navbar />

      <main className="pb-16">
        <section className="relative overflow-hidden border-b border-slate-800/80 bg-slate-950 py-12 sm:py-16">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(124,58,237,0.22),transparent_36%),linear-gradient(45deg,rgba(34,211,238,0.10),transparent_36%)]" />
          <div className="container relative mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-200">
                <ShieldCheck className="h-4 w-4" />
                Player ID verification
              </div>
              <h1 className="text-4xl font-black leading-tight sm:text-5xl">Check a game ID before you top up.</h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                Verify supported player IDs and nicknames through the ID Game Checker API before submitting an order.
              </p>
            </div>
          </div>
        </section>

        <section className="container mx-auto grid grid-cols-1 gap-6 px-4 py-10 lg:grid-cols-[1fr_0.8fr]">
          <form onSubmit={handleCheck} className="rounded-3xl border border-slate-800 bg-slate-900/65 p-5 shadow-2xl shadow-slate-950/30 sm:p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-200">
                <Gamepad2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">ID checker</h2>
                <p className="text-sm text-slate-500">Game, ID, and optional server/region.</p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="checkerGame" className="text-slate-300">Game</Label>
                <select
                  id="checkerGame"
                  value={game}
                  onChange={(event) => setGame(event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-white outline-none transition-colors focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
                >
                  {gameOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="checkerUserId" className="text-slate-300">
                    <UserCheck className="mr-2 inline h-4 w-4" />
                    Player ID
                  </Label>
                  <Input
                    id="checkerUserId"
                    value={userId}
                    onChange={(event) => setUserId(event.target.value)}
                    placeholder="Example: 12345678"
                    className="h-12 border-slate-700 bg-slate-950 text-white placeholder:text-slate-600"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="checkerRegion" className="text-slate-300">
                    <Server className="mr-2 inline h-4 w-4" />
                    Server or region
                  </Label>
                  <Input
                    id="checkerRegion"
                    value={region}
                    onChange={(event) => setRegion(event.target.value)}
                    placeholder="Optional"
                    className="h-12 border-slate-700 bg-slate-950 text-white placeholder:text-slate-600"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={checking} className="h-12 w-full bg-violet-500 font-semibold text-white shadow-lg shadow-violet-950/30 hover:bg-violet-400">
                {checking ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Checking ID
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-5 w-5" />
                    Check player ID
                  </>
                )}
              </Button>
            </div>
          </form>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/45 p-5 shadow-xl shadow-slate-950/20 sm:p-6">
            <h2 className="text-xl font-bold">Verification result</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              A successful match returns the player nickname when the upstream game service supports it.
            </p>

            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
              {!result ? (
                <div className="flex min-h-44 flex-col items-center justify-center text-center text-slate-500">
                  <BadgeCheck className="mb-3 h-10 w-10 text-slate-700" />
                  Enter a player ID to verify it here.
                </div>
              ) : result.success ? (
                <div>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-sm font-medium text-emerald-200">
                    <BadgeCheck className="h-4 w-4" />
                    ID found
                  </div>
                  <dl className="space-y-4 text-sm">
                    <div>
                      <dt className="text-slate-500">Nickname</dt>
                      <dd className="mt-1 text-2xl font-bold text-white">{result.username || 'Verified player'}</dd>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                        <dt className="text-slate-500">Player ID</dt>
                        <dd className="mt-1 font-mono text-white">{result.userId || userId}</dd>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                        <dt className="text-slate-500">Game</dt>
                        <dd className="mt-1 text-white">{result.game || game}</dd>
                      </div>
                    </div>
                  </dl>
                </div>
              ) : (
                <div className="flex min-h-44 flex-col items-center justify-center text-center">
                  <XCircle className="mb-3 h-10 w-10 text-rose-300" />
                  <p className="font-semibold text-white">ID not found</p>
                  <p className="mt-2 text-sm text-slate-500">{result.message || 'Check the game, ID, and server details.'}</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default GameIdChecker;
