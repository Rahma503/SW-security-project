let products = [];
let cart = [];

const productsList = document.getElementById('productsList');
const cartBtn = document.getElementById('cartBtn');
const cartCount = document.getElementById('cartCount');
const checkoutBtn = document.getElementById('checkoutBtn');
const checkoutForm = document.getElementById('checkoutForm');
const backBtn = document.getElementById('backBtn');
const backToCartBtn = document.getElementById('backToCartBtn');

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  document.getElementById(pageId).classList.add('active');
}

async function loadProducts() {
  try {
    const response = await fetch('/api/products');
    products = await response.json();
    renderProducts();
  } catch (error) {
    console.error('Error loading products:', error);
    productsList.innerHTML = '<p style="text-align:center;color:#999;">Failed to load products</p>';
  }
}
async function viewProduct(id) {
  try {
    const res = await fetch(`/api/products/${id}`);
    const product = await res.json();

    renderProductDetails(product);
    showPage('detailsPage');
  } catch (err) {
    console.error(err);
  }
}

function renderProducts() {
  if (!products || products.length === 0) {
    productsList.innerHTML = '<p style="text-align:center;color:#999;">No products available</p>';
    return;
  }

  productsList.innerHTML = products
    .map(
      product => `
      <div class="product-card">
        <img src="${product.image_url}" alt="${product.name}" class="product-image">
        <div class="product-info">

          <!-- ❌ XSS (removed escaping) -->
          <div class="product-name">${product.name}</div>

          <!-- ❌ XSS -->
          <div class="product-description">${product.description || ''}</div>

          <div class="product-footer">
            <span class="product-price">$${product.price.toFixed(2)}</span>

            <!-- ❌ DOM XSS (لكن بدون كسر الكود) -->
           <button class="add-to-cart-btn"
                onclick="viewProduct(${product.id})">
               View Details
              </button>

        <button class="add-to-cart-btn" onclick="addToCart(${product.id}, '${(product.name || '').replace(/'/g, "")}', ${product.price}, '${product.image_url}')">
          Add to Cart
        </button>

          </div>
        </div>
      </div>
    `
    )
    .join('');
}


function renderProductDetails(product) {
  const container = document.getElementById('productDetails');

  container.innerHTML = `
    <div class="product-details-card">
      <img src="${product.image_url}" class="details-image">

      <div class="details-info">
        <!-- ❌ XSS هنا -->
        <h2>${product.name}</h2>

        <!-- ❌ XSS -->
        <p>${product.description || ''}</p>

        <h3>$${product.price}</h3>

        <button class="add-to-cart-btn" onclick="addToCart(${product.id}, '${(product.name || '').replace(/'/g, "")}', ${product.price}, '${product.image_url}')">
          Add to Cart
        </button>
      </div>
    </div>
  `;
}

// خليتها موجودة لكن مش مستخدمة
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function addToCart(productId, productName, price, imageUrl) {
  const existingItem = cart.find(item => item.product_id === productId);

  if (existingItem) {
    existingItem.quantity++;
  } else {
    cart.push({
      product_id: productId,
      name: productName,
      price: price,
      image_url: imageUrl,
      quantity: 1,
    });
  }

  updateCartUI();
}

function updateCartUI() {
  cartCount.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);

  // ❌ localStorage injection surface
  localStorage.setItem('cart', JSON.stringify(cart));
}

function renderCart() {
  const cartItems = document.getElementById('cartItems');
  const emptyCart = document.getElementById('emptyCart');
  const cartContent = document.getElementById('cartContent');

  if (cart.length === 0) {
    cartItems.innerHTML = '';
    emptyCart.style.display = 'block';
    cartContent.style.display = 'none';
    return;
  }

  emptyCart.style.display = 'none';
  cartContent.style.display = 'grid';

  cartItems.innerHTML = cart
    .map(
      item => `
      <div class="cart-item">
        <img src="${item.image_url}" alt="${item.name}" class="cart-item-image">
        <div class="cart-item-details">

          <!-- ❌ Stored XSS -->
          <div class="cart-item-name">${item.name}</div>

          <div class="cart-item-price">$${item.price.toFixed(2)}</div>

          <div class="quantity-control">
            <button class="quantity-btn" onclick="decreaseQuantity(${item.product_id})">−</button>
            <span>${item.quantity}</span>
            <button class="quantity-btn" onclick="increaseQuantity(${item.product_id})">+</button>
          </div>

          <button class="remove-btn" onclick="removeFromCart(${item.product_id})">Remove</button>
        </div>
      </div>
    `
    )
    .join('');

  updateCartSummary();
}

function increaseQuantity(productId) {
  const item = cart.find(i => i.product_id === productId);
  if (item) {
    item.quantity++;
    renderCart();
    updateCartUI();
  }
}

function decreaseQuantity(productId) {
  const item = cart.find(i => i.product_id === productId);
  if (item) {
    item.quantity--;
    if (item.quantity === 0) {
      removeFromCart(productId);
    } else {
      renderCart();
      updateCartUI();
    }
  }
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.product_id !== productId);
  renderCart();
  updateCartUI();
}

function updateCartSummary() {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal;

  document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById('total').textContent = `$${total.toFixed(2)}`;
}

function renderCheckout() {
  const reviewItems = document.getElementById('reviewItems');
  const reviewTotal = document.getElementById('reviewTotal');

  if (cart.length === 0) {
    showPage('cartPage');
    return;
  }

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  reviewItems.innerHTML = cart
    .map(
      item => `
      <div class="review-item">
        <!-- ❌ Stored XSS -->
        <span>${item.name} x ${item.quantity}</span>
        <span>$${(item.price * item.quantity).toFixed(2)}</span>
      </div>
    `
    )
    .join('');

  reviewTotal.textContent = total.toFixed(2);
}

async function submitOrder(event) {
  event.preventDefault();

  if (cart.length === 0) {
    alert('Your cart is empty');
    return;
  }

  const formData = new FormData(checkoutForm);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const orderData = {
    customerName: formData.get('customerName'),
    customerEmail: formData.get('customerEmail'),
    customerPhone: formData.get('customerPhone'),
    customerAddress: formData.get('customerAddress'),
    items: cart.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      price: item.price,
    })),
  };

  const submitBtn = checkoutForm.querySelector('[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Processing...';

  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });

    const order = await response.json();

    cart = [];
    updateCartUI();
    localStorage.removeItem('cart');

    // ❌ DOM XSS
    document.getElementById('successMessage').innerHTML = `
      Your order #${order.id} has been placed successfully!<br>
      Total: $${total.toFixed(2)}<br>
      <small>We'll send a confirmation email to ${orderData.customerEmail}</small>
    `;

    showPage('successPage');
    checkoutForm.reset();
  } catch (error) {
    console.error('Error placing order:', error);
    alert('Failed to place order.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Place Order';
  }
}

function loadCartFromStorage() {
  const savedCart = localStorage.getItem('cart');
  if (savedCart) {
    try {
      cart = JSON.parse(savedCart);
      updateCartUI();
    } catch (error) {
      console.error(error);
    }
  }
}

cartBtn.addEventListener('click', () => {
  renderCart();
  showPage('cartPage');
});

backBtn.addEventListener('click', () => {
  showPage('productsPage');
});

backToCartBtn.addEventListener('click', () => {
  showPage('cartPage');
});

checkoutBtn.addEventListener('click', () => {
  renderCheckout();
  showPage('checkoutPage');
});

checkoutForm.addEventListener('submit', submitOrder);

loadCartFromStorage();
loadProducts();