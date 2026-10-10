/* ============================================================
   lmuLaptimes — lmuportal.com GERÇEK leaderboard turları → referans tur yapısı
   ------------------------------------------------------------
   SAF ve BAĞIMSIZ: dış bağımlılık yok (lmuParse.js deseni), böylece hem
   GitHub Action scraper'ı (scripts/fetch-lmu-laptimes.mjs) hem vitest testi
   aynı fonksiyonu kullanır. Web uygulaması çıktıyı (public/assets/lmu-data.json)
   fetch ile okur; burası yalnız üretim/test tarafıdır.

   NEDEN lmuportal (eski "Ohne Speed" Google Sheet'in yerine): Sheet küratörlü bir
   TEMPO MERDİVENİ veriyordu (alien ~%100, %101…%107) — modellenmiş hedefler.
   lmuportal GERÇEK kayıtlı turları verir (sürücülerin leaderboard'u: tur, sektör,
   compound, DR/SR). CLAUDE.md §1 gereği gerçek > modellenmiş.

   §1 (veri dürüstlüğü) — EN KRİTİK karar: leaderboard'daki araç alanı bir
   TAKIM/LIVERY adıdır ("Garage 59 #10", "Akkodis ASP Team", "AF Corse #83",
   "Team WRT"). Bunların ÇOĞU üreticiyi/aracı BELLİ ETMEZ. Bunları uygulamanın
   araç id'lerine (ferrari/mclaren/bmw…) zorlamak, verinin söylemediğini uydurmak
   olurdu. Bu yüzden takım adı AYNEN taşınır; araç id'si yalnız livery string'i
   model kodunu açıkça taşıdığında (yalnız "Custom Team" liveryleri: 499P, 911GT3R,
   296GT3, 963, 9x8, Oreca 07…) best-effort türetilir, yoksa "" kalır (vurgulama
   için; eşleşmezse sadece vurgulanmaz, uydurma yapılmaz).

   avgLap = P1 × 1.02: strateji tohumu (stratComp.trackDefaults) bir "yarış temposu"
   bekliyor; eski Sheet'in "Good ~1.02" değeriyle aynı anlam. MODELLENMİŞ olduğu
   `note` alanında ve UI'da etiketlenir.
   ============================================================ */

/* Pist etiketi → Caspian TRACKS id'si. lmuportal track_friendly düzensiz olabilir
   ("Spa", "Spa-Francorchamps", "Le Mans", "Fuji Speedway", "Circuit of the
   Americas", "LagunaSeca_2026"), bu yüzden anahtar kelimeyle eşleşme (ilk eşleşen
   kazanır). lmuParse.js ile aynı liste — iki dosya da bağımsız kalsın diye kopya. */
