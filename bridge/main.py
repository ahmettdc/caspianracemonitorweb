"""Caspian Live Bridge — LMU/rF2 → Firebase canlı timing köprüsü.

Oyunun çalıştığı PC'de çalışır: paylaşımlı bellekten (rFactor2 Shared Memory
Map Plugin) okur, teams/{tid}/live/{rid} düğümüne yazar. Web pit-wall bunu
salt-okunur dinler.

Kullanım:
    CaspianLiveBridge.exe                 # sürekli gönder (config.ini yanında)
    CaspianLiveBridge.exe --mock          # oyunsuz sahte veri
    CaspianLiveBridge.exe --selftest      # Firebase yaz+oku turu (PASS/FAIL)
    CaspianLiveBridge.exe --dump          # bir örnek oku, JSON bas (yazmaz)
    CaspianLiveBridge.exe --dump --mock   # sahte örneği bas
    CaspianLiveBridge.exe --once          # bir kez oku+gönder, çık
    CaspianLiveBridge.exe --config yol.ini
"""
import argparse
import configparser
import json
import os
import sys
import time

# Not: `from fb import FirebaseClient` üstte DEĞİL — yalnız Firebase'e yazan
# yollarda (cmd_selftest/run_loop) lazy import edilir. Böylece `--emit`/`--dump`
# (masaüstü sidecar) `requests` yüklü olmadan da çalışır.

CONFIG_TEMPLATE = """; Caspian Live Bridge — yapılandırma
; EN KOLAY YOL: exe'yi çift tıkla → 'Google ile Giriş' → Takım/Yarış seç. Bu dosya
; kendiliğinden dolar (bot GEREKMEZ). Aşağıdaki bot alanları yalnız arayüzsüz/CLI için.

[firebase]
api_key = AIzaSyB9hEH26etwvn9adAGNOpPAlpUym1qzpns
database_url = https://caspian-race-control-default-rtdb.europe-west1.firebasedatabase.app
; Google ile Giriş yaptıysan bu iki satır boş kalır (refresh_token otomatik yazılır):
email = bridge-bot@caspian.local
password = DEGISTIR

[race]
team_id =
race_id =

[rate]
hz = 2
"""


def pause():
    """Çift tıklamada pencere kapanmadan kullanıcı mesajı okusun."""
    try:
        if sys.stdin and sys.stdin.isatty():
            input("\nKapatmak için Enter'a bas...")
    except Exception:  # noqa: BLE001
        pass


def read_config_or_die(path):
    if not os.path.exists(path):
        # ilk çalıştırma: yanına şablon config.ini bırakmayı dene
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(CONFIG_TEMPLATE)
            print(f"'{path}' oluşturuldu — bu klasörde. Lütfen doldur:")
            print("  [firebase] email + password (bot hesabı)")
            print("  [race] team_id + race_id  (web 'Canlı' sekmesinde yazıyor)")
            print("Doldurup köprüyü tekrar çalıştır.")
        except Exception as e:  # noqa: BLE001
            print(f"config.ini yok ve bu klasöre yazılamadı ({e}).")
            print("İpucu: exe'yi Program Files yerine Belgeler gibi bir klasöre taşı.")
            print("Aşağıdaki şablonu 'config.ini' olarak yanına kaydet:\n")
            print(CONFIG_TEMPLATE)
        pause()
        sys.exit(1)

    cp = configparser.ConfigParser()
    try:
        cp.read(path, encoding="utf-8")
    except Exception as e:  # noqa: BLE001
        print(f"config.ini okunamadı: {e}")
        pause()
        sys.exit(1)

    # Google modu (refresh_token) → e-posta/parola gerekmez; yoksa bot modu ister.
    has_google = (cp.has_section("firebase")
                  and cp["firebase"].get("refresh_token", "").strip() != "")
    fb_keys = ["api_key", "database_url"] + ([] if has_google else ["email", "password"])
    required = (("firebase", fb_keys), ("race", ["team_id", "race_id"]))
    missing = []
    for sec, keys in required:
        if not cp.has_section(sec):
            missing.append(f"[{sec}] bölümü tamamen eksik")
            continue
        for k in keys:
            if not cp[sec].get(k, "").strip() or cp[sec].get(k, "").strip() == "DEGISTIR":
                missing.append(f"[{sec}] {k} boş/doldurulmamış")
    if missing:
        print(f"config.ini ({os.path.abspath(path)}) eksik/boş:")
        for m in missing:
            print("  -", m)
        print("\nDüzelt ve tekrar çalıştır. team_id/race_id web 'Canlı' sekmesinde yazıyor.")
        pause()
        sys.exit(1)
    return cp


