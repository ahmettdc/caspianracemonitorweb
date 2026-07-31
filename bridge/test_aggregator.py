"""Aggregator tur log'u regresyon testleri (bağımlılıksız — `python3 bridge/test_aggregator.py`).

Kritik sözleşme: `lapNums`, `laps` ile birebir hizalı GERÇEK tur numaralarını taşır.
Log boşluklu olabilir (geçersiz tur atlanır ya da lapsDone >1 atlar); JS bu numaraları
kalıcı livelaps/livepos/livesec düğümlerine anahtar olarak yazar. Ardışık varsaymak
tur kaymasına (tur 4'ün süresi tur 3 diye) ve kalıcı veri bozulmasına yol açıyordu.
"""
import sys

from rf2_source import Aggregator


class _Fake:
    """Tek aracı kare kare besler: (lapsDone, lastSec) dizisi."""

    def __init__(self, seq, car_id=None, driver="A. Demircan"):
        self.seq = list(seq)
        self.i = 0
        self.car_id = car_id
        self.driver = driver

    def read(self):
        laps, last = self.seq[min(self.i, len(self.seq) - 1)]
        self.i += 1
        row = {"pos": 1, "driver": self.driver, "lapsDone": laps, "lastSec": last,
               "bestSec": 100.0, "inPits": False}
        if self.car_id is not None:
            row["carId"] = self.car_id
        return {"session": {}, "own": None, "field": [row]}


class _Swap:
    """Aynı ARAÇ (carId sabit), belirtilen turda pilot değişimi (driver swap)."""

    def __init__(self, seq, car_id=7):
        self.seq = list(seq)   # (lapsDone, lastSec, driver)
        self.i = 0
        self.car_id = car_id

    def read(self):
        laps, last, drv = self.seq[min(self.i, len(self.seq) - 1)]
        self.i += 1
        return {"session": {}, "own": None, "field": [{
            "pos": 1, "carId": self.car_id, "driver": drv, "lapsDone": laps,
            "lastSec": last, "bestSec": 100.0, "inPits": False}]}


def _run(seq):
    agg = Aggregator(_Fake(seq))
    data = None
    for _ in range(len(seq)):
        data = agg.read()
    return data["field"][0]


def test_gecersiz_tur_bosluk_birakir_ama_numaralar_dogru():
    # tur 3 geçersiz (lastSec<=0) → log'a girmez; 4 ve 5 GERÇEK numaralarıyla kalmalı
    r = _run([(0, -1), (1, 101.0), (2, 100.5), (3, -1.0), (4, 102.0), (5, 100.9)])
    assert r["lapNums"] == [1, 2, 4, 5], r["lapNums"]
    assert r["laps"] == [101.0, 100.5, 102.0, 100.9], r["laps"]
    assert r["lapsFrom"] == 1                      # eski sözleşme korunur
    # eski ardışık varsayım kayma üretirdi:
    eski = [r["lapsFrom"] + i for i in range(len(r["laps"]))]
    assert eski == [1, 2, 3, 4] and eski != r["lapNums"]


def test_laps_atlarsa_numaralar_dogru():
    # kare kaçırma / uygulama kısılması: lapsDone 5 → 8
    r = _run([(4, 99.0), (5, 100.0), (8, 101.0)])
    assert r["lapNums"] == [5, 8], r["lapNums"]


def test_ardisik_normal_durum():
    r = _run([(0, -1), (1, 101.0), (2, 100.5), (3, 100.7)])
    assert r["lapNums"] == [1, 2, 3]
    assert len(r["lapNums"]) == len(r["laps"])


def test_yeni_seans_sifirlar():
    """lapsDone KALICI gerilerse (≥REGRESS_FRAMES ardışık kare) → yeni seans, geçmiş
    sıfırlanır. Tek karelik gerileme artık sıfırlamaz (yırtık okuma filtresi) —
    gerileme bu yüzden 3 kare beslenir."""
    r = _run([(0, -1), (1, 101.0), (2, 100.5),
              (0, -1), (0, -1), (0, -1),           # kalıcı gerileme → sıfırla
              (1, 99.0)])
    assert r["lapNums"] == [1], r["lapNums"]


def test_tek_karelik_gerileme_gecmisi_korur():
    """Paylaşımlı bellek YIRTIK okunduğunda (oyun tam yazarken) lapsDone bir anlığına
    düşük görünebilir. Eskiden bu 'yeni seans' sayılıp hist sıfırlanıyor, AVG5/AVG
    ekranda yanıp sönüyordu. Tek karelik düşüş artık yok sayılır."""
    seq = [(1, 101.0), (2, 100.5), (3, 100.7), (0, -1.0), (3, 100.7), (4, 100.9)]
    agg = Aggregator(_Fake(seq))
    frames = [agg.read()["field"][0] for _ in range(len(seq))]
    dip = frames[3]                                   # yırtık kare
    assert dip["avgSec"] is not None                  # AVG kaybolmadı (eskiden None)
    assert dip["lapNums"] == [2, 3], dip["lapNums"]   # log korundu
    final = frames[-1]
    assert final["lapNums"] == [2, 3, 4], final["lapNums"]  # akış kesintisiz sürdü


def test_pilot_degisiminde_arac_gecmisi_korunur():
    """Endurance driver swap: sürücü adı değişir ama ARAÇ aynıdır → lapKey ve tur
    geçmişi kesintisiz kalmalı. (Eskiden sürücü adıyla anahtarlandığı için lapKey
    değişiyor, tur log'u sıfırlanıyor, "+" listesi yarışın başını kaybediyordu.)"""
    agg = Aggregator(_Swap([(1, 101.0, "A. Demircan"), (2, 100.5, "A. Demircan"),
                            (3, 100.7, "M. Yilmaz"), (4, 100.9, "M. Yilmaz")]))
    keys, data = [], None
    for _ in range(4):
        data = agg.read()
        keys.append(data["field"][0]["lapKey"])
    r = data["field"][0]
    assert len(set(keys)) == 1, keys                  # lapKey hiç değişmedi
    assert keys[0] == "c7", keys[0]
    assert r["lapNums"] == [2, 3, 4], r["lapNums"]    # geçmiş kesintisiz
    assert r["avgSec"] is not None                    # ortalama sıfırlanmadı


def test_ayni_isimli_iki_arac_ayri_anahtar_alir():
    a = Aggregator(_Fake([(1, 100.0)], car_id=3, driver="Ali Veli"))
    b = Aggregator(_Fake([(1, 100.0)], car_id=9, driver="Ali Veli"))
    ka = a.read()["field"][0]["lapKey"]
    kb = b.read()["field"][0]["lapKey"]
    assert ka != kb, (ka, kb)


def test_carid_yoksa_surucu_adina_duser():
    """Eski köprü akışı / carId üretmeyen kaynak → geriye uyumlu davranış."""
    r = _run([(0, -1), (1, 101.0)])
    assert r["lapKey"] == "A__Demircan", r["lapKey"]


def test_carid_sifir_gecerli_kimliktir():
    r = Aggregator(_Fake([(1, 100.0)], car_id=0)).read()["field"][0]
    assert r["lapKey"] == "c0", r["lapKey"]


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
