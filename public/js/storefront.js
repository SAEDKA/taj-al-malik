/* ==========================================================================
   TAJ AL MALIK (تاج الملك - حلا الملوك) — Customer Storefront Engine
   Bilingual RTL/LTR | Persistent Cart | OMR 3-Decimal | WhatsApp Checkout
   ========================================================================== */

const STATE = {
  lang: localStorage.getItem('taj_lang') || 'ar',
  store: null,
  selectedCategory: 'ALL',
  cart: JSON.parse(localStorage.getItem('taj_al_malik_cart_v1') || '[]'),
  appliedDiscount: null,
  fulfillmentType: 'DELIVERY',
  activeProductModal: null,
  modalSelectedOptions: {},
  modalQuantity: 1,
};

const UI_TEXT = {
  ar: {
    langBtn: 'English',
    cartLabel: 'السلة',
    currency: 'ر.ع',
    allCategories: 'جميع الأصناف الملكية',
    itemsCount: 'صنف فاخر',
    searchPlaceholder: 'ابحث عن مبرومة، بلورية، بقلاوة، حلاوة جبن، يالنجي، كبة...',
    sortFeatured: 'الترتيب: المختارات الملكية',
    sortPopular: 'الأكثر طلباً ومبيعاً',
    sortAsc: 'السعر: من الأقل إلى الأعلى',
    sortDesc: 'السعر: من الأعلى إلى الأقل',
    sortNewest: 'الأحدث إضافة',
    quickAdd: '+ أضف للسلة',
    customize: 'التفاصيل والخيارات',
    bestsellerBadge: 'الأكثر مبيعاً',
    offerBadge: '',
    featuredBadge: 'مختارات الملك',
    outOfStock: 'غير متوفر حالياً',
    inStock: 'متوفر — يحضر طازجاً',
    freeShippingLeft: (rem) => `أضف بقيمة ${rem} ر.ع أخرى للحصول على توصيل مجاني!`,
    freeShippingUnlocked: 'طلبك مؤهل للتوصيل المجاني!',
    emptyCart: 'سلة التسوق فارغة حالياً. تصفح حلويات تاج الملك وأضف أصنافك المفضلة!',
    relatedTitle: 'أصناف مشابهة قد تعجبك',
    specialNotesLabel: 'ملاحظات خاصة أو رسالة إهداء على هذا الصنف (اختياري):',
    specialNotesPlaceholder: 'مثال: قطر خفيف، أو تقطيع صغير للضيافة...',
    addedToast: 'تمت الإضافة إلى سلة تاج الملك بنجاح',
  },
  en: {
    langBtn: 'العربية',
    cartLabel: 'Cart',
    currency: 'OMR',
    allCategories: 'All Royal Categories',
    itemsCount: 'Premium Items',
    searchPlaceholder: 'Search Mabrouma, Ballourieh, Baklava, Halawet El Jibn, Yalanji, Kibbeh...',
    sortFeatured: 'Sort: Royal Featured',
    sortPopular: 'Most Popular & Best Selling',
    sortAsc: 'Price: Low to High',
    sortDesc: 'Price: High to Low',
    sortNewest: 'Newest Arrivals',
    quickAdd: '+ Add to Cart',
    customize: 'Options & Details',
    bestsellerBadge: 'Best Seller',
    offerBadge: '',
    featuredBadge: 'Royal Choice',
    outOfStock: 'Out of Stock',
    inStock: 'In Stock — Freshly Prepared',
    freeShippingLeft: (rem) => `Add ${rem} OMR more to unlock FREE delivery!`,
    freeShippingUnlocked: 'Congratulations! You unlocked FREE delivery!',
    emptyCart: 'Your royal cart is currently empty. Explore our sweets to begin!',
    relatedTitle: 'Related Royal Sweets You May Like',
    specialNotesLabel: 'Special Request or Gift Note for this item (Optional):',
    specialNotesPlaceholder: 'e.g., Light syrup on the side, bite-size cut...',
    addedToast: 'Added to your Taj Al Malik cart',
  },
};

function formatOMR(val) {
  const num = parseFloat(val || 0);
  return num.toFixed(3);
}

function formatPriceWithCurrency(val) {
  const t = UI_TEXT[STATE.lang];
  return `${formatOMR(val)} ${t.currency}`;
}

async function initStorefront() {
  applyLanguageDirection();
  setupFloatingCartScroll();
  try {
    const res = await fetch('/api/storefront');
    STATE.store = await res.json();
    applyBrandTheme(STATE.store.brand);
    renderAllStorefront();
    updateCartUI();
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'STORE_VISIT' }),
    }).catch(() => {});
  } catch (err) {
    console.error('Failed to load storefront:', err);
  }
}

function setupFloatingCartScroll() {
  const syncCartVisibility = () => {
    const cartBtn = document.getElementById('floating-cart-trigger');
    if (!cartBtn) return;
    const totalCount = STATE.cart.reduce((s, it) => s + it.quantity, 0);
    if (window.scrollY > 120 || totalCount > 0) {
      cartBtn.classList.add('visible');
    } else {
      cartBtn.classList.remove('visible');
    }
  };
  window.addEventListener('scroll', syncCartVisibility, { passive: true });
  syncCartVisibility();
}

function applyBrandTheme(brand) {
  if (!brand) return;
  const root = document.documentElement;
  if (brand.primary_color) root.style.setProperty('--brand-primary', brand.primary_color);
  if (brand.secondary_color) root.style.setProperty('--brand-primary-dark', brand.secondary_color);
  if (brand.accent_color) root.style.setProperty('--brand-accent', brand.accent_color);
  if (brand.surface_color) root.style.setProperty('--brand-surface', brand.surface_color);
}

function applyLanguageDirection() {
  const html = document.getElementById('html-root');
  html.lang = STATE.lang;
  html.dir = STATE.lang === 'ar' ? 'rtl' : 'ltr';
  const btn = document.getElementById('lang-switch-btn');
  if (btn) btn.textContent = UI_TEXT[STATE.lang].langBtn;
}

function toggleLanguage() {
  STATE.lang = STATE.lang === 'ar' ? 'en' : 'ar';
  localStorage.setItem('taj_lang', STATE.lang);
  applyLanguageDirection();
  if (STATE.store) {
    renderAllStorefront();
    updateCartUI();
  }
}

