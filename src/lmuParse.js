/* ============================================================
   lmuParse — lmugarage.com "/racing-today" HTML → yapısal yarış listesi
   ------------------------------------------------------------
   SAF ve BAĞIMSIZ: hiçbir dış bağımlılık yok (regex tabanlı), böylece hem
   GitHub Action scraper'ı (scripts/scrape-lmu-schedule.mjs) hem de vitest
   testi aynı fonksiyonu kullanır. Web uygulaması bu dosyayı İÇE AKTARMAZ —
   takvim verisi RTDB'den (/lmuSchedule) okunur; burası yalnız scraper/test
   tarafıdır. Bağımsız tutmak için pist eşlemesi de burada (constants.js'e
   bağlanmaz; çıktı id'leri TRACKS id'leriyle birebir uyumludur).

   lmugarage resmi olmayan bir topluluk projesidir. Bu ayrıştırıcı yalnız
   herkese açık, robots.txt (Allow: /) ile serbest bırakılmış sayfayı okur.
   ============================================================ */

/* Pist etiketi → Caspian TRACKS id'si. lmugarage etiketleri düzensiz olabilir
   ("Circuit de la Sarthe", "Circuit Paul Ricard | 1A V2"), bu yüzden anahtar
   kelimeyle eşleşme (ilk eşleşen kazanır). Eşleşmezse "" döner ve trackRaw korunur. */
const TRACK_KEYWORDS = [
  [/sarthe|le\s*mans|lemans/, "lemans"],
  [/paul\s*ricard|ricard/, "paulricard"],
  [/spa/, "spa"],
  [/monza/, "monza"],
  [/imola/, "imola"],
  [/silverstone/, "silverstone"],
  [/portimao|algarve/, "portimao"],
  [/barcelona|catalunya/, "barcelona"],
  [/bahrain|sakhir/, "bahrain"],
  [/lusail|losail|qatar/, "lusail"],
  [/fuji/, "fuji"],
  [/cota|americas|austin/, "cota"],
  [/sebring/, "sebring"],
  [/interlagos|paulo/, "interlagos"],
  [/daytona/, "daytona"],
  [/laguna/, "lagunaseca"],
  [/watkins/, "watkinsglen"],
  [/atlanta/, "roadatlanta"],
  [/long\s*beach/, "longbeach"],
  [/indianapolis|indy/, "indianapolis"],
];

