/* ============================================================
   HAVA KALİBRASYONU — saf mantık (React/Firebase bağımsız)
   ------------------------------------------------------------
   Neden: uygulama zemin ıslaklığını kelimeye çeviriyor (Damp, Slightly Wet…) ama
   eşikler TAHMİN. Ne paylaşımlı bellekte (`mAvgPathWetness` = 0..1 sayı) ne de LMU
   REST'inde ıslaklığı KELİME veren bir alan var — kelime oyunun arayüz katmanında
   üretiliyor. Dolayısıyla tek doğrulama yolu ÖLÇÜM: kullanıcı oyundaki yazıyı
   gördüğü anda ilgili düğmeye basar, biz o anın yüzdesini damgalarız.

   Burası damgaların biriktirilmesi ve eşik türetilmesidir; UI (LiveTab) yalnız
   çağırır, wxCalib.test.js doğrudan test eder.
   ============================================================ */
/* Veri YOK ile 0 farklıdır (`Number(null) === 0`) — süzgeç engine ile ortak. */
import { wxPct } from "./engine";

/* Oyunun (seans/hava ekranındaki) zemin sözlüğü — kullanıcının damgalayacağı kelimeler.
   "Very Wet" bilerek burada: bizim WEATHER modelimizde YOK, gerçekten görülüyor mu
   ölçümle anlaşılacak (görülürse 6. kademe eklenir). */
export const CALIB_WORDS = [
  "Dry", "Damp", "Slightly Wet", "Wet", "Very Wet", "Extremely Wet",
];

export const CALIB_MAX = 200;      // localStorage şişmesin (ölçüm için fazlasıyla yeter)

/* Bir damga ekle. Yüzdeler geçersizse (veri yok) örnek ALINMAZ — yoksa 0'lar
   eşikleri aşağı çeker. Aynı kelime arka arkaya basılsa bile ölçüm sayılır:
   sınırın iki yakasındaki tekrarlar aralığı daraltır. */
export function addSample(samples, word, session, now = Date.now()) {
  const list = Array.isArray(samples) ? samples : [];
  if (!CALIB_WORDS.includes(word)) return list;
  const wetness = wxPct(session?.wetness);
  const rain = wxPct(session?.rain);
  if (!Number.isFinite(wetness)) return list;
  const s = {
    ts: now,
    word,
    wetness: Math.round(wetness),
    rain: Number.isFinite(rain) ? Math.round(rain) : null,
  };
  return [...list, s].slice(-CALIB_MAX);
}

/* Damgalardan eşik önerisi: her kelime için gözlenen en düşük/en yüksek ıslaklık.
   Eşik = bir kelimenin gözlendiği EN DÜŞÜK yüzde (o kademe oradan başlıyor demektir);
   bir üstteki kademenin en yükseğiyle arasındaki boşluk belirsizlik aralığıdır.
   Sıralama CALIB_WORDS'e göre (kuru → en ıslak), yalnız veri olan kelimeler döner. */
export function thresholdsFrom(samples) {
  const by = new Map();
  for (const s of Array.isArray(samples) ? samples : []) {
    if (!s || !CALIB_WORDS.includes(s.word) || !Number.isFinite(s.wetness)) continue;
    const cur = by.get(s.word);
    if (!cur) by.set(s.word, { word: s.word, n: 1, min: s.wetness, max: s.wetness });
    else {
      cur.n += 1;
      if (s.wetness < cur.min) cur.min = s.wetness;
      if (s.wetness > cur.max) cur.max = s.wetness;
    }
  }
  return CALIB_WORDS.filter((w) => by.has(w)).map((w) => by.get(w));
}

/* Dışa aktarım gövdesi — kullanıcı indirip gönderir, eşikleri bundan türetiriz. */
export function exportPayload(samples, meta = {}) {
  return JSON.stringify({
    kind: "caspian-wx-calib",
    v: 1,
    at: new Date().toISOString(),
    ...meta,
    samples: Array.isArray(samples) ? samples : [],
    summary: thresholdsFrom(samples),
  }, null, 2);
}
