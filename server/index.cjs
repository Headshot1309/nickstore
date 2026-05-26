const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Blob } = require('buffer');
const { MongoClient, ObjectId } = require('mongodb');
const nodemailer = require('nodemailer');
const { marketCatalogGames, marketCatalogProducts } = require('./catalog-seed.cjs');
const app = express();
const port = 3001;

app.disable('x-powered-by');

const allowedOrigins = new Set([
  'https://nickstore-iota.vercel.app',
  'https://nickstore-headshot1309-8399s-projects.vercel.app',
  'https://nickstore-git-main-headshot1309-8399s-projects.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
]);

const rateLimitBuckets = new Map();
const createRateLimiter = ({ windowMs, max, keyPrefix }) => (req, res, next) => {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '');
  const ip = forwardedFor.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  const key = `${keyPrefix}:${ip}`;
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key) || { count: 0, resetAt: now + windowMs };

  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }

  bucket.count += 1;
  rateLimitBuckets.set(key, bucket);

  if (bucket.count > max) {
    return res.status(429).json({ success: false, message: 'Too many requests. Please try again later.' });
  }

  next();
};

const authRateLimit = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 20, keyPrefix: 'auth' });
const orderRateLimit = createRateLimiter({ windowMs: 60 * 1000, max: 12, keyPrefix: 'order' });
const customerAuthRateLimit = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 12, keyPrefix: 'customer-auth' });

app.set('trust proxy', 1);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }
    callback(new Error('CORS origin blocked'));
  },
}));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});
app.use(express.json({ limit: '15mb' }));
app.use(express.text({ type: ['text/*', 'application/csv'], limit: '10mb' }));

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
const dbName = 'gaming_store';

let db;

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;
const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
const adminPassword = process.env.ADMIN_PASSWORD;
const adminTwoFactorEnabled = process.env.ADMIN_2FA_ENABLED === 'true';
const adminSessionTtlMs = 10 * 60 * 1000;
const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  from: process.env.SMTP_FROM || process.env.SMTP_USER || adminEmail,
};

const hasSmtpConfig = () => Boolean(smtpConfig.host && smtpConfig.user && smtpConfig.pass);

const hashAdminCode = (code, challengeId) =>
  crypto
    .createHash('sha256')
    .update(`${code}:${challengeId}:${adminPassword || ''}`)
    .digest('hex');

const createVerificationCode = () => String(crypto.randomInt(100000, 1000000));

const safeString = (value, maxLength = 500) => {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).trim().slice(0, maxLength);
};

const normalizeEmail = (value) => safeString(value, 254).toLowerCase();

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const sendAdminVerificationEmail = async (code) => {
  if (!hasSmtpConfig()) {
    throw new Error('Email 2FA is enabled but SMTP email is not configured');
  }

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.port === 465,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
  });

  await transporter.sendMail({
    from: smtpConfig.from,
    to: adminEmail,
    subject: 'NickStore admin login code',
    text: `Your NickStore admin verification code is ${code}. It expires in 10 minutes.`,
    html: `<p>Your NickStore admin verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`,
  });
};

const sendVerificationEmail = async ({ to, subject, title, code, extraText = '' }) => {
  if (!hasSmtpConfig()) {
    throw new Error('SMTP email is not configured');
  }

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.port === 465,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
  });

  await transporter.sendMail({
    from: smtpConfig.from,
    to,
    subject,
    text: `${title}: ${code}. This code expires in 10 minutes. ${extraText}`.trim(),
    html: `<p>${escapeTelegramHtml(title)}: <strong>${escapeTelegramHtml(code)}</strong></p><p>This code expires in 10 minutes.</p>${extraText ? `<p>${escapeTelegramHtml(extraText)}</p>` : ''}`,
  });
};

const createAdmin2faChallenge = async () => {
  const database = await getDb();
  const challengeId = crypto.randomUUID();
  const code = createVerificationCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

  await database.collection('admin_2fa_challenges').insertOne({
    challengeId,
    email: adminEmail.toLowerCase(),
    codeHash: hashAdminCode(code, challengeId),
    used: false,
    createdAt: now,
    expiresAt,
  });

  await sendAdminVerificationEmail(code);
  return challengeId;
};

const escapeTelegramHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const formatCurrency = (amount) => {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `RM ${(numericAmount || 0).toFixed(2)}`;
};

