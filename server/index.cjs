const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const app = express();
const port = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
const dbName = 'gaming_store';

let db;

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;
const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
const adminPassword = process.env.ADMIN_PASSWORD;

const escapeTelegramHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const formatCurrency = (amount) => {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `RM ${(numericAmount || 0).toFixed(2)}`;
};

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
    const data = { ...req.body, created_at: new Date(), updated_at: new Date() };
    const result = await database.collection('products').insertOne(data);
    res.json({ ...data, $id: result.insertedId.toString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const database = await getDb();
    const data = { ...req.body, updated_at: new Date() };
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

    sendTelegramOrderNotification(order).catch((error) => {
      console.error('Telegram order notification error:', error);
    });

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
