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
