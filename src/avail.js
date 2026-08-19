/* ============================================================
   avail.js — pilot müsaitliği (SAF modül, React'siz, Firebase'siz)
   ------------------------------------------------------------
   Şema: teams/{tid}/races/{rid}/avail/{driverId} = [stintNo…]
   Listedeki stint numaraları o pilotun UYGUN OLMADIĞI stintlerdir.
   Düğüm yoksa varsayılan: pilot TÜM stintlerde uygun.

   Neden "uygun değil" listesi tutuluyor: varsayılan uygunluk olduğu için boş
   düğüm = tam müsaitlik → yeni pilot eklendiğinde hiçbir yazma gerekmez ve
   düğüm küçük kalır (yalnız istisnalar saklanır).

   Depolama tarafı src/storage.js (availSet/availClear/availSubscribe),
   arayüz tarafı DriversTab uygunluk penceresi.
   ============================================================ */

/* RTDB dizileri seyrek olabilir (null delik) → her zaman güvenli sayı listesi. */
function nums(list) {
  if (!list) return [];
  const arr = Array.isArray(list) ? list : Object.values(list);
  return arr.filter((n) => Number.isInteger(n) && n >= 0);
}

/* Pilot o stintte uygun mu? (varsayılan: evet) */
export function isAvailable(avail, driverId, stintNo) {
  if (!avail || !driverId) return true;
  return !nums(avail[driverId]).includes(stintNo);
}

/* Bir hücreyi çevirir → YENİ avail nesnesi (girdi mutasyona uğramaz).
   Liste boşalırsa anahtar tamamen düşer = "tüm stintlerde uygun" varsayılanı. */
export function toggleAvail(avail, driverId, stintNo) {
  const cur = nums((avail || {})[driverId]);
  const next = cur.includes(stintNo)
    ? cur.filter((n) => n !== stintNo)
    : [...cur, stintNo].sort((a, b) => a - b);
  const out = { ...(avail || {}) };
  if (next.length) out[driverId] = next; else delete out[driverId];
  return out;
}

/* Bir stint için uygun pilotlar (kadro sırası korunur). */
export function availableDrivers(avail, roster, stintNo) {
  return (roster || []).filter((n) => isAvailable(avail, n, stintNo));
}

/* Hiç uygun pilotu kalmayan stintler → amber uyarı bunlarla çıkar. */
export function stintsWithoutDriver(avail, roster, stintCount) {
  const out = [];
  for (let i = 0; i < stintCount; i++) {
    if (!availableDrivers(avail, roster, i).length) out.push(i);
  }
  return out;
}

/* Uygunluk değişince ARTIK GEÇERSİZ olan atamalar temizlenir.
   Dönen dizi driverAssign'in yerine geçer; hiç değişiklik yoksa AYNI dizi
   döner (gereksiz state yazımı ve senkron trafiği olmasın diye). */
export function pruneAssignments(avail, driverAssign) {
  const cur = driverAssign || [];
  let changed = false;
  const next = cur.map((name, i) => {
    if (name && !isAvailable(avail, name, i)) { changed = true; return ""; }
    return name;
  });
  return changed ? next : cur;
}

/* Uygunluk penceresi ızgarası: satır = pilot, hücre = stint. */
export function buildAvailGrid(avail, roster, stintCount) {
  return (roster || []).map((name) => ({
    name,
    cells: Array.from({ length: stintCount }, (_, i) => ({
      stint: i,
      ok: isAvailable(avail, name, i),
    })),
    offCount: Array.from({ length: stintCount }, (_, i) => i)
      .filter((i) => !isAvailable(avail, name, i)).length,
  }));
}
