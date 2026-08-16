# i18n — sözlükte olmayan metinler

`docs/design-handoff/ARAYUZ-YENILEME-PROMPT-v2.md` kural 5:

> i18n TR/EN korunur. EN metinleri hazır verilir (`i18n-EN.md`) — çeviri üretme,
> o dosyadaki karşılıkları `src/i18n.js`'e gir. **Listede olmayan bir metin
> ürettiysen bana sor.**

Aşağıdaki metinler v2.0 uygulaması sırasında ortaya çıktı ve `i18n-EN.md`'de
karşılığı yok. **Çeviriler `src/i18n.js`'e HENÜZ GİRİLMEDİ** — bu tablo onay
bekliyor. Onaylanınca tek commit'te sözlüğe geçirilecek.

Şu an İngilizce arayüzde bu satırlar Türkçe görünüyor: `t()` karşılık
bulamayınca kaynak metne düşer (`App.jsx`: `EN[str] ?? str`). İşlevsel bir
sorun değil.

## Onay bekleyen karşılıklar

Terim kararları `i18n-EN.md` sonundaki tabloya uyduruldu (stint çevrilmez,
saha = field, Aralık = Interval, VE = Virtual Energy, kadro = roster,
izleyici = viewer).

| # | Ekran | TR metin | Önerilen EN | Onay |
| --- | --- | --- | --- | --- |
| 1 | Yakıt | Senaryolar | Scenarios | |
| 2 | Yakıt | Planlanan | Planned | |
| 3 | Yakıt | Tasarruflu | Saving | |
| 4 | Yakıt | Agresif | Aggressive | |
| 5 | Yakıt | Senaryolar yalnız gösterim — plan verisine yazılmaz. | Scenarios are preview only — nothing is written to the plan. | |
| 6 | Canlı | Satır yoğunluğu | Row density | |
| 7 | Canlı | Pist ve araç paneli | Track & car panel | |
| 8 | Canlı | Köprü durumu ve kaydı | Bridge status and recording | |
| 9 | Kabuk | Menü | Menu | |
| 10 | Kabuk | Menüyü aç | Show menu | |
| 11 | Kabuk | Menüyü gizle | Hide menu | |
| 12 | Kabuk | Dash | Dash | |
| 13 | Kabuk | Tele | Tele | |
| 14 | Kabuk | Ana içerik | Main content | |
| 15 | Stint | Canlı senkron | Live sync | |
| 16 | Stint | Oto saat | Auto clock | |
| 17 | Stint | PIT YOLUNDA | PITTING | |
| 18 | Lastik | Kullanım | Uses | |
| 19 | Lastik | kilitli köşe | locked corner | |
| 20 | PDF | Yazdır | Print | |

Notlar:

- **12–13 (Dash, Tele)** kasıtlı olarak aynı bırakıldı: ikisi de kısaltma ve
  İngilizcede de aynı okunuyor. Farklı bir şey istersen (ör. `Dash` → `Home`)
  söyle.
- **17 (PIT YOLUNDA)** için `PITTING` seçildi; `IN PIT LANE` de olabilir ama
  düğme dar, kısa olan tercih edildi.
- **3–4 (Tasarruflu / Agresif)** yakıt tüketim senaryosu adları; `Saving` /
  `Aggressive` LMU topluluğunda yaygın kullanım.

## Zaten çözülmüş olanlar

Bu metinlerin karşılığı `i18n-EN.md`'den geldi ve `src/i18n.js`'e girildi —
onay gerekmiyor:

`Ana menü` → Main menu · `stint uygun değil` → stints unavailable ·
`Set envanteri` → Set inventory · `Hızlı atama` → Quick assign ·
`Temizle` → Clear · `Köşe kilidi ihlali` → Corner lock violation ·
`Yarış raporu` → Race report · `PDF olarak indir` → Download as PDF ·
`Pist koşulları` → Track conditions · `Pilot dağılımı` → Driver split ·
`Mühendis notu` → Engineer's note

Ayrıca `Yakıt`, `Lastik`, `Pilot`, `Pilotlar`, `Oto PIT`, `Takım`, `Stint`,
`Canlı`, `Setup`, `Kapat`, `Telemetri` sözlükte ZATEN vardı; yeniden
eklenmedi.
