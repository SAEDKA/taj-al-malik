/* ==========================================================================
   TAJ AL MALIK (تاج الملك - حلا الملوك) — Customer Storefront Engine
   Bilingual RTL/LTR | Persistent Cart | OMR 3-Decimal | WhatsApp Checkout
   ========================================================================== */

const STATE = {
  lang: localStorage.getItem('taj_lang') || 'ar',
  store: null,
  selectedCategory: 'ALL',
  cart: JSON.parse(localStorage.getItem('taj_al_malik_cart_v1') || '[]'),
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
    initRoyalShowcase();
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


function translateAllStaticElements(isAr, t) {
  // Document Title
  document.title = isAr
    ? 'تاج الملك — حلا الملوك | أرقى الحلويات الملكية والمأكولات السورية في سلطنة عُمان'
    : 'Taj Al Malik | Sweets of Kings — Haute Pâtisserie & Syrian Delicacies';

  // Desktop Navbar Links [data-i18n]
  const navMap = {
    nav_menu: isAr ? 'القائمة الكاملة' : 'Full Menu',
    nav_baklava: isAr ? 'الحلويات الملكية' : 'Royal Sweets',
    nav_qashati: isAr ? 'ركن القشاطي' : 'Al-Qashati & Cream',
    nav_syrian: isAr ? 'المأكولات السورية' : 'Syrian Delicacies',
    nav_bestsellers: isAr ? 'الأكثر مبيعاً' : 'Best Sellers',
    nav_story: isAr ? 'قصتنا' : 'Our Story',
  };
  document.querySelectorAll('.desktop-nav-links [data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (navMap[key]) el.textContent = navMap[key];
  });

  // Hero Chips
  const chipPistachio = document.getElementById('chip-pistachio');
  if (chipPistachio) chipPistachio.textContent = isAr ? '✨ فستق حلبي أول وسمن بلدي فاخر' : '✨ 100% Pure Ghee & Aleppo Pistachios';
  const chipFresh = document.getElementById('chip-fresh');
  if (chipFresh) chipFresh.textContent = isAr ? '🥛 قشطة بلدية وحلاوة جبن طازجة يومياً' : '🥛 Fresh Daily Cream & Halawet El Jibn';
  const chipSyrian = document.getElementById('chip-syrian');
  if (chipSyrian) chipSyrian.textContent = isAr ? '🍃 يالنجي وكبة شامية ومحاشي على الطلب' : '🍃 Syrian Yalanji & Kibbeh Made to Order';
  const chipWa = document.getElementById('chip-whatsapp');
  if (chipWa) chipWa.textContent = isAr ? '📲 طلب فوري ومباشر عبر واتساب' : '📲 Direct VIP WhatsApp Ordering';

  // Rotating Showcase Badges & Captions
  const deskBadge = document.getElementById('hero-showcase-badge');
  if (deskBadge) deskBadge.textContent = isAr ? '✨ مختارات ملكية فاخرة' : '✨ Royal Luxury Selection';
  const deskCap = document.getElementById('hero-showcase-caption');
  if (deskCap) deskCap.textContent = isAr ? 'مبرومة فستق ملكية • بلورية • بقلاوة • قشاطي • مأكولات سورية' : 'Pistachio Mabrouma • Ballourieh • Baklava • Qashati • Syrian Specialties';
  const mobBadge = document.getElementById('mobile-showcase-badge');
  if (mobBadge) mobBadge.textContent = isAr ? '✨ مختارات ملكية فاخرة' : '✨ Royal Luxury Selection';
  const mobCap = document.getElementById('mobile-showcase-caption');
  if (mobCap) mobCap.textContent = isAr ? 'مبرومة فستق ملكية • بلورية • بقلاوة • قشاطي • مأكولات سورية' : 'Pistachio Mabrouma • Ballourieh • Baklava • Qashati • Syrian Specialties';

  // Categories Section
  const catKicker = document.getElementById('cat-kicker');
  if (catKicker) catKicker.textContent = isAr ? 'أقسام الضيافة الملكية' : 'Royal Hospitality Categories';
  const catSecTitle = document.getElementById('cat-section-title');
  if (catSecTitle) catSecTitle.textContent = isAr ? 'مختارات الضيافة الفاخرة' : 'Finest Royal Confections';
  const catDesc = document.getElementById('cat-desc');
  if (catDesc) catDesc.textContent = isAr
    ? 'اختر القسم المفضل لديك من الحلويات الشرقية بالكيلو، الهريسة النبكية، القشاطي الطازجة، أو المأكولات السورية'
    : 'Choose your favorite category: sweets by the kilo, Nabkiyah Harissa, fresh cream delicacies, or authentic Syrian savory specialties.';

  // Catalog Section
  const catlgKicker = document.getElementById('catalog-kicker');
  if (catlgKicker) catlgKicker.textContent = isAr ? 'قائمة الأسعار والطلب المباشر' : 'Price List & Direct Ordering';
  const catlgTitle = document.getElementById('catalog-title');
  if (catlgTitle) catlgTitle.textContent = isAr ? 'قائمة الأصناف الملكية والحلويات الفاخرة' : 'Royal Sweets & Delicacies Catalog';
  const catlgDesc = document.getElementById('catalog-desc');
  if (catlgDesc) catlgDesc.textContent = isAr
    ? 'تصفح بالوزن والصحن، مع خيارات إهداء ملكية وتوصيل طازج يومياً لكافة ولايات السلطنة'
    : 'Browse by kilo or platter, with royal gifting options and daily fresh delivery across all Oman wilayats.';

  // Best Sellers Section
  const bestKicker = document.getElementById('best-kicker');
  if (bestKicker) bestKicker.textContent = isAr ? 'الأكثر طلباً وتفضيلاً لدى عائلات السلطنة' : 'Most Cherished & Favored Across Oman';
  const bestTitle = document.getElementById('best-title');
  if (bestTitle) bestTitle.textContent = isAr ? 'مختارات الملك الأكثر مبيعاً 👑' : "King's Choice — Best Sellers 👑";
  const bestDesc = document.getElementById('best-desc');
  if (bestDesc) bestDesc.textContent = isAr
    ? 'أصناف حازت على إعجاب وذوق عملائنا الرفيع في صحار ومسقط وكافة الولايات'
    : 'Signature confections beloved by our discerning clients in Sohar, Muscat, and all wilayats.';

  // Special Offers Section
  const offKicker = document.getElementById('offers-kicker');
  if (offKicker) offKicker.textContent = isAr ? 'عروض حصرية للضيافة والمناسبات' : 'Exclusive Hospitality & Event Offers';
  const offTitle = document.getElementById('offers-title');
  if (offTitle) offTitle.textContent = isAr ? 'بوكسات الضيافة الملكية والعروض الخاصة' : 'Royal Hospitality Boxes & Special Offers';
  const offDesc = document.getElementById('offers-desc');
  if (offDesc) offDesc.textContent = isAr
    ? 'بوكسات مشكلة مصممة لأرقى الجمعات العائلية والأعراس ومناسباتكم الخاصة'
    : 'Curated luxury assortments tailored for family gatherings, weddings, and royal occasions.';

  // Catering & Syrian Specialties Section
  const evTitle = document.getElementById('cat-event-title');
  if (evTitle) evTitle.textContent = isAr ? 'ضيافة الأعراس والمناسبات الملكية' : 'Royal Weddings & Event Catering';
  const evDesc = document.getElementById('cat-event-desc');
  if (evDesc) evDesc.textContent = isAr
    ? 'نقدم صواني وبوفيهات حلويات شرقية فاخرة وموالح شامية راقية مجهزة بأعلى معايير الإتقان لمناسباتكم السعيدة في صحار ومسقط وكافة ولايات السلطنة.'
    : 'We craft magnificent oriental sweets trays, dessert buffets, and Syrian savory catering tailored for your distinguished celebrations across Oman.';
  const evBtn = document.getElementById('cat-event-btn');
  if (evBtn) evBtn.textContent = isAr ? '👑 اطلب تسعيرة مناسباتك الخاصة عبر واتساب' : '👑 Request Catering Quote via WhatsApp';

  const syTitle = document.getElementById('cat-syrian-title');
  if (syTitle) syTitle.textContent = isAr ? 'ركن المأكولات والمحاشي الشامية الأصيلة' : 'Authentic Syrian Cuisine & Savory Delicacies';
  const syDesc = document.getElementById('cat-syrian-desc');
  if (syDesc) syDesc.textContent = isAr
    ? 'يالنجي بزيت الزيتون البكر، كبة شامية مقلية ومشوية، محاشي مشكلة وشيش برك، تُحضر طازجة يومياً على الطلب بأيدي شيف شامي خبير وبنكهة دمشقية أصيلة.'
    : 'Fresh Syrian Yalanji in extra virgin olive oil, crispy fried Kibbeh, stuffed vegetables, and Shish Barak, handcrafted daily to order by master Damascene chefs.';
  const syBtn = document.getElementById('cat-syrian-btn');
  if (syBtn) syBtn.textContent = isAr ? '🍃 اطلب وجبتك الشامية الطازجة الآن' : '🍃 Order Fresh Syrian Delicacies Now';

  // Why Us Section
  const whyKicker = document.getElementById('why-kicker');
  if (whyKicker) whyKicker.textContent = isAr ? 'معايير الجودة الملكية' : 'Royal Standards of Quality';
  const whyTitle = document.getElementById('why-title');
  if (whyTitle) whyTitle.textContent = isAr ? 'لماذا يختار الذواقة حلويات «تاج الملك»؟' : 'Why Connoisseurs Choose Taj Al Malik';

  const w1Title = document.getElementById('w1-title');
  if (w1Title) w1Title.textContent = isAr ? 'سمن بلدي وفستق حلبي أول' : 'Pure Ghee & Hand-Picked Pistachios';
  const w1Desc = document.getElementById('w1-desc');
  if (w1Desc) w1Desc.textContent = isAr
    ? 'نستخدم فقط السمن البقري والبلدي الفاخر وحبات الفستق الحلبي الخضراء المنتقاة حبة بحبة.'
    : 'We exclusively craft our sweets using pure traditional ghee and hand-selected vibrant Aleppo pistachios.';

  const w2Title = document.getElementById('w2-title');
  if (w2Title) w2Title.textContent = isAr ? 'تحضير يومي طازج' : 'Fresh Daily Preparation';
  const w2Desc = document.getElementById('w2-desc');
  if (w2Desc) w2Desc.textContent = isAr
    ? 'القشاطي، حلاوة الجبن، والقطايف تُحضر صباح كل يوم لتصلكم طازجة وبأعلى درجات النقاء.'
    : 'Fresh clotted cream, Halawet El Jibn, and Qatayef are prepared every morning with zero compromises.';

  const w3Title = document.getElementById('w3-title');
  if (w3Title) w3Title.textContent = isAr ? 'توصيل مبرد لكافة الولايات' : 'Chilled Delivery Across Oman';
  const w3Desc = document.getElementById('w3-desc');
  if (w3Desc) w3Desc.textContent = isAr
    ? 'أسطول توصيل سريع ومبرد يضمن وصول الحلويات والمأكولات بطعمها وقوامها المثالي.'
    : 'Fast, temperature-controlled delivery ensures sweets arrive with their exquisite fresh texture intact.';

  const w4Title = document.getElementById('w4-title');
  if (w4Title) w4Title.textContent = isAr ? 'بوكسات إهداء وبطاقات ملكية' : 'Royal Gift Packaging & Cards';
  const w4Desc = document.getElementById('w4-desc');
  if (w4Desc) w4Desc.textContent = isAr
    ? 'تصاميم تغليف ملكية فاخرة تليق بضيوفكم مع إمكانية إضافة بطاقة إهداء مخصصة مجاناً.'
    : 'Opulent royal gift packaging worthy of your guests, complete with complimentary personalized cards.';

  // Testimonials Title
  const testTitle = document.getElementById('testimonials-title');
  if (testTitle) testTitle.textContent = isAr ? 'آراء وتجارب عملائنا الكرام' : 'What Our Esteemed Clients Say';

  // Newsletter Section
  const nlTitle = document.getElementById('nl-title');
  if (nlTitle) nlTitle.textContent = isAr ? 'انضم لنادي الذواقة الملكي' : 'Join the Royal Gourmet Club';
  const nlDesc = document.getElementById('nl-desc');
  if (nlDesc) nlDesc.textContent = isAr
    ? 'اشترك ليصلك جديد عروضنا وأصناف المواسم والمناسبات الخاصة في سلطنة عُمان'
    : 'Subscribe to receive news of our seasonal creations, festive boxes, and VIP offers across Oman.';
  const nlInput = document.getElementById('nl-email-input');
  if (nlInput) nlInput.placeholder = isAr ? 'أدخل بريدك الإلكتروني ليصلك كل جديد...' : 'Enter your email to receive royal updates...';
  const nlBtn = document.getElementById('nl-btn-text');
  if (nlBtn) nlBtn.textContent = isAr ? 'اشتراك' : 'Subscribe';

  // Footer Section
  const fBio = document.getElementById('f-bio');
  if (fBio) fBio.textContent = isAr
    ? 'تاج الملك .. حلا الملوك. أرقى أصناف الحلويات الشرقية الفاخرة، البقلاوة والمبرومة، الهريسة النبكية، القشاطي، والمأكولات الشامية الأصيلة في سلطنة عُمان — ولاية صحار وكافة الولايات.'
    : 'Taj Al Malik .. Sweets of Kings. The finest authentic Oriental sweets, Mabrouma, Baklava, Nabkiyah Harissa, fresh cream specialties, and Levantine savory delicacies in the Sultanate of Oman.';
  const fCatsTitle = document.getElementById('f-cats-title');
  if (fCatsTitle) fCatsTitle.textContent = isAr ? 'الأقسام الملكية' : 'Royal Categories';
  const fLinksTitle = document.getElementById('f-links-title');
  if (fLinksTitle) fLinksTitle.textContent = isAr ? 'روابط سريعة' : 'Quick Links';
  const fContactTitle = document.getElementById('f-contact-title');
  if (fContactTitle) fContactTitle.textContent = isAr ? 'التواصل وفرع صحار' : 'Contact & Sohar Branch';

  const fLinkBaklava = document.getElementById('f-link-baklava');
  if (fLinkBaklava) fLinkBaklava.textContent = isAr ? 'البقلاوة والمبرومة والبلورية' : 'Baklava, Mabrouma & Ballourieh';
  const fLinkHarissa = document.getElementById('f-link-harissa');
  if (fLinkHarissa) fLinkHarissa.textContent = isAr ? 'الهريسة النبكية والشامية' : 'Nabkiyah & Levantine Harissa';
  const fLinkPastries = document.getElementById('f-link-pastries');
  if (fLinkPastries) fLinkPastries.textContent = isAr ? 'القطايف والشعيبيات والفيصلية' : 'Qatayef, Shaibiyat & Faysaliyeh';
  const fLinkQashati = document.getElementById('f-link-qashati');
  if (fLinkQashati) fLinkQashati.textContent = isAr ? 'ركن القشاطي وحلاوة الجبن' : 'Al-Qashati & Halawet El Jibn';
  const fLinkSyrian = document.getElementById('f-link-syrian');
  if (fLinkSyrian) fLinkSyrian.textContent = isAr ? 'اليالنجي والكبة والمحاشي' : 'Yalanji, Kibbeh & Syrian Cuisine';
  const fLinkCart = document.getElementById('f-link-cart');
  if (fLinkCart) fLinkCart.textContent = isAr ? 'سلة التسوق وإتمام الطلب' : 'Shopping Cart & Checkout';
  const fLinkSitemap = document.getElementById('f-link-sitemap');
  if (fLinkSitemap) fLinkSitemap.textContent = isAr ? 'خريطة الموقع (Sitemap)' : 'Site Map (Sitemap)';

  const fContactLoc = document.getElementById('f-contact-loc');
  if (fContactLoc) fContactLoc.innerHTML = isAr ? '<strong>الموقع:</strong> سلطنة عُمان، ولاية صحار' : '<strong>Location:</strong> Sultanate of Oman, Sohar';
  const fContactWa = document.getElementById('f-contact-wa');
  if (fContactWa) fContactWa.innerHTML = isAr ? '<strong>واتساب الطلبات:</strong> <span dir="ltr">+968 91247722</span>' : '<strong>WhatsApp:</strong> <span dir="ltr">+968 91247722</span>';
  const fContactHours = document.getElementById('f-contact-hours');
  if (fContactHours) fContactHours.innerHTML = isAr ? '<strong>ساعات العمل:</strong> يومياً من 9:00 صباحاً حتى 11:30 مساءً' : '<strong>Opening Hours:</strong> Daily 9:00 AM – 11:30 PM';
  const fContactCurrency = document.getElementById('f-contact-currency');
  if (fContactCurrency) fContactCurrency.innerHTML = isAr ? '<strong>العملة الرسمية:</strong> الريال العُماني (OMR)' : '<strong>Currency:</strong> Omani Rial (OMR)';

  const fCopy = document.getElementById('f-copy');
  if (fCopy) fCopy.textContent = isAr ? '© 2026 تاج الملك — حلا الملوك. جميع الحقوق محفوظة.' : '© 2026 Taj Al Malik — Sweets of Kings. All Rights Reserved.';
  const fTagline = document.getElementById('f-tagline');
  if (fTagline) fTagline.textContent = isAr ? 'صُنعت بحب وإتقان ملكي في سلطنة عُمان 🇴🇲' : 'Crafted with royal passion & mastery in the Sultanate of Oman 🇴🇲';

  // Cart Drawer
  const cTitle = document.getElementById('cart-drawer-title-text');
  if (cTitle) cTitle.textContent = isAr ? 'سلة الحلويات الملكية' : 'Your Royal Sweets Cart';
  const cSubLbl = document.getElementById('cart-lbl-subtotal');
  if (cSubLbl) cSubLbl.textContent = isAr ? 'المجموع الفرعي:' : 'Subtotal:';
  const cDelivNote = document.getElementById('cart-lbl-delivery-note');
  if (cDelivNote) cDelivNote.textContent = isAr ? 'يتم احتساب رسوم التوصيل بحسب الولاية في خطوة الدفع' : 'Delivery fee calculated by Wilayat during checkout';
  const cChkBtn = document.getElementById('cart-btn-checkout-text');
  if (cChkBtn) cChkBtn.textContent = isAr ? 'متابعة إتمام الطلب (Checkout)' : 'Proceed to Royal Checkout';

  // Checkout Modal Header & Tabs
  const chkHead = document.getElementById('chk-header-title-text');
  if (chkHead) chkHead.textContent = isAr ? 'إتمام طلب الضيافة الملكية' : 'Complete Your Royal Order';
  const chkStep1 = document.getElementById('chk-step1-title');
  if (chkStep1) chkStep1.textContent = isAr ? '1. بيانات المستلم وعنوان التوصيل في سلطنة عُمان' : '1. Recipient Details & Delivery Address in Oman';

  const tabDel = document.getElementById('tab-delivery');
  if (tabDel) tabDel.innerHTML = `<svg class="ico-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> <span>${isAr ? 'توصيل لكافة الولايات' : 'Delivery Across Oman'}</span>`;
  const tabPick = document.getElementById('tab-pickup');
  if (tabPick) tabPick.innerHTML = `<svg class="ico-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> <span>${isAr ? 'استلام من فرع صحار' : 'Pickup from Sohar Branch'}</span>`;

  // Checkout Form Labels & Placeholders
  const lblName = document.getElementById('lbl-chk-name');
  if (lblName) lblName.textContent = isAr ? 'الاسم الكريم *' : 'Full Name *';
  const inputName = document.getElementById('chk-name');
  if (inputName) inputName.placeholder = isAr ? 'مثال: الشيخ سالم المعمري' : 'e.g. Salim Al Maamari';

  const lblPhone = document.getElementById('lbl-chk-phone');
  if (lblPhone) lblPhone.textContent = isAr ? 'رقم الهاتف / واتساب للتنسيق *' : 'Mobile / WhatsApp Number *';

  const lblWil = document.getElementById('lbl-chk-wilayat');
  if (lblWil) lblWil.textContent = isAr ? 'الولاية / المنطقة *' : 'Wilayat / Region *';

  const lblAddr = document.getElementById('lbl-chk-address');
  if (lblAddr) lblAddr.textContent = isAr ? 'العنوان التفصيلي (المنطقة، الشارع، رقم المنزل / المعلم) *' : 'Detailed Address (Area, Street, Way / Landmark) *';
  const inputAddr = document.getElementById('chk-address');
  if (inputAddr) inputAddr.placeholder = isAr ? 'مثال: صحار - الهمبار، بجوار جامع السلطان قابوس، منزل رقم...' : 'e.g. Sohar - Al Hambar, near Sultan Qaboos Mosque...';

  const lblDate = document.getElementById('lbl-chk-date');
  if (lblDate) lblDate.textContent = isAr ? 'تاريخ الاستلام أو التوصيل المفضل *' : 'Preferred Delivery / Pickup Date *';

  const optToday = document.getElementById('chk-opt-today');
  if (optToday) optToday.textContent = isAr ? 'اليوم (طازج وفوري)' : 'Today (Immediate & Fresh)';
  const optTomorrow = document.getElementById('chk-opt-tomorrow');
  if (optTomorrow) optTomorrow.textContent = isAr ? 'غداً' : 'Tomorrow';
  const optDayafter = document.getElementById('chk-opt-dayafter');
  if (optDayafter) optDayafter.textContent = isAr ? 'بعد غد' : 'Day After Tomorrow';
  const optLater = document.getElementById('chk-opt-later');
  if (optLater) optLater.textContent = isAr ? 'موعد لاحق (يُحدد في الملاحظات)' : 'Later Date (Specify in notes)';

  const lblSlot = document.getElementById('lbl-chk-slot');
  if (lblSlot) lblSlot.textContent = isAr ? 'وقت التوصيل المفضل *' : 'Preferred Delivery Time Slot *';

  const optMorn = document.getElementById('chk-opt-morning');
  if (optMorn) optMorn.textContent = isAr ? 'الفترة الصباحية (10:00 ص - 1:00 ظ)' : 'Morning (10:00 AM - 1:00 PM)';
  const optEve = document.getElementById('chk-opt-evening');
  if (optEve) optEve.textContent = isAr ? 'فترة العصر والمساء (4:30 م - 8:30 م)' : 'Afternoon & Evening (4:30 PM - 8:30 PM)';
  const optNight = document.getElementById('chk-opt-night');
  if (optNight) optNight.textContent = isAr ? 'الفترة الليلية (8:30 م - 11:30 م)' : 'Night (8:30 PM - 11:30 PM)';

  // Gift section
  const lblGift = document.getElementById('lbl-chk-is-gift');
  if (lblGift) lblGift.textContent = isAr ? 'إرسال هذا الطلب كهدية ملكية مع بطاقة إهداء «تاج الملك - حلا الملوك»' : 'Send this order as a Royal Gift with complimentary greeting card';
  const lblGName = document.getElementById('lbl-gift-name');
  if (lblGName) lblGName.textContent = isAr ? 'اسم مستلم الهدية' : 'Gift Recipient Name';
  const inGName = document.getElementById('chk-gift-name');
  if (inGName) inGName.placeholder = isAr ? 'اسم الشخص المهدى إليه' : 'Recipient full name';

  const lblGPhone = document.getElementById('lbl-gift-phone');
  if (lblGPhone) lblGPhone.textContent = isAr ? 'رقم هاتف المستلم' : 'Recipient Phone Number';

  const lblGMsg = document.getElementById('lbl-gift-msg');
  if (lblGMsg) lblGMsg.textContent = isAr ? 'عبارة بطاقة الإهداء الملكية' : 'Royal Greeting Card Message';
  const inGMsg = document.getElementById('chk-gift-msg');
  if (inGMsg) inGMsg.placeholder = isAr ? 'مثال: مبارك عليكم، كل قطعة صنعت بحب من تاج الملك...' : 'e.g. Warmest congratulations, crafted with royal love...';

  const lblNotes = document.getElementById('lbl-chk-notes');
  if (lblNotes) lblNotes.textContent = isAr ? 'ملاحظات إضافية على الطلب أو التغليف' : 'Additional Order or Packaging Notes';
  const inNotes = document.getElementById('chk-notes');
  if (inNotes) inNotes.placeholder = isAr ? 'أي تفاصيل ترغب بإضافتها لفريق التجهيز في تاج الملك...' : 'Any details or preferences for Taj Al Malik preparation team...';

  // Checkout Review Summary
  const chkStep2 = document.getElementById('chk-step2-title');
  if (chkStep2) chkStep2.textContent = isAr ? '2. مراجعة ملخص الطلب والأسعار (OMR)' : '2. Order Summary & Price Review (OMR)';
  const chkRevSub = document.getElementById('chk-rev-lbl-subtotal');
  if (chkRevSub) chkRevSub.textContent = isAr ? 'المجموع الفرعي للمنتجات:' : 'Items Subtotal:';
  const chkRevDel = document.getElementById('chk-rev-lbl-delivery');
  if (chkRevDel) chkRevDel.textContent = isAr ? 'رسوم التوصيل:' : 'Delivery Fee:';
  const chkRevTot = document.getElementById('chk-rev-lbl-total');
  if (chkRevTot) chkRevTot.textContent = isAr ? 'الإجمالي النهائي المطلوب:' : 'Total Amount Payable:';

  const chkBtnWa = document.getElementById('btn-submit-wa-order-text');
  if (chkBtnWa) chkBtnWa.textContent = isAr ? 'اعتماد وحفظ الطلب وإرساله عبر واتساب (+968 91247722)' : 'Confirm & Send Order via WhatsApp (+968 91247722)';
}

