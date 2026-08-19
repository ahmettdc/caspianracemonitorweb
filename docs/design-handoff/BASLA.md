# Buradan başla (Claude Code için)

Bu klasör, Caspian Race Monitor arayüz yenilemesinin (v2.0) tam teslim paketidir.
Repo: `ahmettdc/caspianracemonitorweb` · taban `main` @ v1.8.20 · dal `claude/arayuz-v2`
· teslim: main'e **v2.0.0** merge.

## Okuma sırası

1. **`ARAYUZ-YENILEME-PROMPT-v2.md`** — uygulama talimatı. İçindeki kod bloğunu Claude Code
   oturumuna olduğu gibi yapıştır. Kararlar netleşmiş sürümdür; sonunda v1'e göre değişenler
   tablosu var.
2. **`README.md`** — design tokens, 18 ekranın ayrıntılı tarifi, etkileşimler, state listesi,
   asset listesi, ekran → kaynak dosya eşlemesi.
3. **`Yeni Tasarım.dc.html`** — birebir uygulanacak tıklanabilir tasarım. Tarayıcıda aç.
4. **`i18n-EN.md`** — yeni/değişen tüm metinlerin EN karşılıkları. `src/i18n.js`'e buradan gir;
   listede olmayan metin için çeviri üretme, sor. (`i18n EN Sözlüğü.dc.html` aynı içeriğin
   okunabilir hali.)
5. **`github.md`** — repo bağlantısı, ekran → kaynak dosya eşlemesi, senkron geçmişi.

Karşılaştırma referansı: `Mevcut Arayüz.dc.html` ve `Mevcut Ana Menü.dc.html` mevcut arayüzün
birebir kopyalarıdır — "önce/sonra" bakmak için.

## Dosyalar üretim kodu değildir

`.dc.html` dosyaları **tasarım referansıdır**: görünümü ve davranışı gösteren prototipler.
Kopyalanacak üretim kodu değil. Görev, bu tasarımları projenin mevcut ortamında
(React 19.2 + Vite 8, `src/styles.js` sınıf tabanlı CSS, Firebase, TR/EN i18n) yeniden
kurmaktır. `support.js` yalnız prototipi çalıştırır, üretime taşınmaz.

## Üç kural, kısaca

- Renk, tipografi, boşluk ve etkileşimler **nihai** değerlerdir — birebir uygula.
- Veriler mock'tur; gerçek akış mevcut projeden gelir (`liveBridge.js`, `engine.js`,
  `setupPool.js`, `storage.js`).
- Yeni asset üretme; hepsi `public/assets/**` içinde.
