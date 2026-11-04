const CFG = window.AUTOKOR_CONFIG || {};
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let products = [], activeCondition = "", loadState = "loading";

const modelOptions = {
  Hyundai: ["Accent","Elantra","Sonata","Tucson","Avante"],
  Kia: ["Rio","Cerato","Optima","Sportage","Sorento"]
};
const baseCategories = ["محرك","فرامل","كهرباء","هيكل","تعليق"];
const BRANDS = {hyundai:"Hyundai","هيونداي":"Hyundai",kia:"Kia","كيا":"Kia"};
const ALIAS = {
  "اسم القطعة":"name","الاسم":"name","name":"name","الشركة":"brand","brand":"brand","الموديل":"model","model":"model",
  "السنة":"year","سنة الصنع":"year","year":"year","النوع":"category","القسم":"category","category":"category",
  "الحالة":"condition","condition":"condition","السعر":"price","price":"price","الصورة":"image","image":"image",
  "ظاهر":"show","عرض":"show","show":"show"
};
const arabicBrand = (v) => v === "Hyundai" ? "هيونداي" : v === "Kia" ? "كيا" : v;

function parseCSV(text){
  const rows = []; let row = [], f = "", q = false;
  text = text.replace(/^\uFEFF/, "");
  for(let i = 0; i < text.length; i++){
    const c = text[i];
    if(q){ if(c === '"'){ if(text[i+1] === '"'){ f += '"'; i++; } else q = false; } else f += c; }
    else if(c === '"') q = true;
    else if(c === ","){ row.push(f); f = ""; }
    else if(c === "\n" || c === "\r"){ if(c === "\r" && text[i+1] === "\n") i++; row.push(f); f = ""; rows.push(row); row = []; }
    else f += c;
  }
  if(f !== "" || row.length){ row.push(f); rows.push(row); }
  return rows;
}
function rowsToProducts(rows){
  if(!rows.length) return [];
  const heads = rows[0].map(h => ALIAS[h.trim().toLowerCase()] || h.trim());
  return rows.slice(1).map((r, i) => {
    const o = {id: i + 1};
    heads.forEach((h, j) => o[h] = (r[j] || "").trim());
    o.brand = BRANDS[o.brand.toLowerCase()] || o.brand;
    return o;
  }).filter(p => p.name && !["no","لا","0","false","مخفي"].includes((p.show || "").toLowerCase()));
}
async function loadProducts(){
  if(!CFG.SHEET_CSV_URL){ products = window.AUTOKOR_PRODUCTS || []; loadState = "demo"; return; }
  try{
    const r = await fetch(CFG.SHEET_CSV_URL);
    if(!r.ok) throw new Error(r.status);
    products = rowsToProducts(parseCSV(await r.text())); loadState = "ok";
  }catch(e){ products = []; loadState = "error"; }
}
function imgSrc(v){ return !v ? "" : /^https?:\/\//i.test(v) ? v : "assets/products/" + encodeURIComponent(v); }

function refreshCategories(){
  const sel = $("categoryFilter"), cur = sel.value;
  const list = [...new Set([...baseCategories, ...products.map(p => p.category).filter(Boolean)])];
  sel.innerHTML = '<option value="">كل القطع</option>' + list.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
  if(list.includes(cur)) sel.value = cur;
}
function refreshModels(){
  const brand = $("brandFilter").value, sel = $("modelFilter"), cur = sel.value;
  const fromData = products.filter(p => !brand || p.brand === brand).map(p => p.model).filter(Boolean);
  const base = brand ? (modelOptions[brand] || []) : Object.values(modelOptions).flat();
  const list = [...new Set([...base, ...fromData])];
  sel.innerHTML = '<option value="">كل الموديلات</option>' + list.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join("");
  if(list.includes(cur)) sel.value = cur;
}
function productCard(p){
  const src = imgSrc(p.image);
  const visual = src
    ? `<img src="${esc(src)}" alt="${esc(p.name)}" loading="lazy" onerror="this.remove();this.parentNode?.classList?.remove('has-img')">`
    : `<img class="ph" src="assets/part-placeholder.svg" alt="" width="56" height="56">`;
  const sub = [p.model, p.year, p.condition].filter(Boolean).map(esc).join(" · ");
  return `<article class="product-card">
    <div class="product-visual${src ? " has-img" : ""}">${p.demo ? '<span class="demo-badge">نموذج توضيحي</span>' : ""}${visual}</div>
    <div class="product-info">
      <div class="product-meta"><span>${esc(arabicBrand(p.brand))}</span><span>${esc(p.category)}</span></div>
      <h3>${esc(p.name)}</h3><p>${sub}</p>
      <div class="product-bottom"><div class="product-price">السعر <b>${esc(p.price) || "عند الاستفسار"}</b></div>
      <button class="product-ask" data-product="${p.id}">استفسر عنها ←</button></div>
    </div></article>`;
}
function renderProducts(){
  const grid = $("productGrid");
  if(loadState === "loading"){ grid.innerHTML = '<div class="empty-state"><b>جاري تحميل القطع…</b></div>'; return; }
  if(loadState === "error"){
    grid.innerHTML = '<div class="empty-state"><b>تعذّر تحميل القائمة الآن</b>يمكنك إرسال طلبك مباشرة عبر واتساب وسنساعدك.</div>';
    $("resultsCount").textContent = ""; return;
  }
  const brand = $("brandFilter").value, model = $("modelFilter").value, category = $("categoryFilter").value;
  const list = products.filter(p => (!brand || p.brand === brand) && (!model || p.model === model) &&
    (!category || p.category === category) && (!activeCondition || p.condition === activeCondition));
  grid.innerHTML = list.length ? list.map(productCard).join("") :
    '<div class="empty-state"><b>ما لقينا نتائج مطابقة حالياً</b>أرسل طلبك وسنساعدك في البحث عن القطعة.</div>';
  $("resultsCount").textContent = loadState === "demo" ? `${list.length} نماذج توضيحية` : `${list.length} قطعة`;
}
function waUrl(message){ return `https://wa.me/${CFG.WHATSAPP || ""}?text=${encodeURIComponent(message)}`; }
function openWhatsApp(message){ window.open(waUrl(message), "_blank", "noopener"); }
const goCatalog = () => $("catalog").scrollIntoView({behavior: "smooth"});

$("brandFilter").addEventListener("change", () => { refreshModels(); renderProducts(); });
["modelFilter","categoryFilter"].forEach(id => $(id).addEventListener("change", renderProducts));
$("searchForm").addEventListener("submit", (e) => { e.preventDefault(); renderProducts(); goCatalog(); });
document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active"); activeCondition = btn.dataset.condition; renderProducts();
}));
document.querySelectorAll(".brand-card").forEach(btn => btn.addEventListener("click", () => {
  $("brandFilter").value = btn.dataset.brand; refreshModels(); renderProducts(); goCatalog();
}));
document.querySelectorAll("[data-model]").forEach(btn => btn.addEventListener("click", () => {
  const m = btn.dataset.model;
  const brand = Object.keys(modelOptions).find(b => modelOptions[b].includes(m)) || (products.find(p => p.model === m) || {}).brand || "";
  $("brandFilter").value = brand; refreshModels(); $("modelFilter").value = m; renderProducts(); goCatalog();
}));
$("productGrid").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-product]"); if(!btn) return;
  const p = products.find(x => x.id === Number(btn.dataset.product)); if(!p) return;
  openWhatsApp(`مرحباً، أريد الاستفسار عن قطعة: ${p.name}\nالشركة: ${arabicBrand(p.brand)}\nالموديل: ${p.model || "-"}${p.year ? "\nالسنة: " + p.year : ""}\nالحالة: ${p.condition || "-"}\nيرجى تأكيد التوفر والسعر.`);
});
$("requestForm").addEventListener("submit", (e) => {
  e.preventDefault();
  openWhatsApp(`مرحباً، أريد طلب قطعة غيار.\nالشركة: ${$("requestBrand").value}\nالموديل: ${$("requestModel").value}\nسنة الصنع: ${$("requestYear").value || "غير محددة"}\nالقطعة: ${$("requestPart").value}\nتفاصيل إضافية: ${$("requestDetails").value || "لا يوجد"}`);
});
$("generalWhatsapp").href = waUrl("مرحباً، أريد الاستفسار عن قطعة غيار.");
$("generalWhatsapp").target = "_blank"; $("generalWhatsapp").rel = "noopener";
document.querySelectorAll("[data-tel]").forEach(a => a.href = "tel:+" + (CFG.WHATSAPP || ""));
$("menuToggle").addEventListener("click", () => {
  const nav = $("mainNav"); nav.classList.toggle("open");
  $("menuToggle").setAttribute("aria-expanded", nav.classList.contains("open"));
});
document.querySelectorAll(".main-nav a").forEach(a => a.addEventListener("click", () => { $("mainNav").classList.remove("open"); $("menuToggle").setAttribute("aria-expanded", "false"); }));
$("year").textContent = new Date().getFullYear();
renderProducts();
loadProducts().then(() => { refreshCategories(); refreshModels(); renderProducts(); });
