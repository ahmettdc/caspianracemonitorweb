"""Basit arayüz (tkinter) — config'i formdan gir, Kaydet & Başlat.
Not Defteri gerekmez. Konsol/CLI (--selftest, --dump) ayrıca çalışır.

v2.2 — arayüz yeniden tasarımı (handoff 1b/1c): kartlı kurulum akışı
(01 Hesap → 02 Yayın Hedefi → 03 Gönderim), canlı görünüm (durum şeridi +
metrik kartları + günlük), varsayılan dil İngilizce + sağ üstte EN/TR.
Tasarımın frameless penceresi yerine native çerçeve korunur (sürükleme /
küçültme / tepsiye inme güvenilir çalışsın); istemci alanı birebir tasarım
diline getirildi. Tüm mevcut işlevler korunur (Google giriş, takım/yarış,
Hz, Kaydet & Başlat / Durdur, Self-Test, Log, tepsi, Race Engineer'a Dön)."""
import configparser
import os
import sys
import threading
import time
import tkinter as tk
import tkinter.font as tkfont
from tkinter import messagebox

from fb import FirebaseClient
from main import make_source, build_payload, lower_priority, start_harvester, apply_harvest
from logfile import get_logger, heartbeat_line, log_path, parent_app_path

API_KEY = "AIzaSyB9hEH26etwvn9adAGNOpPAlpUym1qzpns"
DB_URL = "https://caspian-race-control-default-rtdb.europe-west1.firebasedatabase.app"

# Sürüm rozeti (tasarımdaki değer — web uygulamasının ürün sürümü).
BADGE_VERSION = "v2.1.2"

# --- Tasarım tokenları (handoff · web uygulaması + gui ile ortak) ---
WIN = "#120C0E"      # pencere arkaplanı
DEEP = "#150E10"     # girdi/derin alan
CARD = "#1E1418"     # kart
CONSOLE = "#0B0708"  # günlük konsolu
BORDER = "#2A2023"   # kart/girdi kenarlığı
BORDER2 = "#241A1E"  # ince ayraç
INK = "#F3EAEC"      # ana metin
DIM = "#B199A0"      # ikincil metin
BRAND = "#960018"    # marka bürgündi
GOOD = "#37D67A"     # durum: iyi
WARN = "#F5B23D"     # durum: uyarı
BAD = "#FF4D5E"      # durum: hata
LIVE_BG = "#141814"      # canlı şeridi ~ rgba(55,214,122,.06) / WIN
LIVE_BORDER = "#1B3E29"  # canlı şeridi kenarlığı ~ rgba(55,214,122,.25)

# geriye dönük takma adlar (tepsi görseli vb.)
BG = DEEP
BG2 = CARD


def _hide_console():
    """Windows'ta GUI modunda konsol penceresini gizle (varsa). --noconsole derlemede
    zaten konsol yok (GetConsoleWindow → 0) → no-op; console derlemede yedek."""
    try:
        import ctypes
        h = ctypes.windll.kernel32.GetConsoleWindow()
        if h:
            ctypes.windll.user32.ShowWindow(h, 0)  # SW_HIDE
    except Exception:  # noqa: BLE001
        pass


def _tray_image():
    """Tepsi ikonu için küçük marka görseli (Pillow). Asset gerekmez — çizilir."""
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (64, 64), BG)
    d = ImageDraw.Draw(img)
    d.ellipse((10, 10, 54, 54), fill=BRAND)      # bürgündi daire
    d.ellipse((24, 24, 40, 40), fill=INK)         # iç nokta
    return img


def _logo_paths():
    """Logo (assets/logo.png) için aday yollar: exe yanı / PyInstaller _MEIPASS /
    repo public dizini. İlk bulunanı döndürür; yoksa None."""
    cands = []
    base = getattr(sys, "_MEIPASS", None)
    if base:
        cands += [os.path.join(base, "assets", "logo.png"),
                  os.path.join(base, "logo.png")]
    here = os.path.dirname(os.path.abspath(__file__))
    cands += [
        os.path.join(os.path.dirname(sys.executable), "assets", "logo.png"),
        os.path.join(here, "assets", "logo.png"),
        os.path.join(here, "..", "public", "assets", "logo.png"),
    ]
    for p in cands:
        try:
            if p and os.path.exists(p):
                return p
        except Exception:  # noqa: BLE001
            pass
    return None


