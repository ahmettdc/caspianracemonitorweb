# Caspian Race Control

Dayanıklılık yarışları için stint / yakıt / lastik / pilot strateji aracı.
Gerçek zamanlı takım senkronizasyonu Firebase Realtime Database üzerinden çalışır.

## 1) Firebase kurulumu (~10 dk, ücretsiz)

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** (Analytics gerekmez).
2. Sol menü **Build → Realtime Database → Create Database** → bölge seç (europe-west1 uygun) → **Start in test mode**.
3. **Project Settings (⚙️) → General → Your apps → Web (`</>`)** ile bir web uygulaması kaydet.
4. Çıkan `firebaseConfig` objesini `src/firebase-config.js` içine yapıştır.
   `databaseURL` alanı config'de yoksa Realtime Database sayfasının üstündeki URL'yi elle ekle.
5. **ÖNEMLİ — kalıcı güvenlik kuralları.** Test mode herkese açıktır ve 30 gün
   sonra kapanır. Bu repodaki [`firebase-rules.json`](./firebase-rules.json)
   dosyası koddaki tüm veri yollarını (kullanıcılar, takımlar, sezon/yarış,
   setup havuzu, sohbet) kapsar ve şu ilkelere dayanır:
   - Tüm okuma/yazma `auth != null` gerektirir (Google ile giriş zorunlu).
   - Veriye erişim admin onayına (`users/{uid}/allowed == true`) bağlıdır.
   - Takım verisi yalnız üyelere; sezon/yarış yazımı owner/editor'e açıktır.
   - Sohbet ve setup boyutları `.validate` ile sınırlıdır (mesaj ≤500 karakter,
     setup dosyası <260 KB) — spam/DoS'a karşı.

   **Yayınlama seçenekleri:**
   - Elle: **Realtime Database → Rules** sekmesine `firebase-rules.json` içeriğini
     yapıştır → **Publish**.
   - Otomatik (CI): repo secret olarak `FIREBASE_TOKEN` (`firebase login:ci` ile
     üretilir) ekle; `main`'e her push'ta `.github/workflows/deploy.yml`
     içindeki `deploy-firebase-rules` işi kuralları otomatik yayınlar.
     Yerelden: `npm i -g firebase-tools && firebase deploy --only database`.

> **Ek sertleştirme (önerilir):** Firebase konsolundan **App Check** etkinleştir
> ve web API anahtarına **HTTP referrer** kısıtlaması ekle. Bunlar olmadan
> `databaseURL` herkese açık erişilebilirdir ve güvenlik kuralları tek savunma hattıdır.
>
> Not: Oda kodu + PIN sistemi pratik bir engel, kriptografik güvenlik değildir.
> Yarış stratejisi için yeterlidir — veritabanına hassas veri koymayın.

## 2) Lokal çalıştırma

```bash
npm install
npm run dev
```

## 3) GitHub'a yükleme + otomatik yayın

1. GitHub'da yeni repo oluştur (ör. `caspian-race-control`).
2. Bu klasörde:

```bash
git init
git add .
git commit -m "Caspian Race Control v0.5"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADIN/caspian-race-control.git
git push -u origin main
```

3. Repo → **Settings → Pages → Source: GitHub Actions** seç.
4. Her `main` push'unda `.github/workflows/deploy.yml` otomatik derleyip yayınlar.
   Adres: `https://KULLANICI_ADIN.github.io/caspian-race-control/`

## 4) Masaüstü uygulaması (Tauri) — opsiyonel

Web uygulamasının yanında, çift tıklayınca açılan bir Windows `.exe` de var
(`src-tauri/`). Vite build'ini (dist/) gömülü olarak paketler; internet yalnız
Firebase senkronizasyonu/canlı timing için gerekir. Uygulama içi bir **updater**
başlangıçta yeni sürüm olup olmadığını kontrol eder ve varsa "Güncelle" bandı
gösterir (`src/UpdateBanner.jsx`).

**Yerel geliştirme:**
```bash
npm run tauri dev     # WebView penceresinde canlı geliştirme (HMR)
npm run tauri build   # Yerel .exe/.msi üretir (Windows'ta)
```

**CI (`.github/workflows/desktop.yml`):** `main`'e ilgili dosyalar değişince
`windows-latest`'te derler, imzalar, GitHub Release'e yükler
(`desktop-v<versiyon>` etiketi + `latest.json` — updater bunu okur).

**Masaüstünde Google girişi — sistem tarayıcısı + loopback (OAuth).**
Gömülü WebView2, Firebase'in popup/redirect akışlarını taşıyamaz (Google gömülü
tarayıcılarda OAuth'u da engeller). Bu yüzden masaüstünde giriş, kullanıcının
**varsayılan sistem tarayıcısında** açılır ve geçici bir yerel loopback ile geri
alınır (authorization code + PKCE, `src/tauriGoogleAuth.js` + `src-tauri` komutları).
Tek seferlik kurulum:
1. **Google Cloud Console → APIs & Services → Credentials → Create credentials →
   OAuth client ID → Application type: _Desktop app_** (Firebase ile aynı proje:
   `caspian-race-control`). Çıkan **Client ID** ve **Client secret**'ı kopyala.
   (Desktop istemci secret'ı Google tarafında gizli kabul edilmez; yine de public
   repoya yazılmaz — GitHub Secrets'tan derleme zamanı enjekte edilir.)
2. GitHub repo → **Settings → Secrets and variables → Actions** ile iki secret ekle:
   - `VITE_GOOGLE_OAUTH_CLIENT_ID` = Desktop istemcinin Client ID'si
   - `GOOGLE_OAUTH_CLIENT_SECRET` = Desktop istemcinin Client secret'ı

   > Loopback redirect (`http://127.0.0.1:<port>`) Desktop istemcilerde otomatik
   > izinlidir — ayrıca redirect URI eklemeye gerek yok. `tauri.localhost`'u
   > Firebase Authorized domains'e eklemek bu akış için **gerekmez**.

**İmzalama anahtarı — public key zaten gömülü.** Bir anahtar çifti üretilip
public kısmı `src-tauri/tauri.conf.json` → `plugins.updater.pubkey` alanına
yazıldı. **Tek eksik adım — private key'i GitHub Secrets'a eklemek:**
GitHub repo → **Settings → Secrets and variables → Actions → New repository
secret** ile şu ikisini ekle (değerler ayrıca iletildi):
- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

Bu ikisi eklenmeden CI derlemesi başarısız olur (updater'ın imza doğrulaması
için şart) — eklenince bir sonraki push'ta otomatik düzelir.

> Yeni bir anahtar çifti üretmek istersen (ör. mevcut anahtar sızarsa):
> `npx tauri signer generate` (Node.js gerektirir) — public kısmı yukarıdaki
> alana yaz, private kısmı + parolayı yukarıdaki secret'lara güncelle.

**Sürüm güncelleme:** yeni bir masaüstü sürümü yayınlamak için `package.json`
ve `src-tauri/tauri.conf.json` içindeki `"version"` alanını **birlikte** ve
**bir öncekinden farklı** bir değere çıkar, sonra `main`'e push et — CI otomatik
derleyip yayınlar, mevcut kullanıcılar uygulama içi banner ile görür.

## Notlar

- Firebase config doldurulmazsa uygulama **solo modda** açılır (tüm hesaplar çalışır, oda özelliği kapalı).
- Senkronizasyon artık 3 sn polling yerine Firebase `onValue` ile **anlık**.
- Repo herkese açıksa `firebase-config.js` de görünür — bu normaldir; Firebase web
  API anahtarları gizli değildir, erişim kuralları (Rules) belirleyicidir.
