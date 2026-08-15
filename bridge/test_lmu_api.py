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


def _pen(car):
    by, _ = parse([car])
    return by[str(car["driverName"]).lower()]["penalties"]


def test_ceza_standings_ten_okunur():
    # LMU cut/puan cezaları shmem mNumPenalties'e yansımıyor — REST yetkili kaynak
    assert _pen({"driverName": "A", "penalties": 1}) == 1
    assert _pen({"driverName": "A", "penalties": 2.0}) == 2      # float da gelebilir
    assert _pen({"driverName": "A", "penalties": 0}) == 0


def test_ceza_eksik_gecersizde_none():
    assert _pen({"driverName": "A"}) is None                     # alan yok → shmem kalır
    assert _pen({"driverName": "A", "penalties": "abc"}) is None
    assert _pen({"driverName": "A", "penalties": -1}) is None    # negatif saçma → None


def test_takim_numara_ve_oyuncu_ve_si():
    by, own = parse([
        {"driverName": "X", "veFraction": 0.5, "fullTeamName": "Caspian",
         "carNumber": 34, "player": True},
        {"driverName": "Y", "veFraction": 0.9, "teamName": "Iron Lynx", "carNumber": ""},
    ])
    assert by["x"] == {"ve": 50.0, "team": "Caspian", "number": "34", "penalties": None}
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


flags = LmuApi.parse_session_flags


def test_flags_green_default():
    """v1.4.74: YETKİLİ REST bayrağı. Yeşilken hiçbir sektör sarı olmamalı
    (kullanıcı bug'ı: green iken 'full yellow' sallanıyordu)."""
    assert flags({"GamePhase": 5, "YellowFlagState": "NoFlag",
                  "SectorFlag": ["", "", ""]}) == {"flag": "Green", "yellowSectors": []}
    # green kelimeleri de sarı sayılmaz
    assert flags({"YellowFlagState": "None",
                  "SectorFlag": ["Green", "Green", "Green"]})["flag"] == "Green"


def test_flags_lokal_sektor_sarisi_konumsal():
    assert flags({"GamePhase": 5, "YellowFlagState": "NoFlag",
                  "SectorFlag": ["", "Yellow", ""]}) == {"flag": "Yellow",
                                                         "yellowSectors": [2]}
    assert flags({"SectorFlag": ["Yellow", "", "Yellow"]})["yellowSectors"] == [1, 3]


def test_flags_v16_yesil_disi_deger_sari_sayilir():
    """v1.6: SectorFlag'te YEŞİL-DIŞI her değer (farklı kelime / sayısal kod) sarı sayılır
    (kullanıcı bug'ı: oyunda sarı, live'da yeşil). 'yellow' kelimesi şart DEĞİL."""
    # sayısal kod: sektör 2 = "1" (yeşil-dışı) → sarı
    assert flags({"YellowFlagState": "NoFlag", "SectorFlag": ["", "1", ""]}) == {
        "flag": "Yellow", "yellowSectors": [2]}
    # tamsayı dizi: 0=yeşil, 2=bayrak → sektör 3
    assert flags({"SectorFlag": [0, 0, 2]})["yellowSectors"] == [3]
    # farklı kelime ("Caution" değil ama yeşil-dışı bir söz) da yakalanır
    assert flags({"YellowFlagState": "NoFlag",
                  "SectorFlag": ["", "Waved", ""]})["flag"] == "Yellow"


def test_flags_v16_uc_sektor_nonfcy_yesil_guard():
    """v1.6 guard: FCY olmadan ÜÇ sektörün birden sarı gelmesi güvenilmez (v1.4.57
    yanlış full-yellow deseni) → yeşil. Gerçek tam-pist sarısı zaten FCY olur."""
    assert flags({"YellowFlagState": "NoFlag",
                  "SectorFlag": ["Yellow", "Yellow", "Yellow"]}) == {
        "flag": "Green", "yellowSectors": []}
    # ama FCY iken üç sektör de raporlanır (bilgi kaybolmaz)
    assert flags({"GamePhase": 6,
                  "SectorFlag": ["Yellow", "Yellow", "Yellow"]})["flag"] == "FCY"


def test_flags_fcy_gamephase_ve_yellowstate():
    assert flags({"GamePhase": 6, "YellowFlagState": "NoFlag"})["flag"] == "FCY"
    assert flags({"GamePhase": 5, "YellowFlagState": "PitClosed"})["flag"] == "FCY"
    # FCY sırasında lokal sarı da raporlanır (bilgi kaybolmaz)
    assert flags({"GamePhase": 6, "SectorFlag": ["", "", "Yellow"]}) == {
        "flag": "FCY", "yellowSectors": [3]}


def test_flags_alan_adi_buyuk_kucuk_tolere():
    assert flags({"gamePhase": 6})["flag"] == "FCY"          # camelCase da çözülür


def test_flags_bos_bozuk_none_doner():
    assert flags(None) is None
    assert flags([]) is None
    assert flags({"foo": "bar"}) is None                     # sessionInfo değil


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