const TRACK_KEYWORDS = [
  [/sarthe|le\s*mans|lemans/, "lemans"],
  [/paul\s*ricard|ricard/, "paulricard"],
  [/spa/, "spa"],
  [/monza/, "monza"],
  [/imola/, "imola"],
  [/silverstone/, "silverstone"],
  [/portimao|portimão|algarve/, "portimao"],
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

/* lmuportal sınıf etiketi (metadata.class) → uygulama sınıf id'si.
   LMP2 iki BoP varyantıyla gelir (LMP2 / LMP2_ELMS) — uygulama tek "lmp2" tutar. */
const CLASS_MAP = {
  hyper: "hypercar",
  hypercar: "hypercar",
  lmh: "hypercar",
  gt3: "gt3",
  lmgt3: "gt3",
  gte: "gte",
  lmp2: "lmp2",
  lmp2_elms: "lmp2",
  lmp3: "lmp3",
};

export function mapClassId(rawClass) {
  const n = normLabel(rawClass).replace(/\s+/g, "_");
  return CLASS_MAP[n] || "";
}

/* Livery string'i AÇIKÇA model/marka taşıyorsa → uygulama araç id'si, yoksa "".
   Yalnız vurgulama (highlight) için best-effort; §1 gereği takım adı asla bir
   üreticiye zorlanmaz. Anahtarlar CARS (src/constants.js) id'leriyle uyumlu. */
const CAR_TOKENS = {
  hypercar: [
    [/499p|ferrari/, "ferrari"], [/963|porsche/, "porsche"], [/9x8|peugeot/, "peugeot"],
    [/tr010|toyota|gr010/, "toyota"], [/cadillac|whelen/, "cadillac"], [/bmwmh|bmw\b|\bm\s*hybrid/, "bmw"],
    [/alpine|a424/, "alpine"], [/genesis/, "genesis"], [/isotta/, "isotta"],
    [/glickenhaus/, "glickenhaus"], [/vanwall|vandervell|vanderwell/, "vanderwell"], [/lamborghini|sc63/, "lamborghini"],
  ],
  gt3: [
    [/296gt3|296|ferrari/, "ferrari"], [/911gt3|992|porsche/, "porsche"], [/bmw\s*gt3|m4\s*gt3/, "bmw"],
    [/mercedes|amg\s*gt3/, "mercedes"], [/mclaren|720s/, "mclaren"], [/z06gt3|corvette/, "corvette"],
    [/lexus|rc\s*f/, "lexus"], [/mustang|ford/, "ford"], [/amr\s*gt3|vantage|aston/, "aston"], [/huracan|lamborghini/, "lamborghini"],
  ],
  lmp3: [[/ligier|js\s*p3/, "ligier"], [/duqueine|d09/, "duqueine"], [/adess/, "adess"], [/ginetta|g61/, "ginetta"]],
  gte: [[/ferrari|488/, "ferrari"], [/porsche|911\s*rsr/, "porsche"], [/aston|vantage/, "aston"], [/corvette|c8/, "corvette"]],
  lmp2: [[/oreca/, "oreca"]],
};

export function carModelId(carStr, classId) {
  const s = normLabel(carStr);
  if (!s) return "";
  for (const [re, id] of (CAR_TOKENS[classId] || [])) if (re.test(s)) return id;
  return "";
}

/* Leaderboard skoru (tur süresi, ms) → "m:ss.mmm". Geçersiz → "". */
export function msToLap(ms) {
  const n = Math.round(Number(ms));
  if (!Number.isFinite(n) || n <= 0) return "";
  const m = Math.floor(n / 60000);
  const rem = n - m * 60000;
  const s = Math.floor(rem / 1000);
  const mmm = rem - s * 1000;
  return `${m}:${String(s).padStart(2, "0")}.${String(mmm).padStart(3, "0")}`;
}

/* Temizlenmiş leaderboard girdilerinden referans yapısını kurar.
   entries[] = { trackLabel, classRaw, scoreMs, car, initials, sectors[], compound[],
                 drRank, srRank }  (script tarafından düzleştirilir).
   Çıktı: data[trackId][classId] = { hot, avgLap, p1{...}, top[...] }.
     hot    = sınıf P1 (GERÇEK en hızlı tur)                → "m:ss.mmm"
     avgLap = P1 × 1.02 (MODELLENMİŞ yarış-temposu tahmini) → strateji tohumu
     p1     = P1 girdisinin tüm detayı
     top    = en hızlı TOP_N girdi (aynen; takım adı korunur, carId best-effort)
   scoreMs geçersiz (<=0) satır atlanır (uydurma yok). */
const TOP_N = 15;
const AVG_LAP_RATIO = 1.02; // "Good" yarış-temposu — eski Sheet ile aynı anlam

export function buildLaptimes(entries, { topN = TOP_N } = {}) {
  const data = {};
  const bucket = new Map(); // "trackId|classId" → entry[]
  for (const e of (entries || [])) {
    const scoreMs = Math.round(Number(e?.scoreMs));
    if (!Number.isFinite(scoreMs) || scoreMs <= 0) continue; // geçersiz tur → atla
    const trackId = mapTrackId(e.trackLabel);
    const classId = mapClassId(e.classRaw);
    if (!trackId || !classId) continue; // eşlenemeyen pist/sınıf → atla (uydurma yok)
    const key = `${trackId}|${classId}`;
    if (!bucket.has(key)) bucket.set(key, []);
    bucket.get(key).push({
      lap: msToLap(scoreMs),
      lapMs: scoreMs,
      driver: String(e.initials || "").trim(),
      car: String(e.car || "").trim(),
      carId: carModelId(e.car, classId),
      sectors: Array.isArray(e.sectors) ? e.sectors : null,
      compound: Array.isArray(e.compound) ? e.compound : null,
      dr: e.drRank || null,
      sr: e.srRank || null,
    });
  }
  for (const [key, list] of bucket) {
    list.sort((a, b) => a.lapMs - b.lapMs);
    const top = list.slice(0, topN).map((x, i) => ({ rank: i + 1, ...x }));
    const p1 = top[0];
    const [trackId, classId] = key.split("|");
    (data[trackId] ||= {})[classId] = {
      hot: p1.lap,
      avgLap: msToLap(Math.round(p1.lapMs * AVG_LAP_RATIO)),
      p1,
      top,
    };
  }
  return data;
}

/* İki buildLaptimes çıktısını birleştirir: primary (canlı leaderboard — zengin,
   sektör/compound'lu, ÖNCELİKLİ) KAZANIR; secondary (fastest_laps fallback — sınıf
   P1, geniş pist kapsamı) yalnız primary'de OLMAYAN pist×sınıf'ı doldurur.
   NEDEN: canlı leaderboard yalnız rotasyondaki ~9 pisti kapsar; strateji tohumu
   (trackDefaults) ve "hot" referansı eski Sheet'teki ~17 pistte çalışıyordu →
   fallback olmadan rotasyon dışı pistlerde regresyon olurdu. Her ikisi de GERÇEK
   turdur; primary taze/zengin, fallback geniş. */
export function mergeLaptimes(primary, secondary) {
  const out = {};
  for (const [tid, classes] of Object.entries(primary || {})) out[tid] = { ...classes };
  for (const [tid, classes] of Object.entries(secondary || {})) {
    for (const [cid, entry] of Object.entries(classes)) {
      if (!out[tid]) out[tid] = {};
      if (!out[tid][cid]) out[tid][cid] = entry; // yalnız boşluğu doldur
    }
  }
  return out;
}

/* Aynı FİZİKSEL pistin farklı app id'leri — leaderboard tek varyantla gelir ama
   uygulama "spa" ve "spa-endurance"ı ayrı yarış olarak tutar (aynı asfalt). Eski
   Sheet scraper'ı da bu kopyayı yapıyordu; kaldırmak spa-endurance'ta strateji
   tohumunu/referansı kaybettirir → regresyon. Alias yalnız HEDEF boşsa doldurur. */
export const TRACK_ALIAS = { spa: ["spa-endurance"] };

export function applyTrackAliases(data, aliases = TRACK_ALIAS) {
  const out = {};
  for (const [tid, classes] of Object.entries(data || {})) out[tid] = classes;
  for (const [src, targets] of Object.entries(aliases)) {
    if (!out[src]) continue;
    for (const t of targets) if (!out[t]) out[t] = out[src];
  }
  return out;
}
