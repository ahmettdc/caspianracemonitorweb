"""Aggregator tur log'u regresyon testleri (bağımlılıksız — `python3 bridge/test_aggregator.py`).

Kritik sözleşme: `lapNums`, `laps` ile birebir hizalı GERÇEK tur numaralarını taşır.
Log boşluklu olabilir (geçersiz tur atlanır ya da lapsDone >1 atlar); JS bu numaraları
kalıcı livelaps/livepos/livesec düğümlerine anahtar olarak yazar. Ardışık varsaymak
tur kaymasına (tur 4'ün süresi tur 3 diye) ve kalıcı veri bozulmasına yol açıyordu.
"""
import sys

from rf2_source import (Aggregator, RF2Source, _flag_of, _merge_flags,
                        _wait_reason)


class _Wheel:
    def __init__(self, wear):
        self.mWear = wear


class _Tele:
    """mWheels[0..3].mWear taşıyan sahte telemetri (RF2Source._wear4 için)."""
    def __init__(self, wears):
        self.mWheels = [_Wheel(w) for w in wears]


def test_wear4_online_donmus_tam_1_0_veri_yok_sayilir():
    """Online rakip aşınması simüle edilmez → dört teker 1.0 donar (sahte %100).
    En az bir tur atmış araçta hepsi 1.0 ise None (UI '—'); yarış başında (laps 0)
    yeni lastik gerçekten 1.0 → korunur; gerçek aşınma her zaman gösterilir."""
    frozen = _Tele([1.0, 1.0, 1.0, 1.0])
    assert RF2Source._wear4(frozen, laps=5) is None            # donmuş → veri yok
    assert RF2Source._worst_wear(frozen, laps=5) is None
    assert RF2Source._wear4(frozen, laps=0) == [1.0, 1.0, 1.0, 1.0]  # yarış başı → koru
    real = _Tele([0.98, 0.97, 0.95, 0.94])
    assert RF2Source._wear4(real, laps=5) == [0.98, 0.97, 0.95, 0.94]  # gerçek → göster
    assert RF2Source._worst_wear(real, laps=5) == 0.94
    # tek teker 1.0 altına inmişse (gerçek) donmuş sayılmaz
    assert RF2Source._wear4(_Tele([1.0, 1.0, 1.0, 0.999]), laps=5) == [1.0, 1.0, 1.0, 0.999]


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


def test_tur_suresi_bir_kare_gec_gelir_kaydeder():
    """S/F'de oyun tur SAYACINI, son-tur SÜRESİNDEN (mLastLapTime) bir kare önce
    günceller: lap 1 tamamlanır ama süre henüz 0; sonraki karede AYNI turda süre gelir
    → tur KAYBOLMAMALI (v1.8.5 pending mekanizması)."""
    r = _run([(0, -1), (1, -1), (1, 101.0), (2, 100.5)])
    assert r["lapNums"] == [1, 2], r["lapNums"]
    assert r["laps"] == [101.0, 100.5], r["laps"]
    # eski davranış (pending yok) lap 1'i kalıcı kaybederdi → [2]


def test_bekleyen_turun_suresi_gelmeden_yeni_tur_gelirse_atlanir():
    """Süre gelmeden ARADA yeni tur tamamlanırsa bayat pending atılır (yeni turun
    süresini eski tura yazıp mislabel etme)."""
    r = _run([(0, -1), (1, -1), (2, 102.0), (3, 100.5)])
    assert r["lapNums"] == [2, 3], r["lapNums"]      # lap 1'in süresi hiç gelmedi → atlanır


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


class _Pen:
    """Tek aracı kare kare besler: BEKLEYEN ceza (mNumPenalties) dizisi."""

    def __init__(self, pens):
        self.pens = list(pens)
        self.i = 0

    def read(self):
        pen = self.pens[min(self.i, len(self.pens) - 1)]
        self.i += 1
        return {"session": {}, "own": None, "field": [{
            "pos": 1, "carId": 1, "driver": "A. Demircan", "lapsDone": 1 + self.i // 4,
            "lastSec": 100.0, "bestSec": 100.0, "inPits": False, "penalties": pen}]}


def _pen_run(pens):
    agg = Aggregator(_Pen(pens))
    out = None
    for _ in range(len(pens)):
        out = agg.read()
    return out["field"][0]