def make_source(mock, no_rest=False, rest_interval=3.0):
    # Bilgi satırları stderr'e — stdout `--emit` modunda saf JSON kalmalı.
    # Aggregator sarar: kare kare tur geçmişi → avg5Sec/avgSec/stintSec.
    from rf2_source import Aggregator
    if mock:
        from rf2_source import MockSource
        print("[kaynak] MOCK — sahte veri (oyun okunmuyor)", file=sys.stderr)
        return Aggregator(MockSource())
    from rf2_source import RF2Source
    print("[kaynak] rFactor2/LMU paylaşımlı bellek"
          + (" · REST KAPALI (takılma testi)" if no_rest
             else f" · REST arka plan poller {rest_interval:g} sn"), file=sys.stderr)
    return Aggregator(RF2Source(no_rest=no_rest, rest_interval=rest_interval))


def _rest_interval_of(cp):
    """config [rate] rest_interval (sn) — varsayılan 3.0; 0.5..60 arasına klamplanır."""
    try:
        v = float(cp["rate"].get("rest_interval", "3")) if cp.has_section("rate") else 3.0
    except (ValueError, TypeError):
        v = 3.0
    return max(0.5, min(v, 60.0))


def build_payload(src, by):
    data = src.read()
    return {"ts": int(time.time() * 1000), "by": by,
            "session": data.get("session") or {},
            "own": data.get("own"), "field": data.get("field") or []}


def fb_from_cfg(cp):
    """(FirebaseClient, by) — config'te refresh_token varsa Google (kendi hesap) modu,
    yoksa bot (e-posta/parola). GUI 'Google ile Giriş' refresh_token'ı yazar."""
    from fb import FirebaseClient
    f = cp["firebase"]
    rt = f.get("refresh_token", "").strip()
    if rt:
        by = f.get("google_email", "").strip() or "bridge"
        return FirebaseClient(f["api_key"], f["database_url"], refresh_token=rt), by
    return (FirebaseClient(f["api_key"], f["database_url"],
                           f.get("email", ""), f.get("password", "")),
            f.get("email", ""))


def cmd_dump(mock):
    """Kaynaktan bir örnek oku ve JSON bas — Firebase'e dokunma."""
    src = make_source(mock)
    try:
        payload = build_payload(src, "dump")
    finally:
        if hasattr(src, "close"):
            src.close()
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    own = payload.get("own")
    print(f"\n[özet] {len(payload['field'])} araç · "
          f"own={'var' if own else 'yok'} · session alanları: {list(payload['session'])}")


