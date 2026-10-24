import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

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
  apiKey: "AIzaSyBDLntgYozFdfZd8AcB6cVX4BvL_Xe4AzI",
  authDomain: "hasa-online-mart.firebaseapp.com",
  projectId: "hasa-online-mart",
  storageBucket: "hasa-online-mart.firebasestorage.app",
  messagingSenderId: "824071240289",
  appId: "1:824071240289:web:13d37bff858155535dc820",
  measurementId: "G-JXDVEHTEDP"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);


/* ==================================
   APPLICATION STATE
================================== */

let currentUser = null;
let products = [];
let sales = [];
let cart = [];

let stopProductsListener = null;
let stopSalesListener = null;

let editingProductId = null;
let savingProduct = false;
let completingSale = false;


/* ==================================
   HELPERS
================================== */

const $ = (id) => document.getElementById(id);

const money = (amount) =>
  "Rs. " + Number(amount || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const escapeHTML = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

function todayKey() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function showToast(message) {
  const toast = $("toast");

  if (!toast) {
    alert(message);
    return;
  }

  toast.textContent = message;
  toast.classList.remove("hidden");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 3000);
}

function getUserCollection(name) {
  if (!currentUser) {
    throw new Error("Please log in first.");
  }

  return collection(
    db,
    "users",
    currentUser.uid,
    name
  );
}

function getUserDocument(name, id) {
  if (!currentUser) {
    throw new Error("Please log in first.");
  }

  return doc(
    db,
    "users",
    currentUser.uid,
    name,
    id
  );
}

function getProductById(id) {
  return products.find((product) => product.id === id);
}

function stopFirebaseListeners() {
  if (stopProductsListener) {
    stopProductsListener();
    stopProductsListener = null;
  }

  if (stopSalesListener) {
    stopSalesListener();
    stopSalesListener = null;
  }
}


/* ==================================
   LOGIN SCREEN
================================== */

const loginForm = $("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = $("loginEmail")?.value.trim();
    const password = $("loginPassword")?.value;
    const button = $("loginButton");
    const errorBox = $("loginError");

    if (errorBox) {
      errorBox.textContent = "";
    }

    if (!email || !password) {
      if (errorBox) {
        errorBox.textContent = "Enter your email and password.";
      }
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = "Logging in...";
    }

    try {
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
    } catch (error) {
      console.error("Login error:", error);

      const messages = {
        "auth/invalid-credential":
          "Incorrect email or password.",
        "auth/user-not-found":
          "This account was not found.",
        "auth/wrong-password":
          "Incorrect password.",
        "auth/invalid-email":
          "Please enter a valid email.",
        "auth/too-many-requests":
          "Too many attempts. Please try again later.",
        "auth/network-request-failed":
          "Internet connection problem."
      };

      if (errorBox) {
  errorBox.textContent =
    `Firebase Error: ${error.code} — ${error.message}`;
}
      
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Login";
      }
    }
  });
}


/* ==================================
   AUTHENTICATION STATE
================================== */

onAuthStateChanged(auth, (user) => {
  stopFirebaseListeners();

  currentUser = user;

  products = [];
  sales = [];
  cart = [];

  if (user) {
    $("loginScreen")?.classList.add("hidden");
    $("appContent")?.classList.remove("hidden");

    startFirebaseListeners();

    showToast("Logged in successfully.");
  } else {
    $("appContent")?.classList.add("hidden");
    $("loginScreen")?.classList.remove("hidden");

    renderAll();
  }
});


/* ==================================
   LOGOUT
================================== */

$("logoutBtn")?.addEventListener("click", async () => {
  const confirmed = confirm("Do you want to log out?");

  if (!confirmed) return;

  try {
    await signOut(auth);
    showToast("Logged out successfully.");
  } catch (error) {
    console.error("Logout error:", error);
    showToast("Could not log out.");
  }
});


/* ==================================
   FIREBASE REALTIME LISTENERS
================================== */