const generateOrderNumber = () =>
  `ORD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

const normalizeCatalogSlug = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const parseCsvLine = (line) => {
  const cells = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
};

const parseSupplierPricelist = (csvText) => {
  const rows = String(csvText || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const productsByKey = new Map();

  for (const row of rows) {
    if (/^game,page,no,item,price rm,code$/i.test(row)) continue;

    const [gameRaw, page, no, item, priceRaw, code] = parseCsvLine(row);
    let gameKey = normalizeCatalogSlug(gameRaw);
    const price = Number.parseFloat(String(priceRaw || '').replace(/[^\d.]/g, ''));
    const supplierCode = String(code || '').trim();

    if (!gameKey || !item || !Number.isFinite(price) || !supplierCode) continue;

    if (gameKey === 'valo') {
      if (/^VPID/i.test(supplierCode)) {
        gameKey = 'valorant-id';
      } else if (/^VPMY/i.test(supplierCode)) {
        gameKey = 'valorant-my';
      }
    }

    productsByKey.set(`${gameKey}:${supplierCode}`, {
      gameKey,
      name: item.trim(),
      denomination: item.trim(),
      price,
      supplier_code: supplierCode,
      provider_slug: gameKey,
      source_page: page || '',
      sort_order: Number.parseInt(no, 10) || 0,
    });
  }

  return Array.from(productsByKey.values());
};

const applyMarkup = (costPrice, markupPercent = 0) => {
  const cost = Number(costPrice || 0);
  const markup = Number(markupPercent || 0);
  return Number((cost * (1 + markup / 100)).toFixed(2));
};

const getProductCost = (product) =>
  Number(product.cost_price ?? product.market_reference?.observed_price ?? product.price ?? 0);

const isSupplierPricelistProduct = (product) =>
  product?.market_reference?.source === 'Topup_Kryz_bot' || Boolean(product?.supplier_code);

const hashAdminSessionToken = (token) =>
  crypto.createHash('sha256').update(`${token}:${adminPassword || ''}`).digest('hex');

const hashCustomerSessionToken = (token) =>
  crypto.createHash('sha256').update(`${token}:${process.env.CUSTOMER_SESSION_SECRET || adminPassword || 'nickstore'}`).digest('hex');

const createAdminSession = async () => {
  const database = await getDb();
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();

  await database.collection('admin_sessions').insertOne({
    tokenHash: hashAdminSessionToken(token),
    email: adminEmail.toLowerCase(),
    createdAt: now,
    lastActivityAt: now,
    expiresAt: new Date(now.getTime() + adminSessionTtlMs),
  });

  return token;
};

const getBearerToken = (req) => {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] || '';
};

const sanitizeCustomer = (customer) => ({
  $id: customer._id.toString(),
  name: customer.name,
  email: customer.email,
  phone: customer.phone || '',
  created_at: customer.created_at,
});

const createCustomerSession = async (customerId) => {
  const database = await getDb();
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();

  await database.collection('customer_sessions').insertOne({
    tokenHash: hashCustomerSessionToken(token),
    customer_id: customerId,
    createdAt: now,
    lastActivityAt: now,
    expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
  });

  return token;
};

const createCustomerChallenge = async ({ customerId, email, purpose, nextPasswordHash = '' }) => {
  const database = await getDb();
  const challengeId = crypto.randomUUID();
  const code = createVerificationCode();
  const now = new Date();

  await database.collection('customer_2fa_challenges').insertOne({
    challengeId,
    customer_id: customerId,
    email,
    purpose,
    codeHash: hashAdminCode(code, challengeId),
    nextPasswordHash,
    used: false,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
  });

  await sendVerificationEmail({
    to: email,
    subject: purpose === 'reset' ? 'NickStore password reset code' : 'NickStore login code',
    title: purpose === 'reset' ? 'Your NickStore password reset code' : 'Your NickStore verification code',
    code,
  });

  return challengeId;
};

const getCustomerToken = (req) => safeString(req.headers['x-customer-session'], 256);

const getCustomerSessionFromRequest = async (req) => {
  const token = getCustomerToken(req);
  if (!token) return null;

  const database = await getDb();
  const now = new Date();
  const session = await database.collection('customer_sessions').findOne({
    tokenHash: hashCustomerSessionToken(token),
    expiresAt: { $gt: now },
  });

  if (!session) return null;

  await database.collection('customer_sessions').updateOne(
    { _id: session._id },
    {
      $set: {
        lastActivityAt: now,
        expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    }
  );

  return session;
};

const requireCustomer = async (req, res, next) => {
  try {
    const session = await getCustomerSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ success: false, message: 'Please sign in again.' });
    }
    req.customerSession = session;
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAdminSessionFromRequest = async (req) => {
  const token = getBearerToken(req);
  if (!token || !adminPassword) return null;

  const database = await getDb();
  const now = new Date();
  const tokenHash = hashAdminSessionToken(token);
  const session = await database.collection('admin_sessions').findOne({
    tokenHash,
    email: adminEmail.toLowerCase(),
    expiresAt: { $gt: now },
  });

  if (!session) return null;

  await database.collection('admin_sessions').updateOne(
    { _id: session._id },
    {
      $set: {
        lastActivityAt: now,
        expiresAt: new Date(now.getTime() + adminSessionTtlMs),
      },
    }
  );

  return session;
};

const requireAdmin = async (req, res, next) => {
  try {
    const session = await getAdminSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ success: false, message: 'Admin session expired. Please sign in again.' });
    }
    req.adminSession = session;
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const sanitizeGame = (doc) => ({
  ...withGameLogo(doc),
  $id: doc._id.toString(),
});

const sanitizePublicProduct = (doc) => ({
  _id: doc._id,
  $id: doc._id.toString(),
  game_id: doc.game_id,
  game_name: doc.game_name,
  name: doc.name,
  denomination: doc.denomination,
  price: doc.price,
  original_price: doc.original_price,
  is_active: doc.is_active,
  created_at: doc.created_at,
  updated_at: doc.updated_at,
});

const normalizePopularRows = (rows = []) =>
  rows.map((row, index) => ({
    rank: index + 1,
    game_id: String(row._id?.game_id || row.game_id || ''),
    game_name: String(row._id?.game_name || row.game_name || 'Unknown Game'),
    order_count: Number(row.order_count || 0),
    total_spend: Number(row.total_spend || 0),
  }));

const gameLogoPalettes = [
  ['#7c3aed', '#06b6d4'],
  ['#dc2626', '#f97316'],
  ['#16a34a', '#84cc16'],
  ['#2563eb', '#a855f7'],
  ['#f59e0b', '#ef4444'],
  ['#0f766e', '#22d3ee'],
  ['#be123c', '#f472b6'],
  ['#4338ca', '#38bdf8'],
];

const getInitials = (name = '') =>
  String(name)
    .split(/[\s:()-]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0]?.toUpperCase())
    .join('');

const buildGameLogoDataUrl = (game = {}) => {
  const name = String(game.name || game.game_name || 'NickStore');
  const slug = String(game.provider_slug || game.key || name).toLowerCase();
  const hash = [...slug].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const [from, to] = gameLogoPalettes[hash % gameLogoPalettes.length];
  const initials = getInitials(name) || 'NS';
  const subtitle = slug.replace(/-/g, ' ').toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="675" viewBox="0 0 900 675">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${from}"/>
          <stop offset="1" stop-color="${to}"/>
        </linearGradient>
        <radialGradient id="glow" cx="70%" cy="20%" r="70%">
          <stop offset="0" stop-color="#ffffff" stop-opacity=".35"/>
          <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="900" height="675" rx="42" fill="#020617"/>
      <rect x="22" y="22" width="856" height="631" rx="34" fill="url(#bg)"/>
      <rect x="22" y="22" width="856" height="631" rx="34" fill="url(#glow)"/>
      <circle cx="720" cy="92" r="170" fill="#fff" opacity=".10"/>
      <circle cx="140" cy="570" r="210" fill="#020617" opacity=".18"/>
      <rect x="96" y="96" width="708" height="483" rx="34" fill="#020617" opacity=".54"/>
      <text x="450" y="283" text-anchor="middle" fill="#fff" font-family="Inter,Arial,sans-serif" font-size="118" font-weight="900" letter-spacing="6">${initials}</text>
      <text x="450" y="382" text-anchor="middle" fill="#fff" font-family="Inter,Arial,sans-serif" font-size="46" font-weight="800">${name.replace(/&/g, '&amp;')}</text>
      <text x="450" y="438" text-anchor="middle" fill="#dbeafe" font-family="Inter,Arial,sans-serif" font-size="22" font-weight="700" letter-spacing="4">${subtitle.replace(/&/g, '&amp;')}</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const withGameLogo = (doc) => ({
  ...doc,
  image_url: buildGameLogoDataUrl(doc),
});

const sanitizeOrder = (doc) => ({
  $id: doc._id.toString(),
  order_number: doc.order_number,
  game_name: doc.game_name,
  product_name: doc.product_name,
  denomination: doc.denomination,
  status: doc.status,
  total_amount: doc.total_amount,
  quantity: doc.quantity,
  user_game_id: doc.user_game_id,
  user_game_server: doc.user_game_server,
  created_at: doc.created_at,
  updated_at: doc.updated_at,
});

const formatOrderDate = (dateValue) => {
  try {
    return new Date(dateValue || Date.now()).toLocaleString('en-MY', {
      timeZone: 'Asia/Kuala_Lumpur',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateValue || '');
  }
};

const buildTelegramOrderMessage = (order) => {
  const supplierCommand = [
    '/order',
    order.supplier_code || order.product_code || '',
    order.user_game_id || '',
    order.user_game_server || '',
  ].filter(Boolean).join(' ');
  const optionalLines = [
    order.user_game_server ? `<b>Server:</b> ${escapeTelegramHtml(order.user_game_server)}` : '',
    order.user_nickname ? `<b>Nickname:</b> ${escapeTelegramHtml(order.user_nickname)}` : '',
    order.user_email ? `<b>Email:</b> ${escapeTelegramHtml(order.user_email)}` : '',
    order.user_phone ? `<b>Phone:</b> ${escapeTelegramHtml(order.user_phone)}` : '',
    order.admin_notes ? `<b>Note:</b> ${escapeTelegramHtml(order.admin_notes)}` : '',
  ].filter(Boolean);

  return [
    '<b>NEW ORDER RECEIVED</b>',
    '',
    '<b>Order Details</b>',
    `Order #: <code>${escapeTelegramHtml(order.order_number)}</code>`,
    `<b>Game:</b> ${escapeTelegramHtml(order.game_name)}`,
    `<b>Product:</b> ${escapeTelegramHtml(order.product_name)}`,
    order.supplier_code ? `<b>Supplier Code:</b> <code>${escapeTelegramHtml(order.supplier_code)}</code>` : '',
    order.denomination ? `<b>Denomination:</b> ${escapeTelegramHtml(order.denomination)}` : '',
    `<b>Total:</b> ${escapeTelegramHtml(formatCurrency(order.total_amount))}`,
    `<b>Payment:</b> ${escapeTelegramHtml(order.payment_method_name)}`,
    order.receipt_validation?.accepted ? '<b>Receipt:</b> Verified by OCR' : '<b>Receipt:</b> Needs admin review',
    order.receipt_validation?.detectedAmount ? `<b>Receipt Amount:</b> ${escapeTelegramHtml(formatCurrency(order.receipt_validation.detectedAmount))}` : '',
    `<b>Status:</b> ${escapeTelegramHtml(order.status || 'pending')}`,
    `<b>Date:</b> ${escapeTelegramHtml(formatOrderDate(order.created_at))}`,
    '',
    '<b>Customer Details</b>',
    `<b>Game ID:</b> <code>${escapeTelegramHtml(order.user_game_id)}</code>`,
    ...optionalLines,
    '',
    '<b>Supplier Command</b>',
    `<code>${escapeTelegramHtml(supplierCommand)}</code>`,
    '',
    '<a href="https://nickstore-iota.vercel.app/admin/orders">Open admin orders</a>',
  ].filter(Boolean).join('\n');
};