function renderAllStorefront() {
  const { brand, sections, settings } = STATE.store;
  const isAr = STATE.lang === 'ar';
  const t = UI_TEXT[STATE.lang];
  translateAllStaticElements(isAr, t);

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

  const floatingCartLbl = document.getElementById('floating-cart-btn-label') || document.getElementById('mobile-cart-btn-label');
  if (floatingCartLbl) floatingCartLbl.textContent = t.cartLabel;

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
    <div class="category-card ${STATE.selectedCategory === 'ALL' ? 'active' : ''}" onclick="selectCategory('ALL', true)">
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
      <div class="category-card ${isActive ? 'active' : ''}" onclick="selectCategory('${c.code}', true)">
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

function royalSnappyScroll(targetY, duration = 340, onComplete = null) {
  const startY = window.pageYOffset;
  const distance = targetY - startY;
  if (Math.abs(distance) < 6) {
    if (onComplete) onComplete();
    return;
  }
  const startTime = performance.now();

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = easeOutCubic(progress);
    window.scrollTo(0, Math.round(startY + (distance * easeProgress)));

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      window.scrollTo(0, targetY);
      if (onComplete) onComplete();
    }
  }

  requestAnimationFrame(step);
}

function selectCategory(catCode, autoScroll = false) {
  STATE.selectedCategory = catCode;
  renderCategories();

  const grid = document.getElementById('catalog-products-grid');
  if (grid) {
    grid.classList.add('page-transitioning');
    setTimeout(() => {
      renderCatalog();
      grid.classList.remove('page-transitioning');
      grid.classList.add('page-entering');
      setTimeout(() => grid.classList.remove('page-entering'), 260);
    }, 70);
  } else {
    renderCatalog();
  }

  if (autoScroll) {
    const catalogEl = document.getElementById('catalog-section');
    if (catalogEl) {
      const header = document.querySelector('.site-header.desktop-only');
      const headerHeight = (header && window.innerWidth > 768) ? header.offsetHeight : 0;
      const targetY = Math.max(0, catalogEl.getBoundingClientRect().top + window.pageYOffset - headerHeight - 12);
      royalSnappyScroll(targetY, 320);
    }
  }
}