function startFirebaseListeners() {
  if (!currentUser) return;

  stopProductsListener = onSnapshot(
    getUserCollection("products"),

    (snapshot) => {
      products = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }));

      renderAll();
    },

    (error) => {
      console.error("Products listener error:", error);
      showToast("Could not load products. Check Firestore rules.");
    }
  );

  stopSalesListener = onSnapshot(
    getUserCollection("sales"),

    (snapshot) => {
      sales = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }));

      sales.sort((a, b) =>
        Number(b.createdAt || 0) - Number(a.createdAt || 0)
      );

      renderAll();
    },

    (error) => {
      console.error("Sales listener error:", error);
      showToast("Could not load sales. Check Firestore rules.");
    }
  );
}


/* ==================================
   PRODUCT FORM
================================== */

const productForm = $("productForm");

if (productForm) {
  productForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser || savingProduct) return;

    const name = $("pName")?.value.trim() || "";
    const code = $("pCode")?.value.trim() || "";
    const buyPrice = Number($("pBuy")?.value);
    const sellPrice = Number($("pSell")?.value);
    const stock = Number($("pStock")?.value);

    if (!name) {
      showToast("Enter the product name.");
      return;
    }

    if (
      !Number.isFinite(buyPrice) ||
      !Number.isFinite(sellPrice) ||
      !Number.isFinite(stock) ||
      buyPrice < 0 ||
      sellPrice < 0 ||
      stock < 0
    ) {
      showToast("Enter valid prices and stock quantity.");
      return;
    }

    if (!Number.isInteger(stock)) {
      showToast("Stock quantity must be a whole number.");
      return;
    }

    const productData = {
      name,
      code,
      buyPrice,
      sellPrice,
      stock,
      updatedAt: Date.now()
    };

    savingProduct = true;

    const saveButton = $("saveProduct");

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = "Saving...";
    }

    try {
      if (editingProductId) {
        await updateDoc(
          getUserDocument("products", editingProductId),
          productData
        );

        showToast("Product updated successfully.");
      } else {
        productData.createdAt = Date.now();

        await addDoc(
          getUserCollection("products"),
          productData
        );

        showToast("Product added successfully.");
      }

      resetProductForm();
    } catch (error) {
      console.error("Save product error:", error);
      showToast("Could not save product. Check Firebase settings.");
    } finally {
      savingProduct = false;

      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = "Save Product";
      }
    }
  });
}


/* ==================================
   RESET PRODUCT FORM
================================== */

function resetProductForm() {
  productForm?.reset();

  editingProductId = null;

  if ($("editId")) {
    $("editId").value = "";
  }

  if ($("saveProduct")) {
    $("saveProduct").textContent = "Save Product";
  }

  if ($("cancelEdit")) {
    $("cancelEdit").classList.add("hidden");
  }
}

$("cancelEdit")?.addEventListener("click", resetProductForm);


/* ==================================
   EDIT / DELETE PRODUCT
================================== */

