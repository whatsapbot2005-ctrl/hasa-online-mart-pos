import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  runTransaction
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

/* ==================================
   FIREBASE CONFIGURATION
================================== */

const firebaseConfig = {
  apiKey: "// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBDLntgYozFdfZd8AcB6cVX4BvL_Xe4AzI",
  authDomain: "hasa-online-mart.firebaseapp.com",
  projectId: "hasa-online-mart",
  storageBucket: "hasa-online-mart.firebasestorage.app",
  messagingSenderId: "824071240289",
  appId: "1:824071240289:web:13d37bff858155535dc820",
  measurementId: "G-JXDVEHTEDP"
};",
  authDomain: "hasa-online-mart.firebaseapp.com",
  projectId: "hasa-online-mart",
  storageBucket: "hasa-online-mart.firebasestorage.app",
  messagingSenderId: "824071240289",
  appId: "1:824071240289:web:13d37bff858155535dc820"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

/* ==================================
   APP STATE
================================== */

let currentUser = null;

let state = {
  products: [],
  sales: []
};

let cart = [];

let unsubscribeProducts = null;
let unsubscribeSales = null;

const $ = id => document.getElementById(id);

const money = n =>
  "Rs. " + Number(n || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const esc = s =>
  String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);

const todayKey = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const productsRef = () =>
  collection(db, "users", currentUser.uid, "products");

const salesRef = () =>
  collection(db, "users", currentUser.uid, "sales");

/* ==================================
   NOTIFICATIONS
================================== */

function toast(message) {
  const el = $("toast");

  el.textContent = message;
  el.classList.remove("hidden");

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {
    el.classList.add("hidden");
  }, 3500);
}

/* ==================================
   LOGIN
================================== */

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  const button = $("loginButton");
  const error = $("loginError");

  error.textContent = "";
  button.disabled = true;
  button.textContent = "Logging in...";

  try {
    await signInWithEmailAndPassword(
      auth,
      $("loginEmail").value.trim(),
      $("loginPassword").value
    );
  } catch (err) {
    console.error(err);

    const messages = {
      "auth/invalid-credential":
        "Email or password is incorrect.",
      "auth/invalid-email":
        "Please enter a valid email address.",
      "auth/too-many-requests":
        "Too many attempts. Please try again later.",
      "auth/network-request-failed":
        "Check your internet connection."
    };

    error.textContent =
      messages[err.code] ||
      "Login failed. Please check your details and Firebase settings.";
  } finally {
    button.disabled = false;
    button.textContent = "Login";
  }
});

/* ==================================
   AUTH STATE
================================== */

onAuthStateChanged(auth, user => {
  if (unsubscribeProducts) {
    unsubscribeProducts();
    unsubscribeProducts = null;
  }

  if (unsubscribeSales) {
    unsubscribeSales();
    unsubscribeSales = null;
  }

  currentUser = user;

  if (!user) {
    $("loginScreen").classList.remove("hidden");
    $("appContent").classList.add("hidden");

    state = { products: [], sales: [] };
    cart = [];

    return;
  }

  $("loginScreen").classList.add("hidden");
  $("appContent").classList.remove("hidden");

  state = { products: [], sales: [] };
  cart = [];

  renderAll();
  startFirebaseListeners();
});

$("logoutBtn").addEventListener("click", async () => {
  try {
    await signOut(auth);
    toast("Logged out successfully.");
  } catch (err) {
    console.error(err);
    toast("Logout failed.");
  }
});

/* ==================================
   FIREBASE LIVE DATA
================================== */

function startFirebaseListeners() {
  unsubscribeProducts = onSnapshot(
    productsRef(),

    snapshot => {
      state.products = snapshot.docs.map(d => ({
        ...d.data(),
        id: d.id
      }));

      // Remove cart items whose products no longer exist.
      cart = cart.filter(item =>
        state.products.some(p => p.id === item.id)
      );

      renderAll();
    },

    error => {
      console.error(error);
      toast("Could not load products. Check Firestore Rules.");
    }
  );

  unsubscribeSales = onSnapshot(
    salesRef(),

    snapshot => {
      state.sales = snapshot.docs.map(d => ({
        ...d.data(),
        docId: d.id
      }));

      state.sales.sort((a, b) =>
        Number(b.createdAt || 0) - Number(a.createdAt || 0)
      );

      renderAll();
    },

    error => {
      console.error(error);
      toast("Could not load sales. Check Firestore Rules.");
    }
  );
}

