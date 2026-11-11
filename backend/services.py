import csv
import io
import json
import urllib.parse
from datetime import datetime
from backend.database import get_db
from backend.seed import hash_password, verify_password


def format_omr(amount: float) -> str:
    return f"{float(amount or 0.0):.3f}"


def get_storefront_payload():
    with get_db() as conn:
        brand = dict(conn.execute("SELECT * FROM brand_settings WHERE id = 1").fetchone())
        settings = dict(conn.execute("SELECT * FROM store_settings WHERE id = 1").fetchone())

        sections_rows = conn.execute("SELECT * FROM homepage_sections WHERE is_active = 1").fetchall()
        sections = {r["section_key"]: dict(r) for r in sections_rows}

        cat_rows = conn.execute(
            "SELECT * FROM categories WHERE is_active = 1 ORDER BY display_order ASC, id ASC"
        ).fetchall()
        categories = []
        for c in cat_rows:
            cd = dict(c)
            trans = conn.execute(
                "SELECT language, name, description, slug FROM category_translations WHERE category_id = ?",
                (c["id"],),
            ).fetchall()
            cd["translations"] = {t["language"]: dict(t) for t in trans}
            categories.append(cd)

        prod_rows = conn.execute(
            "SELECT * FROM products WHERE status != 'HIDDEN' ORDER BY is_featured DESC, id ASC"
        ).fetchall()
        products = []
        for p in prod_rows:
            products.append(_hydrate_product(conn, p))

        zones = [
            dict(z)
            for z in conn.execute("SELECT * FROM delivery_zones WHERE is_active = 1 ORDER BY id ASC").fetchall()
        ]
        testimonials = [
            dict(t)
            for t in conn.execute(
                "SELECT * FROM testimonials WHERE is_approved = 1 ORDER BY id DESC"
            ).fetchall()
        ]

        return {
            "brand": brand,
            "settings": settings,
            "sections": sections,
            "categories": categories,
            "products": products,
            "delivery_zones": zones,
            "testimonials": testimonials,
        }


def _hydrate_product(conn, prod_row):
    pd = dict(prod_row)
    pid = pd["id"]
    trans = conn.execute(
        "SELECT language, name, short_description, description, slug FROM product_translations WHERE product_id = ?",
        (pid,),
    ).fetchall()
    pd["translations"] = {t["language"]: dict(t) for t in trans}

    imgs = conn.execute(
        "SELECT id, image_url, alt_text_ar, alt_text_en, is_primary, display_order FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, display_order ASC",
        (pid,),
    ).fetchall()
    pd["images"] = [dict(i) for i in imgs]
    pd["primary_image"] = pd["images"][0]["image_url"] if pd["images"] else "/assets/products/royal-gift-box.svg"

    opts = conn.execute(
        "SELECT id, name_ar, name_en, option_type, is_required FROM product_options WHERE product_id = ? ORDER BY id ASC",
        (pid,),
    ).fetchall()
    hydrated_opts = []
    for o in opts:
        od = dict(o)
        vals = conn.execute(
            "SELECT id, label_ar, label_en, price_delta_omr, is_default FROM product_option_values WHERE option_id = ? ORDER BY id ASC",
            (o["id"],),
        ).fetchall()
        od["values"] = [dict(v) for v in vals]
        hydrated_opts.append(od)
    pd["options"] = hydrated_opts
    return pd


def track_analytics_event(event_type: str, product_id=None, metadata=None):
    with get_db() as conn:
        if event_type == "PRODUCT_VIEW" and product_id:
            conn.execute(
                "UPDATE products SET views_count = views_count + 1 WHERE id = ?",
                (int(product_id),),
            )
        conn.execute(
            "INSERT INTO analytics_events (event_type, product_id, metadata) VALUES (?, ?, ?)",
            (event_type, product_id, json.dumps(metadata or {}, ensure_ascii=False)),
        )
    return {"ok": True}


