/* ============================================================
   corners — .ld iz verisinden viraj (apex) + fren-başı tespiti
   ------------------------------------------------------------
   Saf/test edilebilir (React'siz). "Viraj ortası hızı" = hız yerel minimumu (apex);
   "fren mesafesi" = frenin eşiği aştığı ilk yaklaşma noktasından apex'e kadar mesafe.
   Sezgiseldir (gerçek beacon değil); hız + fren + mesafe kanalları gerekir.
   ============================================================ */

/* Hız dizisinde apex'leri (yerel minimum) bul. Belirginlik (minDropKmh: virajdan önceki
   tepe ile fark) + aralık (minGapM) süzgeciyle gürültü/şikan bölünmesi elenir.
   speed/dist: eşit uzunlukta diziler (null örnekler atlanır). → apex index dizisi. */
export function detectApexes(speed, dist, { minDropKmh = 12, minGapM = 60, win = 4 } = {}) {
  const n = speed?.length || 0;
  if (n < 5 || !dist || dist.length !== n) return [];
  const v = (i) => (Number.isFinite(speed[i]) ? speed[i] : Infinity);   // null → minimum sayılmaz
  const apexes = [];
  let runMax = -Infinity;   // bir önceki apex'ten beri yaklaşma tepesi
  for (let k = 1; k < n - 1; k++) {
    if (Number.isFinite(speed[k])) runMax = Math.max(runMax, speed[k]);
    if (!Number.isFinite(speed[k])) continue;
    let isMin = true;
    for (let j = Math.max(0, k - win); j <= Math.min(n - 1, k + win); j++) {
      if (v(j) < v(k)) { isMin = false; break; }
    }
    if (!isMin) continue;
    if (runMax - speed[k] < minDropKmh) continue;   // yeterince yavaşlama yok → viraj değil
    const last = apexes[apexes.length - 1];
    if (last != null && Math.abs(dist[k] - dist[last]) < minGapM) {
      if (speed[k] < speed[last]) apexes[apexes.length - 1] = k;   // yakın ikiliden yavaş olanı tut
      continue;
    }
    apexes.push(k);
    runMax = speed[k];   // apex sonrası yaklaşma tepesini sıfırla
  }
  return apexes;
}

/* Bir dizide, apex mesafesine ±winM içindeki en düşük (geçerli) değer. */
function minOver(arr, dist, ai, winM) {
  let m = Infinity;
  const d0 = dist[ai];
  for (let k = 0; k < arr.length; k++) {
    if (Math.abs(dist[k] - d0) <= winM && Number.isFinite(arr[k])) m = Math.min(m, arr[k]);
  }
  return Number.isFinite(m) ? m : null;
}

/* apex'e giren fren bloğunun BAŞLADIĞI index (fren ≥ thr). apex'ten geri tara; apex'e en
   yakın fren örneğini bul, sonra kesintisiz (küçük boşluk toleranslı) blok başına in. */
function brakeStartIdx(brake, dist, ai, thr, maxM) {
  const d0 = dist[ai];
  let e = -1;
  for (let k = ai; k >= 0 && d0 - dist[k] <= maxM; k--) {
    if (Number.isFinite(brake[k]) && brake[k] >= thr) { e = k; break; }
  }
  if (e < 0) return -1;
  let s = e, gap = 0;
  for (let k = e - 1; k >= 0 && d0 - dist[k] <= maxM; k--) {
    if (Number.isFinite(brake[k]) && brake[k] >= thr) { s = k; gap = 0; }
    else if (++gap > 3) break;   // 3 örneğe kadar boşluğa tolerans (blok kopmasın)
  }
  return s;
}

/* Her viraj için A/B: viraj-ortası (apex) hızı + fren mesafesi. data = cmpData.data
   ({d, spA,spB, brA,brB}). → [{ no, apexD, aMin, bMin, aBrakeDist, bBrakeDist }]. */
export function cornerStats(data, apexes, { brakeThr = 8, apexWinM = 45, brakeMaxM = 500 } = {}) {
  if (!data?.length || !apexes?.length) return [];
  const d = data.map((p) => p.d);
  const spA = data.map((p) => p.spA), spB = data.map((p) => p.spB);
  const brA = data.map((p) => p.brA), brB = data.map((p) => p.brB);
  const hasBrA = brA.some((x) => x != null), hasBrB = brB.some((x) => x != null);
  return apexes.map((ai, i) => {
    const asI = hasBrA ? brakeStartIdx(brA, d, ai, brakeThr, brakeMaxM) : -1;
    const bsI = hasBrB ? brakeStartIdx(brB, d, ai, brakeThr, brakeMaxM) : -1;
    return {
      no: i + 1, apexD: d[ai],
      aMin: minOver(spA, d, ai, apexWinM),
      bMin: minOver(spB, d, ai, apexWinM),
      aBrakeDist: asI >= 0 ? d[ai] - d[asI] : null,
      bBrakeDist: bsI >= 0 ? d[ai] - d[bsI] : null,
    };
  });
}
