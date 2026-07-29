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


def load_config(path):
    if not os.path.exists(path):
        sys.exit(f"config bulunamadı: {path}\n(config.example.ini'yi config.ini olarak kopyala ve doldur.)")
    cp = configparser.ConfigParser()
    cp.read(path, encoding="utf-8")
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
    """Kaynaktan bir örnek oku ve JSON bas — Firebase'e dokunma.
    Gerçek modda LMU'dan tam olarak ne çözüldüğünü gösterir (alan doğrulama)."""
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
    if not tid or not rid:
        print("SELFTEST FAIL — config: [race] team_id/race_id boş."); return 1
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
            print("   (Web 'Canlı' sekmesi bu yarışta bağlanabilir.)")
            return 0
        print(f"\n❌ SELFTEST FAIL — yazıldı ama geri okunan ts uyuşmadı: {back}")
        return 1
    except Exception as e:  # noqa: BLE001
        msg = str(e)
        print(f"\n❌ SELFTEST FAIL — {msg}")
        if "401" in msg or "permission" in msg.lower() or "Yazma" in msg:
            print("   İpucu: bot hesabı users/{uid}/allowed=true mı, takıma 'editor' mü,")
            print("   team_id/race_id doğru mu? (Web 'Canlı' sekmesinde yazıyor.)")
        elif "Giriş" in msg or "signInWith" in msg:
            print("   İpucu: Firebase'de Email/Password sağlayıcısı açık mı, e-posta/parola doğru mu?")
        return 1


def run_loop(cp, mock, once):
    fb = FirebaseClient(cp["firebase"]["api_key"], cp["firebase"]["database_url"],
                        cp["firebase"]["email"], cp["firebase"]["password"])
    tid, rid = cp["race"]["team_id"].strip(), cp["race"]["race_id"].strip()
    by = cp["firebase"]["email"]
    hz = float(cp["rate"].get("hz", "2")) if cp.has_section("rate") else 2.0
    period = 1.0 / max(0.2, min(hz, 10))
    if not tid or not rid:
        sys.exit("config: [race] team_id ve race_id doldurulmalı.")

    print(f"[firebase] giriş: {by}")
    fb.sign_in()
    print(f"[hedef] teams/{tid}/live/{rid}  ·  {hz:g} Hz")
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
    args = ap.parse_args()

    if args.dump:                       # kaynağı göster — Firebase gerekmez
        cmd_dump(args.mock)
        return
    cp = load_config(args.config)
    if args.selftest:
        sys.exit(cmd_selftest(cp))
    run_loop(cp, args.mock, args.once)


if __name__ == "__main__":
    main()