def create_whatsapp_order(payload: dict):
    customer_name = (payload.get("customer_name") or "").strip()
    customer_phone = (payload.get("customer_phone") or "").strip()
    customer_email = (payload.get("customer_email") or "").strip()
    fulfillment_type = (payload.get("fulfillment_type") or "DELIVERY").upper()
    zone_id = payload.get("zone_id")
    governorate = (payload.get("governorate") or "").strip()
    wilayat = (payload.get("wilayat") or "").strip()
    address_details = (payload.get("address_details") or "").strip()
    google_maps_link = (payload.get("google_maps_link") or "").strip()
    scheduled_date = (payload.get("scheduled_date") or "اليوم / Today").strip()
    scheduled_slot = (payload.get("scheduled_slot") or "في أقرب وقت / ASAP").strip()
    is_gift = 1 if payload.get("is_gift") else 0
    gift_recipient_name = (payload.get("gift_recipient_name") or "").strip()
    gift_recipient_phone = (payload.get("gift_recipient_phone") or "").strip()
    gift_card_message = (payload.get("gift_card_message") or "").strip()
    customer_notes = (payload.get("customer_notes") or "").strip()
    lang = payload.get("language") or "ar"
    cart_items = payload.get("items") or []

    if not customer_name or not customer_phone:
        raise ValueError("يرجى إدخال الاسم الكامل ورقم الهاتف / Full name and phone number are required")
    if not cart_items:
        raise ValueError("السلة فارغة / Shopping cart is empty")

    with get_db() as conn:
        brand = dict(conn.execute("SELECT * FROM brand_settings WHERE id = 1").fetchone())
        settings = dict(conn.execute("SELECT * FROM store_settings WHERE id = 1").fetchone())

        subtotal_omr = 0.0
        validated_items = []

        for item in cart_items:
            pid = int(item.get("product_id"))
            qty = max(1, int(item.get("quantity", 1)))
            prod = conn.execute("SELECT * FROM products WHERE id = ?", (pid,)).fetchone()
            if not prod or not prod["in_stock"] or prod["status"] == "OUT_OF_STOCK":
                raise ValueError(f"أحد المنتجات غير متوفر حالياً / Product #{pid} is out of stock")

            trans_ar = conn.execute(
                "SELECT name FROM product_translations WHERE product_id = ? AND language = 'ar'", (pid,)
            ).fetchone()
            trans_en = conn.execute(
                "SELECT name FROM product_translations WHERE product_id = ? AND language = 'en'", (pid,)
            ).fetchone()
            name_ar = trans_ar["name"] if trans_ar else prod["sku"]
            name_en = trans_en["name"] if trans_en else prod["sku"]

            unit_price = float(prod["base_price_omr"])
            selected_options = []
            for opt_sel in item.get("selected_options", []):
                val_id = opt_sel.get("value_id")
                if val_id:
                    v_row = conn.execute(
                        """
                        SELECT v.*, o.name_ar as opt_ar, o.name_en as opt_en
                        FROM product_option_values v
                        JOIN product_options o ON o.id = v.option_id
                        WHERE v.id = ? AND o.product_id = ?
                        """,
                        (int(val_id), pid),
                    ).fetchone()
                    if v_row:
                        delta = float(v_row["price_delta_omr"] or 0.0)
                        unit_price = round(max(0.100, unit_price + delta), 3)
                        selected_options.append(
                            {
                                "option_name_ar": v_row["opt_ar"],
                                "option_name_en": v_row["opt_en"],
                                "value_label_ar": v_row["label_ar"],
                                "value_label_en": v_row["label_en"],
                                "price_delta_omr": delta,
                            }
                        )

            line_total = round(unit_price * qty, 3)
            subtotal_omr = round(subtotal_omr + line_total, 3)
            validated_items.append(
                {
                    "product_id": pid,
                    "product_name_ar": name_ar,
                    "product_name_en": name_en,
                    "quantity": qty,
                    "unit_price_omr": unit_price,
                    "total_price_omr": line_total,
                    "special_notes": (item.get("special_notes") or "").strip(),
                    "options": selected_options,
                }
            )

        # Delivery Fee calculation
        delivery_fee_omr = 0.0
        free_threshold = float(settings.get("free_delivery_threshold") or 20.000)
        if fulfillment_type == "DELIVERY":
            if zone_id:
                z_row = conn.execute("SELECT * FROM delivery_zones WHERE id = ?", (int(zone_id),)).fetchone()
                if z_row:
                    governorate = z_row["governorate_ar"] if lang == "ar" else z_row["governorate_en"]
                    free_threshold = float(z_row["free_threshold_omr"] or free_threshold)
                    if subtotal_omr < free_threshold:
                        delivery_fee_omr = float(z_row["delivery_fee_omr"])
            else:
                if subtotal_omr < free_threshold:
                    delivery_fee_omr = 1.000

        total_amount_omr = round(max(0.0, subtotal_omr + delivery_fee_omr), 3)

        # Upsert Customer
        cust = conn.execute("SELECT * FROM customers WHERE phone = ?", (customer_phone,)).fetchone()
        if cust:
            customer_id = cust["id"]
            conn.execute(
                """
                UPDATE customers
                SET full_name = ?, email = COALESCE(NULLIF(?, ''), email),
                    governorate = COALESCE(NULLIF(?, ''), governorate),
                    wilayat = COALESCE(NULLIF(?, ''), wilayat),
                    total_orders = total_orders + 1,
                    total_spent_omr = ROUND(total_spent_omr + ?, 3),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (customer_name, customer_email, governorate, wilayat, total_amount_omr, customer_id),
            )
        else:
            cur_c = conn.execute(
                """
                INSERT INTO customers (full_name, phone, email, governorate, wilayat, total_orders, total_spent_omr)
                VALUES (?, ?, ?, ?, ?, 1, ?)
                """,
                (customer_name, customer_phone, customer_email, governorate, wilayat, total_amount_omr),
            )
            customer_id = cur_c.lastrowid

        # Generate Unique Order Number
        last_id_row = conn.execute("SELECT COALESCE(MAX(id), 0) as max_id FROM orders").fetchone()
        next_num = 1001 + int(last_id_row["max_id"])
        order_number = f"TM-{next_num}"

        # Format Professional WhatsApp Message
        wa_message = _build_whatsapp_message(
            lang=lang,
            order_number=order_number,
            items=validated_items,
            subtotal_omr=subtotal_omr,
            delivery_fee_omr=delivery_fee_omr,
            total_amount_omr=total_amount_omr,
            fulfillment_type=fulfillment_type,
            governorate=governorate,
            wilayat=wilayat,
            address_details=address_details,
            google_maps_link=google_maps_link,
            scheduled_date=scheduled_date,
            scheduled_slot=scheduled_slot,
            is_gift=bool(is_gift),
            gift_recipient_name=gift_recipient_name,
            gift_recipient_phone=gift_recipient_phone,
            gift_card_message=gift_card_message,
            customer_name=customer_name,
            customer_phone=customer_phone,
            customer_notes=customer_notes,
        )

        cur_o = conn.execute(
            """
            INSERT INTO orders (
                order_number, customer_id, customer_name, customer_phone, customer_email,
                fulfillment_type, governorate, wilayat, address_details, google_maps_link,
                scheduled_date, scheduled_slot, is_gift, gift_recipient_name, gift_recipient_phone,
                gift_card_message, customer_notes, subtotal_omr, discount_code, discount_amount_omr,
                delivery_fee_omr, total_amount_omr, status, whatsapp_message_text, loyalty_points_earned
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0.000, ?, ?, 'NEW', ?, 0)
            """,
            (
                order_number,
                customer_id,
                customer_name,
                customer_phone,
                customer_email,
                fulfillment_type,
                governorate,
                wilayat,
                address_details,
                google_maps_link,
                scheduled_date,
                scheduled_slot,
                is_gift,
                gift_recipient_name,
                gift_recipient_phone,
                gift_card_message,
                customer_notes,
                subtotal_omr,
                delivery_fee_omr,
                total_amount_omr,
                wa_message,
            ),
        )
        order_id = cur_o.lastrowid

        for vi in validated_items:
            cur_oi = conn.execute(
                """
                INSERT INTO order_items (
                    order_id, product_id, product_name_ar, product_name_en,
                    quantity, unit_price_omr, total_price_omr, special_notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    order_id,
                    vi["product_id"],
                    vi["product_name_ar"],
                    vi["product_name_en"],
                    vi["quantity"],
                    vi["unit_price_omr"],
                    vi["total_price_omr"],
                    vi["special_notes"],
                ),
            )
            oi_id = cur_oi.lastrowid
            for opt in vi["options"]:
                conn.execute(
                    """
                    INSERT INTO order_item_options (
                        order_item_id, option_name_ar, option_name_en,
                        value_label_ar, value_label_en, price_delta_omr
                    ) VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        oi_id,
                        opt["option_name_ar"],
                        opt["option_name_en"],
                        opt["value_label_ar"],
                        opt["value_label_en"],
                        opt["price_delta_omr"],
                    ),
                )
            conn.execute(
                "UPDATE products SET sales_count = sales_count + ? WHERE id = ?",
                (vi["quantity"], vi["product_id"]),
            )

        # Create Admin Notification
        conn.execute(
            """
            INSERT INTO admin_notifications (notif_type, title_ar, title_en, message_ar, message_en)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                "NEW_ORDER",
                f"طلب واتساب جديد #{order_number}",
                f"New WhatsApp Order #{order_number}",
                f"طلب جديد من {customer_name} ({customer_phone}) بقيمة {format_omr(total_amount_omr)} ر.ع",
                f"New order from {customer_name} ({customer_phone}) for {format_omr(total_amount_omr)} OMR",
            ),
        )

        wa_phone = "".join(ch for ch in brand["whatsapp_number"] if ch.isdigit())
        wa_url = f"https://wa.me/{wa_phone}?text={urllib.parse.quote(wa_message)}"

        return {
            "order_id": order_id,
            "order_number": order_number,
            "status": "NEW",
            "subtotal_omr": format_omr(subtotal_omr),
            "delivery_fee_omr": format_omr(delivery_fee_omr),
            "total_amount_omr": format_omr(total_amount_omr),
            "whatsapp_message": wa_message,
            "whatsapp_url": wa_url,
        }


