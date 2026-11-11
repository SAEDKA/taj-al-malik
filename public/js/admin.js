/* ==========================================================================
   TAJ AL MALIK — Centralized Admin Dashboard Engine
   Analytics | Orders CRM | Products CRUD | Bulk CSV | Branding | RBAC
   ========================================================================== */

const ADMIN_STATE = {
  token: localStorage.getItem('taj_admin_token') || '',
  user: JSON.parse(localStorage.getItem('taj_admin_user') || 'null'),
  data: null,
  orders: [],
};

function fmtOMR(val) {
  return `${parseFloat(val || 0).toFixed(3)} ر.ع`;
}

function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (ADMIN_STATE.token) {
    headers['Authorization'] = `Bearer ${ADMIN_STATE.token}`;
  }
  return headers;
}

async function initAdminDashboard() {
  updateRoleIndicator();
  await loadAdminData();
}

function updateRoleIndicator() {
  const el = document.getElementById('current-role-indicator');
  if (!el) return;
  if (ADMIN_STATE.user) {
    const isAdm = ADMIN_STATE.user.role === 'ADMIN';
    el.textContent = isAdm
      ? `👑 ${ADMIN_STATE.user.full_name} (Admin - صلاحيات كاملة)`
      : `👨‍🍳 ${ADMIN_STATE.user.full_name} (Staff - صلاحيات الطلبات والمنتجات)`;
  } else {
    el.textContent = '👑 سعيد - مدير تاج الملك (Admin)';
  }
}

async function loadAdminData() {
  try {
    const [ovRes, ordRes] = await Promise.all([
      fetch('/api/admin/overview', { headers: getAuthHeaders() }),
      fetch('/api/admin/orders', { headers: getAuthHeaders() }),
    ]);
    ADMIN_STATE.data = await ovRes.json();
    const ordJson = await ordRes.json();
    ADMIN_STATE.orders = ordJson.orders || [];

    renderOverviewTab();
    renderOrdersTab();
    renderProductsTab();
    renderCategoriesTab();
    populateAppearanceForm();
    renderStaffTab();
  } catch (err) {
    console.error('Error loading admin dashboard:', err);
  }
}

