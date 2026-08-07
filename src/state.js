/* ============================================================
   DURUM KATMANI — saf reducer'lar + selektörler (React/Firebase bağımsız)
   App.jsx'teki setSt(s0 => …) gövdeleri ve useMemo türetmeleri buraya
   birebir taşındı; App bunları çağırır. state.test.js doğrudan test eder.
   ============================================================ */
import { computePlan, tyState, parseHMS, fmtHMS } from "./engine";
import { quantile } from "./constants";

/* ---------- uzak state güvenli ayrıştırma ---------- */
/* Bozuk/yarım JSON senkron döngüsünü çökertmesin — null dönerse çağıran atlar. */
export function safeParseState(json) {
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/* ---------- ortak yardımcı: dizileri gerektiği kadar uzat (14 stint sınırı yok) ---------- */
export const grow = (s, n) => ({
  ...s,
  pits: s.pits.length >= n ? s.pits
    : [...s.pits, ...Array.from({ length: n - s.pits.length },
        () => ({ fuel: true, lane: true, tyres: [false, false, false, false] }))],
  overrides: s.overrides.length >= n ? s.overrides
    : [...s.overrides, ...Array(n - s.overrides.length).fill("")],
  tyreStints: s.tyreStints.length >= n ? s.tyreStints
    : [...s.tyreStints, ...Array.from({ length: n - s.tyreStints.length }, () => ["", "", "", ""])],
  driverAssign: s.driverAssign.length >= n ? s.driverAssign
    : [...s.driverAssign, ...Array(n - s.driverAssign.length).fill("")],
});

/* ============================================================
   REDUCER'LAR — saf (state, ...args) => newState
   ============================================================ */
export function applyUpPit(s0, i, patch) {
  const s = grow(s0, i + 2);
  const pits = s.pits.map((p, j) => (j === i ? { ...p, ...patch } : p));
  return { ...s, pits };
}

export function applyUpTyre(s0, i, t) {
  const s = grow(s0, i + 3); // i+1 satırına lastik yazılabilir
  /* tık döngüsü: 0 taşı → 1 yeni kuru → 2 Qual'a dön → 3 wet → 4 eski kuru → 0.
     Bu köşede karşılığı olmayan durumlar atlanır: limit doluysa yeni kuru; köşenin
     Qual numarası yoksa "Qual"; ayrı bir eski kuru yoksa "eski kuru" (türetilmiş
     bayrakla örtüşmeyen aday atlanır — döngü kilitlenmez). */
  const cur = tyState(s.pits[i].tyres[t]);
  const planLen = computePlan(s, "race").rows.length;
  const usedDry = new Set();
  s.tyreQual.forEach((v) => { const k = String(v).trim(); if (k && k !== "W") usedDry.add(k); });
  s.tyreStints.slice(0, planLen).forEach((r) => r.forEach((v) => {
    const k = String(v).trim(); if (k && k !== "W") usedDry.add(k); }));
  const next = i + 1; // tyreStints index'i (S(i+2) satırı)
  const prevVal = String((s.tyreStints[i] || [])[t] || "").trim();
  /* aday durum → takılacak numara (yoksa null = bu durum burada anlamsız) */
  const valFor = (cand) => {
    if (cand === 1) {
      if (usedDry.size >= s.tyreLimit) return null;   // limit dolu
      let n = 1; while (usedDry.has(String(n))) n++;
      return String(n);
    }
    if (cand === 2) return String((s.tyreQual || [])[t] || "").trim() || null;
    if (cand === 3) return "W";
    if (cand === 4) {
      /* eski (kullanılmış) kuru lastiği tekrar tak:
         bu köşenin geçmişinde en son kullanılan, öncekinden farklı numara */
      const hist = [];
      for (let j = i; j >= 0; j--) {
        const v = String((s.tyreStints[j] || [])[t] || "").trim();
        if (v && v !== "W") hist.push(v);
      }
      const q = String((s.tyreQual || [])[t] || "").trim();
      if (q) hist.push(q);
      return hist.find((v) => v !== prevVal) || null;
    }
    return prevVal; // 0: taşı
  };
  let val = prevVal;
  for (let step = 1; step <= 5; step++) {
    const cand = (cur + step) % 5;
    const v = valFor(cand);
    if (v == null) continue;
    /* aday, türetilmiş bayrağıyla örtüşmeli (ör. Qual numarası "eski kuru" olarak
       değil Qual olarak sınıflanır → 4 adayı atlanıp sırası gelince 2 seçilir) */
    if (cand === 0 || pitTyreFlag(s, next, t, v) === cand) { val = v; break; }
  }
  const tyreStints = next < s.tyreStints.length
    ? s.tyreStints.map((r, j) => (j === next ? r.map((c, ci) => (ci === t ? val : c)) : r))
    : s.tyreStints;
  /* pit bayrakları tabloya yazılan değerden TÜRETİLİR (tek doğruluk kaynağı) */
  return syncPitTyres({ ...s, tyreStints });
}

export function applyUpOvr(s0, i, val) {
  const s = grow(s0, i + 2);
  const overrides = [...s.overrides]; overrides[i] = val;
  const patch = { overrides };
  if (parseHMS(val) > 0) { // time override girildi → lap override'ı temizle
    const lapOverrides = [...(s.lapOverrides || [])]; lapOverrides[i] = "";
    patch.lapOverrides = lapOverrides;
  }
  return { ...s, ...patch };
}

/* Tur manuel override: computed'dan başlayıp ±adım; time override'ı temizler */
export function applyBumpLaps(s0, i, curLaps, delta) {
  const s = grow(s0, i + 2);
  const lapOverrides = [...(s.lapOverrides || [])];
  const base = Number(lapOverrides[i]) || curLaps;
  lapOverrides[i] = String(Math.max(1, base + delta));
  const overrides = [...s.overrides]; overrides[i] = ""; // karşılıklı dışlama
  return { ...s, lapOverrides, overrides };
}

export function applyClearLaps(s0, i) {
  const lapOverrides = [...(s0.lapOverrides || [])]; lapOverrides[i] = "";
  return { ...s0, lapOverrides };
}

/* stint bazlı hızlı lastik atama
   FL=0 FR=1 RL=2 RR=3 · fresh: kullanılmamış en küçük numaralar */
export function applyQuickTyre(s0, rowIdx, action) {
  const s = grow(s0, rowIdx + 2);
  const planLen = computePlan(s, "race").rows.length;
  const used = new Set();
  s.tyreQual.forEach((v) => { const k = String(v).trim(); if (k && k !== "W") used.add(k); });
  s.tyreStints.slice(0, planLen).forEach((r) => r.forEach((v) => {
    const k = String(v).trim(); if (k && k !== "W") used.add(k); }));
  let n = 1;
  const fresh = () => { while (used.has(String(n))) n++; used.add(String(n)); return String(n); };
  const prev = rowIdx === 0 ? s.tyreQual : (s.tyreStints[rowIdx - 1] || ["", "", "", ""]);
  const FRESH_AT = {
    new4: [0, 1, 2, 3], fronts: [0, 1], rears: [2, 3],
    lefts: [0, 2], rights: [1, 3],
    fl: [0], fr: [1], rl: [2], rr: [3],   // tek lastik
  }[action];
  if (FRESH_AT && used.size + FRESH_AT.length > s.tyreLimit)
    return s0; // yeterli yeni lastik yok → aksiyon engellenir
  let row;
  if (action === "clear") row = ["", "", "", ""];
  else if (action === "carry") row = [...prev];
  else if (action === "wet4") row = ["W", "W", "W", "W"];
  else if (action === "qual4") row = s.tyreQual.map((v) => String(v || "").trim());
  else row = [0, 1, 2, 3].map((ci) =>
    FRESH_AT.includes(ci) ? fresh() : String(prev[ci] || "").trim());
  const tyreStints = s.tyreStints.map((r, i) => (i === rowIdx ? row : r));
  /* pit bayrakları tablodan türetilir; komşu hücreler değiştiği için SONRAKİ
     pit'ler de tazelenir (eski kod yalnız önceki pit'i güncelleyip sonrakileri
     bayat bırakıyordu). */
  return syncPitTyres({ ...s, tyreStints });
}

/* stinte özel ortalama tur süresi (boş → yarış datasındaki ortalama kullanılır) */
export function applyUpStintLap(s0, i, v) {
  const s = grow(s0, i + 2);
  const stintLaps = [...(s.stintLaps || [])];
  stintLaps[i] = v;
  return { ...s, stintLaps };
}

export function applyUpTyreCell(s0, row, col, val) {
  const s = grow(s0, row + 2);
  if (row === -1) {
    /* Qual değişince taşıma zinciri de değişir → pit bayrakları tazelenir */
    const tyreQual = [...s.tyreQual]; tyreQual[col] = val;
    return syncPitTyres({ ...s, tyreQual });
  }
  const tyreStints = s.tyreStints.map((r, i) =>
    i === row ? r.map((c, j) => (j === col ? val : c)) : r);
  /* pit bayrakları tablodan türetilir (S1'in öncesinde pit yok); eski kod yalnız
     önceki pit'i güncelleyip sonrakileri bayat bırakıyordu. */
  return syncPitTyres({ ...s, tyreStints });
}

/* Lastik sekmesi "Tümünü Temizle": tablo sıfırlanınca pit lastik bayrakları da
   sıfırlanmalı — eskiden pits'te kalan seçimler plana lastik süresi eklemeye
   devam ediyordu (tabloda hiç lastik görünmezken). */
export function applyClearTyres(s0) {
  return syncPitTyres({
    ...s0,
    tyreQual: ["1", "2", "3", "4"],
    tyreStints: s0.tyreStints.map(() => ["", "", "", ""]),
  });
}

export function applyAssignDriver(s0, i, n) {
  const s = grow(s0, i + 2);
  const driverAssign = [...s.driverAssign]; driverAssign[i] = n;
  /* takımdan seçilen isim kadroda yoksa otomatik kadroya eklensin
     (toplam süre / dağılım tablosu kadro üzerinden hesaplanıyor) */
  const roster = n && !s.roster.includes(n) ? [...s.roster, n] : s.roster;
  return { ...s, driverAssign, roster };
}

/* boş hücre = o köşede lastik değişmedi → önceki stintten (yoksa Qual'dan) taşınan lastik. */
export function carriedTyre(st, rowIndex, col) {
  for (let j = rowIndex - 1; j >= 0; j--) {
    const v = String((st.tyreStints[j] || [])[col] || "").trim();
    if (v) return v;
  }
  return String((st.tyreQual || [])[col] || "").trim();
}

/* S(row+1) satırına GİRERKEN o köşede yapılan pit işlemi (pits[row-1].tyres[col]):
   0 taşı · 1 yeni kuru · 2 Qual · 3 wet · 4 eski kuru tekrar.
   Karşılaştırma önceki satırın HÜCRE değerine göredir: hücreye numara YAZMAK bir
   pit işlemidir — oyunda taşınan (aynı) lastiği pitte geri takmak da gerçekten
   süre kaybettirir (kullanıcı doğrulaması, v1.4.60). Değişim istemiyorsan hücreyi
   BOŞ bırakırsın (taşıma). */
export function pitTyreFlag(st, row, col, val) {
  const k = String(val ?? "").trim();
  if (!k) return 0;                                   // boş = taşı
  if (k === "W") return 3;          // WET: sınırsız + pitte taze set = HER ZAMAN gerçek işlem
  const prevRaw = String(((st.tyreStints[row - 1] || []))[col] ?? "").trim();
  if (k === prevRaw) return 0;      // aynı KURU numara = değişim yok (taşı)
  if (k === String((st.tyreQual || [])[col] || "").trim()) return 2;
  if ((st.tyreQual || []).some((x) => String(x).trim() === k)) return 4;
  for (let j = 0; j < row; j++)
    if ((st.tyreStints[j] || []).some((x) => String(x).trim() === k)) return 4;
  return 1;                                           // hiç görülmemiş → yeni kuru
}

/* Tüm pit lastik bayraklarını tablodan TÜRET (tek doğruluk kaynağı: tyreStints).
   Bir hücre düzenlendiğinde yalnız o satırın ÖNCEKİ pit'i güncelleniyordu; oysa
   taşıma zinciri değiştiği için SONRAKİ pit'lerin bayrakları da bayatlıyordu
   (ör. aradaki hücre silinince sonraki stint'in "aynı lastik devam"ı gerçekte
   değişime dönüşür ama pit süresi güncellenmezdi). Yalnız tabloda karşılığı olan
   pit'ler türetilir; plan ötesindeki pits kayıtları olduğu gibi kalır. */
export function syncPitTyres(st) {
  const pits = st.pits.map((p, i) => {
    const nextRow = st.tyreStints[i + 1];
    if (!nextRow) return p;
    const tyres = [0, 1, 2, 3].map((c) => pitTyreFlag(st, i + 1, c, nextRow[c]));
    return { ...p, tyres };
  });
  return { ...st, pits };
}

/* ============================================================
   SELEKTÖRLER — saf türetmeler
   ============================================================ */
export function computeTyreInfo(st, racePlan) {
  const rows = [{ label: "Qual", row: -1, vals: st.tyreQual }];
  for (let i = 0; i < racePlan.rows.length; i++)
    rows.push({ label: `S${i + 1}`, row: i, vals: st.tyreStints[i] || ["", "", "", ""] });
  const counts = {}; const qualSets = new Set();
  const posCols = {}; // set no → kullanıldığı sütunlar (köşe kilidi)
  rows.forEach((r) => r.vals.forEach((v, ci) => {
    const k = String(v).trim();
    if (!k) return;
    counts[k] = (counts[k] || 0) + 1;
    if (k === "W") return; // wet: sınırsız — limit/çakışma dışında
    if (r.row === -1) qualSets.add(k);
    (posCols[k] = posCols[k] || new Set()).add(ci);
  }));
  const conflicts = Object.keys(posCols).filter((k) => posCols[k].size > 1);
  const conflictSet = new Set(conflicts);
  const cellCls = (v) => {
    const k = String(v).trim();
    if (!k) return "";
    if (k === "W") return "tw";
    if (conflictSet.has(k)) return "terr";
    const c = counts[k];
    if (c >= 4) return "t4";
    if (c === 3) return "t3";
    if (c === 2) return qualSets.has(k) ? "tq" : "t2";
    return "";
  };
  // sütun ci için seçilebilir mi: hiç kullanılmamış YA DA sadece bu sütunda kullanılmış
  const allowedIn = (k, ci) => !posCols[k] || (posCols[k].size === 1 && posCols[k].has(ci));
  const usedList = Object.keys(counts).filter((k) => k !== "W")
    .sort((a, b) => (Number(a) || 0) - (Number(b) || 0));
  const used = usedList.length;
  const wetUsed = counts["W"] || 0;
  return { rows, cellCls, used, usedList, wetUsed, counts, allowedIn, conflicts,
    available: st.tyreLimit - used };
}

export function computeDriverPlan(st, racePlan) {
  const startMs = st.raceStartMs;
  if (isNaN(startMs)) return null;
  const finishMs = startMs + racePlan.raceSec * 1000;
  const rows = [];
  let cur = startMs;
  for (const r of racePlan.rows) {
    const s0 = cur;
    const f0 = s0 + r.stintSec * 1000;                 // Excel C: kapatılmamış bitiş
    const dur = Math.max(0, Math.min(f0, finishMs) - s0); // Excel D (FARK): yarış bitişiyle kırpılır
    rows.push({ idx: r.idx, start: s0, finish: f0, dur });
    cur = f0 + r.pitSec * 1000;
  }
  const totals = {};
  rows.forEach((r, i) => {
    const d = st.driverAssign[i];
    if (!d) return;
    totals[d] = totals[d] || { stints: 0, ms: 0 };
    totals[d].stints += 1; totals[d].ms += r.dur;
  });
  const grandMs = Object.values(totals).reduce((a, t) => a + t.ms, 0);
  return { rows, startMs, finishMs, totals, grandMs };
}

export function computeSlotStats(st) {
  const out = {};
  for (const sl of ["A", "B", "C", "D"]) {
    const t = st.telemetry[sl]; if (!t) continue;
    const used = t.laps.filter((l) => l.use);
    if (!used.length) { out[sl] = { empty: true }; continue; }
    const avgMs = used.reduce((a, l) => a + l.ms, 0) / used.length;
    const fuels = used.filter((l) => l.fuel != null);
    const avgFuel = fuels.length ? fuels.reduce((a, l) => a + l.fuel, 0) / fuels.length : null;
    const avgW = [0, 1, 2, 3].map((c) => {
      const ws = used.filter((l) => l.w[c] != null);
      return ws.length ? ws.reduce((a, l) => a + l.w[c], 0) / ws.length : null;
    });
    /* Medyan: tek yavaş tur (trafik, sarı bayrak, ısınma) ortalamayı bozar,
       medyan tipik turu verir — plan için daha sağlam. */
    const med = (arr) => {
      if (!arr.length) return null;
      const v = [...arr].sort((a, b) => a - b);
      return quantile(v, 0.5);
    };
    const medMs = med(used.map((l) => l.ms));
    const medFuel = med(used.filter((l) => l.fuel != null).map((l) => l.fuel));
    const medW = [0, 1, 2, 3].map((c) => med(used.filter((l) => l.w[c] != null).map((l) => l.w[c])));
    /* "En iyi" turu kısmi turlar tanımlamamalı — yarım tur (00:17) en hızlı sayılıp
       %105 eşiğini patlatmasın. Hepsi kısmiyse used'a düş (yine bir değer üret). */
    const realUsed = used.filter((l) => !l.partial);
    const bestMs = Math.min(...(realUsed.length ? realUsed : used).map((l) => l.ms));
    out[sl] = {
      laps: used.length, totalMs: used.reduce((a, l) => a + l.ms, 0),
      avgMs, avgFuel, avgW,
      medMs, medFuel, medW,
      bestMs, lim105: bestMs * 1.05,
      dropped: t.laps.filter((l) => !l.use).length,
      tankLaps: medFuel ? 100 / medFuel : (avgFuel ? 100 / avgFuel : null),
    };
  }
  return out;
}

/* %105 kuralı (saf): dahil turlar içinde en iyisini bul, %105'ini aşanların tikini
   kaldır (trafik/sarı bayrak/hata turları ortalamayı ve medyanı bozmasın).
   İki koruma:
   - Kısmi turlar (partial) ASLA "en iyi" adayı olamaz — yarım tur (00:17) en hızlı
     sayılıp tüm gerçek turların tikini kaldırmasın (bug).
   - Freak-kısa turlar da (medyanın <%50'si) "en iyi" olamaz — aynı pistte gerçek en
     hızlı tur medyanın yarısından kısa olamayacağından bu gerçek turu asla elemez,
     yalnız kısmi/glitch turlarına karşı ek güvence. Kısmisiz CSV turları etkilenmez. */
export function apply105Rule(laps, factor = 1.05) {
  const cand = laps.filter((l) => l.use && l.ms > 0 && !l.partial);
  if (cand.length < 2) return laps;
  const sorted = cand.map((l) => l.ms).sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  const floor = cand.filter((l) => l.ms >= med * 0.5);
  const best = Math.min(...(floor.length ? floor : cand).map((l) => l.ms));
  const lim = best * factor;
  return laps.map((l) => (l.use && l.ms > lim ? { ...l, use: false } : l));
}

export function computeChartData(st) {
  const maxLap = Math.max(0, ...["A", "B", "C", "D"]
    .map((sl) => st.telemetry[sl]?.laps.length || 0));
  return Array.from({ length: maxLap }, (_, i) => {
    const row = { lap: i + 1 };
    for (const sl of ["A", "B", "C", "D"]) {
      const l = st.telemetry[sl]?.laps[i];
      if (l && l.use) row[sl] = +(l.ms / 1000).toFixed(3);
    }
    return row;
  });
}

export function computeLiveInfo(st, racePlan, now) {
  const startMs = st.raceStartMs;
  if (isNaN(startMs) || !racePlan.rows.length) return { status: "idle" };
  const raceMs = racePlan.raceSec * 1000;
  const finishMs = startMs + raceMs;
  if (now < startMs) return { status: "pre", toStart: startMs - now, startMs, finishMs, raceMs };
  if (now >= finishMs) return { status: "done", startMs, finishMs, raceMs };
  /* actualPits SEYREK: ap[i] = stint i sonunda gerçek pit girişi (ms) veya boş.
     İşaretlenmeyen pitler otomatik plandan ilerler (kayma olmaz). */
  const ap = st.actualPits || [];
  const auto = st.autoOvr || [];
  const plannedPitStart = [];
  { let c = startMs;
    for (const r of racePlan.rows) {
      const sSec = auto[r.idx - 1] ? racePlan.laps * racePlan.lapSec : r.stintSec;
      c += sSec * 1000; plannedPitStart.push(c); c += r.pitSec * 1000;
    } }
  /* zincir: her stint gerçek pit varsa oradan biter, yoksa plandan */
  let cur = startMs, phase = "stint", stintIdx = racePlan.rows.length - 1;
  let phaseEnd = finishMs, stintStartMs = startMs;
  let inChain = false;
  for (let i = 0; i < racePlan.rows.length; i++) {
    const r = racePlan.rows[i];
    const realEnd = Number.isFinite(ap[i]) ? ap[i] : null;
    const sEnd = realEnd != null ? realEnd : cur + r.stintSec * 1000;
    if (now < sEnd) { phase = "stint"; stintIdx = i; phaseEnd = sEnd; stintStartMs = cur; inChain = true; break; }
    const pEnd = sEnd + r.pitSec * 1000;
    if (now < pEnd) { phase = "pit"; stintIdx = i; phaseEnd = pEnd; stintStartMs = cur; inChain = true; break; }
    cur = pEnd;
  }
  /* Zincir bayraktan ÖNCE tükendiyse (gerçek pitler plandan erken işaretlenmişse sık
     görülür) son stint bayrağa kadar uzar. `stintStartMs` yedeği yarış başlangıcı
     kalırsa "stint süresi" TÜM YARIŞ gibi görünürdü → son pitin bitişinden başlat. */
  if (!inChain) stintStartMs = cur;
  let lastPitIdx = -1;
  for (let i = 0; i < ap.length; i++) if (Number.isFinite(ap[i])) lastPitIdx = i;
  const lastDev = lastPitIdx >= 0 && plannedPitStart[lastPitIdx] != null
    ? ap[lastPitIdx] - plannedPitStart[lastPitIdx] : null;
  const pitsDone = ap.filter(Number.isFinite).length;
  return {
    status: "live", phase, stintIdx, phaseEnd, stintStartMs,
    pitsDone, lastPitIdx, plannedPitStart, lastDev,
    remaining: finishMs - now, elapsed: now - startMs,
    nextPitIn: phaseEnd - now, raceMs, startMs, finishMs,
    driver: st.driverAssign[stintIdx] || "",
    nextDriver: st.driverAssign[stintIdx + 1] || "",
  };
}

/* ============================================================
   GERÇEK PİT İŞARETLEME — saf; App'teki up(patch) gövdeleri buraya taşındı.
   Uygulanacak bir şey yoksa null döner (çağıran hiçbir şey yapmaz).
   ============================================================ */

/* Araç pit yoluna girdiği an: gerçek zamanı kaydet + o stintin süresini override'a
   yaz (plan gerçeğe kilitlenir). PIT FAZINDA ÇALIŞMAZ: buton pit yolundayken de
   aynı stintIdx'i gösterdiği için ikinci basış, pit yolunda geçen saniyeleri stint
   süresine ekleyip kaydı bozuyordu. */
export function applyMarkPit(st, liveInfo, nowMs) {
  if (!liveInfo || liveInfo.status !== "live" || liveInfo.phase !== "stint") return null;
  const i = liveInfo.stintIdx;
  const actualPits = [...(st.actualPits || [])];
  while (actualPits.length <= i) actualPits.push(null);
  actualPits[i] = nowMs;
  const patch = { actualPits };
  const durSec = Math.round((nowMs - liveInfo.stintStartMs) / 1000);
  if (durSec > 0) {
    const overrides = [...(st.overrides || [])];
    while (overrides.length <= i) overrides.push("");
    overrides[i] = fmtHMS(durSec);
    const autoOvr = [...(st.autoOvr || [])];
    while (autoOvr.length <= i) autoOvr.push(false);
    autoOvr[i] = true;
    patch.overrides = overrides;
    patch.autoOvr = autoOvr;
    /* süre override'ı kazanır → bayat tur override'ı temizle (applyUpOvr ile aynı
       karşılıklı dışlama; yoksa "↩ Geri Al" sonrası eski tur override'ı geri gelirdi) */
    if ((Number((st.lapOverrides || [])[i]) || 0) > 0) {
      const lapOverrides = [...(st.lapOverrides || [])]; lapOverrides[i] = "";
      patch.lapOverrides = lapOverrides;
    }
  }
  return patch;
}

/* Son işaretlenen pit'i geri al (yalnız otomatik yazılan override silinir). */
export function applyUnmarkPit(st) {
  const ap = [...(st.actualPits || [])];
  let idx = -1;
  for (let i = 0; i < ap.length; i++) if (Number.isFinite(ap[i])) idx = i;
  if (idx < 0) return null;
  ap[idx] = null;
  while (ap.length && !Number.isFinite(ap[ap.length - 1])) ap.pop();
  const patch = { actualPits: ap };
  if ((st.autoOvr || [])[idx]) {
    const overrides = [...(st.overrides || [])]; overrides[idx] = "";
    const autoOvr = [...(st.autoOvr || [])]; autoOvr[idx] = false;
    patch.overrides = overrides; patch.autoOvr = autoOvr;
  }
  return patch;
}

/* Tüm gerçek pit işaretlemelerini sıfırla (elle girilen override'lar korunur). */
export function applyResetPits(st) {
  const overrides = (st.overrides || []).map((v, i) => ((st.autoOvr || [])[i] ? "" : v));
  return { actualPits: [], pitRepairs: [], autoOvr: [], overrides };
}

export function buildTimeline(plan) {
  return plan.rows.flatMap((r) => {
    const segs = [{
      w: (r.stintSec / plan.raceSec) * 100, cls: "", label: `S${r.idx}`,
      bg: r.idx % 2 ? "var(--car)" : "#5E0B18",
    }];
    if (r.pitSec > 0) segs.push({ w: (r.pitSec / plan.raceSec) * 100, cls: "pit", label: "" });
    return segs;
  });
}
