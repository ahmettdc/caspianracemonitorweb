"""Harvester regresyon testleri (bağımlılıksız — `python3 bridge/test_harvest.py`).

Kritik sözleşme: hafif köprü, JS liveBridge.harvestLaps ile AYNI kalıcı düğümleri
(livelaps/livepos/livesec/livedrv/livetyre/livecond/livewear) aynı anahtar/değer
biçimiyle
yazar ve kareyi aynı biçimde kırpar. Bu port olmadan hafif köprüyle "+" tur listesi
popup'ı her araçta boş kalıyordu (kullanıcı bug'ı: "last lap atıldı ama kaydetmiyor").
"""
import sys

from harvest import Harvester, rubber_pct


def _frame(rows, sid="10", session=None):
    s = {"sessionId": sid, "sessionType": "Yarış", "trackTemp": 31.2, "wetness": 4.0}
    if session:
        s.update(session)
    return {"session": s, "own": None, "field": rows}


def _row(key="c7", laps=None, nums=None, **over):
    r = {"pos": 3, "driver": "A. Demircan", "lapKey": key, "lapsDone": (nums or [0])[-1],
         "laps": laps or [], "lapNums": nums or [], "pitStops": 0}
    r.update(over)
    return r


def test_yeni_turlar_yazilir_ve_kare_kirpilir():
    h = Harvester("r1")
    f = _frame([_row(laps=[101.0, 100.5], nums=[1, 2], lastSectors=[27.9, 48.2, 24.4],
                     tyreChange={"n": 2, "corners": ["fl", "fr"], "lap": 2})])
    patches = h.process(f)
    assert len(patches) == 1, patches
    u = patches[0]
    assert u["livelaps/r1/c7/1"] == 101.0 and u["livelaps/r1/c7/2"] == 100.5
    assert u["livepos/r1/c7/1"] == 3 and u["livepos/r1/c7/2"] == 3
    assert u["livedrv/r1/c7/1"] == "A. Demircan"          # ilk turda pilot yazılır
    assert u["livesec/r1/c7/2"] == "27.9,48.2,24.4"       # yalnız en yeni tur
    assert "livesec/r1/c7/1" not in u
    assert u["livecond/r1/c7/2"].startswith("31,4,")      # temp,wet,grip
    row = f["field"][0]
    # v2.3.0: tyreChange KARE'DE KALIR — Pit sütunu lastik değişim rozetini bu
    # alandan çiziyor. Hafif .exe köprü (README'nin sürüş PC'si için önerdiği yol)
    # onu siliyordu, rozet asıl kullanılacağı yolda hiç görünmüyordu.
    assert row.get("tyreChange") == {"n": 2, "corners": ["fl", "fr"], "lap": 2}, row
    for fld in ("laps", "lapsFrom", "lapNums"):
        assert fld not in row                              # kare küçük (JS ile aynı)


def test_idempotent_ayni_kare_ikinci_kez_yazmaz():
    h = Harvester("r1")
    h.process(_frame([_row(laps=[101.0], nums=[1])]))
    p2 = h.process(_frame([_row(laps=[101.0], nums=[1])]))
    assert p2 == [], p2


def test_total_written_sayaci():
    # v1.8.13: web "N tur kaydetti" için yazılan tur sayacı
    h = Harvester("r1")
    assert h.total_written == 0
    h.process(_frame([_row(laps=[101.0, 100.5], nums=[1, 2])]))
    assert h.total_written == 2 and h.frame_written == 2
    h.process(_frame([_row(laps=[100.5], nums=[2])]))         # aynı tur → yazmaz
    assert h.total_written == 2 and h.frame_written == 0
    h.process(_frame([_row(laps=[99.8], nums=[3])]))          # yeni tur
    assert h.total_written == 3 and h.frame_written == 1


def test_seans_degisince_sayac_sifirlanir():
    h = Harvester("r1", known_session_id="10")
    h.process(_frame([_row(laps=[101.0], nums=[1])], sid="10"))
    assert h.total_written == 1
    h.process(_frame([_row(key="c9", laps=[95.0], nums=[1])], sid="20"))  # yeni seans → temizle+sıfırla
    assert h.total_written == 1                                # temizlik sonrası bu karede 1 yeni


def test_pilot_yalniz_degisince_yazilir():
    h = Harvester("r1")
    h.process(_frame([_row(laps=[101.0], nums=[1])]))
    p = h.process(_frame([_row(laps=[101.0, 100.9], nums=[1, 2])]))
    assert not any(k.startswith("livedrv/") for k in p[0]), p    # ad aynı → yazma
    p = h.process(_frame([_row(laps=[101.0, 100.9, 102.0], nums=[1, 2, 3],
                               driver="M. Yilmaz")]))
    assert p[0]["livedrv/r1/c7/3"] == "M. Yilmaz"                # değişim turunda yaz


