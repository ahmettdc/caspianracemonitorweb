"""LMU REST standings ayrıştırma testleri (bağımlılıksız — `python3 bridge/test_lmu_api.py`).

VE birimi LMU sürümüne göre değişebiliyor. Kritik: `veFraction` SAYISAL ama beklenen
aralığın dışındaysa toleranslı yedek (`_energy_of`) devreye girmeli — eskiden yedek
yalnız float() İSTİSNA atarsa çalışıyordu, yani sayısal ama geçersiz bir değer VE'yi
elde veri olsa bile sessizce None yapıyordu (VE sütunu tümüyle boşalırdı).
"""
import sys

from lmu_api import LmuApi

parse = LmuApi.parse_standings


def _ve(car):
    by, _ = parse([car])
    return by[str(car["driverName"]).lower()]["ve"]


def test_kesir_0_1_yuzdeye_cevrilir():
    assert _ve({"driverName": "A", "veFraction": 0.62}) == 62.0
    assert _ve({"driverName": "A", "veFraction": 1.0}) == 100.0
    assert _ve({"driverName": "A", "veFraction": 0.0}) == 0.0      # depo boş, None değil


def test_yuzde_olarak_gelirse_aynen_kullanilir():
    assert _ve({"driverName": "A", "veFraction": 62.0}) == 62.0
    assert _ve({"driverName": "A", "veFraction": 100}) == 100.0


def test_gecersiz_deger_yedege_duser():
    # sayısal ama kullanılamaz (negatif / >100) → yedek alan okunmalı
    assert _ve({"driverName": "A", "veFraction": -1, "virtualEnergy": 62.0}) == 62.0
    assert _ve({"driverName": "A", "veFraction": 150, "virtualEnergy": 62.0}) == 62.0
    # metin / None → yedek
    assert _ve({"driverName": "A", "veFraction": "abc", "virtualEnergy": 62.0}) == 62.0
    assert _ve({"driverName": "A", "veFraction": None, "virtualEnergy": 62.0}) == 62.0


def test_alan_hic_yoksa_yedek_ve_hicbiri_yoksa_none():
    assert _ve({"driverName": "A", "virtualEnergy": 62.0}) == 62.0
    assert _ve({"driverName": "A"}) is None


def test_takim_numara_ve_oyuncu_ve_si():
    by, own = parse([
        {"driverName": "X", "veFraction": 0.5, "fullTeamName": "Caspian",
         "carNumber": 34, "player": True},
        {"driverName": "Y", "veFraction": 0.9, "teamName": "Iron Lynx", "carNumber": ""},
    ])
    assert by["x"] == {"ve": 50.0, "team": "Caspian", "number": "34"}
    assert by["y"]["team"] == "Iron Lynx"
    assert by["y"]["number"] is None
    assert own == 50.0


def test_bozuk_kayitlar_atlanir():
    by, own = parse([None, "x", 5, {"driverName": "A", "veFraction": 0.4}])
    assert list(by) == ["a"]
    assert own is None


sky = LmuApi.parse_sky_labels


def test_sky_sozlugu_tum_seans_ve_dugumlerden_toplanir():
    """/rest/sessions/weather → {indeks: OYUNUN metni}. Oyunun yağış sözlüğünü tahmin
    etmek yerine buradan okuyoruz (paylaşımlı bellek yalnız 0..1 sayı verir)."""
    got = sky({
        "PRACTICE": {
            "START":  {"WNV_SKY": {"currentValue": 0, "stringValue": "Clear"}},
            "FINISH": {"WNV_SKY": {"currentValue": 4, "stringValue": "Light Rain"}},
        },
        "RACE": {
            "NODE_50": {"WNV_SKY": {"currentValue": 6, "stringValue": "Heavy Rain"}},
        },
    })
    assert got == {0: "Clear", 4: "Light Rain", 6: "Heavy Rain"}


def test_sky_bozuk_eksik_sekiller_cokmez():
    assert sky(None) == {}
    assert sky([]) == {}
    assert sky({"RACE": "x"}) == {}
    assert sky({"RACE": {"START": {}}}) == {}                       # WNV_SKY yok
    assert sky({"RACE": {"START": {"WNV_SKY": {"currentValue": "a",
                                               "stringValue": "Clear"}}}}) == {}
    assert sky({"RACE": {"START": {"WNV_SKY": {"currentValue": 2,
                                               "stringValue": "  "}}}}) == {}  # boş metin


def test_sky_float_indeks_ve_bosluk_temizligi():
    got = sky({"RACE": {"START": {"WNV_SKY": {"currentValue": 3.0,
                                              "stringValue": " Overcast "}}}})
    assert got == {3: "Overcast"}


if __name__ == "__main__":
    fails = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"  ok  {name}")
            except AssertionError as e:  # noqa: PERF203
                fails += 1
                print(f"FAIL  {name}: {e}")
    print("TÜMÜ GEÇTİ" if not fails else f"{fails} test BAŞARISIZ")
    sys.exit(1 if fails else 0)
