/* ============================================================
   STANDINGS SIRALAMA + ARAMA — saf (v2.3.0)
   ------------------------------------------------------------
   v2.2.4'e kadar saha tablosunda sıralama YOKTU: sıra tamamen köprünün verdiği
   `pos` alanıydı. 40+ araçlık bir sahada "en çok hasar alan kim", "kim kaç kez
   pite girdi", "AVG5'i en iyi olan" gibi sorular gözle taranarak cevaplanıyordu.
   Arama kutusu da yoktu — belirli bir pilotu/takımı bulmak için tüm tablo
   okunuyordu.

   Buradaki iki kural önemli:
   1) EKSİK VERİ HER ZAMAN SONA GİDER. Yönü ters çevirince "—" satırlarının başa
      çıkması (Infinity/null'ın büyük sayı gibi sıralanması) klasik hatadır; bu
      yüzden değeri olmayan satırlar ayrı toplanır ve sona eklenir.
   2) SIRALAMA KARARLIDIR. Eşit değerli satırlar (ör. hepsi 0 ceza) yarış
      pozisyonu sırasını korur — Array.prototype.sort kararlı olsa da giriş
      sırasına güvenmek yerine eşitlikte `pos` ile açık şekilde çözülür, böylece
      kare kare gelen veride satırlar birbirinin yerine zıplamaz.

   React/Firebase bağımsız → liveSort.test.js doğrudan test eder.
   ============================================================ */

/* Türkçe/aksanlı harfleri ASCII'ye katlayan arama normalizasyonu.
   `ı` NFD ile ayrışmadığı için ayrıca eşlenir (setupPool.slugPart deseni).
   "Şahin" → "sahin", "İnci" → "inci" → kullanıcı aksansız yazsa da bulur. */
export function fold(v) {
  return String(v ?? "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .trim();
}

/* Satır arama metniyle eşleşiyor mu? Pilot, takım, araç no, araç adı ve sınıf
   üzerinden alt-dize araması (hepsi katlanmış). Boş sorgu → her satır geçer. */
export function matchQuery(c, q) {
  const needle = fold(q);
  if (!needle) return true;
  const hay = fold([c?.driver, c?.team, c?.number != null ? `#${c.number}` : "",
    c?.number, c?.vehicleName, c?.carClass].filter((x) => x != null && x !== "").join(" "));
  return hay.includes(needle);
}

/* Değer çıkarıcılar. Her biri sayı, string ya da "yok" için null döner.
   `ctx` = { gapMode, lapMode, avgMode, showTeam } — takaslı sütunlarda EKRANDA
   GÖRÜNEN değere göre sıralanır (kullanıcı ne görüyorsa ona göre sıralar). */
export const SORT_VALUE = {
  pos: (r) => (r.c.pos > 0 ? r.c.pos : null),
  driver: (r, ctx) => fold(ctx?.showTeam ? (r.c.team || r.c.driver) : r.c.driver) || null,
  laps: (r) => (r.c.lapsDone != null ? r.c.lapsDone : null),
  gap: (r, ctx) => (ctx?.gapMode ? r.interval : r.c.gapSec),
  lap: (r, ctx) => { const v = ctx?.lapMode ? r.c.bestSec : r.c.lastSec; return v > 0 ? v : null; },
  avg: (r, ctx) => { const v = ctx?.avgMode ? r.c.avgSec : r.c.avg5Sec; return v > 0 ? v : null; },
  ve: (r) => (r.c.virtualEnergy != null ? r.c.virtualEnergy : null),
  vepl: (r) => (r.c.vePerLap != null ? r.c.vePerLap : null),
  /* Lastik: EN KÖTÜ köşenin diş oranı (tabloda gösterilen değerle aynı kaynak). */
  tyre: (r) => {
    const c = r.c;
    if (c.tyreWear != null) return c.tyreWear;
    const t4 = Array.isArray(c.tyres4) ? c.tyres4.filter((x) => x != null) : [];
    return t4.length ? Math.min(...t4) : null;
  },
  stint: (r) => (r.c.stintSec > 0 ? r.c.stintSec : null),
  dmg: (r) => (r.c.damage != null ? r.c.damage : null),
  pen: (r) => (r.c.penaltiesTotal != null ? r.c.penaltiesTotal : (r.c.penalties ?? null)),
  pit: (r) => (r.c.pitStops != null ? r.c.pitStops : null),
};

/* Sütun için doğal ilk yön: küçük-iyi olanlar artan, büyük-iyi olanlar azalan.
   (Pozisyona ilk tıklayınca P1 üstte; hasara ilk tıklayınca EN ÇOK hasarlı üstte.) */
export const SORT_DEFAULT_DIR = {
  pos: "asc", driver: "asc", gap: "asc", lap: "asc", avg: "asc", vepl: "asc",
  laps: "desc", ve: "desc", tyre: "asc", stint: "desc", dmg: "desc",
  pen: "desc", pit: "desc",
};

const isMissing = (v) => v == null || v === "" || (typeof v === "number" && !Number.isFinite(v));

/* Eşitlik çözücü: yarış pozisyonu. Canlı kare Firebase'den gelir ve bozuk/eksik
   satır taşıyabilir → c yoksa en sona (999). */
const posOf = (r) => {
  const p = r && r.c && r.c.pos;
  return Number.isFinite(Number(p)) && Number(p) > 0 ? Number(p) : 999;
};

/* rows: LiveTab'ın türetilmiş satırları ({c, i, ...}). key null → dokunma
   (köprünün yarış sırası). Eksik değerli satırlar YÖNDEN BAĞIMSIZ sona gider. */
export function sortRows(rows, key, dir, ctx) {
  const list = Array.isArray(rows) ? rows : [];
  const get = SORT_VALUE[key];
  if (!get) return list;
  const sign = dir === "desc" ? -1 : 1;
  const have = [];
  const miss = [];
  for (const r of list) {
    let v;
    try { v = get(r, ctx); } catch { v = null; }
    (isMissing(v) ? miss : have).push([r, v]);
  }
  have.sort((a, b) => {
    const [ra, va] = a;
    const [rb, vb] = b;
    let d;
    if (typeof va === "string" || typeof vb === "string") {
      d = String(va).localeCompare(String(vb), "tr");
    } else {
      d = va - vb;
    }
    if (d) return d * sign;
    // eşitlikte YARIŞ POZİSYONU çözer → kare kare satır zıplaması olmaz
    return posOf(ra) - posOf(rb);
  });
  // eksikler kendi aralarında pozisyon sırasında kalsın
  miss.sort((a, b) => posOf(a[0]) - posOf(b[0]));
  return [...have.map((x) => x[0]), ...miss.map((x) => x[0])];
}