def _build_whatsapp_message(
    lang: str,
    order_number: str,
    items: list,
    subtotal_omr: float,
    delivery_fee_omr: float,
    total_amount_omr: float,
    fulfillment_type: str,
    governorate: str,
    wilayat: str,
    address_details: str,
    google_maps_link: str,
    scheduled_date: str,
    scheduled_slot: str,
    is_gift: bool,
    gift_recipient_name: str,
    gift_recipient_phone: str,
    gift_card_message: str,
    customer_name: str,
    customer_phone: str,
    customer_notes: str,
) -> str:
    if lang == "en":
        lines = [
            "👑 *TAJ AL MALIK — SWEETS OF KINGS*",
            "Hello, I would like to place the following order:",
            f"*Order Number:* #{order_number}",
            "━━━━━━━━━━━━━━━━━━━━",
            "*Products:*",
        ]
        for it in items:
            lines.append(f"• *{it['product_name_en']}* × {it['quantity']} — {format_omr(it['total_price_omr'])} OMR")
            for op in it["options"]:
                lines.append(f"   ◦ {op['option_name_en']}: {op['value_label_en']}")
            if it["special_notes"]:
                lines.append(f"   ◦ Note: {it['special_notes']}")
        lines.append("━━━━━━━━━━━━━━━━━━━━")
        lines.append(f"*Subtotal:* {format_omr(subtotal_omr)} OMR")
        if fulfillment_type == "DELIVERY":
            lines.append(
                f"*Delivery Fee:* {'FREE (0.000 OMR)' if delivery_fee_omr == 0 else format_omr(delivery_fee_omr) + ' OMR'}"
            )
        lines.append(f"*Total:* *{format_omr(total_amount_omr)} OMR*")
        lines.append("━━━━━━━━━━━━━━━━━━━━")
        if fulfillment_type == "PICKUP":
            lines.append("*Fulfillment:* Store Pickup (Sohar Branch)")
        else:
            lines.append(f"*Fulfillment:* Delivery — {governorate} ({wilayat})")
            if address_details:
                lines.append(f"*Address:* {address_details}")
            if google_maps_link:
                lines.append(f"*Map Link:* {google_maps_link}")
        lines.append(f"*Preferred Time:* {scheduled_date} | {scheduled_slot}")
        if is_gift:
            lines.append("🎁 *Royal Gift Order:* Yes")
            if gift_recipient_name:
                lines.append(f"*Recipient:* {gift_recipient_name} ({gift_recipient_phone})")
            if gift_card_message:
                lines.append(f"*Greeting Card:* \"{gift_card_message}\"")
        lines.append("━━━━━━━━━━━━━━━━━━━━")
        lines.append(f"*Customer Name:* {customer_name}")
        lines.append(f"*Customer Phone:* {customer_phone}")
        if customer_notes:
            lines.append(f"*Customer Notes:* {customer_notes}")
        lines.append("Thank you!")
        return "\n".join(lines)

    # Default Arabic professional message
    lines = [
        "👑 *تاج الملك — حلا الملوك*",
        "السلام عليكم، أود إتمام الطلب التالي:",
        f"*رقم الطلب:* #{order_number}",
        "━━━━━━━━━━━━━━━━━━━━",
        "*المنتجات المطلوبة:*",
    ]
    for it in items:
        lines.append(f"• *{it['product_name_ar']}* × {it['quantity']}  ({format_omr(it['total_price_omr'])} ر.ع)")
        for op in it["options"]:
            lines.append(f"   ◦ {op['option_name_ar']}: {op['value_label_ar']}")
        if it["special_notes"]:
            lines.append(f"   ◦ ملاحظة الصنف: {it['special_notes']}")
    lines.append("━━━━━━━━━━━━━━━━━━━━")
    lines.append(f"*المجموع الفرعي:* {format_omr(subtotal_omr)} ر.ع")
    if fulfillment_type == "DELIVERY":
        lines.append(
            f"*رسوم التوصيل:* {'مجاني (0.000 ر.ع)' if delivery_fee_omr == 0 else format_omr(delivery_fee_omr) + ' ر.ع'}"
        )
    lines.append(f"*الإجمالي النهائي:* *{format_omr(total_amount_omr)} ر.ع (OMR)*")
    lines.append("━━━━━━━━━━━━━━━━━━━━")
    if fulfillment_type == "PICKUP":
        lines.append("*طريقة الاستلام:* استلام من فرع تاج الملك (صحار)")
    else:
        lines.append(f"*طريقة الاستلام:* توصيل — {governorate} ({wilayat})")
        if address_details:
            lines.append(f"*العنوان التفصيلي:* {address_details}")
        if google_maps_link:
            lines.append(f"*رابط الموقع:* {google_maps_link}")
    lines.append(f"*الموعد المفضل:* {scheduled_date} | {scheduled_slot}")
    if is_gift:
        lines.append("🎁 *طلب إهداء ملكي:* نعم")
        if gift_recipient_name:
            lines.append(f"*المستلم:* {gift_recipient_name} ({gift_recipient_phone})")
        if gift_card_message:
            lines.append(f"*نص بطاقة الإهداء:* «{gift_card_message}»")
    lines.append("━━━━━━━━━━━━━━━━━━━━")
    lines.append(f"*اسم العميل:* {customer_name}")
    lines.append(f"*رقم الهاتف:* {customer_phone}")
    if customer_notes:
        lines.append(f"*ملاحظات إضافية:* {customer_notes}")
    lines.append("شكراً لكم، بانتظار تأكيدكم 🌹")
    return "\n".join(lines)


