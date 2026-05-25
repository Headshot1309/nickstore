import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, Filter, DownloadCloud, RefreshCw, PackageCheck, WalletCards, Gamepad2, Percent } from 'lucide-react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { useAdminProducts } from '@/hooks/useProducts';
import { useAdminGames } from '@/hooks/useGames';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { Product } from '@/types';

const Products: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { products, loading, createProduct, updateProduct, deleteProduct, applyMarkup, refresh } = useAdminProducts();
  const { games, loading: gamesLoading } = useAdminGames();
  const [searchQuery, setSearchQuery] = useState('');
  const [gameFilter, setGameFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    game_id: '',
    name: '',
    denomination: '',
    cost_price: '',
    markup_percent: '',
    price: '',
    original_price: '',
    is_active: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [importingCatalog, setImportingCatalog] = useState(false);
  const [bulkMarkup, setBulkMarkup] = useState('');
  const [applyingMarkup, setApplyingMarkup] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/admin/login');
    }
  }, [isAuthenticated, navigate]);

  // Set default game when games load
  useEffect(() => {
    if (games.length > 0 && !formData.game_id && !editingProduct) {
      setFormData(prev => ({ ...prev, game_id: games[0].$id! }));
    }
  }, [games, editingProduct]);

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      searchQuery === '' ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.denomination.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesGame = gameFilter === 'all' || product.game_id === gameFilter;

    return matchesSearch && matchesGame;
  });

  const activeProducts = products.filter((product) => product.is_active).length;
  const averagePrice = products.length > 0
    ? products.reduce((sum, product) => sum + Number(product.price || 0), 0) / products.length
    : 0;

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        game_id: product.game_id,
        name: product.name,
        denomination: product.denomination,
        cost_price: (product.cost_price ?? product.market_reference?.observed_price ?? product.price).toString(),
        markup_percent: (product.markup_percent ?? 0).toString(),
        price: product.price.toString(),
        original_price: product.original_price?.toString() || '',
        is_active: product.is_active,
      });
    } else {
      setEditingProduct(null);
      setFormData({
        game_id: games[0]?.$id || '',
        name: '',
        denomination: '',
        cost_price: '',
        markup_percent: '',
        price: '',
        original_price: '',
        is_active: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const game = games.find((g) => g.$id === formData.game_id);
    const costPrice = parseFloat(formData.cost_price || formData.price || '0');
    const markupPercent = parseFloat(formData.markup_percent || '0');
    const sellingPrice = formData.markup_percent
      ? Number((costPrice * (1 + markupPercent / 100)).toFixed(2))
      : parseFloat(formData.price);

    const data = {
      game_id: formData.game_id,
      game_name: game?.name || '',
      name: formData.name,
      denomination: formData.denomination,
      cost_price: Number.isFinite(costPrice) ? costPrice : undefined,
      markup_percent: Number.isFinite(markupPercent) ? markupPercent : undefined,
      price: sellingPrice,
      original_price: formData.original_price ? parseFloat(formData.original_price) : undefined,
      is_active: formData.is_active,
    };

    try {
      if (editingProduct) {
        await updateProduct(editingProduct.$id!, data);
      } else {
        await createProduct(data);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving product:', err);
      alert(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (productToDelete) {
      try {
        await deleteProduct(productToDelete.$id!);
        setDeleteConfirmOpen(false);
        setProductToDelete(null);
      } catch (err) {
        console.error('Error deleting product:', err);
        alert(err instanceof Error ? err.message : 'Failed to delete product');
      }
    }
  };

  const handleImportMarketCatalog = async () => {
    setImportingCatalog(true);
    try {
      const response = await fetch('/api/catalog/seed-market', { method: 'POST' });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to import catalog');
      }

      alert(data.message || 'Catalog imported.');
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to import catalog');
    } finally {
      setImportingCatalog(false);
    }
  };

  const handleApplyMarkup = async (scope: 'all' | 'game') => {
    const markupPercent = parseFloat(bulkMarkup);
    if (!Number.isFinite(markupPercent) || markupPercent < 0) {
      alert('Enter a valid markup percent first.');
      return;
    }

    if (scope === 'game' && gameFilter === 'all') {
      alert('Choose one game in the filter first, then apply game markup.');
      return;
    }

    setApplyingMarkup(true);
    try {
      const result = await applyMarkup({
        scope,
        markup_percent: markupPercent,
        game_id: scope === 'game' ? gameFilter : undefined,
      });
      alert(result.message || 'Markup updated.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update markup');
    } finally {
      setApplyingMarkup(false);
    }
  };

  const getCostPrice = (product: Product) => Number(product.cost_price ?? product.market_reference?.observed_price ?? product.price ?? 0);

  const confirmDelete = (product: Product) => {
    setProductToDelete(product);
    setDeleteConfirmOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return `RM ${amount.toFixed(2)}`;
  };

  if (!isAuthenticated) return null;

  const isLoading = loading || gamesLoading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <AdminSidebar />

      <main className="lg:ml-64 min-h-screen">
        <div className="h-16 lg:hidden" />

        <div className="p-4 sm:p-6">
          {/* Header */}
          <div className="mb-6 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/65 shadow-xl shadow-black/20">
            <div className="h-1 bg-gradient-to-r from-amber-400 via-violet-400 to-cyan-400" />
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Catalog control</p>
              <h1 className="mt-2 text-2xl font-bold text-white">Products</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                Manage denominations, MYR pricing, and active storefront packages from one fast mobile-friendly view.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:flex">
              <Button
                onClick={handleImportMarketCatalog}
                variant="outline"
                className="border-cyan-400/40 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20"
                disabled={importingCatalog}
              >
                {importingCatalog ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <DownloadCloud className="mr-2 h-4 w-4" />}
                Import MYR Catalog
              </Button>
              <Button
                onClick={() => handleOpenModal()}
                className="bg-violet-500 hover:bg-violet-600 text-white"
                disabled={games.length === 0}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </div>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Total products</span>
                <PackageCheck className="h-5 w-5 text-violet-300" />
              </div>
              <p className="mt-2 text-2xl font-bold text-white">{products.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Active storefront</span>
                <Gamepad2 className="h-5 w-5 text-emerald-300" />
              </div>
              <p className="mt-2 text-2xl font-bold text-white">{activeProducts}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Average price</span>
                <WalletCards className="h-5 w-5 text-cyan-300" />
              </div>
              <p className="mt-2 text-2xl font-bold text-white">{formatCurrency(averagePrice)}</p>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-violet-400/20 bg-violet-500/10 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-violet-100">
                  <Percent className="h-4 w-4" />
                  <h2 className="font-semibold">Markup controls</h2>
                </div>
                <p className="mt-1 text-sm text-slate-400">
                  Customers only see the final selling price. Supplier cost stays in admin for profit control.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[160px_auto_auto]">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={bulkMarkup}
                  onChange={(event) => setBulkMarkup(event.target.value)}
                  placeholder="Markup %"
                  className="bg-slate-950/70 border-slate-700 text-white"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleApplyMarkup('game')}
                  disabled={applyingMarkup || gameFilter === 'all'}
                  className="border-violet-400/30 bg-violet-400/10 text-violet-100 hover:bg-violet-400/20"
                >
                  {applyingMarkup ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Percent className="mr-2 h-4 w-4" />}
                  Set Filtered Game
                </Button>
                <Button
                  type="button"
                  onClick={() => handleApplyMarkup('all')}
                  disabled={applyingMarkup}
                  className="bg-violet-500 text-white hover:bg-violet-600"
                >
                  {applyingMarkup ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Percent className="mr-2 h-4 w-4" />}
                  Set All Products
                </Button>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/55 p-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-900/50 border-slate-700 text-white"
              />
            </div>
            <Select value={gameFilter} onValueChange={setGameFilter}>
              <SelectTrigger className="w-full sm:w-48 bg-slate-900/50 border-slate-700 text-white">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by game" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                <SelectItem value="all">All Games</SelectItem>
                {games.map((game) => (
                  <SelectItem key={game.$id} value={game.$id!}>
                    {game.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          </div>

          {/* Products Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" className="text-violet-500" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              title="No products found"
              description="Start by adding your first product."
              action={
                <Button
                  onClick={() => handleOpenModal()}
                  className="bg-violet-500 hover:bg-violet-600"
                  disabled={games.length === 0}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Product
                </Button>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl shadow-black/15">
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left p-4 text-slate-400 font-medium">Game</th>
                      <th className="text-left p-4 text-slate-400 font-medium">Name</th>
                      <th className="text-left p-4 text-slate-400 font-medium">Denomination</th>
                      <th className="text-left p-4 text-slate-400 font-medium">Selling Price</th>
                      <th className="text-left p-4 text-slate-400 font-medium">Cost / Markup</th>
                      <th className="text-left p-4 text-slate-400 font-medium">Status</th>
                      <th className="text-right p-4 text-slate-400 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr key={product.$id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="p-4 text-slate-300">{product.game_name}</td>
                        <td className="p-4 text-white font-medium">{product.name}</td>
                        <td className="p-4 text-slate-300">{product.denomination}</td>
                        <td className="p-4">
                          <span className="text-violet-400 font-medium">
                            {formatCurrency(product.price)}
                          </span>
                          {product.original_price && (
                            <span className="text-slate-500 line-through ml-2 text-sm">
                              {formatCurrency(product.original_price)}
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          {product.cost_price || product.market_reference ? (
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 text-xs font-medium text-cyan-200">
                                  Cost {formatCurrency(getCostPrice(product))}
                                </span>
                                {product.markup_percent !== undefined && (
                                  <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-200">
                                    +{product.markup_percent}%
                                  </span>
                                )}
                              </div>
                              {product.market_reference?.source && (
                                <p className="mt-1 text-xs text-slate-500">
                                  {product.market_reference.source}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-600">Manual</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              product.is_active
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-slate-500/10 text-slate-400'
                            }`}
                          >
                            {product.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-white"
                              onClick={() => handleOpenModal(product)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-red-400"
                              onClick={() => confirmDelete(product)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-3 p-3 md:hidden">
                {filteredProducts.map((product) => (
                  <div key={product.$id} className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">{product.game_name}</p>
                        <h3 className="mt-1 truncate font-semibold text-white">{product.name}</h3>
                        <p className="mt-1 text-sm text-slate-400">{product.denomination}</p>
                        {product.market_reference && (
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 font-medium text-cyan-200">
                              Cost {formatCurrency(getCostPrice(product))}
                            </span>
                            {product.markup_percent !== undefined && (
                              <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 font-medium text-amber-200">
                                +{product.markup_percent}%
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
                          product.is_active ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-500/10 text-slate-400'
                        }`}
                      >
                        {product.is_active ? 'Active' : 'Off'}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <div>
                        <p className="text-lg font-bold text-violet-300">{formatCurrency(product.price)}</p>
                        {product.original_price && (
                          <p className="text-xs text-slate-500 line-through">{formatCurrency(product.original_price)}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white" onClick={() => handleOpenModal(product)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-400" onClick={() => confirmDelete(product)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {editingProduct ? 'Update the product details below.' : 'Fill in the details to add a new product.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="game">Game</Label>
              <Select
                value={formData.game_id}
                onValueChange={(value) => setFormData({ ...formData, game_id: value })}
              >
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                  <SelectValue placeholder="Select game" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {games.map((game) => (
                    <SelectItem key={game.$id} value={game.$id!}>
                      {game.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Product Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., 100 Diamonds"
                className="bg-slate-900 border-slate-700 text-white"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="denomination">Denomination</Label>
              <Input
                id="denomination"
                value={formData.denomination}
                onChange={(e) => setFormData({ ...formData, denomination: e.target.value })}
                placeholder="e.g., 100 Diamonds + 10 Bonus"
                className="bg-slate-900 border-slate-700 text-white"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cost_price">Supplier Cost (RM)</Label>
                <Input
                  id="cost_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cost_price}
                  onChange={(e) => {
                    const cost = parseFloat(e.target.value || '0');
                    const markup = parseFloat(formData.markup_percent || '0');
                    const price = formData.markup_percent ? (cost * (1 + markup / 100)).toFixed(2) : formData.price;
                    setFormData({ ...formData, cost_price: e.target.value, price });
                  }}
                  placeholder="0.00"
                  className="bg-slate-900 border-slate-700 text-white"
                />
                <p className="text-xs text-slate-500">Admin-only. Customers never see this.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="markup_percent">Markup %</Label>
                <Input
                  id="markup_percent"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.markup_percent}
                  onChange={(e) => {
                    const cost = parseFloat(formData.cost_price || formData.price || '0');
                    const markup = parseFloat(e.target.value || '0');
                    const price = e.target.value ? (cost * (1 + markup / 100)).toFixed(2) : formData.price;
                    setFormData({ ...formData, markup_percent: e.target.value, price });
                  }}
                  placeholder="0"
                  className="bg-slate-900 border-slate-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Selling / Promo Price (RM)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                  className="bg-slate-900 border-slate-700 text-white"
                  required
                />
                <p className="text-xs text-slate-500">This is the price customers pay.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="original_price">Old Price for Promo (Optional)</Label>
                <Input
                  id="original_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.original_price}
                  onChange={(e) => setFormData({ ...formData, original_price: e.target.value })}
                  placeholder="0.00"
                  className="bg-slate-900 border-slate-700 text-white"
                />
                <p className="text-xs text-slate-500">Shows crossed out next to promo price.</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active" className="cursor-pointer">
                Active
              </Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 border-slate-700 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-violet-500 hover:bg-violet-600 text-white"
              >
                {submitting ? 'Saving...' : editingProduct ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="bg-slate-950 border-slate-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to delete "{productToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 text-white border-slate-700 hover:bg-slate-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Products;
