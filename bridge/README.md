# Caspian Live Bridge

LMU/rFactor2 **canlı timing** köprüsü. Oyunun çalıştığı PC'de çalışır:
paylaşımlı bellekten okuyup Firebase'e yazar; web pit-wall (`Canlı` sekmesi)
tüm takım için salt-okunur gösterir.

```
[LMU + rF2 Shared Memory Plugin] → paylaşımlı bellek
        → [CaspianLiveBridge.exe]  → Firebase RTDB (teams/{tid}/live/{rid})
        → [web pit-wall: Canlı sekmesi]
```

> **Önemli:** Köprü yalnız verinin **kaynağı** olan tek PC'de (yarışı süren oyuncu)
> çalışır. Takımın geri kalanı hiçbir şey kurmaz — web'den izler.

---

## 1) Tek seferlik kurulum

### a. rF2 paylaşımlı bellek eklentisi
`rFactor2SharedMemoryMapPlugin64.dll` LMU'nun `Plugins/` klasöründe olmalı ve
oyunda etkin olmalı (sende zaten var).

### b. Firebase "bot" hesabı (köprünün yazması için)
1. Firebase Console → Authentication → **Sign-in method** → **Email/Password**'ü etkinleştir.
2. **Authentication → Users** → **Add user** → bot hesabı ekle
   (ör. `bridge-bot@caspian.local` + güçlü parola). ⚠️ Gerçek/kişisel bir Gmail
   hesabını KULLANMA — o hesap muhtemelen Google ile giriş bağlı, parolası
   olmadığından giriş başarısız olur ("PASSWORD_LOGIN_DISABLED" /
   "INVALID_LOGIN_CREDENTIALS" hatası). Tamamen yeni, sadece bu iş için bir
   e-posta kullan.
3. Yeni kullanıcının **User UID**'sini kopyala (Users listesinde satırın
   yanındaki kopyalama simgesi).
4. **Realtime Database**'de **kökte** (üst seviyede, `users`/`teams` ile
   yan yana) tek bir düz anahtar ekle — takım rolü ile uğraşmaya gerek yok:
   - `bridgeBots` düğümü üzerine gel → **"+"** → **Name:** `BOT_UID` (kopyaladığın
     UID), **Value:** `true` → onayla.
   - Sonuç: `bridgeBots/BOT_UID: true`. Bu tek satır köprüye `live` düğümünü
     okuma/yazma izni verir — takım üyeliği veya "editor" rolü gerekmez.

### c. team_id ve race_id
Web uygulamasında yarışı aç → **Canlı** sekmesi bağlantı bilgisinde
`team_id` ve `race_id` gösterilir. Bunları `config.ini`'ye kopyala.

---

## 2) Yapılandırma
`config.example.ini`'yi `config.ini` olarak kopyala (exe ile aynı klasör) ve doldur:
`email`, `password`, `team_id`, `race_id`. `api_key`/`database_url` hazır gelir.

---

## 3) Çalıştırma ve 3 katmanlı doğrulama

**En kolay yol:** `.exe`'ye **çift tıkla** → bir form açılır. Bot e-posta/parola,
team_id, race_id gir → **Kaydet & Başlat**. **Self-Test** butonu Firebase bağlantını
kontrol eder. (config.ini otomatik yazılır; Not Defteri gerekmez.)

Aşağıdaki komutlar ileri/teşhis içindir. Çalışabilirliği katman katman doğrula:

**Katman 1 — Web (oyun/exe olmadan):** Siteyi aç → yarışı aç → **Canlı** sekmesi.
"📡 bağlı değil" + team_id/race_id kutusu görünüyorsa web tamam.

**Katman 2 — Firebase (oyunsuz):**
```
CaspianLiveBridge.exe --selftest
```
Küçük bir işaret yazıp geri okur → **SELFTEST PASS** demeli. FAIL derse konsoldaki
ipucunu izle (bot allowed/editor mi, team_id/race_id doğru mu, Email/Password açık mı).
Sonra sahte yarışla web'i doldur:
```
CaspianLiveBridge.exe --mock
```
Web **Canlı** sekmesi 14 araçla dolmalı. Buraya kadar çalıştıysa auth + kurallar +
yazma + web okuma **hepsi doğru** (oyun hariç).

**Katman 3 — Gerçek (LMU):** Oyunda seansa gir, sonra:
```
CaspianLiveBridge.exe
```
Boş/saçma gelirse LMU'dan **ne okunduğunu** gör:
```
CaspianLiveBridge.exe --dump
```
Bu, paylaşımlı bellekten çözülen JSON'u konsola basar (Firebase'e yazmaz). Alanlar
boşsa eşleme/sürüm sorunudur → `rf2_source.py`. `--once` ile tek gönderim de yapılır.

**Hava doğrulama (`--dump-wx`):** uygulama ıslaklık/yağış yüzdesini kelimeye çeviriyor
(Damp, Slightly Wet…) ama bu eşikler tahmin — oyun ıslaklığı ne paylaşımlı bellekte ne
de REST'inde kelime olarak veriyor. Bu mod ikisini yan yana koyar:
```
CaspianLiveBridge.exe --dump-wx
```
Önce oyunun **kendi gökyüzü sözlüğünü** basar (`/rest/sessions/weather` →
`WNV_SKY.stringValue`), sonra saniyede bir canlı ıslaklık/yağış yüzdesini. Islak bir
seansta açık bırakıp oyundaki yazıyla karşılaştırınca eşikler ölçümle düzeltilebilir.
(Zemin ıslaklığı kelimesi için uygulamadaki **🌦 Hava Kalibrasyonu** paneli kullanılır.)

---

## 4) .exe üretmek
- **CI'dan indir:** GitHub Actions → *Build Live Bridge* iş akışı artefaktı.
- **Elle:**
  ```
  pip install -r requirements.txt pyinstaller
  pyinstaller --onefile --name CaspianLiveBridge main.py
  ```
  `dist/CaspianLiveBridge.exe` oluşur. `config.ini` ile aynı klasöre koy.

---

## Doğrulama / bakım notu
- `--mock` boru hattını (auth + yazma + web okuma) uçtan uca doğrular; **oyun gerekmez.**
- Gerçek okuma `pyRfactor2SharedMemory` ile yapılır ve alan adları `rF2data.h`'e
  dayanır. LMU güncellemeleri struct düzenini kaydırabilir → veri saçmalarsa
  `rf2_source.py`'deki eşlemeyi/kütüphane sürümünü güncelle. Erişimler `getattr`
  ile korumalı olduğundan eksik alan çökme yapmaz, boş görünür.
- Kota: `hz=2` önerilir (saniyede ~2 yazım). Çok araçlı sahada bu birkaç KB/yazımdır.