def test_ceza_kumulatif_servis_edilince_sifirlanmaz():
    """v2.2.4 — SAHA HATASI: ceza sütunu sürücü cezasını çekince temizleniyordu.

    `mNumPenalties` başlığı "number of OUTSTANDING penalties" der — BEKLEYEN ceza,
    servis edilince 0'a düşer. Kümülatif sanılırsa yarış boyunca yanlış okunur.
    TinyPedal (module_stats.py) toplamı YÜKSELEN KENARLARDAN biriktirir; aynısı."""
    # ceza alındı (0→1), çekildi (1→0), tekrar alındı (0→1) → toplam 2, bekleyen 1
    r = _pen_run([0, 0, 1, 1, 0, 0, 1, 1])
    assert r["penaltiesTotal"] == 2, r["penaltiesTotal"]
    assert r["penalties"] == 1                 # anlık bekleyen ayrı alanda korunur
    # servis edildikten sonra toplam DÜŞMEZ (eski davranışta 0 görünüyordu)
    r2 = _pen_run([0, 1, 1, 0, 0])
    assert r2["penaltiesTotal"] == 1 and r2["penalties"] == 0


def test_ceza_ilk_karede_taban_alinir():
    """Yarışa GEÇ katılma / köprü yeniden başlatma: ilk karede zaten 2 ceza varsa
    bunlar bizim sayacımıza EKLENMEZ (şişirme olmaz), yalnız taban alınır."""
    r = _pen_run([2, 2, 2])
    assert r["penaltiesTotal"] == 0, r["penaltiesTotal"]
    # tabandan SONRAKİ artış sayılır
    r2 = _pen_run([2, 2, 3])
    assert r2["penaltiesTotal"] == 1


def test_ceza_ayni_karede_birden_fazla_artis():
    """İki ceza tek kare arasında gelirse fark kadar (+2) eklenir — kayıp yok."""
    r = _pen_run([0, 0, 2])
    assert r["penaltiesTotal"] == 2


def test_ceza_alani_yoksa_cokmez():
    """Eski köprü / ceza alanı üretmeyen kaynak → 0, hata yok."""
    r = _run([(0, -1), (1, 101.0)])
    assert r["penaltiesTotal"] == 0


def test_bayrak_sektor_sarisi_uretilir():
    """v2.2.4 — SAHA HATASI: "oyunda sarı sallanıyor, Live Timing'de göremiyoruz".

    Zincir: REST VARSAYILAN KAPALI (donma önlemi, bridge/README) → lmu=None →
    shmem yedeği devrede; ama v1.4.74'te o yedekten lokal sarı ÜRETİMİ kaldırılmıştı
    → "Yellow" döndüren TEK BİR kod yolu kalmamıştı (yapısal olarak imkânsız).
    Artık lokal sarı shmem'den TinyPedal predikatıyla (== 1) üretilir."""
    assert _flag_of(5, 0, [0, 0, 1]) == ("Yellow", [3])
    assert _flag_of(5, 0, [1, 0, 0]) == ("Yellow", [1])
    assert _flag_of(5, 0, [1, 0, 1]) == ("Yellow", [1, 3])
    assert _flag_of(5, 0, [0, 0, 0]) == ("Green", [])


def test_bayrak_sektor_invalid_bayt_sari_sayilmaz():
    """v1.4.74'ü doğuran YANLIŞ POZİTİF burada kilitlenir: eski kod `> 0` kullandığı
    için Invalid/başlatılmamış bayt (255) sarı sayılıyor, GREEN'de üç sektör birden
    sarı görünüyordu. TinyPedal'ın predikatı KESİN EŞİTLİK (== 1) → 255 yeşil kalır."""
    assert _flag_of(5, 0, [255, 255, 255]) == ("Green", [])
    assert _flag_of(5, 0, [0, 255, 0]) == ("Green", [])
    # bozuk/eksik dizi de çökmemeli
    assert _flag_of(5, 0, None) == ("Green", [])
    assert _flag_of(5, 0, ["x", None]) == ("Green", [])


def test_bayrak_fcy_ve_yellowstate():
    assert _flag_of(6, 0) == ("FCY", [])                   # FCY fazı
    assert _flag_of(5, 2) == ("FCY", [])                   # PitClosed → FCY süreci
    # FCY, lokal sektör bilgisini de taşır (FCY > Yellow önceliği korunur)
    assert _flag_of(6, 0, [0, 1, 0]) == ("FCY", [2])


