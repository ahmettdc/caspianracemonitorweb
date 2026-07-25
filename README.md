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
     üretilir) ekle; `main`'e her `firebase-rules.json` değişikliğinde
     `.github/workflows/deploy-rules.yml` kuralları otomatik yayınlar.
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

## Notlar

- Firebase config doldurulmazsa uygulama **solo modda** açılır (tüm hesaplar çalışır, oda özelliği kapalı).
- Senkronizasyon artık 3 sn polling yerine Firebase `onValue` ile **anlık**.
- Repo herkese açıksa `firebase-config.js` de görünür — bu normaldir; Firebase web
  API anahtarları gizli değildir, erişim kuralları (Rules) belirleyicidir.
