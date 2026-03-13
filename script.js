// ========== Configuration ==========
// Google Apps Script Web App URL – receives POST with order JSON and appends to Sheets
const CONFIG = {
  WEB_APP_URL:
    "https://script.google.com/macros/s/AKfycbxV4Lm6MJZweZcjyMIk82JHMqfwbIHTTQAT-K6pWElbwtR3gOSb_q_v8vuOlR5vGD0Tpg/exec",
};

// ========== DOM references ==========
const totalAmountEl = document.getElementById("total-amount");
const placeOrderBtn = document.getElementById("place-order-btn");
const clearCartBtn = document.getElementById("clear-cart-btn");
const addButtons = document.querySelectorAll(".menu-section .add-btn");
const cartListEl = document.getElementById("cart-list");
const cartEmptyEl = document.getElementById("cart-empty");
const spinBtn = document.getElementById("spin-btn");
const discountMessageEl = document.getElementById("discount-message");
const orderMessageEl = document.getElementById("order-message");
const spinOverlay = document.getElementById("spin-overlay");
const wheelEl = document.getElementById("wheel");

// Success popup references
const successPopup = document.getElementById("success-popup");
const successOrderIdEl = document.getElementById("success-order-id");
const successTotalAmountEl = document.getElementById("success-total-amount");
const payNowBtn = document.getElementById("pay-now-btn");
const continueOrderingBtn = document.getElementById("continue-ordering-btn");

const cart = {};
let appliedDiscountAmount = 0;
let spinUsed = false;

// Ensure spin UI starts hidden and not spinning
if (spinOverlay) {
  spinOverlay.classList.add("hidden");
}
if (wheelEl) {
  wheelEl.classList.remove("spinning");
}

function calculateSubtotal() {
  return Object.values(cart).reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
}

function calculateTotal() {
  const subtotal = calculateSubtotal();
  const totalAfterDiscount = Math.max(0, subtotal - appliedDiscountAmount);
  return totalAfterDiscount;
}

function resetDiscount() {
  appliedDiscountAmount = 0;
  spinUsed = false;
  discountMessageEl.textContent = "";
}

function payNow(amount) {
  const upiId = "jjmass27@okicici";
  const upiLink = `upi://pay?pa=${upiId}&pn=FoodFest&am=${amount}&cu=INR`;
  
  window.location.href = upiLink;

  setTimeout(() => {
    window.alert("Please open this page on a mobile device with Google Pay installed.");
  }, 2000);
}

// ---------- Order submission helpers (for Google Sheets backend) ----------

/**
 * Generates a sequential order ID starting from 1, tracking it in localStorage.
 */
function generateOrderId() {
  let currentId = parseInt(localStorage.getItem("foodFestOrderId") || "0", 10);
  currentId += 1;
  localStorage.setItem("foodFestOrderId", currentId.toString());
  return currentId.toString();
}

/**
 * Builds a single string of cart items for the payload, e.g. "Bread Omelette x1, Juice x2".
 */
function getOrderItemsString() {
  return Object.values(cart)
    .map((item) => `${item.name} x${item.quantity}`)
    .join(", ");
}

/**
 * Builds the order payload in the required JSON shape for the Google Apps Script web app.
 */
function buildOrderPayload() {
  const subtotal = calculateSubtotal();
  const total = calculateTotal();
  return {
    orderId: generateOrderId(),
    items: getOrderItemsString(),
    total: total,
    discount: appliedDiscountAmount,
    time: new Date().toISOString(),
  };
}

/**
 * Sends the order to the Google Apps Script Web App via POST (fetch).
 * Returns a promise that resolves on success or rejects on network/response error.
 */
