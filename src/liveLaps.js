/* ============================================================
   Tur geçmişi eşlemesi — SAF mantık (Firebase'siz, test edilebilir)
   ------------------------------------------------------------
   Köprü her karede o aracın son turlarını taşır: `laps` (süreler) + `lapNums`
   (GERÇEK tur numaraları). Bu numaralar ARDIŞIK OLMAYABİLİR: Aggregator tur log'una
   yalnız geçerli turları yazar (`lastSec > 0`) ve `lapsDone` bir kareden diğerine
   1'den fazla atlayabilir (uygulama arka planda kısılırsa). Eskiden JS numaraları
   `lapsFrom + i` diye ARDIŞIK varsayıyordu → bir boşluktan sonraki tüm turlar bir
   kayarak yazılıyordu (tur 4'ün süresi tur 3 diye) ve bu kalıcı `livelaps` düğümünde
   düzelmiyordu. Artık numaralar köprüden gelir.
   ============================================================ */

/* Satırın tur sürelerine hizalı gerçek tur numaraları.
   Köprü `lapNums` verdiyse onu kullanır (yeni sözleşme); vermediyse (eski köprü .exe)
   `lapsFrom + i` ardışık varsayımına düşer — davranış eskisi gibi, kırılma yok. */
export function lapNumbersOf(row) {
  const laps = Array.isArray(row?.laps) ? row.laps : null;
  if (!laps || !laps.length) return [];
  const nums = row.lapNums;
  if (Array.isArray(nums) && nums.length === laps.length
      && nums.every((n) => Number.isFinite(n) && n > 0)) {
    return nums;
  }
  const from = row.lapsFrom;
  if (!(from > 0)) return [];
  return laps.map((_, i) => from + i);
}

/* v1.6.3 — OKUYUCU tarafı bayat-veri koruması: "+" popup'ı yalnız aracın GÜNCEL
   lapsDone'una kadar olan turları göstermeli. Neden: livelaps append-only ve araç
   kimliği (c{mID}) oyun tarafından YENİDEN KULLANILIR — aynı takvim yarışının önceki
   koşusundan kalan turlar (yazıcı temizlemesi ateşlenmediyse) yeni araca "olmayan
   turlar/pilotlar" olarak sızar. Tur numaraları ardışık tamamlandığı ve her tur
   tamamlandığı anda livelaps/{key}/{n} ÜZERİNE yazıldığı için n ≤ lapsDone satırları
   bu seansın verisidir (köprü seans başından çalışıyorsa). lapsDone yok/geçersiz →
   dokunma (geriye uyum: eski kare/kayıt). */
export function capLapEntries(lapMap, lapsDone) {
  if (!lapMap || typeof lapMap !== "object") return lapMap;
  if (lapsDone == null) return lapMap;         // Number(null)===0 tuzağı: null = "cap yok"
  const cap = Number(lapsDone);
  /* v1.8.12 — cap-sıfırlama hatası: ANLIK lapsDone=0 (yırtık kare / araç sahaya yeni
     girdi / lobi geçişi) 18 gerçek turu GİZLİYORDU (cap=0 → n<=0 hiçbiri geçmez → boş).
     Artık yalnız lapsDone SONLU ve > 0 iken cap uygula (0/negatif = null gibi "cap yok").
     Gerçek "0 tur" durumunda zaten gizlenecek veri yok; reused-mID phantom verisi ise
     OKUYUCU-tarafı sessionId clear-all (lapObs.js) + manuel "temizle" düğmesiyle kapanır. */
  if (!Number.isFinite(cap) || cap <= 0) return lapMap;
  const out = {};
  for (const k of Object.keys(lapMap)) {
    const n = Number(k);
    if (Number.isFinite(n) && n <= cap) out[k] = lapMap[k];
  }
  return out;
}

/* Bir turu KİMİN attığı (endurance driver swap).
   `livedrv/{rid}/{lapKey}/{n} = ad` düğümü SEYREKTİR: pilot yalnız DEĞİŞTİĞİ turda
   yazılır (stint boyunca sabit olduğu için her tura ad yazmak gereksiz yazma olurdu).
   Bu yüzden okuma "ileri doldurma"dır: n turunun pilotu, n'den küçük/eşit EN BÜYÜK
   anahtarın değeridir. Kayıt öncesi turlar (ör. köprü sonradan açıldı) → "". */
export function driverAtLap(drvMap, n) {
  if (!drvMap || typeof drvMap !== "object" || !(n > 0)) return "";
  let bestN = -1, name = "";
  for (const k of Object.keys(drvMap)) {
    const kn = Number(k);
    // sayısal sıralama şart: metin sıralamasında "10" < "9" olurdu
    if (Number.isFinite(kn) && kn <= n && kn > bestN) {
      const v = drvMap[k];
      if (typeof v === "string" && v) { bestN = kn; name = v; }
    }
  }
  return name;
}

/* Bir turdaki PİST KOŞULLARI: livecond/{rid}/{lapKey}/{n} = "temp,wet,grip"
   (asfalt sıcaklığı °C, zemin ıslaklığı %, yol tutuş %). Köprü, tur tamamlandığı
   karede o anki seans koşullarını yazar. Boş/eksik alan → null; hiçbiri yoksa → null.
   (livesec parse deseninin aynısı; virgülle ayrık, toleranslı.) */
export function parseLapCond(str) {
  if (typeof str !== "string" || !str) return null;
  const p = str.split(",");
  const num = (x) => {
    if (x == null || String(x).trim() === "") return null;
    const v = Number(x);
    return Number.isFinite(v) ? v : null;
  };
  const temp = num(p[0]);
  const wet = num(p[1]);
  const grip = num(p[2]);
  if (temp == null && wet == null && grip == null) return null;
  return { temp, wet, grip };
}

/* "Normal tur" tabanı — out/in lap işaretlemek için eşik: MEDYAN (en iyi DEĞİL).
   NEDEN (saha hatası): out/in lap tespiti `best * 1.10` ile yapılıyordu. En iyi tur
   KURU'da atılmışsa (ör. 1:19), tüm ISLAK turlar (ör. 1:31 — 12-16 sn yavaş) %10
   eşiğini aşıyor ve HEPSİ "OUT LAP" damgası yiyordu. Medyan koşuldan bağımsızdır:
   out/in lap'ler azınlıktadır ve YAVAŞ olduklarından medyanı yukarı kaydırmazlar, yani
   medyan o stintin "normal" turunu temsil eder (ıslaksa ıslak, kuruysa kuru). Böylece
   yalnız GERÇEKTEN yavaş (pit çıkışı/incident) turlar işaretlenir. SAF + testli. */
export function normalLapBaseline(secs) {
  const v = (Array.isArray(secs) ? secs : [])
    .map(Number).filter((x) => x > 0).sort((a, b) => a - b);
  if (!v.length) return 0;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}
