"""Caspian Live Bridge — LMU/rF2 → Firebase canlı timing köprüsü.

Oyunun çalıştığı PC'de çalışır: paylaşımlı bellekten (rFactor2 Shared Memory
Map Plugin) okur, teams/{tid}/live/{rid} düğümüne yazar. Web pit-wall bunu
salt-okunur dinler.

Kullanım:
    CaspianLiveBridge.exe                 # config.ini yanında olmalı
    CaspianLiveBridge.exe --mock          # oyunsuz test (sahte veri)
    CaspianLiveBridge.exe --config yol.ini
"""
import argparse
import configparser
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


def main():
    ap = argparse.ArgumentParser(description="Caspian Live Bridge")
    ap.add_argument("--config", default="config.ini")
    ap.add_argument("--mock", action="store_true", help="Oyunsuz sahte veri gönder")
    args = ap.parse_args()

    cp = load_config(args.config)
    fb = FirebaseClient(
        cp["firebase"]["api_key"], cp["firebase"]["database_url"],
        cp["firebase"]["email"], cp["firebase"]["password"],
    )
    tid = cp["race"]["team_id"].strip()
    rid = cp["race"]["race_id"].strip()
    hz = float(cp["rate"].get("hz", "2")) if cp.has_section("rate") else 2.0
    period = 1.0 / max(0.2, min(hz, 10))
    by = cp["firebase"]["email"]

    if not tid or not rid:
        sys.exit("config: [race] team_id ve race_id doldurulmalı.")

    print(f"[firebase] giriş: {by}")
    fb.sign_in()
    print(f"[hedef] teams/{tid}/live/{rid}  ·  {hz:g} Hz")

    src = make_source(args.mock)
    fails = 0
    while True:
        t0 = time.time()
        try:
            data = src.read()
            payload = {"ts": int(time.time() * 1000), "by": by,
                       "session": data.get("session") or {},
                       "own": data.get("own"), "field": data.get("field") or []}
            fb.put_live(tid, rid, payload)
            fails = 0
            n = len(payload["field"])
            fuel = (payload["own"] or {}).get("fuel")
            sys.stdout.write(f"\r[gönderildi] {time.strftime('%H:%M:%S')} · "
                             f"{n} araç · yakıt {fuel if fuel is not None else '—'}   ")
            sys.stdout.flush()
        except KeyboardInterrupt:
            break
        except Exception as e:  # noqa: BLE001
            fails += 1
            print(f"\n[hata {fails}] {e}")
            time.sleep(min(2 ** min(fails, 4), 16))  # geri çekilmeli yeniden dene
        dt = time.time() - t0
        if dt < period:
            time.sleep(period - dt)

    print("\n[kapandı]")
    if hasattr(src, "close"):
        src.close()


if __name__ == "__main__":
    main()
