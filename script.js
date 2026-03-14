// ========== Configuration ==========
// Google Apps Script Web App URL – receives POST with order JSON and appends to Sheets
const CONFIG = {
  WEB_APP_URL:
    "https://script.google.com/macros/s/AKfycbxV4Lm6MJZweZcjyMIk82JHMqfwbIHTTQAT-K6pWElbwtR3gOSb_q_v8vuOlR5vGD0Tpg/exec",
};

// ========== DOM references ==========
const menuContainer = document.getElementById("menu-container");
const totalAmountEl = document.getElementById("total-amount");
const placeOrderBtn = document.getElementById("place-order-btn");
const clearCartBtn = document.getElementById("clear-cart-btn");
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

// Admin modal references
const adminToggleBtn = document.getElementById("admin-toggle-btn");
const adminModal = document.getElementById("admin-modal");
const adminCloseBtn = document.getElementById("admin-close-btn");
const addItemForm = document.getElementById("add-item-form");
const adminMenuList = document.getElementById("admin-menu-list");

const editModal = document.getElementById("edit-modal");
const editCloseBtn = document.getElementById("edit-close-btn");
const editItemForm = document.getElementById("edit-item-form");

// Win Modal references
const winModal = document.getElementById("win-modal");
const winMessageText = document.getElementById("win-message-text");
const applyOfferBtn = document.getElementById("apply-offer-btn");
const confettiContainer = document.getElementById("confetti-container");

// Payment / checkout bar (shown when cart has items; always visible after spin discount applied)
const stickyCheckoutEl = document.getElementById("sticky-checkout");
const subtotalEl = document.getElementById("subtotal-amount");
const discountAmountEl = document.getElementById("discount-amount");
const totalAmountContainer = document.getElementById("total-amount-container");

const cart = {};
let appliedDiscountAmount = 0;
let spinUsed = false;
let currentReward = null;
let currentWheelRotation = 0;

// Default items if fresh user
const DEFAULT_MENU = [
  {
    id: "item-1",
    name: "Bread Omelette",
    price: 30,
    image: "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
  },
  {
    id: "item-2",
    name: "Fresh Juice",
    price: 20,
    image: "https://images.unsplash.com/photo-1600271886742-f049cd451bba?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
  }
];

let menuItems = [];

// Initialize Menu from LocalStorage
function initMenu() {
  const storedMenu = localStorage.getItem("foodFestMenu");
  if (storedMenu) {
    menuItems = JSON.parse(storedMenu);
  } else {
    menuItems = [...DEFAULT_MENU];
    saveMenu();
  }
}

function saveMenu() {
  localStorage.setItem("foodFestMenu", JSON.stringify(menuItems));
}

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

function renderMenu() {
  menuContainer.innerHTML = "";
  
  menuItems.forEach((item) => {
    const article = document.createElement("article");
    article.className = "menu-item";
    article.innerHTML = `
      <img src="${item.image}" alt="${item.name}" class="menu-item-img" onerror="this.src='https://via.placeholder.com/400x200?text=Food+Image'" />
      <div class="menu-item-info">
        <div class="menu-item-header">
          <h3 class="menu-item-name">${item.name}</h3>
          <p class="menu-item-price">₹${item.price}</p>
        </div>
        <button class="btn add-btn" data-id="${item.id}" data-name="${item.name}" data-price="${item.price}">
          + Add to Cart
        </button>
      </div>
    `;
    menuContainer.appendChild(article);
  });

  // Re-attach listeners to new Add buttons
  const addButtons = document.querySelectorAll(".menu-section .add-btn");
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
}

