"""plugin_cfg testleri — bağımlılıksız koşucu (test_aggregator.py deseni).

Çalıştır:  python3 test_plugin_cfg.py
"""
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from plugin_cfg import (  # noqa: E402
    buffer_advice, read_plugin_cfg, find_lmu_root, cfg_path, STEPS)


# --------------------------------------------------------------- buffer_advice
def test_varsayilan_maske_ffb_grafik_bosa_yazar():
    """mask=0 (eklenti varsayılanı): hiçbir buffer kapalı değil → 400+400 FPS'lik
    FFB+Graphics bizim için tamamen boşa yazılır. Kullanıcının donma şikâyetinin
    ölçülebilir kısmı budur."""
    a = buffer_advice(0)
    assert "ForceFeedback" in a["wasted"] and "Graphics" in a["wasted"]
    assert "PitInfo" in a["wasted"] and "Weather" in a["wasted"]
    # bize gerekli olanlar asla "boşa" sayılmaz
    assert "Telemetry" not in a["wasted"] and "Scoring" not in a["wasted"]
    assert a["wastedFps"] == 400 + 400 + 100 + 3 + 3 + 1   # FFB+Graphics+Pit+Rules+Multi+Wx
    assert a["suggest"] == 48                               # önce en güvenli kademe


def test_48_sonrasi_ffb_grafik_bosa_gitmez():
    a = buffer_advice(48)
    assert "ForceFeedback" not in a["wasted"] and "Graphics" not in a["wasted"]
    assert "ForceFeedback" not in a["on"] and "Graphics" not in a["on"]
    assert a["wastedFps"] == 100 + 3 + 3 + 1                # kalan: PitInfo+Rules+Multi+Wx
    assert a["suggest"] == 240                              # sıradaki kademe


def test_252_hicbir_sey_bosa_gitmez():
    a = buffer_advice(252)
    assert a["wasted"] == [] and a["wastedFps"] == 0
    assert a["suggest"] is None                             # önerilecek kademe kalmadı
    # bize gerekli iki buffer hâlâ AÇIK olmalı (yoksa veri hiç gelmez)
    assert "Telemetry" in a["on"] and "Scoring" in a["on"]


def test_bozuk_maske_varsayilana_duser():
    for bad in (None, "x", -5, ""):
        a = buffer_advice(bad)
        assert a["mask"] == 0 and a["suggest"] == 48


def test_kademeler_artan_ve_kapsayan():
    vals = [v for v, _l, _r in STEPS]
    assert vals == sorted(vals)                             # 48 → 240 → 252
    # her kademe bize gerekli bitleri (Telemetry=1, Scoring=2) ASLA kapatmaz
    for v in vals:
        assert not (v & 1) and not (v & 2)


# ------------------------------------------------------------- read_plugin_cfg
def _write_cfg(tmp, content):
    d = os.path.join(tmp, "UserData", "player")
    os.makedirs(d, exist_ok=True)
    p = os.path.join(d, "CustomPluginVariables.JSON")
    with open(p, "w", encoding="utf-8") as f:
        f.write(content)
    return p


def test_gercek_bicimli_dosyayi_okur():
    """rF2 JSON'unda anahtarlar baştaki BOŞLUK taşıyabilir (" Enabled") — okuma buna
    ve büyük/küçük harf farkına dayanıklı olmalı."""
    with tempfile.TemporaryDirectory() as tmp:
        _write_cfg(tmp, json.dumps({
            "rFactor2SharedMemoryMapPlugin64.dll": {
                " Enabled": 1, "UnsubscribedBuffersMask": 48,
                "DedicatedServerMapGlobally": 0},
            "SomeOtherPlugin.dll": {" Enabled": 0},
        }))
        cfg = read_plugin_cfg(tmp)
        assert cfg["enabled"] is True and cfg["mask"] == 48
        assert cfg["path"] == cfg_path(tmp)


def test_enabled_sifir_ve_maske_yok():
    with tempfile.TemporaryDirectory() as tmp:
        _write_cfg(tmp, json.dumps({
            "rfactor2sharedmemorymapplugin64.DLL": {" Enabled": 0}}))
        cfg = read_plugin_cfg(tmp)
        assert cfg["enabled"] is False and cfg["mask"] is None


def test_eklenti_blogu_yoksa_alanlar_bos():
    with tempfile.TemporaryDirectory() as tmp:
        _write_cfg(tmp, json.dumps({"Other.dll": {" Enabled": 1}}))
        cfg = read_plugin_cfg(tmp)
        assert cfg is not None and cfg["enabled"] is None and cfg["mask"] is None


def test_bozuk_json_ve_eksik_dosya_none():
    with tempfile.TemporaryDirectory() as tmp:
        _write_cfg(tmp, "{ bozuk json ,,,")
        assert read_plugin_cfg(tmp) is None
    with tempfile.TemporaryDirectory() as tmp:
        assert read_plugin_cfg(tmp) is None      # dosya hiç yok
    assert read_plugin_cfg(None) is None
    assert read_plugin_cfg("/yok/boyle/bir/yol") is None


def test_bom_ile_yazilmis_dosya_okunur():
    with tempfile.TemporaryDirectory() as tmp:
        d = os.path.join(tmp, "UserData", "player")
        os.makedirs(d)
        with open(os.path.join(d, "CustomPluginVariables.JSON"), "w",
                  encoding="utf-8-sig") as f:
            json.dump({"rFactor2SharedMemoryMapPlugin64.dll":
                       {" Enabled": 1, "UnsubscribedBuffersMask": 240}}, f)
        assert read_plugin_cfg(tmp)["mask"] == 240


# --------------------------------------------------------------- find_lmu_root
def test_kok_exe_yolundan_turetilir():
    """Oyun exe'si <kök>/Bin64/ altındadır → bir üst klasör köktür (UserData ile doğrulanır)."""
    with tempfile.TemporaryDirectory() as tmp:
        os.makedirs(os.path.join(tmp, "UserData", "player"))
        os.makedirs(os.path.join(tmp, "Bin64"))
        exe = os.path.join(tmp, "Bin64", "Le Mans Ultimate.exe")
        open(exe, "w").close()
        assert find_lmu_root(exe) == tmp


def test_kok_bulunamazsa_none():
    with tempfile.TemporaryDirectory() as tmp:
        exe = os.path.join(tmp, "oyun.exe")     # UserData yok
        open(exe, "w").close()
        assert find_lmu_root(exe) is None       # (Windows yedek yolları bu ortamda yok)


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