def test_pit_turu_negatif_pozisyon_ve_lastik_kaydi():
    h = Harvester("r1")
    h.process(_frame([_row(laps=[101.0], nums=[1], pitStops=0)]))
    p = h.process(_frame([_row(laps=[101.0, 130.0], nums=[1, 2], pitStops=1,
                               tyreChange={"n": 4, "lap": 2}, tyreComp="Medium")]))
    u = p[0]
    assert u["livepos/r1/c7/2"] == -3                     # pit turu → negatif
    assert u["livetyre/r1/c7/2"] == "4|Medium"
    p2 = h.process(_frame([_row(laps=[101.0, 130.0], nums=[1, 2], pitStops=1,
                                tyreChange={"n": 4, "lap": 2}, tyreComp="Medium")]))
    assert p2 == [], p2                                    # değişim bir kez yazılır


def test_livewear_tur_basi_dis_yazilir():
    """v2.3.1: dört köşe diş, YALNIZ en yeni tur (livesec deseni). Kaynak `tyres4`
    zaten karede (rf2_source._wear4) → oyun PC'sine yeni okuma/istek eklenmedi."""
    h = Harvester("r1")
    u = h.process(_frame([_row(laps=[101.0, 100.5], nums=[1, 2],
                               tyres4=[0.98, 0.97, 0.995, 0.96])]))[0]
    assert u["livewear/r1/c7/2"] == "0.980,0.970,0.995,0.960"
    assert "livewear/r1/c7/1" not in u                    # yalnız en yeni tur


def test_livewear_yayinlanmayan_asinma_yazilmaz():
    """Online yarışta oyun RAKİP aşınmasını yaymaz → _wear4 None döner. Uydurma
    veri yazmaktansa HİÇ yazma (CLAUDE.md §1 veri dürüstlüğü)."""
    h = Harvester("r1")
    u = h.process(_frame([_row(laps=[101.0], nums=[1], tyres4=None)]))[0]
    assert not any(k.startswith("livewear/") for k in u), u
    # bozuk/aralık dışı okuma da yazılmaz
    for bad in ([0.9, 0.9, 1.4, 0.9], [0.9, 0.9, 0.9], "0.9", [0.9, 0.9, 0.9, -0.1]):
        hb = Harvester("r1")
        ub = hb.process(_frame([_row(laps=[101.0], nums=[1], tyres4=bad)]))[0]
        assert not any(k.startswith("livewear/") for k in ub), (bad, ub)


def test_seans_degisince_temizlik_once_gelir():
    h = Harvester("r1", known_session_id="5")             # antrenman kayıtlıydı
    p = h.process(_frame([_row(laps=[101.0], nums=[1])], sid="10"))
    assert p[0] == {f"{n}/r1": None for n in
                    ("livelaps", "livepos", "livesec", "livedrv", "livetyre", "livecond",
                     "livewear")}
    assert p[1]["livelaps/r1/c7/1"] == 101.0              # temizlikten SONRA yeni turlar


def test_fresh_start_ayni_yarisi_tekrar_kosma_temizler():
    h = Harvester("r1", known_session_id="10")            # rid'de eski kayıt var
    p = h.process(_frame([_row(laps=[], nums=[], lapsDone=0)], sid="10"))
    assert p and p[0]["livelaps/r1"] is None              # saha 0 turda → bir kez temizle
    # yarış ortası yeniden başlatma (lapsDone>0) temizlemezdi:
    h2 = Harvester("r1", known_session_id="10")
    p2 = h2.process(_frame([_row(laps=[100.0], nums=[5], lapsDone=5)], sid="10"))
    assert not any(v is None for v in p2[0].values())


def test_restart_dedektoru_iki_ardisik_sifir_kare():
    h = Harvester("r1")
    h.process(_frame([_row(laps=[101.0, 100.5], nums=[1, 2])]))   # 1. kare fresh-check'i tüketir
    h.process(_frame([_row(laps=[101.0, 100.5], nums=[1, 2])]))   # 2. kare prev_max=2 (JS paritesi)
    boş = _row(laps=[], nums=[], lapsDone=0)
    assert h.process(_frame([boş])) == []                  # 1. sıfır kare — henüz değil
    p = h.process(_frame([boş]))                           # 2. ardışık → restart temizliği
    assert p and p[0]["livelaps/r1"] is None


def test_arac_basi_gerileme_o_araci_temizler():
    h = Harvester("r1")
    h.process(_frame([_row(laps=[101.0, 100.5], nums=[7, 8])]))
    p = h.process(_frame([_row(laps=[99.0], nums=[2])]))   # yazdığımızdan geride
    assert p[0]["livelaps/r1/c7"] is None                  # yalnız o araç temizlenir
    assert p[1]["livelaps/r1/c7/2"] == 99.0


def test_rubber_pct_js_paritesi():
    assert rubber_pct("Yarış", 0) == 50
    assert rubber_pct("Antrenman", 0) == 25
    assert rubber_pct("Yarış", 3000) == 100


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