# ============================================================================
# ADMIN DASHBOARD SERVICES
# ============================================================================

def authenticate_admin(email: str, password: str):
    with get_db() as conn:
        user = conn.execute(
            """
            SELECT u.*, r.name as role_name, r.description as role_desc
            FROM users u
            JOIN roles r ON r.id = u.role_id
            WHERE LOWER(u.email) = LOWER(?) AND u.is_active = 1
            """,
            ((email or "").strip(),),
        ).fetchone()
        if not user or not verify_password(password or "", user["password_hash"]):
            return None

        conn.execute("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", (user["id"],))
        perms = conn.execute(
            """
            SELECT p.code FROM permissions p
            JOIN role_permissions rp ON rp.permission_id = p.id
            WHERE rp.role_id = ?
            """,
            (user["role_id"],),
        ).fetchall()

        return {
            "id": user["id"],
            "full_name": user["full_name"],
            "email": user["email"],
            "role": user["role_name"],
            "role_description": user["role_desc"],
            "permissions": [p["code"] for p in perms],
        }


def get_admin_dashboard_summary():
    with get_db() as conn:
        total_orders = conn.execute("SELECT COUNT(*) as c FROM orders").fetchone()["c"]
        new_orders = conn.execute("SELECT COUNT(*) as c FROM orders WHERE status = 'NEW'").fetchone()["c"]
        active_orders = conn.execute(
            "SELECT COUNT(*) as c FROM orders WHERE status IN ('CONTACTED', 'CONFIRMED', 'PREPARING', 'READY')"
        ).fetchone()["c"]
        completed_orders = conn.execute(
            "SELECT COUNT(*) as c FROM orders WHERE status = 'COMPLETED'"
        ).fetchone()["c"]
        cancelled_orders = conn.execute(
            "SELECT COUNT(*) as c FROM orders WHERE status = 'CANCELLED'"
        ).fetchone()["c"]

        rev_row = conn.execute(
            "SELECT COALESCE(SUM(total_amount_omr), 0) as rev, COALESCE(AVG(total_amount_omr), 0) as aov FROM orders WHERE status != 'CANCELLED'"
        ).fetchone()
        completed_rev = conn.execute(
            "SELECT COALESCE(SUM(total_amount_omr), 0) as rev FROM orders WHERE status = 'COMPLETED'"
        ).fetchone()["rev"]

        total_customers = conn.execute("SELECT COUNT(*) as c FROM customers").fetchone()["c"]
        returning_customers = conn.execute(
            "SELECT COUNT(*) as c FROM customers WHERE total_orders > 1"
        ).fetchone()["c"]

        best_sellers = [
            dict(r)
            for r in conn.execute(
                """
                SELECT p.id, p.sku, p.base_price_omr, p.sales_count, p.views_count, p.stock_quantity,
                       pt_ar.name as name_ar, pt_en.name as name_en,
                       (SELECT image_url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC LIMIT 1) as image_url
                FROM products p
                LEFT JOIN product_translations pt_ar ON pt_ar.product_id = p.id AND pt_ar.language = 'ar'
                LEFT JOIN product_translations pt_en ON pt_en.product_id = p.id AND pt_en.language = 'en'
                ORDER BY p.sales_count DESC, p.views_count DESC
                LIMIT 6
                """
            ).fetchall()
        ]

        most_viewed = [
            dict(r)
            for r in conn.execute(
                """
                SELECT p.id, p.sku, p.base_price_omr, p.views_count, p.sales_count,
                       pt_ar.name as name_ar, pt_en.name as name_en
                FROM products p
                LEFT JOIN product_translations pt_ar ON pt_ar.product_id = p.id AND pt_ar.language = 'ar'
                LEFT JOIN product_translations pt_en ON pt_en.product_id = p.id AND pt_en.language = 'en'
                ORDER BY p.views_count DESC
                LIMIT 6
                """
            ).fetchall()
        ]

        recent_orders = list_admin_orders(limit=8)

        notifications = [
            dict(n)
            for n in conn.execute(
                "SELECT * FROM admin_notifications ORDER BY id DESC LIMIT 10"
            ).fetchall()
        ]

        # Sales chart series
        by_day = [
            dict(r)
            for r in conn.execute(
                """
                SELECT SUBSTR(created_at, 1, 10) as day,
                       COUNT(*) as orders_count,
                       ROUND(SUM(CASE WHEN status != 'CANCELLED' THEN total_amount_omr ELSE 0 END), 3) as revenue_omr
                FROM orders
                GROUP BY SUBSTR(created_at, 1, 10)
                ORDER BY day ASC
                """
            ).fetchall()
        ]

        return {
            "kpis": {
                "total_orders": total_orders,
                "new_orders": new_orders,
                "active_orders": active_orders,
                "completed_orders": completed_orders,
                "cancelled_orders": cancelled_orders,
                "gross_revenue_omr": round(float(rev_row["rev"]), 3),
                "completed_revenue_omr": round(float(completed_rev), 3),
                "average_order_value_omr": round(float(rev_row["aov"]), 3),
                "total_customers": total_customers,
                "returning_customers": returning_customers,
            },
            "best_sellers": best_sellers,
            "most_viewed": most_viewed,
            "recent_orders": recent_orders,
            "sales_timeline": by_day,
            "notifications": notifications,
        }


