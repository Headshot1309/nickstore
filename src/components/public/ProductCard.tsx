import React from 'react';
import { Check, Gem, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Product } from '@/types';
import { usePreference } from '@/contexts/PreferenceContext';

interface ProductCardProps {
  product: Product;
  isSelected: boolean;
  onSelect: () => void;
  gameImageUrl?: string;
  gameName?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isSelected,
  onSelect,
  gameImageUrl,
  gameName,
}) => {
  const { formatMoney } = usePreference();
  const hasDiscount = product.original_price && product.original_price > product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.original_price! - product.price) / product.original_price!) * 100)
    : 0;

  return (
    <button
      onClick={onSelect}
      className={cn(
        'relative min-h-36 w-full overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 focus:ring-offset-slate-950',
        isSelected
          ? 'border-violet-400 bg-violet-500/12 shadow-xl shadow-violet-950/30'
          : 'border-slate-800 bg-slate-900/70 shadow-lg shadow-slate-950/10 hover:-translate-y-0.5 hover:border-slate-700 hover:bg-slate-800/80'
      )}
    >
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-violet-500/10 blur-2xl" />

      {isSelected && (
        <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-violet-500">
          <Check className="h-3.5 w-3.5 text-white" />
        </div>
      )}

      {hasDiscount && (
        <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-rose-500 px-2.5 py-1 text-xs font-semibold text-white">
          <TrendingDown className="h-3 w-3" />
          -{discountPercent}%
        </div>
      )}

      <div className={cn('relative flex h-full flex-col', hasDiscount ? 'pt-9' : '')}>
        <div className="mb-4 flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-cyan-300/15 bg-cyan-300/10 text-cyan-200">
          {gameImageUrl ? (
            <img src={gameImageUrl} alt={gameName || product.game_name} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <Gem className="h-5 w-5" />
          )}
        </div>

        <div className="pr-8">
          <h4 className="font-semibold leading-snug text-white">{product.name}</h4>
          <p className="mt-1 text-sm leading-5 text-slate-400">{product.denomination}</p>
        </div>
        
        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-lg font-bold text-violet-400">
            {formatMoney(product.price)}
          </span>
            {hasDiscount && (
              <span className="text-sm text-slate-500 line-through">
                {formatMoney(product.original_price!)}
              </span>
            )}
          </div>
          <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', isSelected ? 'bg-violet-400 text-slate-950' : 'bg-slate-800 text-slate-300')}>
            {isSelected ? 'Selected' : 'Choose'}
          </span>
        </div>
      </div>
    </button>
  );
};