function renderAllStorefront() {
  const { brand, sections, settings } = STATE.store;
  const isAr = STATE.lang === 'ar';
  const t = UI_TEXT[STATE.lang];

  // Desktop Header & Top bar (Directive: keep previous desktop version)
  const headerBrandName = document.getElementById('header-brand-name');
  if (headerBrandName) headerBrandName.textContent = isAr ? brand.store_name_ar : brand.store_name_en;
  const headerBrandTagline = document.getElementById('header-brand-tagline');
  if (headerBrandTagline) headerBrandTagline.textContent = isAr ? brand.tagline_ar : brand.tagline_en;

  const topLocation = document.getElementById('top-location-text');
  if (topLocation) {
    topLocation.textContent = isAr
      ? `📍 ${brand.location_ar} — توصيل لكافة ولايات السلطنة أو استلام من الفرع`
      : `📍 ${brand.location_en} — Delivery across Oman or Branch Pickup`;
  }
  const topPhone = document.getElementById('top-phone-link');
  if (topPhone) {
    topPhone.textContent = `📞 ${brand.phone_display}`;
    topPhone.href = `https://wa.me/${brand.whatsapp_number}`;
  }

  // Desktop Header Controls
  const langBtn = document.getElementById('lang-switch-btn');
  if (langBtn) langBtn.textContent = isAr ? 'English 🇬🇧' : 'العربية 🇴🇲';
  const drawerLangLbl = document.getElementById('drawer-lang-label');
  if (drawerLangLbl) drawerLangLbl.textContent = isAr ? 'English' : 'العربية';

  const cartLbl = document.getElementById('cart-btn-label');
  if (cartLbl) cartLbl.textContent = t.cartLabel;
  const mobileCartLbl = document.getElementById('mobile-cart-btn-label');
  if (mobileCartLbl) mobileCartLbl.textContent = t.cartLabel;

  // Corner Nav Button Label (Mobile)
  const cornerNavLbl = document.getElementById('corner-nav-label');
  if (cornerNavLbl) cornerNavLbl.textContent = isAr ? 'القائمة' : 'Menu';

  // Desktop Hero Section (Desktop Split Grid)
  const hero = sections.HERO || {};
  const heroKicker = document.getElementById('hero-kicker-text');
  if (heroKicker) {
    heroKicker.textContent = isAr
      ? `${brand.tagline_ar} • ${brand.location_ar}`
      : `${brand.tagline_en} • ${brand.location_en}`;
  }
  const desktopHeroTitle = document.getElementById('hero-title');
  if (desktopHeroTitle) {
    desktopHeroTitle.textContent = isAr
      ? (hero.title_ar || 'تاج الملك .. حلا الملوك لذوي الذوق الرفيع')
      : (hero.title_en || 'Taj Al Malik Royal Sweets');
  }
  const desktopHeroSubtitle = document.getElementById('hero-subtitle');
  if (desktopHeroSubtitle) {
    desktopHeroSubtitle.textContent = isAr
      ? (hero.subtitle_ar || 'كل قطعة من حلوياتنا تُصنع بحب، مستوحاة من التقاليد ولمسة ملكية، لنقدم لكم أرقى نكهات الشرق في سلطنة عُمان.')
      : (hero.subtitle_en || 'Every piece of our sweets is handcrafted with passion and royalty.');
  }
  const heroBtnPrimary = document.getElementById('hero-btn-primary');
  if (heroBtnPrimary) {
    heroBtnPrimary.textContent = isAr
      ? `👑 ${hero.button_ar || 'تسوق الحلويات الملكية'}`
      : `👑 ${hero.button_en || 'Shop Royal Sweets'}`;
  }
  const heroBtnSecondary = document.getElementById('hero-btn-secondary');
  if (heroBtnSecondary) {
    heroBtnSecondary.textContent = isAr
      ? (hero.secondary_button_ar || 'استكشف مختارات تاج الملك')
      : (hero.secondary_button_en || 'Explore Menu');
  }

  // Mobile Hero Section (Full-Screen Seamless Mobile Hero)
  const mobileHeroTitle = document.getElementById('mobile-hero-title');
  if (mobileHeroTitle) {
    mobileHeroTitle.textContent = isAr ? 'تاج الملك، حلا الملوك' : 'Taj Al Malik — Sweets of Kings';
  }
  const mobileHeroBtnPrimary = document.getElementById('mobile-hero-btn-primary');
  if (mobileHeroBtnPrimary) {
    mobileHeroBtnPrimary.innerHTML = `
      <svg class="ico-svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg>
      <span>${isAr ? 'تصفح القائمة واطلب الآن' : 'Browse Menu & Order Now'}</span>
    `;
  }
  const mobileHeroScroll = document.getElementById('mobile-hero-scroll-text');
  if (mobileHeroScroll) {
    mobileHeroScroll.textContent = isAr ? 'تصفح أصناف الحلويات والأسعار' : 'Browse Sweets & Prices';
  }

  // Drawer Links Bilingual Sync
  const mnavMap = {
    'mnav-menu': isAr ? 'القائمة الكاملة' : 'Full Menu',
    'mnav-baklava': isAr ? 'الحلويات الملكية' : 'Royal Sweets & Baklava',
    'mnav-qashati': isAr ? 'ركن القشاطي' : 'Al-Qashati & Cream',
    'mnav-syrian': isAr ? 'المأكولات السورية' : 'Syrian Delicacies',
    'mnav-bestsellers': isAr ? 'الأكثر مبيعاً' : 'Best Sellers',
    'mnav-story': isAr ? 'قصتنا' : 'Our Story',
  };
  Object.entries(mnavMap).forEach(([id, label]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = label;
  });

  // Search & Sort labels
  const searchInput = document.getElementById('catalog-search-input');
  if (searchInput) searchInput.placeholder = t.searchPlaceholder;
  const sortFeatured = document.getElementById('sort-opt-featured');
  if (sortFeatured) sortFeatured.textContent = t.sortFeatured;
  const sortPopular = document.getElementById('sort-opt-popular');
  if (sortPopular) sortPopular.textContent = t.sortPopular;
  const sortAsc = document.getElementById('sort-opt-asc');
  if (sortAsc) sortAsc.textContent = t.sortAsc;
  const sortDesc = document.getElementById('sort-opt-desc');
  if (sortDesc) sortDesc.textContent = t.sortDesc;
  const sortNewest = document.getElementById('sort-opt-newest');
  if (sortNewest) sortNewest.textContent = t.sortNewest;

  // Story Section
  const about = sections.ABOUT || {};
  if (about.title_ar) {
    const storyTitle = document.getElementById('story-title');
    if (storyTitle) storyTitle.textContent = isAr ? about.title_ar : about.title_en;
    const storyQuote = document.getElementById('story-quote-1');
    if (storyQuote) storyQuote.textContent = isAr ? about.content_ar : about.content_en;
  }
  const instaHandle = document.getElementById('story-insta-handle');
  if (instaHandle) instaHandle.textContent = brand.instagram_handle || 'Tajalamlik.om';

  // Newsletter visibility
  const nlBox = document.getElementById('newsletter-box');
  if (nlBox) nlBox.style.display = settings.enable_newsletter ? 'block' : 'none';

  renderCategories();
  renderCatalog();
  renderBestSellers();
  renderOffers();
  renderTestimonials();
  populateDeliveryZonesDropdown();
}