def list_admin_orders(status_filter=None, search_query=None, date_from=None, limit=100):
    with get_db() as conn:
        sql = "SELECT * FROM orders WHERE 1=1"
        params = []
        if status_filter and status_filter != "ALL":
            sql += " AND status = ?"
            params.append(status_filter)
        if search_query:
            q = f"%{search_query.strip()}%"
            sql += " AND (order_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR wilayat LIKE ?)"
            params.extend([q, q, q, q])
        if date_from:
            sql += " AND SUBSTR(created_at, 1, 10) >= ?"
            params.append(date_from)
        sql += f" ORDER BY id DESC LIMIT {int(limit)}"

        rows = conn.execute(sql, params).fetchall()
        orders = []
        for r in rows:
            od = dict(r)
            items = conn.execute(
                "SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC", (r["id"],)
            ).fetchall()
            hydrated_items = []
            for it in items:
                itd = dict(it)
                opts = conn.execute(
                    "SELECT * FROM order_item_options WHERE order_item_id = ?", (it["id"],)
                ).fetchall()
                itd["options"] = [dict(o) for o in opts]
                hydrated_items.append(itd)
            od["items"] = hydrated_items
            orders.append(od)
        return orders


def update_order_status(order_id: int, new_status: str):
    valid_statuses = ("NEW", "CONTACTED", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED")
    if new_status not in valid_statuses:
        raise ValueError("Invalid order status")

    with get_db() as conn:
        order = conn.execute("SELECT * FROM orders WHERE id = ?", (int(order_id),)).fetchone()
        if not order:
            raise ValueError("Order not found")

        old_status = order["status"]
        conn.execute(
            "UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (new_status, int(order_id)),
        )

        conn.execute(
            """
            INSERT INTO admin_notifications (notif_type, title_ar, title_en, message_ar, message_en)
            VALUES ('STATUS_CHANGE', ?, ?, ?, ?)
            """,
            (
                f"تحديث حالة الطلب #{order['order_number']}",
                f"Order #{order['order_number']} Status Updated",
                f"تم تغيير حالة الطلب #{order['order_number']} من {old_status} إلى {new_status}",
                f"Order #{order['order_number']} changed from {old_status} to {new_status}",
            ),
        )
    return {"ok": True, "order_id": order_id, "status": new_status}


def save_admin_product(data: dict):
    with get_db() as conn:
        pid = data.get("id")
        sku = (data.get("sku") or f"TM-PR-{int(datetime.now().timestamp())}").strip()
        category_id = int(data.get("category_id") or 1)
        base_price_omr = round(float(data.get("base_price_omr") or 1.000), 3)
        compare_at = float(data["compare_at_price_omr"]) if data.get("compare_at_price_omr") else None
        unit_type = data.get("unit_type") or "KG"
        weight_ar = (data.get("weight_label_ar") or "1 كيلو").strip()
        weight_en = (data.get("weight_label_en") or "1 Kg").strip()
        status = data.get("status") or "ACTIVE"
        in_stock = 1 if data.get("in_stock", True) else 0
        stock_qty = int(data.get("stock_quantity", 100))
        is_featured = 1 if data.get("is_featured") else 0
        is_best_seller = 1 if data.get("is_best_seller") else 0
        is_special_offer = 1 if data.get("is_special_offer") else 0

        name_ar = (data.get("name_ar") or "").strip()
        name_en = (data.get("name_en") or name_ar).strip()
        short_ar = (data.get("short_description_ar") or "").strip()
        short_en = (data.get("short_description_en") or short_ar).strip()
        desc_ar = (data.get("description_ar") or short_ar).strip()
        desc_en = (data.get("description_en") or short_en).strip()
        image_url = (data.get("image_url") or "/assets/products/royal-gift-box.svg").strip()

        if not name_ar:
            raise ValueError("يرجى إدخال اسم المنتج بالعربية / Arabic product name is required")

        if pid:
            pid = int(pid)
            conn.execute(
                """
                UPDATE products
                SET sku = ?, category_id = ?, base_price_omr = ?, compare_at_price_omr = ?,
                    unit_type = ?, weight_label_ar = ?, weight_label_en = ?, status = ?,
                    in_stock = ?, stock_quantity = ?, is_featured = ?, is_best_seller = ?,
                    is_special_offer = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (
                    sku,
                    category_id,
                    base_price_omr,
                    compare_at,
                    unit_type,
                    weight_ar,
                    weight_en,
                    status,
                    in_stock,
                    stock_qty,
                    is_featured,
                    is_best_seller,
                    is_special_offer,
                    pid,
                ),
            )
            conn.execute(
                """
                UPDATE product_translations
                SET name = ?, short_description = ?, description = ?
                WHERE product_id = ? AND language = 'ar'
                """,
                (name_ar, short_ar, desc_ar, pid),
            )
            conn.execute(
                """
                UPDATE product_translations
                SET name = ?, short_description = ?, description = ?
                WHERE product_id = ? AND language = 'en'
                """,
                (name_en, short_en, desc_en, pid),
            )
            if image_url:
                conn.execute(
                    "UPDATE product_images SET image_url = ? WHERE product_id = ? AND is_primary = 1",
                    (image_url, pid),
                )
        else:
            cur = conn.execute(
                """
                INSERT INTO products (
                    sku, category_id, base_price_omr, compare_at_price_omr,
                    unit_type, weight_label_ar, weight_label_en, status,
                    in_stock, stock_quantity, is_featured, is_best_seller, is_special_offer
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    sku,
                    category_id,
                    base_price_omr,
                    compare_at,
                    unit_type,
                    weight_ar,
                    weight_en,
                    status,
                    in_stock,
                    stock_qty,
                    is_featured,
                    is_best_seller,
                    is_special_offer,
                ),
            )
            pid = cur.lastrowid
            slug_base = f"{sku.lower()}-{pid}"
            conn.execute(
                """
                INSERT INTO product_translations (product_id, language, name, short_description, description, slug)
                VALUES (?, 'ar', ?, ?, ?, ?), (?, 'en', ?, ?, ?, ?)
                """,
                (pid, name_ar, short_ar, desc_ar, f"{slug_base}-ar", pid, name_en, short_en, desc_en, f"{slug_base}-en"),
            )
            conn.execute(
                "INSERT INTO product_images (product_id, image_url, alt_text_ar, alt_text_en, is_primary, display_order) VALUES (?, ?, ?, ?, 1, 0)",
                (pid, image_url, name_ar, name_en),
            )
            # Default option
            cur_o = conn.execute(
                "INSERT INTO product_options (product_id, name_ar, name_en, option_type, is_required) VALUES (?, 'الوزن / الحجم', 'Weight / Size', 'WEIGHT', 1)",
                (pid,),
            )
            conn.execute(
                "INSERT INTO product_option_values (option_id, label_ar, label_en, price_delta_omr, is_default) VALUES (?, ?, ?, 0.000, 1)",
                (cur_o.lastrowid, weight_ar, weight_en),
            )

        row = conn.execute("SELECT * FROM products WHERE id = ?", (pid,)).fetchone()
        return _hydrate_product(conn, row)


def duplicate_admin_product(product_id: int):
    with get_db() as conn:
        orig = conn.execute("SELECT * FROM products WHERE id = ?", (int(product_id),)).fetchone()
        if not orig:
            raise ValueError("Product not found")
        hydrated = _hydrate_product(conn, orig)
        new_sku = f"{orig['sku']}-COPY-{int(datetime.now().timestamp()) % 1000}"
        return save_admin_product(
            {
                "sku": new_sku,
                "category_id": orig["category_id"],
                "base_price_omr": orig["base_price_omr"],
                "unit_type": orig["unit_type"],
                "weight_label_ar": orig["weight_label_ar"],
                "weight_label_en": orig["weight_label_en"],
                "name_ar": hydrated["translations"]["ar"]["name"] + " (نسخة)",
                "name_en": hydrated["translations"]["en"]["name"] + " (Copy)",
                "short_description_ar": hydrated["translations"]["ar"]["short_description"],
                "short_description_en": hydrated["translations"]["en"]["short_description"],
                "description_ar": hydrated["translations"]["ar"]["description"],
                "description_en": hydrated["translations"]["en"]["description"],
                "image_url": hydrated["primary_image"],
                "is_featured": orig["is_featured"],
                "is_best_seller": orig["is_best_seller"],
            }
        )


def delete_admin_product(product_id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM products WHERE id = ?", (int(product_id),))
    return {"ok": True}


def save_admin_category(data: dict):
    with get_db() as conn:
        cid = data.get("id")
        code = (data.get("code") or f"cat-{int(datetime.now().timestamp())}").strip().lower()
        image_url = (data.get("image_url") or "/assets/products/royal-gift-box.svg").strip()
        display_order = int(data.get("display_order") or 1)
        is_active = 1 if data.get("is_active", True) else 0
        name_ar = (data.get("name_ar") or "").strip()
        name_en = (data.get("name_en") or name_ar).strip()
        desc_ar = (data.get("description_ar") or "").strip()
        desc_en = (data.get("description_en") or desc_ar).strip()

        if not name_ar:
            raise ValueError("Category Arabic name is required")

        if cid:
            cid = int(cid)
            conn.execute(
                "UPDATE categories SET code = ?, image_url = ?, display_order = ?, is_active = ? WHERE id = ?",
                (code, image_url, display_order, is_active, cid),
            )
            conn.execute(
                "UPDATE category_translations SET name = ?, description = ? WHERE category_id = ? AND language = 'ar'",
                (name_ar, desc_ar, cid),
            )
            conn.execute(
                "UPDATE category_translations SET name = ?, description = ? WHERE category_id = ? AND language = 'en'",
                (name_en, desc_en, cid),
            )
        else:
            cur = conn.execute(
                "INSERT INTO categories (code, image_url, display_order, is_active, is_featured) VALUES (?, ?, ?, ?, 1)",
                (code, image_url, display_order, is_active),
            )
            cid = cur.lastrowid
            conn.execute(
                "INSERT INTO category_translations (category_id, language, name, description, slug) VALUES (?, 'ar', ?, ?, ?), (?, 'en', ?, ?, ?)",
                (cid, name_ar, desc_ar, code, cid, name_en, desc_en, code),
            )
    return {"ok": True, "id": cid}


def save_brand_and_store_settings(data: dict):
    with get_db() as conn:
        if "brand" in data:
            b = data["brand"]
            conn.execute(
                """
                UPDATE brand_settings
                SET store_name_ar = COALESCE(?, store_name_ar),
                    store_name_en = COALESCE(?, store_name_en),
                    tagline_ar = COALESCE(?, tagline_ar),
                    tagline_en = COALESCE(?, tagline_en),
                    primary_color = COALESCE(?, primary_color),
                    secondary_color = COALESCE(?, secondary_color),
                    accent_color = COALESCE(?, accent_color),
                    surface_color = COALESCE(?, surface_color),
                    theme_preset = COALESCE(?, theme_preset),
                    whatsapp_number = COALESCE(?, whatsapp_number),
                    phone_display = COALESCE(?, phone_display),
                    instagram_handle = COALESCE(?, instagram_handle),
                    location_ar = COALESCE(?, location_ar),
                    location_en = COALESCE(?, location_en),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = 1
                """,
                (
                    b.get("store_name_ar"),
                    b.get("store_name_en"),
                    b.get("tagline_ar"),
                    b.get("tagline_en"),
                    b.get("primary_color"),
                    b.get("secondary_color"),
                    b.get("accent_color"),
                    b.get("surface_color"),
                    b.get("theme_preset"),
                    b.get("whatsapp_number"),
                    b.get("phone_display"),
                    b.get("instagram_handle"),
                    b.get("location_ar"),
                    b.get("location_en"),
                ),
            )
        if "settings" in data:
            s = data["settings"]
            conn.execute(
                """
                UPDATE store_settings
                SET free_delivery_threshold = COALESCE(?, free_delivery_threshold),
                    enable_loyalty = COALESCE(?, enable_loyalty),
                    loyalty_points_per_omr = COALESCE(?, loyalty_points_per_omr),
                    loyalty_reward_threshold = COALESCE(?, loyalty_reward_threshold),
                    enable_newsletter = COALESCE(?, enable_newsletter),
                    enable_testimonials = COALESCE(?, enable_testimonials),
                    best_sellers_mode = COALESCE(?, best_sellers_mode)
                WHERE id = 1
                """,
                (
                    s.get("free_delivery_threshold"),
                    s.get("enable_loyalty"),
                    s.get("loyalty_points_per_omr"),
                    s.get("loyalty_reward_threshold"),
                    s.get("enable_newsletter"),
                    s.get("enable_testimonials"),
                    s.get("best_sellers_mode"),
                ),
            )
        if "hero" in data:
            h = data["hero"]
            conn.execute(
                """
                UPDATE homepage_sections
                SET title_ar = COALESCE(?, title_ar),
                    title_en = COALESCE(?, title_en),
                    subtitle_ar = COALESCE(?, subtitle_ar),
                    subtitle_en = COALESCE(?, subtitle_en),
                    button_ar = COALESCE(?, button_ar),
                    button_en = COALESCE(?, button_en)
                WHERE section_key = 'HERO'
                """,
                (
                    h.get("title_ar"),
                    h.get("title_en"),
                    h.get("subtitle_ar"),
                    h.get("subtitle_en"),
                    h.get("button_ar"),
                    h.get("button_en"),
                ),
            )
        if "about" in data:
            a = data["about"]
            conn.execute(
                """
                UPDATE homepage_sections
                SET title_ar = COALESCE(?, title_ar),
                    title_en = COALESCE(?, title_en),
                    content_ar = COALESCE(?, content_ar),
                    content_en = COALESCE(?, content_en)
                WHERE section_key = 'ABOUT'
                """,
                (a.get("title_ar"), a.get("title_en"), a.get("content_ar"), a.get("content_en")),
            )
    return {"ok": True}


# ============================================================================
# BULK CSV EXPORT & IMPORT WITH VALIDATION
# ============================================================================

def export_csv_entity(entity: str) -> str:
    output = io.StringIO()
    output.write("\ufeff")  # UTF-8 BOM for Arabic Excel compatibility
    writer = csv.writer(output)

    with get_db() as conn:
        if entity == "categories":
            writer.writerow(["id", "code", "name_ar", "name_en", "description_ar", "description_en", "display_order", "is_active"])
            rows = conn.execute(
                """
                SELECT c.id, c.code, c.display_order, c.is_active,
                       ct_ar.name as name_ar, ct_ar.description as desc_ar,
                       ct_en.name as name_en, ct_en.description as desc_en
                FROM categories c
                LEFT JOIN category_translations ct_ar ON ct_ar.category_id = c.id AND ct_ar.language = 'ar'
                LEFT JOIN category_translations ct_en ON ct_en.category_id = c.id AND ct_en.language = 'en'
                ORDER BY c.display_order ASC
                """
            ).fetchall()
            for r in rows:
                writer.writerow([r["id"], r["code"], r["name_ar"], r["name_en"], r["desc_ar"], r["desc_en"], r["display_order"], r["is_active"]])

        elif entity == "orders":
            writer.writerow([
                "order_number", "created_at", "status", "customer_name", "customer_phone",
                "fulfillment_type", "governorate", "wilayat", "subtotal_omr",
                "delivery_fee_omr", "total_amount_omr"
            ])
            rows = conn.execute("SELECT * FROM orders ORDER BY id DESC").fetchall()
            for r in rows:
                writer.writerow([
                    r["order_number"], r["created_at"], r["status"], r["customer_name"],
                    r["customer_phone"], r["fulfillment_type"], r["governorate"], r["wilayat"],
                    format_omr(r["subtotal_omr"]),
                    format_omr(r["delivery_fee_omr"]), format_omr(r["total_amount_omr"])
                ])

        elif entity == "template":
            writer.writerow([
                "sku", "category_code", "name_ar", "name_en", "short_description_ar",
                "short_description_en", "base_price_omr", "unit_type", "weight_label_ar",
                "weight_label_en", "in_stock", "image_url"
            ])
            writer.writerow([
                "TM-NEW-101", "royal-baklava", "بقلاوة ملكية خاصة", "Special Royal Baklava",
                "بقلاوة فاخرة بالفستق الحلبي", "Luxury Aleppo Pistachio Baklava",
                "15.000", "KG", "1 كيلو", "1 Kg", "1", "/assets/products/baklava-pistachio.svg"
            ])

        else:  # Default: products
            writer.writerow([
                "sku", "category_code", "name_ar", "name_en", "short_description_ar",
                "short_description_en", "base_price_omr", "unit_type", "weight_label_ar",
                "weight_label_en", "in_stock", "image_url"
            ])
            rows = conn.execute(
                """
                SELECT p.*, c.code as category_code,
                       pt_ar.name as name_ar, pt_ar.short_description as short_ar,
                       pt_en.name as name_en, pt_en.short_description as short_en,
                       (SELECT image_url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC LIMIT 1) as image_url
                FROM products p
                JOIN categories c ON c.id = p.category_id
                LEFT JOIN product_translations pt_ar ON pt_ar.product_id = p.id AND pt_ar.language = 'ar'
                LEFT JOIN product_translations pt_en ON pt_en.product_id = p.id AND pt_en.language = 'en'
                ORDER BY p.id ASC
                """
            ).fetchall()
            for r in rows:
                writer.writerow([
                    r["sku"], r["category_code"], r["name_ar"], r["name_en"],
                    r["short_ar"], r["short_en"], format_omr(r["base_price_omr"]),
                    r["unit_type"], r["weight_label_ar"], r["weight_label_en"],
                    r["in_stock"], r["image_url"]
                ])

    return output.getvalue()


def import_products_csv(csv_text: str):
    clean_text = (csv_text or "").lstrip("\ufeff").strip()
    if not clean_text:
        return {"successful_rows": 0, "failed_rows": 0, "errors": ["ملف CSV فارغ / CSV content is empty"]}

    reader = csv.DictReader(io.StringIO(clean_text))
    success_count = 0
    failed_count = 0
    errors = []

    with get_db() as conn:
        cat_map = {
            r["code"].lower(): r["id"]
            for r in conn.execute("SELECT id, code FROM categories").fetchall()
        }

    for row_idx, row in enumerate(reader, start=2):
        try:
            sku = (row.get("sku") or "").strip()
            name_ar = (row.get("name_ar") or "").strip()
            name_en = (row.get("name_en") or name_ar).strip()
            cat_code = (row.get("category_code") or "royal-baklava").strip().lower()
            price_str = (row.get("base_price_omr") or "").strip()

            if not sku:
                raise ValueError("حقل رمز المنتج (sku) مفقود / Missing SKU")
            if not name_ar:
                raise ValueError("حقل الاسم العربي (name_ar) مفقود / Missing Arabic name")
            if not price_str:
                raise ValueError("حقل السعر (base_price_omr) مفقود / Missing price")

            price_val = float(price_str)
            if price_val <= 0:
                raise ValueError("يجب أن يكون السعر أكبر من صفر / Price must be > 0")

            cat_id = cat_map.get(cat_code, 1)

            with get_db() as conn:
                existing = conn.execute("SELECT id FROM products WHERE sku = ?", (sku,)).fetchone()

            save_admin_product(
                {
                    "id": existing["id"] if existing else None,
                    "sku": sku,
                    "category_id": cat_id,
                    "name_ar": name_ar,
                    "name_en": name_en,
                    "short_description_ar": row.get("short_description_ar") or name_ar,
                    "short_description_en": row.get("short_description_en") or name_en,
                    "base_price_omr": price_val,
                    "unit_type": row.get("unit_type") or "KG",
                    "weight_label_ar": row.get("weight_label_ar") or "1 كيلو",
                    "weight_label_en": row.get("weight_label_en") or "1 Kg",
                    "in_stock": str(row.get("in_stock", "1")).strip() in ("1", "true", "True", "yes"),
                    "image_url": row.get("image_url") or "/assets/products/baklava-pistachio.svg",
                }
            )
            success_count += 1
        except Exception as e:
            failed_count += 1
            errors.append({"row": row_idx, "sku": row.get("sku") or "—", "error": str(e)})

    return {
        "successful_rows": success_count,
        "failed_rows": failed_count,
        "errors": errors,
    }
