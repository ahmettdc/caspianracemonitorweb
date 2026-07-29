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

        tk.Label(root, text="CASPIAN LIVE BRIDGE", bg=BG, fg=INK,
                 font=("Segoe UI", 14, "bold")).pack(anchor="w", padx=14, pady=(14, 0))
        tk.Label(root, text="LMU → Firebase canlı timing köprüsü", bg=BG, fg=DIM,
                 font=("Segoe UI", 9)).pack(anchor="w", padx=14, pady=(0, 6))

        self._field("Bot e-posta", "email")
        self._field("Bot parola", "password", show="*")
        self._field("team_id  (web 'Canlı' sekmesinde)", "team_id")
        self._field("race_id  (web 'Canlı' sekmesinde)", "race_id")
        self._field("Gönderim (Hz)", "hz")

        tk.Checkbutton(root, text="Mock veri (oyunsuz test)", variable=self.mock,
                       bg=BG, fg=DIM, selectcolor=BG2, activebackground=BG,
                       activeforeground=INK, font=("Segoe UI", 9)).pack(anchor="w", padx=12, pady=(4, 2))

        btns = tk.Frame(root, bg=BG)
        btns.pack(fill="x", padx=14, pady=8)
        self.start_btn = tk.Button(btns, text="Kaydet & Başlat", command=self.toggle,
                                   bg=BRAND, fg="white", relief="flat", padx=14, pady=7,
                                   font=("Segoe UI", 10, "bold"), cursor="hand2")
        self.start_btn.pack(side="left")
        tk.Button(btns, text="Self-Test", command=self.selftest, bg=BG2, fg=INK,
                  relief="flat", padx=12, pady=7, font=("Segoe UI", 10),
                  cursor="hand2").pack(side="left", padx=8)

        self.status = tk.Label(root, text="Hazır", bg=BG, fg=DIM,
                               font=("Segoe UI", 10, "bold"), anchor="w")
        self.status.pack(fill="x", padx=14)
        self.logbox = tk.Text(root, height=8, bg="#0B0708", fg=DIM, insertbackground=INK,
                              relief="flat", wrap="word", font=("Consolas", 9))
        self.logbox.pack(fill="both", expand=True, padx=14, pady=(4, 12))

        self.load()
        root.protocol("WM_DELETE_WINDOW", self.on_close)

    # ---------- ui helpers ----------
    def _field(self, label, key, show=None):
        tk.Label(self.root, text=label, bg=BG, fg=DIM,
                 font=("Segoe UI", 9)).pack(anchor="w", padx=14, pady=(6, 1))
        tk.Entry(self.root, textvariable=self.vars[key], show=show, bg=BG2, fg=INK,
                 insertbackground=INK, relief="flat", font=("Segoe UI", 10)).pack(
            fill="x", padx=14, ipady=4)

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
            if cp.has_section("race"):
                self.vars["team_id"].set(cp["race"].get("team_id", ""))
                self.vars["race_id"].set(cp["race"].get("race_id", ""))
            if cp.has_section("rate"):
                self.vars["hz"].set(cp["rate"].get("hz", "2"))
            self.log("Kayıtlı ayarlar yüklendi.")
        except Exception as e:  # noqa: BLE001
            self.log(f"config okunamadı: {e}")

    def save(self):
        cp = configparser.ConfigParser()
        cp["firebase"] = {"api_key": API_KEY, "database_url": DB_URL,
                          "email": self.vars["email"].get().strip(),
                          "password": self.vars["password"].get().strip()}
        cp["race"] = {"team_id": self.vars["team_id"].get().strip(),
                      "race_id": self.vars["race_id"].get().strip()}
        cp["rate"] = {"hz": self.vars["hz"].get().strip() or "2"}
        with open(self.cfg, "w", encoding="utf-8") as f:
            cp.write(f)

    def _validate(self):
        for k in ("email", "password", "team_id", "race_id"):
            if not self.vars[k].get().strip():
                messagebox.showwarning("Eksik alan", f"'{k}' boş olamaz.")
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

    def _client(self):
        return FirebaseClient(API_KEY, DB_URL, self.vars["email"].get().strip(),
                              self.vars["password"].get().strip())

    # ---------- actions ----------
    def selftest(self):
        if not self._validate() or not self._save_or_warn():
            return
        self.set_status("Self-test çalışıyor…", WARN)
        threading.Thread(target=self._selftest_worker, daemon=True).start()

    def _selftest_worker(self):
        tid, rid = self.vars["team_id"].get().strip(), self.vars["race_id"].get().strip()
        fb = self._client()
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
                self.set_status("Self-test: PASS ✓", GOOD)
            else:
                self.log(f"❌ FAIL — geri okuma uyuşmadı: {back}")
                self.set_status("Self-test: FAIL", BAD)
        except Exception as e:  # noqa: BLE001
            self.log(f"❌ FAIL — {e}")
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
        try:
            fb = self._client()
            self.log("[firebase] giriş…")
            fb.sign_in()
            self.log(f"Giriş yapıldı — UID: {fb.uid}")
            src = make_source(self.mock.get())
            self.log("Mock veri" if self.mock.get() else "Oyun (paylaşımlı bellek) okunuyor")
        except Exception as e:  # noqa: BLE001
            self.log(f"başlatılamadı: {e}")
            if not self.mock.get():
                self.log("Oyun okunamadıysa 'Mock veri' ile hattı test edebilirsin.")
            self.set_status("Hata", BAD)
            self._set_btn("Kaydet & Başlat")
            return
        self.set_status("● Canlı gönderiliyor", GOOD)
        fails = 0
        while not self.stop_evt.is_set():
            t0 = time.time()
            try:
                payload = build_payload(src, self.vars["email"].get().strip())
                fb.put_live(tid, rid, payload)
                fails = 0
                fuel = (payload["own"] or {}).get("fuel")
                self.set_status(f"● {len(payload['field'])} araç · yakıt "
                                f"{fuel if fuel is not None else '—'}", GOOD)
            except Exception as e:  # noqa: BLE001
                fails += 1
                self.log(f"[hata {fails}] {e}")
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
