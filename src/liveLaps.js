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
