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

from fb import FirebaseClient

CONFIG_TEMPLATE = """; Caspian Live Bridge — yapılandırma
; [firebase] email/password ve [race] team_id/race_id'yi doldur.

[firebase]
api_key = AIzaSyB9hEH26etwvn9adAGNOpPAlpUym1qzpns
database_url = https://caspian-race-control-default-rtdb.europe-west1.firebasedatabase.app
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

    required = (("firebase", ["api_key", "database_url", "email", "password"]),
                ("race", ["team_id", "race_id"]))
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


def make_source(mock):
    if mock:
        from rf2_source import MockSource
        print("[kaynak] MOCK — sahte veri (oyun okunmuyor)")
        return MockSource()
    from rf2_source import RF2Source
    print("[kaynak] rFactor2/LMU paylaşımlı bellek")
    return RF2Source()


def build_payload(src, by):
    data = src.read()
    return {"ts": int(time.time() * 1000), "by": by,
            "session": data.get("session") or {},
            "own": data.get("own"), "field": data.get("field") or []}


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


def cmd_selftest(cp):
    """Firebase'e küçük bir işaret yaz, geri oku, eşleşiyorsa PASS."""
    fb = FirebaseClient(cp["firebase"]["api_key"], cp["firebase"]["database_url"],
                        cp["firebase"]["email"], cp["firebase"]["password"])
    tid, rid = cp["race"]["team_id"].strip(), cp["race"]["race_id"].strip()
    by = cp["firebase"]["email"]
    try:
        print(f"[selftest] giriş: {by}")
        fb.sign_in()
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
            print("   İpucu: bot hesabı users/{uid}/allowed=true mı, takıma 'editor' mü,")
            print("   team_id/race_id doğru mu? (Web 'Canlı' sekmesinde yazıyor.)")
        elif "Giriş" in msg:
            print("   İpucu: Firebase'de Email/Password açık mı, e-posta/parola doğru mu?")
        return 1


def run_loop(cp, mock, once):
    fb = FirebaseClient(cp["firebase"]["api_key"], cp["firebase"]["database_url"],
                        cp["firebase"]["email"], cp["firebase"]["password"])
    tid, rid = cp["race"]["team_id"].strip(), cp["race"]["race_id"].strip()
    by = cp["firebase"]["email"]
    hz = float(cp["rate"].get("hz", "2")) if cp.has_section("rate") else 2.0
    period = 1.0 / max(0.2, min(hz, 10))

    print(f"[firebase] giriş: {by}")
    fb.sign_in()
    print(f"[hedef] teams/{tid}/live/{rid}  ·  {hz:g} Hz  (durdurmak için Ctrl+C)")
    src = make_source(mock)
    fails = 0
    while True:
        t0 = time.time()
        try:
            payload = build_payload(src, by)
            fb.put_live(tid, rid, payload)
            fails = 0
            fuel = (payload["own"] or {}).get("fuel")
            sys.stdout.write(f"\r[gönderildi] {time.strftime('%H:%M:%S')} · "
                             f"{len(payload['field'])} araç · yakıt {fuel if fuel is not None else '—'}   ")
            sys.stdout.flush()
            if once:
                print("\n[once] bir gönderim yapıldı, çıkılıyor.")
                break
        except KeyboardInterrupt:
            break
        except Exception as e:  # noqa: BLE001
            fails += 1
            print(f"\n[hata {fails}] {e}")
            if once:
                break
            time.sleep(min(2 ** min(fails, 4), 16))
        dt = time.time() - t0
        if dt < period:
            time.sleep(period - dt)
    print("\n[kapandı]")
    if hasattr(src, "close"):
        src.close()


def main():
    ap = argparse.ArgumentParser(description="Caspian Live Bridge")
    ap.add_argument("--config", default="config.ini")
    ap.add_argument("--mock", action="store_true", help="Oyunsuz sahte veri")
    ap.add_argument("--selftest", action="store_true", help="Firebase yaz+oku turu (PASS/FAIL)")
    ap.add_argument("--dump", action="store_true", help="Bir örnek oku, JSON bas (yazmaz)")
    ap.add_argument("--once", action="store_true", help="Bir kez oku+gönder, çık")
    ap.add_argument("--nogui", action="store_true", help="Arayüzsüz, doğrudan config.ini ile çalış")
    args = ap.parse_args()

    try:
        if args.dump:                     # kaynağı göster — Firebase/config gerekmez
            cmd_dump(args.mock)
            return
        if args.selftest:
            sys.exit(cmd_selftest(read_config_or_die(args.config)))
        if args.nogui or args.once or args.mock:
            run_loop(read_config_or_die(args.config), args.mock, args.once)
            return
        # varsayılan (çift tıklama, flag yok) → arayüz
        try:
            from gui import launch
        except Exception as e:  # noqa: BLE001  (tkinter yoksa CLI'ya düş)
            print(f"[arayüz açılamadı: {e}] — config.ini ile çalışılıyor.")
            run_loop(read_config_or_die(args.config), False, False)
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
