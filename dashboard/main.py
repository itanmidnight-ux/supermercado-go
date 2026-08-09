#!/usr/bin/env python3
"""Supermercados Go — Panel de Administración GTK3 (PyGObject)"""
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, GLib, Gdk, cairo, Pango
import json
import urllib.request
import urllib.error
import urllib.parse
import threading
import subprocess
import os
import csv
import io
from datetime import datetime, timedelta

# ── Constantes ──────────────────────────────────────────────────────────────
BASE_URL = "http://localhost:3777"
GREEN = "#00B860"
ORANGE = "#FF8C00"
GOLD = "#FFD93D"
DARK = "#1a1a2e"
WHITE = "#ffffff"
LIGHT_GRAY = "#f5f5f5"
RED = "#e74c3c"
CSS = """
.window { background-color: #f0f0f0; }
.header-bar { background-color: #00B860; color: white; }
.header-bar button { color: white; }
.tab-label { padding: 6px 12px; font-weight: bold; }
.card { background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.12); padding: 16px; }
.card-label { font-size: 11px; color: #888; text-transform: uppercase; }
.card-value { font-size: 24px; font-weight: bold; color: #00B860; }
.badge { padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; }
.badge-green { background-color: #d4edda; color: #155724; }
.badge-orange { background-color: #fff3cd; color: #856404; }
.badge-red { background-color: #f8d7da; color: #721c24; }
.badge-blue { background-color: #d1ecf1; color: #0c5460; }
.badge-gray { background-color: #e2e3e5; color: #383d41; }
.banner-disconnected { background-color: #e74c3c; color: white; padding: 4px 12px; font-weight: bold; }
.treeview { font-size: 12px; }
.treeview header button { font-weight: bold; background-color: #00B860; color: white; }
.treeview row:nth-child(even) { background-color: #f9f9f9; }
.treeview row:selected { background-color: #00B860; color: white; }
.btn-primary { background-color: #00B860; color: white; font-weight: bold; border-radius: 6px; padding: 8px 16px; }
.btn-primary:hover { background-color: #009e53; }
.btn-danger { background-color: #e74c3c; color: white; font-weight: bold; border-radius: 6px; padding: 8px 16px; }
.btn-danger:hover { background-color: #c0392b; }
.btn-warning { background-color: #FF8C00; color: white; font-weight: bold; border-radius: 6px; padding: 8px 16px; }
.search-entry { padding: 6px 12px; border-radius: 6px; border: 1px solid #ccc; }
.frame-table { border: 1px solid #ddd; border-radius: 6px; }
"""

STATUS_MAP = {
    "pending": ("Pendiente", "badge-orange"),
    "confirmed": ("Confirmado", "badge-blue"),
    "preparing": ("Preparando", "badge-orange"),
    "ready": ("Listo", "badge-blue"),
    "assigned": ("Asignado", "badge-blue"),
    "in_transit": ("En Tránsito", "badge-orange"),
    "delivered": ("Entregado", "badge-green"),
    "picked_up": ("Recogido", "badge-green"),
    "cancelled": ("Cancelado", "badge-red"),
}
DIAN_MAP = {
    "sent": ("Enviada", "badge-blue"),
    "accepted": ("Aceptada", "badge-green"),
    "rejected": ("Rechazada", "badge-red"),
    "pending": ("Pendiente", "badge-orange"),
}
VALID_TRANSITIONS = {
    "pending": ["confirmed", "cancelled"],
    "confirmed": ["preparing", "cancelled"],
    "preparing": ["ready", "cancelled"],
    "ready": ["assigned", "picked_up", "cancelled"],
    "assigned": ["in_transit", "cancelled"],
    "in_transit": ["delivered", "cancelled"],
}


def fmt_cop(v):
    try:
        return "$ {:,.0f}".format(float(v)).replace(",", ".")
    except (TypeError, ValueError):
        return "$ 0"