function selectCategoryFromDropdown(catCode) {
  selectCategory(catCode, false);
}

function scrollToSection(sectionId, catCode) {
  if (catCode) {
    selectCategory(catCode, false);
  }
  const el = document.getElementById(sectionId);
  if (!el) return;

  const header = document.querySelector('.site-header.desktop-only');
  const headerHeight = (header && window.innerWidth > 768) ? header.offsetHeight : 0;
  const targetY = Math.max(0, el.getBoundingClientRect().top + window.pageYOffset - headerHeight - 12);

  royalSnappyScroll(targetY, 340, () => {
    el.classList.remove('section-glided');
    void el.offsetWidth;
    el.classList.add('section-glided');
    setTimeout(() => el.classList.remove('section-glided'), 550);
  });
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
          <span style="font-weight:700;color:var(--text-heading);">${isAr ? 'السعر حسب الخيار المحدد:' : 'Price for Selected Option:'}</span>
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

  // Update Floating Cart (Desktop & Mobile)
  const cartCountEl = document.getElementById('floating-cart-count') || document.getElementById('mobile-cart-count');
  if (cartCountEl) cartCountEl.textContent = totalCount;
  const cartTotalEl = document.getElementById('floating-cart-total') || document.getElementById('mobile-cart-total');
  if (cartTotalEl) cartTotalEl.textContent = formatPriceWithCurrency(subtotal);

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

  document.getElementById('cart-subtotal-val').textContent = formatPriceWithCurrency(subtotal);
  document.getElementById('cart-final-val').textContent = formatPriceWithCurrency(subtotal);
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

  let deliveryFee = 0;
  if (STATE.fulfillmentType === 'DELIVERY') {
    const sel = document.getElementById('chk-zone');
    const opt = sel && sel.selectedOptions[0];
    const zoneFee = opt ? parseFloat(opt.getAttribute('data-fee') || 1.0) : 1.0;
    const zoneFree = opt ? parseFloat(opt.getAttribute('data-free') || 20.0) : 20.0;
    if (subtotal < zoneFree) {
      deliveryFee = zoneFee;
    }
  }

  const total = Math.max(0, subtotal + deliveryFee);

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
    saveCartState();

    // Show Order Confirmation & Lifecycle Screen
    document.getElementById('whatsapp-checkout-form').style.display = 'none';
    const successBox = document.getElementById('checkout-success-box');
    successBox.style.display = 'block';
    const isAr = STATE.lang === 'ar';
    successBox.innerHTML = `
      <img src="/assets/crown-emblem.svg" style="height:54px;margin-bottom:0.5rem;" />
      <h3 style="color:var(--brand-primary);font-size:1.55rem;margin-bottom:0.4rem;">
        ${isAr ? 'تم تسجيل طلبك بنجاح في نظام تاج الملك!' : 'Your order has been recorded in Taj Al Malik system!'}
      </h3>
      <div style="display:inline-block;background:var(--brand-primary);color:var(--brand-accent-light);padding:0.4rem 1.25rem;border-radius:999px;font-weight:800;font-size:1.1rem;margin-bottom:1rem;">
        ${isAr ? `رقم الطلب المرجعي: #${data.order_number}` : `Reference Order #: #${data.order_number}`}
      </div>

      <!-- Visual WhatsApp Order Lifecycle Status Bar -->
      <div style="background:#FAF5EC;border:1.5px solid var(--border-gold);border-radius:14px;padding:1rem;margin-bottom:1.15rem;text-align:${isAr ? 'right' : 'left'};">
        <div style="font-weight:700;color:var(--brand-primary);margin-bottom:0.5rem;font-size:0.9rem;">
          ${isAr ? 'مراحل متابعة طلب واتساب (Order Status Workflow):' : 'WhatsApp Order Lifecycle Workflow:'}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:0.4rem;font-size:0.78rem;">
          <span style="background:#15803D;color:#FFF;padding:0.25rem 0.65rem;border-radius:999px;font-weight:700;">${isAr ? '1. تم حفظ الطلب' : '1. Order Saved'}</span>
          <span style="background:#E5DAC3;color:#5A463F;padding:0.25rem 0.65rem;border-radius:999px;">${isAr ? '2. التواصل عبر واتساب' : '2. WhatsApp Contact'}</span>
          <span style="background:#E5DAC3;color:#5A463F;padding:0.25rem 0.65rem;border-radius:999px;">${isAr ? '3. تأكيد الطلب' : '3. Confirmation'}</span>
          <span style="background:#E5DAC3;color:#5A463F;padding:0.25rem 0.65rem;border-radius:999px;">${isAr ? '4. قيد التجهيز' : '4. In Prep'}</span>
          <span style="background:#E5DAC3;color:#5A463F;padding:0.25rem 0.65rem;border-radius:999px;">${isAr ? '5. جاهز' : '5. Ready'}</span>
          <span style="background:#E5DAC3;color:#5A463F;padding:0.25rem 0.65rem;border-radius:999px;">${isAr ? '6. مكتمل' : '6. Completed'}</span>
        </div>
      </div>

      <textarea id="generated-wa-text" readonly class="form-control" rows="7" style="width:100%;font-size:0.84rem;margin-bottom:1rem;background:#FFFDF9;">${data.whatsapp_message}</textarea>

      <div style="display:flex;gap:0.75rem;flex-wrap:wrap;justify-content:center;">
        <a href="${data.whatsapp_url}" target="_blank" rel="noopener" class="whatsapp-btn-big" style="text-decoration:none;flex:1;display:inline-flex;align-items:center;justify-content:center;gap:0.5rem;">
          <svg class="ico-svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          <span>${isAr ? 'فتح واتساب وإرسال الطلب الآن (+968 91247722)' : 'Open WhatsApp & Send Order Now (+968 91247722)'}</span>
        </a>
        <button type="button" class="btn-royal-gold" onclick="copyOrderWhatsAppText()" style="display:inline-flex;align-items:center;gap:0.45rem;">
          <svg class="ico-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span>${isAr ? 'نسخ نص الرسالة' : 'Copy Message Text'}</span>
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
  showToast(STATE.lang === 'ar' ? 'تم نسخ تفاصيل الطلب بنجاح!' : 'Order details copied to clipboard!');
}