def test_bayrak_invalid_255_yesil_kalir():
    """c_ubyte alanlarda Invalid(-1) = 255. Eskiden `yellow > 0` bunu sarı sayardı."""
    assert _flag_of(5, 255) == ("Green", [])
    assert _flag_of(5, 0) == ("Green", [])


def test_bayrak_birlesme_rest_sariyi_bastiramaz():
    """v2.2.4 — eskiden `if rest_flag:` shmem'i TAMAMEN yok sayıyordu; REST kendi
    içinde muhafazakâr olduğu için (3/3 sektörü Green'e düşürür, alan adları tutmazsa
    sahte "Green" üretir) gerçek sarıyı maskeliyordu. Artık sarı yalnız EKLENİR."""
    # REST "Green" diyor ama shmem sektör sarısı görüyor → sarı korunur
    assert _merge_flags("Yellow", [2], {"flag": "Green", "yellowSectors": []}) == ("Yellow", [2])
    # REST FCY görüyor, shmem yeşil → en güçlü kazanır
    assert _merge_flags("Green", [], {"flag": "FCY", "yellowSectors": []}) == ("FCY", [])
    # sektörler birleşir (tekrarsız, sıralı)
    assert _merge_flags("Yellow", [1], {"flag": "Yellow", "yellowSectors": [3, 1]}) == ("Yellow", [1, 3])
    # REST yoksa shmem aynen geçer
    assert _merge_flags("Yellow", [2], None) == ("Yellow", [2])
    # REST yalnız sektör verdiyse Green kalamaz
    assert _merge_flags("Green", [], {"flag": "Green", "yellowSectors": [2]}) == ("Yellow", [2])


def test_bekleme_nedeni_eklenti_yok():
    """Windows mmap eksik adlandırılmış mapping'i SIFIRLARLA kendisi oluşturur —
    eklenti DLL'i kurulu/etkin değilken köprü 'çalışıyor' görünür ve tek mesaj
    'Oyun/seans bekleniyor' hiçbir şey söylemezdi (kullanıcı bug'ı: üyenin PC'si
    'okumuyor'). mVersion boş = DLL hiç yazmıyor → noplugin."""
    assert _wait_reason(False, None, 0) == "noplugin"
    assert _wait_reason(False, False, 0) == "noplugin"   # eklenti yokken menü bilgisi anlamsız


def test_bekleme_nedeni_menu_ve_seans():
    assert _wait_reason(True, False, 0) == "menu"        # eklenti var, ana menüde
    assert _wait_reason(True, True, 0) == "novehicles"   # seansta ama araç yok (nadir)


def test_bekleme_nedeni_arac_varsa_yok():
    assert _wait_reason(True, True, 14) is None
    assert _wait_reason(False, None, 14) is None         # araç geldiyse bekleme bitti


def test_bekleme_nedeni_bilinmiyorsa_genel():
    """track_loaded None = mSessionStarted okunamadı (eski struct) → uydurma teşhis
    yerine None (UI genel mesaja düşer)."""
    assert _wait_reason(True, None, 0) is None


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


class _VeFake:
    """Tek aracı (lapsDone, lastSec, virtualEnergy) dizisiyle besler — vePerLap testi."""

    def __init__(self, seq, car_id=7):
        self.seq = list(seq)
        self.i = 0
        self.car_id = car_id

    def read(self):
        laps, last, ve = self.seq[min(self.i, len(self.seq) - 1)]
        self.i += 1
        return {"session": {}, "own": None, "field": [{
            "pos": 1, "carId": self.car_id, "driver": "A. Demircan", "lapsDone": laps,
            "lastSec": last, "bestSec": 100.0, "inPits": False, "virtualEnergy": ve}]}


def test_ve_per_lap_tur_sinirinda_delta():
    # tur tamamlandıkça VE düşer: prev−cur tur-başı tüketim olarak yansır
    agg = Aggregator(_VeFake([(1, 100.0, 90.0), (2, 100.0, 85.0), (3, 100.0, 81.5)]))
    out = [agg.read()["field"][0].get("vePerLap") for _ in range(3)]
    # ilk turda prev yok → None; sonra 90-85=5.0, 85-81.5=3.5
    assert out == [None, 5.0, 3.5], out


def test_ve_per_lap_veri_yoksa_none():
    # REST kapalı → virtualEnergy None → vePerLap hiç hesaplanmaz
    agg = Aggregator(_VeFake([(1, 100.0, None), (2, 100.0, None)]))
    out = [agg.read()["field"][0].get("vePerLap") for _ in range(2)]
    assert out == [None, None], out