function switchAdminTab(tabKey, btnEl) {
  document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
  const target = document.getElementById(`tab-${tabKey}`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.sidebar-item').forEach((b) => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
}

/* ==========================================================================
   1. OVERVIEW & ANALYTICS TAB
   ========================================================================== */
function renderOverviewTab() {
  const { kpis, best_sellers, most_viewed, recent_orders, sales_timeline, notifications } = ADMIN_STATE.data;

  document.getElementById('nav-new-orders-badge').textContent = kpis.new_orders || 0;

  document.getElementById('overview-kpis').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">إجمالي الطلبات (Total Orders)</div>
      <div class="kpi-value">${kpis.total_orders}</div>
      <div class="kpi-sub">طلبات جديدة: <strong>${kpis.new_orders}</strong> | قيد التجهيز: <strong>${kpis.active_orders}</strong></div>
    </div>
    <div class="kpi-card green">
      <div class="kpi-label">إجمالي المبيعات (Gross Revenue)</div>
      <div class="kpi-value">${fmtOMR(kpis.gross_revenue_omr)}</div>
      <div class="kpi-sub">المبيعات المكتملة: ${fmtOMR(kpis.completed_revenue_omr)}</div>
    </div>
    <div class="kpi-card gold">
      <div class="kpi-label">متوسط قيمة الطلب (Average Order)</div>
      <div class="kpi-value">${fmtOMR(kpis.average_order_value_omr)}</div>
      <div class="kpi-sub">العملة: الريال العُماني (3 خانات عشرية)</div>
    </div>
    <div class="kpi-card blue">
      <div class="kpi-label">إجمالي العملاء (Customers)</div>
      <div class="kpi-value">${kpis.total_customers}</div>
      <div class="kpi-sub">عملاء متكررون: <strong>${kpis.returning_customers}</strong> | مكتمل: <strong>${kpis.completed_orders}</strong></div>
    </div>
  `;

  // Sales Chart
  const maxRev = Math.max(10, ...(sales_timeline || []).map((d) => d.revenue_omr || 0));
  document.getElementById('sales-chart-bars').innerHTML = (sales_timeline || [])
    .map((d) => {
      const h = Math.max(18, Math.round((d.revenue_omr / maxRev) * 145));
      return `
      <div class="chart-col">
        <span style="font-size:0.75rem;font-weight:700;color:var(--adm-primary);">${parseFloat(d.revenue_omr).toFixed(1)} ر.ع</span>
        <div class="chart-bar" style="height:${h}px;" title="${d.day}: ${d.orders_count} طلبات"></div>
        <span style="font-size:0.74rem;color:var(--adm-muted);">${d.day.slice(5)}</span>
      </div>
    `;
    })
    .join('');

  // Notifications
  document.getElementById('admin-notifications-list').innerHTML = (notifications || [])
    .map(
      (n) => `
      <div style="padding:0.65rem 0.85rem;background:#F8FAFC;border-inline-start:3px solid var(--adm-primary);border-radius:8px;font-size:0.84rem;">
        <div style="font-weight:700;color:var(--adm-primary);">${n.title_ar}</div>
        <div style="color:var(--adm-muted);">${n.message_ar}</div>
      </div>
    `
    )
    .join('');

  // Best Sellers
  document.getElementById('overview-bestsellers-tbody').innerHTML = (best_sellers || [])
    .map(
      (p) => `
      <tr>
        <td><strong>${p.name_ar}</strong><br/><small style="color:var(--adm-muted);">${p.name_en}</small></td>
        <td><strong>${fmtOMR(p.base_price_omr)}</strong></td>
        <td><span class="status-badge status-COMPLETED">${p.sales_count} طلب</span></td>
        <td>${p.views_count} مشاهدة</td>
      </tr>
    `
    )
    .join('');

  // Most Viewed
  document.getElementById('overview-mostviewed-tbody').innerHTML = (most_viewed || [])
    .map(
      (p) => `
      <tr>
        <td><strong>${p.name_ar}</strong></td>
        <td><code>${p.sku}</code></td>
        <td><span class="status-badge status-NEW">${p.views_count} مشاهدة</span></td>
        <td>${p.sales_count} مبيعات</td>
      </tr>
    `
    )
    .join('');

  // Recent Orders
  document.getElementById('overview-recent-orders-tbody').innerHTML = (recent_orders || [])
    .slice(0, 5)
    .map(
      (o) => `
      <tr>
        <td><strong>#${o.order_number}</strong></td>
        <td>${o.customer_name}<br/><small dir="ltr">${o.customer_phone}</small></td>
        <td>${o.fulfillment_type === 'PICKUP' ? '🏪 استلام من فرع صحار' : `🚚 ${o.wilayat || o.governorate}`}</td>
        <td><strong>${fmtOMR(o.total_amount_omr)}</strong></td>
        <td><span class="status-badge status-${o.status}">${o.status}</span></td>
        <td>
          <select class="adm-select" style="padding:0.35rem;font-size:0.8rem;width:140px;" onchange="changeOrderStatus(${o.id}, this.value)">
            ${buildStatusOptionsHTML(o.status)}
          </select>
        </td>
      </tr>
    `
    )
    .join('');
}

function buildStatusOptionsHTML(currentStatus) {
  const statuses = [
    ['NEW', 'New (جديد)'],
    ['CONTACTED', 'Contacted (تم التواصل)'],
    ['CONFIRMED', 'Confirmed (مؤكد)'],
    ['PREPARING', 'Preparing (قيد التجهيز)'],
    ['READY', 'Ready (جاهز)'],
    ['COMPLETED', 'Completed (مكتمل)'],
    ['CANCELLED', 'Cancelled (ملغي)'],
  ];
  return statuses
    .map(([code, label]) => `<option value="${code}" ${currentStatus === code ? 'selected' : ''}>${label}</option>`)
    .join('');
}

/* ==========================================================================
   2. ORDER MANAGEMENT & WHATSAPP WORKFLOW TAB
   ========================================================================== */
async function filterOrdersTable() {
  const status = document.getElementById('orders-status-filter').value;
  const q = document.getElementById('orders-search-filter').value.trim();
  const res = await fetch(`/api/admin/orders?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  ADMIN_STATE.orders = data.orders || [];
  renderOrdersTab();
}

function renderOrdersTab() {
  const tbody = document.getElementById('admin-orders-tbody');
  tbody.innerHTML = (ADMIN_STATE.orders || [])
    .map((o) => {
      const itemsSummary = (o.items || [])
        .map((it) => `• ${it.product_name_ar} × ${it.quantity} ${it.special_notes ? `(${it.special_notes})` : ''}`)
        .join('<br/>');
      const cleanPhone = (o.customer_phone || '').replace(/\D/g, '');
      const waFollowUp = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
        `مرحباً ${o.customer_name}، معك متجر تاج الملك (حلا الملوك) بخصوص طلبك رقم #${o.order_number} (${fmtOMR(o.total_amount_omr)}). حالة الطلب الآن: ${o.status}`
      )}`;

      return `
      <tr>
        <td>
          <strong>#${o.order_number}</strong>
          ${o.is_gift ? '<br/><span class="status-badge status-READY">🎁 طلب هدية</span>' : ''}
        </td>
        <td style="font-size:0.8rem;color:var(--adm-muted);">${o.created_at}</td>
        <td>
          <strong>${o.customer_name}</strong><br/>
          <span dir="ltr" style="font-size:0.82rem;color:var(--adm-muted);">${o.customer_phone}</span>
        </td>
        <td style="font-size:0.84rem;">
          ${o.fulfillment_type === 'PICKUP' ? '🏪 <strong>استلام من فرع صحار</strong>' : `🚚 <strong>توصيل:</strong> ${o.governorate || ''} - ${o.wilayat || ''}`}
          ${o.address_details ? `<br/><small style="color:var(--adm-muted);">${o.address_details}</small>` : ''}
        </td>
        <td style="font-size:0.82rem;max-width:250px;">${itemsSummary}</td>
        <td>
          <strong style="color:var(--adm-primary);font-size:1rem;">${fmtOMR(o.total_amount_omr)}</strong>
        </td>
        <td><span class="status-badge status-${o.status}">${o.status}</span></td>
        <td>
          <div style="display:flex;flex-direction:column;gap:0.4rem;">
            <select class="adm-select" style="padding:0.35rem;font-size:0.8rem;" onchange="changeOrderStatus(${o.id}, this.value)">
              ${buildStatusOptionsHTML(o.status)}
            </select>
            <a href="${waFollowUp}" target="_blank" class="adm-btn adm-btn-outline" style="padding:0.3rem 0.6rem;font-size:0.76rem;justify-content:center;text-decoration:none;">
              💬 مراسلة العميل واتساب
            </a>
          </div>
        </td>
      </tr>
    `;
    })
    .join('');
}

async function changeOrderStatus(orderId, newStatus) {
  await fetch('/api/admin/orders/status', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ order_id: orderId, status: newStatus }),
  });
  await loadAdminData();
}

/* ==========================================================================
   3. PRODUCT & INVENTORY MANAGEMENT TAB
   ========================================================================== */
function renderProductsTab() {
  const tbody = document.getElementById('admin-products-tbody');
  const categories = ADMIN_STATE.data.categories || [];
  const catMap = {};
  categories.forEach((c) => (catMap[c.id] = c.translations.ar?.name || c.code));

  // Populate category select in Product Modal
  const catSel = document.getElementById('edit-prod-cat');
  if (catSel) {
    catSel.innerHTML = categories
      .map((c) => `<option value="${c.id}">${c.translations.ar?.name || c.code}</option>`)
      .join('');
  }

  tbody.innerHTML = (ADMIN_STATE.data.catalog_products || [])
    .map((p) => {
      const ar = p.translations.ar || {};
      const en = p.translations.en || {};
      return `
      <tr>
        <td>
          <img src="${p.primary_image}" style="width:54px;height:46px;border-radius:8px;object-fit:cover;border:1px solid var(--adm-border);" onerror="this.src='/assets/products/royal-gift-box.svg'" />
        </td>
        <td>
          <strong>${ar.name || ''}</strong><br/>
          <small style="color:var(--adm-muted);">${en.name || ''} • <code>${p.sku}</code></small>
        </td>
        <td>${catMap[p.category_id] || ''}</td>
        <td><strong style="color:var(--adm-primary);">${fmtOMR(p.base_price_omr)}</strong></td>
        <td>${p.weight_label_ar || ''}</td>
        <td>
          <span class="status-badge ${p.in_stock ? 'status-COMPLETED' : 'status-CANCELLED'}">
            ${p.in_stock ? 'متوفر (In Stock)' : 'نفد (Out of Stock)'}
          </span>
        </td>
        <td style="font-size:0.76rem;">
          ${p.is_featured ? '⭐ مميز ' : ''}
          ${p.is_best_seller ? '👑 الأكثر مبيعاً ' : ''}
        </td>
        <td>
          <div style="display:flex;gap:0.35rem;flex-wrap:wrap;">
            <button class="adm-btn adm-btn-outline" style="padding:0.3rem 0.6rem;font-size:0.78rem;" onclick="openProductEditor(${p.id})">✏️ تعديل</button>
            <button class="adm-btn adm-btn-outline" style="padding:0.3rem 0.6rem;font-size:0.78rem;" onclick="duplicateProduct(${p.id})">📋 نسخ</button>
            <button class="adm-btn adm-btn-danger" style="padding:0.3rem 0.6rem;font-size:0.78rem;" onclick="deleteProduct(${p.id})">🗑️</button>
          </div>
        </td>
      </tr>
    `;
    })
    .join('');
}

function openProductEditor(productId) {
  const modal = document.getElementById('admin-product-modal');
  if (productId) {
    const p = (ADMIN_STATE.data.catalog_products || []).find((x) => x.id === productId);
    if (!p) return;
    document.getElementById('prod-modal-heading').textContent = `تعديل المنتج: ${p.translations.ar?.name}`;
    document.getElementById('edit-prod-id').value = p.id;
    document.getElementById('edit-prod-name-ar').value = p.translations.ar?.name || '';
    document.getElementById('edit-prod-name-en').value = p.translations.en?.name || '';
    document.getElementById('edit-prod-sku').value = p.sku;
    document.getElementById('edit-prod-cat').value = p.category_id;
    document.getElementById('edit-prod-price').value = p.base_price_omr;
    document.getElementById('edit-prod-weight-ar').value = p.weight_label_ar || '1 كيلو';
    document.getElementById('edit-prod-short-ar').value = p.translations.ar?.short_description || '';
    document.getElementById('edit-prod-short-en').value = p.translations.en?.short_description || '';
    document.getElementById('edit-prod-img').value = p.primary_image || '';
    document.getElementById('edit-prod-instock').checked = !!p.in_stock;
    document.getElementById('edit-prod-featured').checked = !!p.is_featured;
    document.getElementById('edit-prod-bestseller').checked = !!p.is_best_seller;

    const promptBox = document.getElementById('prod-upload-prompt');
    const previewCard = document.getElementById('prod-image-preview-card');
    const previewImg = document.getElementById('edit-prod-preview-el');
    const progressBox = document.getElementById('prod-upload-progress');
    if (progressBox) progressBox.style.display = 'none';

    setupDropzone();

    if (p.primary_image) {
      if (previewImg) previewImg.src = p.primary_image;
      if (previewCard) previewCard.style.display = 'flex';
      if (promptBox) promptBox.style.display = 'none';
      const nameLbl = document.getElementById('prod-img-name-label');
      if (nameLbl) nameLbl.textContent = 'صورة الصنف الحالية';
    } else {
      if (previewCard) previewCard.style.display = 'none';
      if (promptBox) promptBox.style.display = 'block';
    }
  } else {
    document.getElementById('prod-modal-heading').textContent = 'إضافة منتج ملكي جديد';
    document.getElementById('edit-prod-id').value = '';
    document.getElementById('edit-prod-name-ar').value = '';
    document.getElementById('edit-prod-name-en').value = '';
    document.getElementById('edit-prod-sku').value = `TM-NEW-${Math.floor(100 + Math.random() * 900)}`;
    document.getElementById('edit-prod-price').value = '10.000';
    document.getElementById('edit-prod-weight-ar').value = '1 كيلو';
    document.getElementById('edit-prod-short-ar').value = '';
    document.getElementById('edit-prod-short-en').value = '';
    document.getElementById('edit-prod-img').value = '';
    document.getElementById('edit-prod-instock').checked = true;
    document.getElementById('edit-prod-featured').checked = true;
    document.getElementById('edit-prod-bestseller').checked = false;

    const promptBox = document.getElementById('prod-upload-prompt');
    const previewCard = document.getElementById('prod-image-preview-card');
    const progressBox = document.getElementById('prod-upload-progress');
    if (progressBox) progressBox.style.display = 'none';

    setupDropzone();

    if (previewCard) previewCard.style.display = 'none';
    if (promptBox) promptBox.style.display = 'block';
  }
  modal.style.display = 'flex';
}

function removeProductImage() {
  document.getElementById('edit-prod-img').value = '';
  const previewCard = document.getElementById('prod-image-preview-card');
  const promptBox = document.getElementById('prod-upload-prompt');
  if (previewCard) previewCard.style.display = 'none';
  if (promptBox) promptBox.style.display = 'block';
  const fileInput = document.getElementById('edit-prod-file');
  if (fileInput) fileInput.value = '';
  const fileChange = document.getElementById('edit-prod-file-change');
  if (fileChange) fileChange.value = '';
}

async function handleImageFileUpload(fileInput, droppedFile = null) {
  const file = droppedFile || (fileInput && fileInput.files && fileInput.files[0]);
  if (!file) return;

  const allowedExts = /\.(jpg|jpeg|png|webp|svg|gif|jfif)$/i;
  const isImageMime = file.type && file.type.startsWith('image/');
  if (!isImageMime && !allowedExts.test(file.name)) {
    alert('يرجى اختيار ملف صورة بالصيغ المعتمدة: JPG, JPEG, PNG, WEBP, SVG');
    return;
  }

  const promptBox = document.getElementById('prod-upload-prompt');
  const previewCard = document.getElementById('prod-image-preview-card');
  const previewImg = document.getElementById('edit-prod-preview-el');
  const progressBox = document.getElementById('prod-upload-progress');

  if (promptBox) promptBox.style.display = 'none';
  if (previewCard) previewCard.style.display = 'none';
  if (progressBox) progressBox.style.display = 'block';

  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUri = e.target.result;
    try {
      showToast('جاري رفع الصورة...');
      const res = await fetch('/api/admin/upload-image', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ filename: file.name, data: dataUri }),
      });
      const data = await res.json();
      if (progressBox) progressBox.style.display = 'none';

      if (data.ok && data.url) {
        document.getElementById('edit-prod-img').value = data.url;
        if (previewImg && previewCard) {
          previewImg.src = data.url;
          const nameLbl = document.getElementById('prod-img-name-label');
          if (nameLbl) nameLbl.textContent = file.name || 'تم تحميل الصورة بنجاح';
          previewCard.style.display = 'flex';
        }
        showToast('تم رفع الصورة بنجاح!');
      } else {
        alert(data.error || 'فشل رفع الصورة');
        if (promptBox) promptBox.style.display = 'block';
      }
    } catch (err) {
      if (progressBox) progressBox.style.display = 'none';
      if (promptBox) promptBox.style.display = 'block';
      alert('حدث خطأ أثناء رفع الصورة: ' + err.message);
    }
  };
  reader.readAsDataURL(file);
}

function setupDropzone() {
  const dropzone = document.getElementById('prod-image-dropzone');
  if (!dropzone || dropzone.dataset.hasDrop) return;
  dropzone.dataset.hasDrop = 'true';

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt && dt.files;
    if (files && files.length > 0) {
      handleImageFileUpload(null, files[0]);
    }
  }, false);
}

function closeProductEditor() {
  document.getElementById('admin-product-modal').style.display = 'none';
}

async function submitProductEditor(e) {
  e.preventDefault();
  const payload = {
    id: document.getElementById('edit-prod-id').value || null,
    name_ar: document.getElementById('edit-prod-name-ar').value.trim(),
    name_en: document.getElementById('edit-prod-name-en').value.trim(),
    sku: document.getElementById('edit-prod-sku').value.trim(),
    category_id: parseInt(document.getElementById('edit-prod-cat').value),
    base_price_omr: parseFloat(document.getElementById('edit-prod-price').value),
    weight_label_ar: document.getElementById('edit-prod-weight-ar').value.trim(),
    weight_label_en: document.getElementById('edit-prod-weight-ar').value.trim(),
    short_description_ar: document.getElementById('edit-prod-short-ar').value.trim(),
    short_description_en: document.getElementById('edit-prod-short-en').value.trim(),
    image_url: document.getElementById('edit-prod-img').value.trim(),
    in_stock: document.getElementById('edit-prod-instock').checked,
    is_featured: document.getElementById('edit-prod-featured').checked,
    is_best_seller: document.getElementById('edit-prod-bestseller').checked,
  };
  const res = await fetch('/api/admin/products', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    alert(err.error || 'خطأ في الصلاحيات');
    return;
  }
  closeProductEditor();
  await loadAdminData();
}

async function duplicateProduct(productId) {
  await fetch('/api/admin/products/duplicate', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ product_id: productId }),
  });
  await loadAdminData();
}

async function deleteProduct(productId) {
  if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
  await fetch('/api/admin/products/delete', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ product_id: productId }),
  });
  await loadAdminData();
}

/* ==========================================================================
   4. CATEGORIES TAB
   ========================================================================== */
function renderCategoriesTab() {
  const tbody = document.getElementById('admin-categories-tbody');
  tbody.innerHTML = (ADMIN_STATE.data.categories || [])
    .map(
      (c) => `
      <tr>
        <td><strong>#${c.display_order}</strong></td>
        <td><code>${c.code}</code></td>
        <td><strong>${c.translations.ar?.name || ''}</strong></td>
        <td>${c.translations.en?.name || ''}</td>
        <td><span class="status-badge status-COMPLETED">مفعل (Active)</span></td>
        <td>
          <button class="adm-btn adm-btn-outline" style="padding:0.3rem 0.65rem;font-size:0.78rem;" onclick="openCategoryEditor(${c.id})">✏️ تعديل</button>
        </td>
      </tr>
    `
    )
    .join('');
}

async function openCategoryEditor(catId) {
  const existing = (ADMIN_STATE.data.categories || []).find((c) => c.id === catId);
  const nameAr = prompt('أدخل اسم القسم بالعربية:', existing ? existing.translations.ar?.name : '');
  if (!nameAr) return;
  const nameEn = prompt('Enter Category Name in English:', existing ? existing.translations.en?.name : nameAr);
  await fetch('/api/admin/categories', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      id: existing ? existing.id : null,
      code: existing ? existing.code : `cat-${Date.now()}`,
      name_ar: nameAr,
      name_en: nameEn || nameAr,
      display_order: existing ? existing.display_order : 7,
    }),
  });
  await loadAdminData();
}

/* ==========================================================================
   5. BULK CSV IMPORT & VALIDATION
   ========================================================================== */
function loadCsvFileToTextarea(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('csv-import-textarea').value = e.target.result;
  };
  reader.readAsText(file, 'UTF-8');
}

async function runCsvImport() {
  const csvText = document.getElementById('csv-import-textarea').value;
  const reportBox = document.getElementById('csv-import-report');
  const res = await fetch('/api/admin/csv/import', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ csv_text: csvText }),
  });
  const data = await res.json();

  const errorsHTML = (data.errors || [])
    .map((e) => `<li style="color:#991B1B;font-size:0.82rem;">السطر ${e.row || ''}: ${e.error || e}</li>`)
    .join('');

  reportBox.innerHTML = `
    <div style="background:#F8FAFC;border:1px solid var(--adm-border);border-radius:10px;padding:1rem;">
      <div style="font-weight:800;margin-bottom:0.4rem;">نتيجة فحص واستيراد ملف CSV:</div>
      <div style="color:#15803D;font-weight:700;">✅ صفوف ناجحة تم حفظها: ${data.successful_rows}</div>
      <div style="color:#991B1B;font-weight:700;">❌ صفوف مرفوضة: ${data.failed_rows}</div>
      ${errorsHTML ? `<ul style="margin-top:0.5rem;padding-inline-start:1.2rem;">${errorsHTML}</ul>` : ''}
    </div>
  `;
  await loadAdminData();
}

/* ==========================================================================
   6. BRANDING & APPEARANCE CMS TAB
   ========================================================================== */
function populateAppearanceForm() {
  const { brand, settings, sections } = ADMIN_STATE.data;
  if (!brand) return;
  document.getElementById('set-name-ar').value = brand.store_name_ar || '';
  document.getElementById('set-name-en').value = brand.store_name_en || '';
  document.getElementById('set-tagline-ar').value = brand.tagline_ar || '';
  document.getElementById('set-wa-num').value = brand.whatsapp_number || '';
  document.getElementById('set-phone-disp').value = brand.phone_display || '';
  document.getElementById('set-insta').value = brand.instagram_handle || '';
  document.getElementById('set-color-primary').value = brand.primary_color || '#4A0E13';
  document.getElementById('set-color-accent').value = brand.accent_color || '#C6A365';
  document.getElementById('set-free-thresh').value = settings?.free_delivery_threshold || 20.0;

  const hero = sections?.HERO || {};
  document.getElementById('set-hero-title-ar').value = hero.title_ar || '';
  document.getElementById('set-hero-title-en').value = hero.title_en || '';
  document.getElementById('set-hero-sub-ar').value = hero.subtitle_ar || '';
  document.getElementById('set-hero-sub-en').value = hero.subtitle_en || '';

  const about = sections?.ABOUT || {};
  document.getElementById('set-about-ar').value = about.content_ar || '';
  document.getElementById('set-about-en').value = about.content_en || '';
}

async function saveAppearanceSettings(e) {
  e.preventDefault();
  const payload = {
    brand: {
      store_name_ar: document.getElementById('set-name-ar').value.trim(),
      store_name_en: document.getElementById('set-name-en').value.trim(),
      tagline_ar: document.getElementById('set-tagline-ar').value.trim(),
      whatsapp_number: document.getElementById('set-wa-num').value.trim(),
      phone_display: document.getElementById('set-phone-disp').value.trim(),
      instagram_handle: document.getElementById('set-insta').value.trim(),
      primary_color: document.getElementById('set-color-primary').value,
      accent_color: document.getElementById('set-color-accent').value,
    },
    settings: {
      free_delivery_threshold: parseFloat(document.getElementById('set-free-thresh').value),
    },
    hero: {
      title_ar: document.getElementById('set-hero-title-ar').value.trim(),
      title_en: document.getElementById('set-hero-title-en').value.trim(),
      subtitle_ar: document.getElementById('set-hero-sub-ar').value.trim(),
      subtitle_en: document.getElementById('set-hero-sub-en').value.trim(),
    },
    about: {
      content_ar: document.getElementById('set-about-ar').value.trim(),
      content_en: document.getElementById('set-about-en').value.trim(),
    },
  };
  const res = await fetch('/api/admin/settings', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    alert(err.error || 'ليس لديك صلاحية تعديل الإعدادات');
    return;
  }
  alert('✅ تم حفظ الهوية البصرية ومحتوى الصفحة الرئيسية بنجاح!');
  await loadAdminData();
}

/* ==========================================================================
   8. STAFF & RBAC TAB + GLOBAL SEARCH
   ========================================================================== */
function renderStaffTab() {
  document.getElementById('admin-staff-tbody').innerHTML = (ADMIN_STATE.data.staff || [])
    .map(
      (u) => `
      <tr>
        <td><strong>${u.full_name}</strong></td>
        <td dir="ltr">${u.email}</td>
        <td><span class="status-badge ${u.role_name === 'ADMIN' ? 'status-CONFIRMED' : 'status-NEW'}">${u.role_name}</span></td>
        <td style="font-size:0.82rem;">
          ${u.role_name === 'ADMIN' ? 'صلاحيات كاملة (الطلبات، المنتجات، التسويق، الهوية، الموظفون)' : 'إدارة الطلبات، عرض وتعديل المنتجات، عرض التحليلات'}
        </td>
        <td><span class="status-badge status-COMPLETED">نشط</span></td>
      </tr>
    `
    )
    .join('');
}

function openLoginSwitchModal() {
  document.getElementById('admin-login-modal').style.display = 'flex';
}

function fillDemoLogin(email, pass) {
  document.getElementById('adm-login-email').value = email;
  document.getElementById('adm-login-pass').value = pass;
}

async function submitAdminLogin(e) {
  e.preventDefault();
  const email = document.getElementById('adm-login-email').value.trim();
  const password = document.getElementById('adm-login-pass').value;
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    alert(data.error || 'فشل تسجيل الدخول');
    return;
  }
  ADMIN_STATE.token = data.token;
  ADMIN_STATE.user = data.user;
  localStorage.setItem('taj_admin_token', data.token);
  localStorage.setItem('taj_admin_user', JSON.stringify(data.user));
  document.getElementById('admin-login-modal').style.display = 'none';
  updateRoleIndicator();
  await loadAdminData();
}

function handleGlobalAdminSearch(query) {
  const q = (query || '').trim().toLowerCase();
  const box = document.getElementById('global-search-results');
  if (!q || !ADMIN_STATE.data) {
    box.style.display = 'none';
    return;
  }
  const matchedOrders = (ADMIN_STATE.orders || []).filter(
    (o) =>
      o.order_number.toLowerCase().includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      o.customer_phone.toLowerCase().includes(q)
  );
  const matchedProducts = (ADMIN_STATE.data.catalog_products || []).filter(
    (p) =>
      (p.translations.ar?.name || '').toLowerCase().includes(q) ||
      (p.translations.en?.name || '').toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q)
  );

  box.style.display = 'block';
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
      <strong>نتائج البحث الفوري عن "${query}":</strong>
      <button class="adm-btn adm-btn-outline" style="padding:0.2rem 0.5rem;" onclick="document.getElementById('global-search-results').style.display='none'">إغلاق ✕</button>
    </div>
    <div style="font-size:0.86rem;">
      <div><strong>الطلبات المطابقة (${matchedOrders.length}):</strong> ${matchedOrders
        .map((o) => `<span class="status-badge status-NEW" style="margin:2px;">#${o.order_number} - ${o.customer_name} (${fmtOMR(o.total_amount_omr)})</span>`)
        .join(' ')}</div>
      <div style="margin-top:0.4rem;"><strong>المنتجات المطابقة (${matchedProducts.length}):</strong> ${matchedProducts
        .map((p) => `<span class="status-badge status-CONFIRMED" style="margin:2px;cursor:pointer;" onclick="openProductEditor(${p.id})">${p.translations.ar?.name} (${fmtOMR(p.base_price_omr)})</span>`)
        .join(' ')}</div>
    </div>
  `;
}

function showToast(message) {
  let toast = document.getElementById('adm-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'adm-toast';
    toast.style.cssText =
      'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#2D070A;color:#E5CB96;border:1.5px solid #C6A365;padding:0.7rem 1.4rem;border-radius:999px;font-weight:700;z-index:999;box-shadow:0 12px 30px rgba(0,0,0,0.4);transition:opacity 0.3s ease;';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  clearTimeout(window._admToastTimer);
  window._admToastTimer = setTimeout(() => {
    toast.style.opacity = '0';
  }, 2600);
}

document.addEventListener('DOMContentLoaded', initAdminDashboard);
