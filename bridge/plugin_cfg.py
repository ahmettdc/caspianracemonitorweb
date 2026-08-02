"""Eklenti ayarı (CustomPluginVariables.JSON) — OKU ve YORUMLA, ASLA YAZMA.

NEDEN: kullanıcı "livetiming veri çekerken oyunda ciddi donma" bildirdi. Ölçüm
(ctypes.sizeof) paylaşımlı bellek KOPYALAMASINI aklıyor: kare başına yalnız ~0.3 MB
(2 Hz'de ~1.5 MB/s) — bu takılma yaratmaz. Asıl yük OYUNUN İÇİNDE: rF2 paylaşımlı
bellek eklentisi buffer'ları oyunun kendi thread'inde yazar ve yazım hızları çok
farklıdır (eklenti README'si):

    ForceFeedback 400 FPS · Graphics 400 FPS · PitInfo 100 FPS
    Telemetry 50 FPS · Scoring 5 FPS · Rules 3 FPS · Weather 1 FPS

Bizim okuyucumuz (pyRfactor2SharedMemory/rF2data.py) yalnız **Telemetry + Scoring +
Extended** mmap'ler. Yani saniyede 800 kez yazılan FFB+Graphics ikilisi bizim için
tamamen boşa gider. Eklenti bunu kapatmak için `UnsubscribedBuffersMask` sunar.

DÜRÜST SINIR: Aynı anda başka araçlar da çalışabilir (CrewChief / SimHub / TinyPedal)
ve onların hangi buffer'a ihtiyaç duyduğunu biz bilemeyiz. Bu yüzden bu modül oyun
ayarını **hiçbir koşulda yazmaz** — okur, boşa yazılanı gösterir, kademeli değer önerir;
kararı kullanıcı verir (önce en güvenli 48, sonra 240, en son 252).

Saf + test edilebilir (bkz. test_plugin_cfg.py); desen: rf2_source._flag_of / _wait_reason.
"""
import json
import os
import re

#: Eklenti buffer bit değerleri (rF2SharedMemoryMapPlugin README) + yazım hızı (FPS).
#: `need`: bizim okuyucumuz bu buffer'ı kullanıyor mu (Extended maskelenemez).
BUFFERS = (
    # bit,  id,             görünen ad,        FPS, bize gerekli mi
    (1,   "telemetry",     "Telemetry",        50,  True),
    (2,   "scoring",       "Scoring",           5,  True),
    (4,   "rules",         "Rules",             3,  False),
    (8,   "multirules",    "MultiRules",        3,  False),
    (16,  "forcefeedback", "ForceFeedback",   400,  False),
    (32,  "graphics",      "Graphics",        400,  False),
    (64,  "pitinfo",       "PitInfo",         100,  False),
    (128, "weather",       "Weather",           1,  False),
)

#: Önerilen kademeler — en güvenliden en agresife. Diğer araçlar aktifken sırayla denenir.
STEPS = (
    (48,  "FFB + Grafik (saniyede 800 gereksiz yazım) — en güvenli, kazancın çoğu",
     "FFB/grafik göstergesi kullanan bir aracın (nadir) etkilenmesi mümkün"),
    (240, "+ PitInfo + Hava — orta",
     "pit/hava bilgisini paylaşımlı bellekten okuyan araçlar etkilenebilir"),
    (252, "+ Rules + MultiRules — en agresif",
     "CrewChief gibi kural/FCY bilgisi okuyan araçlar etkilenir; yalnız başka araç yoksa"),
)

#: Eklenti bloğunun JSON'daki adı (rF2 anahtarları baştaki boşluk taşıyabilir: " Enabled").
PLUGIN_DLL = "rfactor2sharedmemorymapplugin64.dll"


def _norm(s):
    """Anahtar eşlemesi için: küçük harf + yalnız harf/rakam/nokta (baştaki boşluk sorunu
    ve büyük/küçük harf farkı JSON'da gerçekten görülüyor)."""
    return re.sub(r"[^a-z0-9.]", "", str(s or "").lower())