/* ==================================
   TABS
================================== */

function switchTab(name) {
  document.querySelectorAll(".tab").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.tab === name
    );
  });

  ["sales", "products", "history"].forEach(tab => {
    $(tab + "Panel").classList.toggle(
      "hidden",
      tab !== name
    );
  });
}

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    switchTab(button.dataset.tab);
  });
});

/* ==================================
   DASHBOARD
================================== */

function renderStats() {
  const todaysSales = state.sales.filter(
    sale => sale.dateKey === todayKey()
  );

  $("todaySales").textContent = money(
    todaysSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0)
  );

  $("todayProfit").textContent = money(
    todaysSales.reduce((sum, sale) => sum + Number(sale.profit || 0), 0)
  );

  $("productCount").textContent = state.products.length;

  $("lowStock").textContent = state.products.filter(
    product => Number(product.stock) <= 5
  ).length;
}

/* ==================================
   PRODUCTS TABLE
================================== */

function renderProducts() {
  const tbody = $("productTable");

  if (!state.products.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">No products yet. Add your first product above.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.products.map(product => `
    <tr>
      <td><strong>${esc(product.name)}</strong></td>
      <td>${esc(product.code || "—")}</td>
      <td>${money(product.buy)}</td>
      <td>${money(product.sell)}</td>
      <td class="${Number(product.stock) <= 5 ? "stock-low" : ""}">
        ${Number(product.stock)}
      </td>
      <td>
        <button class="small-btn" data-edit="${esc(product.id)}">
          Edit
        </button>
        <button class="small-btn danger" data-delete="${esc(product.id)}">
          Delete
        </button>
      </td>
    </tr>
  `).join("");
}

/* ==================================
   PRODUCT SEARCH
================================== */

function renderSearch() {
  const query = $("productSearch").value.trim().toLowerCase();

  const products = state.products.filter(product =>
    `${product.name} ${product.code || ""}`
      .toLowerCase()
      .includes(query)
  );

  $("productResults").innerHTML = products.length
    ? products.map(product => `
      <div class="product-result">
        <div>
          <strong>${esc(product.name)}</strong>
          <div class="subtext">
            ${esc(product.code || "No code")}
            • Stock: ${Number(product.stock)}
            • ${money(product.sell)}
          </div>
        </div>

        <button
          class="primary"
          data-add="${esc(product.id)}"
          ${Number(product.stock) < 1 ? "disabled" : ""}
        >
          Add
        </button>
      </div>
    `).join("")
    : '<p class="empty">No matching products.</p>';
}

$("productSearch").addEventListener("input", renderSearch);

/* ==================================
   CART
================================== */

function renderCart() {
  const box = $("cartItems");

  if (!cart.length) {
    box.innerHTML = '<p class="empty">Your cart is empty.</p>';
  } else {
    box.innerHTML = cart.map(item => `
      <div class="cart-line">
        <div>
          <strong>${esc(item.name)}</strong>

          <div class="subtext">${money(item.sell)} each</div>

          <div class="qty">
            <button data-qty="${esc(item.id)}" data-delta="-1">−</button>
            <span>${item.qty}</span>
            <button data-qty="${esc(item.id)}" data-delta="1">+</button>
            <button class="remove" data-remove="${esc(item.id)}">
              Remove
            </button>
          </div>
        </div>

        <strong>${money(item.sell * item.qty)}</strong>
      </div>
    `).join("");
  }

  $("cartTotal").textContent = money(
    cart.reduce((sum, item) => sum + item.sell * item.qty, 0)
  );
}

/* ==================================
   ADD PRODUCT
================================== */

$("productForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentUser) return;

  const id = $("editId").value;
  const name = $("pName").value.trim();
  const code = $("pCode").value.trim();

  const buy = Number($("pBuy").value);
  const sell = Number($("pSell").value);
  const stock = Number($("pStock").value);

  if (
    !name ||
    !Number.isFinite(buy) ||
    !Number.isFinite(sell) ||
    buy < 0 ||
    sell < 0 ||
    !Number.isInteger(stock) ||
    stock < 0
  ) {
    toast("Please enter valid product details.");
    return;
  }

  const duplicate = state.products.some(product =>
    product.code &&
    code &&
    product.code.toLowerCase() === code.toLowerCase() &&
    product.id !== id
  );

  if (duplicate) {
    toast("That product code is already in use.");
    return;
  }

  const saveButton = $("saveProduct");
  saveButton.disabled = true;

  try {
    const product = { name, code, buy, sell, stock };

    if (id) {
      await updateDoc(doc(productsRef(), id), product);
      toast("Product updated in Firebase.");
    } else {
      await addDoc(productsRef(), product);
      toast("Product saved to Firebase.");
    }

    resetProductForm();
  } catch (err) {
    console.error(err);
    toast("Could not save product. Check Firebase Rules.");
  } finally {
    saveButton.disabled = false;
  }
});

function resetProductForm() {
  $("productForm").reset();
  $("editId").value = "";
  $("saveProduct").textContent = "Save Product";
  $("cancelEdit").classList.add("hidden");
}

$("cancelEdit").addEventListener("click", resetProductForm);

/* ==================================
   EDIT / DELETE PRODUCTS
================================== */

$("productTable").addEventListener("click", async event => {
  const editId = event.target.closest("[data-edit]")?.dataset.edit;
  const deleteId = event.target.closest("[data-delete]")?.dataset.delete;

  if (editId) {
    const product = state.products.find(p => p.id === editId);
    if (!product) return;

    $("editId").value = product.id;
    $("pName").value = product.name;
    $("pCode").value = product.code || "";
    $("pBuy").value = product.buy;
    $("pSell").value = product.sell;
    $("pStock").value = product.stock;

    $("saveProduct").textContent = "Update Product";
    $("cancelEdit").classList.remove("hidden");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (deleteId) {
    const product = state.products.find(p => p.id === deleteId);
    if (!product) return;

    if (!confirm(`Delete "${product.name}"? Past sales will remain in history.`)) {
      return;
    }

    try {
      await deleteDoc(doc(productsRef(), deleteId));

      cart = cart.filter(item => item.id !== deleteId);

      renderCart();
      toast("Product deleted from Firebase.");
    } catch (err) {
      console.error(err);
      toast("Could not delete product.");
    }
  }
});

/* ==================================
   ADD TO CART
================================== */

$("productResults").addEventListener("click", event => {
  const id = event.target.closest("[data-add]")?.dataset.add;
  if (!id) return;

  const product = state.products.find(p => p.id === id);
  if (!product) return;

  const existing = cart.find(item => item.id === id);
  const currentQty = existing ? existing.qty : 0;

  if (currentQty >= Number(product.stock)) {
    toast("Not enough stock available.");
    return;
  }

  if (existing) {
    existing.qty++;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      buy: Number(product.buy),
      sell: Number(product.sell),
      qty: 1
    });
  }

  renderCart();
});

$("cartItems").addEventListener("click", event => {
  const qtyButton = event.target.closest("[data-qty]");
  const removeButton = event.target.closest("[data-remove]");

  if (qtyButton) {
    const id = qtyButton.dataset.qty;
    const item = cart.find(i => i.id === id);
    const product = state.products.find(p => p.id === id);

    if (!item || !product) return;

    const nextQty = item.qty + Number(qtyButton.dataset.delta);

    if (nextQty < 1) {
      cart = cart.filter(i => i.id !== id);
    } else if (nextQty > Number(product.stock)) {
      toast("Not enough stock available.");
      return;
    } else {
      item.qty = nextQty;
    }

    renderCart();
  }

  if (removeButton) {
    cart = cart.filter(i => i.id !== removeButton.dataset.remove);
    renderCart();
  }
});

/* ==================================
   COMPLETE SALE
================================== */

$("completeSale").addEventListener("click", async () => {
  if (!currentUser) return;

  if (!cart.length) {
    toast("Cart is empty.");
    return;
  }

  const button = $("completeSale");
  button.disabled = true;

  const items = cart.map(item => ({ ...item }));

  const saleId =
    "HASA-" + Date.now().toString().slice(-8);

  const saleDocument = doc(salesRef());

  const now = new Date();

  const sale = {
    id: saleId,
    date: now.toLocaleString(),
    dateKey: todayKey(),
    createdAt: Date.now(),
    payment: $("paymentMethod").value,
    items,
    total: 0,
    profit: 0
  };

  try {
    await runTransaction(db, async transaction => {
      const freshProducts = [];

      // Read all products before writing any changes.
      for (const item of items) {
        const productRef = doc(productsRef(), item.id);
        const productSnapshot = await transaction.get(productRef);

        if (!productSnapshot.exists()) {
          throw new Error(`Product not found: ${item.name}`);
        }

        const product = productSnapshot.data();

        if (Number(product.stock) < item.qty) {
          throw new Error(`Insufficient stock for ${item.name}.`);
        }

        freshProducts.push({
          ref: productRef,
          data: product,
          item
        });
      }

      for (const entry of freshProducts) {
        const product = entry.data;
        const item = entry.item;

        sale.total += Number(product.sell) * item.qty;
        sale.profit +=
          (Number(product.sell) - Number(product.buy)) * item.qty;

        transaction.update(entry.ref, {
          stock: Number(product.stock) - item.qty
        });
      }

      transaction.set(saleDocument, sale);
    });

    cart = [];

    $("receipt").classList.add("hidden");

    renderCart();

    showReceipt(sale);

    toast("Sale saved to Firebase successfully.");

    switchTab("sales");
  } catch (err) {
    console.error(err);
    toast(err.message || "Sale failed. Please try again.");
  } finally {
    button.disabled = false;
  }
});

/* ==================================
   RECEIPT PREVIEW
================================== */

function showReceipt(sale) {
  const element = $("receipt");

  element.innerHTML = `
    <h3>HASA Online Mart</h3>
    <p>Sales Receipt Preview</p>
    <p>${esc(sale.date)}</p>
    <p>Sale ID: ${esc(sale.id)}</p>
    <hr>

    <ul>
      ${sale.items.map(item => `
        <li>
          ${esc(item.name)} × ${item.qty}
          — ${money(Number(item.sell) * item.qty)}
        </li>
      `).join("")}
    </ul>

    <p>Payment: ${esc(sale.payment)}</p>

    <div class="receipt-total">
      Total: ${money(sale.total)}
    </div>

    <p class="subtext">
      Screen preview only — no printing or receipt download.
    </p>
  `;

  element.classList.remove("hidden");

  element.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}

/* ==================================
   SALES HISTORY
================================== */

function renderHistory() {
  const tbody = $("historyTable");

  if (!state.sales.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">No completed sales yet.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.sales.map(sale => `
    <tr>
      <td>${esc(sale.date)}</td>
      <td>${esc(sale.id)}</td>
      <td>${sale.items.reduce((sum, item) => sum + Number(item.qty), 0)}</td>
      <td>${esc(sale.payment)}</td>
      <td>${money(sale.total)}</td>
      <td>${money(sale.profit)}</td>
      <td>
        <button class="small-btn" data-view-sale="${esc(sale.docId)}">
          View
        </button>
      </td>
    </tr>
  `).join("");
}

$("historyTable").addEventListener("click", event => {
  const documentId =
    event.target.closest("[data-view-sale]")?.dataset.viewSale;

  if (!documentId) return;

  const sale = state.sales.find(s => s.docId === documentId);

  if (sale) {
    switchTab("sales");
    showReceipt(sale);
  }
});

/* ==================================
   BACKUP DATA
================================== */

$("exportBtn").addEventListener("click", () => {
  const backup = {
    app: "HASA Online Mart POS",
    version: 2,
    exportedAt: new Date().toISOString(),
    products: state.products,
    sales: state.sales
  };

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "HASA-Online-Mart-Backup.json";

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);

  toast("Backup downloaded.");
});

/* ==================================
   RENDER EVERYTHING
================================== */

function renderAll() {
  renderStats();
  renderProducts();
  renderSearch();
  renderCart();
  renderHistory();
}
