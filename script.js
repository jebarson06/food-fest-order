<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Food Fest Stall</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <header class="header">
      <h1 class="stall-name">Food Fest Stall</h1>
    </header>

    <main class="main">
      <div class="content">
        <section class="menu-section">
          <h2 class="section-title">Menu</h2>

          <div class="menu-list">
            <article class="menu-item">
              <img
                src="https://images.unsplash.com/photo-1482049016688-2d3e1b311543?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
                alt="Bread Omelette"
                class="menu-item-img"
              />
              <div class="menu-item-info">
                <h3 class="menu-item-name">Bread Omelette</h3>
                <p class="menu-item-price">₹30</p>
                <button
                  class="btn add-btn"
                  data-name="Bread Omelette"
                  data-price="30"
                >
                  + Add to Cart
                </button>
              </div>
            </article>

            <article class="menu-item">
              <img
                src="https://images.unsplash.com/photo-1600271886742-f049cd451bba?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
                alt="Fresh Juice"
                class="menu-item-img"
              />
              <div class="menu-item-info">
                <h3 class="menu-item-name">Fresh Juice</h3>
                <p class="menu-item-price">₹20</p>
                <button
                  class="btn add-btn"
                  data-name="Fresh Juice"
                  data-price="20"
                >
                  + Add to Cart
                </button>
              </div>
            </article>
          </div>
        </section>

        <section class="cart-section">
          <h2 class="section-title">Your Cart</h2>
          <p id="cart-empty" class="cart-empty">No items added yet.</p>
          <ul id="cart-list" class="cart-list"></ul>
          <button class="btn spin-btn" id="spin-btn" disabled>
            Spin for Discount
          </button>
        </section>
      </div>
    </main>

    <footer class="footer">
      <div class="footer-inner">
        <div class="total-row">
          <span class="total-label">Total:</span>
          <span class="total-value" id="total-amount">₹0</span>
        </div>
        <p id="discount-message" class="discount-message"></p>
        <p id="order-message" class="order-message" aria-live="polite"></p>
        <div class="footer-actions">
          <button class="btn secondary-btn" id="clear-cart-btn" disabled>
            Clear Cart
          </button>
          <button class="btn primary-btn" id="place-order-btn" disabled>
            Place Order
          </button>
        </div>
      </div>
    </footer>

    <div id="spin-overlay" class="spin-overlay hidden">
      <div class="spin-wheel-wrapper">
        <div class="spin-wheel" id="wheel"></div>
        <ul class="spin-legend">
          <li><span class="spin-legend-color" style="background:#f97316"></span><span>₹5 discount</span></li>
          <li><span class="spin-legend-color" style="background:#22c55e"></span><span>₹10 discount</span></li>
          <li><span class="spin-legend-color" style="background:#3b82f6"></span><span>Free ketchup</span></li>
          <li><span class="spin-legend-color" style="background:#eab308"></span><span>No reward</span></li>
          <li><span class="spin-legend-color" style="background:#ec4899"></span><span>Free extra sauce</span></li>
        </ul>
      </div>
    </div>

    <div id="success-popup" class="success-popup hidden">
      <div class="success-popup-content">
        <div class="success-icon">✓</div>
        <h2>Order Placed Successfully!</h2>
        <p>Your Order ID is: <strong id="success-order-id"></strong></p>
        <p class="success-total">Total to Pay: <strong id="success-total-amount"></strong></p>
        <div class="success-actions">
          <a id="pay-now-btn" class="btn primary-btn pay-btn" href="#" target="_blank">Pay Now (UPI)</a>
          <button id="continue-ordering-btn" class="btn secondary-btn continue-btn">Close</button>
        </div>
      </div>
    </div>

    <script src="script.js"></script>
  </body>
</html>