function payNow(amount) {
  if (!amount || isNaN(amount) || amount <= 0) {
    window.alert("Invalid payment amount");
    return;
  }

  const upiId = "jjmass27@okicici";
  const upiLink = `upi://pay?pa=${upiId}&pn=FoodFest&am=${amount}&cu=INR`;
  
  console.log("Generated UPI Link:", upiLink);
  
  const startTime = Date.now();
  window.location.href = upiLink;

  setTimeout(() => {
    const timeElapsed = Date.now() - startTime;
    if (timeElapsed < 2500 && document.visibilityState === "visible") {
      window.alert("Please open this website with Google Pay installed.");
    }
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

  // Show subtotal and discount breakdown when discount is applied
  if (subtotalEl) {
    subtotalEl.textContent = appliedDiscountAmount > 0 ? `Subtotal: ₹${subtotal}` : "";
    subtotalEl.style.display = appliedDiscountAmount > 0 ? "block" : "none";
  }
  if (discountAmountEl) {
    discountAmountEl.textContent = appliedDiscountAmount > 0 ? `Discount: -₹${appliedDiscountAmount}` : "";
    discountAmountEl.style.display = appliedDiscountAmount > 0 ? "block" : "none";
  }

  const hasItems = subtotal > 0;
  placeOrderBtn.disabled = !hasItems;
  clearCartBtn.disabled = !hasItems;
  spinBtn.disabled = !hasItems || spinUsed;

  // Payment section visibility: show when cart has items; ensure it stays visible after spin/discount
  if (stickyCheckoutEl) {
    if (hasItems) {
      stickyCheckoutEl.classList.remove("payment-section-hidden");
      stickyCheckoutEl.classList.add("payment-section-visible");
      stickyCheckoutEl.setAttribute("aria-hidden", "false");
      stickyCheckoutEl.style.display = "";
      stickyCheckoutEl.style.visibility = "";
      stickyCheckoutEl.style.zIndex = "";
    } else {
      stickyCheckoutEl.classList.add("payment-section-hidden");
      stickyCheckoutEl.classList.remove("payment-section-visible");
      stickyCheckoutEl.setAttribute("aria-hidden", "true");
      stickyCheckoutEl.style.display = "none";
    }
  }

  // Update item count badge if present
  const cartItemCountEl = document.getElementById("cart-item-count");
  if (cartItemCountEl) {
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    cartItemCountEl.textContent = itemCount === 1 ? "1 Item" : `${itemCount} Items`;
  }
}

// Cart clearing and discounting
clearCartBtn.addEventListener("click", () => {
  Object.keys(cart).forEach((key) => delete cart[key]);
  resetDiscount();
  
  // Reset wheel rotation and glow specifically
  if(wheelEl) {
    wheelEl.style.transform = `rotate(0deg)`;
  }
  currentWheelRotation = 0;
  
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

function triggerConfetti() {
  confettiContainer.innerHTML = "";
  const colors = ['#f97316', '#22c55e', '#3b82f6', '#eab308', '#ec4899', '#8b5cf6'];
  for (let i = 0; i < 60; i++) {
    const confetti = document.createElement("div");
    confetti.className = "confetti";
    confetti.style.left = Math.random() * 100 + "vw";
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDelay = (Math.random() * 1.5) + "s";
    confetti.style.animationDuration = (2 + Math.random() * 2) + "s";
    confettiContainer.appendChild(confetti);
  }
}

applyOfferBtn.addEventListener("click", () => {
  winModal.classList.add("hidden");
  spinOverlay.classList.add("hidden");

  if (currentReward) {
    if (currentReward.type === "discount") {
      appliedDiscountAmount += currentReward.amount;
      discountMessageEl.textContent = "Offer applied: " + currentReward.message;
    } else if (currentReward.type === "bonus") {
      if (!cart[currentReward.message]) {
        cart[currentReward.message] = { name: currentReward.message, price: 0, quantity: 1 };
      } else {
        cart[currentReward.message].quantity += 1;
      }
      discountMessageEl.textContent = "Added to cart: " + currentReward.message;
    } else {
      discountMessageEl.textContent = currentReward.message;
    }
  }

  renderCart();

  // Ensure payment section is visible and on top after discount is applied (not hidden by any overlay)
  if (stickyCheckoutEl) {
    stickyCheckoutEl.classList.remove("payment-section-hidden");
    stickyCheckoutEl.classList.add("payment-section-visible", "payment-section-just-applied");
    stickyCheckoutEl.setAttribute("aria-hidden", "false");
    stickyCheckoutEl.style.display = "";
    stickyCheckoutEl.style.visibility = "visible";
    stickyCheckoutEl.style.zIndex = "";
    // Remove animation class after it runs so re-opening doesn't re-animate
    setTimeout(() => stickyCheckoutEl.classList.remove("payment-section-just-applied"), 600);
  }
});

spinBtn.addEventListener("click", () => {
  const subtotal = calculateSubtotal();
  if (spinUsed || subtotal === 0) return;

  spinUsed = true;
  spinBtn.disabled = true;

  discountMessageEl.textContent = "Spinning the wheel...";
  spinOverlay.classList.remove("hidden");
  
  if (wheelEl) {
    wheelEl.classList.add("glowing");
  }

  const rewards = [
    { type: "discount", amount: 5, message: "₹5 Discount" },
    { type: "discount", amount: 10, message: "₹10 Discount" },
    { type: "discount", amount: 20, message: "₹20 Discount" },
    { type: "bonus", amount: 0, message: "Free Ketchup" },
    { type: "bonus", amount: 0, message: "Free Juice" },
    { type: "none", amount: 0, message: "Better luck next time" },
  ];

  // Pick random reward
  const winIndex = Math.floor(Math.random() * rewards.length);
  const reward = rewards[winIndex];
  currentReward = reward;

  // Calculate target rotation
  // Each slice is 60 degrees. Slice center is 30 + winIndex * 60
  // To make it land at the top (pointer at 0 degrees), 
  // target rotation = total spins (5 * 360) + distance to top (360 - sliceCenter)
  const sliceCenter = 30 + winIndex * 60;
  const randomOffset = Math.floor(Math.random() * 40) - 20; // ±20 degree randomness
  
  // We add to the currentWheelRotation so subsequent spins (if allowed) always move forward
  // 5 full rotations (1800 deg) + offset to target
  currentWheelRotation += (5 * 360) + (360 - sliceCenter) + randomOffset;

  if (wheelEl) {
    // Force reflow just in case before applying new transform
    void wheelEl.offsetWidth;
    
    wheelEl.style.transform = `rotate(${currentWheelRotation}deg)`;
    
    // Wait for transition to end before showing popup
    wheelEl.addEventListener("transitionend", function handler() {
      wheelEl.removeEventListener("transitionend", handler);
      wheelEl.classList.remove("glowing");
      
      const titleEl = document.querySelector(".win-title");
      if (reward.type === "none") {
        titleEl.textContent = "Aw, shucks!";
        winMessageText.textContent = reward.message;
        applyOfferBtn.textContent = "Close";
      } else {
        titleEl.textContent = "🎉 Congratulations!";
        winMessageText.textContent = "You won: " + reward.message;
        applyOfferBtn.textContent = "Apply Offer";
        triggerConfetti();
      }
      
      winModal.classList.remove("hidden");
    }, { once: true });
  }
});

// ================= ADMIN & CRUD LOGIC =================
function renderAdminMenu() {
  adminMenuList.innerHTML = "";
  menuItems.forEach(item => {
    const li = document.createElement("li");
    li.className = "admin-menu-item";
    li.innerHTML = `
      <div class="admin-menu-info">
        <span class="admin-menu-title">${item.name}</span>
        <span class="admin-menu-price">₹${item.price}</span>
      </div>
      <div class="admin-menu-ops">
        <button class="menu-action-btn edit-btn" data-id="${item.id}">✎ Edit</button>
        <button class="menu-action-btn delete-btn" data-id="${item.id}">🗑 Delete</button>
      </div>
    `;
    adminMenuList.appendChild(li);
  });

  // Attach delete events
  document.querySelectorAll(".admin-menu-item .delete-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const id = e.target.getAttribute("data-id");
      if (confirm("Are you sure you want to delete this specific item?")) {
        menuItems = menuItems.filter(item => item.id !== id);
        saveMenu();
        renderAdminMenu();
        renderMenu(); // Update front menu
      }
    });
  });

  // Attach edit events
  document.querySelectorAll(".admin-menu-item .edit-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const id = e.target.getAttribute("data-id");
      const itemToEdit = menuItems.find(item => item.id === id);
      if (itemToEdit) {
        document.getElementById("edit-item-id").value = itemToEdit.id;
        document.getElementById("edit-item-name").value = itemToEdit.name;
        document.getElementById("edit-item-price").value = itemToEdit.price;
        document.getElementById("edit-item-image").value = itemToEdit.image;
        editModal.classList.remove("hidden");
      }
    });
  });
}

