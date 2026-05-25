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

const idCheckerHost = 'id-game-checker.p.rapidapi.com';
const idCheckerBaseUrl = `https://${idCheckerHost}`;
const idCheckerKey = process.env.ID_GAME_CHECKER_API_KEY || process.env.RAPIDAPI_KEY || process.env.RAPID_API_KEY;

const gameSlugAliases = {
  'mobile legends': 'mobile-legends',
  'mobile legends bang bang': 'mobile-legends',
  'mobile legends: bang bang': 'mobile-legends',
  mlbb: 'mobile-legends',
  'free fire': 'free-fire',
  ff: 'free-fire',
  'pubg mobile': 'pubg-mobile',
  pubg: 'pubg-mobile',
  'genshin impact': 'genshin-impact',
  'honkai star rail': 'honkai-star-rail',
  'call of duty mobile': 'call-of-duty-mobile',
  codm: 'call-of-duty-mobile',
  'clash of clans': 'clash-of-clans',
  coc: 'clash-of-clans',
  'clash royale': 'clash-royale',
  'brawl stars': 'brawl-stars',
};

const normalizeGameSlug = (game) => {
  const value = String(game || '').trim().toLowerCase();
  if (!value) return '';

  return gameSlugAliases[value] || value
    .replace(/['"]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const normalizeCheckerResponse = (payload, game, userId) => {
  const data = payload && typeof payload === 'object' ? payload.data : null;
  const username = String(
    data?.username ||
    payload?.username ||
    payload?.name ||
    ''
  ).trim();

  const status = Number(payload?.status || 0);
  const success = Boolean(
    username ||
    payload?.success === true ||
    (payload?.error === false && status >= 200 && status < 300 && status !== 204)
  );

  return {
    success,
    game,
    userId,
    username,
    avatar: data?.avatar || payload?.avatar || '',
    status: status || (success ? 200 : 404),
    message: payload?.msg || payload?.message || (success ? 'id_found' : 'id_not_found'),
    raw: payload,
  };
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
    
    // Simple authentication (replace with real auth)
    if (email === 'admin@example.com' && password === 'admin123') {
      res.json({ 
        success: true, 
        user: { id: 'admin1', email, name: 'Admin' }
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

app.post('/api/check-game-id', async (req, res) => {
  try {
    const { game, userId, region } = req.body || {};
    const gameSlug = normalizeGameSlug(game);
    const cleanUserId = String(userId || '').trim().replace(/^#/, '');
    const cleanRegion = String(region || '').trim();

    if (!gameSlug || !cleanUserId) {
      return res.status(400).json({
        success: false,
        message: 'Game and user ID are required',
      });
    }

    if (!idCheckerKey) {
      return res.status(503).json({
        success: false,
        message: 'ID checker API key is not configured',
      });
    }

    const pathParts = [gameSlug, cleanUserId];
    if (cleanRegion) pathParts.push(cleanRegion);

    const url = `${idCheckerBaseUrl}/${pathParts.map(encodeURIComponent).join('/')}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Rapidapi-Host': idCheckerHost,
        'X-Rapidapi-Key': idCheckerKey,
      },
    });

    const text = await response.text();
    let payload;

    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { message: text };
    }

    const result = normalizeCheckerResponse(payload, gameSlug, cleanUserId);

    res.status(response.ok || result.success ? 200 : response.status).json(result);
  } catch (error) {
    console.error('POST /api/check-game-id error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to check game ID',
    });
  }
});

// Products endpoints
app.get('/api/products', async (req, res) => {
  try {
    const { game_id } = req.query;
    const query = game_id ? { game_id } : {};
    const products = await db.collection('products').find(query).toArray();
    res.json({ documents: products.map(doc => ({ ...doc, $id: doc._id.toString() })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const data = { ...req.body, created_at: new Date(), updated_at: new Date() };
    const result = await db.collection('products').insertOne(data);
    res.json({ ...data, $id: result.insertedId.toString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const data = { ...req.body, updated_at: new Date() };
    await db.collection('products').updateOne(
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
    await db.collection('products').deleteOne({ _id: toObjectId(req.params.id) });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Orders endpoints
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await db.collection('orders').find({}).sort({ created_at: -1 }).toArray();
    res.json({ documents: orders.map(doc => ({ ...doc, $id: doc._id.toString() })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const data = { ...req.body, created_at: new Date(), updated_at: new Date() };
    const result = await db.collection('orders').insertOne(data);
    res.json({ ...data, $id: result.insertedId.toString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/orders/:id', async (req, res) => {
  try {
    const data = { ...req.body, updated_at: new Date() };
    await db.collection('orders').updateOne(
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
    await db.collection('orders').deleteOne({ _id: toObjectId(req.params.id) });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Payment Methods endpoints
app.get('/api/payment-methods', async (req, res) => {
  try {
    const methods = await db.collection('payment_methods').find({}).toArray();
    res.json({ documents: methods.map(doc => ({ ...doc, $id: doc._id.toString() })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payment-methods', async (req, res) => {
  try {
    const data = { ...req.body, created_at: new Date(), updated_at: new Date() };
    const result = await db.collection('payment_methods').insertOne(data);
    res.json({ ...data, $id: result.insertedId.toString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/payment-methods/:id', async (req, res) => {
  try {
    const data = { ...req.body, updated_at: new Date() };
    await db.collection('payment_methods').updateOne(
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
    await db.collection('payment_methods').deleteOne({ _id: toObjectId(req.params.id) });
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
