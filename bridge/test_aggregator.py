"""Aggregator tur log'u regresyon testleri (bağımlılıksız — `python3 bridge/test_aggregator.py`).

Kritik sözleşme: `lapNums`, `laps` ile birebir hizalı GERÇEK tur numaralarını taşır.
Log boşluklu olabilir (geçersiz tur atlanır ya da lapsDone >1 atlar); JS bu numaraları
kalıcı livelaps/livepos/livesec düğümlerine anahtar olarak yazar. Ardışık varsaymak
tur kaymasına (tur 4'ün süresi tur 3 diye) ve kalıcı veri bozulmasına yol açıyordu.
"""
import sys

from rf2_source import Aggregator, _flag_of


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


def test_bayrak_lokal_sari_gorunur():
    """Kullanıcı bug'ı: oyunda sarı bayrak var ama uygulama Green gösteriyordu —
    lokal sektör sarıları (mSectorFlag) hiç okunmuyordu. Index eşlemesi rF2Sector
    enum'una göre SIRALI DEĞİL: 0=S3, 1=S1, 2=S2."""
    assert _flag_of(5, 0, [0, 0, 1]) == ("Yellow", [2])   # index 2 → S2
    assert _flag_of(5, 0, [0, 1, 0]) == ("Yellow", [1])   # index 1 → S1
    assert _flag_of(5, 0, [1, 0, 0]) == ("Yellow", [3])   # index 0 → S3
    assert _flag_of(5, 0, [1, 1, 0]) == ("Yellow", [1, 3])


def test_bayrak_fcy_ve_yellowstate():
    assert _flag_of(6, 0, [0, 0, 0])[0] == "FCY"          # FCY fazı
    assert _flag_of(5, 2, [0, 0, 0])[0] == "FCY"          # PitClosed → FCY süreci
    # FCY sırasında lokal sarılar da raporlanır (bilgi kaybolmaz)
    assert _flag_of(6, 1, [0, 0, 1]) == ("FCY", [2])


def test_bayrak_invalid_255_yesil_kalir():
    """c_ubyte alanlarda Invalid(-1) = 255. Eskiden `yellow > 0` bunu sarı sayardı."""
    assert _flag_of(5, 255, [255, 255, 255]) == ("Green", [])
    assert _flag_of(5, 0, []) == ("Green", [])
    assert _flag_of(5, 0, None) == ("Green", [])


tc = Aggregator.tyre_change


def test_lastik_degisimi_kac_ve_hangi_kose():
    """Saha tablosundaki tek 'en kötü' yüzdesi iki-lastik değişimini GÖREMEZ;
    köşe köşe karşılaştırma bunu çözer."""
    # dördü de yenilendi
    assert tc([0.42, 0.40, 0.38, 0.39], [1.0, 1.0, 1.0, 1.0])["n"] == 4
    # yalnız ÖN ikisi (endurance'ta sık — kısa duraklar)
    ch = tc([0.42, 0.40, 0.38, 0.39], [1.0, 1.0, 0.37, 0.38])
    assert ch["n"] == 2 and ch["corners"] == ["fl", "fr"]
    # yalnız SAĞ taraf (fr + rr)
    assert tc([0.5, 0.5, 0.5, 0.5], [0.49, 1.0, 0.49, 1.0])["corners"] == ["fr", "rr"]
    # hiç değişmedi (yalnız yakıt aldı) — aşınma pit boyunca hafifçe düşebilir
    assert tc([0.5, 0.5, 0.5, 0.5], [0.49, 0.49, 0.48, 0.49])["n"] == 0


def test_bilesim_degisimi_dort_lastik_demektir():
    """Bileşimi tek köşede değiştirmek mümkün değil; aşınmış sete geçilse (sıçrama
    küçük) bile bileşim adı değişmişse tüm set değişmiştir."""
    ch = tc([0.5, 0.5, 0.5, 0.5], [0.52, 0.51, 0.52, 0.51], "Medium", "Wet")
    assert ch["n"] == 4 and ch["comp"] == "Wet"
    # aşınma hiç okunamıyor (rakip telemetrisi yok) ama bileşim değişti → yine kesin
    ch2 = tc(None, None, "Medium", "Wet")
    assert ch2["n"] == 4 and ch2["comp"] == "Wet"
    # bileşim aynı + aşınma yok → karar verilemez, UYDURMA YOK
    assert tc(None, None, "Medium", "Medium") is None


def test_lastik_degisimi_bozuk_veri_cokmez():
    assert tc([0.5, 0.5], [1.0, 1.0, 1.0, 1.0]) is None      # eksik köşe
    assert tc([0.5, 0.5, 0.5, 0.5], ["a", 1.0, 1.0, 1.0]) is None
    assert tc(None, [1.0, 1.0, 1.0, 1.0]) is None


class _PitStop:
    """Bir aracı pit'e sokup çıkarır: kare kare (inPits, tyres4, comp)."""

    def __init__(self, seq):
        self.seq = list(seq)
        self.i = 0

    def read(self):
        in_pits, t4, comp = self.seq[min(self.i, len(self.seq) - 1)]
        self.i += 1
        return {"session": {}, "own": None, "field": [{
            "pos": 1, "carId": 7, "driver": "A. Demircan", "lapsDone": 10 + self.i // 3,
            "lastSec": 100.0, "bestSec": 100.0, "inPits": in_pits,
            "tyres4": t4, "tyreComp": comp}]}


def test_pit_turunda_iki_lastik_degisimi_yakalanir():
    """Uçtan uca: pit girişinde eski lastikler saklanır, çıkışta karşılaştırılır ve
    sonuç BİR SONRAKİ pite kadar satırda kalır (pit duvarı stint boyunca görsün)."""
    old = [0.40, 0.38, 0.36, 0.37]
    new_front = [1.0, 1.0, 0.36, 0.37]
    a = Aggregator(_PitStop([
        (False, old, "Medium"),          # pistte
        (True, old, "Medium"),           # PİT GİRİŞİ → anlık görüntü
        (True, old, "Medium"),
        (False, new_front, "Medium"),    # PİT ÇIKIŞI → karşılaştır
        (False, new_front, "Medium"),    # sonraki karelerde de görünür kalmalı
    ]))
    seen = [a.read()["field"][0].get("tyreChange") for _ in range(5)]
    assert seen[0] is None and seen[1] is None and seen[2] is None
    assert seen[3]["n"] == 2 and seen[3]["corners"] == ["fl", "fr"]
    assert seen[3]["lap"] == 11
    assert seen[4] == seen[3]           # kalıcı (bir sonraki pite kadar)


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
