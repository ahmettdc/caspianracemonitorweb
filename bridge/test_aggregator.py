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

    def __init__(self, seq):
        self.seq = list(seq)
        self.i = 0

    def read(self):
        laps, last = self.seq[min(self.i, len(self.seq) - 1)]
        self.i += 1
        return {"session": {}, "own": None, "field": [{
            "pos": 1, "driver": "A. Demircan", "lapsDone": laps, "lastSec": last,
            "bestSec": 100.0, "inPits": False}]}


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
    # lapsDone geriler (yeni seans) → geçmiş sıfırlanır
    r = _run([(0, -1), (1, 101.0), (2, 100.5), (0, -1), (1, 99.0)])
    assert r["lapNums"] == [1], r["lapNums"]


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