class BridgeGUI:
    def __init__(self, root, config_path):
        self.root = root
        self.cfg = config_path
        self.stop_evt = threading.Event()
        self.worker = None
        self.tray = None          # sistem tepsisi ikonu (pystray) — lazy
        self.tray_hinted = False  # "tepside çalışıyor" bildirimi bir kez

        self.lang = "en"          # varsayılan dil İngilizce (config'ten ezilebilir)
        self.running = False      # canlı görünüm mü kurulum mu
        self.adv_open = False     # bot hesabı / CLI alanları açık mı

        self.vars = {k: tk.StringVar() for k in
                     ("email", "password", "team_id", "race_id", "hz")}
        self.vars["hz"].set("2")
        # §2.1/2.2: REST HEP AÇIK (toggle yok), Mock kutusu yok, REST yenileme 3 sn SABİT
        # (§2.3). Donma kökten çözüldü (v1.4.140 fetch-once) → REST'i kapatmaya gerek yok.
        self.parent_app = self._read_parent_app()   # §2.5 Race Engineer'a Dön (masaüstü açtıysa)
        # Google oturumu (bot yerine kendi hesabın) + takım/yarış listeleri
        self.refresh_token = ""
        self.google_email = ""
        self.google_uid = ""
        self.teams = {}   # görünen ad -> tid
        self.races = {}   # görünen etiket -> rid
        self.team_label = tk.StringVar(value="—")
        self.race_label = tk.StringVar(value="—")

        # canlı metrik değişkenleri (1c metrik kartları)
        self.m_cars = tk.StringVar(value="—")
        self.m_fuel = tk.StringVar(value="—")
        self.m_laps = tk.StringVar(value="—")
        self.m_lat = tk.StringVar(value="—")
        self.live_sub = tk.StringVar(value="—")

        root.title("Caspian Live Bridge")
        root.geometry("520x640")
        root.minsize(520, 600)
        root.configure(bg=WIN)

        # yazı tipleri: tasarım (Rajdhani / IBM Plex Mono / Inter) yoksa güvenli yedek
        fam = {f.lower(): f for f in tkfont.families(root)}

        def pick(cands, default):
            for c in cands:
                if c.lower() in fam:
                    return fam[c.lower()]
            return default
        self.f_display = pick(["Rajdhani", "Segoe UI Semibold"], "Segoe UI")
        self.f_mono = pick(["IBM Plex Mono", "Consolas", "Cascadia Mono"], "Consolas")
        self.f_body = pick(["Inter", "Segoe UI"], "Segoe UI")

        self.lg = get_logger()
        self._preload_config_lang()   # dil tercihini erken oku (arayüzü doğru dille kur)

        # kabuk: başlık şeridi + gövde
        self._logo_img = None
        self._build_header(root)
        self.body = tk.Frame(root, bg=WIN)
        self.body.pack(fill="both", expand=True)
        self.setup_frame = None
        self.live_frame = None
        self._build_body()

        self.load()
        self.log(self.L(f"Log file: {log_path()}", f"Log dosyası: {log_path()}"))
        root.protocol("WM_DELETE_WINDOW", self.on_close)
        self._init_tray()

    # ---------- i18n ----------
    def L(self, en, tr):
        """Anlık dile göre metin seç (tek seferlik günlük/durum satırları için)."""
        return tr if self.lang == "tr" else en

    def _preload_config_lang(self):
        """Arayüzü kurmadan önce yalnız [ui] lang'ı oku (varsa)."""
        try:
            if os.path.exists(self.cfg):
                cp = configparser.ConfigParser()
                cp.read(self.cfg, encoding="utf-8")
                if cp.has_section("ui"):
                    lg = cp["ui"].get("lang", "en").strip().lower()
                    if lg in ("en", "tr"):
                        self.lang = lg
        except Exception:  # noqa: BLE001
            pass

    def set_lang(self, lang):
        if lang == self.lang:
            return
        self.lang = lang
        try:
            self.save()   # tercihi kalıcı yaz ([ui] lang)
        except Exception:  # noqa: BLE001
            pass
        self._relayout()

    # ---------- kabuk / başlık ----------
    def _make_logo(self, parent, size=22):
        """assets/logo.png'yi yükle; yoksa marka dairesi çiz (tepsi ikonuyla aynı dil)."""
        p = _logo_paths()
        if p:
            try:
                img = tk.PhotoImage(file=p)
                # kabaca hedef boyuta indir (yalnız tam kat küçültme mümkün)
                w = img.width()
                if w > size:
                    img = img.subsample(max(1, round(w / size)))
                self._logo_img = img
                return tk.Label(parent, image=img, bg=WIN)
            except Exception:  # noqa: BLE001
                pass
        cv = tk.Canvas(parent, width=size, height=size, bg=WIN, highlightthickness=0)
        pad = max(1, size // 8)
        cv.create_oval(pad, pad, size - pad, size - pad, fill=BRAND, outline="")
        c = size // 2
        r = size // 5
        cv.create_oval(c - r, c - r, c + r, c + r, fill=INK, outline="")
        return cv

    def _build_header(self, root):
        bar = tk.Frame(root, bg=WIN, height=44)
        bar.pack(fill="x")
        bar.pack_propagate(False)
        inner = tk.Frame(bar, bg=WIN)
        inner.pack(fill="both", expand=True, padx=(14, 8))
        sep = tk.Frame(root, bg=BORDER2, height=1)
        sep.pack(fill="x")

        self._make_logo(inner, 22).pack(side="left", pady=11)
        brand = tk.Frame(inner, bg=WIN)
        brand.pack(side="left", padx=(10, 0))
        tk.Label(brand, text="CASPIAN ", bg=WIN, fg=INK,
                 font=(self.f_display, 15, "bold")).pack(side="left")
        tk.Label(brand, text="LIVE BRIDGE", bg=WIN, fg=DIM,
                 font=(self.f_display, 15, "bold")).pack(side="left")

        # sağ blok: EN/TR + sürüm rozeti
        right = tk.Frame(inner, bg=WIN)
        right.pack(side="right")
        tk.Label(right, text=BADGE_VERSION, bg=CARD, fg=DIM,
                 font=(self.f_mono, 9), padx=6, pady=1).pack(side="right", padx=(8, 0))
        seg = tk.Frame(right, bg=BORDER, highlightbackground=BORDER,
                       highlightthickness=1)
        seg.pack(side="right")
        self.en_lbl = tk.Label(seg, text="EN", font=(self.f_mono, 9, "bold"),
                               padx=7, pady=1, cursor="hand2")
        self.en_lbl.pack(side="left")
        self.en_lbl.bind("<Button-1>", lambda _e: self.set_lang("en"))
        self.tr_lbl = tk.Label(seg, text="TR", font=(self.f_mono, 9, "bold"),
                               padx=7, pady=1, cursor="hand2")
        self.tr_lbl.pack(side="left")
        self.tr_lbl.bind("<Button-1>", lambda _e: self.set_lang("tr"))
        self._paint_lang_seg()

    def _paint_lang_seg(self):
        tr = self.lang == "tr"
        self.en_lbl.config(bg=(CARD if tr else BRAND), fg=(DIM if tr else "white"))
        self.tr_lbl.config(bg=(BRAND if tr else CARD), fg=("white" if tr else DIM))

    # ---------- gövde (kurulum + canlı) ----------
    def _build_body(self):
        self.setup_frame = tk.Frame(self.body, bg=WIN)
        self.live_frame = tk.Frame(self.body, bg=WIN)
        self._build_setup(self.setup_frame)
        self._build_live(self.live_frame)
        if self.running:
            self._show_live()
        else:
            self._show_setup()

    def _relayout(self):
        """Dil değişince gövdeyi ve şeridi yeniden çiz (durum korunur)."""
        self._paint_lang_seg()
        for f in (self.setup_frame, self.live_frame):
            if f is not None:
                f.destroy()
        self._build_body()
        # login durumunu ve metrikleri geri uygula
        self._render_login_state()
        if self.teams:
            self._fill_team_menu()
        if self.races:
            self._fill_race_menu()

    def _show_setup(self):
        self.running = False
        self.live_frame.pack_forget()
        self.setup_frame.pack(fill="both", expand=True)

    def _show_live(self):
        self.running = True
        self.setup_frame.pack_forget()
        self.live_frame.pack(fill="both", expand=True)

    def _card(self, parent):
        return tk.Frame(parent, bg=CARD, highlightbackground=BORDER,
                        highlightcolor=BORDER, highlightthickness=1)

    def _step_head(self, card, num, title):
        row = tk.Frame(card, bg=CARD)
        row.pack(fill="x", padx=14, pady=(14, 0))
        tk.Label(row, text=num, bg=CARD, fg=BRAND,
                 font=(self.f_display, 13, "bold")).pack(side="left")
        tk.Label(row, text=title, bg=CARD, fg=INK,
                 font=(self.f_display, 11, "bold")).pack(side="left", padx=(10, 0))
        return row

    def _build_setup(self, root):
        wrap = tk.Frame(root, bg=WIN)
        wrap.pack(fill="both", expand=True, padx=16, pady=(16, 0))

        # ---- 01 HESAP ----
        c1 = self._card(wrap)
        c1.pack(fill="x", pady=(0, 12))
        head = self._step_head(c1, "01", self.L("ACCOUNT", "HESAP"))
        # oturum durumu (sağ üst): yeşil nokta + e-posta
        self.acc_state = tk.Frame(head, bg=CARD)
        self.acc_state.pack(side="right")
        self.acc_dot = tk.Label(self.acc_state, text="●", bg=CARD, fg=GOOD,
                                font=(self.f_body, 9))
        self.acc_dot.pack(side="left")
        self.google_lbl = tk.Label(self.acc_state, text="", bg=CARD, fg=GOOD,
                                   font=(self.f_mono, 9))
        self.google_lbl.pack(side="left", padx=(6, 0))

        body = tk.Frame(c1, bg=CARD)
        body.pack(fill="x", padx=14, pady=(10, 0))
        self.acc_desc = tk.Label(
            body, bg=CARD, fg=DIM, font=(self.f_body, 9), justify="left",
            wraplength=330, anchor="w",
            text=self.L("You write with your own Google account — no bot account "
                        "needed. An engineer (editor) or owner role on the team is enough.",
                        "Kendi Google hesabınla yazarsın — bot hesabı gerekmez. "
                        "Takımda mühendis (editor) ya da sahip rolü yeterli."))
        self.acc_desc.pack(side="left", fill="x", expand=True)
        # oturumluyken "Hesap değiştir", oturumsuzken büyük giriş düğmesi
        self.change_btn = tk.Button(
            body, text=self.L("Change account", "Hesap değiştir"),
            command=self.google_login, bg=BORDER, fg=INK, relief="flat",
            padx=12, pady=6, font=(self.f_body, 9), cursor="hand2")
        self.google_btn = tk.Button(
            c1, text=self.L("🔐 Google Sign-In", "🔐 Google ile Giriş"),
            command=self.google_login, bg=BRAND, fg="white", relief="flat",
            pady=9, font=(self.f_display, 12, "bold"), cursor="hand2")

        # bot hesabı / CLI linki + katlanır alanlar
        self.bot_link = tk.Label(
            c1, text=self.L("Bot account / CLI setup ▸", "Bot hesabı / CLI kurulumu ▸"),
            bg=CARD, fg=WARN, font=(self.f_body, 9), cursor="hand2")
        self.bot_link.pack(anchor="w", padx=14, pady=(10, 0))
        self.bot_link.bind("<Button-1>", lambda _e: self.toggle_adv())
        self.adv_frame = tk.Frame(c1, bg=CARD)
        self._field_in(self.adv_frame, self.L("Bot email", "Bot e-posta"), "email")
        self._field_in(self.adv_frame, self.L("Bot password", "Bot parola"), "password", show="*")
        self._field_in(self.adv_frame, "team_id", "team_id")
        self._field_in(self.adv_frame, "race_id", "race_id")
        tk.Frame(c1, bg=CARD, height=14).pack()   # alt boşluk
        if self.adv_open:
            self.adv_frame.pack(fill="x", after=self.bot_link)

        # ---- 02 YAYIN HEDEFİ ----
        c2 = self._card(wrap)
        c2.pack(fill="x", pady=(0, 12))
        self._step_head(c2, "02", self.L("BROADCAST TARGET", "YAYIN HEDEFİ"))
        row = tk.Frame(c2, bg=CARD)
        row.pack(fill="x", padx=14, pady=(10, 14))
        tcol = tk.Frame(row, bg=CARD)
        tcol.pack(side="left", fill="x", expand=True)
        tk.Label(tcol, text=self.L("Team", "Takım"), bg=CARD, fg=DIM,
                 font=(self.f_body, 8)).pack(anchor="w")
        self.team_menu = self._option(tcol, self.team_label)
        self.team_menu.pack(fill="x", pady=(4, 0))
        rcol = tk.Frame(row, bg=CARD)
        rcol.pack(side="left", fill="x", expand=True, padx=(10, 0))
        tk.Label(rcol, text=self.L("Race", "Yarış"), bg=CARD, fg=DIM,
                 font=(self.f_body, 8)).pack(anchor="w")
        self.race_menu = self._option(rcol, self.race_label)
        self.race_menu.pack(fill="x", pady=(4, 0))

        # ---- 03 GÖNDERİM ----
        c3 = self._card(wrap)
        c3.pack(fill="x", pady=(0, 12))
        head3 = self._step_head(c3, "03", self.L("TRANSMISSION", "GÖNDERİM"))
        seg = tk.Frame(head3, bg=DEEP, highlightbackground=BORDER, highlightthickness=1)
        seg.pack(side="right")
        self.hz_segs = {}
        for hz in ("1", "2", "5"):
            lb = tk.Label(seg, text=f"{hz} Hz", font=(self.f_mono, 10),
                          padx=13, pady=4, cursor="hand2")
            lb.pack(side="left")
            lb.bind("<Button-1>", lambda _e, h=hz: self._pick_hz(h))
            self.hz_segs[hz] = lb
        tk.Label(c3, bg=CARD, fg=DIM, font=(self.f_body, 9), justify="left",
                 anchor="w", wraplength=460,
                 text=self.L("⚡ REST on · background fixed at 3 s · low priority — no game stutter",
                             "⚡ REST açık · arka plan 3 sn sabit · düşük öncelik — oyun donmaz")
                 ).pack(fill="x", padx=14, pady=(10, 14))
        self._paint_hz()

        # ---- eylem satırı ----
        act = tk.Frame(wrap, bg=WIN)
        act.pack(fill="x", pady=(0, 8))
        self.start_btn = tk.Button(
            act, text=self.L("SAVE & START", "KAYDET & BAŞLAT"), command=self.toggle,
            bg=BRAND, fg="white", relief="flat", pady=12,
            font=(self.f_display, 13, "bold"), cursor="hand2")
        self.start_btn.pack(side="left", fill="x", expand=True)
        tk.Button(act, text="Self-Test", command=self.selftest, bg=CARD, fg=INK,
                  relief="flat", padx=14, pady=11, font=(self.f_body, 9),
                  highlightbackground=BORDER, highlightthickness=1,
                  cursor="hand2").pack(side="left", padx=(10, 0))
        tk.Button(act, text=self.L("📄 Log", "📄 Log"), command=self.open_log, bg=CARD,
                  fg=INK, relief="flat", padx=14, pady=11, font=(self.f_body, 9),
                  highlightbackground=BORDER, highlightthickness=1,
                  cursor="hand2").pack(side="left", padx=(10, 0))

        # §2.5: masaüstü Race Monitor'dan açıldıysa geri dön linki
        if self.parent_app:
            back = tk.Label(
                wrap, fg=WARN, bg=WIN, font=(self.f_body, 9), cursor="hand2",
                text=self.L("🏎 Back to Race Engineer — close bridge, open desktop app",
                            "🏎 Race Engineer'a Dön — köprüyü kapat, masaüstü uygulamayı aç"))
            back.pack(anchor="e", pady=(0, 6))
            back.bind("<Button-1>", lambda _e: self.back_to_engineer())

        # durum satırı (küçük)
        self.status = tk.Label(wrap, text=self.L("Ready", "Hazır"), bg=WIN, fg=DIM,
                               anchor="w", font=(self.f_body, 9))
        self.status.pack(fill="x")

        # ---- günlük paneli ----
        self.setup_log = self._log_panel(wrap)
        self.setup_log.pack(fill="both", expand=True, pady=(8, 16))
        self._render_login_state()

    def _build_live(self, root):
        wrap = tk.Frame(root, bg=WIN)
        wrap.pack(fill="both", expand=True, padx=16, pady=16)

        # canlı durum şeridi
        strip = tk.Frame(wrap, bg=LIVE_BG, highlightbackground=LIVE_BORDER,
                         highlightthickness=1)
        strip.pack(fill="x", pady=(0, 12))
        inner = tk.Frame(strip, bg=LIVE_BG)
        inner.pack(fill="x", padx=14, pady=12)
        tk.Label(inner, text="●", bg=LIVE_BG, fg=GOOD,
                 font=(self.f_body, 12)).pack(side="left")
        txt = tk.Frame(inner, bg=LIVE_BG)
        txt.pack(side="left", fill="x", expand=True, padx=(10, 0))
        tk.Label(txt, text=self.L("STREAMING LIVE", "CANLI GÖNDERİLİYOR"), bg=LIVE_BG,
                 fg=GOOD, font=(self.f_display, 14, "bold")).pack(anchor="w")
        tk.Label(txt, textvariable=self.live_sub, bg=LIVE_BG, fg=DIM,
                 font=(self.f_mono, 9)).pack(anchor="w")
        tk.Button(inner, text=self.L("STOP", "DURDUR"), command=self.toggle,
                  bg=CARD, fg=BAD, relief="flat", padx=18, pady=8,
                  font=(self.f_display, 11, "bold"),
                  highlightbackground=BAD, highlightthickness=1,
                  cursor="hand2").pack(side="right")

        # metrik kartları (4 sütun)
        grid = tk.Frame(wrap, bg=WIN)
        grid.pack(fill="x", pady=(0, 12))
        cards = [
            (self.L("CARS", "ARAÇ"), self.m_cars, INK),
            (self.L("FUEL / VE", "YAKIT / VE"), self.m_fuel, INK),
            (self.L("📼 LAPS", "📼 TUR"), self.m_laps, INK),
            (self.L("LATENCY", "GECİKME"), self.m_lat, GOOD),
        ]
        for i, (lbl, var, col) in enumerate(cards):
            grid.columnconfigure(i, weight=1, uniform="m")
            mc = tk.Frame(grid, bg=CARD, highlightbackground=BORDER, highlightthickness=1)
            mc.grid(row=0, column=i, sticky="nsew", padx=(0 if i == 0 else 5, 0))
            tk.Label(mc, text=lbl, bg=CARD, fg=DIM, anchor="w",
                     font=(self.f_display, 8, "bold")).pack(fill="x", padx=12, pady=(10, 0))
            v = tk.Label(mc, textvariable=var, bg=CARD, fg=col, anchor="w",
                         font=(self.f_mono, 16, "bold"))
            v.pack(fill="x", padx=12, pady=(0, 10))
            if lbl.endswith(("LATENCY", "GECİKME")):
                self.lat_value = v

        # hedef özeti
        tgt = tk.Frame(wrap, bg=CARD, highlightbackground=BORDER, highlightthickness=1)
        tgt.pack(fill="x", pady=(0, 12))
        self.tgt_lbl = tk.Label(tgt, bg=CARD, fg=INK, anchor="w", font=(self.f_body, 9))
        self.tgt_lbl.pack(side="left", padx=12, pady=10)
        chg = tk.Label(tgt, text=self.L("Change ▸", "Değiştir ▸"), bg=CARD, fg=DIM,
                       font=(self.f_body, 9), cursor="hand2")
        chg.pack(side="right", padx=12)
        chg.bind("<Button-1>", lambda _e: (self.stop_evt.set(), self._show_setup()))
        self._render_target()

        # günlük paneli (canlı)
        self.live_log = self._log_panel(wrap)
        self.live_log.pack(fill="both", expand=True, pady=(0, 12))

        # tepsi notu
        note = tk.Frame(wrap, bg=WIN)
        note.pack(fill="x")
        tk.Label(note, text="●", bg=WIN, fg=WARN, font=(self.f_body, 8)).pack(side="left")
        tk.Label(note, bg=WIN, fg=DIM, font=(self.f_body, 9), justify="left",
                 wraplength=440, anchor="w",
                 text=self.L("After the first frame is sent, the window minimizes to the "
                             "tray — streaming continues in the background.",
                             "İlk kare gönderilince pencere tepsiye iner — yayın arka "
                             "planda sürer.")).pack(side="left", padx=(8, 0))

    def _log_panel(self, parent):
        panel = tk.Frame(parent, bg=CONSOLE, highlightbackground=BORDER2,
                         highlightthickness=1)
        head = tk.Frame(panel, bg=CONSOLE)
        head.pack(fill="x", padx=10, pady=(7, 6))
        tk.Frame(panel, bg=BORDER2, height=1).pack(fill="x")
        tk.Label(head, text=self.L("LOG", "GÜNLÜK"), bg=CONSOLE, fg=DIM,
                 font=(self.f_display, 8, "bold")).pack(side="left")
        opn = tk.Label(head, text="caspian-bridge.log ↗", bg=CONSOLE, fg=WARN,
                       font=(self.f_mono, 8), cursor="hand2")
        opn.pack(side="right")
        opn.bind("<Button-1>", lambda _e: self.open_log())
        box = tk.Text(panel, height=6, bg=CONSOLE, fg=DIM, insertbackground=INK,
                      relief="flat", wrap="word", font=(self.f_mono, 9),
                      highlightthickness=0, padx=10, pady=6)
        box.pack(fill="both", expand=True)
        # mevcut günlük geçmişini yeni panele taşı (dil değişince kaybolmasın)
        if getattr(self, "_log_history", None):
            box.insert("end", self._log_history)
            box.see("end")
        panel._box = box
        return panel

    def _option(self, parent, var):
        om = tk.OptionMenu(parent, var, var.get())
        om.config(bg=DEEP, fg=INK, relief="flat", highlightbackground=BORDER,
                  highlightthickness=1, anchor="w", activebackground=DEEP,
                  activeforeground=INK, font=(self.f_body, 10), padx=10, pady=6,
                  indicatoron=0, direction="flush")
        om["menu"].config(bg=CARD, fg=INK, activebackground=BRAND, activeforeground="white")
        return om

    def _pick_hz(self, hz):
        self.vars["hz"].set(hz)
        self._paint_hz()

    def _paint_hz(self):
        cur = self.vars["hz"].get().strip()
        for hz, lb in getattr(self, "hz_segs", {}).items():
            on = hz == cur
            lb.config(bg=(BRAND if on else DEEP), fg=("white" if on else DIM),
                      font=(self.f_mono, 10, "bold" if on else "normal"))

    def toggle_adv(self):
        self.adv_open = not self.adv_open
        if self.adv_open:
            self.adv_frame.pack(fill="x", after=self.bot_link)
        else:
            self.adv_frame.pack_forget()

    def _render_login_state(self):
        """Oturum durumuna göre 01 kartını güncelle (giriş düğmesi ↔ e-posta + değiştir)."""
        if not hasattr(self, "google_lbl"):
            return
        signed = bool(self.refresh_token or self.google_email)
        if signed:
            self.google_btn.pack_forget()
            self.change_btn.pack(side="right")
            self.acc_state.pack(side="right")
            self.google_lbl.config(text=self.google_email or "Google")
        else:
            self.change_btn.pack_forget()
            self.acc_state.pack_forget()
            self.google_btn.pack(fill="x", padx=14, pady=(10, 0), before=self.bot_link)

    def _render_target(self):
        if not hasattr(self, "tgt_lbl"):
            return
        team = next((l for l, tid in self.teams.items()
                     if tid == self.vars["team_id"].get().strip()), self.team_label.get())
        race = next((l for l, rid in self.races.items()
                     if rid == self.vars["race_id"].get().strip()), self.race_label.get())
        team = (team or "—").split("  ·")[0]
        race = (race or "—").split(" · ")[0]
        self.tgt_lbl.config(text=f'{self.L("Target:", "Hedef:")} {team} · {race}')

    def _set_metrics(self, cars, fuel, laps, lat_ms):
        def apply():
            self.m_cars.set(str(cars))
            self.m_fuel.set(f"{fuel}" if fuel is not None else "—")
            self.m_laps.set(str(laps))
            self.m_lat.set(f"{lat_ms:.0f}")
            if hasattr(self, "lat_value"):
                self.lat_value.config(fg=GOOD if lat_ms < 150 else WARN)
        self.root.after(0, apply)

    def open_log(self):
        """Log dosyasını sistemin varsayılan uygulamasında aç (Windows: Not Defteri)."""
        p = log_path()
        try:
            if os.name == "nt":
                os.startfile(p)  # noqa: E1101  (yalnız Windows)
            else:
                import subprocess
                subprocess.Popen(["xdg-open", p])
        except Exception as e:  # noqa: BLE001
            self.log(f"log açılamadı: {p} ({e})")

    @staticmethod
    def _read_parent_app():
        """parent_app.txt varsa (masaüstü Race Monitor köprüyü açtıysa) ana uygulama exe
        yolunu döndür; yoksa/okunamıyorsa "" → standalone indirme, geri-dön butonu yok."""
        try:
            p = parent_app_path()
            if os.path.exists(p):
                with open(p, encoding="utf-8") as f:
                    path = f.read().strip()
                if path and os.path.exists(path):
                    return path
        except Exception:  # noqa: BLE001
            pass
        return ""

    def back_to_engineer(self):
        """§2.5: köprüyü kapat + masaüstü Race Monitor uygulamasını yeniden aç."""
        try:
            if os.name == "nt":
                os.startfile(self.parent_app)  # noqa: E1101  (yalnız Windows)
            else:
                import subprocess
                subprocess.Popen([self.parent_app])
        except Exception as e:  # noqa: BLE001
            self.log(f"Race Engineer açılamadı: {e}")
            return
        self.stop_evt.set()      # köprü döngüsünü durdur
        self._real_quit()        # tepsiyi kapat + pencereyi yok et (orphan/duplicate yok)

    # ---------- ui helpers ----------
    def _field_in(self, parent, label, key, show=None):
        tk.Label(parent, text=label, bg=CARD, fg=DIM,
                 font=(self.f_body, 9)).pack(anchor="w", padx=14, pady=(8, 2))
        tk.Entry(parent, textvariable=self.vars[key], show=show, bg=DEEP, fg=INK,
                 insertbackground=INK, relief="flat", font=(self.f_body, 10),
                 highlightbackground=BORDER, highlightthickness=1).pack(
            fill="x", padx=14, ipady=5)

    # ---------- Google giriş + takım/yarış ----------
    def google_login(self):
        self.set_status(self.L("Opening Google sign-in…", "Google girişi açılıyor…"), WARN)
        self.google_btn.config(state="disabled")
        self.change_btn.config(state="disabled")
        threading.Thread(target=self._google_worker, daemon=True).start()

    def _google_worker(self):
        try:
            from google_auth import sign_in_google, google_enabled
            if not google_enabled():
                self.log(self.L("Google sign-in is not configured in this build → enter "
                                "bot email/password under 'Bot account / CLI'.",
                                "Bu sürümde Google girişi yapılandırılmadı → 'Bot hesabı / "
                                "CLI' altından e-posta/parola gir."))
                self.set_status(self.L("Google sign-in off", "Google girişi kapalı"), WARN)
                return
            self.log(self.L("Waiting for Google approval in the browser…",
                            "Tarayıcıda Google onayı bekleniyor…"))
            res = sign_in_google(API_KEY)
            self.refresh_token = res.get("refresh_token") or ""
            self.google_email = res.get("email", "")
            self.google_uid = res.get("uid", "")
            self.lg.info("Google giriş OK — %s (uid %s)", self.google_email, self.google_uid)
            self.root.after(0, self._render_login_state)
            self._save_or_warn()   # refresh_token'ı config'e yaz
            self.set_status(self.L("Signed in — loading teams…",
                                   "Giriş yapıldı — takımlar yükleniyor…"), GOOD)
            self._load_teams()
        except Exception as e:  # noqa: BLE001
            self.log(f"Google giriş hatası: {e}")
            self.set_status(self.L("Google sign-in failed", "Google giriş başarısız"), BAD)
        finally:
            self.root.after(0, lambda: (self.google_btn.config(state="normal"),
                                        self.change_btn.config(state="normal")))

    def _client(self):
        """Google modu (refresh_token) varsa onu, yoksa bot (e-posta/parola)."""
        if self.refresh_token:
            return FirebaseClient(API_KEY, DB_URL, refresh_token=self.refresh_token)
        return FirebaseClient(API_KEY, DB_URL, self.vars["email"].get().strip(),
                              self.vars["password"].get().strip())

    def _by(self):
        return self.google_email or self.vars["email"].get().strip() or "bridge"

    def _load_teams(self):
        try:
            fb = self._client()
            fb.sign_in()
            self.google_uid = self.google_uid or fb.uid
            data = fb.get_path(f"users/{fb.uid}/teams") or {}
            self.teams = {}
            for tid, name in data.items():
                lb = f"{name}  ·  {tid[:6]}" if name else tid
                self.teams[lb] = tid
            self.root.after(0, self._fill_team_menu)
            self.log(self.L(f"{len(self.teams)} team(s) found.",
                            f"{len(self.teams)} takım bulundu."))
        except Exception as e:  # noqa: BLE001
            self.log(f"takımlar okunamadı: {e}")

    def _fill_team_menu(self):
        menu = self.team_menu["menu"]
        menu.delete(0, "end")
        labels = sorted(self.teams.keys())
        for lb in labels:
            menu.add_command(label=lb, command=lambda v=lb: (self.team_label.set(v), self.on_team_pick()))
        if labels:
            # config'te kayıtlı team_id'yi seç, yoksa ilki
            cur = self.vars["team_id"].get().strip()
            pick = next((l for l, tid in self.teams.items() if tid == cur), labels[0])
            self.team_label.set(pick)
            self.on_team_pick()
        else:
            self.team_label.set(self.L("— no team —", "— takım yok —"))

    def on_team_pick(self):
        tid = self.teams.get(self.team_label.get(), "")
        self.vars["team_id"].set(tid)
        self._render_target()
        if tid:
            threading.Thread(target=self._load_races, args=(tid,), daemon=True).start()

    def _load_races(self, tid):
        try:
            fb = self._client()
            data = fb.get_path(f"teams/{tid}/races") or {}
            items = sorted(data.items(),
                           key=lambda it: str((it[1] or {}).get("startsAt") or
                                              (it[1] or {}).get("createdAt") or ""),
                           reverse=True)
            self.races = {}
            for rid, r in items:
                r = r or {}
                nm = r.get("name") or rid[:6]
                trk = r.get("trackId") or ""
                lb = " · ".join(x for x in (nm, trk) if x)
                self.races[lb] = rid
            self.root.after(0, self._fill_race_menu)
            self.log(self.L(f"{len(self.races)} race(s) found.",
                            f"{len(self.races)} yarış bulundu."))
            self.set_status(self.L("Pick team/race → Start", "Takım/yarış seç → Başlat"), GOOD)
        except Exception as e:  # noqa: BLE001
            self.log(f"yarışlar okunamadı: {e}")

    def _fill_race_menu(self):
        menu = self.race_menu["menu"]
        menu.delete(0, "end")
        labels = list(self.races.keys())
        for lb in labels:
            menu.add_command(label=lb, command=lambda v=lb: (self.race_label.set(v), self.on_race_pick()))
        if labels:
            cur = self.vars["race_id"].get().strip()
            pick = next((l for l, rid in self.races.items() if rid == cur), labels[0])
            self.race_label.set(pick)
            self.on_race_pick()
        else:
            self.race_label.set(self.L("— no race —", "— yarış yok —"))

    def on_race_pick(self):
        self.vars["race_id"].set(self.races.get(self.race_label.get(), ""))
        self._render_target()

    def log(self, msg):
        line = msg + "\n"
        self._log_history = (getattr(self, "_log_history", "") + line)[-8000:]

        def apply():
            for panel in (getattr(self, "setup_log", None), getattr(self, "live_log", None)):
                if panel is not None and panel.winfo_exists():
                    panel._box.insert("end", line)
                    panel._box.see("end")
        self.root.after(0, apply)

    def set_status(self, msg, color=DIM):
        self.root.after(0, lambda: self.status.config(text=msg, fg=color)
                        if getattr(self, "status", None) and self.status.winfo_exists() else None)

    def _set_btn(self, text):
        self.root.after(0, lambda: self.start_btn.config(text=text)
                        if getattr(self, "start_btn", None) and self.start_btn.winfo_exists() else None)

    # ---------- config ----------
    def load(self):
        if not os.path.exists(self.cfg):
            self.log(self.L("No config.ini — fill the fields and press Save & Start.",
                            "config.ini yok — alanları doldurup Kaydet & Başlat'a bas."))
            return
        cp = configparser.ConfigParser()
        try:
            cp.read(self.cfg, encoding="utf-8")
            if cp.has_section("firebase"):
                self.vars["email"].set(cp["firebase"].get("email", ""))
                pw = cp["firebase"].get("password", "")
                self.vars["password"].set("" if pw == "DEGISTIR" else pw)
                self.refresh_token = cp["firebase"].get("refresh_token", "").strip()
                self.google_email = cp["firebase"].get("google_email", "").strip()
            if cp.has_section("race"):
                self.vars["team_id"].set(cp["race"].get("team_id", ""))
                self.vars["race_id"].set(cp["race"].get("race_id", ""))
            if cp.has_section("rate"):
                self.vars["hz"].set(cp["rate"].get("hz", "2"))
                self._paint_hz()
                # REST hep açık + 3 sn sabit (§2.1/2.3) → rest_on/rest_interval artık okunmaz.
            self.log(self.L("Saved settings loaded.", "Kayıtlı ayarlar yüklendi."))
            self._render_login_state()
            self._render_target()
            # Google oturumu kayıtlıysa: giriş göster + takım/yarış listelerini tazele
            if self.refresh_token:
                threading.Thread(target=self._load_teams, daemon=True).start()
        except Exception as e:  # noqa: BLE001
            self.log(f"config okunamadı: {e}")

    def save(self):
        cp = configparser.ConfigParser()
        # mevcut dosyayı koru (bilmediğimiz alanlar kaybolmasın)
        if os.path.exists(self.cfg):
            try:
                cp.read(self.cfg, encoding="utf-8")
            except Exception:  # noqa: BLE001
                cp = configparser.ConfigParser()
        cp["firebase"] = {"api_key": API_KEY, "database_url": DB_URL,
                          "email": self.vars["email"].get().strip(),
                          "password": self.vars["password"].get().strip(),
                          "refresh_token": self.refresh_token or "",
                          "google_email": self.google_email or ""}
        cp["race"] = {"team_id": self.vars["team_id"].get().strip(),
                      "race_id": self.vars["race_id"].get().strip()}
        cp["rate"] = {"hz": self.vars["hz"].get().strip() or "2",
                      "rest_on": "true", "rest_interval": "3"}   # REST hep açık, 3 sn sabit
        cp["ui"] = {"lang": self.lang}
        with open(self.cfg, "w", encoding="utf-8") as f:
            cp.write(f)

    def _validate(self):
        if not self.refresh_token:  # bot modu → e-posta/parola şart
            for k in ("email", "password"):
                if not self.vars[k].get().strip():
                    messagebox.showwarning(
                        self.L("Sign-in required", "Giriş gerekli"),
                        self.L("Sign in with '🔐 Google Sign-In' — or enter bot "
                               "email/password under 'Bot account / CLI'.",
                               "🔐 'Google ile Giriş' yap — ya da 'Bot hesabı / CLI' "
                               "altından bot e-posta/parola gir."))
                    return False
        for k in ("team_id", "race_id"):
            if not self.vars[k].get().strip():
                messagebox.showwarning(
                    self.L("Missing selection", "Eksik seçim"),
                    self.L("Select a team and race (populated after sign-in).",
                           "Takım ve Yarış seç (giriş sonrası dolar)."))
                return False
        return True

    def _save_or_warn(self):
        try:
            self.save()
            return True
        except Exception as e:  # noqa: BLE001
            messagebox.showerror(
                self.L("Could not save", "Kaydedilemedi"),
                self.L(f"{e}\n\nMove the exe to a folder like Desktop/Documents "
                       f"instead of Program Files.",
                       f"{e}\n\nExe'yi Program Files yerine Masaüstü/Belgeler gibi "
                       f"bir klasöre taşı."))
            return False

    # ---------- actions ----------
    def selftest(self):
        if not self._validate() or not self._save_or_warn():
            return
        self.set_status(self.L("Self-test running…", "Self-test çalışıyor…"), WARN)
        threading.Thread(target=self._selftest_worker, daemon=True).start()

    def _selftest_worker(self):
        tid, rid = self.vars["team_id"].get().strip(), self.vars["race_id"].get().strip()
        fb = self._client()
        self.lg.info("[self-test] başladı — teams/%s/live/%s", tid, rid)
        try:
            self.log("[self-test] giriş…")
            fb.sign_in()
            self.log(f"Giriş yapıldı — GERÇEK UID: {fb.uid}")
            self.log(f"(bridgeBots/{fb.uid} = true olmalı — bu satırdaki UID'yi kullan,")
            self.log(" konsoldan elle okumana gerek yok.)")
            marker = int(time.time() * 1000)
            fb.put_live(tid, rid, {"ts": marker, "by": "gui", "selftest": True,
                                   "session": {}, "own": None, "field": []})
            back = fb.get_live(tid, rid)
            if back and back.get("ts") == marker:
                self.log(self.L("✅ PASS — Firebase write + read works.",
                                "✅ PASS — Firebase yazma + okuma çalışıyor."))
                self.lg.info("[self-test] PASS — UID %s", fb.uid)
                self.set_status(self.L("Self-test: PASS ✓", "Self-test: PASS ✓"), GOOD)
            else:
                self.log(f"❌ FAIL — geri okuma uyuşmadı: {back}")
                self.lg.warning("[self-test] FAIL — geri okuma uyuşmadı: %s", back)
                self.set_status("Self-test: FAIL", BAD)
        except Exception as e:  # noqa: BLE001
            self.log(f"❌ FAIL — {e}")
            self.lg.error("[self-test] FAIL — %s", e)
            if fb.uid:
                self.log(f"İpucu: kökte bridgeBots/{fb.uid} = true var mı? team_id/race_id doğru mu?")
            else:
                self.log("İpucu: e-posta/parola doğru mu, Email/Password sağlayıcısı açık mı?")
            self.set_status("Self-test: FAIL", BAD)

    def toggle(self):
        if self.worker and self.worker.is_alive():
            self.stop_evt.set()
            self.set_status(self.L("Stopping…", "Durduruluyor…"), WARN)
            return
        if not self._validate() or not self._save_or_warn():
            return
        self.stop_evt.clear()
        self.worker = threading.Thread(target=self._loop_worker, daemon=True)
        self.worker.start()
        self._set_btn(self.L("Stop", "Durdur"))
        self.set_status(self.L("Connecting…", "Bağlanıyor…"), WARN)

    def _loop_worker(self):
        tid, rid = self.vars["team_id"].get().strip(), self.vars["race_id"].get().strip()
        try:
            hz = float(self.vars["hz"].get().strip() or "2")
        except ValueError:
            hz = 2.0
        period = 1.0 / max(0.2, min(hz, 10))
        low = lower_priority()  # oyunla çekişmede oyun kazansın
        # 1c durum şeridi alt satırı: hedef yolu · Hz · REST
        hz_txt = f"{hz:g}"
        self.root.after(0, lambda: self.live_sub.set(
            f"teams/…{tid[-4:]}/live/…{rid[-4:]} · {hz_txt} Hz · "
            f"{self.L('REST 3 s', 'REST 3 sn')}"))
        # §2.1/2.3: REST HEP AÇIK, yenileme 3 sn SABİT (kullanıcı toggle'ı kaldırıldı).
        self.lg.info("=== Köprü başladı === hedef teams/%s/live/%s · %g Hz · REST:AÇIK (3s) · öncelik:%s",
                     tid, rid, hz, "düşük" if low else "normal")
        self.log(self.L(f"REST: ON — background 3s · priority: {'low' if low else 'normal'}",
                        f"REST: AÇIK — arka plan 3s · öncelik: {'düşük' if low else 'normal'}"))
        try:
            fb = self._client()
            self.log(self.L("[firebase] signing in…", "[firebase] giriş…"))
            fb.sign_in()
            self.log(self.L(f"Signed in — UID: {fb.uid}", f"Giriş yapıldı — UID: {fb.uid}"))
            self.lg.info("giriş OK — UID %s", fb.uid)
            src = make_source(False, False, 3.0)   # mock=False, no_rest=False (REST açık), aralık 3s
            self.log(self.L("Reading game (shared memory)", "Oyun (paylaşımlı bellek) okunuyor"))
        except Exception as e:  # noqa: BLE001
            self.log(f"başlatılamadı: {e}")
            self.lg.error("başlatılamadı: %s", e)
            self.set_status(self.L("Error", "Hata"), BAD)
            self._set_btn(self.L("SAVE & START", "KAYDET & BAŞLAT"))
            return
        self.set_status(self.L("● Streaming live", "● Canlı gönderiliyor"), GOOD)
        self.root.after(0, self._show_live)   # kurulum → canlı görünüm
        # v1.8.6 — tur geçmişi (livelaps/…) hafif köprüde de yazılır ("+" popup'ı dolsun).
        harv = start_harvester(fb, tid, rid)
        pend = []
        fails = 0
        sent = 0
        last_hb = 0.0
        while not self.stop_evt.is_set():
            t0 = time.time()
            try:
                payload = build_payload(src, self._by())
                pend, herr = apply_harvest(fb, tid, harv, payload, pend)
                if herr:
                    self.lg.warning("tur geçmişi yazılamadı (yeniden denenecek): %s", herr)
                elif harv.frame_written:
                    self.lg.info("tur geçmişi: +%d tur (toplam %d)",
                                 harv.frame_written, harv.total_written)
                t1 = time.time()
                fb.put_live(tid, rid, payload)
                t2 = time.time()
                fails = 0
                sent += 1
                if sent == 1 and self.tray is not None:
                    # §2.4: ilk kare BAŞARIYLA gönderildi → pencereyi tepsiye indir. (Başarısız
                    # başlatmada bu satıra ulaşılmaz → pencere görünür kalır, kullanıcı hatayı görür.)
                    self.root.after(0, self._hide_to_tray)
                fuel = (payload["own"] or {}).get("fuel")
                self._set_metrics(len(payload["field"]), fuel, harv.total_written,
                                  (t2 - t1) * 1000)
                if t2 - last_hb >= 10:  # dosyaya ~10 sn'de bir (şişmesin)
                    last_hb = t2
                    self.lg.info(heartbeat_line(sent, len(payload["field"]), fuel,
                                                (t1 - t0) * 1000, (t2 - t1) * 1000))
            except Exception as e:  # noqa: BLE001
                fails += 1
                self.log(f"[hata {fails}] {e}")
                self.lg.warning("[hata %d] %s", fails, e)
                time.sleep(min(2 ** min(fails, 4), 16))
            dt = time.time() - t0
            if dt < period:
                time.sleep(period - dt)
        try:
            if hasattr(src, "close"):
                src.close()
        except Exception:  # noqa: BLE001
            pass
        self.log(self.L("stopped.", "durduruldu."))
        self.lg.info("=== Köprü durdu === toplam %d gönderim", sent)
        self.set_status(self.L("Stopped", "Durdu"), DIM)
        self._set_btn(self.L("SAVE & START", "KAYDET & BAŞLAT"))
        self.root.after(0, self._show_setup)   # canlı → kurulum görünümü

    # ---------- sistem tepsisi (tepside çalışmaya devam) ----------
    def _init_tray(self):
        """pystray ile bildirim-alanı ikonu kur (arka plan thread). pystray/Pillow yoksa
        (ör. bu ortam) sessizce atlanır → o zaman X normal kapatır (yedek)."""
        try:
            import pystray
            menu = pystray.Menu(
                pystray.MenuItem(self.L("Show", "Göster"), self._tray_show, default=True),
                pystray.MenuItem(self.L("Quit", "Çıkış"), self._tray_quit),
            )
            self.tray = pystray.Icon("caspian_bridge", _tray_image(),
                                     "Caspian Live Bridge", menu)
            self.tray.run_detached()   # kendi thread'inde çalışır (Windows destekli)
        except Exception as e:  # noqa: BLE001
            self.tray = None
            self.lg.info("tepsi ikonu yok (%s) — X kapatır", e)

    def _tray_show(self, *_):
        # pystray callback'i kendi thread'inde → tkinter'a marshal et.
        self.root.after(0, lambda: (self.root.deiconify(), self.root.lift(),
                                    self.root.focus_force()))

    def _tray_quit(self, *_):
        self.root.after(0, self._real_quit)

    def _hide_to_tray(self):
        """Pencereyi gizle ama DÖNGÜYÜ DURDURMA — köprü tepside yayına devam eder."""
        self.root.withdraw()
        if not self.tray_hinted:
            self.tray_hinted = True
            try:
                self.tray.notify(self.L("Bridge running in the tray — streaming continues. "
                                        "Double-click the icon to show.",
                                        "Köprü tepside çalışıyor — yayın sürüyor. "
                                        "Göstermek için ikona çift tıkla."),
                                 "Caspian Live Bridge")
            except Exception:  # noqa: BLE001
                pass

    def _real_quit(self):
        self.stop_evt.set()
        if self.tray is not None:
            try:
                self.tray.stop()
            except Exception:  # noqa: BLE001
                pass
        self.root.after(200, self.root.destroy)

    def on_close(self):
        # (X) → uygulamayı KAPATMA; tepsiye gizle, köprü çalışmaya devam etsin.
        # Tepsi yoksa (pystray yüklenemedi) gerçekten kapat (yedek davranış).
        if self.tray is not None:
            self._hide_to_tray()
        else:
            self._real_quit()


def launch(config_path=None):
    _hide_console()
    if not config_path:
        from logfile import default_config_path
        config_path = default_config_path()
    root = tk.Tk()
    BridgeGUI(root, config_path)
    root.mainloop()