def cmd_check_plugin():
    """PERFORMANS teşhisi — oyun eklentisinin hangi buffer'ları yazdığını göster.

    Neden: paylaşımlı bellek OKUMASI ucuzdur (kare başına ~0.3 MB); asıl yük eklentinin
    OYUN İÇİNDE yazdığı buffer'lardır (FFB+Graphics saniyede 400'er kez). Biz yalnız
    Telemetry+Scoring+Extended okuduğumuz için gerisi boşa gider. Firebase/config
    gerektirmez; hiçbir dosyaya YAZMAZ."""
    from plugin_cfg import find_lmu_root, read_plugin_cfg, buffer_advice, cfg_path
    exe = None
    try:
        import psutil
        for p in psutil.process_iter(["name", "exe"]):
            nm = (p.info.get("name") or "").lower()
            if "le mans ultimate" in nm or nm.startswith("rfactor2"):
                exe = p.info.get("exe")
                print(f"[oyun] çalışıyor: {exe}")
                break
    except Exception:
        pass
    root = find_lmu_root(exe)
    if not root:
        print("[kurulum] LMU klasörü bulunamadı (oyun kapalı ve yol standart değil).")
        print("          Ayar dosyası: <LMU>\\UserData\\player\\CustomPluginVariables.JSON")
        return
    print(f"[kurulum] {root}")
    cfg = read_plugin_cfg(root)
    if not cfg:
        print(f"[ayar] okunamadı: {cfg_path(root)} (dosya yok ya da bozuk)")
        return
    print(f"[ayar] {cfg['path']}")
    print(f"[eklenti] Enabled = {cfg['enabled']}"
          + ("  ⚠ 0/None ise oyun eklentiyi hiç yüklemez" if not cfg["enabled"] else ""))
    adv = buffer_advice(cfg["mask"])
    print(f"[maske] UnsubscribedBuffersMask = {cfg['mask']}  (0 = hiçbiri kapalı değil)")
    print(f"[yazılan] {', '.join(adv['on']) or '—'}")
    if adv["wasted"]:
        print(f"[BOŞA] {', '.join(adv['wasted'])} → saniyede ~{adv['wastedFps']} "
              "gereksiz yazım (bu uygulama bunları okumuyor)")
    else:
        print("[BOŞA] yok — ayar bu uygulama için ideal")
    if adv["suggest"] is not None:
        print("\nÖnerilen kademeler (oyunu KAPAT, JSON'da değiştir, aç):")
        for st in adv["steps"]:
            mark = "→" if st["value"] == adv["suggest"] else " "
            print(f"  {mark} UnsubscribedBuffersMask: {st['value']:>3}  {st['label']}")
            print(f"      risk: {st['risk']}")
        print("\nDiğer araçların (CrewChief/SimHub/TinyPedal) da açık olduğunu unutma —"
              "\nen güvenli değerle başla, sorun çıkmazsa bir üst kademeye geç.")


def cmd_dump_wx(mock):
    """HAVA DOĞRULAMA modu — Firebase'e dokunmaz, sürekli çalışır (Ctrl+C ile çık).

    Neden: uygulamada yağış/ıslaklık yüzdesini kelimeye çeviriyoruz (Damp, Slightly
    Wet…) ama bu eşikler TAHMİN — ne paylaşımlı bellekte ne de LMU REST'te ıslaklığı
    KELİME olarak veren bir alan var. Bu mod iki şeyi yan yana koyar:
      1) oyunun KENDİ gökyüzü/yağış sözlüğü (/rest/sessions/weather → WNV_SKY.stringValue)
      2) canlı ıslaklık/yağış yüzdeleri
    Islak bir seansta bunu açık bırakıp oyundaki yazıyla karşılaştırınca eşikler
    ölçümle düzeltilebilir."""
    try:
        from lmu_api import LmuApi
        sky = {}
        if not mock:
            api = LmuApi()
            api._load_sky()          # tek seferlik senkron çekim (poller yerine)
            sky = api.sky_labels()
    except Exception as e:  # noqa: BLE001  (REST kapalı → sözlük yok, canlı satır yine aksın)
        sky, e_sky = {}, e
        print(f"[hava sözlüğü] okunamadı: {e_sky}", file=sys.stderr)
    if sky:
        print("[hava sözlüğü] oyunun gökyüzü metinleri (/rest/sessions/weather · WNV_SKY):")
        for i in sorted(sky):
            print(f"   {i:>2} = {sky[i]}")
    else:
        print("[hava sözlüğü] boş — LMU REST kapalı ya da oyun açık değil "
              "(mock modda zaten sorgulanmaz).")
    print("\n[canlı] saniyede bir: ıslaklık ve yağış. Oyundaki yazıyla karşılaştır.\n"
          "        (Ctrl+C ile çık)\n")
    src = make_source(mock)
    try:
        while True:
            t0 = time.time()
            try:
                s = (src.read() or {}).get("session") or {}
            except Exception as e:  # noqa: BLE001  (okuma hatası → satır bas, devam)
                s = {"_err": str(e)}
            ts = time.strftime("%H:%M:%S")
            if "_err" in s:
                print(f"{ts}  okuma hatası: {s['_err']}")
            else:
                print(f"{ts}  ıslaklık %{s.get('wetness')}  ·  yağış %{s.get('rain')}"
                      f"  ·  raining={s.get('raining')}  ·  {s.get('sessionType') or '?'}"
                      f" / {s.get('phase') or '?'}")
            sys.stdout.flush()
            dt = time.time() - t0
            if dt < 1.0:
                time.sleep(1.0 - dt)
    except (KeyboardInterrupt, BrokenPipeError):
        pass
    finally:
        if hasattr(src, "close"):
            src.close()


