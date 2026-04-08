const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

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
      price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `;

  db.run(createProductsTable, (err) => {
    if (err) console.error('Error creating products table:', err.message);
    else console.log('Products table ready');
  });

  db.run(createOrdersTable, (err) => {
    if (err) console.error('Error creating orders table:', err.message);
    else console.log('Orders table ready');
  });

  db.run(createOrderItemsTable, (err) => {
    if (err) console.error('Error creating order items table:', err.message);
    else console.log('Order items table ready');
  });

  seedProducts();
}

function seedProducts() {
  const checkSql = 'SELECT COUNT(*) as count FROM products';

  db.get(checkSql, (err, row) => {
    if (row && row.count === 0) {
      const products = [
        {
          name: 'Wireless Headphones',
          description: 'High-quality Bluetooth headphones with noise cancellation',
          price: 79.99,
          image_url: 'https://images.pexels.com/photos/3445645/pexels-photo-3445645.jpeg?auto=compress&cs=tinysrgb&w=400',
          stock: 50,
        },
        {
          name: 'Smartwatch',
          description: 'Advanced fitness tracking and notifications',
          price: 199.99,
          image_url: 'https://images.pexels.com/photos/437037/pexels-photo-437037.jpeg?auto=compress&cs=tinysrgb&w=400',
          stock: 30,
        },
        {
          name: 'USB-C Cable',
          description: 'Fast charging and data transfer cable',
          price: 12.99,
          image_url: 'https://images.pexels.com/photos/4039886/pexels-photo-4039886.jpeg?auto=compress&cs=tinysrgb&w=400',
          stock: 200,
        },
        {
          name: 'Phone Stand',
          description: 'Adjustable phone holder for desk or table',
          price: 14.99,
          image_url: 'https://images.pexels.com/photos/699122/pexels-photo-699122.jpeg?auto=compress&cs=tinysrgb&w=400',
          stock: 100,
        },
        {
          name: 'Wireless Charger',
          description: 'Fast charging pad for compatible devices',
          price: 24.99,
          image_url: 'https://images.pexels.com/photos/4195325/pexels-photo-4195325.jpeg?auto=compress&cs=tinysrgb&w=400',
          stock: 75,
        },
        {
          name: 'Screen Protector',
          description: 'Tempered glass protection for smartphone',
          price: 9.99,
          image_url: 'https://images.pexels.com/photos/699122/pexels-photo-699122.jpeg?auto=compress&cs=tinysrgb&w=400',
          stock: 150,
        },
      ];

      const insertSql = 'INSERT INTO products (name, description, price, image_url, stock) VALUES (?, ?, ?, ?, ?)';

      products.forEach(product => {
        db.run(insertSql, [product.name, product.description, product.price, product.image_url, product.stock], (err) => {
          if (err) console.error('Error inserting product:', err.message);
        });
      });

      console.log('Seeded products');
    }
  });
}

app.get('/api/products', (req, res) => {
  const sql = 'SELECT * FROM products ORDER BY created_at DESC';

  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const sql = 'SELECT * FROM products WHERE id = ?';

  db.get(sql, [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json(row);
  });
});

app.post('/api/orders', (req, res) => {
  const { customerName, customerEmail, customerPhone, customerAddress, items } = req.body;

  if (!customerName || !customerEmail || !customerPhone || !customerAddress || !items || items.length === 0) {
    res.status(400).json({ error: 'Invalid order data' });
    return;
  }

  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const orderSql = 'INSERT INTO orders (customer_name, customer_email, customer_phone, customer_address, total_amount) VALUES (?, ?, ?, ?, ?)';

  db.run(orderSql, [customerName, customerEmail, customerPhone, customerAddress, totalAmount], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const orderId = this.lastID;
    const itemSql = 'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)';

    let completedItems = 0;

    items.forEach(item => {
      db.run(itemSql, [orderId, item.product_id, item.quantity, item.price], (err) => {
        completedItems++;

        if (err) {
          console.error('Error inserting order item:', err.message);
        }

        if (completedItems === items.length) {
          res.json({ id: orderId, totalAmount, status: 'pending' });
        }
      });
    });
  });
});

app.get('/api/orders', (req, res) => {
  const sql = 'SELECT * FROM orders ORDER BY created_at DESC LIMIT 100';

  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/orders/:id', (req, res) => {
  const { id } = req.params;

  const orderSql = 'SELECT * FROM orders WHERE id = ?';
  const itemsSql = 'SELECT oi.*, p.name, p.image_url FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?';

  db.get(orderSql, [id], (err, order) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    db.all(itemsSql, [id], (err, items) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      res.json({ ...order, items });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed');
    process.exit(0);
  });
});
