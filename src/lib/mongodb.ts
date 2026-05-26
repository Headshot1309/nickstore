type CollectionName = 'games' | 'products' | 'orders' | 'payment-methods';

interface ApiListResponse<T = any> {
  documents: T[];
  total?: number;
}

interface StoredAdminSession {
  user: { $id: string; email: string; name: string };
  token: string;
  lastActivityAt: number;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const makeId = (prefix = 'id') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const fallbackGames = [
  {
    $id: 'mobile-legends',
    name: 'Mobile Legends',
    description: 'Fast diamonds top-up for MLBB players in Malaysia.',
    image_id: '',
    image_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=900&q=80',
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    $id: 'free-fire',
    name: 'Free Fire',
    description: 'Instant Garena Free Fire diamonds with secure payment.',
    image_id: '',
    image_url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=900&q=80',
    is_active: true,
    created_at: '2026-01-02T00:00:00.000Z',
  },
  {
    $id: 'pubg-mobile',
    name: 'PUBG Mobile',
    description: 'UC packages delivered quickly after payment confirmation.',
    image_id: '',
    image_url: 'https://images.unsplash.com/photo-1560253023-3ec5d502959f?auto=format&fit=crop&w=900&q=80',
    is_active: true,
    created_at: '2026-01-03T00:00:00.000Z',
  },
  {
    $id: 'genshin-impact',
    name: 'Genshin Impact',
    description: 'Genesis Crystals and Welkin options for smooth adventuring.',
    image_id: '',
    image_url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=900&q=80',
    is_active: true,
    created_at: '2026-01-04T00:00:00.000Z',
  },
];

const fallbackProducts = [
  { $id: 'mlbb-86', game_id: 'mobile-legends', game_name: 'Mobile Legends', name: '86 Diamonds', denomination: '86 Diamonds', price: 5.9, original_price: 6.9, is_active: true },
  { $id: 'mlbb-172', game_id: 'mobile-legends', game_name: 'Mobile Legends', name: '172 Diamonds', denomination: '172 Diamonds', price: 11.7, original_price: 13.0, is_active: true },
  { $id: 'ff-100', game_id: 'free-fire', game_name: 'Free Fire', name: '100 Diamonds', denomination: '100 Diamonds', price: 4.8, is_active: true },
  { $id: 'pubg-60', game_id: 'pubg-mobile', game_name: 'PUBG Mobile', name: '60 UC', denomination: '60 UC', price: 4.5, is_active: true },
  { $id: 'genshin-welkin', game_id: 'genshin-impact', game_name: 'Genshin Impact', name: 'Blessing of the Welkin Moon', denomination: '30 days', price: 19.9, is_active: true },
];

const fallbackPaymentMethods = [
  {
    $id: 'touch-n-go',
    name: 'Touch n Go eWallet',
    type: 'e_wallet',
    description: 'Pay securely using TNG eWallet QR or transfer.',
    account_name: 'NickStore',
    account_number: '60197661697',
    is_active: true,
    sort_order: 1,
  },
  {
    $id: 'bank-transfer',
    name: 'Bank Transfer',
    type: 'bank_transfer',
    description: 'Transfer to our bank account and upload your receipt.',
    account_name: 'NickStore',
    account_number: '60197661697',
    is_active: true,
    sort_order: 2,
  },
];

const localOrdersKey = 'nickstore_orders';
const adminSessionKey = 'adminSession';
const ADMIN_IDLE_TIMEOUT_MS = 10 * 60 * 1000;

const readLocalOrders = () => {
  try {
    return JSON.parse(localStorage.getItem(localOrdersKey) || '[]');
  } catch {
    return [];
  }
};

const writeLocalOrders = (orders: any[]) => {
  localStorage.setItem(localOrdersKey, JSON.stringify(orders));
};

const readAdminSession = (): StoredAdminSession | null => {
  try {
    const session = localStorage.getItem(adminSessionKey);
    return session ? JSON.parse(session) : null;
  } catch {
    localStorage.removeItem(adminSessionKey);
    return null;
  }
};

export const apiRequest = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const adminSession = readAdminSession();
  const headers = new Headers(options?.headers);
  headers.set('Content-Type', headers.get('Content-Type') || 'application/json');
  if (adminSession?.token) {
    headers.set('Authorization', `Bearer ${adminSession.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.message || errorBody?.error || `Request failed: ${response.status}`);
  }

  return response.json();
};

const listFromApi = async <T>(collection: CollectionName, fallback: T[], query = ''): Promise<ApiListResponse<T>> => {
  try {
    const response = await apiRequest<ApiListResponse<T>>(`/api/${collection}${query}`);
    const documents = Array.isArray(response.documents) ? response.documents : [];
    return { documents, total: response.total ?? documents.length };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`Using local fallback for ${collection}:`, error);
    }
    return { documents: fallback, total: fallback.length };
  }
};

const mutation = async <T>(path: string, method: string, data?: any, fallback?: () => T): Promise<T> => {
  try {
    return await apiRequest<T>(path, {
      method,
      body: data ? JSON.stringify(data) : undefined,
    });
  } catch (error) {
    if (fallback) return fallback();
    throw error;
  }
};

export const mongodbConfig = {
  projectId: 'browser-api',
  databaseId: 'gaming_store',
  collections: {
    games: 'games',
    products: 'products',
    orders: 'orders',
    paymentMethods: 'payment_methods',
    admins: 'admins',
  },
  buckets: {
    storage: 'files',
  },
};

export const appwriteConfig = mongodbConfig;

export const gamesCollection = {
  list: async () => listFromApi('games', fallbackGames),
  get: async (gameId: string) => {
    const response = await gamesCollection.list();
    return response.documents.find((game: any) => game.$id === gameId || game.id === gameId) || null;
  },
  create: async (data: any) =>
    mutation('/api/games', 'POST', data, () => ({ ...data, $id: makeId('game'), created_at: new Date().toISOString() })),
  update: async (gameId: string, data: any) =>
    mutation(`/api/games/${gameId}`, 'PUT', data, () => ({ ...data, $id: gameId, updated_at: new Date().toISOString() })),
  delete: async (gameId: string) => mutation(`/api/games/${gameId}`, 'DELETE', undefined, () => ({ success: true })),
};

export const productsCollection = {
  list: async (gameId?: string) => {
    const fallback = gameId ? fallbackProducts.filter((product) => product.game_id === gameId) : fallbackProducts;
    const query = gameId ? `?game_id=${encodeURIComponent(gameId)}` : '';
    return listFromApi('products', fallback, query);
  },
  get: async (productId: string) => {
    const response = await productsCollection.list();
    return response.documents.find((product: any) => product.$id === productId || product.id === productId) || null;
  },
  create: async (data: any) =>
    mutation('/api/products', 'POST', data, () => ({ ...data, $id: makeId('product'), created_at: new Date().toISOString() })),
  update: async (productId: string, data: any) =>
    mutation(`/api/products/${productId}`, 'PUT', data, () => ({ ...data, $id: productId, updated_at: new Date().toISOString() })),
  delete: async (productId: string) => mutation(`/api/products/${productId}`, 'DELETE', undefined, () => ({ success: true })),
  applyMarkup: async (data: { scope: 'all' | 'game' | 'product'; markup_percent: number; game_id?: string; product_id?: string }) =>
    mutation('/api/catalog/markup', 'POST', data, () => ({ success: true, updated_products: 0, message: 'Markup updated.' })),
};

const saveAdminSession = (user: { $id: string; email: string; name: string }, token: string) => {
  localStorage.setItem(adminSessionKey, JSON.stringify({
    user,
    token,
    lastActivityAt: Date.now(),
  }));
};

export const touchAdminSession = () => {
  const session = localStorage.getItem(adminSessionKey);
  if (!session) return;

  try {
    const parsed = JSON.parse(session);
    localStorage.setItem(adminSessionKey, JSON.stringify({
      ...parsed,
      lastActivityAt: Date.now(),
    }));
  } catch {
    localStorage.removeItem(adminSessionKey);
  }
};

export const settingsCollection = {
  getPublic: async () =>
    apiRequest<{ receipt_checker_enabled: boolean }>('/api/settings/public'),
  updateReceiptChecker: async (enabled: boolean) =>
    mutation('/api/settings/receipt-checker', 'PUT', { enabled }, () => ({
      success: true,
      receipt_checker_enabled: enabled,
    })),
};

export const ordersCollection = {
  list: async (status?: string) => {
    const localOrders = readLocalOrders();
    const fallback = status ? localOrders.filter((order: any) => order.status === status) : localOrders;
    return listFromApi('orders', fallback, status ? `?status=${encodeURIComponent(status)}` : '');
  },
  get: async (orderId: string) => {
    const response = await ordersCollection.list();
    return response.documents.find((order: any) => order.$id === orderId || order.id === orderId) || null;
  },
  getByOrderNumber: async (orderNumber: string) => {
    const response = await listFromApi('orders', readLocalOrders(), `?order_number=${encodeURIComponent(orderNumber)}`);
    return response.documents.find((order: any) => order.order_number === orderNumber) || null;
  },
  create: async (data: any) =>
    mutation('/api/orders', 'POST', data, () => {
      const order = { ...data, $id: makeId('order') };
      const orders = [order, ...readLocalOrders()];
      writeLocalOrders(orders);
      return order;
    }),
  update: async (orderId: string, data: any) =>
    mutation(`/api/orders/${orderId}`, 'PUT', data, () => {
      const orders = readLocalOrders().map((order: any) => (order.$id === orderId ? { ...order, ...data } : order));
      writeLocalOrders(orders);
      return orders.find((order: any) => order.$id === orderId) || { ...data, $id: orderId };
    }),
  delete: async (orderId: string) =>
    mutation(`/api/orders/${orderId}`, 'DELETE', undefined, () => {
      writeLocalOrders(readLocalOrders().filter((order: any) => order.$id !== orderId));
      return { success: true };
    }),
  subscribe: (_callback: (payload: any) => void) => () => {},
};

export const paymentMethodsCollection = {
  list: async (active?: boolean) => {
    const fallback = active === undefined ? fallbackPaymentMethods : fallbackPaymentMethods.filter((method) => method.is_active === active);
    return listFromApi('payment-methods', fallback);
  },
  get: async (methodId: string) => {
    const response = await paymentMethodsCollection.list();
    return response.documents.find((method: any) => method.$id === methodId || method.id === methodId) || null;
  },
  create: async (data: any) =>
    mutation('/api/payment-methods', 'POST', data, () => ({ ...data, $id: makeId('payment'), created_at: new Date().toISOString() })),
  update: async (methodId: string, data: any) =>
    mutation(`/api/payment-methods/${methodId}`, 'PUT', data, () => ({ ...data, $id: methodId, updated_at: new Date().toISOString() })),
  delete: async (methodId: string) => mutation(`/api/payment-methods/${methodId}`, 'DELETE', undefined, () => ({ success: true })),
};

export const adminsCollection = {
  getByEmail: async (email: string) => ({
    $id: 'admin1',
    email: email.toLowerCase(),
    username: 'admin',
    role: 'admin',
  }),
};

export const storageHelpers = {
  uploadFile: async (file: File, prefix?: string): Promise<any> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const fileId = prefix ? `${prefix}_${Date.now()}` : `file_${Date.now()}`;
        resolve({
          $id: fileId,
          name: file.name,
          size: file.size,
          type: file.type,
          data: reader.result,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }),
  getFileView: (fileId: string): string => `/api/files/${fileId}`,
  getFilePreview: (fileId: string): string => `/api/files/${fileId}`,
  deleteFile: async (_fileId: string): Promise<any> => ({ success: true }),
};

export const generateOrderNumber = (): string => {
  const prefix = 'ORD';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

export const account = {
  get: async () => {
    const parsed = readAdminSession();
    if (parsed) {
      if (!parsed?.user || Date.now() - Number(parsed.lastActivityAt || 0) > ADMIN_IDLE_TIMEOUT_MS) {
        localStorage.removeItem(adminSessionKey);
        throw new Error('Session expired');
      }
      return parsed.user;
    }
    throw new Error('No session found');
  },
  createEmailPasswordSession: async (email: string, password: string) => {
    const response = await apiRequest<{
      success: boolean;
      user?: { $id: string; email: string; name: string };
      session_token?: string;
      requires_2fa?: boolean;
      challenge_id?: string;
      message?: string;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.requires_2fa && response.challenge_id) {
      return {
        requires2fa: true,
        challengeId: response.challenge_id,
        message: response.message,
      };
    }

    if (!response.success || !response.user || !response.session_token) {
      throw new Error(response.message || 'Invalid credentials');
    }

    saveAdminSession(response.user, response.session_token);
    return response.user;
  },
  verifyEmailCode: async (challengeId: string, code: string) => {
    const response = await apiRequest<{ success: boolean; user?: { $id: string; email: string; name: string }; session_token?: string; message?: string }>('/api/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({ challenge_id: challengeId, code }),
    });

    if (!response.success || !response.user || !response.session_token) {
      throw new Error(response.message || 'Invalid verification code');
    }

    saveAdminSession(response.user, response.session_token);
    return response.user;
  },
  deleteSession: async (_sessionId: string) => {
    localStorage.removeItem(adminSessionKey);
    return { success: true };
  },
};

export const ObjectId = class {
  private value: string;

  constructor(value = makeId('object')) {
    this.value = value;
  }

  toString() {
    return this.value;
  }
};

export const ID = {
  unique: () => makeId('id'),
};

export const Query = {
  equal: (field: string, value: any) => ({ [field]: value }),
};
