# i18n — sözlük boşlukları (kapandı)

`docs/design-handoff/ARAYUZ-YENILEME-PROMPT-v2.md` kural 5:

> i18n TR/EN korunur. EN metinleri hazır verilir (`i18n-EN.md`) — çeviri üretme,
> o dosyadaki karşılıkları `src/i18n.js`'e gir. **Listede olmayan bir metin
> ürettiysen bana sor.**

v2.0 uygulaması sırasında `i18n-EN.md`'de karşılığı olmayan 20 metin ortaya
çıktı. Karşılıklar önerildi, **onaylandı** ve `src/i18n.js`'e girildi.
Kapsam `src/i18n.test.js` ile kilitli — bu anahtarlardan biri silinirse test
kırmızıya döner.

Terim kararları `i18n-EN.md` sonundaki tabloya uyduruldu (stint çevrilmez,
saha = field, Aralık = Interval, VE = Virtual Energy, kadro = roster,
izleyici = viewer).

## Girilen karşılıklar

| # | Ekran | TR metin | EN |
| --- | --- | --- | --- |
| 1 | Yakıt | Senaryolar | Scenarios |
| 2 | Yakıt | Planlanan | Planned |
| 3 | Yakıt | Tasarruflu | Saving |
| 4 | Yakıt | Agresif | Aggressive |
| 5 | Yakıt | Senaryolar yalnız gösterim — plan verisine yazılmaz. | Scenarios are preview only — nothing is written to the plan. |
| 6 | Canlı | Satır yoğunluğu | Row density |
| 7 | Canlı | Pist ve araç paneli | Track & car panel |
| 8 | Canlı | Köprü durumu ve kaydı | Bridge status and recording |
| 9 | Kabuk | Menü | Menu |
| 10 | Kabuk | Menüyü aç | Show menu |
| 11 | Kabuk | Menüyü gizle | Hide menu |
| 12 | Kabuk | Dash | Dash |
| 13 | Kabuk | Tele | Tele |
| 14 | Kabuk | Ana içerik | Main content |
| 15 | Stint | Canlı senkron | Live sync |
| 16 | Stint | Oto saat | Auto clock |
| 17 | Stint | PIT YOLUNDA | PITTING |
| 18 | Lastik | Kullanım | Uses |
| 19 | Lastik | kilitli köşe | locked corner |
| 20 | PDF | Yazdır | Print |

Kararlar:

- **12–13 (Dash, Tele)** bilerek aynı bırakıldı: ikisi de kısaltma ve İngilizcede
  de aynı okunuyor. Kayıtlar yine de sözlüğe girildi — ileride "çevrilmemiş
  boşluk" sanılmasın diye.
- **17 (PIT YOLUNDA) → PITTING**; `IN PIT LANE` de olabilirdi ama düğme dar.
- **3–4 (Tasarruflu / Agresif) → Saving / Aggressive**, LMU topluluğunda yaygın
  kullanım.

## `i18n-EN.md`'den gelenler

Bunların karşılığı teslim paketinde vardı ve doğrudan girildi — onay
gerekmedi: `Ana menü` · `stint uygun değil` · `Set envanteri` ·
`Hızlı atama` · `Temizle` · `Köşe kilidi ihlali` · `Yarış raporu` ·
`PDF olarak indir` · `Pist koşulları` · `Pilot dağılımı` · `Mühendis notu`
ve §1–§8'in tamamı.

`Yakıt`, `Lastik`, `Pilot`, `Pilotlar`, `Oto PIT`, `Takım`, `Stint`, `Canlı`,
`Setup`, `Kapat`, `Telemetri` sözlükte zaten vardı; yeniden eklenmedi.
