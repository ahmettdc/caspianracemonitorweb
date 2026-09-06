"""Telemetri↔scoring eşleme testleri (bağımlılıksız — `python3 bridge/test_rf2_tele_map.py`).

Kök-neden kaydı (v2.4.1): eşleme döngüsü telemetri dizisini SCORING'in
`mNumVehicles`'ı ile tarıyordu. Telemetri online'da scoring'den AZ araç yayınlar;
eklentinin hiç yazmadığı slotların `mID`'si 0 olduğu için `tele_by_id[0] = boş`
ataması slot 0'daki GERÇEK aracın telemetrisini eziyor ve o araç için
tyres4=[0,0,0,0] / tyreWear=0 / damage=0 üretiyordu — yani oyunun vermediği bir
veri "sıfır" diye uydurulmuş oluyordu (CLAUDE.md §1).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pyRfactor2SharedMemory.rF2data import rF2Scoring, rF2Telemetry  # noqa: E402
from rf2_source import RF2Source  # noqa: E402


class _FakeApi:
    def __init__(self, scor, tele):
        self.Rf2Scor, self.Rf2Tele, self.Rf2Ext = scor, tele, None


def _src(scor, tele):
    """RF2Source'u __init__'siz kur — paylaşımlı bellek/REST'e hiç dokunma."""
    s = object.__new__(RF2Source)
    s.api = _FakeApi(scor, tele)
    s.lmu = None
    s.plugin = None
    s.plugin_at = 1e18      # _plugin_diag'ın psutil taramasına girmesini engelle
    return s


def _build(scoring_cars, tele_cars, tele_num=None):
    """scoring_cars: [(mID, konum)] · tele_cars: [(mID, diş 0..1)] (None = yazılmamış slot)"""
    scor, tele = rF2Scoring(), rF2Telemetry()
    scor.mScoringInfo.mNumVehicles = len(scoring_cars)
    scor.mScoringInfo.mSession = 10          # yarış
    scor.mScoringInfo.mLapDist = 5000.0
    for i, (vid, pos) in enumerate(scoring_cars):
        v = scor.mVehicles[i]
        v.mID, v.mPlace, v.mIsPlayer = vid, pos, 1 if i == 0 else 0
        v.mTotalLaps, v.mLapDist = 5, 100.0
    tele.mNumVehicles = len(tele_cars) if tele_num is None else tele_num
    for i, entry in enumerate(tele_cars):
        if entry is None:                    # eklentinin hiç yazmadığı slot: mID = 0
            continue
        vid, tread = entry
        tv = tele.mVehicles[i]
        tv.mID, tv.mIsPlayer = vid, 1 if i == 0 else 0
        tv.mElapsedTime = 120.0
        for w in range(4):
            tv.mWheels[w].mWear = tread
    return scor, tele


def _by_id(payload):
    return {r.get("carId"): r for r in payload["field"]}


def test_telemetri_scoring_dan_az_arac_yayinlarsa_gercek_arac_ezilmez():
    # 3 araç scoring'de (mID 0,1,2); telemetri YALNIZ slot 0'ı yazmış ve bunu
    # kendi mNumVehicles=1 alanıyla söylüyor. Scoring'in 3'ü ile taranırsa
    # yazılmamış slot 1-2 (mID=0) slot 0'ın kaydını ezer.
    scor, tele = _build([(0, 1), (1, 2), (2, 3)], [(0, 0.78), None, None], tele_num=1)
    payload = _src(scor, tele).read()
    me = _by_id(payload)[0]
    assert me["tyres4"] == [0.78, 0.78, 0.78, 0.78], me["tyres4"]
    assert me["tyreWear"] == 0.78, me["tyreWear"]


def test_bayat_slot_esleme_disi_kalir():
    # Telemetri 2 araç diyor ama dizide önceki lobiden kalma 3. bir kayıt duruyor.
    scor, tele = _build([(0, 1), (1, 2), (3, 3)],
                        [(0, 0.90), (1, 0.85), (3, 0.12)], tele_num=2)
    payload = _src(scor, tele).read()
    rows = _by_id(payload)
    assert rows[0]["tyreWear"] == 0.90, rows[0]["tyreWear"]
    assert rows[1]["tyreWear"] == 0.85, rows[1]["tyreWear"]
    # mID 3 telemetriye göre YOK → aşınma okunmamalı (0 diye uydurulmamalı da)
    assert rows[3].get("tyreWear") is None, rows[3].get("tyreWear")


def test_telemetri_tam_dolu_oldugunda_davranis_degismez():
    scor, tele = _build([(0, 1), (1, 2)], [(0, 0.70), (1, 0.60)])
    rows = _by_id(_src(scor, tele).read())
    assert rows[0]["tyreWear"] == 0.70 and rows[1]["tyreWear"] == 0.60


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
