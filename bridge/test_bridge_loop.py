"""Köprü döngüsü ve kaynak yönetimi testleri (bağımlılıksız —
`python3 bridge/test_bridge_loop.py`).

Üç kök-neden kaydı (v2.4.1):

1) HARVEST HATASI BACKOFF'SUZ YENİDEN DENENİYORDU. `apply_harvest` hatayı
   FIRLATMIYOR, döndürüyor; döngüdeki `fails` sayacı yalnız `except` dalında
   arttığı için üstel bekleme HİÇ devreye girmiyordu. Her karede kuyruğun ilk
   patch'i yeniden deneniyor ve `requests.patch(..., timeout=15)` ağ
   kara-deliğinde 15 sn BLOKLUYORDU → canlı kare periyodu 0,5 sn'den ~15-30
   sn'ye çıkıyordu, tam da pit duvarının canlı veriye en çok ihtiyaç duyduğu
   anda (CLAUDE.md §0).

2) `hz` AYRIŞTIRMASI KORUMASIZDI. Bozuk/boş değer (`hz = 2,0` — Türkçe
   locale'de olası) ValueError atıyor, bu da run_loop'un try/except'lerinin
   DIŞINDA olduğu için köprü sys.exit(1) ile kapanıyordu.

3) `close()` HİÇBİR mmap'İ KAPATMIYORDU. Üç close() tek try içindeydi ve canlı
   ctypes görünümleri yüzünden ilki BufferError atıp kalan ikisini atlatıyordu.
"""
import configparser
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import _hz_of, apply_harvest, HARVEST_BACKOFF_MAX  # noqa: E402


class _Harv:
    """process() sabit bir patch üretir; kareyi de kırpar (gerçek Harvester gibi)."""
    def __init__(self):
        self.total_written = 7
        self.frame_written = 1
        self.calls = 0

    def process(self, payload):
        self.calls += 1
        if isinstance(payload, dict):
            payload.pop("laps", None)          # kırpma
        return [{"livelaps/r1/c7/1": 101.0}]


class _FB:
    def __init__(self, fail=False):
        self.fail, self.patches = fail, 0

    def patch_team(self, tid, upd):
        self.patches += 1
        if self.fail:
            raise RuntimeError("ağ yok")


def test_hz_bozuk_deger_cokertmez():
    def cp(v):
        c = configparser.ConfigParser()
        c["rate"] = {"hz": v}
        return c
    assert _hz_of(cp("2")) == 2.0
    assert _hz_of(cp("4")) == 4.0
    assert _hz_of(cp("2,0")) == 2.0        # Türkçe locale yazımı
    assert _hz_of(cp("")) == 2.0
    assert _hz_of(cp("abc")) == 2.0
    assert _hz_of(cp("0")) == 2.0          # 0 Hz diye bir yayın yok
    assert _hz_of(cp("-3")) == 2.0
    assert _hz_of(configparser.ConfigParser()) == 2.0   # [rate] bölümü yok


def test_send_false_agi_hic_cagirmaz_ama_kareyi_kirpar():
    fb, harv = _FB(), _Harv()
    payload = {"laps": [1, 2, 3], "field": []}
    pend, err = apply_harvest(fb, "t1", harv, payload, [], send=False)
    assert fb.patches == 0, fb.patches            # AĞA DOKUNULMADI
    assert err is None
    assert "laps" not in payload                   # kare yine de kırpıldı
    assert payload["lapsWritten"] == 7
    assert len(pend) == 1                          # patch kuyrukta bekliyor


def test_send_true_yazar_ve_kuyrugu_bosaltir():
    fb, harv = _FB(), _Harv()
    pend, err = apply_harvest(fb, "t1", harv, {"field": []}, [], send=True)
    assert fb.patches == 1 and err is None and pend == []


def test_hatada_kuyruk_korunur_ve_20_ile_sinirli():
    fb, harv = _FB(fail=True), _Harv()
    pend, err = apply_harvest(fb, "t1", harv, {"field": []}, [{"a": 1}] * 30, send=True)
    assert err is not None
    assert len(pend) == 20, len(pend)


def test_backoff_ustel_ve_tavanli():
    """Döngüdeki hesabın kendisi: h_skip = min(2**min(n,5), TAVAN)."""
    seen = [min(2 ** min(n, 5), HARVEST_BACKOFF_MAX) for n in range(1, 9)]
    assert seen == [2, 4, 8, 16, 32, 32, 32, 32], seen
    # 2 Hz'de 32 kare ≈ 16 sn: bir 15 sn'lik timeout'un maliyetini karşılar
    assert HARVEST_BACKOFF_MAX == 32


def test_close_tum_eslemeleri_kapatir():
    """rF2data.SimInfo.close: canlı görünümler bırakılır, her mmap kendi try'ında."""
    import ctypes as _ct
    import mmap as _mmap
    from pyRfactor2SharedMemory.rF2data import (SimInfo, rF2Telemetry,
                                                rF2Scoring, rF2Extended)

    class _Fake(SimInfo):
        def __init__(self):            # gerçek paylaşımlı belleğe DOKUNMA
            self._rf2_tele = _mmap.mmap(-1, _ct.sizeof(rF2Telemetry))
            self._rf2_scor = _mmap.mmap(-1, _ct.sizeof(rF2Scoring))
            self._rf2_ext = _mmap.mmap(-1, _ct.sizeof(rF2Extended))
            # GERÇEK durum: görünüm AYNI mmap üzerinde kurulur. Eskiden bu
            # yüzden ilk close() "cannot close exported pointers exist" atıyor,
            # except onu yutuyor ve ÜÇÜ DE açık kalıyordu.
            self.Rf2Tele = rF2Telemetry.from_buffer(self._rf2_tele)
            self.Rf2Scor = rF2Scoring.from_buffer(self._rf2_scor)
            self.Rf2Ext = rF2Extended.from_buffer(self._rf2_ext)

    f = _Fake()
    f.close()
    for name in ("_rf2_tele", "_rf2_scor", "_rf2_ext"):
        assert getattr(f, name).closed, f"{name} KAPANMADI (eski kodda ÜÇÜ DE açık kalıyordu)"


def main():
    fails = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"  ok  {name}")
            except AssertionError as e:
                fails += 1
                print(f"FAIL  {name}: {e}")
    print("TÜMÜ GEÇTİ" if not fails else f"{fails} TEST BAŞARISIZ")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
