# Changelog

## v1.0.0 — 2026-07-23

İlk kararlı sürüm. Le Mans Ultimate endurance yarışları için pit wall / strateji aracı.

### Strateji motoru
- **Virtual Energy modeli**: depo daima %100 VE, gerçek yakıt `VE × ratio` ile türetilir
- Stint planlayıcı: A/B/C/D tur stratejileri, tur ve süre bazlı override (karşılıklı dışlama korumalı)
- **Son Stint Hesaplayıcı**: kalan süreye göre VE ihtiyacı, ondalık tur yukarı yuvarlama, extra lap payı
- **Lider bitiş modeli** (multiclass): `T_flag = ceil(T / L_lider) × L_lider` — bayrak liderde, son tur otomatik eklenir
- Pit süresi: pit lane + dolum + lastik + hasar/tamir; **dolum süresi doldurulan stintin VE ihtiyacına ölçekli**
- Lastik değişim süreleri sabit: 1-2 lastik 5s, 3-4 lastik 12s

### Hava durumu
- Dört zemin durumu: Dry ×1.00, Damp ×1.07, Slightly Wet ×1.09, Wet ×1.13; ıslakta yakıt −%8'e kadar
- **Kronolojik hava log'u**: her değişim zaman damgasıyla saklanır (dry→wet→dry korunur)
- Plan tur tur yürüyerek karma havayı hesaplar — stint içi geçişler doğru bölünür
- Canlı değişim + **planlı geçiş** (ileri tarihli, "son 60 dk wet" kısayolu); ikisi çakışmaz
- Stint çubuğunun altında animasyonlu hava kronoloji çubuğu

### Lastik yönetimi
- Beş durumlu köşe döngüsü: taşı / yeni kuru / Qual'a dön / wet / eski kuru tekrar
- Wet lastikler limitten bağımsız ve sınırsız
- Lastik limiti takibi, kullanım sayısına göre renk (3 kullanım turuncu, 4+ kırmızı), hızlı atama

### Canlı yarış
- Mutlak zamanlı geri sayım, stint takibi, pit board (tam ekran)
- **Pit işaretleme**: stint-indeksli seyrek kayıt — atlanan pit otomatik ilerler, kayma olmaz
- Sapma göstergesi (plan vs gerçek), tamir süresi girişi

### Takım ve veri
- Firebase ile çok kullanıcılı oda senkronizasyonu (oda kodu + PIN'li editör erişimi)
- **Google ile giriş** + admin onaylı erişim listesi; üye yönetimi paneli
- Saat dilimi doğru: mutlak epoch saklanır, her üye kendi yerelinde görür
- **LMU referans verisi** (Ohne Speed): 14 pist × 5 sınıf + araç bazlı tempo, seçime göre otomatik doldurma
- 21 pist krokisi, araç görselleri, sınıf rozetleri (WEC renk kodları)

### Çıktı ve arayüz
- PDF: stint tablosu (Start/Finish saatleri, servis çipleri), takım logosu, 2×2 bilgi kartları, pist krokisi
- Pilot süre dağılımı (donut) ve stint programı
- Katlanabilir sol panel, YouTube canlı yayın gömme, TR/EN dil desteği
- Telemetri (MoTeC CSV) içe aktarma