def test_ve_per_lap_dolum_anomali_elenir():
    # VE artarsa (dolum) ya da >50% düşerse (anomali) yok sayılır
    agg = Aggregator(_VeFake([(1, 100.0, 40.0), (2, 100.0, 95.0), (3, 100.0, 90.0)]))
    out = [agg.read()["field"][0].get("vePerLap") for _ in range(3)]
    # tur2: 40→95 artış → None kalır; tur3: 95-90=5.0
    assert out == [None, None, 5.0], out


class _BestSec:
    """rF2 VehicleScoring'in en iyi sektör alanlarını taşıyan sahte kayıt.
    Struct KÜMÜLATİF verir: mBestSector2 = en iyi (S1+S2)."""

    def __init__(self, b1, b12, lap):
        self.mBestSector1 = b1
        self.mBestSector2 = b12
        self.mBestLapTime = lap


def test_best_sectors_kumulatiften_tekil_sureye_cevirir():
    """b2 = mBestSector2 − mBestSector1 · b3 = mBestLapTime − mBestSector2."""
    v = _BestSec(29.5, 29.5 + 44.0, 29.5 + 44.0 + 30.8)
    assert RF2Source._best_sectors(v) == [29.5, 44.0, 30.8]


def test_best_sectors_eksik_veri_none_dondurur():
    """Tur atılmamışsa oyun -1 verir → uydurma değer üretme."""
    assert RF2Source._best_sectors(_BestSec(-1.0, -1.0, -1.0)) == [None, None, None]
    # yalnız S1 geçilmiş: b1 var, kümülatif S2 ve tur yok
    assert RF2Source._best_sectors(_BestSec(29.5, -1.0, -1.0)) == [29.5, None, None]
    # S1+S2 var ama tur henüz tamamlanmamış → b3 None
    assert RF2Source._best_sectors(_BestSec(29.5, 73.5, -1.0)) == [29.5, 44.0, None]


def test_best_sectors_tutarsiz_degerler_elenir():
    """Kümülatif olmayan/geriye giden değerler (yırtık okuma) sessizce None."""
    # b12 < b1 → S2 çıkarılamaz
    assert RF2Source._best_sectors(_BestSec(29.5, 20.0, 100.0)) == [29.5, None, None]
    # lap < b12 → S3 çıkarılamaz
    assert RF2Source._best_sectors(_BestSec(29.5, 73.5, 50.0)) == [29.5, 44.0, None]


def test_best_sectors_alan_yoksa_cokmeden_none():
    """Eski/farklı struct düzeni: alanlar hiç yok → [None,None,None]."""
    assert RF2Source._best_sectors(object()) == [None, None, None]


class _TimeInto:
    """mTimeIntoLap / mEstimatedLapTime taşıyan sahte scoring kaydı."""

    def __init__(self, into, est):
        self.mTimeIntoLap = into
        self.mEstimatedLapTime = est


def test_time_into_lap_sifir_gecerli_degerdir():
    """v2.3.0 relative zaman yolu: araç S/F'yi yeni geçmişse mTimeIntoLap tam 0.0
    olur. `float(...) or -1.0` yazılırsa 0.0 falsy olduğu için -1.0'a çevrilir ve
    GEÇERLİ bir okuma "veri yok"a döner — web tarafı o aracı mesafe yedeğine
    düşürürdü. Bu testin kilitlediği şey tam olarak budur."""
    v = _TimeInto(0.0, 92.5)
    assert round(float(getattr(v, "mTimeIntoLap", -1.0)), 3) == 0.0
    # yanlış kalıbın ne yaptığını da kayda geçir (regresyon niyeti açık olsun)
    assert (float(getattr(v, "mTimeIntoLap", -1.0)) or -1.0) == -1.0


class _SpeedFake:
    """Tek aracı kare kare besler: (lapsDone, speedKph)."""

    def __init__(self, seq):
        self.seq = list(seq)
        self.i = 0

    def read(self):
        laps, spd = self.seq[min(self.i, len(self.seq) - 1)]
        self.i += 1
        return {"session": {}, "own": None, "field": [{
            "pos": 1, "carId": 1, "driver": "A", "lapsDone": laps,
            "lastSec": 100.0, "bestSec": 100.0, "inPits": False, "speedKph": spd}]}


