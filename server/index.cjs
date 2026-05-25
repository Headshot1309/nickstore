const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Blob } = require('buffer');
const { MongoClient, ObjectId } = require('mongodb');
const nodemailer = require('nodemailer');
const { marketCatalogGames, marketCatalogProducts } = require('./catalog-seed.cjs');
const app = express();
const port = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
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
  try {
    return new ObjectId(id);
  } catch {
    return id;
  }
};

// Auth endpoints
app.post('/api/auth/login', async (req, res) => {
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
          message: `Verification code sent to ${adminEmail}`,
        });
      }

      res.json({ 
        success: true, 
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

    const games = await db.collection('games').find({}).toArray();

    res.json({
      documents: games.map(doc => ({
        ...doc,
        $id: doc._id.toString()
      }))
    });
  } catch (error) {
    console.error("GET /api/games error:", error);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});
app.post('/api/games', async (req, res) => {
  try {
    const data = { ...req.body, created_at: new Date(), updated_at: new Date() };
    const result = await db.collection('games').insertOne(data);
    res.json({ ...data, $id: result.insertedId.toString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/games/:id', async (req, res) => {
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

app.delete('/api/games/:id', async (req, res) => {
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
    const query = game_id ? { game_id } : {};
    const products = await database.collection('products').find(query).toArray();
    res.json({ documents: products.map(doc => ({ ...doc, $id: doc._id.toString() })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', async (req, res) => {
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

app.put('/api/products/:id', async (req, res) => {
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

app.delete('/api/products/:id', async (req, res) => {
  try {
    const database = await getDb();
    await database.collection('products').deleteOne({ _id: toObjectId(req.params.id) });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/catalog/seed-market', async (_req, res) => {
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

app.post('/api/catalog/import-pricelist', async (req, res) => {
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
    let importedProducts = 0;

    for (const product of parsedProducts) {
      const game = gameBySlug.get(product.gameKey);
      if (!game) {
        missingGames.add(product.gameKey);
        continue;
      }

      productsByGame[product.gameKey] = (productsByGame[product.gameKey] || 0) + 1;

      if (dryRun) continue;

      const existingProduct = await database.collection('products').findOne({
        game_id: game._id.toString(),
        supplier_code: product.supplier_code,
      });
      const markupPercent = Number(existingProduct?.markup_percent ?? game.markup_percent ?? 0);
      const sellingPrice = applyMarkup(product.price, markupPercent);

      await database.collection('games').updateOne(
        { _id: game._id },
        {
          $set: {
            is_active: true,
            provider_slug: product.gameKey,
            updated_at: now,
          },
        }
      );

      await database.collection('products').updateOne(
        {
          game_id: game._id.toString(),
          supplier_code: product.supplier_code,
        },
        {
          $set: {
            game_id: game._id.toString(),
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
        { upsert: true }
      );

      importedProducts += 1;
    }

    res.json({
      success: true,
      dry_run: dryRun,
      parsed_products: parsedProducts.length,
      imported_products: dryRun ? 0 : importedProducts,
      games: Object.keys(productsByGame).length,
      products_by_game: productsByGame,
      missing_games: Array.from(missingGames),
      message: dryRun
        ? `Parsed ${parsedProducts.length} supplier products across ${Object.keys(productsByGame).length} matching games.`
        : `Imported ${importedProducts} supplier products across ${Object.keys(productsByGame).length} games.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/catalog/markup', async (req, res) => {
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

// Orders endpoints
app.get('/api/orders', async (req, res) => {
  try {
    const database = await getDb();
    const orders = await database.collection('orders').find({}).sort({ created_at: -1 }).toArray();
    res.json({ documents: orders.map(doc => ({ ...doc, $id: doc._id.toString() })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const database = await getDb();
    const data = { ...req.body, created_at: new Date(), updated_at: new Date() };
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

app.post('/api/auth/verify-2fa', async (req, res) => {
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

    res.json({
      success: true,
      user: { $id: 'admin1', id: 'admin1', email: adminEmail, name: 'Admin' },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/telegram/test-order', async (req, res) => {
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

app.put('/api/orders/:id', async (req, res) => {
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

app.delete('/api/orders/:id', async (req, res) => {
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
    const methods = await database.collection('payment_methods').find({}).toArray();
    res.json({ documents: methods.map(doc => ({ ...doc, $id: doc._id.toString() })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payment-methods', async (req, res) => {
  try {
    const database = await getDb();
    const data = { ...req.body, created_at: new Date(), updated_at: new Date() };
    const result = await database.collection('payment_methods').insertOne(data);
    res.json({ ...data, $id: result.insertedId.toString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/payment-methods/:id', async (req, res) => {
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

app.delete('/api/payment-methods/:id', async (req, res) => {
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
