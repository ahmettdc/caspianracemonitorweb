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

> **Masaüstü uygulaması kullanıyorsan (v1.4.4+):** köprü uygulamanın İÇİNDE —
> aşağıdaki bot hesabı / config.ini adımları GEREKMEZ. Yalnız **1a**'daki eklenti
> kurulumu her sürüş PC'sinde şarttır. Uygulama: Canlı sekmesi → köprü OTOMATİK.
> Yayınlayacak üyenin takımda **🎧 Mühendis (editor)** ya da **Sahip** rolü olmalı
> (izleyici rolünde köprü yayına geçmez; kart bunu söyler).

> 🪶 **Oyun donuyorsa — sürüş PC'sinde bu HAFİF köprüyü tercih et.** Masaüstü
> uygulaması içine **WebView2 (Chromium tarayıcı motoru)** gömer; sürüş PC'sinde bu
> motor oyunun GPU/çekirdekleriyle yarışıp **takılma** yaratabilir. Bu `.exe` ise
> tarayıcısızdır (yalnız küçük bir yerel pencere) — **TinyPedal gibi** hafiftir ve
> aynı paylaşımlı belleği okur. Sürücü bunu çalıştırır, mühendisler canlıyı **web'den**
> izler.

> 🧊 **Oyun DONUYORSA (v1.4.130+):** köprüdeki **"⚡ REST aç"** kutusunu **KAPALI bırak**
> (varsayılan kapalı). LMU REST, oyunun kendi localhost sunucusuna saniyede birkaç istek
> attığı için donmanın en güçlü sebebidir. Kapalıyken pozisyon/tur/gap/lastik yine çalışır;
> yalnız **VE%** ve **gerçek takım adı** gelmez. Köprü ayrıca artık **düşük öncelikte**
> çalışır (oyun çekişmede kazanır). Donma bittiyse ve VE/takım istiyorsan kutuyu aç; donma
> geri gelirse REST sebep demektir, kapalı bırak.

> 📦 **Kurulumla birlikte (v1.4.128+):** masaüstü **setup.exe**'yi kurunca hafif köprü
> (`CaspianLiveBridge.exe`) de kurulur ve **Başlat menüsüne "Caspian Hafif Kopru"** kısayolu
> eklenir. Ayrıca lobiden tek başına da indirilebilir (kurulumsuz, çift tıkla).

> ✅ **Bot GEREKMEZ (v1.4.127+):** köprüyü aç → **"🔐 Google ile Giriş"** → uygulamadaki
> gibi kendi Google hesabınla giriş yap → **Takım/Yarış'ı açılır listeden seç** → Başlat.
> Kendi hesabın `live`'a yazar (takımda **owner/editor** olman yeterli). Aşağıdaki **1b**
> (bot hesabı) + team_id/race_id kopyalama adımları artık **isteğe bağlı** (yalnız
> arayüzsüz/CLI kullanımı için).

---

## 1) Tek seferlik kurulum

### a. rF2 paylaşımlı bellek eklentisi — HER SÜRÜŞ PC'SİNE ayrı kurulur
Köprünün okuduğu paylaşımlı belleği oyuna **rFactor2SharedMemoryMapPlugin64.dll**
yazar. İki adımın İKİSİ de şart:

1. **DLL dosyası:** `rFactor2SharedMemoryMapPlugin64.dll` →
   `…\Steam\steamapps\common\Le Mans Ultimate\Plugins\` klasörüne kopyala.
   (Kaynak: TheIronWolf'un rF2 Shared Memory Map Plugin'i — Crew Chief kuruluysa
   o da kurar/güncel tutar; en az v3.6.0.0.)
2. **Etkinleştirme:** `…\Le Mans Ultimate\UserData\player\CustomPluginVariables.JSON`
   dosyasında şu blok olmalı (oyun DLL'i ilk görüşte ekler ama `" Enabled": 0`
   bırakabilir — **1 yap**, sonra oyunu yeniden başlat):
   ```json
   "rFactor2SharedMemoryMapPlugin64.dll": { " Enabled": 1 }
   ```

> ⚠️ **En sık hata:** DLL kopyalanır ama etkinleştirilmez (ya da yanlış klasöre
> konur). Windows bu durumda paylaşımlı belleği **sıfırlarla dolu** oluşturur —
> köprü "çalışıyor" görünür ama sonsuza dek bekler. v1.4.94'ten itibaren kart bu
> durumu açıkça söyler: **"Eklenti verisi yok — … ' Enabled': 1 olmalı."**
> Bu mesajı görüyorsan sorun oyunda/kurulumda, uygulamada değil.
> Ayrıca veri ancak bir **seansa girince** (garaj/pist) akar; ana menüde
> "Oyun açık, seans bekleniyor" görünür — bu normaldir.

### a-2. ⚡ PERFORMANS: gereksiz buffer yazımını kapat (oyun donuyorsa İLK BURAYA BAK)

Eklenti, buffer'ları **oyunun kendi karesinde** yazar ve hızları çok farklıdır:

| Buffer | Bit | Yazım hızı | Bu uygulama okuyor mu? |
|---|---|---|---|
| Telemetry | 1 | 50 FPS | ✅ evet |
| Scoring | 2 | 5 FPS | ✅ evet |
| Rules | 4 | 3 FPS | ❌ hayır |
| MultiRules | 8 | 3 FPS | ❌ hayır |
| **ForceFeedback** | **16** | **400 FPS** | ❌ hayır |
| **Graphics** | **32** | **400 FPS** | ❌ hayır |
| PitInfo | 64 | 100 FPS | ❌ hayır |
| Weather | 128 | 1 FPS | ❌ hayır |

Varsayılan ayarda (`UnsubscribedBuffersMask: 0`) hepsi yazılır → **FFB + Graphics tek
başına saniyede 800 yazım** ve bu uygulama onları hiç okumaz. Kapatmak için oyunu
**kapat**, `…\Le Mans Ultimate\UserData\player\CustomPluginVariables.JSON` içinde:

```json
"rFactor2SharedMemoryMapPlugin64.dll": { " Enabled": 1, "UnsubscribedBuffersMask": 48 }
```

Kademeler (bitleri topla) — **en güvenliden başla, sorun çıkmazsa yükselt**:

- **48** = FFB(16) + Graphics(32) → 400 FPS'lik iki yazım kalkar. Kazancın çoğu, riski en az.
- **240** = + PitInfo(64) + Weather(128) → pit/hava bilgisini paylaşımlı bellekten okuyan
  araçlar etkilenebilir.
- **252** = + Rules(4) + MultiRules(8) → **CrewChief** gibi kural/FCY okuyan araçlar
  etkilenir; yalnız başka araç çalıştırmıyorsan.

> ⚠️ **Başka araçlar (CrewChief / SimHub / TinyPedal) da açıksa** onların ihtiyacı olan
> buffer'ı kapatma. Uygulama bu dosyayı **asla kendisi yazmaz** — yalnız okuyup önerir
> (Canlı Köprü kartındaki ⚡ uyarısı). Ne yazıldığını görmek için:
> ```
> caspian-bridge.exe --check-plugin
> ```
> (Firebase/config gerekmez, hiçbir şeye yazmaz; masaüstü kurulumunda exe yolu için
> aşağıdaki Katman 3 notuna bak.)
>
> **Not:** Paylaşımlı belleği OKUMAK ucuzdur — ölçtük: kare başına ~0.3 MB, 2 Hz'de
> ~1.5 MB/s. Donmanın kaynağı okuma değil, oyunun içinde boşuna yazılan buffer'lardır.

### b. Giriş: **Google (önerilen)** ya da bot hesabı
**Önerilen — bot yok:** köprü penceresinde **"🔐 Google ile Giriş"** → tarayıcıda kendi
hesabınla onayla. Köprü senin Firebase hesabınla yazar; takımda **owner/editor** olman
yeterli (`bridgeBots`/bot GEREKMEZ). Oturum `config.ini`'ye kaydedilir → sonraki açılışlarda
tekrar giriş istemez. Sürüş PC'sindeki `.exe` bunu masaüstü uygulamasıyla **aynı** OAuth
istemcisiyle yapar.

**İsteğe bağlı — bot hesabı** (yalnız arayüzsüz/CLI istersen):
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
**Google ile Giriş yaptıysan:** köprüde **Takım** ve **Yarış** açılır listeden seçilir →
`team_id`/`race_id` otomatik dolar (elle kopyalama YOK). **Bot/CLI ile:** web'de yarışı aç →
**Canlı** sekmesindeki `team_id`/`race_id`'yi `config.ini`'ye kopyala.

---

## 2) Yapılandırma
**GUI (önerilen):** `.exe`'yi aç → "Google ile Giriş" → Takım/Yarış seç → Başlat. `config.ini`
kendiliğinden yazılır (elle dokunmana gerek yok). **Elle/CLI:** `config.example.ini`'yi
`config.ini` olarak kopyala; bot yolu için `email`/`password` + `team_id`/`race_id` doldur
(`api_key`/`database_url` hazır gelir).

---

## 3) Çalıştırma ve 3 katmanlı doğrulama

**En kolay yol:** `.exe`'ye **çift tıkla** → form açılır → **"🔐 Google ile Giriş"** →
tarayıcıda kendi hesabınla onayla → **Takım/Yarış** seç → **Kaydet & Başlat**. **Self-Test**
butonu Firebase bağlantını kontrol eder. (config.ini otomatik yazılır; bot GEREKMEZ.)

> 📄 **Kalıcı log:** köprü her koşuşunu bir dosyaya yazar
> (`%LOCALAPPDATA%\CaspianLiveBridge\caspian-bridge.log` — exe salt-okunur bir klasörde
> olsa da buraya yazar). Formda **"📄 Logu aç"** ile açılır; giriş/UID, kare gönderim
> sayısı, okuma/yazma gecikmesi (ms) ve hatalar burada. Bir sorunda bu dosyayı paylaş.

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
`_diag` alanına bak: `"shm": false` → eklenti yazmıyor (1a'daki kurulum/etkinleştirme);
`"shm": true, "trackLoaded": false` → oyun menüde, seansa gir.

> **Masaüstü kurulumunda** aynı teşhis, uygulamayla gelen sidecar'dan alınır:
> ```
> "C:\…\Caspian Race Monitor\binaries\caspian-bridge-x86_64-pc-windows-msvc.exe" --dump
> ```
> (config gerekmez; Firebase'e yazmaz.)

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