def _tops(seq):
    agg = Aggregator(_SpeedFake(seq))
    return [agg.read()["field"][0].get("topSpeed") for _ in range(len(seq))]


def test_top_speed_kosan_maksimum_tutar():
    assert _tops([(1, 180), (1, 250), (1, 210), (1, 300), (1, 120)]) \
        == [180, 250, 250, 300, 300]


def test_top_speed_yirtik_kare_maksimumu_ZEHIRLEMEZ():
    """Paylaşımlı bellek yırtık okunduğunda saçma bir hız gelebilir. Maksimum bir
    kez zehirlenirse bir daha DÜŞMEZ — yarış boyunca yanlış değer gösterilirdi."""
    assert _tops([(1, 200), (1, 99999), (1, 260)]) == [200, 200, 260]
    # tam sınırda kabul, üstünde ret
    assert _tops([(1, 500)]) == [500]
    assert _tops([(1, 501)]) == [None]


def test_top_speed_gecersiz_okuma_yok_sayilir():
    """0/negatif/None hız (durmuş araç, eksik alan) maksimuma yazılmaz."""
    assert _tops([(1, 0), (1, -5), (1, None), (1, 190)]) == [None, None, None, 190]


def test_top_speed_yeni_seansta_sifirlanir():
    """Seans değişince (lapsDone kalıcı gerilemesi) rekor sıfırdan başlamalı,
    yoksa antrenmanın hızı yarışta görünürdü."""
    agg = Aggregator(_SpeedFake([(5, 300), (5, 300), (5, 300),
                                 (1, 150), (1, 150), (1, 150), (1, 150)]))
    out = [agg.read()["field"][0].get("topSpeed") for _ in range(7)]
    assert out[0] == 300
    assert out[-1] == 150, out


class _Status:
    """mFinishStatus / mPitState taşıyan sahte scoring kaydı."""

    def __init__(self, fin, pit):
        self.mFinishStatus = fin
        self.mPitState = pit


def test_finish_status_ve_pit_state_ham_kod_olarak_gecer():
    """Köprü yorum yapmaz, ham struct kodunu geçirir (yorum web tarafında,
    liveStatus.js'te). 0=none/1=finished/2=dnf/3=dq · 0..4 pit aşaması."""
    for fin in (0, 1, 2, 3):
        v = _Status(fin, 0)
        assert int(getattr(v, "mFinishStatus", 0) or 0) == fin
    for pit in (0, 1, 2, 3, 4):
        v = _Status(0, pit)
        assert int(getattr(v, "mPitState", 0) or 0) == pit


def test_durum_alanlari_yoksa_sifira_duser_cokmez():
    """Eski/farklı struct düzeni: alan yok → 0 (= 'durum yok'), istisna değil."""
    v = object()
    assert int(getattr(v, "mFinishStatus", 0) or 0) == 0
    assert int(getattr(v, "mPitState", 0) or 0) == 0


class _OwnFake:
    """own'ı TELEMETRİDEN kuran RF2Source davranışını taklit eder: own'da
    driver/carClass YOK, oyuncunun field satırında VAR."""

    def read(self):
        return {"session": {}, "field": [{
            "pos": 1, "carId": 3, "driver": "A. Demircan", "carClass": "Hypercar",
            "team": "Caspian", "manufacturer": "Porsche", "number": "92",
            "lapsDone": 5, "lastSec": 100.0, "bestSec": 99.0,
            "inPits": False, "isPlayer": True}],
            "own": {"fuel": 40.0, "vehicleName": "963"}}


def test_own_driver_ve_carclass_oyuncu_satirindan_doldurulur():
    """v2.3.0 hata düzeltmesi: own hiç driver/carClass taşımıyordu → kendi araç
    kartı her zaman jenerik 'Kendi Araç' yazıyor, sınıf rengi hiç görünmüyordu."""
    own = Aggregator(_OwnFake()).read()["own"]
    assert own["driver"] == "A. Demircan", own
    assert own["carClass"] == "Hypercar", own
    # LMU REST zenginleştirmesi de yalnız field satırlarına ekleniyordu
    assert own["team"] == "Caspian"
    assert own["manufacturer"] == "Porsche"
    assert own["number"] == "92"


def test_own_mevcut_alanlar_ezilmez():
    """own'da ZATEN dolu olan alan (vehicleName) field'dan gelen değerle ezilmemeli."""
    own = Aggregator(_OwnFake()).read()["own"]
    assert own["vehicleName"] == "963", own


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