def lower_priority():
    """Oyunla CPU çekişmesini azalt: köprü sürecini BELOW_NORMAL önceliğe al → çekişmede
    oyun (NORMAL) kazanır. hasattr guard'ı yalnız Windows (Linux/mac psutil.nice() farklı
    ölçek → mock akışı etkilenmesin). Hata sessiz."""
    try:
        import psutil
        if hasattr(psutil, "BELOW_NORMAL_PRIORITY_CLASS"):
            psutil.Process().nice(psutil.BELOW_NORMAL_PRIORITY_CLASS)
            return True
    except Exception:  # noqa: BLE001
        pass
    return False


def cmd_emit(mock, hz, no_rest=False):
    """Masaüstü sidecar modu: kaynaktan oku, her kareyi stdout'a bir JSON satırı
    olarak bas — Firebase'e DOKUNMA. Uygulama (JS) satırları okuyup ts/by ekleyerek
    kullanıcının oturumuyla yazar. team_id/race_id burada gerekmez."""
    period = 1.0 / max(0.2, min(hz, 10))
    lower_priority()  # sidecar standalone çalıştırılırsa/miras alınmazsa garanti
    try:
        src = make_source(mock, no_rest)
    except Exception as e:  # noqa: BLE001  (okuyucu/lib yok → hata karesi bas, çıkma)
        err = f"Okuyucu başlatılamadı: {e}"
        try:
            while True:
                sys.stdout.write(json.dumps({"error": err}) + "\n")
                sys.stdout.flush()
                time.sleep(2.0)
        except (KeyboardInterrupt, BrokenPipeError):
            return
    try:
        while True:
            t0 = time.time()
            try:
                data = src.read()
            except Exception as e:  # noqa: BLE001  (oyun kapalı/okuma hatası → satır bas, devam)
                data = {"error": str(e)}
            # tek satır JSON (JS satır satır ayrıştırır); flush şart (pipe tamponu).
            # ensure_ascii=True → Türkçe \uXXXX olarak kaçışlanır; reconfigure başarısız
            # olsa bile stdout saf ASCII (her zaman geçerli UTF-8). JS JSON.parse çözer.
            sys.stdout.write(json.dumps(data) + "\n")
            sys.stdout.flush()
            dt = time.time() - t0
            if dt < period:
                time.sleep(period - dt)
    except (KeyboardInterrupt, BrokenPipeError):
        pass
    finally:
        if hasattr(src, "close"):
            src.close()


def cmd_selftest(cp):
    """Firebase'e küçük bir işaret yaz, geri oku, eşleşiyorsa PASS."""
    fb, by = fb_from_cfg(cp)
    tid, rid = cp["race"]["team_id"].strip(), cp["race"]["race_id"].strip()
    try:
        print(f"[selftest] giriş: {by}")
        fb.sign_in()
        print(f"[selftest] giriş yapıldı — GERÇEK UID: {fb.uid}")
        print(f"           (bridgeBots/{fb.uid} = true olmalı — Firebase konsolunda")
        print(f"           bu UID'yi elle kopyalamana gerek yok, tam olarak bu satırdaki.)")
        marker = int(time.time() * 1000)
        print(f"[selftest] yaz: teams/{tid}/live/{rid} (ts={marker})")
        fb.put_live(tid, rid, {"ts": marker, "by": by, "selftest": True,
                               "session": {}, "own": None, "field": []})
        print("[selftest] geri oku...")
        back = fb.get_live(tid, rid)
        if back and back.get("ts") == marker:
            print("\n✅ SELFTEST PASS — Firebase giriş + yazma + okuma çalışıyor.")
            return 0
        print(f"\n❌ SELFTEST FAIL — yazıldı ama geri okunan ts uyuşmadı: {back}")
        return 1
    except Exception as e:  # noqa: BLE001
        msg = str(e)
        print(f"\n❌ SELFTEST FAIL — {msg}")
        if "401" in msg or "permission" in msg.lower() or "Yazma" in msg or "Okuma" in msg:
            print(f"   İpucu: yukarıdaki UID ({fb.uid}) için Firebase konsolunda kökte")
            print(f"   bridgeBots/{fb.uid} = true var mı? team_id/race_id doğru mu?")
        elif "Giriş" in msg:
            print("   İpucu: Firebase'de Email/Password açık mı, e-posta/parola doğru mu?")
        return 1


