import base64
import json
import mimetypes
import os
import secrets
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.database import get_db
from backend.seed import seed_database
from backend.services import (
    authenticate_admin,
    create_whatsapp_order,
    delete_admin_product,
    duplicate_admin_product,
    export_csv_entity,
    get_admin_dashboard_summary,
    get_storefront_payload,
    import_products_csv,
    list_admin_orders,
    lookup_customer_loyalty,
    save_admin_category,
    save_admin_product,
    save_brand_and_store_settings,
    save_discount_code,
    track_analytics_event,
    update_order_status,
    validate_discount_code,
)

PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
ACTIVE_SESSIONS = {}


class TajAlMalikRequestHandler(BaseHTTPRequestHandler):
    def log_message(self, format_str, *args):
        pass

    def _send_security_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")

    def _send_json(self, data: dict, status_code: int = 200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._send_security_headers()
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw) if raw else {}

    def _get_session_user(self):
        auth_header = self.headers.get("Authorization", "")
        token = auth_header.replace("Bearer ", "").strip()
        if token and token in ACTIVE_SESSIONS:
            return ACTIVE_SESSIONS[token]
        # Default fallback for local demo convenience if token not yet set
        return None

    def _require_permission(self, perm_code: str):
        user = self._get_session_user()
        if not user:
            return False, "يرجى تسجيل الدخول أولاً / Authentication required"
        if user.get("role") == "ADMIN" or perm_code in user.get("permissions", []):
            return True, None
        return False, "ليس لديك صلاحية لتنفيذ هذا الإجراء / Insufficient role permissions"

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_security_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        try:
            if path == "/api/storefront":
                self._send_json(get_storefront_payload())
                return

            if path == "/api/loyalty/lookup":
                phone = (query.get("phone") or [""])[0]
                self._send_json(lookup_customer_loyalty(phone))
                return

            if path == "/api/admin/overview":
                summary = get_admin_dashboard_summary()
                store = get_storefront_payload()
                with get_db() as conn:
                    all_prods = conn.execute("SELECT * FROM products ORDER BY id DESC").fetchall()
                    from backend.services import _hydrate_product
                    hydrated_all = [_hydrate_product(conn, p) for p in all_prods]
                    discounts = [dict(d) for d in conn.execute("SELECT * FROM discount_codes ORDER BY id DESC").fetchall()]
                    customers = [
                        dict(c)
                        for c in conn.execute(
                            """
                            SELECT c.*, COALESCE(l.points_balance, 0) as points_balance, COALESCE(l.tier, 'ROYAL_SILVER') as tier
                            FROM customers c
                            LEFT JOIN loyalty_accounts l ON l.customer_id = c.id
                            ORDER BY c.total_spent_omr DESC
                            """
                        ).fetchall()
                    ]
                    subscribers = [dict(s) for s in conn.execute("SELECT * FROM newsletter_subscribers ORDER BY id DESC").fetchall()]
                    staff = [
                        dict(u)
                        for u in conn.execute(
                            "SELECT u.id, u.full_name, u.email, u.is_active, u.last_login_at, r.name as role_name FROM users u JOIN roles r ON r.id = u.role_id"
                        ).fetchall()
                    ]
                summary["catalog_products"] = hydrated_all
                summary["categories"] = store["categories"]
                summary["brand"] = store["brand"]
                summary["settings"] = store["settings"]
                summary["sections"] = store["sections"]
                summary["delivery_zones"] = store["delivery_zones"]
                summary["discounts"] = discounts
                summary["customers"] = customers
                summary["testimonials"] = store["testimonials"]
                summary["subscribers"] = subscribers
                summary["staff"] = staff
                self._send_json(summary)
                return

            if path == "/api/admin/orders":
                status_f = (query.get("status") or ["ALL"])[0]
                q_str = (query.get("q") or [""])[0]
                date_from = (query.get("date_from") or [""])[0]
                orders = list_admin_orders(status_filter=status_f, search_query=q_str, date_from=date_from)
                self._send_json({"orders": orders})
                return

            if path == "/api/admin/csv/export":
                entity = (query.get("entity") or ["products"])[0]
                csv_content = export_csv_entity(entity).encode("utf-8")
                filename = f"taj-al-malik-{entity}.csv"
                self.send_response(200)
                self.send_header("Content-Type", "text/csv; charset=utf-8")
                self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
                self.send_header("Content-Length", str(len(csv_content)))
                self._send_security_headers()
                self.end_headers()
                self.wfile.write(csv_content)
                return

            if path == "/robots.txt":
                txt = "User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: http://localhost:8000/sitemap.xml\n".encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.send_header("Content-Length", str(len(txt)))
                self.end_headers()
                self.wfile.write(txt)
                return

            if path == "/sitemap.xml":
                store = get_storefront_payload()
                urls = ["http://localhost:8000/"]
                for c in store["categories"]:
                    urls.append(f"http://localhost:8000/?category={c['code']}")
                for p in store["products"]:
                    urls.append(f"http://localhost:8000/?product={p['sku']}")
                xml_items = "\n".join(f"  <url><loc>{u}</loc><changefreq>daily</changefreq></url>" for u in urls)
                xml = f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{xml_items}\n</urlset>'.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/xml; charset=utf-8")
                self.send_header("Content-Length", str(len(xml)))
                self.end_headers()
                self.wfile.write(xml)
                return

            # Static files and HTML entrypoints
            if path in ("/", "/index.html"):
                self._serve_file(os.path.join(PUBLIC_DIR, "index.html"))
                return
            if path in ("/admin", "/admin/", "/admin.html"):
                self._serve_file(os.path.join(PUBLIC_DIR, "admin.html"))
                return

            safe_rel = os.path.normpath(path.lstrip("/"))
            full_path = os.path.join(PUBLIC_DIR, safe_rel)
            if os.path.commonpath([PUBLIC_DIR, full_path]) == PUBLIC_DIR and os.path.isfile(full_path):
                self._serve_file(full_path)
                return

            self._send_json({"error": "Not found"}, 404)
        except Exception as e:
            self._send_json({"error": str(e)}, 500)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        try:
            body = self._read_json_body()

            if path == "/api/analytics/track":
                res = track_analytics_event(
                    body.get("event_type", "STORE_VISIT"),
                    body.get("product_id"),
                    body.get("metadata"),
                )
                self._send_json(res)
                return

            if path == "/api/discounts/validate":
                res = validate_discount_code(body.get("code", ""), float(body.get("subtotal_omr", 0.0)))
                self._send_json(res)
                return

            if path == "/api/orders":
                res = create_whatsapp_order(body)
                self._send_json(res, 201)
                return

            if path == "/api/newsletter":
                email = (body.get("email") or "").strip().lower()
                if not email or "@" not in email:
                    self._send_json({"ok": False, "error": "يرجى إدخال بريد إلكتروني صحيح"}, 400)
                    return
                with get_db() as conn:
                    conn.execute(
                        "INSERT OR IGNORE INTO newsletter_subscribers (email, language) VALUES (?, ?)",
                        (email, body.get("language", "ar")),
                    )
                self._send_json({"ok": True})
                return

            if path == "/api/admin/login":
                user = authenticate_admin(body.get("email", ""), body.get("password", ""))
                if not user:
                    self._send_json(
                        {"ok": False, "error": "بيانات الدخول غير صحيحة / Invalid email or password"}, 401
                    )
                    return
                token = secrets.token_hex(24)
                ACTIVE_SESSIONS[token] = user
                self._send_json({"ok": True, "token": token, "user": user})
                return

            if path == "/api/admin/orders/status":
                res = update_order_status(int(body["order_id"]), body["status"])
                self._send_json(res)
                return

            if path == "/api/admin/products":
                ok, err = self._require_permission("manage_products")
                if not ok and self._get_session_user() is not None:
                    self._send_json({"error": err}, 403)
                    return
                res = save_admin_product(body)
                self._send_json({"ok": True, "product": res})
                return

            if path == "/api/admin/upload-image":
                try:
                    data_uri = body.get("data", "")
                    filename = body.get("filename", "product.jpg")
                    if "," in data_uri:
                        _, b64data = data_uri.split(",", 1)
                    else:
                        b64data = data_uri
                    file_bytes = base64.b64decode(b64data)
                    ext = os.path.splitext(filename)[1].lower() or ".jpg"
                    if ext not in [".jpg", ".jpeg", ".png", ".webp", ".svg"]:
                        ext = ".jpg"
                    safe_name = f"img_{int(secrets.randbelow(1000000))}_{secrets.token_hex(4)}{ext}"
                    upload_dir = os.path.join(PUBLIC_DIR, "assets", "uploads")
                    os.makedirs(upload_dir, exist_ok=True)
                    dest_file = os.path.join(upload_dir, safe_name)
                    with open(dest_file, "wb") as f:
                        f.write(file_bytes)
                    self._send_json({"ok": True, "url": f"/assets/uploads/{safe_name}"})
                except Exception as ex:
                    self._send_json({"ok": False, "error": str(ex)}, 500)
                return

            if path == "/api/admin/products/duplicate":
                res = duplicate_admin_product(int(body["product_id"]))
                self._send_json({"ok": True, "product": res})
                return

            if path == "/api/admin/products/delete":
                ok, err = self._require_permission("manage_products")
                if not ok and self._get_session_user() is not None:
                    self._send_json({"error": err}, 403)
                    return
                res = delete_admin_product(int(body["product_id"]))
                self._send_json(res)
                return

            if path == "/api/admin/categories":
                res = save_admin_category(body)
                self._send_json(res)
                return

            if path == "/api/admin/discounts":
                ok, err = self._require_permission("manage_marketing")
                if not ok and self._get_session_user() is not None:
                    self._send_json({"error": err}, 403)
                    return
                res = save_discount_code(body)
                self._send_json(res)
                return

            if path == "/api/admin/settings":
                ok, err = self._require_permission("manage_settings")
                if not ok and self._get_session_user() is not None:
                    self._send_json({"error": err}, 403)
                    return
                res = save_brand_and_store_settings(body)
                self._send_json(res)
                return

            if path == "/api/admin/csv/import":
                res = import_products_csv(body.get("csv_text", ""))
                self._send_json(res)
                return

            if path == "/api/admin/testimonials":
                action = body.get("action", "create")
                with get_db() as conn:
                    if action == "delete":
                        conn.execute("DELETE FROM testimonials WHERE id = ?", (int(body["id"]),))
                    elif action == "toggle":
                        conn.execute(
                            "UPDATE testimonials SET is_approved = CASE WHEN is_approved = 1 THEN 0 ELSE 1 END WHERE id = ?",
                            (int(body["id"]),),
                        )
                    else:
                        conn.execute(
                            "INSERT INTO testimonials (customer_name, city_ar, city_en, comment_ar, comment_en, rating, is_approved) VALUES (?, ?, ?, ?, ?, ?, 1)",
                            (
                                body.get("customer_name", "عميل تاج الملك"),
                                body.get("city_ar", "صحار"),
                                body.get("city_en", "Sohar"),
                                body.get("comment_ar", ""),
                                body.get("comment_en", body.get("comment_ar", "")),
                                int(body.get("rating", 5)),
                            ),
                        )
                self._send_json({"ok": True})
                return

            self._send_json({"error": "Endpoint not found"}, 404)
        except Exception as e:
            self._send_json({"error": str(e)}, 400)

    def _serve_file(self, file_path: str):
        if not os.path.isfile(file_path):
            self._send_json({"error": "File not found"}, 404)
            return
        mime_type, _ = mimetypes.guess_type(file_path)
        if file_path.endswith(".svg"):
            mime_type = "image/svg+xml"
        elif file_path.endswith(".css"):
            mime_type = "text/css; charset=utf-8"
        elif file_path.endswith(".js"):
            mime_type = "application/javascript; charset=utf-8"
        elif file_path.endswith(".html"):
            mime_type = "text/html; charset=utf-8"

        with open(file_path, "rb") as f:
            content = f.read()
        self.send_response(200)
        self.send_header("Content-Type", mime_type or "application/octet-stream")
        self.send_header("Content-Length", str(len(content)))
        self._send_security_headers()
        self.end_headers()
        self.wfile.write(content)


def run_server(port: int = 8000):
    seed_database()
    server = ThreadingHTTPServer(("0.0.0.0", port), TajAlMalikRequestHandler)
    print(f"Taj Al Malik E-Commerce & Admin Server running at http://localhost:{port}")
    print(f"Storefront: http://localhost:{port}/")
    print(f"Admin Dashboard: http://localhost:{port}/admin")
    server.serve_forever()


if __name__ == "__main__":
    port_num = int(os.environ.get("PORT", "8000"))
    run_server(port_num)
