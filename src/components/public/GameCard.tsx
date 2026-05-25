import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ShieldCheck, Sparkles } from 'lucide-react';
import type { Game } from '@/types';

interface GameCardProps {
  game: Game;
}

export const GameCard: React.FC<GameCardProps> = ({ game }) => {
  return (
    <Link to={`/game/${game.$id}`} className="block h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
      <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-900/70 shadow-xl shadow-slate-950/25 transition-all duration-300 hover:-translate-y-1 hover:border-violet-400/60 hover:bg-slate-900 hover:shadow-2xl hover:shadow-violet-950/25">
        <div className="relative aspect-[4/3] overflow-hidden bg-slate-800">
          {game.image_url ? (
            <img
              src={game.image_url}
              alt={game.name}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
              <span className="text-4xl font-bold text-slate-700">{game.name.charAt(0)}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/15 to-transparent" />
          <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/75 px-2.5 py-1 text-xs font-medium text-emerald-300 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            Available
          </div>
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="line-clamp-1 text-lg font-bold text-white">{game.name}</p>
              <p className="mt-1 text-xs text-slate-300">Credits, diamonds, passes</p>
            </div>
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-violet-500 text-white shadow-lg shadow-violet-950/40">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-4 sm:p-5">
          <p className="line-clamp-2 min-h-10 text-sm leading-5 text-slate-400">
            {game.description || 'Top up your game credits instantly'}
          </p>
          
          <div className="mt-auto flex items-center justify-between pt-4">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <ShieldCheck className="h-4 w-4 text-cyan-300" />
              Secure order
            </span>
            <div className="flex items-center gap-1 text-sm font-semibold text-violet-300 transition-transform group-hover:translate-x-1">
              View packages
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-violet-500/8 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      </article>
    </Link>
  );
};
