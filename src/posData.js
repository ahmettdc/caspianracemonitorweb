/* ============================================================
   Pozisyon–tur grafiği veri kurulumu — SAF mantık (test edilebilir)
   ------------------------------------------------------------
   Kalıcı `livepos` düğümü: { lapKey: { turNo: pozisyon } }. Pit turu NEGATİF
   kodlanır (|değer| = pozisyon) — grafikte 'P' işaretiyle gösterilir.

   Bayat anahtar elemesi: düğümde canlı sahada artık olmayan araçlar birikebilir
   (yarıştan ayrılan araç, eski oturum kalıntısı, ya da araç kimliği değişimi
   öncesi yazılmış sürücü-adlı kayıtlar). Bunlar renksiz/etiketsiz çizgi olarak
   çiziliyordu. Artık yalnız TANINAN araçlar çizilir — ama `meta` boşsa (köprü
   durmuş, yalnız geçmiş görüntüleniyor) hiçbir şey gizlenmez.
   ============================================================ */

/* posMap: livepos anlık görüntüsü · meta: {lapKey: {...}} canlı kareden
   Dönüş: { data:[{lap, [lapKey]:pos}], keys:[lapKey], maxPos, pitSet:Set("key|lap") } */
export function buildPosData(posMap, meta) {
  const pm = posMap && typeof posMap === "object" ? posMap : {};
  const known = meta && typeof meta === "object" ? Object.keys(meta) : [];
  const all = Object.keys(pm);
  // meta yoksa (canlı kare gelmiyor) hepsini göster — veri gizlenmesin
  const keys = known.length ? all.filter((k) => k in meta) : all;

  const byLap = {};
  const pitSet = new Set();
  let maxPos = 0;
  for (const k of keys) {
    const laps = pm[k] || {};
    for (const nStr of Object.keys(laps)) {
      const n = +nStr;
      const raw = +laps[nStr];
      if (!n || !raw) continue;
      const pos = Math.abs(raw);
      if (raw < 0) pitSet.add(`${k}|${n}`);          // pit turu
      (byLap[n] || (byLap[n] = { lap: n }))[k] = pos;
      if (pos > maxPos) maxPos = pos;
    }
  }
  const data = Object.values(byLap).sort((a, b) => a.lap - b.lap);
  return { data, keys, maxPos, pitSet };
}