function openSpecialEventWhatsApp() {
  const num = STATE.store?.brand?.whatsapp_number || '96891247722';
  const msg = encodeURIComponent(
    'السلام عليكم تاج الملك (حلا الملوك)\nأود الاستفسار عن طلب خاص (محاشي / ورق عنب يالنجي / كبة شامية / صواني مناسبات وأعراس) في صحار:'
  );
  window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
}

/* ==========================================================================
   NEWSLETTER & TOAST NOTIFICATIONS
   ========================================================================== */
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

/* ==========================================================================
   Royal Showcase Carousel (Desktop & Mobile Auto-Rotation - 3s)
   ========================================================================== */
const ROYAL_SHOWCASE_ITEMS = [
  {
    name_ar: 'مبرومة فستق ملكية فاخرة',
    name_en: 'Royal Pistachio Mabrouma',
    tagline_ar: 'فستق حلبي أول محمص بالسمن البلدي الطبيعي',
    tagline_en: 'Premium Aleppo Pistachio & Pure Country Ghee',
    image: '/assets/products/mabrouma-pistachio.svg',
    category: 'royal-baklava'
  },
  {
    name_ar: 'بلورية بالفستق الحلبي الملكي',
    name_en: 'Royal Pistachio Ballourieh',
    tagline_ar: 'بياض ناصع، وسكر موزون بأرقى معايير الضيافة',
    tagline_en: 'Authentic White Kadaif with Pure Aleppo Pistachios',
    image: '/assets/products/ballourieh-pistachio.svg',
    category: 'royal-baklava'
  },
  {
    name_ar: 'بقلاوة بالفستق والسمن البلدي',
    name_en: 'Royal Assorted Baklava',
    tagline_ar: 'رقائق ذهبية مقرمشة محشوة بأجود أنواع الفستق',
    tagline_en: 'Crispy Golden Filo Layers Stuffed with Pistachios',
    image: '/assets/products/baklava-pistachio.svg',
    category: 'royal-baklava'
  },
  {
    name_ar: 'حلاوة الجبن الملكية بالقشطة الطازجة',
    name_en: 'Royal Halawet El Jibn',
    tagline_ar: 'طازجة يومياً بالقشطة البلدية وماء الزهر الفاخر',
    tagline_en: 'Fresh Daily with Syrian Qishta & Orange Blossom',
    image: '/assets/products/halawet-jibn-large.svg',
    category: 'al-qashati'
  },
  {
    name_ar: 'الهريسة النبكية الملكية بالفستق واللوز',
    name_en: 'Royal Nabkiyah Harissa',
    tagline_ar: 'سر النكهة الشامية الأصيلة بالسمن البلدي الفاخر',
    tagline_en: 'Authentic Syrian Nabkiyah with Almonds & Ghee',
    image: '/assets/products/harissa-pistachio.svg',
    category: 'nabkiyah-harissa'
  },
  {
    name_ar: 'عش البلبل الملكي بالفستق الأخضر',
    name_en: "Royal Bulbul's Nest",
    tagline_ar: 'خيوط عثمانية ذهبية محشوة بحبات الفستق الكاملة',
    tagline_en: 'Crisp Golden Bird Nests Filled with Whole Pistachios',
    image: '/assets/products/bulbul-nest.svg',
    category: 'royal-baklava'
  },
  {
    name_ar: 'ورق عنب يالنجي ملكي فاخر',
    name_en: 'Royal Syrian Yalanji',
    tagline_ar: 'محضر بزيت الزيتون البكر ودبس الرمان الطبيعي',
    tagline_en: 'Handmade Vine Leaves with Virgin Olive Oil & Pomegranate',
    image: '/assets/products/yalanji-vine-leaves.svg',
    category: 'syrian-savory'
  },
  {
    name_ar: 'بوكس الضيافة الملكي الفاخر',
    name_en: 'Royal VIP Hospitality Gift Box',
    tagline_ar: 'تشكيلة الملوك الفاخرة لجميع المناسبات السعيدة',
    tagline_en: 'Exclusive VIP Assortment for Royal Occasions',
    image: '/assets/products/royal-gift-box.svg',
    category: 'featured-section'
  }
];