// Admin Modal toggles
adminToggleBtn.addEventListener("click", () => {
  renderAdminMenu();
  adminModal.classList.remove("hidden");
});
adminCloseBtn.addEventListener("click", () => adminModal.classList.add("hidden"));
editCloseBtn.addEventListener("click", () => editModal.classList.add("hidden"));

// Add Item
addItemForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("item-name").value.trim();
  const price = Number(document.getElementById("item-price").value);
  const image = document.getElementById("item-image").value.trim();

  if (name && price && image) {
    const newItem = {
      id: "item-" + Date.now(),
      name,
      price,
      image
    };
    menuItems.push(newItem);
    saveMenu();
    renderAdminMenu();
    renderMenu();
    addItemForm.reset();
  }
});

// Edit Item Submit
editItemForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("edit-item-id").value;
  const name = document.getElementById("edit-item-name").value.trim();
  const price = Number(document.getElementById("edit-item-price").value);
  const image = document.getElementById("edit-item-image").value.trim();

  const itemIndex = menuItems.findIndex(item => item.id === id);
  if (itemIndex > -1 && name && price && image) {
    menuItems[itemIndex] = { ...menuItems[itemIndex], name, price, image };
    saveMenu();
    renderAdminMenu();
    renderMenu();
    
    // Update cart if the edited item is already inside it
    // Note: We're doing a soft update or doing nothing here, 
    // real-world app might recalculate cart if price changed, but for simplicity:
    Object.keys(cart).forEach(cartKey => {
       // if we found the old name matching, but we changed name, it's a bit complex.
       // we simply let them keep checkout for existing items or clear cart 
    });
    renderCart();

    editModal.classList.add("hidden");
  }
});


// Initialization
initMenu();
renderMenu();
renderCart();