def run_loop(cp, mock, once, no_rest=None):
    from logfile import get_logger, heartbeat_line, log_path
    lg = get_logger()
    fb, by = fb_from_cfg(cp)
    tid, rid = cp["race"]["team_id"].strip(), cp["race"]["race_id"].strip()
    hz = float(cp["rate"].get("hz", "2")) if cp.has_section("rate") else 2.0
    period = 1.0 / max(0.2, min(hz, 10))
    # REST varsayılan KAPALI (oyun donmasının en güçlü şüphelisi). config [rate] rest_on
    # ile ya da --no-rest bayrağıyla belirlenir. no_rest=None → config'e bak.
    if no_rest is None:
        rest_on = cp.has_section("rate") and cp["rate"].get("rest_on", "").strip().lower() in ("1", "true", "yes", "on")
        no_rest = not rest_on
    rest_iv = _rest_interval_of(cp)
    low = lower_priority()  # oyunla çekişmede oyun kazansın

    lg.info("=== Köprü başladı === hedef teams/%s/live/%s · %g Hz · %s · REST:%s (aralık %gs) · öncelik:%s",
            tid, rid, hz, "MOCK" if mock else "oyun",
            "kapalı" if no_rest else "AÇIK", rest_iv, "düşük" if low else "normal")
    print(f"[log] {log_path()}")
    print(f"[firebase] giriş: {by}")
    try:
        fb.sign_in()
    except Exception as e:  # noqa: BLE001
        lg.error("giriş başarısız: %s", e)
        raise
    print(f"[firebase] giriş yapıldı — UID: {fb.uid}")
    lg.info("giriş OK — UID %s", fb.uid)
    print(f"[hedef] teams/{tid}/live/{rid}  ·  {hz:g} Hz  ·  REST "
          f"{'kapalı' if no_rest else f'açık (arka plan {rest_iv:g}s)'}"
          f"  (durdurmak için Ctrl+C)")
    src = make_source(mock, no_rest, rest_iv)
    fails = 0
    sent = 0
    last_hb = 0.0
    while True:
        t0 = time.time()
        try:
            payload = build_payload(src, by)
            t1 = time.time()
            fb.put_live(tid, rid, payload)
            t2 = time.time()
            fails = 0
            sent += 1
            fuel = (payload["own"] or {}).get("fuel")
            sys.stdout.write(f"\r[gönderildi] {time.strftime('%H:%M:%S')} · "
                             f"{len(payload['field'])} araç · yakıt {fuel if fuel is not None else '—'}   ")
            sys.stdout.flush()
            # Sağlık satırını dosyaya ~10 sn'de bir (dosya şişmesin) yaz.
            if t2 - last_hb >= 10:
                last_hb = t2
                lg.info(heartbeat_line(sent, len(payload["field"]), fuel,
                                       (t1 - t0) * 1000, (t2 - t1) * 1000))
            if once:
                print("\n[once] bir gönderim yapıldı, çıkılıyor.")
                lg.info("once: bir gönderim yapıldı, çıkılıyor.")
                break
        except KeyboardInterrupt:
            break
        except Exception as e:  # noqa: BLE001
            fails += 1
            print(f"\n[hata {fails}] {e}")
            lg.warning("[hata %d] %s", fails, e)
            if once:
                break
            time.sleep(min(2 ** min(fails, 4), 16))
        dt = time.time() - t0
        if dt < period:
            time.sleep(period - dt)
    print("\n[kapandı]")
    lg.info("=== Köprü durdu === toplam %d gönderim", sent)
    if hasattr(src, "close"):
        src.close()