function editProduct(id) {
  const product = getProductById(id);

  if (!product) {
    showToast("Product not found.");
    return;
  }

  editingProductId = id;

  if ($("editId")) $("editId").value = id;
  if ($("pName")) $("pName").value = product.name || "";
  if ($("pCode")) $("pCode").value = product.code || "";
  if ($("pBuy")) $("pBuy").value = product.buyPrice ?? 0;
  if ($("pSell")) $("pSell").value = product.sellPrice ?? 0;
  if ($("pStock")) $("pStock").value = product.stock ?? 0;

  if ($("saveProduct")) {
    $("saveProduct").textContent = "Update Product";
  }

  $("cancelEdit")?.classList.remove("hidden");

  productForm?.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

async function removeProduct(id) {
  const product = getProductById(id);

  if (!product) return;

  if (
    !confirm(`Delete "${product.name}" from your products?`)
  ) {
    return;
  }

  try {
    await deleteDoc(
      getUserDocument("products", id)
    );

    cart = cart.filter((item) => item.id !== id);

    renderAll();

    showToast("Product deleted.");
  } catch (error) {
    console.error("Delete product error:", error);
    showToast("Could not delete product.");
  }
}


/* ==================================
   PRODUCT TABLE
================================== */

function renderProducts() {
  const table = $("productTable");

  if (!table) return;

  if (products.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="6">No products added yet.</td>
      </tr>
    `;
    return;
  }

  table.innerHTML = products.map((product) => `
    <tr>
      <td>${escapeHTML(product.name)}</td>
      <td>${escapeHTML(product.code || "-")}</td>
      <td>${money(product.buyPrice)}</td>
      <td>${money(product.sellPrice)}</td>
      <td>${Number(product.stock || 0)}</td>
      <td>
        <button type="button"
          data-action="edit"
          data-id="${escapeHTML(product.id)}">
          Edit
        </button>

        <button type="button"
          data-action="delete"
          data-id="${escapeHTML(product.id)}">
          Delete
        </button>
      </td>
    </tr>
  `).join("");
}

$("productTable")?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");

  if (!button) return;

  const id = button.dataset.id;

  if (button.dataset.action === "edit") {
    editProduct(id);
  }

  if (button.dataset.action === "delete") {
    removeProduct(id);
  }
});


/* ==================================
   PRODUCT SEARCH
================================== */

$("productSearch")?.addEventListener("input", renderProductSearch);

function renderProductSearch() {
  const input = $("productSearch");
  const results = $("productResults");

  if (!input || !results) return;

  const query = input.value.trim().toLowerCase();

  const matchingProducts = products
    .filter((product) => {
      const name = String(product.name || "").toLowerCase();
      const code = String(product.code || "").toLowerCase();

      return name.includes(query) || code.includes(query);
    })
    .slice(0, 30);

  if (matchingProducts.length === 0) {
    results.innerHTML = "<p>No matching products found.</p>";
    return;
  }

  results.innerHTML = matchingProducts.map((product) => `
    <button type="button"
      class="product-result"
      data-product-id="${escapeHTML(product.id)}"
      ${Number(product.stock || 0) <= 0 ? "disabled" : ""}>

      <strong>${escapeHTML(product.name)}</strong>
      <span>${money(product.sellPrice)}</span>
      <small>Stock: ${Number(product.stock || 0)}</small>
    </button>
  `).join("");
}

$("productResults")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-product-id]");

  if (!button) return;

  addToCart(button.dataset.productId);
});


/* ==================================
   SHOPPING CART
================================== */

function addToCart(id) {
  const product = getProductById(id);

  if (!product) {
    showToast("Product not found.");
    return;
  }

  if (Number(product.stock || 0) <= 0) {
    showToast("This product is out of stock.");
    return;
  }

  const cartItem = cart.find((item) => item.id === id);

  if (cartItem) {
    if (cartItem.quantity >= Number(product.stock)) {
      showToast("Not enough stock available.");
      return;
    }

    cartItem.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      sellPrice: Number(product.sellPrice || 0),
      buyPrice: Number(product.buyPrice || 0),
      quantity: 1
    });
  }

  renderCart();
}

function changeCartQuantity(id, change) {
  const item = cart.find((cartItem) => cartItem.id === id);

  if (!item) return;

  const product = getProductById(id);

  if (!product) {
    cart = cart.filter((cartItem) => cartItem.id !== id);
    renderCart();
    return;
  }

  const newQuantity = item.quantity + change;

  if (newQuantity <= 0) {
    cart = cart.filter((cartItem) => cartItem.id !== id);
  } else if (newQuantity > Number(product.stock || 0)) {
    showToast("Not enough stock available.");
    return;
  } else {
    item.quantity = newQuantity;
  }

  renderCart();
}

function renderCart() {
  const container = $("cartItems");

  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = "<p>Cart is empty.</p>";

    if ($("cartTotal")) {
      $("cartTotal").textContent = money(0);
    }

    return;
  }

  container.innerHTML = cart.map((item) => `
    <div class="cart-item">
      <div>
        <strong>${escapeHTML(item.name)}</strong>
        <div>${money(item.sellPrice)} each</div>
      </div>

      <div class="cart-controls">
        <button type="button"
          data-cart-action="minus"
          data-id="${escapeHTML(item.id)}">−</button>

        <span>${item.quantity}</span>

        <button type="button"
          data-cart-action="plus"
          data-id="${escapeHTML(item.id)}">+</button>

        <button type="button"
          data-cart-action="remove"
          data-id="${escapeHTML(item.id)}">Remove</button>
      </div>

      <strong>${money(item.sellPrice * item.quantity)}</strong>
    </div>
  `).join("");

  const total = cart.reduce(
    (sum, item) => sum + item.sellPrice * item.quantity,
    0
  );

  if ($("cartTotal")) {
    $("cartTotal").textContent = money(total);
  }
}

$("cartItems")?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-cart-action]");

  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.cartAction;

  if (action === "minus") {
    changeCartQuantity(id, -1);
  }

  if (action === "plus") {
    changeCartQuantity(id, 1);
  }

  if (action === "remove") {
    cart = cart.filter((item) => item.id !== id);
    renderCart();
  }
});


/* ==================================
   COMPLETE SALE
================================== */

$("completeSale")?.addEventListener("click", completeSale);

async function completeSale() {
  if (!currentUser || completingSale) return;

  if (cart.length === 0) {
    showToast("Cart is empty.");
    return;
  }

  const paymentMethod =
    $("paymentMethod")?.value || "Cash";

  const saleItems = cart.map((item) => ({
    productId: item.id,
    name: item.name,
    buyPrice: Number(item.buyPrice || 0),
    sellPrice: Number(item.sellPrice || 0),
    quantity: Number(item.quantity || 0)
  }));

  const total = saleItems.reduce(
    (sum, item) => sum + item.sellPrice * item.quantity,
    0
  );

  const profit = saleItems.reduce(
    (sum, item) =>
      sum + (item.sellPrice - item.buyPrice) * item.quantity,
    0
  );

  const saleDate = new Date();

  completingSale = true;

  const saleButton = $("completeSale");

  if (saleButton) {
    saleButton.disabled = true;
    saleButton.textContent = "Processing...";
  }

  try {
    const userId = currentUser.uid;

    const result = await runTransaction(db, async (transaction) => {
      const currentCart = saleItems.map((item) => ({
        ...item
      }));

      const productRefs = currentCart.map((item) =>
        doc(db, "users", userId, "products", item.productId)
      );

      // Read all products before making transaction writes.
      const productSnapshots = [];

      for (const productRef of productRefs) {
        productSnapshots.push(
          await transaction.get(productRef)
        );
      }

      for (let i = 0; i < currentCart.length; i++) {
        const item = currentCart[i];
        const snapshot = productSnapshots[i];

        if (!snapshot.exists()) {
          throw new Error(`Product "${item.name}" no longer exists.`);
        }

        const currentProduct = snapshot.data();
        const currentStock = Number(currentProduct.stock || 0);

        if (currentStock < item.quantity) {
          throw new Error(
            `Not enough stock for "${item.name}". Available: ${currentStock}.`
          );
        }

        transaction.update(productRefs[i], {
          stock: currentStock - item.quantity,
          updatedAt: Date.now()
        });

        item.name = currentProduct.name || item.name;
        item.buyPrice = Number(currentProduct.buyPrice || 0);
        item.sellPrice = Number(currentProduct.sellPrice || 0);
      }

      const finalTotal = currentCart.reduce(
        (sum, item) => sum + item.sellPrice * item.quantity,
        0
      );

      const finalProfit = currentCart.reduce(
        (sum, item) =>
          sum + (item.sellPrice - item.buyPrice) * item.quantity,
        0
      );

      const salesCollection = collection(
        db,
        "users",
        userId,
        "sales"
      );

      const saleRef = doc(salesCollection);

      transaction.set(saleRef, {
        items: currentCart,
        total: finalTotal,
        profit: finalProfit,
        paymentMethod,
        date: saleDate.toISOString(),
        dateKey: todayKey(),
        createdAt: Date.now()
      });

      return {
        saleId: saleRef.id,
        items: currentCart,
        total: finalTotal,
        profit: finalProfit
      };
    });

    cart = [];
    renderCart();

    if ($("productSearch")) {
      $("productSearch").value = "";
    }

    renderProductSearch();

    if ($("receipt")) {
      $("receipt").innerHTML = `
        <div class="receipt-content">
          <h3>HASA Online Mart</h3>
          <p>Sale completed successfully</p>
          <p><strong>Sale ID:</strong> ${escapeHTML(result.saleId)}</p>
          <p><strong>Date:</strong> ${escapeHTML(saleDate.toLocaleString())}</p>
          <hr>
          ${result.items.map((item) => `
            <div>
              ${escapeHTML(item.name)} × ${item.quantity}
              <span>${money(item.sellPrice * item.quantity)}</span>
            </div>
          `).join("")}
          <hr>
          <p><strong>Total: ${money(result.total)}</strong></p>
          <p>Payment: ${escapeHTML(paymentMethod)}</p>
          <p>Thank you!</p>
        </div>
      `;

      $("receipt").classList.remove("hidden");
    }

    showToast("Sale completed and saved to Firebase.");
  } catch (error) {
    console.error("Complete sale error:", error);
    showToast(error.message || "Sale failed. Please try again.");
  } finally {
    completingSale = false;

    if (saleButton) {
      saleButton.disabled = false;
      saleButton.textContent = "Complete Sale";
    }
  }
}


/* ==================================
   SALES HISTORY
================================== */

function renderHistory() {
  const table = $("historyTable");

  if (!table) return;

  if (sales.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="5">No sales recorded yet.</td>
      </tr>
    `;
    return;
  }

  table.innerHTML = sales.map((sale) => {
    const date = sale.date
      ? new Date(sale.date).toLocaleString()
      : new Date(Number(sale.createdAt || 0)).toLocaleString();

    const itemCount = Array.isArray(sale.items)
      ? sale.items.reduce(
          (sum, item) => sum + Number(item.quantity || 0),
          0
        )
      : 0;

    return `
      <tr>
        <td>${escapeHTML(date)}</td>
        <td>${itemCount}</td>
        <td>${money(sale.total)}</td>
        <td>${money(sale.profit)}</td>
        <td>${escapeHTML(sale.paymentMethod || "Cash")}</td>
      </tr>
    `;
  }).join("");
}


/* ==================================
   DASHBOARD STATS
================================== */

function renderStats() {
  const today = todayKey();

  const todaysSales = sales.filter((sale) => {
    if (sale.dateKey) {
      return sale.dateKey === today;
    }

    return sale.date
      ? new Date(sale.date).toDateString() === new Date().toDateString()
      : false;
  });

  const totalSales = todaysSales.reduce(
    (sum, sale) => sum + Number(sale.total || 0),
    0
  );

  const totalProfit = todaysSales.reduce(
    (sum, sale) => sum + Number(sale.profit || 0),
    0
  );

  const lowStock = products.filter(
    (product) => Number(product.stock || 0) <= 5
  ).length;

  if ($("todaySales")) {
    $("todaySales").textContent = money(totalSales);
  }

  if ($("todayProfit")) {
    $("todayProfit").textContent = money(totalProfit);
  }

  if ($("productCount")) {
    $("productCount").textContent = products.length;
  }

  if ($("lowStock")) {
    $("lowStock").textContent = lowStock;
  }

  // Support the alternate ID used in some versions of the HTML.
  if ($("lowStockItems")) {
    $("lowStockItems").textContent = lowStock;
  }
}


/* ==================================
   BACKUP DATA
================================== */

$("exportBtn")?.addEventListener("click", () => {
  if (!currentUser) {
    showToast("Please log in first.");
    return;
  }

  const backup = {
    shop: "HASA Online Mart",
    exportedAt: new Date().toISOString(),
    products,
    sales
  };

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `hasa-pos-backup-${todayKey()}.json`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);

  showToast("Backup downloaded.");
});


/* ==================================
   RENDER EVERYTHING
================================== */

function renderAll() {
  renderProducts();
  renderProductSearch();
  renderCart();
  renderHistory();
  renderStats();
}


/* ==================================
   TAB NAVIGATION
================================== */

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    const tabName = button.dataset.tab;

    // Update active tab button
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.classList.remove("active");
    });

    button.classList.add("active");

    // Hide all tab panels
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.add("hidden");
    });

    // Show selected panel
    const selectedPanel = document.getElementById(
      tabName + "Panel"
    );

    if (selectedPanel) {
      selectedPanel.classList.remove("hidden");
    }

    // Refresh content
    renderAll();
  });
});


/* ==================================
   INITIAL RENDER
================================== */

renderAll();
