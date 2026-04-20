const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

// ❌ CORS Misconfiguration
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

const db = new sqlite3.Database('./ecommerce.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

function initializeDatabase() {
  const createProductsTable = `
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      image_url TEXT,
      stock INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const createOrdersTable = `
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_address TEXT NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const createOrderItemsTable = `
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL
    )
  `;

  db.run(createProductsTable);
  db.run(createOrdersTable);
  db.run(createOrderItemsTable);

  seedProducts();
}

function seedProducts() {
  const checkSql = 'SELECT COUNT(*) as count FROM products';

  db.get(checkSql, (err, row) => {
    if (row && row.count === 0) {
      const products = [
        {
          name: 'Wireless Headphones',
          description: 'High-quality Bluetooth headphones',
          price: 79.99,
          image_url: 'https://images.pexels.com/photos/3445645/pexels-photo-3445645.jpeg'
        },
        {
          name: 'Smartwatch',
          description: 'Fitness tracking watch',
          price: 199.99,
          image_url: 'https://images.pexels.com/photos/437037/pexels-photo-437037.jpeg'
        }
      ];

      const insertSql = `INSERT INTO products (name, description, price, image_url) VALUES (?, ?, ?, ?)`;

      products.forEach(p => {
        db.run(insertSql, [p.name, p.description, p.price, p.image_url]);
      });
    }
  });
}

// ✅ normal API
app.get('/api/products', (req, res) => {
  db.all('SELECT * FROM products', [], (err, rows) => {
    res.json(rows);
  });
});

// ❌ SQL Injection
app.get('/api/products/:id', (req, res) => {
  const sql = `SELECT * FROM products WHERE id = ${req.params.id}`;
  db.get(sql, [], (err, row) => {
    res.json(row);
  });
});

// ❌ SSRF
app.get('/api/fetch', async (req, res) => {
  const url = req.query.url;
  const response = await fetch(url);
  const data = await response.text();
  res.send(data);
});

// ❌ SQLi + CSRF
app.post('/api/orders', (req, res) => {
  const { customerName, customerEmail, customerPhone, customerAddress, items } = req.body;

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const sql = `
    INSERT INTO orders (customer_name, customer_email, customer_phone, customer_address, total_amount)
    VALUES ('${customerName}', '${customerEmail}', '${customerPhone}', '${customerAddress}', ${total})
  `;

  db.run(sql, function (err) {
    const orderId = this.lastID;

    items.forEach(item => {
      const itemSql = `
        INSERT INTO order_items (order_id, product_id, quantity, price)
        VALUES (${orderId}, ${item.product_id}, ${item.quantity}, ${item.price})
      `;
      db.run(itemSql);
    });

    res.json({ id: orderId });
  });
});

// ❌ No clickjacking protection

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});