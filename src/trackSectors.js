/* ============================================================
   SEKTÖR SINIRLARI — saf yardımcılar (React/Firebase bağımsız)
   ------------------------------------------------------------
   Pist haritasında S/F var; S1/S2/S3 ayırıcılarını da çizmek için sektör SINIR
   konumları gerekir. Paylaşımlı bellek bunları doğrudan vermiyor ama her araçta
   mSector (0=S3, 1=S1, 2=S2) + lapDist var → sektör SINIRI = aracın mSector değiştiği
   andaki lapDist oranı. Sürüş boyunca gözlemleyip ortalarız (gürültüye dayanıklı).

   Sınırlar: S1→S2 (mSector 1→2) ve S2→S3 (2→0). S3→S1 (0→1) zaten S/F (oran 0).
   Desen: trackShape.js / posData.js (saf + trackSectors.test.js doğrudan test eder).
   ============================================================ */

export const emptySectors = () => ({ b12: { sum: 0, n: 0 }, b20: { sum: 0, n: 0 } });

/* Bir aracın önceki→şimdiki sektörü ve o karedeki lapDist oranı (0..1) ile sınır
   akümülatörünü güncelle. Yalnız 1→2 ve 2→0 geçişleri sınırdır (0→1 = S/F, sayılmaz).
   `frac` makul değilse (0..1 dışı) yok sayılır. Durumu YERİNDE değiştirmez — çağıran
   ref'te tutar; bu fn sadece sayaçları artırır (aynı nesne döner). */
export function observeSector(state, prevSec, sec, frac) {
  const st = state || emptySectors();
  const p = Number(prevSec), s = Number(sec), f = Number(frac);
  if (!Number.isFinite(f) || f < 0 || f > 1) return st;
  if (p === 1 && s === 2) { st.b12.sum += f; st.b12.n += 1; }
  else if (p === 2 && s === 0) { st.b20.sum += f; st.b20.n += 1; }
  return st;
}

/* Ortalama sınır oranları { f12, f20 } — gözlem yoksa alan null. İkisi de yoksa null. */
export function sectorFractions(state) {
  if (!state) return null;
  const avg = (a) => (a && a.n > 0 ? a.sum / a.n : null);
  const f12 = avg(state.b12), f20 = avg(state.b20);
  if (f12 == null && f20 == null) return null;
  return { f12, f20 };
}

/* ---- PİT GİRİŞ/ÇIKIŞ gözlemi (v1.4.96) — sektör deseninin aynısı ----
   Pit giriş/çıkış noktası paylaşımlı bellekte doğrudan yok; ama araç `location`
   TRACK↔PIT döndüğü andaki lapDist oranı = pit girişi (TRACK→PIT) / çıkışı (PIT→TRACK).
   Gözleyip ortalarız (gürültüye dayanıklı). Dış halkada iki küçük işaret çizilir. */
export const emptyPit = () => ({ entry: { sum: 0, n: 0 }, exit: { sum: 0, n: 0 } });

export function observePit(state, prevLoc, loc, frac) {
  const st = state || emptyPit();
  const f = Number(frac);
  if (!Number.isFinite(f) || f < 0 || f > 1) return st;
  if (prevLoc === "TRACK" && loc === "PIT") { st.entry.sum += f; st.entry.n += 1; }
  else if (prevLoc === "PIT" && loc === "TRACK") { st.exit.sum += f; st.exit.n += 1; }
  return st;
}

/* Ortalama { entry, exit } — gözlem yoksa alan null; ikisi de yoksa null. */
export function pitFractions(state) {
  if (!state) return null;
  const avg = (a) => (a && a.n > 0 ? a.sum / a.n : null);
  const entry = avg(state.entry), exit = avg(state.exit);
  if (entry == null && exit == null) return null;
  return { entry, exit };
}

/* Paylaşım (livetrackpit): { entry, exit } → "entry,exit" (4 ondalık). packSectors deseni. */
export function packPit(fr) {
  if (!fr) return "";
  const p = (v) => (Number.isFinite(v) && v >= 0 && v <= 1 ? v.toFixed(4) : "");
  const s = `${p(fr.entry)},${p(fr.exit)}`;
  return s === "," ? "" : s;
}

export function unpackPit(str) {
  if (typeof str !== "string" || !str) return null;
  const parts = str.split(",");
  const g = (v) => {
    const s = String(v ?? "").trim();
    if (!s) return null;
    const x = Number(s);
    return Number.isFinite(x) && x >= 0 && x <= 1 ? x : null;
  };
  const entry = g(parts[0]), exit = g(parts[1]);
  if (entry == null && exit == null) return null;
  return { entry, exit };
}

/* Sektör lapDist aralıkları → sarı sektör vurgusu için (v1.4.95). yellowSectors [2]
   gibi S-numaraları verir; hangi lapDist yayının sarı olacağını bilmek için sınır
   kesirleri gerekir. S1=[0,f12) · S2=[f12,f20) · S3=[f20,1). İki sınır da gözlenmemişse
   null (yay çizilemez — mevcut ayırıcı davranışıyla aynı). */
export function sectorRanges(fr) {
  if (!fr || fr.f12 == null || fr.f20 == null) return null;
  return [
    { sec: 1, from: 0, to: fr.f12 },
    { sec: 2, from: fr.f12, to: fr.f20 },
    { sec: 3, from: fr.f20, to: 1 },
  ];
}

/* Paylaşım (livetracksec): { f12, f20 } → "f12,f20" (4 ondalık). Eksik alan boş bırakılır
   ("0.33," ya da ",0.72"). Round-trip için unpackSectors. */
export function packSectors(fr) {
  if (!fr) return "";
  const p = (v) => (Number.isFinite(v) && v >= 0 && v <= 1 ? v.toFixed(4) : "");
  const s = `${p(fr.f12)},${p(fr.f20)}`;
  return s === "," ? "" : s;
}

/* "f12,f20" → { f12, f20 } (eksik/bozuk alan null; hiçbiri yoksa null). */
export function unpackSectors(str) {
  if (typeof str !== "string" || !str) return null;
  const parts = str.split(",");
  const g = (v) => {
    const s = String(v ?? "").trim();
    if (!s) return null;               // boş alan (Number("")===0 tuzağı) → null
    const x = Number(s);
    return Number.isFinite(x) && x >= 0 && x <= 1 ? x : null;
  };
  const f12 = g(parts[0]), f20 = g(parts[1]);
  if (f12 == null && f20 == null) return null;
  return { f12, f20 };
}