let showcaseCurrentIndex = 0;
let showcaseTimer = null;
let showcaseIsPaused = false;

function initRoyalShowcase() {
  const dotsContainer = document.getElementById('showcase-dots');
  if (dotsContainer) {
    dotsContainer.innerHTML = ROYAL_SHOWCASE_ITEMS.map((_, i) =>
      `<span class="showcase-dot ${i === 0 ? 'active' : ''}" onclick="goToShowcaseIndex(${i}); event.stopPropagation();"></span>`
    ).join('');
  }

  const deskBox = document.getElementById('hero-showcase-box');
  if (deskBox) {
    deskBox.addEventListener('mouseenter', () => { showcaseIsPaused = true; });
    deskBox.addEventListener('mouseleave', () => { showcaseIsPaused = false; });
  }

  updateShowcaseDisplay();
  startShowcaseTimer();
}

function startShowcaseTimer() {
  if (showcaseTimer) clearInterval(showcaseTimer);
  triggerShowcaseProgressBar();

  showcaseTimer = setInterval(() => {
    if (!showcaseIsPaused) {
      showcaseNext();
    }
  }, 3000);
}

function triggerShowcaseProgressBar() {
  const bar = document.getElementById('showcase-progress-bar');
  if (!bar) return;
  bar.style.transition = 'none';
  bar.style.width = '0%';
  void bar.offsetWidth;
  bar.style.transition = 'width 3000ms linear';
  bar.style.width = '100%';
}