def fmt_date(d):
    if not d:
        return ""
    try:
        dt = datetime.fromisoformat(d.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d %H:%M")
    except Exception:
        return str(d)[:16]


def status_badge(status):
    label, cls = STATUS_MAP.get(status, (status, "badge-gray"))
    return label


def stock_status(current, minimum):
    if current <= 0:
        return ("CRÍTICO", "badge-red")
    elif current <= minimum:
        return ("BAJO", "badge-orange")
    return ("OK", "badge-green")


# ── Helper de API ───────────────────────────────────────────────────────────
class APIClient:
    def __init__(self):
        self.token = None
        self.on_401 = None

    def _request(self, method, path, data=None, timeout=10):
        url = BASE_URL + path
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        body = json.dumps(data).encode() if data else None
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            resp = urllib.request.urlopen(req, timeout=timeout)
            raw = resp.read().decode()
            if not raw:
                return {}
            return json.loads(raw)
        except urllib.error.HTTPError as e:
            if e.code == 401:
                if self.on_401:
                    GLib.idle_add(self.on_401)
            try:
                err = json.loads(e.read().decode())
                return {"error": err.get("error", str(e))}
            except Exception:
                return {"error": str(e)}
        except Exception as e:
            return {"error": f"Sin conexión: {e}"}

    def get(self, path, **kw):
        return self._request("GET", path, **kw)

    def post(self, path, data=None):
        return self._request("POST", path, data)

    def put(self, path, data=None):
        return self._request("PUT", path, data)

    def delete(self, path):
        return self._request("DELETE", path)


api = APIClient()


def run_in_thread(func, callback=None):
    def wrapper():
        result = func()
        if callback:
            GLib.idle_add(callback, result)
    t = threading.Thread(target=wrapper, daemon=True)
    t.start()
    return t


def make_scrolled(widget):
    sw = Gtk.ScrolledWindow()
    sw.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
    sw.set_expand(True)
    sw.add(widget)
    return sw


def make_button(label, css_class="btn-primary"):
    b = Gtk.Button(label=label)
    b.get_style_context().add_class(css_class)
    return b


def make_label(text, size=None, bold=False):
    l = Gtk.Label(label=text)
    if size:
        l.set_markup(f'<span size="{size}">{text}</span>')
    if bold:
        l.set_markup(f'<b>{text}</b>')
    return l


# ── Login Dialog ────────────────────────────────────────────────────────────
class LoginDialog(Gtk.Dialog):
    def __init__(self, parent=None):
        super().__init__(title="Supermercados Go — Inicio de Sesión", parent=parent,
                         modal=True, destroy_with_parent=True)
        self.set_default_size(400, 300)
        self.set_position(Gtk.WindowPosition.CENTER)
        self.resizable = False
        box = self.get_content_area()
        box.set_spacing(12)
        box.set_border_width(24)
        lbl = Gtk.Label()
        lbl.set_markup('<span size="xx-large" color="#00B860"><b>🛒 Supermercados Go</b></span>')
        lbl.set_justify(Gtk.Justification.CENTER)
        box.pack_start(lbl, False, False, 0)
        lbl2 = Gtk.Label(label="Panel de Administración")
        lbl2.set_opacity(0.6)
        box.pack_start(lbl2, False, False, 0)
        box.pack_start(Gtk.Separator(), False, False, 8)
        self.entry_email = Gtk.Entry()
        self.entry_email.set_placeholder_text("Correo electrónico")
        self.entry_email.set_text("carrierjawerly@gmail.com")
        box.pack_start(self.entry_email, False, False, 0)
        self.entry_pass = Gtk.Entry()
        self.entry_pass.set_placeholder_text("Contraseña")
        self.entry_pass.set_visibility(False)
        self.entry_pass.set_input_purpose(Gtk.InputPurpose.PASSWORD)
        self.entry_pass.set_activates_default(True)
        box.pack_start(self.entry_pass, False, False, 0)
        self.lbl_error = Gtk.Label(label="")
        self.lbl_error.set_markup('<span color="red"></span>')
        box.pack_start(self.lbl_error, False, False, 0)
        btn = Gtk.Button(label="Iniciar Sesión")
        btn.get_style_context().add_class("btn-primary")
        btn.set_size_request(-1, 44)
        btn.connect("clicked", self.do_login)
        self.add_action_widget(btn, Gtk.ResponseType.OK)
        self.set_default_response(Gtk.ResponseType.OK)
        self.connect("response", self.on_response)
        box.show_all()

    def on_response(self, dlg, resp):
        if resp == Gtk.ResponseType.OK:
            self.do_login(None)
        else:
            Gtk.main_quit()

    def do_login(self, _btn):
        email = self.entry_email.get_text().strip()
        pwd = self.entry_pass.get_text().strip()
        if not email or not pwd:
            self.lbl_error.set_markup('<span color="red">Ingrese correo y contraseña</span>')
            return
        self.lbl_error.set_markup('<span color="gray">Conectando...</span>')
        def task():
            return api.post("/api/auth/login", {"email": email, "password": pwd})
        def done(r):
            if "token" in r:
                api.token = r["token"]
                self.destroy()
            else:
                self.lbl_error.set_markup(f'<span color="red">{r.get("error", "Error desconocido")}</span>')
        run_in_thread(task, done)


# ── Tab Base ────────────────────────────────────────────────────────────────
class BaseTab(Gtk.Box):
    def __init__(self, title):
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        self.title = title
        self.set_border_width(8)

    def show_snackbar(self, msg, color=GREEN):
        bar = Gtk.InfoBar()
        bar.set_message_type(Gtk.MessageType.INFO)
        lbl = Gtk.Label(label=msg)
        lbl.set_markup(f'<span color="{color}" weight="bold">{msg}</span>')
        content = bar.get_content_area()
        content.pack_start(lbl, False, False, 0)
        self.pack_start(bar, False, False, 0)
        bar.show_all()
        GLib.timeout_add(4000, lambda: (self.remove(bar), False))

    def error_snackbar(self, msg):
        self.show_snackbar(msg, RED)


# ── 1. MonitoreoTab ────────────────────────────────────────────────────────
class MonitoreoTab(BaseTab):
    def __init__(self):
        super().__init__("🖥 Monitoreo")
        self.grid = Gtk.Grid()
        self.grid.set_column_spacing(12)
        self.grid.set_row_spacing(12)
        self.cards = {}
        labels = [("Servidor", "server"), ("Uptime", "uptime"), ("Clientes", "clients"),
                  ("Base de Datos", "db"), ("Memoria", "mem"), ("Systemd", "systemd")]
        for i, (lbl, key) in enumerate(labels):
            card = Gtk.Frame()
            card.get_style_context().add_class("card")
            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
            vbox.set_border_width(12)
            t = Gtk.Label(label=lbl)
            t.get_style_context().add_class("card-label")
            v = Gtk.Label(label="—")
            v.get_style_context().add_class("card-value")
            vbox.pack_start(t, False, False, 0)
            vbox.pack_start(v, False, False, 0)
            card.add(vbox)
            self.grid.attach(card, i % 3, i // 3, 1, 1)
            self.cards[key] = v
        self.pack_start(self.grid, False, False, 0)
        hbox = Gtk.Box(spacing=8)
        self.btn_restart = make_button("🔄 Reiniciar Servicio", "btn-warning")
        self.btn_restart.connect("clicked", self.service_action, "restart")
        self.btn_stop = make_button("⏹ Detener Servicio", "btn-danger")
        self.btn_stop.connect("clicked", self.service_action, "stop")
        hbox.pack_start(self.btn_restart, False, False, 0)
        hbox.pack_start(self.btn_stop, False, False, 0)
        self.pack_start(hbox, False, False, 0)
        self.refresh()
        GLib.timeout_add(5000, self.refresh)

    def refresh(self):
        def task():
            h = api.get("/api/health")
            systemd = "—"
            try:
                r = subprocess.run(["systemctl", "is-active", "supermercados-go"],
                                   capture_output=True, text=True, timeout=5)
                systemd = r.stdout.strip() or r.stderr.strip()
            except Exception:
                systemd = "No disponible"
            return h, systemd
        def done(data):
            h, systemd = data
            if h and "error" not in h:
                d = h.get("data", h)
                self.cards["server"].set_text("✅ En línea")
                self.cards["uptime"].set_text(str(d.get("uptime", "—")))
                self.cards["clients"].set_text(str(d.get("connected_clients", "—")))
                self.cards["db"].set_text(str(d.get("db_size", "—")))
                self.cards["mem"].set_text(str(d.get("memory_usage", "—")))
            else:
                for k in self.cards:
                    if k != "systemd":
                        self.cards[k].set_text("❌")
            self.cards["systemd"].set_text(systemd)
        run_in_thread(task, done)
        return True

    def service_action(self, btn, action):
        def task():
            try:
                cmd = ["sudo", "systemctl", action, "supermercados-go"]
                r = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
                return r.stdout.strip() or r.stderr.strip()
            except Exception as e:
                return str(e)
        def done(msg):
            self.show_snackbar(f"Servicio {action}: {msg}")
            self.refresh()
        run_in_thread(task, done)


# ── 2. PedidosTab ──────────────────────────────────────────────────────────
class PedidosTab(BaseTab):
    def __init__(self):
        super().__init__("📦 Pedidos")
        toolbar = Gtk.Box(spacing=8)
        self.combo_status = Gtk.ComboBoxText()
        self.combo_status.append("all", "Todos los estados")
        for s in STATUS_MAP:
            self.combo_status.append(s, STATUS_MAP[s][0])
        self.combo_status.set_active(0)
        self.combo_status.connect("changed", self.load_orders)
        toolbar.pack_start(self.combo_status, False, False, 0)
        toolbar.pack_start(Gtk.Label(label="   "), False, False, 0)
        btn_refresh = make_button("🔄 Actualizar")
        btn_refresh.connect("clicked", self.load_orders)
        toolbar.pack_start(btn_refresh, False, False, 0)
        toolbar.pack_end(Gtk.Label(), True, True, 0)
        self.pack_start(toolbar, False, False, 0)
        self.liststore = Gtk.ListStore(str, str, str, str, str, str)
        self.treeview = Gtk.TreeView(model=self.liststore)
        for i, col in enumerate(["ID", "Cliente", "Total", "Estado", "Método Pago", "Fecha"]):
            cr = Gtk.CellRendererText()
            tv = Gtk.TreeViewColumn(col, cr, text=i)
            tv.set_resizable(True)
            tv.set_min_width(90 if i != 0 else 220)
            self.treeview.append_column(tv)
        self.treeview.connect("row-activated", self.on_row_activated)
        sw = make_scrolled(self.treeview)
        self.pack_start(sw, True, True, 0)
        self.load_orders()

    def load_orders(self, *_a):
        status = self.combo_status.get_active_id()
        path = "/api/orders?page=1&limit=50"
        if status and status != "all":
            path += f"&status={status}"
        def task():
            return api.get(path)
        def done(r):
            self.liststore.clear()
            if "error" in r:
                self.error_snackbar(r["error"])
                return
            orders = r.get("data", r.get("orders", []))
            if isinstance(orders, dict):
                orders = orders.get("items", orders.get("data", []))
            for o in orders:
                st = status_badge(o.get("status", ""))
                pay = o.get("payment_method", o.get("payment_method_id", "—"))
                self.liststore.append([
                    o.get("id", ""), o.get("client_name", o.get("customer_name", "—")),
                    fmt_cop(o.get("total", 0)), st, str(pay), fmt_date(o.get("created_at", ""))
                ])
        run_in_thread(task, done)

    def on_row_activated(self, tv, path, col):
        model = tv.get_model()
        oid = model[path][0]
        self.show_order_detail(oid)

    def show_order_detail(self, oid):
        def task():
            return api.get(f"/api/orders/{oid}")
        def done(r):
            if "error" in r:
                self.error_snackbar(r["error"])
                return
            o = r.get("data", r)
            dlg = Gtk.Dialog(title=f"Pedido {oid}", transient_for=self.get_toplevel(),
                             modal=True, destroy_with_parent=True)
            dlg.set_default_size(500, 500)
            box = dlg.get_content_area()
            box.set_spacing(8)
            box.set_border_width(12)
            for k, v in [("ID", o.get("id","")), ("Cliente", o.get("client_name", "")),
                         ("Total", fmt_cop(o.get("total",0))), ("Estado", o.get("status","")),
                         ("Método Pago", str(o.get("payment_method",""))),
                         ("Dirección", o.get("delivery_address","")),
                         ("Notas", o.get("notes","—")), ("Fecha", fmt_date(o.get("created_at","")))]:
                row = Gtk.Box(spacing=8)
                row.pack_start(Gtk.Label(label=f"<b>{k}:</b>"), False, False, 0)
                row.pack_start(Gtk.Label(label=str(v)), False, False, 0)
                box.pack_start(row, False, False, 0)
            box.pack_start(Gtk.Separator(), False, False, 4)
            lbl_items = Gtk.Label(label="<b>Items:</b>")
            lbl_items.set_use_markup(True)
            box.pack_start(lbl_items, False, False, 0)
            items = o.get("items", [])
            if items:
                ls = Gtk.ListStore(str, str, str, str)
                for it in items:
                    ls.append([it.get("product_name",""), str(it.get("qty",0)),
                               fmt_cop(it.get("unit_price",0)), fmt_cop(it.get("line_total",0))])
                tv = Gtk.TreeView(model=ls)
                for i, c in enumerate(["Producto", "Cant", "P.Unit", "Subtotal"]):
                    tv.append_column(Gtk.TreeViewColumn(c, Gtk.CellRendererText(), text=i))
                box.pack_start(make_scrolled(tv), True, True, 0)
            box.pack_start(Gtk.Separator(), False, False, 4)
            act_box = Gtk.Box(spacing=8)
            cur = o.get("status", "")
            if cur in VALID_TRANSITIONS:
                cbo = Gtk.ComboBoxText()
                for tr in VALID_TRANSITIONS[cur]:
                    cbo.append(tr, STATUS_MAP.get(tr, (tr,))[0])
                act_box.pack_start(Gtk.Label(label="Cambiar estado:"), False, False, 0)
                act_box.pack_start(cbo, False, False, 0)
                def change_state(b):
                    ns = cbo.get_active_id()
                    if ns:
                        def t2(): return api.put(f"/api/orders/{oid}/status", {"status": ns})
                        def d2(r2):
                            if "error" in r2:
                                self.error_snackbar(r2["error"])
                            else:
                                self.show_snackbar("Estado actualizado")
                                self.load_orders()
                            dlg.destroy()
                        run_in_thread(t2, d2)
                btn_ch = make_button("Aplicar")
                btn_ch.connect("clicked", change_state)
                act_box.pack_start(btn_ch, False, False, 0)
            act_box.pack_end(Gtk.Label(), True, True, 0)
            box.pack_start(act_box, False, False, 0)
            box.show_all()
            dlg.run()
            dlg.destroy()
        run_in_thread(task, done)


# ── 3. VentasTab ───────────────────────────────────────────────────────────
class VentasTab(BaseTab):
    def __init__(self):
        super().__init__("💰 Ventas")
        self.card_box = Gtk.Box(spacing=12)
        self.card_box.set_homogeneous(True)
        self.card_vals = {}
        for key, label in [("ventas_hoy", "Ventas Hoy"), ("pedidos_hoy", "Pedidos Hoy"),
                            ("ticket_prom", "Ticket Promedio"), ("pendientes", "Pendientes")]:
            frame = Gtk.Frame()
            frame.get_style_context().add_class("card")
            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
            vbox.set_border_width(12)
            t = Gtk.Label(label=label)
            t.get_style_context().add_class("card-label")
            v = Gtk.Label(label="—")
            v.get_style_context().add_class("card-value")
            vbox.pack_start(t, False, False, 0)
            vbox.pack_start(v, False, False, 0)
            frame.add(vbox)
            self.card_box.pack_start(frame, True, True, 0)
            self.card_vals[key] = v
        self.pack_start(self.card_box, False, False, 0)
        lbl_chart = Gtk.Label(label="<b>Ventas Últimos 7 Días</b>")
        lbl_chart.set_use_markup(True)
        self.pack_start(lbl_chart, False, False, 4)
        self.drawing = Gtk.DrawingArea()
        self.drawing.set_size_request(-1, 200)
        self.drawing.connect("draw", self.on_draw_chart)
        self.chart_data = []
        self.pack_start(self.drawing, False, False, 0)
        lbl_top = Gtk.Label(label="<b>Top Productos</b>")
        lbl_top.set_use_markup(True)
        self.pack_start(lbl_top, False, False, 4)
        self.top_store = Gtk.ListStore(str, str, str)
        self.top_tv = Gtk.TreeView(model=self.top_store)
        for i, c in enumerate(["Producto", "Cantidad", "Ingresos"]):
            self.top_tv.append_column(Gtk.TreeViewColumn(c, Gtk.CellRendererText(), text=i))
        self.pack_start(make_scrolled(self.top_tv), True, True, 0)
        self.load_dashboard()

    def load_dashboard(self):
        def task():
            return api.get("/api/analytics/dashboard")
        def done(r):
            if "error" in r:
                self.error_snackbar(r["error"])
                return
            d = r.get("data", r)
            self.card_vals["ventas_hoy"].set_text(fmt_cop(d.get("total_revenue", 0)))
            self.card_vals["pedidos_hoy"].set_text(str(d.get("total_orders", 0)))
            rev = d.get("total_revenue", 0) or 0
            ord_ = d.get("total_orders", 0) or 0
            self.card_vals["ticket_prom"].set_text(fmt_cop(rev / ord_ if ord_ else 0))
            self.card_vals["pendientes"].set_text(str(d.get("active_orders", 0)))
            self.chart_data = d.get("sales_by_day", [])
            self.drawing.queue_draw()
            self.top_store.clear()
            for p in d.get("top_products", []):
                self.top_store.append([p.get("name", ""), str(p.get("total_qty", 0)),
                                      fmt_cop(p.get("total_revenue", 0))])
        run_in_thread(task, done)

    def on_draw_chart(self, widget, ctx):
        w = widget.get_allocated_width()
        h = widget.get_allocated_height()
        ctx.set_source_rgb(0.96, 0.96, 0.96)
        ctx.rectangle(0, 0, w, h)
        ctx.fill()
        data = self.chart_data
        if not data:
            ctx.set_source_rgb(0.5, 0.5, 0.5)
            ctx.select_font_face("Sans", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
            ctx.set_font_size(14)
            ctx.move_to(w / 2 - 60, h / 2)
            ctx.show_text("Sin datos")
            return
        max_val = max((float(d.get("revenue", 0)) or 0) for d in data) or 1
        n = len(data)
        margin = 50
        bar_w = max(20, (w - 2 * margin) / n - 10)
        chart_h = h - 2 * margin
        for i, d in enumerate(data):
            val = float(d.get("revenue", 0)) or 0
            bar_h = (val / max_val) * chart_h
            x = margin + i * ((w - 2 * margin) / n)
            y = h - margin - bar_h
            ctx.set_source_rgb(0, 0.722, 0.376)
            ctx.rectangle(x, y, bar_w, bar_h)
            ctx.fill()
            ctx.set_source_rgb(0, 0, 0)
            ctx.set_font_size(9)
            label = str(d.get("date", ""))[5:]
            ctx.move_to(x, h - margin + 14)
            ctx.show_text(label)
            ctx.set_font_size(8)
            ctx.move_to(x, y - 4)
            ctx.show_text(fmt_cop(val))


# ── 4. EmpleadosTab ─────────────────────────────────────────────────────────
class EmpleadosTab(BaseTab):
    def __init__(self):
        super().__init__("👷 Empleados")
        toolbar = Gtk.Box(spacing=8)
        btn_refresh = make_button("🔄 Actualizar")
        btn_refresh.connect("clicked", self.load_workers)
        toolbar.pack_start(btn_refresh, False, False, 0)
        toolbar.pack_end(Gtk.Label(), True, True, 0)
        self.pack_start(toolbar, False, False, 0)
        self.store = Gtk.ListStore(str, str, str, str, str, str, str)
        self.tv = Gtk.TreeView(model=self.store)
        for i, c in enumerate(["Nombre", "Teléfono", "Correo", "Estado", "Entregas", "Ganancias", "Acción"]):
            if i == 6:
                cr = Gtk.CellRendererToggle()
                cr.connect("toggled", self.on_toggle)
                tv = Gtk.TreeViewColumn(c, cr, active=i)
            else:
                cr = Gtk.CellRendererText()
                tv = Gtk.TreeViewColumn(c, cr, text=i)
            tv.set_resizable(True)
            self.tv.append_column(tv)
        self.pack_start(make_scrolled(self.tv), True, True, 0)
        self.load_workers()

    def load_workers(self, *_a):
        def task(): return api.get("/api/users?role=worker")
        def done(r):
            self.store.clear()
            if "error" in r:
                self.error_snackbar(r["error"])
                return
            users = r.get("data", r.get("users", []))
            if isinstance(users, dict):
                users = users.get("items", [])
            for u in users:
                active = u.get("is_active", True)
                self.store.append([
                    u.get("name", ""), u.get("phone", ""), u.get("email", ""),
                    "Activo" if active else "Suspendido",
                    str(u.get("total_deliveries", 0)), fmt_cop(u.get("earnings", 0)),
                    "true" if active else "false"
                ])
        run_in_thread(task, done)

    def on_toggle(self, cr, path):
        model = self.tv.get_model()
        uid = model[path][0]
        new_active = model[path][6] == "false"
        def task():
            return api.put(f"/api/users/{uid}", {"is_active": 1 if new_active else 0})
        def done(r):
            if "error" in r:
                self.error_snackbar(r["error"])
            else:
                self.show_snackbar("Estado actualizado")
            self.load_workers()
        run_in_thread(task, done)


# ── 5. ProductosTab ─────────────────────────────────────────────────────────
class ProductosTab(BaseTab):
    def __init__(self):
        super().__init__("🛍 Productos")
        toolbar = Gtk.Box(spacing=8)
        self.search = Gtk.Entry()
        self.search.set_placeholder_text("Buscar producto...")
        self.search.set_width_chars(25)
        self.search.connect("changed", self.load_products)
        toolbar.pack_start(self.search, False, False, 0)
        btn_add = make_button("➕ Nuevo Producto")
        btn_add.connect("clicked", self.open_product_dialog)
        toolbar.pack_start(btn_add, False, False, 0)
        btn_refresh = make_button("🔄")
        btn_refresh.connect("clicked", self.load_products)
        toolbar.pack_start(btn_refresh, False, False, 0)
        toolbar.pack_end(Gtk.Label(), True, True, 0)
        self.pack_start(toolbar, False, False, 0)
        self.store = Gtk.ListStore(str, str, str, str, str, str, str)
        self.tv = Gtk.TreeView(model=self.store)
        for i, c in enumerate(["ID", "Nombre", "Categoría", "Precio", "Stock", "Estado", "Acción"]):
            if i == 6:
                txt = Gtk.CellRendererText()
                btn = Gtk.CellRendererToggle()
                tv = Gtk.TreeViewColumn(c, btn, active=i)
            else:
                cr = Gtk.CellRendererText()
                tv = Gtk.TreeViewColumn(c, cr, text=i)
            tv.set_resizable(True)
            tv.set_min_width(70 if i != 1 else 200)
            self.tv.append_column(tv)
        self.tv.connect("row-activated", self.on_row_edit)
        self.pack_start(make_scrolled(self.tv), True, True, 0)
        self.categories = []
        self.load_categories()
        self.load_products()

    def load_categories(self):
        def task(): return api.get("/api/categories")
        def done(r):
            self.categories = []
            if "error" not in r:
                cats = r.get("data", r.get("categories", []))
                if isinstance(cats, dict):
                    cats = cats.get("items", [])
                self.categories = cats
        run_in_thread(task, done)

    def load_products(self, *_a):
        q = self.search.get_text().strip()
        path = "/api/products?page=1&limit=100"
        if q:
            path += f"&search={urllib.parse.quote(q)}"
        def task(): return api.get(path)
        def done(r):
            self.store.clear()
            if "error" in r:
                self.error_snackbar(r["error"])
                return
            prods = r.get("data", r.get("products", []))
            if isinstance(prods, dict):
                prods = prods.get("items", [])
            for p in prods:
                self.store.append([
                    p.get("id", ""), p.get("name", ""), p.get("category_name", p.get("category_id", "")),
                    fmt_cop(p.get("price", 0)), str(p.get("stock", 0)),
                    "Activo" if p.get("is_active", True) else "Inactivo",
                    "true" if p.get("is_active", True) else "false"
                ])
        run_in_thread(task, done)

    def open_product_dialog(self, product_id=None):
        dlg = Gtk.Dialog(title="Producto" if not product_id else "Editar Producto",
                         transient_for=self.get_toplevel(), modal=True)
        dlg.set_default_size(450, 450)
        box = dlg.get_content_area()
        box.set_spacing(8)
        box.set_border_width(16)
        fields = {}
        for label, key in [("Nombre", "name"), ("SKU", "sku"), ("Precio", "price"),
                           ("Stock", "stock"), ("Unidad", "unit"), ("URL Imagen", "image_url"),
                           ("Descripción", "description")]:
            row = Gtk.Box(spacing=8)
            l = Gtk.Label(label=label, width_chars=12)
            l.set_xalign(0)
            e = Gtk.Entry()
            row.pack_start(l, False, False, 0)
            row.pack_start(e, True, True, 0)
            box.pack_start(row, False, False, 0)
            fields[key] = e
        cat_row = Gtk.Box(spacing=8)
        cat_row.pack_start(Gtk.Label(label="Categoría", width_chars=12), False, False, 0)
        cat_cbo = Gtk.ComboBoxText()
        for c in self.categories:
            cat_cbo.append(c.get("id", ""), c.get("name", ""))
        cat_row.pack_start(cat_cbo, True, True, 0)
        box.pack_start(cat_row, False, False, 0)
        if product_id:
            def load_p(): return api.get(f"/api/products/{product_id}")
            def fill(r):
                if "error" in r:
                    return
                p = r.get("data", r)
                fields["name"].set_text(p.get("name", ""))
                fields["sku"].set_text(p.get("sku", ""))
                fields["price"].set_text(str(p.get("price", "")))
                fields["stock"].set_text(str(p.get("stock", "")))
                fields["unit"].set_text(p.get("unit", ""))
                fields["image_url"].set_text(p.get("image_url", ""))
                fields["description"].set_text(p.get("description", ""))
                cid = p.get("category_id", "")
                for i in range(cat_cbo.get_model().iter_n_children(None)):
                    if cat_cbo.get_model().get_value(cat_cbo.get_model().iter_nth_child(None, i), 0) == cid:
                        cat_cbo.set_active(i)
                        break
            run_in_thread(load_p, fill)
        btn_save = make_button("💾 Guardar")
        box.pack_start(btn_save, False, False, 8)
        box.show_all()
        def do_save(_b):
            data = {"name": fields["name"].get_text(), "sku": fields["sku"].get_text(),
                    "price": fields["price"].get_text(), "stock": fields["stock"].get_text(),
                    "unit": fields["unit"].get_text(), "image_url": fields["image_url"].get_text(),
                    "description": fields["description"].get_text(),
                    "category_id": cat_cbo.get_active_id() or ""}
            def task():
                if product_id:
                    return api.put(f"/api/products/{product_id}", data)
                return api.post("/api/products", data)
            def done(r):
                if "error" in r:
                    self.error_snackbar(r["error"])
                else:
                    self.show_snackbar("Producto guardado")
                    self.load_products()
                dlg.destroy()
            run_in_thread(task, done)
        btn_save.connect("clicked", do_save)
        dlg.run()
        dlg.destroy()

    def on_row_edit(self, tv, path, col):
        model = tv.get_model()
        pid = model[path][0]
        self.open_product_dialog(pid)


# ── 6. UsuariosTab ──────────────────────────────────────────────────────────
class UsuariosTab(BaseTab):
    def __init__(self):
        super().__init__("👥 Usuarios")
        toolbar = Gtk.Box(spacing=8)
        self.combo_role = Gtk.ComboBoxText()
        self.combo_role.append("all", "Todos los roles")
        for r in ["admin", "worker", "client"]:
            self.combo_role.append(r, r.capitalize())
        self.combo_role.set_active(0)
        self.combo_role.connect("changed", self.load_users)
        toolbar.pack_start(Gtk.Label(label="Rol:"), False, False, 0)
        toolbar.pack_start(self.combo_role, False, False, 0)
        btn_ref = make_button("🔄")
        btn_ref.connect("clicked", self.load_users)
        toolbar.pack_start(btn_ref, False, False, 0)
        toolbar.pack_end(Gtk.Label(), True, True, 0)
        self.pack_start(toolbar, False, False, 0)
        self.store = Gtk.ListStore(str, str, str, str, str, str, str)
        self.tv = Gtk.TreeView(model=self.store)
        for i, c in enumerate(["ID", "Nombre", "Correo", "Teléfono", "Rol", "Estado", "Registro"]):
            cr = Gtk.CellRendererText()
            tv = Gtk.TreeViewColumn(c, cr, text=i)
            tv.set_resizable(True)
            self.tv.append_column(tv)
        self.tv.connect("row-activated", self.on_row)
        self.pack_start(make_scrolled(self.tv), True, True, 0)
        self.load_users()

    def load_users(self, *_a):
        role = self.combo_role.get_active_id()
        path = "/api/users?page=1&limit=100"
        if role and role != "all":
            path += f"&role={role}"
        def task(): return api.get(path)
        def done(r):
            self.store.clear()
            if "error" in r:
                self.error_snackbar(r["error"])
                return
            users = r.get("data", r.get("users", []))
            if isinstance(users, dict):
                users = users.get("items", [])
            for u in users:
                self.store.append([
                    u.get("id", ""), u.get("name", ""), u.get("email", ""),
                    u.get("phone", ""), u.get("role", ""),
                    "Activo" if u.get("is_active", True) else "Suspendido",
                    fmt_date(u.get("created_at", ""))
                ])
        run_in_thread(task, done)

    def on_row(self, tv, path, col):
        model = tv.get_model()
        uid = model[path][0]
        uname = model[path][1]
        active = model[path][5] == "Activo"
        dlg = Gtk.Dialog(title=f"Usuario: {uname}", transient_for=self.get_toplevel(), modal=True)
        box = dlg.get_content_area()
        box.set_spacing(8)
        box.set_border_width(16)
        btn_toggle = make_button("Suspender" if active else "Activar",
                                  "btn-danger" if active else "btn-primary")
        def toggle(_b):
            def task(): return api.put(f"/api/users/{uid}", {"is_active": 0 if active else 1})
            def done(r):
                if "error" in r:
                    self.error_snackbar(r["error"])
                else:
                    self.show_snackbar("Estado actualizado")
                    self.load_users()
                dlg.destroy()
            run_in_thread(task, done)
        btn_toggle.connect("clicked", toggle)
        box.pack_start(btn_toggle, False, False, 0)
        box.show_all()
        dlg.run()
        dlg.destroy()


# ── 7. InventarioTab ────────────────────────────────────────────────────────
class InventarioTab(BaseTab):
    def __init__(self):
        super().__init__("📦 Inventario")
        toolbar = Gtk.Box(spacing=8)
        btn_ref = make_button("🔄 Actualizar")
        btn_ref.connect("clicked", self.load_inventory)
        btn_kardex = make_button("📋 Abrir Kardex", "btn-warning")
        toolbar.pack_start(btn_ref, False, False, 0)
        toolbar.pack_start(btn_kardex, False, False, 0)
        toolbar.pack_end(Gtk.Label(), True, True, 0)
        self.pack_start(toolbar, False, False, 0)
        self.store = Gtk.ListStore(str, str, str, str, str, str)
        self.tv = Gtk.TreeView(model=self.store)
        for i, c in enumerate(["ID", "Producto", "SKU", "Stock Actual", "Stock Mín", "Estado"]):
            cr = Gtk.CellRendererText()
            tv = Gtk.TreeViewColumn(c, cr, text=i)
            tv.set_resizable(True)
            self.tv.append_column(tv)
        self.tv.connect("row-activated", self.on_row_adjust)
        self.pack_start(make_scrolled(self.tv), True, True, 0)
        self.alert_frame = Gtk.Frame(label=" ⚠️ Alertas de Stock Bajo ")
        self.alert_store = Gtk.ListStore(str, str, str)
        self.alert_tv = Gtk.TreeView(model=self.alert_store)
        for i, c in enumerate(["Producto", "Stock", "Mínimo"]):
            self.alert_tv.append_column(Gtk.TreeViewColumn(c, Gtk.CellRendererText(), text=i))
        self.alert_frame.add(make_scrolled(self.alert_tv))
        self.pack_start(self.alert_frame, False, False, 0)
        self.load_inventory()

    def load_inventory(self, *_a):
        def task(): return api.get("/api/inventory?page=1&limit=200")
        def done(r):
            self.store.clear()
            self.alert_store.clear()
            if "error" in r:
                self.error_snackbar(r["error"])
                return
            items = r.get("data", r.get("items", []))
            if isinstance(items, dict):
                items = items.get("items", [])
            for it in items:
                cur = it.get("current_stock", it.get("stock", 0))
                mn = it.get("min_stock", it.get("minimum_stock", 5))
                st = stock_status(cur, mn)[0]
                self.store.append([
                    it.get("product_id", it.get("id", "")),
                    it.get("product_name", it.get("name", "")),
                    it.get("sku", ""), str(cur), str(mn), st
                ])
                if cur <= mn:
                    self.alert_store.append([it.get("product_name", it.get("name", "")),
                                            str(cur), str(mn)])
        run_in_thread(task, done)

    def on_row_adjust(self, tv, path, col):
        model = tv.get_model()
        pid = model[path][0]
        pname = model[path][1]
        dlg = Gtk.Dialog(title=f"Ajustar Stock: {pname}", transient_for=self.get_toplevel(), modal=True)
        box = dlg.get_content_area()
        box.set_spacing(8)
        box.set_border_width(16)
        box.pack_start(Gtk.Label(label="Cantidad (positiva = entrada, negativa = salida):"), False, False, 0)
        adj_entry = Gtk.Entry()
        adj_entry.set_text("0")
        box.pack_start(adj_entry, False, False, 0)
        box.pack_start(Gtk.Label(label="Referencia:"), False, False, 0)
        ref_entry = Gtk.Entry()
        box.pack_start(ref_entry, False, False, 0)
        btn = make_button("💾 Aplicar")
        box.pack_start(btn, False, False, 8)
        box.show_all()
        def do_adj(_b):
            qty = adj_entry.get_text().strip()
            ref = ref_entry.get_text().strip()
            def task(): return api.post("/api/inventory/adjust", {"product_id": pid, "qty": qty, "reference": ref})
            def done(r):
                if "error" in r:
                    self.error_snackbar(r["error"])
                else:
                    self.show_snackbar("Stock ajustado")
                    self.load_inventory()
                dlg.destroy()
            run_in_thread(task, done)
        btn.connect("clicked", do_adj)
        dlg.run()
        dlg.destroy()


# ── 8. KardexTab ─────────────────────────────────────────────────────────────
class KardexTab(BaseTab):
    def __init__(self):
        super().__init__("📋 Kardex")
        toolbar = Gtk.Box(spacing=8)
        toolbar.pack_start(Gtk.Label(label="Producto:"), False, False, 0)
        self.combo_prod = Gtk.ComboBoxText()
        self.combo_prod.set_entry_text_column(0)
        toolbar.pack_start(self.combo_prod, False, False, 0)
        toolbar.pack_start(Gtk.Label(label="  Desde:"), False, False, 0)
        self.cal_from = Gtk.Entry()
        self.cal_from.set_width_chars(12)
        self.cal_from.set_placeholder_text("YYYY-MM-DD")
        toolbar.pack_start(self.cal_from, False, False, 0)
        toolbar.pack_start(Gtk.Label(label="  Hasta:"), False, False, 0)
        self.cal_to = Gtk.Entry()
        self.cal_to.set_width_chars(12)
        self.cal_to.set_placeholder_text("YYYY-MM-DD")
        toolbar.pack_start(self.cal_to, False, False, 0)
        btn = make_button("🔍 Filtrar")
        btn.connect("clicked", self.load_kardex)
        toolbar.pack_start(btn, False, False, 0)
        self.pack_start(toolbar, False, False, 0)
        self.store = Gtk.ListStore(str, str, str, str, str, str)
        self.tv = Gtk.TreeView(model=self.store)
        for i, c in enumerate(["Fecha", "Tipo", "Cantidad", "Antes", "Después", "Referencia"]):
            cr = Gtk.CellRendererText()
            tv = Gtk.TreeViewColumn(c, cr, text=i)
            tv.set_resizable(True)
            self.tv.append_column(tv)
        self.pack_start(make_scrolled(self.tv), True, True, 0)
        self.summary_lbl = Gtk.Label(label="")
        self.pack_start(self.summary_lbl, False, False, 0)
        self.load_products_combo()

    def load_products_combo(self):
        def task(): return api.get("/api/products?page=1&limit=500")
        def done(r):
            if "error" in r:
                return
            prods = r.get("data", r.get("products", []))
            if isinstance(prods, dict):
                prods = prods.get("items", [])
            self.product_list = prods
            for p in prods:
                self.combo_prod.append(p["id"], p.get("name", ""))
        run_in_thread(task, done)

    def load_kardex(self, *_a):
        pid = self.combo_prod.get_active_id()
        if not pid:
            self.error_snackbar("Seleccione un producto")
            return
        f = self.cal_from.get_text().strip()
        t = self.cal_to.get_text().strip()
        path = f"/api/inventory/kardex/{pid}"
        params = []
        if f:
            params.append(f"from={f}")
        if t:
            params.append(f"to={t}")
        if params:
            path += "?" + "&".join(params)
        def task(): return api.get(path)
        def done(r):
            self.store.clear()
            total_in = total_out = 0
            if "error" in r:
                self.error_snackbar(r["error"])
                return
            items = r.get("data", r.get("items", r.get("movements", [])))
            if isinstance(items, dict):
                items = items.get("items", [])
            for m in items:
                qty = m.get("qty", 0)
                if qty > 0:
                    total_in += qty
                else:
                    total_out += abs(qty)
                self.store.append([
                    fmt_date(m.get("created_at", m.get("date", ""))),
                    m.get("type", m.get("movement_type", "")),
                    f"{qty:+.0f}",
                    str(m.get("before_stock", "")),
                    str(m.get("after_stock", "")),
                    m.get("reference", "")
                ])
            self.summary_lbl.set_markup(
                f"<b>Entradas:</b> {total_in} | <b>Salidas:</b> {total_out} | <b>Neto:</b> {total_in - total_out}")
        run_in_thread(task, done)


# ── 9. ComprasTab ───────────────────────────────────────────────────────────
class ComprasTab(BaseTab):
    def __init__(self):
        super().__init__("🛒 Compras")
        nb = Gtk.Notebook()
        self.pack_start(nb, True, True, 0)
        self.suppliers_page = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        self.suppliers_page.set_border_width(8)
        nb.append_page(self.suppliers_page, Gtk.Label(label="Proveedores"))
        self.purchases_page = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        self.purchases_page.set_border_width(8)
        nb.append_page(self.purchases_page, Gtk.Label(label="Órdenes de Compra"))
        self._build_suppliers()
        self._build_purchases()
        self.load_suppliers()
        self.load_purchases()

    def _build_suppliers(self):
        tb = Gtk.Box(spacing=8)
        btn_add = make_button("➕ Nuevo Proveedor")
        btn_add.connect("clicked", self.supplier_dialog)
        btn_ref = make_button("🔄")
        btn_ref.connect("clicked", self.load_suppliers)
        tb.pack_start(btn_add, False, False, 0)
        tb.pack_start(btn_ref, False, False, 0)
        tb.pack_end(Gtk.Label(), True, True, 0)
        self.suppliers_page.pack_start(tb, False, False, 0)
        self.sup_store = Gtk.ListStore(str, str, str, str, str)
        self.sup_tv = Gtk.TreeView(model=self.sup_store)
        for i, c in enumerate(["ID", "Nombre", "NIT", "Teléfono", "Correo"]):
            self.sup_tv.append_column(Gtk.TreeViewColumn(c, Gtk.CellRendererText(), text=i))
        self.sup_tv.connect("row-activated", self.on_sup_row)
        self.suppliers_page.pack_start(make_scrolled(self.sup_tv), True, True, 0)

    def load_suppliers(self, *_a):
        def task(): return api.get("/api/suppliers")
        def done(r):
            self.sup_store.clear()
            if "error" in r:
                return
            items = r.get("data", r.get("suppliers", []))
            if isinstance(items, dict):
                items = items.get("items", [])
            for s in items:
                self.sup_store.append([s.get("id", ""), s.get("name", ""),
                                       s.get("nit", ""), s.get("phone", ""), s.get("email", "")])
        run_in_thread(task, done)

    def supplier_dialog(self, sid=None):
        dlg = Gtk.Dialog(title="Proveedor", transient_for=self.get_toplevel(), modal=True)
        box = dlg.get_content_area()
        box.set_spacing(8)
        box.set_border_width(16)
        fields = {}
        for lbl, key in [("Nombre", "name"), ("NIT", "nit"), ("Teléfono", "phone"),
                         ("Correo", "email"), ("Dirección", "address")]:
            row = Gtk.Box(spacing=8)
            row.pack_start(Gtk.Label(label=lbl, width_chars=12), False, False, 0)
            e = Gtk.Entry()
            row.pack_start(e, True, True, 0)
            box.pack_start(row, False, False, 0)
            fields[key] = e
        btn = make_button("💾 Guardar")
        box.pack_start(btn, False, False, 8)
        box.show_all()
        def save(_b):
            data = {k: e.get_text() for k, e in fields.items()}
            def task():
                if sid:
                    return api.put(f"/api/suppliers/{sid}", data)
                return api.post("/api/suppliers", data)
            def done(r):
                if "error" in r:
                    self.error_snackbar(r["error"])
                else:
                    self.show_snackbar("Proveedor guardado")
                    self.load_suppliers()
                dlg.destroy()
            run_in_thread(task, done)
        btn.connect("clicked", save)
        dlg.run()
        dlg.destroy()

    def on_sup_row(self, tv, path, col):
        sid = tv.get_model()[path][0]
        self.supplier_dialog(sid)

    def _build_purchases(self):
        tb = Gtk.Box(spacing=8)
        btn_add = make_button("➕ Nueva Orden")
        btn_ref = make_button("🔄")
        btn_ref.connect("clicked", self.load_purchases)
        tb.pack_start(btn_add, False, False, 0)
        tb.pack_start(btn_ref, False, False, 0)
        tb.pack_end(Gtk.Label(), True, True, 0)
        self.purchases_page.pack_start(tb, False, False, 0)
        self.pur_store = Gtk.ListStore(str, str, str, str, str, str)
        self.pur_tv = Gtk.TreeView(model=self.pur_store)
        for i, c in enumerate(["Número", "Proveedor", "Total", "Estado", "Fecha", "Acción"]):
            if i == 5:
                cr = Gtk.CellRendererText()
                tv = Gtk.TreeViewColumn(c, cr, text=i)
            else:
                cr = Gtk.CellRendererText()
                tv = Gtk.TreeViewColumn(c, cr, text=i)
            tv.set_resizable(True)
            self.pur_tv.append_column(tv)
        self.purchases_page.pack_start(make_scrolled(self.pur_tv), True, True, 0)

    def load_purchases(self, *_a):
        def task(): return api.get("/api/purchases?page=1&limit=50")
        def done(r):
            self.pur_store.clear()
            if "error" in r:
                return
            items = r.get("data", r.get("purchases", []))
            if isinstance(items, dict):
                items = items.get("items", [])
            for p in items:
                st = p.get("status", "")
                st_label = {"pending": "Pendiente", "received": "Recibida", "cancelled": "Cancelada"}.get(st, st)
                self.pur_store.append([
                    p.get("number", p.get("id", "")), p.get("supplier_name", "—"),
                    fmt_cop(p.get("total", 0)), st_label, fmt_date(p.get("created_at", "")),
                    "Recibir" if st == "pending" else ""
                ])
        run_in_thread(task, done)


# ── 10. FacturacionTab ──────────────────────────────────────────────────────
class FacturacionTab(BaseTab):
    def __init__(self):
        super().__init__("🧾 Facturación")
        nb = Gtk.Notebook()
        self.pack_start(nb, True, True, 0)
        inv_page = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        inv_page.set_border_width(8)
        nb.append_page(inv_page, Gtk.Label(label="Facturas"))
        cfg_page = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        cfg_page.set_border_width(8)
        nb.append_page(cfg_page, Gtk.Label(label="Configuración DIAN"))
        self._build_invoices(inv_page)
        self._build_config(cfg_page)
        self.load_invoices()
        self.load_config()

    def _build_invoices(self, page):
        tb = Gtk.Box(spacing=8)
        tb.pack_start(Gtk.Label(label="Estado DIAN:"), False, False, 0)
        self.combo_dian = Gtk.ComboBoxText()
        self.combo_dian.append("all", "Todos")
        for k, (v, _) in DIAN_MAP.items():
            self.combo_dian.append(k, v)
        self.combo_dian.set_active(0)
        self.combo_dian.connect("changed", self.load_invoices)
        tb.pack_start(self.combo_dian, False, False, 0)
        btn = make_button("🔄")
        btn.connect("clicked", self.load_invoices)
        tb.pack_start(btn, False, False, 0)
        tb.pack_end(Gtk.Label(), True, True, 0)
        page.pack_start(tb, False, False, 0)
        self.inv_store = Gtk.ListStore(str, str, str, str, str, str)
        self.inv_tv = Gtk.TreeView(model=self.inv_store)
        for i, c in enumerate(["Número", "Cliente", "Total", "Estado DIAN", "Fecha", "Acción"]):
            cr = Gtk.CellRendererText()
            tv = Gtk.TreeViewColumn(c, cr, text=i)
            tv.set_resizable(True)
            self.inv_tv.append_column(tv)
        self.inv_tv.connect("row-activated", self.on_inv_row)
        page.pack_start(make_scrolled(self.inv_tv), True, True, 0)

    def load_invoices(self, *_a):
        dian = self.combo_dian.get_active_id()
        path = "/api/invoices?page=1&limit=50"
        if dian and dian != "all":
            path += f"&dian_status={dian}"
        def task(): return api.get(path)
        def done(r):
            self.inv_store.clear()
            if "error" in r:
                return
            items = r.get("data", r.get("invoices", []))
            if isinstance(items, dict):
                items = items.get("items", [])
            for inv in items:
                ds = inv.get("dian_status", "pending")
                ds_label = DIAN_MAP.get(ds, (ds,))[0]
                self.inv_store.append([
                    inv.get("number", inv.get("id", "")),
                    inv.get("customer_name", inv.get("client_name", "—")),
                    fmt_cop(inv.get("total", 0)), ds_label,
                    fmt_date(inv.get("created_at", inv.get("date", ""))),
                    "Reenviar" if ds in ("pending", "rejected") else ""
                ])
        run_in_thread(task, done)

    def on_inv_row(self, tv, path, col):
        action = tv.get_model()[path][5]
        inv_id = tv.get_model()[path][0]
        if action == "Reenviar":
            def task(): return api.post(f"/api/invoices/{inv_id}/resend-dian")
            def done(r):
                if "error" in r:
                    self.error_snackbar(r["error"])
                else:
                    self.show_snackbar("Reenvío solicitado")
                    self.load_invoices()
            run_in_thread(task, done)

    def _build_config(self, page):
        grid = Gtk.Grid()
        grid.set_column_spacing(12)
        grid.set_row_spacing(8)
        self.cfg_fields = {}
        labels = [("resolution_number", "Número Resolución"), ("prefix", "Prefijo"),
                  ("from_number", "Desde"), ("to_number", "Hasta"),
                  ("valid_until", "Válida Hasta")]
        for i, (key, lbl) in enumerate(labels):
            grid.attach(Gtk.Label(label=lbl), 0, i, 1, 1)
            e = Gtk.Entry()
            e.set_width_chars(25)
            grid.attach(e, 1, i, 1, 1)
            self.cfg_fields[key] = e
        page.pack_start(grid, False, False, 8)
        btn_save = make_button("💾 Guardar Configuración DIAN")
        btn_save.connect("clicked", self.save_config)
        page.pack_start(btn_save, False, False, 8)

    def load_config(self):
        def task(): return api.get("/api/settings")
        def done(r):
            if "error" in r:
                return
            d = r.get("data", r)
            for k, e in self.cfg_fields.items():
                v = d.get(k, d.get(f"invoice_{k}", ""))
                e.set_text(str(v))
        run_in_thread(task, done)

    def save_config(self, _b):
        data = {k: e.get_text() for k, e in self.cfg_fields.items()}
        def task(): return api.put("/api/settings", data)
        def done(r):
            if "error" in r:
                self.error_snackbar(r["error"])
            else:
                self.show_snackbar("Configuración guardada")
        run_in_thread(task, done)


# ── 11. CajaTab ──────────────────────────────────────────────────────────────
class CajaTab(BaseTab):
    def __init__(self):
        super().__init__("💵 Caja")
        self.current_frame = Gtk.Frame(label=" Sesión de Caja Actual ")
        self.current_frame.get_style_context().add_class("card")
        self.current_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        self.current_box.set_border_width(12)
        self.current_lbl = Gtk.Label(label="No hay sesión abierta")
        self.current_box.pack_start(self.current_lbl, False, False, 0)
        hbox = Gtk.Box(spacing=8)
        btn_open = make_button("📥 Abrir Caja")
        btn_open.connect("clicked", self.open_session)
        btn_close = make_button("📤 Cerrar Caja", "btn-danger")
        btn_close.connect("clicked", self.close_session)
        hbox.pack_start(btn_open, False, False, 0)
        hbox.pack_start(btn_close, False, False, 0)
        self.current_box.pack_start(hbox, False, False, 0)
        self.current_frame.add(self.current_box)
        self.pack_start(self.current_frame, False, False, 0)
        lbl_hist = Gtk.Label(label="<b>Historial de Sesiones</b>")
        lbl_hist.set_use_markup(True)
        self.pack_start(lbl_hist, False, False, 4)
        self.store = Gtk.ListStore(str, str, str, str, str)
        self.tv = Gtk.TreeView(model=self.store)
        for i, c in enumerate(["ID", "Apertura", "Cierre", "Base", "Total"]):
            self.tv.append_column(Gtk.TreeViewColumn(c, Gtk.CellRendererText(), text=i))
        self.pack_start(make_scrolled(self.tv), True, True, 0)
        self.load_current()
        self.load_history()

    def load_current(self):
        def task(): return api.get("/api/cash-sessions/active")
        def done(r):
            if "error" in r or not r.get("data"):
                self.current_lbl.set_text("No hay sesión abierta")
                return
            s = r["data"]
            self.current_lbl.set_markup(
                f"<b>Sesión:</b> {s.get('id','')}\n"
                f"<b>Base:</b> {fmt_cop(s.get('opening_amount',0))}\n"
                f"<b>Ventas:</b> {fmt_cop(s.get('total_sales',0))}\n"
                f"<b>Abierta:</b> {fmt_date(s.get('opened_at',''))}")
        run_in_thread(task, done)

    def load_history(self):
        def task(): return api.get("/api/cash-sessions?page=1&limit=50")
        def done(r):
            self.store.clear()
            if "error" in r:
                return
            items = r.get("data", r.get("sessions", []))
            if isinstance(items, dict):
                items = items.get("items", [])
            for s in items:
                self.store.append([
                    s.get("id", ""), fmt_date(s.get("opened_at", "")),
                    fmt_date(s.get("closed_at", "")), fmt_cop(s.get("opening_amount", 0)),
                    fmt_cop(s.get("closing_amount", s.get("total_sales", 0)))
                ])
        run_in_thread(task, done)

    def open_session(self, _b):
        dlg = Gtk.Dialog(title="Abrir Caja", transient_for=self.get_toplevel(), modal=True)
        box = dlg.get_content_area()
        box.set_spacing(8)
        box.set_border_width(16)
        box.pack_start(Gtk.Label(label="Monto inicial (base de caja):"), False, False, 0)
        entry = Gtk.Entry()
        entry.set_text("0")
        box.pack_start(entry, False, False, 0)
        btn = make_button("💾 Abrir")
        box.pack_start(btn, False, False, 8)
        box.show_all()
        def do_open(_btn):
            def task(): return api.post("/api/cash-sessions/open", {"opening_amount": entry.get_text()})
            def done(r):
                if "error" in r:
                    self.error_snackbar(r["error"])
                else:
                    self.show_snackbar("Caja abierta")
                    self.load_current()
                    self.load_history()
                dlg.destroy()
            run_in_thread(task, done)
        btn.connect("clicked", do_open)
        dlg.run()
        dlg.destroy()

    def close_session(self, _b):
        dlg = Gtk.Dialog(title="Cerrar Caja", transient_for=self.get_toplevel(), modal=True)
        box = dlg.get_content_area()
        box.set_spacing(8)
        box.set_border_width(16)
        box.pack_start(Gtk.Label(label="Monto contado en caja:"), False, False, 0)
        entry = Gtk.Entry()
        box.pack_start(entry, False, False, 0)
        btn = make_button("💾 Cerrar")
        box.pack_start(btn, False, False, 8)
        box.show_all()
        def do_close(_btn):
            def task(): return api.post("/api/cash-sessions/close", {"closing_amount": entry.get_text()})
            def done(r):
                if "error" in r:
                    self.error_snackbar(r["error"])
                else:
                    self.show_snackbar("Caja cerrada")
                    self.load_current()
                    self.load_history()
                dlg.destroy()
            run_in_thread(task, done)
        btn.connect("clicked", do_close)
        dlg.run()
        dlg.destroy()


# ── 12. ReportesTab ──────────────────────────────────────────────────────────
class ReportesTab(BaseTab):
    def __init__(self):
        super().__init__("📊 Reportes")
        tb = Gtk.Box(spacing=8)
        tb.pack_start(Gtk.Label(label="Desde:"), False, False, 0)
        self.entry_from = Gtk.Entry()
        self.entry_from.set_width_chars(12)
        self.entry_from.set_placeholder_text("YYYY-MM-DD")
        tb.pack_start(self.entry_from, False, False, 0)
        tb.pack_start(Gtk.Label(label="Hasta:"), False, False, 0)
        self.entry_to = Gtk.Entry()
        self.entry_to.set_width_chars(12)
        self.entry_to.set_placeholder_text("YYYY-MM-DD")
        tb.pack_start(self.entry_to, False, False, 0)
        btn_gen = make_button("📊 Generar")
        btn_gen.connect("clicked", self.generate_report)
        tb.pack_start(btn_gen, False, False, 0)
        btn_csv = make_button("📥 Exportar CSV", "btn-warning")
        btn_csv.connect("clicked", self.export_csv)
        tb.pack_start(btn_csv, False, False, 0)
        self.pack_start(tb, False, False, 0)
        self.nb = Gtk.Notebook()
        self.pack_start(self.nb, True, True, 0)
        for title in ["Resumen Ventas", "Top Productos", "Rendimiento Empleados"]:
            sw = Gtk.ScrolledWindow()
            sw.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
            tv = Gtk.TreeView()
            sw.add(tv)
            self.nb.append_page(sw, Gtk.Label(label=title))
        self.generate_report()

    def generate_report(self, *_a):
        f = self.entry_from.get_text().strip()
        t = self.entry_to.get_text().strip()
        path = "/api/analytics/sales"
        params = []
        if f:
            params.append(f"from={f}")
        if t:
            params.append(f"to={t}")
        if params:
            path += "?" + "&".join(params)
        def task():
            r1 = api.get(path)
            r2 = api.get("/api/analytics/dashboard")
            r3 = api.get("/api/users?role=worker")
            return r1, r2, r3
        def done(results):
            r_sales, r_dash, r_workers = results
            sales_page = self.nb.get_nth_page(0)
            sales_page.remove(sales_page.get_child())
            ls1 = Gtk.ListStore(str, str, str)
            if "error" not in r_sales:
                items = r_sales.get("data", [])
                if isinstance(items, dict):
                    items = items.get("items", [])
                for s in items:
                    ls1.append([str(s.get("date", "")), str(s.get("orders", s.get("count", 0))),
                                fmt_cop(s.get("revenue", s.get("total", 0)))])
            tv1 = Gtk.TreeView(model=ls1)
            for i, c in enumerate(["Fecha", "Pedidos", "Ingresos"]):
                tv1.append_column(Gtk.TreeViewColumn(c, Gtk.CellRendererText(), text=i))
            sales_page.add(tv1)
            sales_page.show_all()
            top_page = self.nb.get_nth_page(1)
            top_page.remove(top_page.get_child())
            ls2 = Gtk.ListStore(str, str, str)
            if "error" not in r_dash:
                d = r_dash.get("data", r_dash)
                for p in d.get("top_products", []):
                    ls2.append([p.get("name", ""), str(p.get("total_qty", 0)),
                                fmt_cop(p.get("total_revenue", 0))])
            tv2 = Gtk.TreeView(model=ls2)
            for i, c in enumerate(["Producto", "Cantidad", "Ingresos"]):
                tv2.append_column(Gtk.TreeViewColumn(c, Gtk.CellRendererText(), text=i))
            top_page.add(tv2)
            top_page.show_all()
            wrk_page = self.nb.get_nth_page(2)
            wrk_page.remove(wrk_page.get_child())
            ls3 = Gtk.ListStore(str, str, str)
            if "error" not in r_workers:
                users = r_workers.get("data", r_workers.get("users", []))
                if isinstance(users, dict):
                    users = users.get("items", [])
                for u in users:
                    ls3.append([u.get("name", ""), str(u.get("total_deliveries", 0)),
                                fmt_cop(u.get("earnings", 0))])
            tv3 = Gtk.TreeView(model=ls3)
            for i, c in enumerate(["Empleado", "Entregas", "Ganancias"]):
                tv3.append_column(Gtk.TreeViewColumn(c, Gtk.CellRendererText(), text=i))
            wrk_page.add(tv3)
            wrk_page.show_all()
        run_in_thread(task, done)

    def export_csv(self, _b):
        f = self.entry_from.get_text().strip()
        t = self.entry_to.get_text().strip()
        path = "/api/analytics/export?format=csv"
        if f:
            path += f"&from={f}"
        if t:
            path += f"&to={t}"
        def task():
            url = BASE_URL + path
            headers = {}
            if api.token:
                headers["Authorization"] = f"Bearer {api.token}"
            req = urllib.request.Request(url, headers=headers)
            try:
                resp = urllib.request.urlopen(req, timeout=15)
                return resp.read().decode()
            except Exception as e:
                return None
        def done(csv_data):
            if not csv_data:
                self.error_snackbar("Error al exportar")
                return
            filename = f"reporte_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            filepath = os.path.join(os.path.expanduser("~"), "Descargas", filename)
            try:
                with open(filepath, "w") as f:
                    f.write(csv_data)
                self.show_snackbar(f"Guardado: {filepath}")
            except Exception as e:
                self.error_snackbar(f"Error guardando: {e}")
        run_in_thread(task, done)


# ── 13. PromocionesTab ───────────────────────────────────────────────────────
class PromocionesTab(BaseTab):
    def __init__(self):
        super().__init__("🏷 Promociones")
        tb = Gtk.Box(spacing=8)
        btn_add = make_button("➕ Nueva Promoción")
        btn_add.connect("clicked", self.promo_dialog)
        btn_ref = make_button("🔄")
        btn_ref.connect("clicked", self.load_promos)
        tb.pack_start(btn_add, False, False, 0)
        tb.pack_start(btn_ref, False, False, 0)
        tb.pack_end(Gtk.Label(), True, True, 0)
        self.pack_start(tb, False, False, 0)
        self.store = Gtk.ListStore(str, str, str, str, str, str, str, str, str)
        self.tv = Gtk.TreeView(model=self.store)
        for i, c in enumerate(["ID", "Código", "Nombre", "Tipo", "Valor", "Usos", "Máx",
                               "Vigencia", "Activa"]):
            cr = Gtk.CellRendererText()
            tv = Gtk.TreeViewColumn(c, cr, text=i)
            tv.set_resizable(True)
            self.tv.append_column(tv)
        self.tv.connect("row-activated", self.on_row)
        self.pack_start(make_scrolled(self.tv), True, True, 0)
        self.load_promos()

    def load_promos(self, *_a):
        def task(): return api.get("/api/promotions")
        def done(r):
            self.store.clear()
            if "error" in r:
                return
            items = r.get("data", r.get("promotions", []))
            if isinstance(items, dict):
                items = items.get("items", [])
            for p in items:
                self.store.append([
                    p.get("id", ""), p.get("code", ""), p.get("name", ""),
                    p.get("discount_type", p.get("type", "")),
                    str(p.get("discount_value", p.get("value", ""))),
                    str(p.get("current_uses", p.get("uses", 0))),
                    str(p.get("max_uses", "∞")),
                    f"{p.get('starts_at','')} - {p.get('expires_at','')}",
                    "Sí" if p.get("is_active", True) else "No"
                ])
        run_in_thread(task, done)

    def promo_dialog(self, pid=None):
        dlg = Gtk.Dialog(title="Promoción", transient_for=self.get_toplevel(), modal=True)
        box = dlg.get_content_area()
        box.set_spacing(8)
        box.set_border_width(16)
        fields = {}
        for lbl, key in [("Código", "code"), ("Nombre", "name"),
                         ("Tipo (percent/fixed)", "discount_type"), ("Valor", "discount_value"),
                         ("Usos Máx (vacío=∞)", "max_uses"),
                         ("Inicio (YYYY-MM-DD)", "starts_at"), ("Expira (YYYY-MM-DD)", "expires_at")]:
            row = Gtk.Box(spacing=8)
            row.pack_start(Gtk.Label(label=lbl, width_chars=20), False, False, 0)
            e = Gtk.Entry()
            row.pack_start(e, True, True, 0)
            box.pack_start(row, False, False, 0)
            fields[key] = e
        btn = make_button("💾 Guardar")
        box.pack_start(btn, False, False, 8)
        box.show_all()
        def save(_b):
            data = {k: e.get_text() for k, e in fields.items()}
            def task():
                if pid:
                    return api.put(f"/api/promotions/{pid}", data)
                return api.post("/api/promotions", data)
            def done(r):
                if "error" in r:
                    self.error_snackbar(r["error"])
                else:
                    self.show_snackbar("Promoción guardada")
                    self.load_promos()
                dlg.destroy()
            run_in_thread(task, done)
        btn.connect("clicked", save)
        dlg.run()
        dlg.destroy()

    def on_row(self, tv, path, col):
        pid = tv.get_model()[path][0]
        self.promo_dialog(pid)


# ── 14. AuditoriaTab ─────────────────────────────────────────────────────────
class AuditoriaTab(BaseTab):
    def __init__(self):
        super().__init__("🔍 Auditoría")
        tb = Gtk.Box(spacing=8)
        tb.pack_start(Gtk.Label(label="Usuario:"), False, False, 0)
        self.entry_user = Gtk.Entry()
        self.entry_user.set_width_chars(15)
        tb.pack_start(self.entry_user, False, False, 0)
        tb.pack_start(Gtk.Label(label="Acción:"), False, False, 0)
        self.combo_action = Gtk.ComboBoxText()
        self.combo_action.append("all", "Todas")
        for a in ["create", "update", "delete", "login", "status_change"]:
            self.combo_action.append(a, a)
        tb.pack_start(self.combo_action, False, False, 0)
        tb.pack_start(Gtk.Label(label="Fecha:"), False, False, 0)
        self.entry_date = Gtk.Entry()
        self.entry_date.set_width_chars(12)
        self.entry_date.set_placeholder_text("YYYY-MM-DD")
        tb.pack_start(self.entry_date, False, False, 0)
        btn = make_button("🔍 Filtrar")
        btn.connect("clicked", self.load_audit)
        tb.pack_start(btn, False, False, 0)
        self.pack_start(tb, False, False, 0)
        self.store = Gtk.ListStore(str, str, str, str, str)
        self.tv = Gtk.TreeView(model=self.store)
        for i, c in enumerate(["Fecha", "Usuario", "Acción", "Entidad", "Cambios"]):
            cr = Gtk.CellRendererText()
            tv = Gtk.TreeViewColumn(c, cr, text=i)
            tv.set_resizable(True)
            tv.set_expand(True)
            self.tv.append_column(tv)
        self.pack_start(make_scrolled(self.tv), True, True, 0)
        self.load_audit()

    def load_audit(self, *_a):
        path = "/api/audit-log?page=1&limit=100"
        params = []
        u = self.entry_user.get_text().strip()
        a = self.combo_action.get_active_id()
        d = self.entry_date.get_text().strip()
        if u:
            params.append(f"user={urllib.parse.quote(u)}")
        if a and a != "all":
            params.append(f"action={a}")
        if d:
            params.append(f"date={d}")
        if params:
            path += "?" + "&".join(params)
        def task(): return api.get(path)
        def done(r):
            self.store.clear()
            if "error" in r:
                return
            items = r.get("data", r.get("logs", r.get("items", [])))
            if isinstance(items, dict):
                items = items.get("items", [])
            for log in items:
                changes = log.get("changes", log.get("details", ""))
                if isinstance(changes, dict):
                    changes = json.dumps(changes, ensure_ascii=False)[:100]
                self.store.append([
                    fmt_date(log.get("created_at", log.get("date", ""))),
                    log.get("user_name", log.get("user_id", "")),
                    log.get("action", ""),
                    log.get("entity", log.get("entity_type", "")),
                    str(changes)
                ])
        run_in_thread(task, done)


# ── 15. ConfiguracionTab ─────────────────────────────────────────────────────
class ConfiguracionTab(BaseTab):
    def __init__(self):
        super().__init__("⚙ Configuración")
        nb = Gtk.Notebook()
        self.pack_start(nb, True, True, 0)
        biz_page = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        biz_page.set_border_width(12)
        nb.append_page(biz_page, Gtk.Label(label="Negocio"))
        del_page = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        del_page.set_border_width(12)
        nb.append_page(del_page, Gtk.Label(label="Domicilios"))
        wa_page = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        wa_page.set_border_width(12)
        nb.append_page(wa_page, Gtk.Label(label="WhatsApp"))
        self._build_biz(biz_page)
        self._build_delivery(del_page)
        self._build_whatsapp(wa_page)
        self.load_settings()

    def _build_biz(self, page):
        grid = Gtk.Grid()
        grid.set_column_spacing(12)
        grid.set_row_spacing(8)
        self.biz_fields = {}
        for i, (key, lbl) in enumerate([
            ("business_name", "Nombre del Negocio"), ("business_phone", "Teléfono"),
            ("business_email", "Correo"), ("business_address", "Dirección"),
            ("business_city", "Ciudad"), ("business_hours", "Horario"),
            ("business_tagline", "Eslogan"),
        ]):
            grid.attach(Gtk.Label(label=lbl), 0, i, 1, 1)
            e = Gtk.Entry()
            e.set_width_chars(35)
            grid.attach(e, 1, i, 1, 1)
            self.biz_fields[key] = e
        page.pack_start(grid, False, False, 8)
        colors_box = Gtk.Box(spacing=12)
        colors_box.pack_start(Gtk.Label(label="<b>Colores de Marca:</b>"), False, False, 0)
        self.color_primary = Gtk.ColorButton()
        self.color_primary.set_rgba(Gdk.RGBA(0, 0.722, 0.376, 1))
        colors_box.pack_start(self.color_primary, False, False, 0)
        self.color_secondary = Gtk.ColorButton()
        self.color_secondary.set_rgba(Gdk.RGBA(1, 0.549, 0, 1))
        colors_box.pack_start(self.color_secondary, False, False, 0)
        page.pack_start(colors_box, False, False, 8)
        btn = make_button("💾 Guardar Negocio")
        btn.connect("clicked", self.save_biz)
        page.pack_start(btn, False, False, 8)

    def _build_delivery(self, page):
        grid = Gtk.Grid()
        grid.set_column_spacing(12)
        grid.set_row_spacing(8)
        self.del_fields = {}
        for i, (key, lbl) in enumerate([
            ("delivery_fee", "Tarifa Domicilio"), ("delivery_free_min", "Mínimo Envío Gratis"),
            ("delivery_zone", "Zona de Cobertura"),
        ]):
            grid.attach(Gtk.Label(label=lbl), 0, i, 1, 1)
            e = Gtk.Entry()
            e.set_width_chars(35)
            grid.attach(e, 1, i, 1, 1)
            self.del_fields[key] = e
        page.pack_start(grid, False, False, 8)
        btn = make_button("💾 Guardar Domicilios")
        btn.connect("clicked", self.save_delivery)
        page.pack_start(btn, False, False, 8)

    def _build_whatsapp(self, page):
        grid = Gtk.Grid()
        grid.set_column_spacing(12)
        grid.set_row_spacing(8)
        self.wa_fields = {}
        for i, (key, lbl) in enumerate([
            ("whatsapp_enabled", "Habilitado (1/0)"),
            ("whatsapp_business_number", "Número de Negocio"),
            ("whatsapp_access_token", "Access Token"),
            ("whatsapp_phone_id", "Phone ID"),
        ]):
            grid.attach(Gtk.Label(label=lbl), 0, i, 1, 1)
            e = Gtk.Entry()
            e.set_width_chars(40)
            grid.attach(e, 1, i, 1, 1)
            self.wa_fields[key] = e
        page.pack_start(grid, False, False, 8)
        btn = make_button("💾 Guardar WhatsApp")
        btn.connect("clicked", self.save_whatsapp)
        page.pack_start(btn, False, False, 8)

    def load_settings(self):
        def task(): return api.get("/api/settings")
        def done(r):
            if "error" in r:
                return
            d = r.get("data", r)
            for k, e in self.biz_fields.items():
                e.set_text(str(d.get(k, "")))
            for k, e in self.del_fields.items():
                e.set_text(str(d.get(k, "")))
            for k, e in self.wa_fields.items():
                e.set_text(str(d.get(k, "")))
        run_in_thread(task, done)

    def save_biz(self, _b):
        data = {k: e.get_text() for k, e in self.biz_fields.items()}
        def task(): return api.put("/api/settings", data)
        def done(r):
            if "error" in r:
                self.error_snackbar(r["error"])
            else:
                self.show_snackbar("Configuración guardada")
        run_in_thread(task, done)

    def save_delivery(self, _b):
        data = {k: e.get_text() for k, e in self.del_fields.items()}
        def task(): return api.put("/api/settings", data)
        def done(r):
            if "error" in r:
                self.error_snackbar(r["error"])
            else:
                self.show_snackbar("Configuración de domicilios guardada")
        run_in_thread(task, done)

    def save_whatsapp(self, _b):
        data = {k: e.get_text() for k, e in self.wa_fields.items()}
        def task(): return api.put("/api/settings", data)
        def done(r):
            if "error" in r:
                self.error_snackbar(r["error"])
            else:
                self.show_snackbar("Configuración WhatsApp guardada")
        run_in_thread(task, done)


# ── SeguridadTab ─────────────────────────────────────────────────────────────
class SeguridadTab(BaseTab):
    def __init__(self):
        super().__init__("🔒 Seguridad")
        box_pwd = Gtk.Frame(label=" Cambiar Contraseña ")
        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        vbox.set_border_width(12)
        vbox.set_spacing(8)
        self.old_pwd = Gtk.Entry()
        self.old_pwd.set_visibility(False)
        self.old_pwd.set_placeholder_text("Contraseña actual")
        vbox.pack_start(self.old_pwd, False, False, 0)
        self.new_pwd = Gtk.Entry()
        self.new_pwd.set_visibility(False)
        self.new_pwd.set_placeholder_text("Nueva contraseña (mín. 6 caracteres)")
        vbox.pack_start(self.new_pwd, False, False, 0)
        btn_pwd = make_button("🔑 Cambiar Contraseña")
        btn_pwd.connect("clicked", self.change_password)
        vbox.pack_start(btn_pwd, False, False, 8)
        box_pwd.add(vbox)
        self.pack_start(box_pwd, False, False, 0)
        box_api = Gtk.Frame(label=" API ")
        vbox2 = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        vbox2.set_border_width(12)
        self.api_key_lbl = Gtk.Label(label="Cargando...")
        self.api_key_lbl.set_selectable(True)
        vbox2.pack_start(Gtk.Label(label="API Key:"), False, False, 0)
        vbox2.pack_start(self.api_key_lbl, False, False, 0)
        vbox2.pack_start(Gtk.Label(label="Expiración JWT:"), False, False, 0)
        self.jwt_entry = Gtk.Entry()
        self.jwt_entry.set_text("24h")
        vbox2.pack_start(self.jwt_entry, False, False, 0)
        box_api.add(vbox2)
        self.pack_start(box_api, False, False, 0)
        self.load_api_info()

    def change_password(self, _b):
        old = self.old_pwd.get_text()
        new = self.new_pwd.get_text()
        if not old or not new:
            self.error_snackbar("Complete ambos campos")
            return
        def task(): return api.post("/api/auth/change-password", {"old_password": old, "new_password": new})
        def done(r):
            if "error" in r:
                self.error_snackbar(r["error"])
            else:
                self.show_snackbar("Contraseña actualizada")
                self.old_pwd.set_text("")
                self.new_pwd.set_text("")
        run_in_thread(task, done)

    def load_api_info(self):
        def task(): return api.get("/api/settings")
        def done(r):
            if "error" not in r:
                d = r.get("data", r)
                self.api_key_lbl.set_text(d.get("api_key", "No configurada"))
                jwt = d.get("jwt_expires_in", "24h")
                self.jwt_entry.set_text(str(jwt))
        run_in_thread(task, done)


# ── LogsTab ──────────────────────────────────────────────────────────────────
class LogsTab(BaseTab):
    def __init__(self):
        super().__init__("📜 Logs")
        tb = Gtk.Box(spacing=8)
        btn = make_button("🔄 Actualizar")
        btn.connect("clicked", self.load_logs)
        tb.pack_start(btn, False, False, 0)
        self.pack_start(tb, False, False, 0)
        self.text = Gtk.TextView()
        self.text.set_editable(False)
        self.text.set_monospace(True)
        self.text.get_buffer().create_tag("red", foreground="red")
        self.text.get_buffer().create_tag("green", foreground="green")
        self.text.get_buffer().create_tag("yellow", foreground="#b8860b")
        self.pack_start(make_scrolled(self.text), True, True, 0)
        self.load_logs()
        GLib.timeout_add(10000, self.load_logs)

    def load_logs(self, *_a):
        def task():
            try:
                r = subprocess.run(
                    ["journalctl", "-u", "supermercados-go", "-n", "100", "--no-pager"],
                    capture_output=True, text=True, timeout=5)
                if r.returncode == 0:
                    return r.stdout
                return f"(journalctl no disponible: {r.stderr.strip()})"
            except FileNotFoundError:
                return "(journalctl no está disponible en este sistema)"
            except Exception as e:
                return f"(Error: {e})"
        def done(text):
            buf = self.text.get_buffer()
            buf.set_text(text)
        run_in_thread(task, done)
        return True


# ── ImportTab ─────────────────────────────────────────────────────────────────
class ImportTab(BaseTab):
    def __init__(self):
        super().__init__("📥 Importar Productos")
        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
        vbox.set_border_width(16)
        lbl_info = Gtk.Label()
        lbl_info.set_markup(
            "<b>Importador inteligente de productos desde Excel</b>\n\n"
            "· Arrastre o seleccione un archivo Excel (.xlsx, .xls)\n"
            "· El sistema detectara automaticamente las columnas\n"
            "· Crea categorías nuevas si no existen\n"
            "· Detecta duplicados por SKU, codigo de barras o nombre\n"
        )
        vbox.pack_start(lbl_info, False, False, 0)

        # File chooser
        hbox_file = Gtk.Box(spacing=8)
        lbl_file = Gtk.Label(label="Archivo Excel:")
        self.file_entry = Gtk.Entry()
        self.file_entry.set_editable(False)
        self.file_entry.set_placeholder_text("Seleccione un archivo .xlsx o .xls")
        btn_file = make_button("📂 Examinar")
        btn_file.connect("clicked", self.choose_file)
        hbox_file.pack_start(lbl_file, False, False, 0)
        hbox_file.pack_start(self.file_entry, True, True, 0)
        hbox_file.pack_start(btn_file, False, False, 0)
        vbox.pack_start(hbox_file, False, False, 0)

        # Buttons
        hbox_btns = Gtk.Box(spacing=8)
        btn_preview = make_button("🔍 Vista Previa")
        btn_preview.connect("clicked", self.do_preview)
        btn_import = make_button("📥 Importar Productos", "btn-warning")
        btn_import.connect("clicked", self.do_import)
        hbox_btns.pack_start(btn_preview, False, False, 0)
        hbox_btns.pack_start(btn_import, False, False, 0)
        vbox.pack_start(hbox_btns, False, False, 0)

        # Results area
        self.result_label = Gtk.Label(label="")
        self.result_label.set_selectable(True)
        self.result_label.set_xalign(0)
        sw = Gtk.ScrolledWindow()
        sw.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
        sw.set_min_content_height(300)
        sw.add(self.result_label)
        vbox.pack_start(sw, True, True, 0)

        self.pack_start(vbox, True, True, 0)

    def choose_file(self, btn):
        dlg = Gtk.FileChooserDialog(
            title="Seleccionar archivo Excel",
            action=Gtk.FileChooserAction.OPEN,
            transient_for=self.get_toplevel(),
            modal=True,
        )
        dlg.add_button("Cancelar", Gtk.ResponseType.CANCEL)
        dlg.add_button("Abrir", Gtk.ResponseType.OK)

        filtro = Gtk.FileFilter()
        filtro.set_name("Archivos Excel")
        filtro.add_pattern("*.xlsx")
        filtro.add_pattern("*.xls")
        dlg.add_filter(filtro)

        dlg.set_current_folder(os.path.expanduser("~/Descargas"))
        if dlg.run() == Gtk.ResponseType.OK:
            self.file_entry.set_text(dlg.get_filename())
        dlg.destroy()

    def do_preview(self, btn):
        path = self.file_entry.get_text()
        if not path:
            self.error_snackbar("Seleccione un archivo Excel primero")
            return
        self.result_label.set_markup("<i>Analizando archivo...</i>")

        def task():
            url = f"{BASE_URL}/api/products/preview-excel"
            boundary = "----SupermercadosGoBoundary"
            import mimetypes
            content_type = "multipart/form-data; boundary=" + boundary

            with open(path, "rb") as f:
                file_data = f.read()

            filename = os.path.basename(path)
            body = b"--" + boundary.encode() + b"\r\n"
            body += b'Content-Disposition: form-data; name="file"; filename="' + filename.encode() + b'"\r\n'
            body += b"Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n"
            body += file_data + b"\r\n"
            body += b"--" + boundary.encode() + b"--\r\n"

            req = urllib.request.Request(url, data=body, headers={
                "Content-Type": content_type,
                "Authorization": f"Bearer {api.token}"
            }, method="POST")

            try:
                resp = urllib.request.urlopen(req, timeout=30)
                return json.loads(resp.read().decode())
            except Exception as e:
                return {"error": str(e)}

        def done(r):
            if "error" in r:
                self.result_label.set_markup(f'<b>Error:</b> {r["error"]}')
                return
            text = "<b>Vista Previa del Archivo:</b>\n"
            text += '<span color="#009a53"><b>✓ Totales:</b> %d filas detectadas</span>\n' % r.get("total_rows", 0)
            text += '<b>Columnas mapeadas:</b>\n'
            mapping = r.get("mapping", {})
            for k, v in mapping.items():
                text += f"  · {k} → {v}\n"
            sample = r.get("sample", [])
            if sample:
                text += "\n<b>Muestra de primeros productos:</b>\n"
                for idx, s in enumerate(sample):
                    name = s.get("name", "")
                    price = s.get("price", "")
                    cat = s.get("category_id", "")
                    sku = s.get("sku", "")
                    text += f"  {idx+1}. {name} | ${price} | {cat} | SKU: {sku}\n"
            self.result_label.set_markup(text)
        run_in_thread(task, done)

    def do_import(self, btn):
        path = self.file_entry.get_text()
        if not path:
            self.error_snackbar("Seleccione un archivo Excel primero")
            return
        self.result_label.set_markup("<b>Importando productos...</b>")

        def task():
            url = f"{BASE_URL}/api/products/import-excel"
            boundary = "----SupermercadosGoImport"
            filename = os.path.basename(path)

            with open(path, "rb") as f:
                file_data = f.read()

            body = b"--" + boundary.encode() + b"\r\n"
            body += b'Content-Disposition: form-data; name="file"; filename="' + filename.encode() + b'"\r\n'
            body += b"Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n"
            body += file_data + b"\r\n"
            body += b"--" + boundary.encode() + b"--\r\n"

            req = urllib.request.Request(url, data=body, headers={
                "Content-Type": "multipart/form-data; boundary=" + boundary,
                "Authorization": f"Bearer {api.token}"
            }, method="POST")

            try:
                resp = urllib.request.urlopen(req, timeout=60)
                return json.loads(resp.read().decode())
            except Exception as e:
                return {"error": str(e)}

        def done(r):
            if "error" in r:
                self.result_label.set_markup(f'<b><span color="red">Error:</span></b> {r["error"]}')
                return
            results = r.get("results", r)
            text = f'<b><span color="green"> Importacion completada!</span></b>\n\n'
            text += f'<b>Creados:</b> {results.get("created", 0)}\n'
            text += f'<b>Actualizados:</b> {results.get("updated", 0)}\n'
            text += f'<b>Omitidos:</b> {results.get("skipped", 0)}\n'
            text += f'<b>Total procesado:</b> {results.get("total", 0)}\n\n'
            text += f'<b>Mapeo usado:</b>\n'
            mapping = results.get("mapping", {})
            for k, v in mapping.items():
                text += f"  · {k} → {v}\n"
            errors = results.get("errors", [])
            if errors:
                text += f'\n<b><span color="#e74c3c">Errores ({len(errors)}):</span></b>\n'
                for e in errors[:15]:
                    text += f"  · {e}\n"
                if len(errors) > 15:
                    text += f"  ... y {len(errors) - 15} mas\n"
            self.result_label.set_markup(text)
            self.show_snackbar("Importacion completada!")
        box = self.get_children()[0]
        # add result label
        for ch in box.get_children():
            if isinstance(ch, Gtk.ScrolledWindow):
                child = ch.get_child()
                if isinstance(child, Gtk.Label):
                    self.result_label = child
        run_in_thread(task, done)


# ── Main Window ──────────────────────────────────────────────────────────────
class MainWindow(Gtk.ApplicationWindow):
    def __init__(self, app=None):
        super().__init__(application=app, title="Supermercados Go — Panel de Administración")
        self.set_default_size(1200, 750)
        self.set_position(Gtk.WindowPosition.CENTER)
        self.apply_css()
        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        self.banner = Gtk.Label()
        self.banner.set_no_show_all(True)
        vbox.pack_start(self.banner, False, False, 0)
        header = Gtk.Box()
        header.get_style_context().add_class("header-bar")
        header.set_spacing(12)
        header.set_border_width(8)
        title_lbl = Gtk.Label()
        title_lbl.set_markup('<span color="white" size="x-large"><b>🛒 Supermercados Go</b></span>')
        header.pack_start(title_lbl, False, False, 0)
        info_lbl = Gtk.Label()
        info_lbl.set_markup(f'<span color="white" size="small">Cúcuta | +57 3044016277 | KDX 1-2B Los Mangos | 6AM-6PM</span>')
        header.pack_start(info_lbl, False, False, 12)
        header.pack_end(Gtk.Label(), True, True, 0)
        btn_logout = Gtk.Button(label="🔒 Salir")
        btn_logout.connect("clicked", self.do_logout)
        header.pack_end(btn_logout, False, False, 0)
        vbox.pack_start(header, False, False, 0)
        self.notebook = Gtk.Notebook()
        self.notebook.set_scrollable(True)
        tabs = [
            MonitoreoTab, PedidosTab, VentasTab, EmpleadosTab, ProductosTab,
            ImportTab, UsuariosTab, InventarioTab, KardexTab, ComprasTab, FacturacionTab,
            CajaTab, ReportesTab, PromocionesTab, AuditoriaTab, ConfiguracionTab,
            SeguridadTab, LogsTab,
        ]
        for tab_cls in tabs:
            tab = tab_cls()
            lbl = Gtk.Label(label=tab.title)
            lbl.set_use_markup(True)
            self.notebook.append_page(tab, lbl)
        vbox.pack_start(self.notebook, True, True, 0)
        self.status_bar = Gtk.Label()
        self.status_bar.set_markup(f'<span size="small" color="#666">Servidor: {BASE_URL}</span>')
        vbox.pack_start(self.status_bar, False, False, 4)
        self.add(vbox)
        self.show_all()
        self.check_connection()
        GLib.timeout_add(15000, self.check_connection)

    def apply_css(self):
        provider = Gtk.CssProvider()
        provider.load_from_data(CSS.encode())
        Gtk.StyleContext.add_provider_for_screen(
            Gdk.Screen.get_default(), provider, Gtk.STYLE_PROVIDER_PRIORITY_USER)

    def check_connection(self):
        def task(): return api.get("/api/health", timeout=3)
        def done(r):
            if "error" in r:
                self.banner.set_no_show_all(False)
                self.banner.show()
                self.banner.get_style_context().add_class("banner-disconnected")
                self.banner.set_label("⚠ SIN CONEXIÓN AL SERVIDOR")
            else:
                self.banner.hide()
        run_in_thread(task, done)
        return True

    def do_logout(self, _b):
        api.token = None
        self.destroy()
        dlg = LoginDialog()
        dlg.run()
        dlg.destroy()
        if api.token:
            win = MainWindow()
            win.show_all()
            Gtk.main()
        else:
            Gtk.main_quit()


# ── Application ──────────────────────────────────────────────────────────────
class App(Gtk.Application):
    def __init__(self):
        super().__init__(application_id="com.supermercadosgo.dashboard")

    def do_activate(self):
        api.on_401 = self._on_401
        dlg = LoginDialog()
        dlg.run()
        dlg.destroy()
        if api.token:
            win = MainWindow(application=self)
            win.show_all()
        else:
            self.quit()

    def _on_401(self):
        self.quit()


def main():
    app = App()
    app.run()


if __name__ == "__main__":
    main()
