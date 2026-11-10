import hashlib
import json
from datetime import datetime, timedelta
import bcrypt
from backend.database import get_db, init_schema


def hash_password(plain_text: str) -> str:
    try:
        return bcrypt.hashpw(plain_text.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    except Exception:
        return hashlib.sha256(plain_text.encode("utf-8")).hexdigest()


def verify_password(plain_text: str, hashed: str) -> bool:
    try:
        if hashed.startswith("$2"):
            return bcrypt.checkpw(plain_text.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        pass
    return hashlib.sha256(plain_text.encode("utf-8")).hexdigest() == hashed


def seed_database():
    init_schema()
    with get_db() as conn:
        existing = conn.execute("SELECT COUNT(*) as cnt FROM products").fetchone()["cnt"]
        if existing > 0:
            return

        # 1. Roles & Permissions
        permissions_data = [
            ("manage_orders", "إدارة الطلبات وتحديث حالات واتساب / Manage orders & WhatsApp status"),
            ("view_products", "عرض المنتجات والتصنيفات / View products & categories"),
            ("manage_products", "إضافة وتعديل وحذف المنتجات والمخزون / Create, edit & delete products"),
            ("view_analytics", "عرض تقارير المبيعات والتحليلات / View sales & product analytics"),
            ("manage_marketing", "إدارة أكواد الخصم والولاء / Manage discounts & loyalty"),
            ("manage_settings", "إدارة الهوية البصرية وإعدادات المتجر والموظفين / Manage branding & staff"),
        ]
        for code, desc in permissions_data:
            conn.execute("INSERT INTO permissions (code, description) VALUES (?, ?)", (code, desc))

        conn.execute(
            "INSERT INTO roles (id, name, description) VALUES (1, 'ADMIN', 'المدير العام - صلاحيات كاملة على المتجر ولوحة التحكم')"
        )
        conn.execute(
            "INSERT INTO roles (id, name, description) VALUES (2, 'STAFF', 'موظف مبيعات وتجهيز طلبات - صلاحيات محددة للطلبات والمنتجات')"
        )

        all_perms = conn.execute("SELECT id, code FROM permissions").fetchall()
        for p in all_perms:
            conn.execute("INSERT INTO role_permissions (role_id, permission_id) VALUES (1, ?)", (p["id"],))
            if p["code"] in ("manage_orders", "view_products", "manage_products", "view_analytics"):
                conn.execute("INSERT INTO role_permissions (role_id, permission_id) VALUES (2, ?)", (p["id"],))

        conn.execute(
            """
            INSERT INTO users (full_name, email, password_hash, role_id, is_active)
            VALUES (?, ?, ?, 1, 1), (?, ?, ?, 2, 1)
            """,
            (
                "سعيد - مدير تاج الملك",
                "admin@tajalamlik.om",
                hash_password("admin123"),
                "قاسم - مسؤول الطلبات والتجهيز",
                "staff@tajalamlik.om",
                hash_password("staff123"),
            ),
        )

        # 2. Brand Settings & Store Settings (Extracted from Taj Al Malik PDF)
        conn.execute(
            """
            INSERT INTO brand_settings (
                id, store_name_ar, store_name_en, tagline_ar, tagline_en,
                primary_color, secondary_color, accent_color, surface_color,
                theme_preset, logo_url, whatsapp_number, phone_display,
                instagram_handle, instagram_url, location_ar, location_en
            ) VALUES (
                1,
                'تاج الملك',
                'Taj Al Malik',
                'تاج الملك - حلا الملوك',
                'Taj Al Malik — Sweets of Kings',
                '#4A0E13',
                '#2D070A',
                '#C6A365',
                '#FAF7F2',
                'ROYAL_BURGUNDY_GOLD',
                '/assets/logo-gold.svg',
                '96891247722',
                '+968 91247722',
                'Tajalamlik.om',
                'https://www.instagram.com/Tajalamlik.om',
                'سلطنة عُمان، صحار',
                'Sultanate of Oman, Sohar'
            )
            """
        )

        conn.execute(
            """
            INSERT INTO store_settings (
                id, currency_code, currency_decimals, free_delivery_threshold,
                enable_loyalty, loyalty_points_per_omr, loyalty_reward_threshold,
                enable_newsletter, enable_testimonials, best_sellers_mode
            ) VALUES (1, 'OMR', 3, 20.000, 1, 10, 200, 1, 1, 'AUTOMATIC')
            """
        )

        # 3. Homepage Sections (Using the exact brand message from the PDF!)
        sections = [
            (
                "HERO",
                "تاج الملك .. حلا الملوك لذوي الذوق الرفيع",
                "Taj Al Malik — Royal Oriental Sweets Crafted for Connoisseurs",
                "كل قطعة من حلوياتنا تُصنع بحب، مستوحاة من التقاليد ولمسة ملكية، لنقدم لكم أرقى نكهات الشرق في سلطنة عُمان.",
                "Every piece of our sweets is crafted with love, inspired by authentic heritage and a royal touch, bringing you the finest flavors of the Orient in Oman.",
                "أصالة الفستق الحلبي الفاخر • القشطة البلدية الطازجة يومياً • تغليف ملكي يليق بمناسباتكم",
                "Premium Aleppo Pistachios • Fresh Daily Country Qishta • Royal Gift Packaging",
                "تسوق الحلويات الملكية",
                "Shop Royal Sweets",
                "استكشف القائمة الكاملة",
                "Explore Full Menu",
                "https://images.unsplash.com/photo-1519676867240-f03562e64548?auto=format&fit=crop&w=1400&q=85",
                1,
            ),
            (
                "ABOUT",
                "شكراً لاختياركم تاج الملك — حلا الملوك",
                "Thank You for Choosing Taj Al Malik — Sweets of Kings",
                "قصة شغف، أصالة شرقية، ولمسة ملكية من قلب ولاية صحار",
                "A Story of Passion, Oriental Authenticity & Royal Craftsmanship from Sohar, Oman",
                "كل قطعة من حلوياتنا تُصنع بحب، مستوحاة من التقاليد ولمسة ملكية، لنقدم لكم أرقى نكهات الشرق. يشرفنا أن نكون جزءاً من لحظاتكم المميزة، ونتمنى أن تضيف حلوياتنا البهجة والحلاوة إلى يومكم. دعمكم يعني لنا الكثير، ونتطلع لخدمتكم دائماً بأعلى معايير الجودة والفخامة.",
                "Every piece of our sweets is crafted with love, inspired by time-honored traditions and a royal touch to bring you the finest flavors of the East. We are honored to be part of your special moments and wish to add joy and sweetness to your day.",
                "تواصل معنا عبر واتساب",
                "Order via WhatsApp",
                "زورونا في صحار",
                "Visit Us in Sohar",
                "https://images.unsplash.com/photo-1579372786545-d24232daf58c?auto=format&fit=crop&w=1200&q=85",
                1,
            ),
            (
                "CATERING",
                "طلبات المناسبات والأعراس والمأكولات الشامية على الطلب",
                "Royal Weddings, Events & Custom Syrian Delicacies on Order",
                "نجهز صواني الضيافة الملكية، البقلاوة الفاخرة، المحاشي، ورق العنب (اليالنجي)، والكبة الشامية لمناسباتكم وجمعاتكم العائلية في صحار وكافة ولايات السلطنة.",
                "We prepare royal hospitality trays, fine baklava, Syrian Mahashi, Yalanji vine leaves, and Kibbeh for your weddings, events, and family gatherings across Sohar and Oman.",
                "تجهيز طازج حسب الطلب • تغليف ملكي فاخر • توصيل منظم للمناسبات",
                "Fresh Custom Preparation • Luxury Royal Packaging • Scheduled Event Delivery",
                "احجز طلب مناسبتك عبر واتساب",
                "Book Event Order on WhatsApp",
                "",
                "",
                "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=1200&q=85",
                1,
            ),
        ]
        for s in sections:
            conn.execute(
                """
                INSERT INTO homepage_sections (
                    section_key, title_ar, title_en, subtitle_ar, subtitle_en,
                    content_ar, content_en, button_ar, button_en,
                    secondary_button_ar, secondary_button_en, image_url, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                s,
            )

        # 4. Oman Delivery Zones (Centered around Sohar + Sultanate of Oman)
        zones = [
            (
                "شمال الباطنة - ولاية صحار",
                "North Al Batinah — Sohar Wilayat",
                "صحار (الطريف، الهمبار، الوقيبة، فلج القبائل، الخويرية، الصويحرة، العوهي، مجيس)",
                "Sohar (Al Tareef, Al Humbar, Al Waqibah, Falaj Al Qabail, Al Khuwayriyah, Majis)",
                1.000,
                20.000,
                "خلال 45 - 90 دقيقة (طازج يومياً)",
                "Within 45 - 90 mins (Fresh Daily)",
                1,
            ),
            (
                "شمال الباطنة - بقية الولايات",
                "North Al Batinah — Other Wilayats",
                "لوى، شناص، صحم، الخابورة، السويق",
                "Liwa, Shinas, Saham, Al Khaburah, Al Suwaiq",
                1.500,
                25.000,
                "خلال 1.5 - 3 ساعات",
                "Within 1.5 - 3 hours",
                1,
            ),
            (
                "محافظة مسقط",
                "Muscat Governorate",
                "بوشر، السيب، المعبيلة، الخوض، القرم، مطرح، العامرات، مسقط",
                "Bawshar, Seeb, Al Maabilah, Al Khoudh, Qurum, Muttrah, Amerat",
                2.000,
                30.000,
                "توصيل مبرد يومي (نفس اليوم أو اليوم التالي)",
                "Daily Chilled Delivery (Same or Next Day)",
                1,
            ),
            (
                "جنوب الباطنة ومحافظة البريمي",
                "South Al Batinah & Al Buraimi",
                "بركاء، المصنعة، الرستاق، نخل، البريمي",
                "Barka, Al Musannah, Rustaq, Nakhal, Al Buraimi",
                2.000,
                25.000,
                "خلال 2 - 4 ساعات",
                "Within 2 - 4 hours",
                1,
            ),
            (
                "الداخلية والظاهرة والشرقية",
                "Al Dakhiliyah, Ad Dhahirah & Ash Sharqiyah",
                "نزوى، بهلاء، إزكي، عبري، صور، إبراء",
                "Nizwa, Bahla, Izki, Ibri, Sur, Ibra",
                2.500,
                35.000,
                "حسب جدول التوصيل المبرد (24 ساعة)",
                "Scheduled Chilled Delivery (24 hours)",
                1,
            ),
        ]
        for z in zones:
            conn.execute(
                """
                INSERT INTO delivery_zones (
                    governorate_ar, governorate_en, wilayats_ar, wilayats_en,
                    delivery_fee_omr, free_threshold_omr, estimated_time_ar, estimated_time_en, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                z,
            )

        # 5. Categories & Category Translations (6 Curated Categories matching the exact Menu)
        categories_data = [
            (
                1,
                "royal-baklava",
                "https://images.unsplash.com/photo-1519676867240-f03562e64548?auto=format&fit=crop&w=900&q=85",
                1,
                "البقلاوة والحلويات الملكية بالكيلو",
                "تشكيلة فاخرة من المبرومة، البلورية، البقلاوة، الكنافة والميديا المحضرة بأجود الفستق الحلبي والسمن البلدي.",
                "Royal Baklava & Pistachio Sweets (By Kilo)",
                "Luxury selection of Mabrouma, Ballourieh, Baklava, Kunafa, and Midye crafted with finest Aleppo pistachios.",
            ),
            (
                2,
                "nabkiyah-harissa",
                "https://images.unsplash.com/photo-1579372786545-d24232daf58c?auto=format&fit=crop&w=900&q=85",
                2,
                "الهريسة الشامية والنبكية",
                "هريسة نبكية أصلية بالسمن الفاخر مع الفستق الحلبي أو اللوز أو الشوكولا الغنية.",
                "Authentic Nabkiyah & Syrian Harissa",
                "Traditional golden semolina Nabkiyah Harissa topped with Aleppo pistachios, almonds, or rich chocolate.",
            ),
            (
                3,
                "oriental-pastries",
                "https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=900&q=85",
                3,
                "حلويات شرقية وقطايف وشعيبيات",
                "قطايف عصافيري ومقلية بالقشطة أو الجوز، شعيبيات مورقة، فيصلية بالفستق الحلبي، ومشبك مقرمش.",
                "Oriental Pastries, Qatayef & Shuaibiyat",
                "Fresh Qatayef with cream or walnuts, flaky Shuaibiyat, Aleppo pistachio Faisaliyah, and crispy Mushabbak.",
            ),
            (
                4,
                "al-qashati",
                "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=900&q=85",
                4,
                "ركن القشاطي وحلاوة الجبن",
                "حلاوة جبن حموية طرية، مدلوقة ومعجوقة بالقشطة البلدية الطازجة، وعلب قشطة فاخرة.",
                "Al-Qashati & Fresh Qishta Desserts",
                "Tender Halawet El Jibn, Madlouqa, and Maajouqa layered with fresh country Qishta and nuts.",
            ),
            (
                5,
                "syrian-savory",
                "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=900&q=85",
                5,
                "ركن المأكولات السورية واليالنجي",
                "ورق عنب يالنجي بزيت الزيتون ودبس الرمان، كبة شامية مقرمشة للقلي، ومحاشي ومأكولات سورية على الطلب.",
                "Syrian Savory Delicacies & Yalanji",
                "Authentic Syrian Yalanji stuffed vine leaves, crispy Kibbeh for frying, and custom Syrian home delicacies.",
            ),
            (
                6,
                "royal-gifts",
                "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=900&q=85",
                6,
                "بوكسات الهدايا والضيافة الملكية",
                "علب إهداء فاخرة بتصميم «تاج الملك - حلا الملوك» مع بطاقة إهداء ملكية مخصصة للمناسبات والزيارات.",
                "Royal Gift & Hospitality Boxes",
                "Signature 'Taj Al Malik' luxury gift boxes with custom royal greeting cards for visits and celebrations.",
            ),
        ]

        for cid, code, img, order, name_ar, desc_ar, name_en, desc_en in categories_data:
            conn.execute(
                "INSERT INTO categories (id, code, image_url, display_order, is_active, is_featured) VALUES (?, ?, ?, ?, 1, 1)",
                (cid, code, img, order),
            )
            conn.execute(
                "INSERT INTO category_translations (category_id, language, name, description, slug) VALUES (?, 'ar', ?, ?, ?)",
                (cid, name_ar, desc_ar, code),
            )
            conn.execute(
                "INSERT INTO category_translations (category_id, language, name, description, slug) VALUES (?, 'en', ?, ?, ?)",
                (cid, name_en, desc_en, code),
            )

        # 6. Complete Real Menu of Taj Al Malik (All items from user's exact menu!)
        # Format:
        # (sku, cat_id, base_price, compare_price, unit_type, weight_ar, weight_en, featured, bestseller, special_offer,
        #  name_ar, short_ar, desc_ar, name_en, short_en, desc_en, image_url, gallery_urls, option_preset)
        products_menu = [
            # ==================== CATEGORY 1: البقلاوة والحلويات الملكية بالكيلو ====================
            (
                "TM-BK-001",
                1,
                16.000,
                None,
                "KG",
                "1 كيلو",
                "1 Kg",
                1,
                1,
                0,
                "مبرومة فستق ملكية",
                "أفخم أنواع المبرومة المحشوة بالكامل بالفستق الحلبي الأخضر الأول وخيوط الكنافة المحمصة.",
                "تُعد مبرومة الفستق في تاج الملك تاج الحلويات الشرقية؛ تُلف يدوياً بخيوط الكنافة الذهبية الرقيقة حول حشوة غنية جداً من الفستق الحلبي الأخضر الفاخر، وتُسقى بالشيرة الموزونة والسمن البلدي الصافي.",
                "Royal Pistachio Mabrouma",
                "Our signature rolled kataifi pastry generously packed with grade-A green Aleppo pistachios.",
                "Hand-rolled golden kataifi threads enveloping a dense, vibrant core of whole first-harvest Aleppo pistachios, baked with pure ghee and lightly sweetened.",
                "/assets/products/mabrouma-pistachio.svg",
                [
                    "https://images.unsplash.com/photo-1519676867240-f03562e64548?auto=format&fit=crop&w=1000&q=85",
                    "https://images.unsplash.com/photo-1579372786545-d24232daf58c?auto=format&fit=crop&w=1000&q=85",
                ],
                "KILO_STANDARD",
            ),
            (
                "TM-BK-002",
                1,
                15.000,
                None,
                "KG",
                "1 كيلو",
                "1 Kg",
                1,
                1,
                0,
                "بلورية فستق حلبي",
                "طبقتان من خيوط الكنافة البيضاء الهشة تتوسطهما طبقة كثيفة من الفستق الحلبي.",
                "بلورية فستق تاج الملك تمتاز بلونها الأبيض البلوري الناصع وقوامها الهش الذي يذوب في الفم مع حشوة الفستق الحلبي الكامل وماء الزهر الفاخر.",
                "Pistachio Ballourieh",
                "Delicate white kataifi pastry layers filled with a thick heart of whole Aleppo pistachios.",
                "Named after its crystalline white crown, our Ballourieh pairs un-toasted silky kataifi pastry with a generous layer of emerald Aleppo pistachios and blossom syrup.",
                "/assets/products/ballourieh-pistachio.svg",
                [
                    "https://images.unsplash.com/photo-1579372786545-d24232daf58c?auto=format&fit=crop&w=1000&q=85",
                    "https://images.unsplash.com/photo-1519676867240-f03562e64548?auto=format&fit=crop&w=1000&q=85",
                ],
                "KILO_STANDARD",
            ),
            (
                "TM-BK-003",
                1,
                15.000,
                None,
                "KG",
                "1 كيلو",
                "1 Kg",
                1,
                0,
                0,
                "بصمة «عثملية» بالفستق",
                "كنافة بصمة عثملية ذهبية محمصة ومكبوسة بالسمن الفاخر والفستق الحلبي.",
                "حلوى البصمة (العثملية) الشهيرة بطبقتي الكنافة المحمصة بلون ذهبي ملكي، محشوة بالفستق الحلبي المختار بعناية لمذاق غني ومقرمش.",
                "Basma 'Othmaniye' Pistachio",
                "Golden pressed kataifi pastry layered with roasted Aleppo pistachios and pure ghee.",
                "A royal Ottoman-Levantine classic featuring pressed, golden-roasted kataifi threads sandwiching a rich layer of premium pistachios.",
                "/assets/products/basma-othmaniye.svg",
                [
                    "https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=1000&q=85",
                    "https://images.unsplash.com/photo-1519676867240-f03562e64548?auto=format&fit=crop&w=1000&q=85",
                ],
                "KILO_STANDARD",
            ),
            (
                "TM-BK-004",
                1,
                15.000,
                None,
                "KG",
                "1 كيلو",
                "1 Kg",
                1,
                1,
                0,
                "بقلاوة بالفستق الحلبي",
                "رقائق عجين البقلاوة المورقة يدوياً والمحشوة بأجود حبات الفستق الحلبي.",
                "أكثر من 40 طبقة رقيقة كالحرير من عجين البقلاوة الفاخر، مخبوزة بالسمن البلدي ومحشوة بالفستق الحلبي الأخضر لتمنحك قرمشة ملكية لا تُقاوم.",
                "Royal Aleppo Pistachio Baklava",
                "40+ paper-thin phyllo layers baked to golden perfection with rich Aleppo pistachio filling.",
                "Our classic diamond-cut royal baklava is crafted with ultra-thin hand-stretched phyllo, clarified butter, and crushed green pistachios.",
                "/assets/products/baklava-pistachio.svg",
                [
                    "https://images.unsplash.com/photo-1519676867240-f03562e64548?auto=format&fit=crop&w=1000&q=85",
                ],
                "KILO_STANDARD",
            ),
            (
                "TM-BK-005",
                1,
                15.000,
                None,
                "KG",
                "1 كيلو",
                "1 Kg",
                0,
                1,
                0,
                "بقلاوة أصابع بالفستق",
                "أصابع البقلاوة المقرمشة الملفوفة بحشوة الفستق الحلبي الغنية.",
                "أصابع بقلاوة ذهبية أنيقة سهلة التقديم في المجالس والضيافة العُمانية، محشوة بالفستق الحلبي ومخبوزة بعناية فائقة.",
                "Crispy Pistachio Baklava Fingers",
                "Elegant rolled phyllo fingers filled with lightly spiced crushed pistachios.",
                "Delicate, bite-sized golden phyllo rolls generously filled with premium pistachios—ideal for Omani majlis hospitality and coffee pairings.",
                "/assets/products/baklava-fingers.svg",
                [
                    "https://images.unsplash.com/photo-1579372786545-d24232daf58c?auto=format&fit=crop&w=1000&q=85",
                ],
                "KILO_STANDARD",
            ),
            (
                "TM-BK-006",
                1,
                10.000,
                None,
                "KG",
                "1 كيلو",
                "1 Kg",
                1,
                1,
                0,
                "عش البلبل بالفستق",
                "أعشاش ذهبية مقرمشة تتوسطها حبات الفستق الحلبي الكاملة المحمصة.",
                "عش البلبل الملكي بتشكيله الدائري الفاخر وقلبه المليء بحبات الفستق الحلبي الكاملة، خيار مثالي للضيافة وصواني المناسبات.",
                "Bird's Nest Pistachio (Bülbül Yuvası)",
                "Golden nest-shaped pastries crowned with whole roasted Aleppo pistachios.",
                "Artisanal nest-shaped pastries baked to a delicate crunch and filled in the center with whole emerald Aleppo pistachios.",
                "/assets/products/bulbul-nest.svg",
                [
                    "https://images.unsplash.com/photo-1519676867240-f03562e64548?auto=format&fit=crop&w=1000&q=85",
                ],
                "KILO_STANDARD",
            ),
            (
                "TM-BK-007",
                1,
                12.000,
                None,
                "KG",
                "1 كيلو",
                "1 Kg",
                1,
                1,
                0,
                "كنافة مكسرات ملكية",
                "كنافة شرقية غنية بتوليفة فاخرة من الفستق الحلبي والكاجو واللوز المحمص.",
                "صينية كنافة المكسرات الملكية المحضرة على الأصول الشامية مع طبقة غنية من المكسرات المنتقاة والسمن الفاخر.",
                "Royal Mixed Nuts Kunafa",
                "Golden shredded kunafa generously crowned with roasted pistachios, cashews, and almonds.",
                "Traditional Levantine kunafa baked with pure ghee and topped with a lavish mosaic of roasted pistachios, cashews, and whole almonds.",
                "/assets/products/kunafa-nuts.svg",
                [
                    "https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=1000&q=85",
                ],
                "KILO_STANDARD",
            ),
            (
                "TM-BK-008",
                1,
                12.000,
                None,
                "KG",
                "1 كيلو",
                "1 Kg",
                1,
                0,
                0,
                "ميديا فستق حلبي",
                "بقلاوة الميديا الفاخرة على شكل الصدفة بحشوة الفستق الحلبي والقشطة.",
                "ميديا فستق بتصميمها الفريد على شكل الصدفة البحرية، مورقة ومقرمشة من الخارج وغنية بالفستق الحلبي الأخضر من الداخل.",
                "Pistachio Midye Baklava",
                "Shell-shaped luxury baklava stuffed with emerald pistachio and a hint of cream.",
                "Crafted in the iconic mussel-shell silhouette, each piece reveals delicate phyllo ridges filled with rich Aleppo pistachio.",
                "/assets/products/midye-pistachio.svg",
                [
                    "https://images.unsplash.com/photo-1519676867240-f03562e64548?auto=format&fit=crop&w=1000&q=85",
                ],
                "KILO_STANDARD",
            ),
            (
                "TM-BK-009",
                1,
                8.000,
                None,
                "KG",
                "1 كيلو",
                "1 Kg",
                0,
                0,
                0,
                "ميديا جوز فاخرة",
                "بقلاوة الميديا المورقة بحشوة الجوز البلدي المحمص والقرفة الخفيفة.",
                "عشاق الجوز سيجدون في ميديا الجوز من تاج الملك التوازن المثالي بين قرمشة الرقائق الذهبية ونكهة الجوز الغنية.",
                "Walnut Midye Baklava",
                "Flaky shell-shaped baklava filled with roasted walnuts and aromatic syrup.",
                "Golden shell-shaped phyllo pastries filled with finely crushed premium walnuts baked in clarified butter.",
                "/assets/products/midye-walnut.svg",
                [
                    "https://images.unsplash.com/photo-1579372786545-d24232daf58c?auto=format&fit=crop&w=1000&q=85",
                ],
                "KILO_STANDARD",
            ),
            (
                "TM-BK-010",
                1,
                6.000,
                None,
                "KG",
                "1 كيلو",
                "1 Kg",
                0,
                1,
                1,
                "ميديا قشطة طازجة",
                "رقائق الميديا الذهبية المقرمشة المحشوة بالقشطة البلدية الغنية.",
                "تجمع ميديا القشطة بين هشاشة عجينة البقلاوة المورقة وطراوة القشطة الطازجة المحضرة يومياً في تاج الملك.",
                "Fresh Cream (Qishta) Midye",
                "Crispy golden Midye phyllo shells filled with velvety fresh country cream.",
                "A crowd favorite combining crispy multi-layered phyllo shells with a luscious center of fresh daily Qishta.",
                "/assets/products/midye-qishta.svg",
                [
                    "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=1000&q=85",
                ],
                "KILO_STANDARD",
            ),

            # ==================== CATEGORY 2: الهريسة الشامية والنبكية ====================
            (
                "TM-HR-011",
                2,
                8.000,
                None,
                "KG",
                "1 كيلو",
                "1 Kg",
                1,
                1,
                0,
                "هريسة نبكية بالفستق الحلبي",
                "الهريسة النبكية الأصلية بالسمن البلدي والقطر الموزون مع طبقة كثيفة من الفستق الحلبي.",
                "هريسة نبكية محضرة على الطريقة الشامية العريقة بحبيبات السميد الخشن المكرمل بالسمن البلدي ومغطاة بسخاء بالفستق الحلبي.",
                "Authentic Nabkiyah Pistachio Harissa",
                "Traditional Syrian Nabkiyah semolina cake baked with pure ghee and crowned with Aleppo pistachios.",
                "Prepared according to the time-honored recipe of Al-Nabk, rich with golden semolina, pure ghee, and a generous crust of whole pistachios.",
                "/assets/products/harissa-pistachio.svg",
                [
                    "https://images.unsplash.com/photo-1579372786545-d24232daf58c?auto=format&fit=crop&w=1000&q=85",
                ],
                "KILO_STANDARD",
            ),
            (
                "TM-HR-012",
                2,
                6.000,
                None,
                "KG",
                "1 كيلو",
                "1 Kg",
                0,
                0,
                1,
                "هريسة شوكولا فاخرة",
                "مزيج مبتكر يجمع طراوة الهريسة الشامية وغنى الشوكولا الفاخرة.",
                "لعشاق الشوكولا، نقدم هريسة الشوكولا بقوامها الطري المتشرب ومذاق الكاكاو والشوكولا الغنية المناسبة للجمعات والقهوة.",
                "Rich Chocolate Harissa",
                "A modern twist uniting tender golden semolina harissa with velvety chocolate.",
                "Soft, syrup-kissed semolina cake infused and topped with rich Belgian-style chocolate.",
                "/assets/products/harissa-chocolate.svg",
                [
                    "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=1000&q=85",
                ],
                "KILO_STANDARD",
            ),
            (
                "TM-HR-013",
                2,
                5.000,
                None,
                "KG",
                "1 كيلو",
                "1 Kg",
                0,
                1,
                0,
                "هريسة لوز ذهبية (1 كيلو)",
                "هريسة شامية تقليدية مزينة بأنصاف اللوز المحمص الذهبي.",
                "هريسة اللوز الكلاسيكية بمذاقها الدافئ الأصيل وقوامها المرمل بالسمن البلدي وحبات اللوز المقرمشة.",
                "Golden Almond Harissa (1 Kg)",
                "Classic semolina harissa studded with golden roasted almonds.",
                "Traditional golden semolina harissa baked to perfection and topped with whole roasted almonds.",
                "/assets/products/harissa-almond.svg",
                [
                    "https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=1000&q=85",
                ],
                "KILO_STANDARD",
            ),

            # ==================== CATEGORY 3: حلويات شرقية وقطايف وشعيبيات ====================
            (
                "TM-OR-014",
                3,
                1.800,
                None,
                "BOX",
                "5 قطع",
                "5 Pieces",
                1,
                1,
                0,
                "قطايف قشطة طازجة (5 قطع)",
                "5 قطع من القطايف المحضرة يومياً والمحشوة بالقشطة البلدية الغنية والفستق.",
                "قطايف تاج الملك بحشوة القشطة البلدية الطازجة، تقدم مع القطر الفاخر ورشة من زهر الليمون والفستق الحلبي (الطلب يشمل 5 قطع بـ 1.800 ر.ع).",
                "Qatayef with Fresh Cream (5 Pcs)",
                "5 pieces of freshly made Qatayef stuffed with rich country Qishta and pistachio.",
                "Five soft golden Qatayef pancakes generously filled with our house-made clotted Qishta and garnished with crushed pistachios.",
                "/assets/products/qatayef-qishta.svg",
                [
                    "https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=1000&q=85",
                ],
                "PASTRY_PACK",
            ),
            (
                "TM-OR-015",
                3,
                2.000,
                None,
                "BOX",
                "5 قطع",
                "5 Pieces",
                0,
                1,
                0,
                "قطايف جوز مقرمشة (5 قطع)",
                "5 قطع من القطايف الذهبية المحشوة بالجوز الفاخر والقرفة وماء الزهر.",
                "قطايف محشوة بخلطة الجوز المجروش مع لمسة خفيفة من القرفة وماء الزهر، مقلية ومقرمشة بلون ذهبي شهي (5 قطع بـ 2.000 ر.ع).",
                "Qatayef with Walnuts (5 Pcs)",
                "5 golden crispy Qatayef pastries stuffed with spiced crushed walnuts.",
                "Five crispy golden Qatayef parcels filled with roasted walnuts, a hint of cinnamon, and orange blossom syrup.",
                "/assets/products/qatayef-walnut.svg",
                [
                    "https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=1000&q=85",
                ],
                "PASTRY_PACK",
            ),
            (
                "TM-OR-016",
                3,
                2.000,
                None,
                "BOX",
                "5 قطع",
                "5 Pieces",
                0,
                0,
                0,
                "مشبك شامي مقرمش (5 قطع)",
                "5 قطع من المشبك الذهبي المقرمش المتشرب بالقطر الموزون.",
                "أقراص المشبك الشامي الذهبية المقرمشة من الخارج والطرية من الداخل، محضرة طازجة ومزينة بالفستق الحلبي (5 قطع بـ 2.000 ر.ع).",
                "Crispy Golden Mushabbak (5 Pcs)",
                "5 pieces of traditional latticed golden Mushabbak soaked in fragrant syrup.",
                "Five crispy, golden-fried spiral Mushabbak pastries glazed in rose-scented sugar syrup.",
                "/assets/products/mushabbak.svg",
                [
                    "https://images.unsplash.com/photo-1579372786545-d24232daf58c?auto=format&fit=crop&w=1000&q=85",
                ],
                "PASTRY_PACK",
            ),
            (
                "TM-OR-017",
                3,
                0.600,
                None,
                "PIECE",
                "للقطعة (600 بيسة)",
                "Per Piece (0.600 OMR)",
                1,
                1,
                0,
                "شعيبيات قشطة بلدية",
                "عجينة الشعيبيات المورقة بالسمن والمحشوة بالقشطة البلدية الغنية.",
                "شعيبيات شامية أصلية بطبقات عجين رقيقة ومقرمشة جداً، محشوة بقلب غني من القشطة البلدية الطازجة (سعر القطعة 600 بيسة).",
                "Shuaibiyat with Fresh Cream (Qishta)",
                "Ultra-flaky multi-layered pastry triangle filled with warm country cream.",
                "Traditional flaky triangular pastry baked with clarified butter and stuffed with rich clotted Qishta.",
                "/assets/products/shuaibiyat-qishta.svg",
                [
                    "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=1000&q=85",
                ],
                "SINGLE_PIECE",
            ),
            (
                "TM-OR-018",
                3,
                0.600,
                None,
                "PIECE",
                "للقطعة (600 بيسة)",
                "Per Piece (0.600 OMR)",
                0,
                0,
                0,
                "شعيبيات جوز محمص",
                "شعيبيات مورقة ومقرمشة بحشوة الجوز البلدي والقطر الفاخر.",
                "تتميز شعيبيات الجوز بقرمشة طبقاتها الذهبية وحشوة الجوز الغنية المتبلة بماء الزهر (سعر القطعة 600 بيسة).",
                "Shuaibiyat with Roasted Walnuts",
                "Flaky golden pastry triangles filled with sweetened crushed walnuts.",
                "Crisp, multi-layered Levantine pastry filled with roasted walnuts and blossom syrup.",
                "/assets/products/shuaibiyat-walnut.svg",
                [
                    "https://images.unsplash.com/photo-1579372786545-d24232daf58c?auto=format&fit=crop&w=1000&q=85",
                ],
                "SINGLE_PIECE",
            ),
            (
                "TM-OR-019",
                3,
                0.600,
                None,
                "PIECE",
                "للقطعة (600 بيسة)",
                "Per Piece (0.600 OMR)",
                1,
                1,
                0,
                "فيصلية فستق حلبي",
                "مثلثات الكنافة الذهبية المحشوة بسخاء بالفستق الحلبي الأخضر.",
                "حلوى الفيصلية الملكية المثلثة المصنوعة من خيوط الكنافة الرقيقة والمحشوة بقلب أخضر من الفستق الحلبي الفاخر (سعر القطعة 600 بيسة).",
                "Aleppo Pistachio Faisaliyah",
                "Triangular golden kataifi pastry stuffed with premium green Aleppo pistachios.",
                "Delicate triangular kataifi pastry folded around a generous filling of whole and crushed Aleppo pistachios.",
                "/assets/products/faisaliyah-pistachio.svg",
                [
                    "https://images.unsplash.com/photo-1519676867240-f03562e64548?auto=format&fit=crop&w=1000&q=85",
                ],
                "SINGLE_PIECE",
            ),

            # ==================== CATEGORY 4: ركن القشاطي وحلاوة الجبن ====================
            (
                "TM-QS-020",
                4,
                2.000,
                None,
                "PLATE",
                "صحن صغير",
                "Small Plate",
                1,
                1,
                0,
                "حلاوة جبن بالقشطة (صحن صغير)",
                "لفائف حلاوة الجبن الحموية الطرية المحشوة بالقشطة البلدية الطازجة والفستق.",
                "حلاوة جبن تاج الملك تُحضر يومياً بعجينة الجبن والسميد الناعمة وتُحشى بالقشطة البلدية الطازجة وتُزين بالفستق الحلبي وزهر الليمون (صحن صغير 2.000 ر.ع).",
                "Halawet El Jibn with Qishta (Small Plate)",
                "Tender sweet cheese rolls stuffed with fresh country Qishta and topped with pistachios.",
                "Silky Levantine sweet cheese dough rolled around fresh clotted Qishta, garnished with crushed Aleppo pistachios and rose petal jam.",
                "/assets/products/halawet-jibn-small.svg",
                [
                    "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=1000&q=85",
                ],
                "QASHATI_PLATE",
            ),
            (
                "TM-QS-021",
                4,
                4.000,
                None,
                "PLATE",
                "صحن كبير عائلي",
                "Large Family Plate",
                1,
                1,
                0,
                "حلاوة جبن بالقشطة (صحن كبير)",
                "الصحن العائلي الكبير من حلاوة الجبن الملكية المحشوة بالقشطة البلدية الطازجة.",
                "صحن كبير غني بلفائف حلاوة الجبن الطازجة المحشوة بالقشطة البلدية والمزينة بالفستق الحلبي الأخضر، مثالي للجمعات العائلية والضيافة (4.000 ر.ع).",
                "Halawet El Jibn with Qishta (Large Plate)",
                "Large family platter of fresh sweet cheese rolls filled with country Qishta.",
                "Generous family-sized platter of our signature Halawet El Jibn rolls stuffed with fresh daily Qishta and Aleppo pistachios.",
                "/assets/products/halawet-jibn-large.svg",
                [
                    "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=1000&q=85",
                ],
                "QASHATI_PLATE",
            ),
            (
                "TM-QS-022",
                4,
                1.000,
                None,
                "BOX",
                "علبة صغيرة",
                "Small Box",
                0,
                0,
                0,
                "علبة قشطة بلدية طازجة (صغير)",
                "قشطة بلدية طبيعية غنية وكثيفة محضرة يومياً على الطريقة الشامية.",
                "علبة قشطة بلدية طازجة غنية الدسم، رائعة للتقديم مع العسل أو المكسرات أو الحلويات الشرقية (العلبة الصغيرة 1.000 ر.ع).",
                "Fresh Country Qishta (Small Box)",
                "Rich, house-made Levantine clotted cream prepared fresh daily.",
                "Thick, artisanal country Qishta made fresh every morning—perfect with honey, nuts, or oriental pastries.",
                "/assets/products/qishta-small.svg",
                [
                    "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=1000&q=85",
                ],
                "QASHATI_PLATE",
            ),
            (
                "TM-QS-023",
                4,
                2.000,
                None,
                "BOX",
                "علبة كبيرة",
                "Large Box",
                0,
                1,
                0,
                "علبة قشطة بلدية طازجة (كبيرة)",
                "العبوة العائلية الكبيرة من القشطة البلدية الطازجة المحضرة يومياً.",
                "علبة قشطة كبيرة لعشاق القشطة البلدية الأصلية مع الفطور أو الحلويات والعسل (العلبة الكبيرة 2.000 ر.ع).",
                "Fresh Country Qishta (Large Box)",
                "Large family tub of our signature fresh daily clotted country Qishta.",
                "Family-sized box of thick, creamy Levantine clotted Qishta prepared fresh daily in Sohar.",
                "/assets/products/qishta-large.svg",
                [
                    "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=1000&q=85",
                ],
                "QASHATI_PLATE",
            ),
            (
                "TM-QS-024",
                4,
                3.000,
                None,
                "PLATE",
                "صحن",
                "Plate",
                1,
                1,
                0,
                "مدلوقة قشطة ملكية (صحن)",
                "طبقة من عجينة الكنافة المفروكة بالسمن والفستق تعلوها طبقة سميكة من القشطة البلدية.",
                "مدلوقة تاج الملك الشهيرة: كنافة ناعمة مفروكة بالسمن البلدي والقطر مع الفستق الحلبي، مغطاة بطبقة غنية من القشطة الطازجة والمكسرات (الصحن 3.000 ر.ع).",
                "Royal Madlouqa with Fresh Qishta (Plate)",
                "Warm buttered kunafa dough kneaded with pistachios and crowned with thick fresh Qishta.",
                "A decadent Levantine specialty of finely ground kunafa kneaded with ghee and blossom syrup, topped with a thick blanket of fresh Qishta and roasted nuts.",
                "/assets/products/madlouqa-qishta.svg",
                [
                    "https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=1000&q=85",
                ],
                "QASHATI_PLATE",
            ),
            (
                "TM-QS-025",
                4,
                3.000,
                None,
                "PLATE",
                "صحن",
                "Plate",
                1,
                0,
                0,
                "معجوقة قشطة ومكسرات (صحن)",
                "عجينة السميد والجبن الذائبة المحشوة بالقشطة البلدية والمغطاة بالمكسرات المحمصة.",
                "معجوقة القشطة الملكية تجمع بين طراوة السميد والجبن وغنى القشطة البلدية مع الكاجو واللوز والفستق الحلبي على الوجه (الصحن 3.000 ر.ع).",
                "Royal Maajouqa with Fresh Qishta (Plate)",
                "Melted cheese and semolina base layered with fresh country Qishta and roasted nuts.",
                "Rich semolina and sweet cheese base topped with velvety country Qishta, roasted cashews, almonds, and Aleppo pistachios.",
                "/assets/products/maajouqa-qishta.svg",
                [
                    "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=1000&q=85",
                ],
                "QASHATI_PLATE",
            ),

            # ==================== CATEGORY 5: لمحبي المأكولات السورية ====================
            (
                "TM-SY-026",
                5,
                1.000,
                None,
                "PLATE",
                "8 حبات",
                "8 Pieces",
                1,
                1,
                0,
                "ورق عنب «يالنجي» شامي (8 حبات)",
                "ورق عنب يالنجي على الأصول السورية مطبوخ بزيت الزيتون البكر ودبس الرمان.",
                "لمحبي المأكولات السورية الأصيلة: 8 حبات من ورق العنب (اليالنجي) المحشو بالأرز والخضار المتبلة بزيت الزيتون ودبس الرمان والليمون (8 حبات بـ 1.000 ر.ع).",
                "Syrian 'Yalanji' Stuffed Vine Leaves (8 Pcs)",
                "8 pieces of authentic Syrian Yalanji vine leaves cooked in extra-virgin olive oil and pomegranate molasses.",
                "Tender vine leaves hand-rolled with seasoned rice, herbs, olive oil, and tangy pomegranate molasses (8 pieces per order).",
                "/assets/products/yalanji-vine-leaves.svg",
                [
                    "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=1000&q=85",
                ],
                "SAVORY_PACK",
            ),
            (
                "TM-SY-027",
                5,
                1.000,
                None,
                "BOX",
                "3 حبات",
                "3 Pieces",
                0,
                1,
                0,
                "كبة شامية للقلي (3 حبات)",
                "3 حبات من الكبة الشامية المقرمشة المحشوة باللحم المتبل والمكسرات.",
                "كبة شامية أصلية بقشرة برغل رقيقة ومقرمشة وحشوة غنية على الطريقة السورية، جاهزة للقلي أو مقلية حسب رغبتكم (3 حبات بـ 1.000 ر.ع).",
                "Syrian Kibbeh for Frying (3 Pcs)",
                "3 pieces of authentic Syrian torpedo Kibbeh stuffed with spiced meat.",
                "Hand-shaped Syrian bulgur shells filled with savory spiced minced meat and onions (3 pieces).",
                "/assets/products/kibbeh-3pcs.svg",
                [
                    "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=1000&q=85",
                ],
                "SAVORY_PACK",
            ),
            (
                "TM-SY-028",
                5,
                2.000,
                2.300,
                "BOX",
                "7 حبات (عرض التوفير)",
                "7 Pieces (Value Pack)",
                1,
                1,
                1,
                "كبة شامية للقلي (7 حبات)",
                "عبوة التوفير: 7 حبات من الكبة الشامية الفاخرة بـ 2.000 ريال فقط.",
                "عرض خاص لمحبي الكبة الشامية: 7 حبات من الكبة المحضرة بعناية فائقة (جاهزة للقلي أو مقلية طازجة حسب الطلب) بسعر 2.000 ر.ع.",
                "Syrian Kibbeh for Frying (7 Pcs Value Pack)",
                "Value pack of 7 authentic Syrian Kibbeh pieces for only 2.000 OMR.",
                "Special value pack of seven hand-crafted Syrian Kibbeh pieces—available ready-to-fry or freshly fried upon request.",
                "/assets/products/kibbeh-7pcs.svg",
                [
                    "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=1000&q=85",
                ],
                "SAVORY_PACK",
            ),
            (
                "TM-SY-029",
                5,
                5.000,
                None,
                "CUSTOM",
                "حسب الطلب",
                "Made to Order",
                1,
                0,
                0,
                "محاشي وورق عنب ومأكولات سورية على الطلب",
                "تجهيز خاص للمحاشي الشامية وورق العنب والكبة للولائم والجمعات العائلية.",
                "لدينا محاشي، ورق عنب، كبة، ومأكولات سورية بيتية فاخرة تُحضر طازجة خصيصاً على الطلب. اختر حجم الطلب واكتب تفاصيل الأصناف المطلوبة في الملاحظات وسيتم التنسيق الفوري معك عبر واتساب.",
                "Custom Order: Syrian Mahashi, Vine Leaves & Home Delicacies",
                "Bespoke preparation of Syrian Mahashi, stuffed vine leaves, and traditional dishes made to order.",
                "We prepare authentic Syrian Mahashi (stuffed zucchini & eggplant), vine leaves, and Kibbeh trays made fresh to order for your family gatherings.",
                "/assets/products/syrian-custom-feast.svg",
                [
                    "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=1000&q=85",
                ],
                "CUSTOM_CATERING",
            ),

            # ==================== CATEGORY 6: بوكسات الهدايا والضيافة الملكية ====================
            (
                "TM-GF-030",
                6,
                16.000,
                18.000,
                "BOX",
                "1 كيلو مشكل ملكي",
                "1 Kg Royal Assortment",
                1,
                1,
                1,
                "بوكس تاج الملك المشكل الفاخر (حلا الملوك)",
                "تشكيلة ملكية مختارة من المبرومة والبلورية والبقلاوة بالفستق الحلبي في علبة إهداء فاخرة.",
                "الهدية الأرقى لذوي الذوق الرفيع: يجمع بوكس «تاج الملك - حلا الملوك» نخبة حلوياتنا الملكية (مبرومة فستق، بلورية، بقلاوة أصابع، بصمة عثملية، وعش البلبل) مع بطاقة الإهداء الملكية الرسمية.",
                "Taj Al Malik Royal Assorted Gift Box (Sweets of Kings)",
                "Our signature luxury gift box featuring an assortment of Mabrouma, Ballourieh, and Pistachio Baklava.",
                "Presented in our royal burgundy and gold packaging with the official Taj Al Malik greeting card, featuring our finest pistachio creations.",
                "/assets/products/royal-gift-box.svg",
                [
                    "https://images.unsplash.com/photo-1519676867240-f03562e64548?auto=format&fit=crop&w=1000&q=85",
                ],
                "ROYAL_GIFT_BOX",
            ),
        ]

        for idx, item in enumerate(products_menu, start=1):
            (
                sku,
                cat_id,
                base_price,
                compare_price,
                unit_type,
                weight_ar,
                weight_en,
                featured,
                bestseller,
                special_offer,
                name_ar,
                short_ar,
                desc_ar,
                name_en,
                short_en,
                desc_en,
                primary_img,
                gallery_imgs,
                opt_preset,
            ) = item

            views_seed = 180 + (idx * 23) % 340
            sales_seed = 25 + (idx * 11) % 95

            conn.execute(
                """
                INSERT INTO products (
                    id, sku, category_id, base_price_omr, compare_at_price_omr,
                    unit_type, weight_label_ar, weight_label_en, status, in_stock,
                    stock_quantity, low_stock_threshold, is_featured, is_best_seller,
                    is_special_offer, views_count, sales_count,
                    seo_meta_title_ar, seo_meta_title_en, seo_meta_desc_ar, seo_meta_desc_en
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 1, 85, 10, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    idx,
                    sku,
                    cat_id,
                    base_price,
                    compare_price,
                    unit_type,
                    weight_ar,
                    weight_en,
                    featured,
                    bestseller,
                    special_offer,
                    views_seed,
                    sales_seed,
                    f"{name_ar} | تاج الملك - حلا الملوك (صحار، عُمان)",
                    f"{name_en} | Taj Al Malik Royal Sweets (Sohar, Oman)",
                    short_ar,
                    short_en,
                ),
            )

            slug_base = sku.lower()
            conn.execute(
                """
                INSERT INTO product_translations (product_id, language, name, short_description, description, slug)
                VALUES (?, 'ar', ?, ?, ?, ?), (?, 'en', ?, ?, ?, ?)
                """,
                (
                    idx,
                    name_ar,
                    short_ar,
                    desc_ar,
                    f"{slug_base}-ar",
                    idx,
                    name_en,
                    short_en,
                    desc_en,
                    f"{slug_base}-en",
                ),
            )

            conn.execute(
                """
                INSERT INTO product_images (product_id, image_url, alt_text_ar, alt_text_en, is_primary, display_order)
                VALUES (?, ?, ?, ?, 1, 0)
                """,
                (idx, primary_img, name_ar, name_en),
            )
            for g_i, g_url in enumerate(gallery_imgs, start=1):
                conn.execute(
                    """
                    INSERT INTO product_images (product_id, image_url, alt_text_ar, alt_text_en, is_primary, display_order)
                    VALUES (?, ?, ?, ?, 0, ?)
                    """,
                    (idx, g_url, name_ar, name_en, g_i),
                )

            # Create rich configurable options based on product type
            if opt_preset == "KILO_STANDARD":
                # Weight options (1kg default, 500g half price, 250g quarter price, 2kg double price)
                cur = conn.execute(
                    "INSERT INTO product_options (product_id, name_ar, name_en, option_type, is_required) VALUES (?, 'الوزن المطلوب', 'Select Weight', 'WEIGHT', 1)",
                    (idx,),
                )
                opt_id = cur.lastrowid
                half_delta = round(-base_price * 0.5, 3)
                quarter_delta = round(-base_price * 0.75, 3)
                double_delta = round(base_price * 1.0, 3)
                weight_vals = [
                    ("1 كيلو (الوزن القياسي)", "1 Kg (Standard Box)", 0.000, 1),
                    ("نصف كيلو (500 جرام)", "500g (Half Kilo)", half_delta, 0),
                    ("ربع كيلو (250 جرام)", "250g (Quarter Kilo)", quarter_delta, 0),
                    ("2 كيلو (صينية ضيافة ملكية)", "2 Kg (Royal Hospitality Tray)", double_delta, 0),
                ]
                for l_ar, l_en, delta, is_def in weight_vals:
                    conn.execute(
                        "INSERT INTO product_option_values (option_id, label_ar, label_en, price_delta_omr, is_default) VALUES (?, ?, ?, ?, ?)",
                        (opt_id, l_ar, l_en, delta, is_def),
                    )

                # Packaging Option
                cur2 = conn.execute(
                    "INSERT INTO product_options (product_id, name_ar, name_en, option_type, is_required) VALUES (?, 'نوع التغليف', 'Packaging Style', 'PACKAGING', 1)",
                    (idx,),
                )
                opt2_id = cur2.lastrowid
                pkg_vals = [
                    ("علبة تاج الملك القياسية", "Standard Taj Al Malik Box", 0.000, 1),
                    ("علبة إهداء ملكية فاخرة مع بطاقة إهداء", "Luxury Royal Gift Box + Greeting Card", 1.500, 0),
                    ("صينية تقديم للمناسبات", "Metal Serving Tray for Events", 2.500, 0),
                ]
                for l_ar, l_en, delta, is_def in pkg_vals:
                    conn.execute(
                        "INSERT INTO product_option_values (option_id, label_ar, label_en, price_delta_omr, is_default) VALUES (?, ?, ?, ?, ?)",
                        (opt2_id, l_ar, l_en, delta, is_def),
                    )

            elif opt_preset == "PASTRY_PACK":
                cur = conn.execute(
                    "INSERT INTO product_options (product_id, name_ar, name_en, option_type, is_required) VALUES (?, 'حجم العبوة والقطر', 'Pack Size & Syrup', 'SIZE', 1)",
                    (idx,),
                )
                opt_id = cur.lastrowid
                vals = [
                    ("5 قطع مع قطر خارجي", "5 Pieces (Syrup on the side)", 0.000, 1),
                    ("5 قطع مسقية بالقطر جاهزة", "5 Pieces (Pre-soaked in Syrup)", 0.000, 0),
                    ("10 قطع (عبوة مضاعفة)", "10 Pieces (Double Pack)", base_price, 0),
                ]
                for l_ar, l_en, delta, is_def in vals:
                    conn.execute(
                        "INSERT INTO product_option_values (option_id, label_ar, label_en, price_delta_omr, is_default) VALUES (?, ?, ?, ?, ?)",
                        (opt_id, l_ar, l_en, delta, is_def),
                    )

            elif opt_preset == "SINGLE_PIECE":
                cur = conn.execute(
                    "INSERT INTO product_options (product_id, name_ar, name_en, option_type, is_required) VALUES (?, 'خيارات التقديم', 'Serving Option', 'SIZE', 1)",
                    (idx,),
                )
                opt_id = cur.lastrowid
                vals = [
                    ("قطعة واحدة طازجة (600 بيسة)", "1 Fresh Piece (0.600 OMR)", 0.000, 1),
                    ("بوكس 5 قطع (3.000 ر.ع)", "Box of 5 Pieces (3.000 OMR)", 2.400, 0),
                    ("بوكس ضيافة 10 قطع (5.500 ر.ع - توفير 500 بيسة)", "Hospitality Box of 10 Pcs (5.500 OMR)", 4.900, 0),
                ]
                for l_ar, l_en, delta, is_def in vals:
                    conn.execute(
                        "INSERT INTO product_option_values (option_id, label_ar, label_en, price_delta_omr, is_default) VALUES (?, ?, ?, ?, ?)",
                        (opt_id, l_ar, l_en, delta, is_def),
                    )

            elif opt_preset == "QASHATI_PLATE":
                cur = conn.execute(
                    "INSERT INTO product_options (product_id, name_ar, name_en, option_type, is_required) VALUES (?, 'الإضافات والقطر', 'Add-ons & Syrup', 'PACKAGING', 1)",
                    (idx,),
                )
                opt_id = cur.lastrowid
                vals = [
                    ("مع قطر بماء الزهر على حدة", "With Blossom Syrup on the side", 0.000, 1),
                    ("إضافة فستق حلبي إضافي على الوجه (+500 بيسة)", "Extra Aleppo Pistachio Topping (+0.500 OMR)", 0.500, 0),
                    ("تغليف هدية حافظ للبرودة (+1.000 ر.ع)", "Insulated Gift Packaging (+1.000 OMR)", 1.000, 0),
                ]
                for l_ar, l_en, delta, is_def in vals:
                    conn.execute(
                        "INSERT INTO product_option_values (option_id, label_ar, label_en, price_delta_omr, is_default) VALUES (?, ?, ?, ?, ?)",
                        (opt_id, l_ar, l_en, delta, is_def),
                    )

            elif opt_preset == "SAVORY_PACK":
                cur = conn.execute(
                    "INSERT INTO product_options (product_id, name_ar, name_en, option_type, is_required) VALUES (?, 'طريقة التحضير', 'Preparation Preference', 'SIZE', 1)",
                    (idx,),
                )
                opt_id = cur.lastrowid
                if "كبة" in name_ar:
                    vals = [
                        ("جاهزة للقلي المنزلي (مبردة/مفرزة)", "Ready to Fry at Home (Chilled)", 0.000, 1),
                        ("مقلية ساخنة جاهزة للأكل", "Freshly Fried & Ready to Eat", 0.200, 0),
                    ]
                else:
                    vals = [
                        ("تقديم بارد بزيت الزيتون ودبس الرمان", "Chilled with Extra Olive Oil & Pomegranate", 0.000, 1),
                        ("إضافة صوص دبس الرمان والليمون إضافي (+200 بيسة)", "Extra Pomegranate & Lemon Dip (+0.200 OMR)", 0.200, 0),
                    ]
                for l_ar, l_en, delta, is_def in vals:
                    conn.execute(
                        "INSERT INTO product_option_values (option_id, label_ar, label_en, price_delta_omr, is_default) VALUES (?, ?, ?, ?, ?)",
                        (opt_id, l_ar, l_en, delta, is_def),
                    )

            elif opt_preset == "CUSTOM_CATERING":
                cur = conn.execute(
                    "INSERT INTO product_options (product_id, name_ar, name_en, option_type, is_required) VALUES (?, 'حجم طلب الوليمة / المحاشي', 'Catering Order Size', 'SIZE', 1)",
                    (idx,),
                )
                opt_id = cur.lastrowid
                vals = [
                    ("طلب عائلي صغير (5.000 ر.ع)", "Small Family Order (5.000 OMR)", 0.000, 1),
                    ("طلب عائلي وسط مشكل (10.000 ر.ع)", "Medium Family Assortment (10.000 OMR)", 5.000, 0),
                    ("وليمة مناسبات كبيرة (20.000 ر.ع)", "Large Event Feast Platter (20.000 OMR)", 15.000, 0),
                ]
                for l_ar, l_en, delta, is_def in vals:
                    conn.execute(
                        "INSERT INTO product_option_values (option_id, label_ar, label_en, price_delta_omr, is_default) VALUES (?, ?, ?, ?, ?)",
                        (opt_id, l_ar, l_en, delta, is_def),
                    )

            elif opt_preset == "ROYAL_GIFT_BOX":
                cur = conn.execute(
                    "INSERT INTO product_options (product_id, name_ar, name_en, option_type, is_required) VALUES (?, 'حجم البوكس الملكي', 'Royal Box Size', 'WEIGHT', 1)",
                    (idx,),
                )
                opt_id = cur.lastrowid
                vals = [
                    ("بوكس ملكي 1 كيلو مع بطاقة إهداء (16.000 ر.ع)", "1 Kg Royal Box with Greeting Card", 0.000, 1),
                    ("بوكس ملكي ديلوكس 1.5 كيلو (23.000 ر.ع)", "1.5 Kg Deluxe Royal Box", 7.000, 0),
                    ("صندوق كبار الشخصيات VIP - 2 كيلو (30.000 ر.ع)", "2 Kg VIP Imperial Gift Chest", 14.000, 0),
                ]
                for l_ar, l_en, delta, is_def in vals:
                    conn.execute(
                        "INSERT INTO product_option_values (option_id, label_ar, label_en, price_delta_omr, is_default) VALUES (?, ?, ?, ?, ?)",
                        (opt_id, l_ar, l_en, delta, is_def),
                    )

        # 7. Discount Codes
        discounts = [
            (
                "ROYAL10",
                "خصم ملكي 10% بمناسبة افتتاح المتجر الإلكتروني",
                "10% Royal Launch Discount",
                "PERCENTAGE",
                10.0,
                10.000,
                500,
                14,
                "2026-01-01",
                "2027-12-31",
                1,
            ),
            (
                "SOHAR2",
                "خصم 2.000 ريال عُماني لأهل صحار وشمال الباطنة للطلبات فوق 15 ريال",
                "2.000 OMR Off Orders Over 15 OMR",
                "FIXED",
                2.000,
                15.000,
                200,
                9,
                "2026-01-01",
                "2027-12-31",
                1,
            ),
            (
                "WELCOME5",
                "خصم ترحيبي 5% على جميع الحلويات",
                "5% Welcome Discount on All Sweets",
                "PERCENTAGE",
                5.0,
                5.000,
                1000,
                21,
                "2026-01-01",
                "2027-12-31",
                1,
            ),
        ]
        for d in discounts:
            conn.execute(
                """
                INSERT INTO discount_codes (
                    code, description_ar, description_en, discount_type,
                    discount_value, min_order_omr, max_usage_limit, used_count,
                    start_date, expiry_date, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                d,
            )

        # 8. Testimonials (Omani Customers)
        testimonials_data = [
            (
                "سالم المقبالي",
                "صحار - الطريف",
                "Sohar - Al Tareef",
                "ما شاء الله المبرومة والبلورية عند تاج الملك لا يُعلى عليها، فستق حلبي طازج وسكر موزون جداً، والتغليف يبيض الوجه في الهدايا.",
                "The Pistachio Mabrouma and Ballourieh at Taj Al Malik are unmatched in Sohar. Fresh Aleppo pistachios and royal gift packaging!",
                5,
                1,
            ),
            (
                "أم محمد الكندية",
                "صحار - الهمبار",
                "Sohar - Al Humbar",
                "جربت حلاوة الجبن والمدلوقة بالقشطة مع ورق العنب اليالنجي، الطعم شامي أصيل ونظافة وترتيب فوق الوصف. الطلب عبر الموقع والواتساب سهل وسريع.",
                "We ordered Halawet El Jibn, Madlouqa, and Yalanji vine leaves. Authentic Syrian taste and super smooth WhatsApp ordering!",
                5,
                1,
            ),
            (
                "المهندس طارق البلوشي",
                "مسقط - بوشر",
                "Muscat - Bawshar",
                "طلبت بوكسات تاج الملك الملكية كهدية لمناسبة خاصة مع بطاقة الإهداء، وصلت في الموعد المحدد وبأعلى فخامة.",
                "Ordered the Royal Assorted Gift Boxes with custom greeting cards. Delivered right on time and looked truly luxurious.",
                5,
                1,
            ),
            (
                "فاطمة الشيزاوية",
                "لوى",
                "Liwa",
                "الكبة الشامية والقطايف بالقشطة والفيصلية طعمها خيال! صار متجرنا المفضل لكل جمعات العائلة.",
                "The Syrian Kibbeh, Qatayef with Qishta, and Faisaliyah are incredible! Our go-to sweets boutique for every family gathering.",
                5,
                1,
            ),
        ]
        for t in testimonials_data:
            conn.execute(
                """
                INSERT INTO testimonials (customer_name, city_ar, city_en, comment_ar, comment_en, rating, is_approved)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                t,
            )

        # 9. Sample Customers, Loyalty Accounts & Realistic Orders Across Statuses
        customers_seed = [
            ("سالم بن راشد المقبالي", "+968 99112233", "salim@example.om", "شمال الباطنة - ولاية صحار", "الطريف", 3, 54.800, 548),
            ("شيخة بنت حمد المعمري", "+968 92334455", "shaikha@example.om", "شمال الباطنة - ولاية صحار", "الهمبار", 2, 31.500, 315),
            ("أحمد بن سعيد البلوشي", "+968 95667788", "ahmed.b@example.om", "محافظة مسقط", "بوشر", 2, 42.000, 420),
            ("خالد بن عبدالله الشبلي", "+968 91889900", "khalid@example.om", "شمال الباطنة - بقية الولايات", "صحم", 1, 18.600, 186),
            ("مريم بنت علي الكندية", "+968 94556677", "maryam@example.om", "شمال الباطنة - ولاية صحار", "الوقيبة", 1, 14.000, 140),
        ]
        for c_idx, (c_name, c_phone, c_email, gov, wil, t_orders, t_spent, pts) in enumerate(customers_seed, start=1):
            conn.execute(
                """
                INSERT INTO customers (id, full_name, phone, email, governorate, wilayat, total_orders, total_spent_omr)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (c_idx, c_name, c_phone, c_email, gov, wil, t_orders, t_spent),
            )
            tier = "IMPERIAL_CROWN" if pts >= 400 else ("ROYAL_GOLD" if pts >= 200 else "ROYAL_SILVER")
            conn.execute(
                """
                INSERT INTO loyalty_accounts (id, customer_id, points_balance, lifetime_points, tier)
                VALUES (?, ?, ?, ?, ?)
                """,
                (c_idx, c_idx, pts, pts, tier),
            )
            conn.execute(
                """
                INSERT INTO loyalty_transactions (loyalty_account_id, order_number, points_delta, reason_ar, reason_en)
                VALUES (?, ?, ?, 'نقاط مكتسبة من طلبات مكتملة في تاج الملك', 'Points earned from completed Taj Al Malik orders')
                """,
                (c_idx, f"TM-100{c_idx}", pts),
            )

        now = datetime.now()
        sample_orders = [
            (
                "TM-1001",
                1,
                "سالم بن راشد المقبالي",
                "+968 99112233",
                "salim@example.om",
                "DELIVERY",
                "شمال الباطنة - ولاية صحار",
                "الطريف",
                "بجانب جامع السلطان قابوس بصحار، فيلا 14",
                "COMPLETED",
                31.000,
                "ROYAL10",
                3.100,
                0.000,
                27.900,
                (now - timedelta(days=5)).strftime("%Y-%m-%d %H:%M:%S"),
                [
                    (1, "مبرومة فستق ملكية", "Royal Pistachio Mabrouma", 1, 16.000, 16.000, "1 كيلو"),
                    (4, "بقلاوة بالفستق الحلبي", "Royal Aleppo Pistachio Baklava", 1, 15.000, 15.000, "1 كيلو"),
                ],
            ),
            (
                "TM-1002",
                2,
                "شيخة بنت حمد المعمري",
                "+968 92334455",
                "shaikha@example.om",
                "PICKUP",
                "شمال الباطنة - ولاية صحار",
                "صحار",
                "استلام من فرع صحار الرئيسي",
                "COMPLETED",
                19.000,
                None,
                0.000,
                0.000,
                19.000,
                (now - timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S"),
                [
                    (21, "حلاوة جبن بالقشطة (صحن كبير)", "Halawet El Jibn with Qishta (Large Plate)", 1, 4.000, 4.000, "صحن كبير"),
                    (24, "مدلوقة قشطة ملكية (صحن)", "Royal Madlouqa with Fresh Qishta (Plate)", 1, 3.000, 3.000, "صحن"),
                    (7, "كنافة مكسرات ملكية", "Royal Mixed Nuts Kunafa", 1, 12.000, 12.000, "1 كيلو"),
                ],
            ),
            (
                "TM-1003",
                3,
                "أحمد بن سعيد البلوشي",
                "+968 95667788",
                "ahmed.b@example.om",
                "DELIVERY",
                "محافظة مسقط",
                "بوشر - المنى",
                "شارع الأنوار، سكة 22",
                "COMPLETED",
                32.000,
                "SOHAR2",
                2.000,
                0.000,
                30.000,
                (now - timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S"),
                [
                    (30, "بوكس تاج الملك المشكل الفاخر (حلا الملوك)", "Taj Al Malik Royal Assorted Gift Box", 2, 16.000, 32.000, "هدية مع بطاقة"),
                ],
            ),
            (
                "TM-1004",
                4,
                "خالد بن عبدالله الشبلي",
                "+968 91889900",
                "khalid@example.om",
                "DELIVERY",
                "شمال الباطنة - بقية الولايات",
                "صحم",
                "حي السوق، بالقرب من الكورنيش",
                "PREPARING",
                13.800,
                None,
                0.000,
                1.500,
                15.300,
                (now - timedelta(hours=5)).strftime("%Y-%m-%d %H:%M:%S"),
                [
                    (11, "هريسة نبكية بالفستق الحلبي", "Authentic Nabkiyah Pistachio Harissa", 1, 8.000, 8.000, "1 كيلو"),
                    (14, "قطايف قشطة طازجة (5 قطع)", "Qatayef with Fresh Cream (5 Pcs)", 1, 1.800, 1.800, "5 قطع"),
                    (26, "ورق عنب «يالنجي» شامي (8 حبات)", "Syrian 'Yalanji' Stuffed Vine Leaves (8 Pcs)", 2, 1.000, 2.000, "16 حبة"),
                    (28, "كبة شامية للقلي (7 حبات)", "Syrian Kibbeh for Frying (7 Pcs Value Pack)", 1, 2.000, 2.000, "مقلية جاهزة"),
                ],
            ),
            (
                "TM-1005",
                5,
                "مريم بنت علي الكندية",
                "+968 94556677",
                "maryam@example.om",
                "DELIVERY",
                "شمال الباطنة - ولاية صحار",
                "الوقيبة",
                "الدوار الخامس، منزل رقم 88",
                "NEW",
                20.800,
                None,
                0.000,
                0.000,
                20.800,
                (now - timedelta(minutes=35)).strftime("%Y-%m-%d %H:%M:%S"),
                [
                    (2, "بلورية فستق حلبي", "Pistachio Ballourieh", 1, 15.000, 15.000, "1 كيلو"),
                    (25, "معجوقة قشطة ومكسرات (صحن)", "Royal Maajouqa with Fresh Qishta (Plate)", 1, 3.000, 3.000, "صحن"),
                    (23, "علبة قشطة بلدية طازجة (كبيرة)", "Fresh Country Qishta (Large Box)", 1, 2.000, 2.000, "علبة كبيرة"),
                    (19, "فيصلية فستق حلبي", "Aleppo Pistachio Faisaliyah", 1, 0.600, 0.800, "قطعة"),
                ],
            ),
        ]

        for (
            o_num,
            c_id,
            c_name,
            c_phone,
            c_email,
            f_type,
            gov,
            wil,
            addr,
            status,
            sub,
            d_code,
            d_amt,
            deliv,
            tot,
            created_str,
            items_list,
        ) in sample_orders:
            wa_msg = (
                f"مرحباً تاج الملك (حلا الملوك) 👑\n"
                f"أود تأكيد الطلب رقم: #{o_num}\n"
                f"العميل: {c_name} ({c_phone})\n"
                f"الإجمالي: {tot:.3f} ر.ع (OMR)"
            )
            cur = conn.execute(
                """
                INSERT INTO orders (
                    order_number, customer_id, customer_name, customer_phone, customer_email,
                    fulfillment_type, governorate, wilayat, address_details,
                    subtotal_omr, discount_code, discount_amount_omr, delivery_fee_omr,
                    total_amount_omr, status, whatsapp_message_text, loyalty_points_earned, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    o_num,
                    c_id,
                    c_name,
                    c_phone,
                    c_email,
                    f_type,
                    gov,
                    wil,
                    addr,
                    sub,
                    d_code,
                    d_amt,
                    deliv,
                    tot,
                    status,
                    wa_msg,
                    int(tot * 10) if status == "COMPLETED" else 0,
                    created_str,
                ),
            )
            oid = cur.lastrowid
            for p_id, p_ar, p_en, qty, u_price, t_price, note in items_list:
                conn.execute(
                    """
                    INSERT INTO order_items (
                        order_id, product_id, product_name_ar, product_name_en,
                        quantity, unit_price_omr, total_price_omr, special_notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (oid, p_id, p_ar, p_en, qty, u_price, t_price, note),
                )

        # 10. Admin Notifications
        conn.execute(
            """
            INSERT INTO admin_notifications (notif_type, title_ar, title_en, message_ar, message_en, is_read)
            VALUES
            ('NEW_ORDER', 'طلب واتساب جديد #TM-1005', 'New WhatsApp Order #TM-1005', 'وصل طلب جديد من مريم الكندية بقيمة 20.800 ر.ع (صحار - الوقيبة)', 'New order from Maryam Al Kindy for 20.800 OMR (Sohar)', 0),
            ('PREPARING_ORDER', 'طلب قيد التجهيز #TM-1004', 'Order Preparing #TM-1004', 'طلب خالد الشبلي (صحم) بقيمة 15.300 ر.ع قيد التجهيز حالياً', 'Order #TM-1004 for Khalid Al Shibli is currently in preparation', 0)
            """
        )
