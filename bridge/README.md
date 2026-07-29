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
2. **Users** → bir bot hesabı ekle (ör. `bridge-bot@caspian.local` + güçlü parola).
3. Realtime Database'de o hesabın `users/{uid}/allowed` alanını **true** yap.
4. Web uygulamasında bot hesabını **takıma "editor"** olarak ekle
   (veya sahip olarak takıma dahil et). Yalnız `live` yazma yetkisi bunun için gerekli.

### c. team_id ve race_id
Web uygulamasında yarışı aç → **Canlı** sekmesi bağlantı bilgisinde
`team_id` ve `race_id` gösterilir. Bunları `config.ini`'ye kopyala.

---

## 2) Yapılandırma
`config.example.ini`'yi `config.ini` olarak kopyala (exe ile aynı klasör) ve doldur:
`email`, `password`, `team_id`, `race_id`. `api_key`/`database_url` hazır gelir.

---

## 3) Çalıştırma

**Önce oyunsuz test et** (Firebase→web hattı doğru mu):
```
CaspianLiveBridge.exe --mock
```
Web'de **Canlı** sekmesi sahte bir yarışla dolmalı. Dolmuyorsa: bot hesabı
`allowed:true` mı, takıma editor mü, team_id/race_id doğru mu kontrol et.

**Gerçek:** LMU'da bir seansa gir, sonra:
```
CaspianLiveBridge.exe
```

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