const sendTelegramOrderNotification = async (order) => {
  if (!telegramBotToken || !telegramChatId) {
    console.warn('Telegram notification skipped: missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    return { ok: false, skipped: true };
  }

  const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: telegramChatId,
      text: buildTelegramOrderMessage(order),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  const data = await response.json();

  if (!data.ok) {
    console.error('Telegram notification failed:', data);
  }

  return data;
};

const dataUrlToTelegramPhoto = (dataUrl) => {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) return null;

  return {
    blob: new Blob([Buffer.from(match[2], 'base64')], { type: match[1] }),
    filename: `receipt-${Date.now()}.${match[1].split('/')[1] || 'jpg'}`,
  };
};

const sendTelegramReceiptPhoto = async (order) => {
  if (!telegramBotToken || !telegramChatId || !order.receipt_image_url) {
    return { ok: false, skipped: true };
  }

  const photo = dataUrlToTelegramPhoto(order.receipt_image_url);
  if (!photo) {
    return { ok: false, skipped: true, message: 'Receipt is not a data URL image' };
  }

  const form = new FormData();
  form.append('chat_id', telegramChatId);
  form.append('photo', photo.blob, photo.filename);
  form.append('parse_mode', 'HTML');
  form.append('caption', [
    `<b>Receipt for ${escapeTelegramHtml(order.order_number)}</b>`,
    `<b>Total:</b> ${escapeTelegramHtml(formatCurrency(order.total_amount))}`,
    order.receipt_validation?.message ? `<b>Check:</b> ${escapeTelegramHtml(order.receipt_validation.message)}` : '',
  ].filter(Boolean).join('\n'));

  const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendPhoto`, {
    method: 'POST',
    body: form,
  });

  const data = await response.json();
  if (!data.ok) {
    console.error('Telegram receipt photo failed:', data);
  }
  return data;
};

const getReceiptCheckerEnabled = async () => {
  const database = await getDb();
  const setting = await database.collection('settings').findOne({ key: 'receipt_checker_enabled' });
  return setting?.value !== false;
};

const sendTelegramFullOrder = async (order) => {
  const messageResult = await sendTelegramOrderNotification(order);
  const receiptResult = await sendTelegramReceiptPhoto(order);
  return { messageResult, receiptResult };
};

async function connectDB() {
  if (db) return db;

  try {
    await client.connect();
    db = client.db(dbName);
    console.log('✅ Connected to MongoDB');
    return db;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

connectDB();

const getDb = async () => db || connectDB();

// Helper function
const toObjectId = (id) => {
  const value = safeString(id, 80);
  try {
    return new ObjectId(value);
  } catch {
    return value;
  }
};

// Auth endpoints
app.post('/api/auth/login', authRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!adminPassword) {
      return res.status(503).json({ success: false, message: 'Admin password is not configured' });
    }

    if (email.toLowerCase() === adminEmail.toLowerCase() && password === adminPassword) {
      if (adminTwoFactorEnabled) {
        const challengeId = await createAdmin2faChallenge();
        return res.json({
          success: true,
          requires_2fa: true,
          challenge_id: challengeId,
          message: 'Verification code sent to the configured admin email.',
        });
      }

      const sessionToken = await createAdminSession();
      res.json({ 
        success: true, 
        session_token: sessionToken,
        user: { $id: 'admin1', id: 'admin1', email: adminEmail, name: 'Admin' }
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Games endpoints
app.get('/api/games', async (req, res) => {
  try {
    if (!db) {
      await connectDB();
    }

    const isAdmin = Boolean(await getAdminSessionFromRequest(req));
    const games = await db.collection('games').find(isAdmin ? {} : { is_active: true }).toArray();

    res.json({
      documents: games.map(sanitizeGame)
    });
  } catch (error) {
    console.error("GET /api/games error:", error);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});
app.post('/api/games', requireAdmin, async (req, res) => {
  try {
    const data = { ...req.body, created_at: new Date(), updated_at: new Date() };
    const result = await db.collection('games').insertOne(data);
    res.json({ ...data, $id: result.insertedId.toString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/games/:id', requireAdmin, async (req, res) => {
  try {
    const data = { ...req.body, updated_at: new Date() };
    await db.collection('games').updateOne(
      { _id: toObjectId(req.params.id) },
      { $set: data }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/games/:id', requireAdmin, async (req, res) => {
  try {
    await db.collection('games').deleteOne({ _id: toObjectId(req.params.id) });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Products endpoints
app.get('/api/products', async (req, res) => {
  try {
    const database = await getDb();
    const { game_id } = req.query;
    const isAdmin = Boolean(await getAdminSessionFromRequest(req));
    const query = {
      ...(game_id ? { game_id } : {}),
      ...(isAdmin ? {} : { is_active: true }),
    };
    const products = await database.collection('products').find(query).toArray();
    res.json({
      documents: products.map((doc) => isAdmin ? ({ ...doc, $id: doc._id.toString() }) : sanitizePublicProduct(doc)),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/settings/public', async (_req, res) => {
  try {
    res.json({
      receipt_checker_enabled: await getReceiptCheckerEnabled(),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/stats/popular-games', async (_req, res) => {
  try {
    const database = await getDb();
    const rows = await database.collection('orders').aggregate([
      {
        $group: {
          _id: { game_id: '$game_id', game_name: '$game_name' },
          order_count: { $sum: 1 },
          total_spend: { $sum: { $convert: { input: '$total_amount', to: 'double', onError: 0, onNull: 0 } } },
        },
      },
      { $sort: { order_count: -1, total_spend: -1 } },
      { $limit: 50 },
    ]).toArray();
    const activeGames = await database.collection('games').find({ is_active: true }).toArray();
    const activeGameIds = new Set(activeGames.map((game) => game._id.toString()));
    const activeGameNames = new Set(activeGames.map((game) => String(game.name || '').toLowerCase()));
    const filteredRows = rows
      .filter((row) => activeGameIds.has(String(row._id?.game_id || '')) || activeGameNames.has(String(row._id?.game_name || '').toLowerCase()))
      .slice(0, 5);

    res.json({ documents: normalizePopularRows(filteredRows), total: filteredRows.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/settings/receipt-checker', requireAdmin, async (req, res) => {
  try {
    const database = await getDb();
    const enabled = req.body?.enabled !== false;
    await database.collection('settings').updateOne(
      { key: 'receipt_checker_enabled' },
      {
        $set: {
          key: 'receipt_checker_enabled',
          value: enabled,
          updated_at: new Date(),
        },
        $setOnInsert: { created_at: new Date() },
      },
      { upsert: true }
    );
    res.json({ success: true, receipt_checker_enabled: enabled });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/products', requireAdmin, async (req, res) => {
  try {
    const database = await getDb();
    const costPrice = Number(req.body.cost_price ?? req.body.price ?? 0);
    const markupPercent = Number(req.body.markup_percent ?? 0);
    const data = {
      ...req.body,
      cost_price: Number.isFinite(costPrice) ? costPrice : undefined,
      markup_percent: markupPercent,
      price: req.body.markup_percent !== undefined ? applyMarkup(costPrice, markupPercent) : req.body.price,
      created_at: new Date(),
      updated_at: new Date(),
    };
    const result = await database.collection('products').insertOne(data);
    res.json({ ...data, $id: result.insertedId.toString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const database = await getDb();
    const existing = await database.collection('products').findOne({ _id: toObjectId(req.params.id) });
    const nextCost = Number(req.body.cost_price ?? existing?.cost_price ?? existing?.market_reference?.observed_price ?? req.body.price ?? existing?.price ?? 0);
    const hasMarkup = req.body.markup_percent !== undefined;
    const data = {
      ...req.body,
      cost_price: Number.isFinite(nextCost) ? nextCost : undefined,
      price: hasMarkup ? applyMarkup(nextCost, req.body.markup_percent) : req.body.price,
      updated_at: new Date(),
    };
    await database.collection('products').updateOne(
      { _id: toObjectId(req.params.id) },
      { $set: data }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const database = await getDb();
    await database.collection('products').deleteOne({ _id: toObjectId(req.params.id) });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/catalog/seed-market', requireAdmin, async (_req, res) => {
  try {
    const database = await getDb();
    const now = new Date();
    const gameIdsByKey = {};
    const pricedGameKeys = new Set(marketCatalogProducts.map((product) => product.gameKey));
    let gamesUpserted = 0;
    let productsUpserted = 0;

    for (const game of marketCatalogGames) {
      const result = await database.collection('games').findOneAndUpdate(
        { name: game.name },
        {
          $set: {
            name: game.name,
            description: game.description,
            image_id: '',
            image_url: game.image_url,
            provider_slug: game.provider_slug,
            service_count: game.service_count,
            is_active: game.is_active ?? pricedGameKeys.has(game.key),
            updated_at: now,
          },
          $setOnInsert: { created_at: now },
        },
        { upsert: true, returnDocument: 'after' }
      );

      gameIdsByKey[game.key] = result._id.toString();
      gamesUpserted += 1;
    }

    const gamesByKey = Object.fromEntries(marketCatalogGames.map((game) => [game.key, game]));

    for (const product of marketCatalogProducts) {
      const game = gamesByKey[product.gameKey];
      const gameId = gameIdsByKey[product.gameKey];
      if (!game || !gameId) continue;

      await database.collection('products').updateOne(
        {
          game_id: gameId,
          name: product.name,
          denomination: product.denomination,
        },
        {
          $set: {
            game_id: gameId,
            game_name: game.name,
            name: product.name,
            denomination: product.denomination,
            price: product.price,
            original_price: product.original_price,
            market_reference: product.market_reference,
            description: 'MYR starter catalog item. Review pricing before running promotions.',
            is_active: true,
            updated_at: now,
          },
          $setOnInsert: { created_at: now },
        },
        { upsert: true }
      );

      productsUpserted += 1;
    }

    res.json({
      success: true,
      games: gamesUpserted,
      products: productsUpserted,
      message: `Imported ${gamesUpserted} games and ${productsUpserted} MYR products.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/catalog/import-pricelist', requireAdmin, async (req, res) => {
  try {
    const csvText = typeof req.body === 'string' ? req.body : req.body?.csv;
    const dryRun = req.query.dry_run === 'true';

    if (!csvText) {
      return res.status(400).json({ success: false, message: 'CSV pricelist text is required.' });
    }

    const database = await getDb();
    const now = new Date();
    const parsedProducts = parseSupplierPricelist(csvText);
    const games = await database.collection('games').find({}).toArray();
    const gameBySlug = new Map();
    const parsedCountsByGame = parsedProducts.reduce((counts, product) => {
      counts[product.gameKey] = (counts[product.gameKey] || 0) + 1;
      return counts;
    }, {});

    for (const game of games) {
      const slugs = [
        game.provider_slug,
        normalizeCatalogSlug(game.name),
        normalizeCatalogSlug(game.name?.replace(/:/g, '')),
      ].filter(Boolean);

      for (const slug of slugs) {
        if (!gameBySlug.has(slug)) gameBySlug.set(slug, game);
      }
    }

    const productsByGame = {};
    const missingGames = new Set();
    const skippedGames = {};
    let importedProducts = 0;
    const gamesToActivate = new Map();
    const productOps = [];
    const productLookupFilters = [];

    for (const product of parsedProducts) {
      const game = gameBySlug.get(product.gameKey);
      if (!game) {
        missingGames.add(product.gameKey);
        continue;
      }

      if (game.service_count && parsedCountsByGame[product.gameKey] > game.service_count) {
        skippedGames[product.gameKey] = {
          expected_services: game.service_count,
          parsed_products: parsedCountsByGame[product.gameKey],
          reason: 'Parsed product count is higher than provider service count. This usually means the pricelist section contains duplicated or mixed rows.',
        };
        continue;
      }

      productsByGame[product.gameKey] = (productsByGame[product.gameKey] || 0) + 1;

      if (dryRun) continue;

      productLookupFilters.push({
        game_id: game._id.toString(),
        supplier_code: product.supplier_code,
      });
    }

    const existingProducts = dryRun || productLookupFilters.length === 0
      ? []
      : await database.collection('products').find({ $or: productLookupFilters }).toArray();
    const existingProductByKey = new Map(
      existingProducts.map((product) => [`${product.game_id}:${product.supplier_code}`, product])
    );

    for (const product of parsedProducts) {
      const game = gameBySlug.get(product.gameKey);
      if (!game || skippedGames[product.gameKey]) continue;
      if (dryRun) continue;

      const gameId = game._id.toString();
      const existingProduct = existingProductByKey.get(`${gameId}:${product.supplier_code}`);
      const markupPercent = Number(existingProduct?.markup_percent ?? game.markup_percent ?? 0);
      const sellingPrice = applyMarkup(product.price, markupPercent);

      gamesToActivate.set(gameId, {
        updateOne: {
          filter: { _id: game._id },
          update: {
            $set: {
              is_active: true,
              provider_slug: product.gameKey,
              updated_at: now,
            },
          },
        },
      });

      productOps.push({
        updateOne: {
          filter: {
            game_id: gameId,
            supplier_code: product.supplier_code,
          },
          update: {
            $set: {
              game_id: gameId,
            game_name: game.name,
            name: product.name,
            denomination: product.denomination,
            cost_price: product.price,
            markup_percent: markupPercent,
            price: sellingPrice,
            supplier_code: product.supplier_code,
            provider_slug: product.provider_slug,
            source_page: product.source_page,
            market_reference: {
              source: 'Topup_Kryz_bot',
              observed_price: product.price,
              checked_at: '2026-05-26',
            },
            description: `Supplier code ${product.supplier_code}. Imported from Topup_Kryz_bot pricelist.`,
            is_active: true,
            updated_at: now,
          },
          $setOnInsert: { created_at: now },
          },
          upsert: true,
        },
      });
    }

    if (!dryRun && gamesToActivate.size > 0) {
      await database.collection('games').bulkWrite(Array.from(gamesToActivate.values()), { ordered: false });
    }

    if (!dryRun && productOps.length > 0) {
      await database.collection('products').bulkWrite(productOps, { ordered: false });
      importedProducts = productOps.length;
    }

    res.json({
      success: true,
      dry_run: dryRun,
      parsed_products: parsedProducts.length,
      imported_products: dryRun ? 0 : importedProducts,
      games: Object.keys(productsByGame).length,
      products_by_game: productsByGame,
      skipped_games: skippedGames,
      missing_games: Array.from(missingGames),
      message: dryRun
        ? `Parsed ${parsedProducts.length} supplier products across ${Object.keys(productsByGame).length} matching games.`
        : `Imported ${importedProducts} supplier products across ${Object.keys(productsByGame).length} games.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/catalog/markup', requireAdmin, async (req, res) => {
  try {
    const database = await getDb();
    const now = new Date();
    const scope = req.body?.scope || 'all';
    const markupPercent = Number(req.body?.markup_percent);

    if (!Number.isFinite(markupPercent) || markupPercent < 0) {
      return res.status(400).json({ success: false, message: 'Markup percent must be a positive number.' });
    }

    if (scope === 'game') {
      if (!req.body?.game_id) {
        return res.status(400).json({ success: false, message: 'game_id is required for game markup.' });
      }

      await database.collection('games').updateOne(
        { _id: toObjectId(req.body.game_id) },
        { $set: { markup_percent: markupPercent, updated_at: now } }
      );
    }

    const query =
      scope === 'product'
        ? { _id: toObjectId(req.body.product_id) }
        : scope === 'game'
          ? { game_id: req.body.game_id }
          : {};

    if (scope === 'product' && !req.body?.product_id) {
      return res.status(400).json({ success: false, message: 'product_id is required for product markup.' });
    }

    const products = await database.collection('products').find(query).toArray();

    for (const product of products) {
      const costPrice = getProductCost(product);
      await database.collection('products').updateOne(
        { _id: product._id },
        {
          $set: {
            cost_price: costPrice,
            markup_percent: markupPercent,
            price: applyMarkup(costPrice, markupPercent),
            updated_at: now,
          },
        }
      );
    }

    res.json({
      success: true,
      scope,
      markup_percent: markupPercent,
      updated_products: products.length,
      message: `Applied ${markupPercent}% markup to ${products.length} product${products.length === 1 ? '' : 's'}.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/catalog/prune-to-pricelist', requireAdmin, async (_req, res) => {
  try {
    const database = await getDb();
    const now = new Date();
    const supplierProducts = await database.collection('products').find({
      $or: [
        { 'market_reference.source': 'Topup_Kryz_bot' },
        { supplier_code: { $exists: true, $ne: '' } },
      ],
    }).toArray();
    const supplierGameIds = new Set(
      supplierProducts
        .map((product) => String(product.game_id || ''))
        .filter(Boolean)
    );
    const supplierProductsByGameId = supplierProducts.reduce((groups, product) => {
      const gameId = String(product.game_id || '');
      if (!gameId) return groups;
      groups[gameId] = groups[gameId] || [];
      groups[gameId].push(product);
      return groups;
    }, {});
    const supplierGameObjectIds = [];
    const supplierStringGameIds = [];

    for (const id of supplierGameIds) {
      try {
        supplierGameObjectIds.push(new ObjectId(id));
      } catch {
        supplierStringGameIds.push(id);
      }
    }

    const existingGames = await database.collection('games').find({}).toArray();
    const existingGameIds = new Set(existingGames.map((game) => String(game._id)));

    for (const id of supplierGameIds) {
      if (existingGameIds.has(id)) continue;
      const sampleProduct = supplierProductsByGameId[id]?.[0];
      const catalogGame = marketCatalogGames.find((game) => game.key === sampleProduct?.provider_slug);
      let gameId = id;
      try {
        gameId = new ObjectId(id);
      } catch {
        gameId = id;
      }
      await database.collection('games').insertOne({
        _id: gameId,
        name: catalogGame?.name || sampleProduct?.game_name || sampleProduct?.provider_slug || id,
        description: catalogGame?.description || `Imported pricelist catalog for ${sampleProduct?.game_name || id}.`,
        image_id: '',
        image_url: buildGameLogoDataUrl({
          name: catalogGame?.name || sampleProduct?.game_name || sampleProduct?.provider_slug || id,
          provider_slug: sampleProduct?.provider_slug || id,
        }),
        provider_slug: sampleProduct?.provider_slug || id,
        service_count: catalogGame?.service_count,
        is_active: true,
        created_at: now,
        updated_at: now,
      });
    }

    const productDeleteResult = await database.collection('products').deleteMany({
      $or: [
        {
          $and: [
            { 'market_reference.source': { $ne: 'Topup_Kryz_bot' } },
            { supplier_code: { $exists: false } },
          ],
        },
        { game_id: { $nin: Array.from(supplierGameIds) } },
      ],
    });

    const keepGameFilters = [
      ...supplierGameObjectIds.map((id) => ({ _id: id })),
      ...supplierStringGameIds.map((id) => ({ _id: id })),
    ];
    const gameDeleteResult = await database.collection('games').deleteMany(
      keepGameFilters.length > 0 ? { $nor: keepGameFilters } : {}
    );

    if (keepGameFilters.length > 0) {
      await database.collection('games').updateMany(
        { $or: keepGameFilters },
        { $set: { is_active: true, updated_at: now } }
      );
    }

    await database.collection('products').updateMany(
      {
        $or: [
          { 'market_reference.source': 'Topup_Kryz_bot' },
          { supplier_code: { $exists: true, $ne: '' } },
        ],
      },
      { $set: { is_active: true, updated_at: now } }
    );

    res.json({
      success: true,
      kept_games: supplierGameIds.size,
      kept_supplier_products: supplierProducts.filter(isSupplierPricelistProduct).length,
      deleted_games: gameDeleteResult.deletedCount || 0,
      deleted_products: productDeleteResult.deletedCount || 0,
      message: `Kept ${supplierGameIds.size} pricelist games and removed ${gameDeleteResult.deletedCount || 0} other games.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Orders endpoints
app.get('/api/orders', async (req, res) => {
  try {
    const database = await getDb();
    const isAdmin = Boolean(await getAdminSessionFromRequest(req));
    const customerSession = await getCustomerSessionFromRequest(req);
    const orderNumber = safeString(req.query.order_number, 80);

    if (!isAdmin && !customerSession && !orderNumber) {
      return res.json({ documents: [] });
    }

    const query = orderNumber
      ? { order_number: orderNumber }
      : customerSession
        ? { customer_id: customerSession.customer_id }
        : {};
    const orders = await database.collection('orders').find(query).sort({ created_at: -1 }).toArray();
    res.json({
      documents: orders.map((doc) => isAdmin ? ({ ...doc, $id: doc._id.toString() }) : sanitizeOrder(doc)),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders', orderRateLimit, async (req, res) => {
  try {
    const database = await getDb();
    const customerSession = await getCustomerSessionFromRequest(req);
    const product = await database.collection('products').findOne({
      _id: toObjectId(req.body.product_id),
      is_active: true,
    });

    if (!product) {
      return res.status(400).json({ success: false, message: 'Selected product is unavailable.' });
    }

    const quantity = Math.max(1, Number.parseInt(req.body.quantity, 10) || 1);
    const unitPrice = Number(product.price || 0);
    const totalAmount = Number((unitPrice * quantity).toFixed(2));
    const userGameId = safeString(req.body.user_game_id, 80);

    if (!userGameId) {
      return res.status(400).json({ success: false, message: 'Game ID is required.' });
    }

    const receiptValidation = req.body.receipt_validation
      ? {
          ...req.body.receipt_validation,
          expectedAmount: totalAmount,
          amountMatched: req.body.receipt_validation.amountMatched === true && Number(req.body.receipt_validation.expectedAmount) === totalAmount,
        }
      : undefined;
    const data = {
      customer_id: customerSession?.customer_id || null,
      order_number: generateOrderNumber(),
      game_id: product.game_id,
      game_name: product.game_name,
      product_id: product._id.toString(),
      product_name: product.name,
      denomination: product.denomination,
      supplier_code: product.supplier_code || req.body.supplier_code || '',
      provider_slug: product.provider_slug || req.body.provider_slug || '',
      price: String(unitPrice),
      quantity: String(quantity),
      total_amount: String(totalAmount),
      user_game_id: userGameId,
      user_game_server: safeString(req.body.user_game_server, 80),
      user_nickname: safeString(req.body.user_nickname, 80),
      user_email: normalizeEmail(req.body.user_email),
      user_phone: safeString(req.body.user_phone, 30),
      payment_method: safeString(req.body.payment_method, 80),
      receipt_image_id: safeString(req.body.receipt_image_id, 120),
      receipt_image_url: safeString(req.body.receipt_image_url, 12_000_000),
      status: 'pending',
      receipt_validation: receiptValidation,
      created_at: new Date(),
      updated_at: new Date(),
    };
    const result = await database.collection('orders').insertOne(data);
    const order = { ...data, $id: result.insertedId.toString() };

    sendTelegramFullOrder(order).catch((error) => {
      console.error('Telegram order notification error:', error);
    });

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/verify-2fa', authRateLimit, async (req, res) => {
  try {
    const { challenge_id: challengeId, code } = req.body;

    if (!adminTwoFactorEnabled) {
      return res.status(400).json({ success: false, message: 'Two-factor authentication is not enabled' });
    }

    if (!challengeId || !code) {
      return res.status(400).json({ success: false, message: 'Verification code is required' });
    }

    const database = await getDb();
    const challenge = await database.collection('admin_2fa_challenges').findOne({
      challengeId,
      email: adminEmail.toLowerCase(),
      used: false,
    });

    if (!challenge || new Date(challenge.expiresAt).getTime() < Date.now()) {
      return res.status(401).json({ success: false, message: 'Verification code expired. Please sign in again.' });
    }

    if (challenge.codeHash !== hashAdminCode(String(code).trim(), challengeId)) {
      return res.status(401).json({ success: false, message: 'Invalid verification code' });
    }

    await database.collection('admin_2fa_challenges').updateOne(
      { _id: challenge._id },
      { $set: { used: true, usedAt: new Date() } }
    );

    const sessionToken = await createAdminSession();
    res.json({
      success: true,
      session_token: sessionToken,
      user: { $id: 'admin1', id: 'admin1', email: adminEmail, name: 'Admin' },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/customer/register', customerAuthRateLimit, async (req, res) => {
  try {
    const database = await getDb();
    const name = safeString(req.body.name, 80);
    const email = normalizeEmail(req.body.email);
    const phone = safeString(req.body.phone, 30);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!name || !isValidEmail(email) || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Enter a name, valid email, and password with at least 8 characters.' });
    }

    const existing = await database.collection('customers').findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account already exists with this email.' });
    }

    const now = new Date();
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await database.collection('customers').insertOne({
      name,
      email,
      phone,
      passwordHash,
      created_at: now,
      updated_at: now,
    });
    const customer = { _id: result.insertedId, name, email, phone, created_at: now };
    const sessionToken = await createCustomerSession(result.insertedId);

    res.json({ success: true, customer: sanitizeCustomer(customer), session_token: sessionToken });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/customer/login', customerAuthRateLimit, async (req, res) => {
  try {
    const database = await getDb();
    const email = normalizeEmail(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ success: false, message: 'Enter a valid email and password.' });
    }

    const customer = await database.collection('customers').findOne({ email });
    if (!customer || !(await bcrypt.compare(password, customer.passwordHash || ''))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const challengeId = await createCustomerChallenge({
      customerId: customer._id,
      email: customer.email,
      purpose: 'login',
    });
    res.json({
      success: true,
      requires_2fa: true,
      challenge_id: challengeId,
      message: 'Verification code sent to your email.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/customer/verify-login', customerAuthRateLimit, async (req, res) => {
  try {
    const database = await getDb();
    const challengeId = safeString(req.body.challenge_id, 80);
    const code = safeString(req.body.code, 12);

    const challenge = await database.collection('customer_2fa_challenges').findOne({
      challengeId,
      purpose: 'login',
      used: false,
    });

    if (!challenge || new Date(challenge.expiresAt).getTime() < Date.now() || challenge.codeHash !== hashAdminCode(code, challengeId)) {
      return res.status(401).json({ success: false, message: 'Verification code expired or invalid.' });
    }

    const customer = await database.collection('customers').findOne({ _id: challenge.customer_id });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    await database.collection('customer_2fa_challenges').updateOne({ _id: challenge._id }, { $set: { used: true, usedAt: new Date() } });
    const sessionToken = await createCustomerSession(customer._id);
    res.json({ success: true, customer: sanitizeCustomer(customer), session_token: sessionToken });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/customer/forgot-password', customerAuthRateLimit, async (req, res) => {
  try {
    const database = await getDb();
    const email = normalizeEmail(req.body.email);
    const newPassword = typeof req.body.password === 'string' ? req.body.password : '';

    if (!isValidEmail(email) || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Enter your email and a new password with at least 8 characters.' });
    }

    const customer = await database.collection('customers').findOne({ email });
    if (!customer) {
      return res.json({ success: true, message: 'If the account exists, a reset code has been sent.' });
    }

    const nextPasswordHash = await bcrypt.hash(newPassword, 12);
    const challengeId = await createCustomerChallenge({
      customerId: customer._id,
      email: customer.email,
      purpose: 'reset',
      nextPasswordHash,
    });

    res.json({ success: true, requires_2fa: true, challenge_id: challengeId, message: 'Reset code sent to your email.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/customer/reset-password', customerAuthRateLimit, async (req, res) => {
  try {
    const database = await getDb();
    const challengeId = safeString(req.body.challenge_id, 80);
    const code = safeString(req.body.code, 12);
    const challenge = await database.collection('customer_2fa_challenges').findOne({
      challengeId,
      purpose: 'reset',
      used: false,
    });

    if (!challenge || new Date(challenge.expiresAt).getTime() < Date.now() || challenge.codeHash !== hashAdminCode(code, challengeId) || !challenge.nextPasswordHash) {
      return res.status(401).json({ success: false, message: 'Reset code expired or invalid.' });
    }

    await database.collection('customers').updateOne(
      { _id: challenge.customer_id },
      { $set: { passwordHash: challenge.nextPasswordHash, updated_at: new Date() } }
    );
    await database.collection('customer_2fa_challenges').updateOne({ _id: challenge._id }, { $set: { used: true, usedAt: new Date() } });
    await database.collection('customer_sessions').deleteMany({ customer_id: challenge.customer_id });

    res.json({ success: true, message: 'Password updated. Please sign in again.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/auth/forgot-password', authRateLimit, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (email !== adminEmail.toLowerCase()) {
      return res.json({ success: true, message: 'If the email matches the admin account, reset instructions have been sent.' });
    }

    await sendVerificationEmail({
      to: adminEmail,
      subject: 'NickStore admin password reset instructions',
      title: 'NickStore admin password reset',
      code: 'VERCEL-ENV',
      extraText: 'Admin password is stored in Vercel Environment Variables. Update ADMIN_PASSWORD in Vercel, redeploy, then sign in with the new password.',
    });

    res.json({ success: true, message: 'Reset instructions sent to the configured admin email.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/customer/me', requireCustomer, async (req, res) => {
  try {
    const database = await getDb();
    const customer = await database.collection('customers').findOne({ _id: req.customerSession.customer_id });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }
    res.json({ success: true, customer: sanitizeCustomer(customer) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/customer/stats', requireCustomer, async (req, res) => {
  try {
    const database = await getDb();
    const rows = await database.collection('orders').aggregate([
      { $match: { customer_id: req.customerSession.customer_id } },
      {
        $group: {
          _id: { game_id: '$game_id', game_name: '$game_name' },
          order_count: { $sum: 1 },
          total_spend: { $sum: { $convert: { input: '$total_amount', to: 'double', onError: 0, onNull: 0 } } },
        },
      },
      { $sort: { order_count: -1, total_spend: -1 } },
      { $limit: 5 },
    ]).toArray();

    res.json({ documents: normalizePopularRows(rows), total: rows.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/customer/logout', requireCustomer, async (req, res) => {
  try {
    const database = await getDb();
    await database.collection('customer_sessions').deleteOne({ _id: req.customerSession._id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/telegram/test-order', requireAdmin, async (req, res) => {
  try {
    const note = req.body?.note || 'testing bot';
    const sampleOrder = {
      order_number: `TEST-${Date.now()}`,
      game_name: 'NickStore Test',
      product_name: 'Trial Order Notification',
      denomination: 'Testing package',
      total_amount: 0,
      payment_method_name: 'Test payment',
      status: 'pending',
      user_game_id: 'TESTING-BOT',
      user_game_server: 'Demo server',
      user_nickname: 'Testing Bot',
      user_email: '',
      user_phone: '',
      admin_notes: note,
      created_at: new Date(),
    };

    const telegramResult = await sendTelegramOrderNotification(sampleOrder);

    if (!telegramResult.ok) {
      return res.status(500).json({
        success: false,
        message: telegramResult.description || 'Telegram notification failed',
        telegramResult,
      });
    }

    res.json({ success: true, telegramResult });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/orders/:id', requireAdmin, async (req, res) => {
  try {
    const database = await getDb();
    const data = { ...req.body, updated_at: new Date() };
    await database.collection('orders').updateOne(
      { _id: toObjectId(req.params.id) },
      { $set: data }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/orders/:id', requireAdmin, async (req, res) => {
  try {
    const database = await getDb();
    await database.collection('orders').deleteOne({ _id: toObjectId(req.params.id) });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Payment Methods endpoints
app.get('/api/payment-methods', async (req, res) => {
  try {
    const database = await getDb();
    const isAdmin = Boolean(await getAdminSessionFromRequest(req));
    const methods = await database.collection('payment_methods').find(isAdmin ? {} : { is_active: true }).toArray();
    res.json({ documents: methods.map(doc => ({ ...doc, $id: doc._id.toString() })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payment-methods', requireAdmin, async (req, res) => {
  try {
    const database = await getDb();
    const data = { ...req.body, created_at: new Date(), updated_at: new Date() };
    const result = await database.collection('payment_methods').insertOne(data);
    res.json({ ...data, $id: result.insertedId.toString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/payment-methods/:id', requireAdmin, async (req, res) => {
  try {
    const database = await getDb();
    const data = { ...req.body, updated_at: new Date() };
    await database.collection('payment_methods').updateOne(
      { _id: toObjectId(req.params.id) },
      { $set: data }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/payment-methods/:id', requireAdmin, async (req, res) => {
  try {
    const database = await getDb();
    await database.collection('payment_methods').deleteOne({ _id: toObjectId(req.params.id) });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
  });
}

module.exports = app;
