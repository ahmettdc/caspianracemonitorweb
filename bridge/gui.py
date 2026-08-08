"""Basit arayüz (tkinter) — config'i formdan gir, Kaydet & Başlat.
Not Defteri gerekmez. Konsol/CLI (--selftest, --dump) ayrıca çalışır."""
import configparser
import os
import threading
import time
import tkinter as tk
from tkinter import messagebox

from fb import FirebaseClient
from main import make_source, build_payload
from logfile import get_logger, heartbeat_line, log_path

API_KEY = "AIzaSyB9hEH26etwvn9adAGNOpPAlpUym1qzpns"
DB_URL = "https://caspian-race-control-default-rtdb.europe-west1.firebasedatabase.app"

BG = "#150E10"
BG2 = "#1E1418"
INK = "#F3EAEC"
DIM = "#B199A0"
BRAND = "#960018"
GOOD = "#37D67A"
WARN = "#F5B23D"
BAD = "#FF4D5E"


def _hide_console():
    """Windows'ta GUI modunda konsol penceresini gizle (varsa)."""
    try:
        import ctypes
        h = ctypes.windll.kernel32.GetConsoleWindow()
        if h:
            ctypes.windll.user32.ShowWindow(h, 0)  # SW_HIDE
    except Exception:  # noqa: BLE001
        pass


