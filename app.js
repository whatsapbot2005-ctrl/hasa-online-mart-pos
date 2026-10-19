(() => {
  "use strict";
  const KEY = "hasaOnlineMartPOS_v1";
  let state = { products: [], sales: [] };
  let cart = [];
  const $ = id => document.getElementById(id);
  const money = n => "Rs. " + Number(n || 0).toLocaleString("en-LK", {minimumFractionDigits:2, maximumFractionDigits:2});
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const todayKey = () => new Date().toLocaleDateString("en-CA");
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) { const data = JSON.parse(raw); state.products = Array.isArray(data.products) ? data.products : []; state.sales = Array.isArray(data.sales) ? data.sales : []; } }
    catch { toast("Saved data could not be read. Restore a valid backup if you have one."); }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(state)); renderAll(); }
  function toast(msg) { const el=$("toast"); el.textContent=msg; el.classList.remove("hidden"); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.add("hidden"),3000); }
  function switchTab(name) {
    document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
    ["sales","products","history"].forEach(n=>$(n+"Panel").classList.toggle("hidden",n!==name));
  }
  document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
  function renderStats() {
    const todays = state.sales.filter(s=>s.dateKey===todayKey());
    $("todaySales").textContent=money(todays.reduce((a,s)=>a+s.total,0));
    $("todayProfit").textContent=money(todays.reduce((a,s)=>a+s.profit,0));
    $("productCount").textContent=state.products.length;
    $("lowStock").textContent=state.products.filter(p=>p.stock<=5).length;
  }
  function renderProducts() {
    const tbody=$("productTable");
    if (!state.products.length) { tbody.innerHTML='<tr><td colspan="6">No products yet. Add your first product above.</td></tr>'; return; }
    tbody.innerHTML=state.products.map(p=>`<tr><td><strong>${esc(p.name)}</strong></td><td>${esc(p.code||"—")}</td><td>${money(p.buy)}</td><td>${money(p.sell)}</td><td class="${p.stock<=5?"stock-low":""}">${p.stock}</td><td><button class="small-btn" data-edit="${p.id}">Edit</button><button class="small-btn danger" data-delete="${p.id}">Delete</button></td></tr>`).join("");
  }
  function renderSearch() {
    const q=$("productSearch").value.trim().toLowerCase();
    const items=state.products.filter(p=>(p.name+" "+p.code).toLowerCase().includes(q));
    $("productResults").innerHTML=items.length?items.map(p=>`<div class="product-result"><div><strong>${esc(p.name)}</strong><div class="subtext">${esc(p.code||"No code")} • Stock: ${p.stock} • ${money(p.sell)}</div></div><button class="primary" data-add="${p.id}" ${p.stock<1?"disabled":""}>Add</button></div>`).join(""):'<p class="empty">No matching products. Add products in Products & Stock first.</p>';
  }
  function renderCart() {
    const box=$("cartItems");
    if(!cart.length) box.innerHTML='<p class="empty">Your cart is empty.</p>';
    else box.innerHTML=cart.map(i=>`<div class="cart-line"><div><strong>${esc(i.name)}</strong><div class="subtext">${money(i.sell)} each</div><div class="qty"><button data-qty="${i.id}" data-delta="-1">−</button><span>${i.qty}</span><button data-qty="${i.id}" data-delta="1">+</button><button class="remove" data-remove="${i.id}">Remove</button></div></div><strong>${money(i.sell*i.qty)}</strong></div>`).join("");
    $("cartTotal").textContent=money(cart.reduce((a,i)=>a+i.sell*i.qty,0));
  }
  function renderHistory() {
    const tbody=$("historyTable");
    if(!state.sales.length){tbody.innerHTML='<tr><td colspan="7">No completed sales yet.</td></tr>';return;}
    tbody.innerHTML=[...state.sales].reverse().map(s=>`<tr><td>${esc(s.date)}</td><td>${esc(s.id)}</td><td>${s.items.reduce((a,i)=>a+i.qty,0)}</td><td>${esc(s.payment)}</td><td>${money(s.total)}</td><td>${money(s.profit)}</td><td><button class="small-btn" data-view-sale="${s.id}">View</button></td></tr>`).join("");
  }
  function renderAll(){renderStats();renderProducts();renderSearch();renderCart();renderHistory();}
  $("productSearch").addEventListener("input",renderSearch);
  $("productForm").addEventListener("submit",e=>{
    e.preventDefault();
    const id=$("editId").value;
    const name=$("pName").value.trim(), code=$("pCode").value.trim();
    const buy=Number($("pBuy").value), sell=Number($("pSell").value), stock=Number($("pStock").value);
    if(!name||buy<0||sell<0||!Number.isInteger(stock)||stock<0){toast("Please enter valid product details.");return;}
    if(code && state.products.some(p=>p.code.toLowerCase()===code.toLowerCase()&&p.id!==id)){toast("That product code is already in use.");return;}
    if(id){const p=state.products.find(x=>x.id===id);if(p)Object.assign(p,{name,code,buy,sell,stock});toast("Product updated.");}
    else {state.products.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),name,code,buy,sell,stock});toast("Product added.");}
    resetProductForm();save();
  });
  function resetProductForm(){$("productForm").reset();$("editId").value="";$("saveProduct").textContent="Save Product";$("cancelEdit").classList.add("hidden");}
  $("cancelEdit").addEventListener("click",resetProductForm);
  $("productTable").addEventListener("click",e=>{
    const edit=e.target.closest("[data-edit]")?.dataset.edit, del=e.target.closest("[data-delete]")?.dataset.delete;
    if(edit){const p=state.products.find(x=>x.id===edit);if(!p)return;$("editId").value=p.id;$("pName").value=p.name;$("pCode").value=p.code;$("pBuy").value=p.buy;$("pSell").value=p.sell;$("pStock").value=p.stock;$("saveProduct").textContent="Update Product";$("cancelEdit").classList.remove("hidden");window.scrollTo({top:0,behavior:"smooth"});}
    if(del){const p=state.products.find(x=>x.id===del);if(!p)return;if(!confirm(`Delete "${p.name}"? Past sales will remain in history.`))return;state.products=state.products.filter(x=>x.id!==del);cart=cart.filter(x=>x.id!==del);save();toast("Product deleted.");}
  });
  $("productResults").addEventListener("click",e=>{
    const id=e.target.closest("[data-add]")?.dataset.add;if(!id)return;
    const p=state.products.find(x=>x.id===id);if(!p)return;
    const inCart=cart.find(x=>x.id===id), qty=inCart?inCart.qty:0;
    if(qty>=p.stock){toast("Not enough stock available.");return;}
    if(inCart)inCart.qty++;else cart.push({id:p.id,name:p.name,buy:p.buy,sell:p.sell,qty:1});
    renderCart();
  });
  $("cartItems").addEventListener("click",e=>{
    const qtyBtn=e.target.closest("[data-qty]"), rem=e.target.closest("[data-remove]");
    if(qtyBtn){const item=cart.find(i=>i.id===qtyBtn.dataset.qty),p=state.products.find(x=>x.id===qtyBtn.dataset.qty);if(!item||!p)return;const next=item.qty+Number(qtyBtn.dataset.delta);if(next<1)cart=cart.filter(i=>i.id!==item.id);else if(next>p.stock){toast("Not enough stock available.");return;}else item.qty=next;renderCart();}
    if(rem){cart=cart.filter(i=>i.id!==rem.dataset.remove);renderCart();}
  });
  $("completeSale").addEventListener("click",()=>{
    if(!cart.length){toast("Cart is empty.");return;}
    for(const i of cart){const p=state.products.find(x=>x.id===i.id);if(!p||p.stock<i.qty){toast(`Insufficient stock for ${i.name}.`);return;}}
    const items=cart.map(i=>({...i}));
    const total=items.reduce((a,i)=>a+i.sell*i.qty,0), profit=items.reduce((a,i)=>a+(i.sell-i.buy)*i.qty,0);
    items.forEach(i=>{state.products.find(p=>p.id===i.id).stock-=i.qty;});
    const now=new Date(), sale={id:"HASA-"+now.getTime().toString().slice(-8),date:now.toLocaleString(),dateKey:todayKey(),payment:$("paymentMethod").value,items,total,profit};
    state.sales.push(sale);cart=[];save();showReceipt(sale);toast("Sale completed successfully.");switchTab("sales");
  });
  function showReceipt(s) {
    const el=$("receipt");el.innerHTML=`<h3>HASA Online Mart</h3><p>Sales Receipt Preview</p><p>${esc(s.date)}</p><p>Sale ID: ${esc(s.id)}</p><hr><ul>${s.items.map(i=>`<li>${esc(i.name)} × ${i.qty} — ${money(i.sell*i.qty)}</li>`).join("")}</ul><p>Payment: ${esc(s.payment)}</p><div class="receipt-total">Total: ${money(s.total)}</div><p class="subtext">Screen preview only — no print or receipt download option.</p>`;el.classList.remove("hidden");el.scrollIntoView({behavior:"smooth",block:"nearest"});
  }
  $("historyTable").addEventListener("click",e=>{const id=e.target.closest("[data-view-sale]")?.dataset.viewSale;if(!id)return;const sale=state.sales.find(s=>s.id===id);if(sale){switchTab("sales");showReceipt(sale);}});
  $("exportBtn").addEventListener("click",()=>{
    const blob=new Blob([JSON.stringify({app:"HASA Online Mart POS",version:1,exportedAt:new Date().toISOString(),...state},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="HASA-Online-Mart-Backup.json";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);toast("Backup file downloaded.");
  });
  load();renderAll();
})();
