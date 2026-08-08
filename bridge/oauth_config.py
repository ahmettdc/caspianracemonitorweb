"""Google OAuth istemci kimliği/secret'ı — DERLEME zamanı enjekte edilir.

`bridge.yml` iş akışı, PyInstaller'dan ÖNCE `oauth_build.py` dosyasını GitHub
secret'larından (masaüstü uygulamasıyla AYNI "Desktop app" OAuth istemcisi) yazar.
Bu dosya commit'lidir ve o dosyayı toleranslı okur: yoksa boş döner → Google girişi
pasif kalır, köprü yalnız bot (e-posta/parola) yoluna düşer (geriye uyum, çökme yok).

Not: "Desktop app" tipi OAuth istemcisinin secret'ı Google'a göre GİZLİ kabul edilmez
(kurulu uygulamalarda saklanamaz) — masaüstü exe'si de aynısını gömer; risk yok.
"""
try:
    from oauth_build import CLIENT_ID as _CID, CLIENT_SECRET as _CSEC
    CLIENT_ID = (_CID or "").strip()
    CLIENT_SECRET = (_CSEC or "").strip()
except Exception:  # noqa: BLE001  (derlemede üretilmediyse Google girişi pasif)
    CLIENT_ID = ""
    CLIENT_SECRET = ""


def google_enabled():
    return bool(CLIENT_ID and CLIENT_SECRET)