function submitOrder(payload) {
  const url = CONFIG.WEB_APP_URL;
  if (!url || url.includes("YOUR_GOOGLE")) {
    return Promise.reject(new Error("Web App URL not configured. Set CONFIG.WEB_APP_URL in script.js."));
  }
  return fetch(url, {
    method: "POST",
    mode: "no-cors", // Required for Apps Script; response body won't be readable
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

function renderCart() {
  const items = Object.values(cart);

  cartListEl.innerHTML = "";

  if (items.length === 0) {
    cartEmptyEl.style.display = "block";
  } else {
    cartEmptyEl.style.display = "none";

    items.forEach((item) => {
      const li = document.createElement("li");
      li.className = "cart-item";
      li.innerHTML = `
        <div class="cart-item-main">
          <span class="cart-item-name">${item.name}</span>
          <span class="cart-item-qty">x${item.quantity}</span>
        </div>
        <div class="cart-item-sub">
          <span class="cart-item-price">₹${item.price}</span>
          <span class="cart-item-line-total">₹${
            item.price * item.quantity
          }</span>
        </div>
      `;
      cartListEl.appendChild(li);
    });
  }

  const subtotal = calculateSubtotal();
  const total = calculateTotal();
  totalAmountEl.textContent = `₹${total}`;

  const hasItems = subtotal > 0;
  placeOrderBtn.disabled = !hasItems;
  clearCartBtn.disabled = !hasItems;
  spinBtn.disabled = !hasItems || spinUsed;
}

addButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const name = button.getAttribute("data-name") || "";
    const price = Number(button.getAttribute("data-price")) || 0;

    if (!name || !price) return;

    if (!cart[name]) {
      cart[name] = { name, price, quantity: 0 };
    }

    cart[name].quantity += 1;
    renderCart();
  });
});

clearCartBtn.addEventListener("click", () => {
  Object.keys(cart).forEach((key) => delete cart[key]);
  resetDiscount();
  renderCart();
});

// Place Order: build payload, POST to Google Apps Script, show confirmation or error
placeOrderBtn.addEventListener("click", async () => {
  const total = calculateTotal();

  if (total === 0) {
    window.alert("Please add at least one item before placing an order.");
    return;
  }

  // Clear any previous order message so we can show new status
  if (orderMessageEl) {
    orderMessageEl.textContent = "";
    orderMessageEl.className = "order-message";
  }

  const payload = buildOrderPayload();
  placeOrderBtn.disabled = true;
  if (orderMessageEl) orderMessageEl.textContent = "Sending order...";

  try {
    await submitOrder(payload);
    // On success, show the success popup
    if (orderMessageEl) {
      orderMessageEl.textContent = "";
    }
    
    // Show popup
    if (successPopup && successOrderIdEl) {
      successOrderIdEl.textContent = payload.orderId;
      
      if (successTotalAmountEl) {
        successTotalAmountEl.textContent = payload.total;
      }
      
      if (payNowBtn) {
        payNowBtn.onclick = (e) => {
          e.preventDefault();
          payNow(payload.total);
        };
      }
      
      successPopup.classList.remove("hidden");
    } else {
      window.alert(`Order Placed Successfully! Order ID: ${payload.orderId}`);
    }

    Object.keys(cart).forEach((key) => delete cart[key]);
    resetDiscount();
    renderCart();
  } catch (err) {
    if (orderMessageEl) {
      orderMessageEl.textContent = "Could not send order. Check URL and try again.";
      orderMessageEl.className = "order-message order-message--error";
    } else {
      window.alert("Failed to send order. Please try again.");
    }
  } finally {
    placeOrderBtn.disabled = false;
    renderCart();
  }
});

if (continueOrderingBtn && successPopup) {
  continueOrderingBtn.addEventListener("click", () => {
    successPopup.classList.add("hidden");
  });
}

spinBtn.addEventListener("click", () => {
  const subtotal = calculateSubtotal();
  if (spinUsed || subtotal === 0) return;

  spinUsed = true;
  spinBtn.disabled = true;

  discountMessageEl.textContent = "Spinning the wheel...";
  spinOverlay.classList.remove("hidden");
  if (wheelEl) {
    wheelEl.classList.add("spinning");
  }

  const rewards = [
    { type: "discount", amount: 5, message: "You won ₹5 discount!" },
    { type: "discount", amount: 10, message: "You won ₹10 discount!" },
    { type: "bonus", amount: 0, message: "You won free ketchup!" },
    { type: "none", amount: 0, message: "Better luck next time!" },
    { type: "bonus", amount: 0, message: "You won free extra sauce!" },
  ];

  setTimeout(() => {
    const reward = rewards[Math.floor(Math.random() * rewards.length)];

    if (reward.type === "discount" && reward.amount > 0) {
      appliedDiscountAmount += reward.amount;
    }

    discountMessageEl.textContent = reward.message;
    if (wheelEl) {
      wheelEl.classList.remove("spinning");
    }
    spinOverlay.classList.add("hidden");
    renderCart();
  }, 3500);
});

// Initial render to ensure correct button states
renderCart();

