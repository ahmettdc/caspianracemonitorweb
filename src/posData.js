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
   opts.rerank: her tur için görünen araçları mutlak pozisyona göre 1..N yeniden
   sırala (sınıf süzgeci açıkken "sınıf-içi pozisyon" — genel standings boşlukları yok).
   Dönüş: { data:[{lap, [lapKey]:pos}], keys:[lapKey], maxPos, pitSet:Set("key|lap"),
   lastLap:{lapKey: son değer taşıyan tur} (uç etiket konumu için) } */
export function buildPosData(posMap, meta, opts = {}) {
  const pm = posMap && typeof posMap === "object" ? posMap : {};
  const known = meta && typeof meta === "object" ? Object.keys(meta) : [];
  const all = Object.keys(pm);
  // meta yoksa (canlı kare gelmiyor) hepsini göster — veri gizlenmesin
  const keys = known.length ? all.filter((k) => k in meta) : all;

  const byLap = {};
  const pitSet = new Set();
  const lastLap = {};
  for (const k of keys) {
    const laps = pm[k] || {};
    for (const nStr of Object.keys(laps)) {
      const n = +nStr;
      const raw = +laps[nStr];
      if (!n || !raw) continue;
      const pos = Math.abs(raw);
      if (raw < 0) pitSet.add(`${k}|${n}`);          // pit turu
      (byLap[n] || (byLap[n] = { lap: n }))[k] = pos;
      if (!(k in lastLap) || n > lastLap[k]) lastLap[k] = n;
    }
  }

  /* rerank: her tur için görünen araçları mutlak pozisyona göre sırala → 1..N.
     Pit bayrağı (pitSet) sayısal değerden bağımsız (key|lap) → korunur. */
  const data = Object.values(byLap).sort((a, b) => a.lap - b.lap);
  let maxPos = 0;
  if (opts.rerank) {
    for (const row of data) {
      const ks = Object.keys(row).filter((c) => c !== "lap");
      ks.sort((a, b) => row[a] - row[b]);
      ks.forEach((c, i) => { row[c] = i + 1; });
      if (ks.length > maxPos) maxPos = ks.length;
    }
  } else {
    for (const row of data)
      for (const c of Object.keys(row))
        if (c !== "lap" && row[c] > maxPos) maxPos = row[c];
  }
  return { data, keys, maxPos, pitSet, lastLap };
}

/* Takım adı → palet indeksi (deterministik djb2 hash). Renk ENTİTE'ye bağlı:
   bir takım, sahada kim olursa olsun HEP aynı rengi alır (dataviz: renk rank'e göre
   DEĞİL entiteye göre → araç yarıştan çekilse/süzgeçlense kalanlar yeniden boyanmaz). */
function hashIdx(str, n) {
  let h = 5381;
  const s = String(str);
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h % n;
}

/* Takım renk haritası (pozisyon grafiği) — SAF/testli.
   cars: [{ lapKey, team }] · palette: renk dizisi (TEAM_COLORS).
   Her takım (yoksa lapKey) hash ile sabit bir palet rengine eşlenir → aynı takımın
   araçları aynı renk, farklı takımlar (çoğunlukla) farklı renk. 7 renkten fazla
   takımda çakışma olabilir → çizgiler uç pilot-kodu etiketinden ayrılır.
   Dönüş: { lapKey: renk }. */
export function teamColors(cars, palette) {
  const pal = Array.isArray(palette) && palette.length ? palette : ["#8A7176"];
  const out = {};
  for (const c of (Array.isArray(cars) ? cars : [])) {
    if (!c || !c.lapKey) continue;
    const team = (c.team && String(c.team).trim()) || c.lapKey;   // yoksa araç kimliği
    out[c.lapKey] = pal[hashIdx(team, pal.length)];
  }
  return out;
}
