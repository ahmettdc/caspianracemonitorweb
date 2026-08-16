# i18n — sözlükte olmayan metinler (WS4'te sorulacak)

`docs/design-handoff/ARAYUZ-YENILEME-PROMPT-v2.md` kural 5:

> i18n TR/EN korunur. EN metinleri hazır verilir (`i18n-EN.md`) — çeviri üretme,
> o dosyadaki karşılıkları `src/i18n.js`'e gir. **Listede olmayan bir metin
> ürettiysen bana sor.**

Aşağıdaki metinler v2.0 uygulaması sırasında ortaya çıktı ve `i18n-EN.md`'de
karşılığı YOK. Çeviri **üretilmedi**: İngilizce arayüzde `t()` kaynak Türkçe
metne düşüyor (`App.jsx`: `EN[str] ?? str`) — yani uygulama çalışıyor, yalnız bu
satırlar İngilizce arayüzde Türkçe görünüyor.

Karşılıkları doldurulunca `src/i18n.js`'e girilecek.

| Ekran | TR metin | EN karşılığı |
| --- | --- | --- |
| Yakıt | Senaryolar | |
| Yakıt | Planlanan | |
| Yakıt | Tasarruflu | |
| Yakıt | Agresif | |
| Yakıt | Senaryolar yalnız gösterim — plan verisine yazılmaz. | |
| Canlı | Satır yoğunluğu | |
| Canlı | Pist ve araç paneli | |
| Canlı | Köprü durumu ve kaydı | |
| Kabuk | Menüyü aç | |
| Kabuk | Menüyü gizle | |
| Kabuk | Ana menü *(ray düğmesi — §1'deki "Ana menü" rehber başlığıyla aynı anahtar)* | Main menu ✔ |
| Kabuk | Menü | |
| Kabuk | Takım · Dash · Stint · Yakıt · Canlı · Lastik · Pilot · Tele · Setup *(ray etiketleri)* | |
| Kabuk | Ana içerik | |
| Pilotlar | stint uygun değil *(çoğul sayaç)* | stints unavailable ✔ |
| Genel | Kapat | |

> ✔ işaretliler `i18n-EN.md`'den türetilebildi ve zaten girildi; kalanlar için
> karşılık bekleniyor.