function showcaseNext() {
  showcaseCurrentIndex = (showcaseCurrentIndex + 1) % ROYAL_SHOWCASE_ITEMS.length;
  updateShowcaseDisplay();
  triggerShowcaseProgressBar();
}

function goToShowcaseIndex(index) {
  showcaseCurrentIndex = index;
  updateShowcaseDisplay();
  startShowcaseTimer();
}

function updateShowcaseDisplay() {
  const item = ROYAL_SHOWCASE_ITEMS[showcaseCurrentIndex];
  if (!item) return;

  const isEn = STATE.lang === 'en';
  const title = isEn ? item.name_en : item.name_ar;
  const subtitle = isEn ? item.tagline_en : (item.name_en + ' • ' + item.tagline_ar);

  // Desktop Elements
  const deskImg = document.getElementById('hero-main-img');
  const deskTitle = document.getElementById('hero-showcase-title');
  const deskSubtitle = document.getElementById('hero-showcase-subtitle');
  const dots = document.querySelectorAll('.showcase-dot');

  // Mobile Elements
  const mobImg = document.getElementById('mobile-hero-main-img');
  const mobTitle = document.getElementById('mobile-showcase-title');

  // 1. Fade out
  if (deskImg) deskImg.classList.add('fade-out');
  if (mobImg) mobImg.classList.add('fade-out');
  if (deskTitle) deskTitle.classList.add('text-fade-out');
  if (deskSubtitle) deskSubtitle.classList.add('text-fade-out');
  if (mobTitle) mobTitle.classList.add('text-fade-out');

  // 2. Switch content & Fade in after 220ms
  setTimeout(() => {
    if (deskImg) {
      deskImg.src = item.image;
      deskImg.alt = title;
      deskImg.classList.remove('fade-out');
      deskImg.classList.add('fade-in');
    }
    if (mobImg) {
      mobImg.src = item.image;
      mobImg.alt = title;
      mobImg.classList.remove('fade-out');
      mobImg.classList.add('fade-in');
    }
    if (deskTitle) {
      deskTitle.textContent = title;
      deskTitle.classList.remove('text-fade-out');
    }
    if (deskSubtitle) {
      deskSubtitle.textContent = subtitle;
      deskSubtitle.classList.remove('text-fade-out');
    }
    if (mobTitle) {
      mobTitle.textContent = title;
      mobTitle.classList.remove('text-fade-out');
    }

    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === showcaseCurrentIndex);
    });

    setTimeout(() => {
      if (deskImg) deskImg.classList.remove('fade-in');
      if (mobImg) mobImg.classList.remove('fade-in');
    }, 450);
  }, 220);
}

function handleShowcaseClick() {
  const item = ROYAL_SHOWCASE_ITEMS[showcaseCurrentIndex];
  if (!item) return;
  if (item.category === 'featured-section') {
    scrollToSection('featured-section');
  } else {
    scrollToSection('catalog-section', item.category);
  }
}

document.addEventListener('DOMContentLoaded', initStorefront);