class BridgeGUI:
    def __init__(self, root, config_path):
        self.root = root
        self.cfg = config_path
        self.stop_evt = threading.Event()
        self.worker = None

        root.title("Caspian Live Bridge")
        root.geometry("470x560")
        root.configure(bg=BG)

        self.vars = {k: tk.StringVar() for k in ("email", "password", "team_id", "race_id", "hz")}
        self.vars["hz"].set("2")
        self.mock = tk.BooleanVar(value=False)
        # Google oturumu (bot yerine kendi hesabın) + takım/yarış listeleri
        self.refresh_token = ""
        self.google_email = ""
        self.google_uid = ""
        self.teams = {}   # görünen ad -> tid
        self.races = {}   # görünen etiket -> rid
        self.team_label = tk.StringVar(value="— önce Google ile giriş —")
        self.race_label = tk.StringVar(value="—")

        root.geometry("470x640")
        tk.Label(root, text="CASPIAN LIVE BRIDGE", bg=BG, fg=INK,
                 font=("Segoe UI", 14, "bold")).pack(anchor="w", padx=14, pady=(14, 0))
        tk.Label(root, text="LMU → Firebase canlı timing köprüsü", bg=BG, fg=DIM,
                 font=("Segoe UI", 9)).pack(anchor="w", padx=14, pady=(0, 6))

        # --- Google giriş (bot GEREKMEZ) ---
        grow = tk.Frame(root, bg=BG)
        grow.pack(fill="x", padx=14, pady=(4, 2))
        self.google_btn = tk.Button(grow, text="🔐 Google ile Giriş", command=self.google_login,
                                    bg=BRAND, fg="white", relief="flat", padx=12, pady=6,
                                    font=("Segoe UI", 10, "bold"), cursor="hand2")
        self.google_btn.pack(side="left")
        self.google_lbl = tk.Label(grow, text="giriş yapılmadı", bg=BG, fg=DIM, font=("Segoe UI", 9))
        self.google_lbl.pack(side="left", padx=10)

        # --- Takım / Yarış (giriş sonrası otomatik dolar) ---
        self.team_menu = self._menu("Takım", self.team_label, self.on_team_pick)
        self.race_menu = self._menu("Yarış", self.race_label, self.on_race_pick)

        self._field("Gönderim (Hz)", "hz")
        tk.Checkbutton(root, text="Mock veri (oyunsuz test)", variable=self.mock,
                       bg=BG, fg=DIM, selectcolor=BG2, activebackground=BG,
                       activeforeground=INK, font=("Segoe UI", 9)).pack(anchor="w", padx=12, pady=(4, 2))

        # --- Gelişmiş (bot hesabı) — katlanır; Google giriş yaptıysan gerekmez ---
        self.adv_open = False
        self.adv_btn = tk.Button(root, text="▸ Gelişmiş (bot hesabı — Google giriş yaptıysan gerekmez)",
                                 command=self.toggle_adv, bg=BG, fg=DIM, relief="flat", anchor="w",
                                 font=("Segoe UI", 8), cursor="hand2")
        self.adv_btn.pack(fill="x", padx=12, pady=(4, 0))
        self.adv_frame = tk.Frame(root, bg=BG)
        self._field_in(self.adv_frame, "Bot e-posta", "email")
        self._field_in(self.adv_frame, "Bot parola", "password", show="*")
        self._field_in(self.adv_frame, "team_id (elle)", "team_id")
        self._field_in(self.adv_frame, "race_id (elle)", "race_id")

        btns = tk.Frame(root, bg=BG)
        btns.pack(fill="x", padx=14, pady=8)
        self.start_btn = tk.Button(btns, text="Kaydet & Başlat", command=self.toggle,
                                   bg=BRAND, fg="white", relief="flat", padx=14, pady=7,
                                   font=("Segoe UI", 10, "bold"), cursor="hand2")
        self.start_btn.pack(side="left")
        tk.Button(btns, text="Self-Test", command=self.selftest, bg=BG2, fg=INK,
                  relief="flat", padx=12, pady=7, font=("Segoe UI", 10),
                  cursor="hand2").pack(side="left", padx=8)
        tk.Button(btns, text="📄 Logu aç", command=self.open_log, bg=BG2, fg=INK,
                  relief="flat", padx=12, pady=7, font=("Segoe UI", 10),
                  cursor="hand2").pack(side="left")

        self.status = tk.Label(root, text="Hazır", bg=BG, fg=DIM,
                               font=("Segoe UI", 10, "bold"), anchor="w")
        self.status.pack(fill="x", padx=14)
        self.logbox = tk.Text(root, height=8, bg="#0B0708", fg=DIM, insertbackground=INK,
                              relief="flat", wrap="word", font=("Consolas", 9))
        self.logbox.pack(fill="both", expand=True, padx=14, pady=(4, 12))

        self.lg = get_logger()
        self.load()
        self.log(f"📄 Log dosyası: {log_path()}")
        root.protocol("WM_DELETE_WINDOW", self.on_close)

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

    # ---------- ui helpers ----------
    def _field(self, label, key, show=None):
        self._field_in(self.root, label, key, show)

    def _field_in(self, parent, label, key, show=None):
        tk.Label(parent, text=label, bg=BG, fg=DIM,
                 font=("Segoe UI", 9)).pack(anchor="w", padx=14, pady=(6, 1))
        tk.Entry(parent, textvariable=self.vars[key], show=show, bg=BG2, fg=INK,
                 insertbackground=INK, relief="flat", font=("Segoe UI", 10)).pack(
            fill="x", padx=14, ipady=4)

    def _menu(self, label, var, cmd):
        tk.Label(self.root, text=label, bg=BG, fg=DIM,
                 font=("Segoe UI", 9)).pack(anchor="w", padx=14, pady=(6, 1))
        om = tk.OptionMenu(self.root, var, var.get())
        om.config(bg=BG2, fg=INK, relief="flat", highlightthickness=0, anchor="w",
                  activebackground=BG2, activeforeground=INK, font=("Segoe UI", 10))
        om["menu"].config(bg=BG2, fg=INK, activebackground=BRAND, activeforeground="white")
        om.pack(fill="x", padx=14)
        return om

    def toggle_adv(self):
        self.adv_open = not self.adv_open
        if self.adv_open:
            self.adv_frame.pack(fill="x", after=self.adv_btn)
            self.adv_btn.config(text="▾ Gelişmiş (bot hesabı)")
        else:
            self.adv_frame.pack_forget()
            self.adv_btn.config(text="▸ Gelişmiş (bot hesabı — Google giriş yaptıysan gerekmez)")

    # ---------- Google giriş + takım/yarış ----------
    def google_login(self):
        self.set_status("Google girişi açılıyor…", WARN)
        self.google_btn.config(state="disabled")
        threading.Thread(target=self._google_worker, daemon=True).start()

    def _google_worker(self):
        try:
            from google_auth import sign_in_google, google_enabled
            if not google_enabled():
                self.log("Bu sürümde Google girişi yapılandırılmadı → 'Gelişmiş (bot)' ile "
                         "e-posta/parola gir.")
                self.set_status("Google girişi kapalı", WARN)
                return
            self.log("Tarayıcıda Google onayı bekleniyor…")
            res = sign_in_google(API_KEY)
            self.refresh_token = res.get("refresh_token") or ""
            self.google_email = res.get("email", "")
            self.google_uid = res.get("uid", "")
            self.lg.info("Google giriş OK — %s (uid %s)", self.google_email, self.google_uid)
            self.root.after(0, lambda: self.google_lbl.config(
                text=f"✓ {self.google_email}", fg=GOOD))
            self._save_or_warn()   # refresh_token'ı config'e yaz
            self.set_status("Giriş yapıldı — takımlar yükleniyor…", GOOD)
            self._load_teams()
        except Exception as e:  # noqa: BLE001
            self.log(f"Google giriş hatası: {e}")
            self.set_status("Google giriş başarısız", BAD)
        finally:
            self.root.after(0, lambda: self.google_btn.config(state="normal"))

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
            self.log(f"{len(self.teams)} takım bulundu.")
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
            self.team_label.set("— takım yok —")

    def on_team_pick(self):
        tid = self.teams.get(self.team_label.get(), "")
        self.vars["team_id"].set(tid)
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
            self.log(f"{len(self.races)} yarış bulundu.")
            self.set_status("Takım/yarış seç → Başlat", GOOD)
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
            self.race_label.set("— yarış yok —")

    def on_race_pick(self):
        self.vars["race_id"].set(self.races.get(self.race_label.get(), ""))

    def log(self, msg):
        self.root.after(0, lambda: (self.logbox.insert("end", msg + "\n"), self.logbox.see("end")))

    def set_status(self, msg, color=DIM):
        self.root.after(0, lambda: self.status.config(text=msg, fg=color))

    def _set_btn(self, text):
        self.root.after(0, lambda: self.start_btn.config(text=text))

    # ---------- config ----------
    def load(self):
        if not os.path.exists(self.cfg):
            self.log("config.ini yok — alanları doldurup Kaydet & Başlat'a bas.")
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
            self.log("Kayıtlı ayarlar yüklendi.")
            # Google oturumu kayıtlıysa: giriş göster + takım/yarış listelerini tazele
            if self.refresh_token:
                self.google_lbl.config(text=f"✓ {self.google_email or 'Google'}", fg=GOOD)
                threading.Thread(target=self._load_teams, daemon=True).start()
        except Exception as e:  # noqa: BLE001
            self.log(f"config okunamadı: {e}")

    def save(self):
        cp = configparser.ConfigParser()
        cp["firebase"] = {"api_key": API_KEY, "database_url": DB_URL,
                          "email": self.vars["email"].get().strip(),
                          "password": self.vars["password"].get().strip(),
                          "refresh_token": self.refresh_token or "",
                          "google_email": self.google_email or ""}
        cp["race"] = {"team_id": self.vars["team_id"].get().strip(),
                      "race_id": self.vars["race_id"].get().strip()}
        cp["rate"] = {"hz": self.vars["hz"].get().strip() or "2"}
        with open(self.cfg, "w", encoding="utf-8") as f:
            cp.write(f)

    def _validate(self):
        if not self.refresh_token:  # bot modu → e-posta/parola şart
            for k in ("email", "password"):
                if not self.vars[k].get().strip():
                    messagebox.showwarning(
                        "Giriş gerekli",
                        "🔐 'Google ile Giriş' yap — ya da 'Gelişmiş (bot hesabı)' altından "
                        "bot e-posta/parola gir.")
                    return False
        for k in ("team_id", "race_id"):
            if not self.vars[k].get().strip():
                messagebox.showwarning("Eksik seçim", "Takım ve Yarış seç (giriş sonrası dolar).")
                return False
        return True

    def _save_or_warn(self):
        try:
            self.save()
            return True
        except Exception as e:  # noqa: BLE001
            messagebox.showerror("Kaydedilemedi",
                                 f"{e}\n\nExe'yi Program Files yerine Masaüstü/Belgeler gibi "
                                 f"bir klasöre taşı.")
            return False

    # ---------- actions ----------
    def selftest(self):
        if not self._validate() or not self._save_or_warn():
            return
        self.set_status("Self-test çalışıyor…", WARN)
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
                self.log("✅ PASS — Firebase yazma + okuma çalışıyor.")
                self.lg.info("[self-test] PASS — UID %s", fb.uid)
                self.set_status("Self-test: PASS ✓", GOOD)
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
            self.set_status("Durduruluyor…", WARN)
            return
        if not self._validate() or not self._save_or_warn():
            return
        self.stop_evt.clear()
        self.worker = threading.Thread(target=self._loop_worker, daemon=True)
        self.worker.start()
        self._set_btn("Durdur")
        self.set_status("Bağlanıyor…", WARN)

    def _loop_worker(self):
        tid, rid = self.vars["team_id"].get().strip(), self.vars["race_id"].get().strip()
        try:
            hz = float(self.vars["hz"].get().strip() or "2")
        except ValueError:
            hz = 2.0
        period = 1.0 / max(0.2, min(hz, 10))
        self.lg.info("=== Köprü başladı === hedef teams/%s/live/%s · %g Hz · %s",
                     tid, rid, hz, "MOCK" if self.mock.get() else "oyun (paylaşımlı bellek)")
        try:
            fb = self._client()
            self.log("[firebase] giriş…")
            fb.sign_in()
            self.log(f"Giriş yapıldı — UID: {fb.uid}")
            self.lg.info("giriş OK — UID %s", fb.uid)
            src = make_source(self.mock.get())
            self.log("Mock veri" if self.mock.get() else "Oyun (paylaşımlı bellek) okunuyor")
        except Exception as e:  # noqa: BLE001
            self.log(f"başlatılamadı: {e}")
            self.lg.error("başlatılamadı: %s", e)
            if not self.mock.get():
                self.log("Oyun okunamadıysa 'Mock veri' ile hattı test edebilirsin.")
            self.set_status("Hata", BAD)
            self._set_btn("Kaydet & Başlat")
            return
        self.set_status("● Canlı gönderiliyor", GOOD)
        fails = 0
        sent = 0
        last_hb = 0.0
        while not self.stop_evt.is_set():
            t0 = time.time()
            try:
                payload = build_payload(src, self._by())
                t1 = time.time()
                fb.put_live(tid, rid, payload)
                t2 = time.time()
                fails = 0
                sent += 1
                fuel = (payload["own"] or {}).get("fuel")
                self.set_status(f"● {len(payload['field'])} araç · yakıt "
                                f"{fuel if fuel is not None else '—'}", GOOD)
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
        self.log("durduruldu.")
        self.lg.info("=== Köprü durdu === toplam %d gönderim", sent)
        self.set_status("Durdu", DIM)
        self._set_btn("Kaydet & Başlat")

    def on_close(self):
        self.stop_evt.set()
        self.root.after(200, self.root.destroy)


def launch(config_path="config.ini"):
    _hide_console()
    root = tk.Tk()
    BridgeGUI(root, config_path)
    root.mainloop()