function renderCategories() {
  const container = document.getElementById('categories-container');
  const select = document.getElementById('catalog-category-select');
  const isAr = STATE.lang === 'ar';
  const t = UI_TEXT[STATE.lang];
  const categories = STATE.store.categories || [];
  const products = STATE.store.products || [];

  const allCard = `
    <div class="category-card ${STATE.selectedCategory === 'ALL' ? 'active' : ''}" onclick="selectCategory('ALL')">
      <div class="category-card-title">${t.allCategories}</div>
      <div class="category-card-count">${products.length} ${t.itemsCount}</div>
    </div>
  `;

  const catCards = categories
    .map((c) => {
      const tr = (c.translations && c.translations[STATE.lang]) || c.translations.ar;
      const count = products.filter((p) => p.category_id === c.id).length;
      const isActive = STATE.selectedCategory === c.code;
      return `
      <div class="category-card ${isActive ? 'active' : ''}" onclick="selectCategory('${c.code}')">
        <div class="category-card-title">${tr.name}</div>
        <div class="category-card-count">${count} ${t.itemsCount}</div>
      </div>
    `;
    })
    .join('');

  container.innerHTML = allCard + catCards;

  select.innerHTML =
    `<option value="ALL">${t.allCategories} (${products.length})</option>` +
    categories
      .map((c) => {
        const tr = (c.translations && c.translations[STATE.lang]) || c.translations.ar;
        return `<option value="${c.code}" ${STATE.selectedCategory === c.code ? 'selected' : ''}>${tr.name}</option>`;
      })
      .join('');
}

function selectCategory(catCode) {
  STATE.selectedCategory = catCode;
  renderCategories();
  renderCatalog();
}

function selectCategoryFromDropdown(catCode) {
  selectCategory(catCode);
}