def main():
    # Windows'ta Python stdout/stderr varsayılan olarak sistem locale'i (Türkçe
    # cp1254) olabilir → Türkçe karakterler (ör. "Yeşil"deki ş) tek bayt yazılır
    # ve Tauri sidecar çıktıyı UTF-8 çözerken hata verir. Çıktıyı UTF-8'e zorla.
    for _s in (sys.stdout, sys.stderr):
        try:
            _s.reconfigure(encoding="utf-8")
        except Exception:  # noqa: BLE001  (bazı ortamlarda stdout None/ayarlanamaz)
            pass

    from logfile import default_config_path
    ap = argparse.ArgumentParser(description="Caspian Live Bridge")
    ap.add_argument("--config", default=default_config_path(),
                    help="config.ini yolu (varsayılan: exe yanı ya da %LOCALAPPDATA%)")
    ap.add_argument("--mock", action="store_true", help="Oyunsuz sahte veri")
    ap.add_argument("--selftest", action="store_true", help="Firebase yaz+oku turu (PASS/FAIL)")
    ap.add_argument("--dump", action="store_true", help="Bir örnek oku, JSON bas (yazmaz)")
    ap.add_argument("--dump-wx", action="store_true", dest="dump_wx",
                    help="Hava doğrulama: oyunun gökyüzü sözlüğü + canlı ıslaklık/yağış")
    ap.add_argument("--check-plugin", action="store_true", dest="check_plugin",
                    help="PERFORMANS: eklenti hangi buffer'ları yazıyor + önerilen maske")
    ap.add_argument("--emit", action="store_true",
                    help="Sidecar: her kareyi stdout'a JSON satırı bas (Firebase'e yazmaz)")
    ap.add_argument("--hz", type=float, default=2.0, help="--emit gönderim hızı (varsayılan 2)")
    ap.add_argument("--once", action="store_true", help="Bir kez oku+gönder, çık")
    ap.add_argument("--nogui", action="store_true", help="Arayüzsüz, doğrudan config.ini ile çalış")
    ap.add_argument("--no-rest", action="store_true", dest="no_rest",
                    help="LMU REST'i kapat (takılma teşhisi): VE/takım/numara/yetkili bayrak "
                         "gelmez, oyunun localhost sunucusuna istek atılmaz")
    args = ap.parse_args()

    try:
        if args.emit:                     # masaüstü sidecar — Firebase/config gerekmez
            cmd_emit(args.mock, args.hz, args.no_rest)
            return
        if args.dump:                     # kaynağı göster — Firebase/config gerekmez
            cmd_dump(args.mock)
            return
        if args.dump_wx:                  # hava sözlüğü + canlı yüzdeler (doğrulama)
            cmd_dump_wx(args.mock)
            return
        if args.check_plugin:             # performans teşhisi — yalnız OKUR
            cmd_check_plugin()
            return
        if args.selftest:
            sys.exit(cmd_selftest(read_config_or_die(args.config)))
        # --no-rest verildiyse REST'i zorla kapat; verilmediyse None → config'e bak
        # (standalone köprüde REST varsayılan KAPALI, oyun donması).
        nr = True if args.no_rest else None
        if args.nogui or args.once or args.mock:
            run_loop(read_config_or_die(args.config), args.mock, args.once, no_rest=nr)
            return
        # varsayılan (çift tıklama, flag yok) → arayüz
        try:
            from gui import launch
        except Exception as e:  # noqa: BLE001  (tkinter yoksa CLI'ya düş)
            print(f"[arayüz açılamadı: {e}] — config.ini ile çalışılıyor.")
            run_loop(read_config_or_die(args.config), False, False, no_rest=nr)
            return
        launch(args.config)
    except SystemExit:
        raise
    except KeyboardInterrupt:
        pass
    except Exception as e:  # noqa: BLE001  (çift tıklamada pencere kapanmadan görünsün)
        print(f"\n[beklenmedik hata] {e}")
        pause()
        sys.exit(1)


if __name__ == "__main__":
    main()
