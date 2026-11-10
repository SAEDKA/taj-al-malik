import os
import sqlite3
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "taj_al_malik.db")


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_schema():
    with get_db() as conn:
        conn.executescript(
            """
            -- 1. RBAC: Roles, Permissions, RolePermissions, Users
            CREATE TABLE IF NOT EXISTS roles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                description TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS role_permissions (
                role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
                permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
                PRIMARY KEY (role_id, permission_id)
            );

            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role_id INTEGER NOT NULL REFERENCES roles(id),
                is_active INTEGER DEFAULT 1,
                last_login_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            -- 2. Customers & Loyalty
            CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                phone TEXT UNIQUE NOT NULL,
                email TEXT,
                governorate TEXT,
                wilayat TEXT,
                saved_addresses TEXT,
                total_orders INTEGER DEFAULT 0,
                total_spent_omr REAL DEFAULT 0.000,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS loyalty_accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER UNIQUE NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                points_balance INTEGER DEFAULT 0,
                lifetime_points INTEGER DEFAULT 0,
                tier TEXT DEFAULT 'ROYAL_GOLD',
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS loyalty_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                loyalty_account_id INTEGER NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
                order_number TEXT,
                points_delta INTEGER NOT NULL,
                reason_ar TEXT NOT NULL,
                reason_en TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            -- 3. Multilingual Categories
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                image_url TEXT,
                display_order INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                is_featured INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS category_translations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
                language TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                slug TEXT NOT NULL,
                UNIQUE(category_id, language)
            );

            -- 4. Multilingual Products, Images & Options
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sku TEXT UNIQUE NOT NULL,
                category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
                base_price_omr REAL NOT NULL,
                compare_at_price_omr REAL,
                unit_type TEXT DEFAULT 'KG',
                weight_label_ar TEXT,
                weight_label_en TEXT,
                status TEXT DEFAULT 'ACTIVE',
                in_stock INTEGER DEFAULT 1,
                stock_quantity INTEGER DEFAULT 100,
                low_stock_threshold INTEGER DEFAULT 10,
                is_featured INTEGER DEFAULT 0,
                is_best_seller INTEGER DEFAULT 0,
                is_special_offer INTEGER DEFAULT 0,
                views_count INTEGER DEFAULT 0,
                sales_count INTEGER DEFAULT 0,
                seo_meta_title_ar TEXT,
                seo_meta_title_en TEXT,
                seo_meta_desc_ar TEXT,
                seo_meta_desc_en TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS product_translations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                language TEXT NOT NULL,
                name TEXT NOT NULL,
                short_description TEXT,
                description TEXT,
                slug TEXT NOT NULL,
                UNIQUE(product_id, language)
            );

            CREATE TABLE IF NOT EXISTS product_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                image_url TEXT NOT NULL,
                alt_text_ar TEXT,
                alt_text_en TEXT,
                is_primary INTEGER DEFAULT 0,
                display_order INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS product_options (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                name_ar TEXT NOT NULL,
                name_en TEXT NOT NULL,
                option_type TEXT DEFAULT 'SINGLE',
                is_required INTEGER DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS product_option_values (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                option_id INTEGER NOT NULL REFERENCES product_options(id) ON DELETE CASCADE,
                label_ar TEXT NOT NULL,
                label_en TEXT NOT NULL,
                price_delta_omr REAL DEFAULT 0.000,
                is_default INTEGER DEFAULT 0
            );

            -- 5. Oman Delivery Zones
            CREATE TABLE IF NOT EXISTS delivery_zones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                governorate_ar TEXT NOT NULL,
                governorate_en TEXT NOT NULL,
                wilayats_ar TEXT NOT NULL,
                wilayats_en TEXT NOT NULL,
                delivery_fee_omr REAL NOT NULL,
                free_threshold_omr REAL DEFAULT 20.000,
                estimated_time_ar TEXT NOT NULL,
                estimated_time_en TEXT NOT NULL,
                is_active INTEGER DEFAULT 1
            );

            -- 6. Orders & Order Items
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_number TEXT UNIQUE NOT NULL,
                customer_id INTEGER REFERENCES customers(id),
                customer_name TEXT NOT NULL,
                customer_phone TEXT NOT NULL,
                customer_email TEXT,
                fulfillment_type TEXT DEFAULT 'DELIVERY',
                governorate TEXT,
                wilayat TEXT,
                address_details TEXT,
                google_maps_link TEXT,
                pickup_branch TEXT DEFAULT 'فرع صحار الرئيسي - Sohar Main Branch',
                scheduled_date TEXT,
                scheduled_slot TEXT,
                is_gift INTEGER DEFAULT 0,
                gift_recipient_name TEXT,
                gift_recipient_phone TEXT,
                gift_card_message TEXT,
                customer_notes TEXT,
                subtotal_omr REAL NOT NULL,
                discount_code TEXT,
                discount_amount_omr REAL DEFAULT 0.000,
                delivery_fee_omr REAL DEFAULT 0.000,
                total_amount_omr REAL NOT NULL,
                status TEXT DEFAULT 'NEW',
                payment_status TEXT DEFAULT 'PENDING_WHATSAPP',
                payment_method TEXT DEFAULT 'WHATSAPP_COORDINATION',
                whatsapp_message_text TEXT NOT NULL,
                loyalty_points_earned INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
                product_name_ar TEXT NOT NULL,
                product_name_en TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                unit_price_omr REAL NOT NULL,
                total_price_omr REAL NOT NULL,
                special_notes TEXT
            );

            CREATE TABLE IF NOT EXISTS order_item_options (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
                option_name_ar TEXT NOT NULL,
                option_name_en TEXT NOT NULL,
                value_label_ar TEXT NOT NULL,
                value_label_en TEXT NOT NULL,
                price_delta_omr REAL DEFAULT 0.000
            );

            -- 7. Discount Codes
            CREATE TABLE IF NOT EXISTS discount_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                description_ar TEXT,
                description_en TEXT,
                discount_type TEXT NOT NULL,
                discount_value REAL NOT NULL,
                min_order_omr REAL DEFAULT 0.000,
                max_usage_limit INTEGER DEFAULT 100,
                used_count INTEGER DEFAULT 0,
                start_date TEXT NOT NULL,
                expiry_date TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            -- 8. Store & Brand Settings, Homepage CMS, Testimonials, Newsletter, Analytics
            CREATE TABLE IF NOT EXISTS brand_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                store_name_ar TEXT NOT NULL,
                store_name_en TEXT NOT NULL,
                tagline_ar TEXT NOT NULL,
                tagline_en TEXT NOT NULL,
                primary_color TEXT NOT NULL,
                secondary_color TEXT NOT NULL,
                accent_color TEXT NOT NULL,
                surface_color TEXT NOT NULL,
                theme_preset TEXT DEFAULT 'ROYAL_BURGUNDY_GOLD',
                logo_url TEXT NOT NULL,
                whatsapp_number TEXT NOT NULL,
                phone_display TEXT NOT NULL,
                instagram_handle TEXT NOT NULL,
                instagram_url TEXT NOT NULL,
                location_ar TEXT NOT NULL,
                location_en TEXT NOT NULL,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS store_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                currency_code TEXT DEFAULT 'OMR',
                currency_decimals INTEGER DEFAULT 3,
                free_delivery_threshold REAL DEFAULT 20.000,
                enable_loyalty INTEGER DEFAULT 1,
                loyalty_points_per_omr INTEGER DEFAULT 10,
                loyalty_reward_threshold INTEGER DEFAULT 200,
                enable_newsletter INTEGER DEFAULT 1,
                enable_testimonials INTEGER DEFAULT 1,
                best_sellers_mode TEXT DEFAULT 'AUTOMATIC'
            );

            CREATE TABLE IF NOT EXISTS homepage_sections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                section_key TEXT UNIQUE NOT NULL,
                title_ar TEXT NOT NULL,
                title_en TEXT NOT NULL,
                subtitle_ar TEXT,
                subtitle_en TEXT,
                content_ar TEXT,
                content_en TEXT,
                button_ar TEXT,
                button_en TEXT,
                secondary_button_ar TEXT,
                secondary_button_en TEXT,
                image_url TEXT,
                is_active INTEGER DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS testimonials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_name TEXT NOT NULL,
                city_ar TEXT NOT NULL,
                city_en TEXT NOT NULL,
                comment_ar TEXT NOT NULL,
                comment_en TEXT NOT NULL,
                rating INTEGER DEFAULT 5,
                is_approved INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS newsletter_subscribers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                language TEXT DEFAULT 'ar',
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS analytics_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                product_id INTEGER,
                metadata TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS admin_notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                notif_type TEXT NOT NULL,
                title_ar TEXT NOT NULL,
                title_en TEXT NOT NULL,
                message_ar TEXT NOT NULL,
                message_en TEXT NOT NULL,
                is_read INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