function scrollToSection(sectionId, catCode) {
  if (catCode) {
    selectCategory(catCode);
  }
  const el = document.getElementById(sectionId);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function openMobileNavDrawer() {
  const backdrop = document.getElementById('mobile-nav-backdrop');
  if (backdrop) {
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeMobileNavDrawer() {
  const backdrop = document.getElementById('mobile-nav-backdrop');
  if (backdrop) {
    backdrop.classList.remove('open');
    document.body.style.overflow = '';
  }
}

function navigateFromMobileDrawer(sectionId, catCode) {
  closeMobileNavDrawer();
  setTimeout(() => {
    scrollToSection(sectionId, catCode);
  }, 120);
}

function renderCatalog() {
  const grid = document.getElementById('catalog-products-grid');
  const query = (document.getElementById('catalog-search-input').value || '').trim().toLowerCase();
  const sortMode = document.getElementById('catalog-sort-select').value;
  const categoriesMap = {};
  (STATE.store.categories || []).forEach((c) => {
    categoriesMap[c.id] = c;
  });

  let filtered = (STATE.store.products || []).filter((p) => {
    if (STATE.selectedCategory !== 'ALL') {
      const cat = categoriesMap[p.category_id];
      if (!cat || cat.code !== STATE.selectedCategory) return false;
    }
    if (query) {
      const arName = (p.translations.ar?.name || '').toLowerCase();
      const enName = (p.translations.en?.name || '').toLowerCase();
      const arDesc = (p.translations.ar?.short_description || '').toLowerCase();
      const enDesc = (p.translations.en?.short_description || '').toLowerCase();
      return arName.includes(query) || enName.includes(query) || arDesc.includes(query) || enDesc.includes(query);
    }
    return true;
  });

  if (sortMode === 'PRICE_ASC') {
    filtered.sort((a, b) => a.base_price_omr - b.base_price_omr);
  } else if (sortMode === 'PRICE_DESC') {
    filtered.sort((a, b) => b.base_price_omr - a.base_price_omr);
  } else if (sortMode === 'POPULAR') {
    filtered.sort((a, b) => b.sales_count - a.sales_count);
  } else if (sortMode === 'NEWEST') {
    filtered.sort((a, b) => b.id - a.id);
  } else {
    filtered.sort((a, b) => b.is_featured - a.is_featured || a.id - b.id);
  }

  grid.innerHTML = filtered.map((p) => buildProductCardHTML(p, categoriesMap[p.category_id])).join('');
}

function renderBestSellers() {
  const grid = document.getElementById('bestsellers-grid');
  const categoriesMap = {};
  (STATE.store.categories || []).forEach((c) => (categoriesMap[c.id] = c));
  const mode = STATE.store.settings?.best_sellers_mode || 'AUTOMATIC';

  let list = [...(STATE.store.products || [])];
  if (mode === 'MANUAL') {
    list = list.filter((p) => p.is_best_seller);
  } else {
    list.sort((a, b) => b.sales_count - a.sales_count);
  }
  grid.innerHTML = list
    .slice(0, 6)
    .map((p) => buildProductCardHTML(p, categoriesMap[p.category_id]))
    .join('');
}

function renderOffers() {
  const grid = document.getElementById('offers-grid');
  const categoriesMap = {};
  (STATE.store.categories || []).forEach((c) => (categoriesMap[c.id] = c));
  const list = (STATE.store.products || []).filter((p) => p.is_special_offer || p.category_id === 6 || p.is_featured);
  grid.innerHTML = list
    .slice(0, 4)
    .map((p) => buildProductCardHTML(p, categoriesMap[p.category_id]))
    .join('');
}

function buildProductCardHTML(p, catObj) {
  const isAr = STATE.lang === 'ar';
  const t = UI_TEXT[STATE.lang];
  const tr = (p.translations && p.translations[STATE.lang]) || p.translations.ar;
  const catTr = catObj ? (catObj.translations && catObj.translations[STATE.lang]) || catObj.translations.ar : { name: '' };
  const unitLabel = isAr ? p.weight_label_ar : p.weight_label_en;

  let badgesHTML = '';
  if (p.is_best_seller) {
    badgesHTML += `<span class="badge-pill badge-bestseller">${t.bestsellerBadge}</span>`;
  }

  const compareHTML = p.compare_at_price_omr
    ? `<span class="price-compare">${formatOMR(p.compare_at_price_omr)} ${t.currency}</span>`
    : '';

  return `
    <article class="product-card">
      <div class="product-img-wrap" onclick="openProductModal(${p.id})">
        <div class="product-badges">${badgesHTML}</div>
        <img
          src="${p.primary_image}"
          alt="${tr.name}"
          class="product-img"
          loading="lazy"
          onerror="this.src='/assets/products/royal-gift-box.svg'"
        />
        <span class="badge-unit">${unitLabel || ''}</span>
      </div>
      <div class="product-body">
        <div class="product-cat-label">${catTr.name}</div>
        <h3 class="product-title" onclick="openProductModal(${p.id})">${tr.name}</h3>
        <p class="product-short-desc">${tr.short_description || ''}</p>
        <div class="product-footer">
          <div class="price-block">
            ${compareHTML}
            <div>
              <span class="price-current">${formatOMR(p.base_price_omr)}</span>
              <span class="price-currency">${t.currency}</span>
            </div>
          </div>
          <div class="product-card-actions">
            <button class="btn-details-icon" onclick="openProductModal(${p.id})" title="${t.customize}" aria-label="${t.customize}">
              <svg class="ico-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
            <button class="btn-quick-add" onclick="quickAddToCart(${p.id})" ${!p.in_stock ? 'disabled' : ''}>
              ${p.in_stock ? t.quickAdd : t.outOfStock}
            </button>
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderTestimonials() {
  const sec = document.getElementById('testimonials-section');
  const container = document.getElementById('testimonials-container');
  const list = STATE.store.testimonials || [];
  const isAr = STATE.lang === 'ar';

  if (!STATE.store.settings?.enable_testimonials) {
    sec.style.display = 'none';
    return;
  }
  sec.style.display = 'block';
  container.innerHTML = list
    .map(
      (item) => `
    <div class="testimonial-card">
      <div class="stars-row">${'★'.repeat(item.rating || 5)}</div>
      <p style="font-size:0.94rem;margin-bottom:1rem;color:var(--text-heading);">"${isAr ? item.comment_ar : item.comment_en}"</p>
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.84rem;color:var(--brand-accent-dark);font-weight:700;">
        <span style="display:inline-flex;align-items:center;gap:0.35rem;">
          <svg class="ico-svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>${item.customer_name}</span>
        </span>
        <span style="display:inline-flex;align-items:center;gap:0.35rem;">
          <svg class="ico-svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>
          <span>${isAr ? item.city_ar : item.city_en}</span>
        </span>
      </div>
    </div>
  `
    )
    .join('');
}

/* ==========================================================================
   PRODUCT DETAILS & CUSTOMIZATION MODAL
   ========================================================================== */
function openProductModal(productId) {
  const p = (STATE.store.products || []).find((x) => x.id === productId);
  if (!p) return;

  STATE.activeProductModal = p;
  STATE.modalQuantity = 1;
  STATE.modalSelectedOptions = {};

  (p.options || []).forEach((opt) => {
    const defVal = (opt.values || []).find((v) => v.is_default) || (opt.values || [])[0];
    if (defVal) {
      STATE.modalSelectedOptions[opt.id] = defVal;
    }
  });

  renderProductModalContent();
  document.getElementById('product-modal').classList.add('open');

  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_type: 'PRODUCT_VIEW', product_id: p.id }),
  }).catch(() => {});
}

function closeProductModal() {
  document.getElementById('product-modal').classList.remove('open');
}

function getModalComputedUnitPrice() {
  const p = STATE.activeProductModal;
  if (!p) return 0;
  let unit = parseFloat(p.base_price_omr);
  Object.values(STATE.modalSelectedOptions).forEach((valObj) => {
    unit += parseFloat(valObj.price_delta_omr || 0);
  });
  return Math.max(0.1, unit);
}

function renderProductModalContent() {
  const p = STATE.activeProductModal;
  const isAr = STATE.lang === 'ar';
  const t = UI_TEXT[STATE.lang];
  const tr = (p.translations && p.translations[STATE.lang]) || p.translations.ar;

  document.getElementById('pm-header-title').textContent = tr.name;

  const unitPrice = getModalComputedUnitPrice();
  const totalModalPrice = unitPrice * STATE.modalQuantity;

  const thumbsHTML = (p.images || [])
    .map(
      (img) => `
      <img
        src="${img.image_url}"
        alt="${tr.name}"
        onclick="document.getElementById('pm-main-img').src='${img.image_url}'"
        style="width:66px;height:56px;object-fit:cover;border-radius:8px;border:2px solid var(--brand-accent);cursor:pointer;"
        onerror="this.style.display='none'"
      />
    `
    )
    .join('');

  const optionsHTML = (p.options || [])
    .map((opt) => {
      const optTitle = isAr ? opt.name_ar : opt.name_en;
      const pills = (opt.values || [])
        .map((v) => {
          const isSel = STATE.modalSelectedOptions[opt.id]?.id === v.id;
          const lbl = isAr ? v.label_ar : v.label_en;
          const delta = parseFloat(v.price_delta_omr || 0);
          const deltaStr =
            delta > 0
              ? ` (+${formatOMR(delta)} ${t.currency})`
              : delta < 0
              ? ` (${formatOMR(delta)} ${t.currency})`
              : '';
          return `
          <button
            type="button"
            class="option-pill ${isSel ? 'selected' : ''}"
            onclick="selectModalOption(${opt.id}, ${v.id})"
          >
            ${lbl}${deltaStr}
          </button>
        `;
        })
        .join('');
      return `
      <div class="option-group">
        <span class="option-group-title">${optTitle}</span>
        <div class="option-pills">${pills}</div>
      </div>
    `;
    })
    .join('');

  // Related products in same category
  const related = (STATE.store.products || [])
    .filter((x) => x.category_id === p.category_id && x.id !== p.id)
    .slice(0, 3);

  const relatedHTML = related.length
    ? `
    <div style="margin-top:2rem;border-top:1px solid var(--border-gold);padding-top:1.25rem;">
      <h4 style="color:var(--brand-primary);margin-bottom:0.85rem;">${t.relatedTitle}</h4>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0.85rem;">
        ${related
          .map((rp) => {
            const rtr = rp.translations[STATE.lang] || rp.translations.ar;
            return `
            <div onclick="openProductModal(${rp.id})" style="background:var(--brand-surface);border:1px solid var(--border-gold);border-radius:12px;padding:0.65rem;cursor:pointer;display:flex;align-items:center;gap:0.65rem;">
              <img src="${rp.primary_image}" style="width:52px;height:52px;border-radius:8px;object-fit:cover;" />
              <div>
                <div style="font-weight:700;font-size:0.85rem;color:var(--brand-primary);">${rtr.name}</div>
                <div style="font-size:0.8rem;color:var(--brand-accent-dark);font-weight:700;">${formatPriceWithCurrency(rp.base_price_omr)}</div>
              </div>
            </div>
          `;
          })
          .join('')}
      </div>
    </div>
  `
    : '';

  document.getElementById('pm-body-content').innerHTML = `
    <div class="product-detail-grid">
      <div>
        <img
          id="pm-main-img"
          src="${p.primary_image}"
          alt="${tr.name}"
          style="width:100%;height:310px;object-fit:cover;border-radius:16px;border:2px solid var(--border-gold);margin-bottom:0.65rem;"
          onerror="this.src='/assets/products/royal-gift-box.svg'"
        />
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">${thumbsHTML}</div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
          <span class="top-pill" style="background:rgba(74,14,19,0.08);color:var(--brand-primary);border-color:var(--border-gold);">
            SKU: ${p.sku}
          </span>
          <span style="font-size:0.84rem;font-weight:700;color:#15803D;">● ${t.inStock}</span>
        </div>
        <h2 style="font-size:1.65rem;color:var(--brand-primary);margin-bottom:0.5rem;">${tr.name}</h2>
        <p style="font-size:0.95rem;color:var(--text-body);margin-bottom:1.15rem;line-height:1.75;">
          ${tr.description || tr.short_description}
        </p>

        <div style="background:#FAF5EC;border:1.5px solid var(--border-gold);padding:0.85rem 1.15rem;border-radius:12px;margin-bottom:1.15rem;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:700;color:var(--text-heading);">السعر حسب الخيار المحدد:</span>
          <span style="font-size:1.45rem;font-weight:800;color:var(--brand-primary);">${formatPriceWithCurrency(unitPrice)}</span>
        </div>

        ${optionsHTML}

        <div class="form-group" style="margin-top:0.85rem;">
          <label class="form-label">${t.specialNotesLabel}</label>
          <input type="text" id="pm-special-note" class="form-control" placeholder="${t.specialNotesPlaceholder}" />
        </div>

        <div style="display:flex;align-items:center;gap:1rem;margin-top:1.25rem;flex-wrap:wrap;">
          <div class="qty-control">
            <button type="button" class="qty-btn" onclick="changeModalQty(-1)">−</button>
            <span class="qty-val" id="pm-qty-val">${STATE.modalQuantity}</span>
            <button type="button" class="qty-btn" onclick="changeModalQty(1)">+</button>
          </div>
          <button type="button" class="btn-royal-gold" style="flex:1;" onclick="addModalProductToCart()">
            <svg class="ico-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <span>${t.quickAdd} — ${formatPriceWithCurrency(totalModalPrice)}</span>
          </button>
        </div>
      </div>
    </div>
    ${relatedHTML}
  `;
}

function selectModalOption(optionId, valueId) {
  const p = STATE.activeProductModal;
  const opt = (p.options || []).find((o) => o.id === optionId);
  if (!opt) return;
  const valObj = (opt.values || []).find((v) => v.id === valueId);
  if (valObj) {
    STATE.modalSelectedOptions[optionId] = valObj;
    renderProductModalContent();
  }
}

function changeModalQty(delta) {
  STATE.modalQuantity = Math.max(1, STATE.modalQuantity + delta);
  renderProductModalContent();
}

function addModalProductToCart() {
  const p = STATE.activeProductModal;
  if (!p) return;
  const noteInput = document.getElementById('pm-special-note');
  const note = noteInput ? noteInput.value.trim() : '';

  const selectedList = Object.entries(STATE.modalSelectedOptions).map(([optId, valObj]) => {
    const opt = (p.options || []).find((o) => o.id === parseInt(optId));
    return {
      option_id: parseInt(optId),
      option_name_ar: opt ? opt.name_ar : '',
      option_name_en: opt ? opt.name_en : '',
      value_id: valObj.id,
      label_ar: valObj.label_ar,
      label_en: valObj.label_en,
      price_delta_omr: parseFloat(valObj.price_delta_omr || 0),
    };
  });

  addItemToCart(p, STATE.modalQuantity, selectedList, note);
  closeProductModal();
  openCartDrawer();
}

function quickAddToCart(productId) {
  const p = (STATE.store.products || []).find((x) => x.id === productId);
  if (!p) return;
  const defaultSelected = [];
  (p.options || []).forEach((opt) => {
    const defVal = (opt.values || []).find((v) => v.is_default) || (opt.values || [])[0];
    if (defVal) {
      defaultSelected.push({
        option_id: opt.id,
        option_name_ar: opt.name_ar,
        option_name_en: opt.name_en,
        value_id: defVal.id,
        label_ar: defVal.label_ar,
        label_en: defVal.label_en,
        price_delta_omr: parseFloat(defVal.price_delta_omr || 0),
      });
    }
  });
  addItemToCart(p, 1, defaultSelected, '');
  showToast(UI_TEXT[STATE.lang].addedToast);
}

function addItemToCart(product, quantity, selectedOptions, specialNotes) {
  let unitPrice = parseFloat(product.base_price_omr);
  selectedOptions.forEach((o) => {
    unitPrice += parseFloat(o.price_delta_omr || 0);
  });
  unitPrice = Math.max(0.1, Math.round(unitPrice * 1000) / 1000);

  const keySig = `${product.id}_${selectedOptions.map((o) => o.value_id).join('-')}_${specialNotes}`;
  const existing = STATE.cart.find((c) => c.key === keySig);
  if (existing) {
    existing.quantity += quantity;
  } else {
    STATE.cart.push({
      key: keySig,
      product_id: product.id,
      sku: product.sku,
      name_ar: product.translations.ar?.name || product.sku,
      name_en: product.translations.en?.name || product.sku,
      image_url: product.primary_image,
      unit_price_omr: unitPrice,
      quantity: quantity,
      selected_options: selectedOptions,
      special_notes: specialNotes,
    });
  }
  saveCartState();
  const cartBtn = document.getElementById('floating-cart-trigger');
  if (cartBtn) {
    cartBtn.classList.add('visible');
    cartBtn.classList.remove('pulse');
    void cartBtn.offsetWidth;
    cartBtn.classList.add('pulse');
  }
}

function saveCartState() {
  localStorage.setItem('taj_al_malik_cart_v1', JSON.stringify(STATE.cart));
  updateCartUI();
}

function getCartSubtotal() {
  return STATE.cart.reduce((sum, item) => sum + item.unit_price_omr * item.quantity, 0);
}

function updateCartUI() {
  const totalCount = STATE.cart.reduce((s, it) => s + it.quantity, 0);
  const subtotal = getCartSubtotal();
  const isAr = STATE.lang === 'ar';
  const t = UI_TEXT[STATE.lang];

  // Update Desktop Header Cart
  const desktopCountEl = document.getElementById('header-cart-count');
  if (desktopCountEl) desktopCountEl.textContent = totalCount;
  const desktopTotalEl = document.getElementById('header-cart-total');
  if (desktopTotalEl) desktopTotalEl.textContent = formatPriceWithCurrency(subtotal);

  // Update Mobile Floating Cart
  const mobileCountEl = document.getElementById('mobile-cart-count');
  if (mobileCountEl) mobileCountEl.textContent = totalCount;
  const mobileTotalEl = document.getElementById('mobile-cart-total');
  if (mobileTotalEl) mobileTotalEl.textContent = formatPriceWithCurrency(subtotal);

  const cartBtn = document.getElementById('floating-cart-trigger');
  if (cartBtn) {
    if (totalCount > 0 || window.scrollY > 120) {
      cartBtn.classList.add('visible');
    } else {
      cartBtn.classList.remove('visible');
    }
  }

  // Free delivery progress bar
  const threshold = parseFloat(STATE.store?.settings?.free_delivery_threshold || 20.0);
  const remaining = Math.max(0, threshold - subtotal);
  const pct = Math.min(100, (subtotal / threshold) * 100);
  const progEl = document.getElementById('free-shipping-progress');
  const txtEl = document.getElementById('free-shipping-text');
  if (progEl) progEl.style.width = `${pct}%`;
  if (txtEl) {
    txtEl.textContent = remaining > 0 ? t.freeShippingLeft(formatOMR(remaining)) : t.freeShippingUnlocked;
  }

  // Cart items list
  const container = document.getElementById('cart-items-container');
  if (!STATE.cart.length) {
    container.innerHTML = `<div style="text-align:center;padding:3rem 1rem;color:var(--text-muted);">${t.emptyCart}</div>`;
  } else {
    container.innerHTML = STATE.cart
      .map((item, idx) => {
        const name = isAr ? item.name_ar : item.name_en;
        const optsText = (item.selected_options || [])
          .map((o) => (isAr ? o.label_ar : o.label_en))
          .join(' • ');
        const lineTotal = item.unit_price_omr * item.quantity;
        return `
        <div class="cart-item-card">
          <img src="${item.image_url}" alt="${name}" class="cart-item-thumb" onerror="this.src='/assets/products/royal-gift-box.svg'" />
          <div>
            <div style="font-weight:700;color:var(--brand-primary);font-size:0.95rem;">${name}</div>
            ${optsText ? `<div style="font-size:0.78rem;color:var(--text-muted);">${optsText}</div>` : ''}
            ${item.special_notes ? `<div style="font-size:0.76rem;color:#8A6634;display:flex;align-items:center;gap:0.3rem;"><svg class="ico-svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg><span>${item.special_notes}</span></div>` : ''}
            <div style="font-weight:800;color:var(--brand-primary-dark);font-size:0.88rem;margin-top:0.25rem;">
              ${formatPriceWithCurrency(lineTotal)}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.35rem;">
            <button onclick="removeCartItem(${idx})" style="background:none;border:none;color:#B91C1C;cursor:pointer;padding:4px;display:flex;align-items:center;" title="حذف" aria-label="حذف">
              <svg class="ico-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
            <div class="qty-control" style="transform:scale(0.85);transform-origin:center;">
              <button class="qty-btn" onclick="updateCartQty(${idx}, -1)">−</button>
              <span class="qty-val">${item.quantity}</span>
              <button class="qty-btn" onclick="updateCartQty(${idx}, 1)">+</button>
            </div>
          </div>
        </div>
      `;
      })
      .join('');
  }

  let discountAmt = 0;
  if (STATE.appliedDiscount) {
    if (STATE.appliedDiscount.discount_type === 'PERCENTAGE') {
      discountAmt = (subtotal * STATE.appliedDiscount.discount_value) / 100.0;
    } else {
      discountAmt = Math.min(subtotal, STATE.appliedDiscount.discount_value);
    }
  }
  const finalTotal = Math.max(0, subtotal - discountAmt);

  document.getElementById('cart-subtotal-val').textContent = formatPriceWithCurrency(subtotal);
  const discRow = document.getElementById('cart-discount-row');
  if (discountAmt > 0) {
    discRow.style.display = 'flex';
    document.getElementById('cart-discount-val').textContent = `-${formatPriceWithCurrency(discountAmt)}`;
  } else {
    discRow.style.display = 'none';
  }
  document.getElementById('cart-final-val').textContent = formatPriceWithCurrency(finalTotal);
}

function updateCartQty(idx, delta) {
  if (!STATE.cart[idx]) return;
  STATE.cart[idx].quantity += delta;
  if (STATE.cart[idx].quantity <= 0) {
    STATE.cart.splice(idx, 1);
  }
  saveCartState();
}

function removeCartItem(idx) {
  STATE.cart.splice(idx, 1);
  saveCartState();
}

function openCartDrawer() {
  document.getElementById('cart-drawer-backdrop').classList.add('open');
}

function closeCartDrawer() {
  document.getElementById('cart-drawer-backdrop').classList.remove('open');
}

async function applyCouponCode() {
  const code = document.getElementById('cart-coupon-input').value.trim();
  const feedback = document.getElementById('coupon-feedback');
  const subtotal = getCartSubtotal();
  if (!code) return;

  try {
    const res = await fetch('/api/discounts/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, subtotal_omr: subtotal }),
    });
    const data = await res.json();
    if (data.valid) {
      STATE.appliedDiscount = data;
      feedback.style.color = '#15803D';
      feedback.textContent = `تم تطبيق كود الخصم (${data.code}) بنجاح! (-${formatPriceWithCurrency(data.discount_amount_omr)})`;
      updateCartUI();
    } else {
      STATE.appliedDiscount = null;
      feedback.style.color = '#B91C1C';
      feedback.textContent = `${STATE.lang === 'ar' ? data.error_ar : data.error_en}`;
      updateCartUI();
    }
  } catch (e) {
    feedback.textContent = 'حدث خطأ أثناء التحقق من الكود';
  }
}

/* ==========================================================================
   WHATSAPP CHECKOUT SYSTEM (DELIVERY / PICKUP / GIFT / ORDER PERSISTENCE)
   ========================================================================== */
function populateDeliveryZonesDropdown() {
  const sel = document.getElementById('chk-zone');
  if (!sel || !STATE.store) return;
  const isAr = STATE.lang === 'ar';
  sel.innerHTML = (STATE.store.delivery_zones || [])
    .map(
      (z) => `
      <option value="${z.id}" data-fee="${z.delivery_fee_omr}" data-free="${z.free_threshold_omr}">
        ${isAr ? z.governorate_ar : z.governorate_en} — (${formatOMR(z.delivery_fee_omr)} ${isAr ? 'ر.ع' : 'OMR'})
      </option>
    `
    )
    .join('');
}

function setFulfillmentType(type) {
  STATE.fulfillmentType = type;
  document.getElementById('tab-delivery').classList.toggle('active', type === 'DELIVERY');
  document.getElementById('tab-pickup').classList.toggle('active', type === 'PICKUP');
  document.getElementById('delivery-fields-box').style.display = type === 'DELIVERY' ? 'block' : 'none';
  document.getElementById('pickup-fields-box').style.display = type === 'PICKUP' ? 'block' : 'none';
  updateCheckoutTotals();
}

function toggleGiftFields() {
  const checked = document.getElementById('chk-is-gift').checked;
  document.getElementById('gift-fields-wrap').style.display = checked ? 'block' : 'none';
}

function openCheckoutModal() {
  if (!STATE.cart.length) {
    showToast(UI_TEXT[STATE.lang].emptyCart);
    return;
  }
  closeCartDrawer();
  document.getElementById('whatsapp-checkout-form').style.display = 'block';
  document.getElementById('checkout-success-box').style.display = 'none';
  updateCheckoutTotals();
  document.getElementById('checkout-modal').classList.add('open');
}

function closeCheckoutModal() {
  document.getElementById('checkout-modal').classList.remove('open');
}

function updateCheckoutTotals() {
  const isAr = STATE.lang === 'ar';
  const subtotal = getCartSubtotal();
  let discountAmt = 0;
  if (STATE.appliedDiscount) {
    discountAmt =
      STATE.appliedDiscount.discount_type === 'PERCENTAGE'
        ? (subtotal * STATE.appliedDiscount.discount_value) / 100.0
        : Math.min(subtotal, STATE.appliedDiscount.discount_value);
  }

  let deliveryFee = 0;
  if (STATE.fulfillmentType === 'DELIVERY') {
    const sel = document.getElementById('chk-zone');
    const opt = sel && sel.selectedOptions[0];
    const zoneFee = opt ? parseFloat(opt.getAttribute('data-fee') || 1.0) : 1.0;
    const zoneFree = opt ? parseFloat(opt.getAttribute('data-free') || 20.0) : 20.0;
    if (subtotal - discountAmt < zoneFree) {
      deliveryFee = zoneFee;
    }
  }

  const total = Math.max(0, subtotal - discountAmt + deliveryFee);

  const itemsRev = document.getElementById('chk-items-review');
  itemsRev.innerHTML = STATE.cart
    .map((it) => {
      const name = isAr ? it.name_ar : it.name_en;
      const opts = (it.selected_options || []).map((o) => (isAr ? o.label_ar : o.label_en)).join('، ');
      return `
      <div style="display:flex;justify-content:space-between;padding:0.3rem 0;border-bottom:1px solid rgba(198,163,101,0.18);">
        <span>• <strong>${name}</strong> × ${it.quantity} ${opts ? `<small style="color:var(--text-muted);">(${opts})</small>` : ''}</span>
        <strong>${formatPriceWithCurrency(it.unit_price_omr * it.quantity)}</strong>
      </div>
    `;
    })
    .join('');

  document.getElementById('chk-rev-subtotal').textContent = formatPriceWithCurrency(subtotal);
  document.getElementById('chk-rev-discount').textContent = `-${formatPriceWithCurrency(discountAmt)}`;
  document.getElementById('chk-rev-delivery').textContent =
    deliveryFee === 0 ? (isAr ? 'مجاني (0.000 ر.ع)' : 'FREE (0.000 OMR)') : formatPriceWithCurrency(deliveryFee);
  document.getElementById('chk-rev-total').textContent = `${formatPriceWithCurrency(total)}`;
}

async function submitWhatsAppOrder(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit-wa-order');
  btn.disabled = true;

  const zoneSelect = document.getElementById('chk-zone');
  const payload = {
    language: STATE.lang,
    customer_name: document.getElementById('chk-name').value.trim(),
    customer_phone: document.getElementById('chk-phone').value.trim(),
    fulfillment_type: STATE.fulfillmentType,
    zone_id: zoneSelect ? zoneSelect.value : null,
    wilayat: document.getElementById('chk-wilayat').value.trim() || 'صحار',
    address_details: document.getElementById('chk-address').value.trim(),
    google_maps_link: document.getElementById('chk-maps').value.trim(),
    scheduled_date: document.getElementById('chk-date').value,
    scheduled_slot: document.getElementById('chk-slot').value,
    is_gift: document.getElementById('chk-is-gift').checked,
    gift_recipient_name: document.getElementById('chk-gift-name').value.trim(),
    gift_recipient_phone: document.getElementById('chk-gift-phone').value.trim(),
    gift_card_message: document.getElementById('chk-gift-msg').value.trim(),
    customer_notes: document.getElementById('chk-notes').value.trim(),
    discount_code: STATE.appliedDiscount ? STATE.appliedDiscount.code : '',
    items: STATE.cart,
  };

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'تعذر حفظ الطلب');
    }

    // Clear cart
    STATE.cart = [];
    STATE.appliedDiscount = null;
    saveCartState();

    // Show Order Confirmation & Lifecycle Screen
    document.getElementById('whatsapp-checkout-form').style.display = 'none';
    const successBox = document.getElementById('checkout-success-box');
    successBox.style.display = 'block';
    successBox.innerHTML = `
      <img src="/assets/crown-emblem.svg" style="height:54px;margin-bottom:0.5rem;" />
      <h3 style="color:var(--brand-primary);font-size:1.55rem;margin-bottom:0.4rem;">
        تم تسجيل طلبك بنجاح في نظام تاج الملك!
      </h3>
      <div style="display:inline-block;background:var(--brand-primary);color:var(--brand-accent-light);padding:0.4rem 1.25rem;border-radius:999px;font-weight:800;font-size:1.1rem;margin-bottom:1rem;">
        رقم الطلب المرجعي: #${data.order_number}
      </div>

      <!-- Visual WhatsApp Order Lifecycle Status Bar -->
      <div style="background:#FAF5EC;border:1.5px solid var(--border-gold);border-radius:14px;padding:1rem;margin-bottom:1.15rem;text-align:right;">
        <div style="font-weight:700;color:var(--brand-primary);margin-bottom:0.5rem;font-size:0.9rem;">
          مراحل متابعة طلب واتساب (Order Status Workflow):
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:0.4rem;font-size:0.78rem;">
          <span style="background:#15803D;color:#FFF;padding:0.25rem 0.65rem;border-radius:999px;font-weight:700;">1. تم حفظ الطلب</span>
          <span style="background:#E5DAC3;color:#5A463F;padding:0.25rem 0.65rem;border-radius:999px;">2. التواصل عبر واتساب</span>
          <span style="background:#E5DAC3;color:#5A463F;padding:0.25rem 0.65rem;border-radius:999px;">3. تأكيد الطلب</span>
          <span style="background:#E5DAC3;color:#5A463F;padding:0.25rem 0.65rem;border-radius:999px;">4. قيد التجهيز</span>
          <span style="background:#E5DAC3;color:#5A463F;padding:0.25rem 0.65rem;border-radius:999px;">5. جاهز</span>
          <span style="background:#E5DAC3;color:#5A463F;padding:0.25rem 0.65rem;border-radius:999px;">6. مكتمل (+${data.loyalty_points_pending} نقطة ولاء)</span>
        </div>
      </div>

      <textarea id="generated-wa-text" readonly class="form-control" rows="7" style="width:100%;font-size:0.84rem;margin-bottom:1rem;background:#FFFDF9;">${data.whatsapp_message}</textarea>

      <div style="display:flex;gap:0.75rem;flex-wrap:wrap;justify-content:center;">
        <a href="${data.whatsapp_url}" target="_blank" rel="noopener" class="whatsapp-btn-big" style="text-decoration:none;flex:1;display:inline-flex;align-items:center;justify-content:center;gap:0.5rem;">
          <svg class="ico-svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          <span>فتح واتساب وإرسال الطلب الآن (+968 91247722)</span>
        </a>
        <button type="button" class="btn-royal-gold" onclick="copyOrderWhatsAppText()" style="display:inline-flex;align-items:center;gap:0.45rem;">
          <svg class="ico-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span>نسخ نص الرسالة</span>
        </button>
      </div>
    `;

    // Automatically open WhatsApp in new tab
    window.open(data.whatsapp_url, '_blank');
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
}

function copyOrderWhatsAppText() {
  const el = document.getElementById('generated-wa-text');
  if (!el) return;
  navigator.clipboard.writeText(el.value);
  showToast('تم نسخ تفاصيل الطلب بنجاح!');
}

function openSpecialEventWhatsApp() {
  const num = STATE.store?.brand?.whatsapp_number || '96891247722';
  const msg = encodeURIComponent(
    'السلام عليكم تاج الملك (حلا الملوك)\nأود الاستفسار عن طلب خاص (محاشي / ورق عنب يالنجي / كبة شامية / صواني مناسبات وأعراس) في صحار:'
  );
  window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
}

/* ==========================================================================
   LOYALTY MODAL & NEWSLETTER
   ========================================================================== */
function openLoyaltyModal() {
  document.getElementById('loyalty-modal').classList.add('open');
}

function closeLoyaltyModal() {
  document.getElementById('loyalty-modal').classList.remove('open');
}

async function checkLoyaltyPoints() {
  const phone = document.getElementById('loyalty-phone-input').value.trim();
  const box = document.getElementById('loyalty-result-box');
  if (!phone) return;
  const res = await fetch(`/api/loyalty/lookup?phone=${encodeURIComponent(phone)}`);
  const data = await res.json();
  if (!data.found) {
    box.innerHTML = `<div style="padding:1rem;background:#FAF5EC;border-radius:12px;color:var(--text-body);">لم يتم العثور على سجل سابق لهذا الرقم. سيبدأ احتساب نقاطك تلقائياً مع أول طلب لك!</div>`;
    return;
  }
  box.innerHTML = `
    <div style="padding:1.15rem;background:var(--brand-primary);color:#FAF3E6;border:2px solid var(--brand-accent);border-radius:14px;">
      <div style="font-size:1.1rem;font-weight:700;margin-bottom:0.35rem;">مرحباً بك، ${data.customer_name}</div>
      <div style="font-size:1.6rem;font-weight:800;color:var(--brand-accent-light);margin-bottom:0.35rem;">
        ${data.points_balance} نقطة ملكية
      </div>
      <div style="font-size:0.84rem;">الفئة: <strong>${data.tier}</strong> | إجمالي الطلبات: ${data.total_orders} (${formatOMR(data.total_spent_omr)} ر.ع)</div>
    </div>
  `;
}

async function submitNewsletter(e) {
  e.preventDefault();
  const email = document.getElementById('newsletter-email').value.trim();
  const msg = document.getElementById('newsletter-msg');
  const res = await fetch('/api/newsletter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, language: STATE.lang }),
  });
  if (res.ok) {
    msg.textContent = 'شكراً لاشتراكك في النشرة الملكية لمتجر تاج الملك!';
    document.getElementById('newsletter-email').value = '';
  }
}

function showToast(message) {
  let toast = document.getElementById('royal-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'royal-toast';
    toast.style.cssText =
      'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#2D070A;color:#E5CB96;border:1.5px solid #C6A365;padding:0.75rem 1.5rem;border-radius:999px;font-weight:700;z-index:500;box-shadow:0 12px 30px rgba(0,0,0,0.4);transition:opacity 0.3s ease;';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    toast.style.opacity = '0';
  }, 2600);
}

document.addEventListener('DOMContentLoaded', initStorefront);