/* Aksan sadeleştir + küçük harf + boşluk topla. */
export function normLabel(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function mapTrackId(rawLabel) {
  const n = normLabel(rawLabel);
  if (!n) return "";
  for (const [re, id] of TRACK_KEYWORDS) if (re.test(n)) return id;
  return "";
}

/* "20m" / "2h24m" / "1h" / "1h30m" → saniye (int). Ayrıştırılamazsa null. */
export function parseLenSec(label) {
  const s = String(label || "").toLowerCase();
  const h = s.match(/(\d+)\s*h/);
  const m = s.match(/(\d+)\s*m/);
  if (!h && !m) return null;
  return (h ? +h[1] * 3600 : 0) + (m ? +m[1] * 60 : 0);
}

/* href → kararlı, dosya-güvenli id parçası. "/weekly/13000000010" → "weekly-13000000010",
   "/daily/series/beginner/lmgte-fixed" → "daily-series-beginner-lmgte-fixed". */
export function slugFromHref(href) {
  return String(href || "")
    .replace(/^https?:\/\/[^/]+/, "")
    .replace(/[?#].*$/, "")
    .split("/").filter(Boolean).join("-")
    .replace(/[^a-z0-9-]/gi, "").toLowerCase();
}

const first = (re, s) => { const m = s.match(re); return m ? m[1] : ""; };
const stripTags = (s) => String(s || "").replace(/<[^>]*>/g, "");
const clean = (s) => stripTags(s).replace(/\s+/g, " ").trim();

/* Yarış DETAY sayfası ("Race weekend" paneli) → { practiceSec, qualSec, raceSec }.
   Yapı: <div class="ses"><span class="n">Qualifying</span> … <span class="d">8m</span></div>
   (liste sayfasında YOK; scraper her yarışın detay sayfasını ayrıca çeker).
   Süre parseLenSec ile ("8m"/"1h30m" → sn). Bulunmayan seans → null. Böylece resmi
   ön ayarda sıralama süresi TAHMİN edilmez, siteden gelir; special/championship'in
   eksik yarış süresi (raceSec) de buradan doldurulabilir. */
export function parseRaceWeekend(html) {
  const src = String(html || "");
  const out = { practiceSec: null, qualSec: null, raceSec: null };
  const sesRe = /<div\s+class="ses">([\s\S]*?)<\/div>/g;
  let mm;
  while ((mm = sesRe.exec(src)) !== null) {
    const b = mm[1] || "";
    const name = normLabel(first(/class="n">\s*([^<]+?)\s*</, b));
    const sec = parseLenSec(first(/class="d">\s*([^<]+?)\s*</, b));
    if (sec == null || !name) continue;
    if (name.startsWith("practice")) out.practiceSec = sec;
    else if (name.startsWith("quali")) out.qualSec = sec;
    else if (name === "race") out.raceSec = sec;
  }
  return out;
}

/* Detay sayfası "Tyre sets" kutucuğu → lastik seti sınırı (int) ya da null.
   Yapı: <span class="t-val">8</span><span class="t-lab">Tyre sets</span>. Bu değer
   uygulamada st.tyreLimit'e (lastik bütçesi) karşılık gelir → resmi ön ayarda dolar. */
export function parseTyreSets(html) {
  const m = String(html || "").match(
    /class="t-val">\s*(\d+)\s*<\/span>\s*<span\s+class="t-lab">\s*Tyre\s*sets/i);
  const n = m ? parseInt(m[1], 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* HTML fragmanı → { source, races: [...] }. updatedAt scraper tarafından eklenir. */
export function parseRacingToday(html) {
  const src = String(html || "");
  const rowRe = /<a\s+class="run-row([^"]*)"\s+href="([^"]*)"([\s\S]*?)<\/a>/g;
  const races = [];
  let mm;
  while ((mm = rowRe.exec(src)) !== null) {
    const cls = mm[1] || "";
    const href = mm[2] || "";
    const inner = mm[3] || "";

    const startIso = first(/datetime="([^"]+)"/, inner);
    const name = clean(first(/class="rr-name">([\s\S]*?)(?:<span|<\/span>)/, inner));
    if (!startIso || !name) continue;  // eksik satırı atla (bozuk parse'a karşı)

    const evtType = first(/rr-event-type">\s*\(([^)]+)\)/, inner);
    const kind = normLabel(evtType) || "race";
    const trackRaw = clean(first(/class="rr-track">([\s\S]*?)<\/span>/, inner));
    const srRank = first(/data-rank="([^"]+)"/, inner);
    const srVal = clean(first(/class="v">([\s\S]*?)<\/span>/, inner));
    const lenLabel = clean(first(/class="rr-len">[\s\S]*?class="val">([\s\S]*?)<\/span>/, inner));

    const classes = [];
    const clsRe = /data-class="([^"]+)"/g;
    let cm;
    while ((cm = clsRe.exec(inner)) !== null) classes.push(cm[1]);

    const startMs = Date.parse(startIso);
    races.push({
      id: slugFromHref(href),   // href yolu zaten benzersiz (daily/… veya weekly/<id>)
      kind,
      name,
      startIso,
      startMs: Number.isFinite(startMs) ? startMs : null,
      live: /\blive\b/.test(cls) || /dot-live/.test(inner),
      sr: srVal || "",
      srRank: srRank || "",
      trackId: mapTrackId(trackRaw),
      trackRaw,
      classes,
      lenSec: parseLenSec(lenLabel),
      lenLabel: lenLabel || "",
      url: href.startsWith("http") ? href : `https://lmugarage.com${href}`,
    });
  }
  return { source: "lmugarage.com", races };
}

/* /special ve /championships sayfaları — "article.race-card" kart yapısı (racing-today'in
   .run-row'undan FARKLI). kind çağırandan gelir ("special" | "championship"). Kartlarda
   yarış süresi YOK (lenSec/lenLabel boş). Tarihi (datetime) olmayan kart (completed, tarihsiz)
   ATLANIR → kronolojiye uydurma tarih girmez. championship kartları "race-card champ-card"
   sınıfını kullanır + standings tabloları içerir; bunlar tek article regex'iyle yok sayılır. */
export function parseCardsPage(html, kind) {
  const src = String(html || "");
  const cardRe = /<article\s+class="race-card[^"]*"[^>]*>([\s\S]*?)<\/article>/g;
  const races = [];
  let mm;
  while ((mm = cardRe.exec(src)) !== null) {
    const inner = mm[1] || "";
    const startIso = first(/datetime="([^"]+)"/, inner);
    const href = first(/class="rc-link"\s+href="([^"]*)"/, inner) || first(/href="(\/[^"]+)"/, inner);
    const name = clean(first(/class="rc-title">([\s\S]*?)<\/div>/, inner));
    if (!startIso || !name) continue;  // tarihsiz/adsız kart atlanır (uydurma yok)

    const trackRaw = clean(first(/class="rc-track">([\s\S]*?)<\/div>/, inner));
    const srRank = first(/data-rank="([^"]+)"/, inner);
    const srVal = clean(first(/class="v">([\s\S]*?)<\/span>/, inner));

    const classes = [];
    const clsRe = /data-class="([^"]+)"/g;
    let cm;
    while ((cm = clsRe.exec(inner)) !== null) classes.push(cm[1]);

    const startMs = Date.parse(startIso);
    races.push({
      id: slugFromHref(href),
      kind,
      name,
      startIso,
      startMs: Number.isFinite(startMs) ? startMs : null,
      live: false,           // status client-side (startMs+lenSec vs now) hesaplanır
      sr: srVal || "",
      srRank: srRank || "",
      trackId: mapTrackId(trackRaw),
      trackRaw,
      classes,
      lenSec: null,          // kartlarda süre yok
      lenLabel: "",
      url: href && href.startsWith("http") ? href : `https://lmugarage.com${href || ""}`,
    });
  }
  return { source: "lmugarage.com", races };
}