def find_lmu_root(proc_exe=None):
    """LMU kurulum kökü. `proc_exe` verilirse (çalışan oyunun exe yolu) ondan türetilir —
    en güvenilir yol; yoksa yaygın Steam konumları denenir. Bulunamazsa None.

    Kök = içinde UserData/ olan klasör. Oyun exe'si genelde <kök>/Bin64/ altındadır."""
    cands = []
    if proc_exe:
        d = os.path.dirname(os.path.abspath(proc_exe))
        cands += [d, os.path.dirname(d)]        # Bin64/ ve bir üstü (kök)
    cands += [
        r"C:\Program Files (x86)\Steam\steamapps\common\Le Mans Ultimate",
        r"C:\Program Files\Steam\steamapps\common\Le Mans Ultimate",
        r"D:\Steam\steamapps\common\Le Mans Ultimate",
        r"E:\Steam\steamapps\common\Le Mans Ultimate",
    ]
    for c in cands:
        try:
            if c and os.path.isdir(os.path.join(c, "UserData")):
                return c
        except Exception:
            continue
    return None


def cfg_path(root):
    """Ayar dosyasının tam yolu (varlığı kontrol edilmez)."""
    return os.path.join(root, "UserData", "player", "CustomPluginVariables.JSON")


def read_plugin_cfg(root):
    """CustomPluginVariables.JSON → { enabled, mask, path } ya da None.

    Toleranslı: dosya yok / bozuk JSON / BOM / anahtar adı farklı yazılmış → None ya da
    eksik alanlar (çökme yok). `enabled` None = anahtar bulunamadı (bilinmiyor)."""
    if not root:
        return None
    p = cfg_path(root)
    try:
        with open(p, "r", encoding="utf-8-sig", errors="ignore") as f:
            data = json.load(f)
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    block = None
    for k, v in data.items():
        if _norm(k) == PLUGIN_DLL and isinstance(v, dict):
            block = v
            break
    if block is None:
        return {"enabled": None, "mask": None, "path": p}
    enabled, mask = None, None
    for k, v in block.items():
        n = _norm(k)
        if n == "enabled":
            try:
                enabled = int(v) != 0
            except (TypeError, ValueError):
                enabled = None
        elif n == "unsubscribedbuffersmask":
            try:
                mask = int(v)
            except (TypeError, ValueError):
                mask = None
    return {"enabled": enabled, "mask": mask, "path": p}


def buffer_advice(mask):
    """Maskeyi yorumla → { mask, wasted, wastedFps, on, suggest, steps }.

    wasted     : bizim OKUMADIĞIMIZ ama hâlâ yazılan buffer adları (boşa iş)
    wastedFps  : bu buffer'ların toplam yazım hızı (FPS) — "saniyede kaç gereksiz yazım"
    suggest    : önerilecek bir sonraki kademe değeri (zaten iyiyse None)
    Mask None/geçersiz → 0 (hiçbir şey kapalı değil) gibi ele alınır: eklenti varsayılanı."""
    try:
        m = int(mask)
    except (TypeError, ValueError):
        m = 0
    if m < 0:
        m = 0
    on, wasted, fps = [], [], 0
    for bit, _id, name, hz, need in BUFFERS:
        if m & bit:
            continue                      # abonelikten çıkılmış → yazılmıyor
        on.append(name)
        if not need:
            wasted.append(name)
            fps += hz
    suggest = None
    for val, _lbl, _risk in STEPS:
        if (m & val) != val:              # bu kademenin tüm bitleri henüz kapalı değil
            suggest = val
            break
    return {"mask": m, "on": on, "wasted": wasted, "wastedFps": fps,
            "suggest": suggest, "steps": [
                {"value": v, "label": lbl, "risk": rk} for v, lbl, rk in STEPS]}
