/* ============================================================
   STRATEJİ KARŞILAŞTIRMA — saf hesap (v2.4.0)
   ------------------------------------------------------------
   Kaynak: takımın kendi Excel'i (Caspian Motorsport Race Control v1.28),
   "TEAMS STRATEGY" (takım kayıt defteri) + "STRATEGY COMP" (karşılaştırma)
   sayfaları. YARIŞ ÖNCESİ, doğru stratejiye karar vermek için kullanılır.

   OYUN PC'Sİ MALİYETİ: SIFIR. Bu modül yarış sırasında çalışmaz, canlı
   kareye dokunmaz, köprüden tek bir alan bile istemez — girdiler tamamen
   kullanıcının elle girdiği plan verisidir (CLAUDE.md §0 denetimi: yeni
   REST yok, yeni thread yok, yayın hızı değişmiyor, kare büyümüyor).

   ------------------------------------------------------------
   MODEL — bir takımın yarışı bitirme süresi iki kalemden oluşur:

     tempo  = ortalamaTur × toplamTur
     sabit  = pitAdet × pitYoluSüresi
            + tamServisYakıt × (pitAdet − 1) + sonPitYakıtı
            + lastikAdet × lastikSüresi
            + ceza + hasar
     TOPLAM = tempo + sabit

   İki takımın farkı bu MUTLAK toplamların farkıdır. Yakıt teriminin son
   durağı ayrı tutması Excel'in kendi kuralı ve fişte "ÖNEMLİ!" diye
   işaretlenmiş: son durakta yalnız bitirmeye yetecek yakıt alınır, tam
   servisten kısa sürer.

   ------------------------------------------------------------
   EXCEL'DEN İKİ BİLİNÇLİ SAPMA

   1) MUTLAK SÜRE, ASİMETRİK REFERANS DEĞİL. Excel'de sağ panel sessizce
      "referans"tı: tempo terimi sabit `0` yazılıydı (I16, K12) ve sağın
      STRATEGY TIME toplamı (I17) o terimi hiç içermiyordu, solunki (B17)
      içeriyordu. İki panel simetrik GÖRÜNÜP simetrik DEĞİLDİ — takımların
      yerini değiştirmek sonucu sessizce bozardı. Mutlak toplam kurgusu
      Excel'in sayılarını BİREBİR üretir (stratComp.test.js dosyadaki
      47.0 sn ve −13.9 sn sonuçlarını doğrular) ama simetriktir ve ikiden
      fazla takıma ölçeklenir.

   2) EKSİK VERİ HESAPLANMAZ. Excel'in XLOOKUP'larında `if_not_found` yoktu
      ve boş hücre 0 dönüyordu: kayıt defterindeki 25 takımın 23'ü boş
      olduğu için bunlardan biri seçilince ortalama tur 0 sanılıyor, 174
      turluk yarışta sonuç −21.315 sn (≈ −6 saat) çıkıyor ve negatif olduğu
      için "avantaj" rengiyle YEŞİLE boyanıyordu. CLAUDE.md §1'in adını
      koyduğu `Number(null) === 0` tuzağının tam karşılığı. Burada eksik
      alan eksik kalır: `ok:false` döner, hangi alanın eksik olduğu
      `missing[]` ile bildirilir, hiçbir sayı uydurulmaz.

   React/Firebase bağımsız → stratComp.test.js doğrudan test eder.
   ============================================================ */

import { parseHMS, parseLap, MIN_LAP_SEC } from "./engine";

/* Sayı guard: "" · null · undefined · NaN · Infinity → null (0 DEĞİL).
   Sıfır burada GEÇERLİ bir okumadır (ör. ceza yok = 0 sn), o yüzden
   "eksik" ile "sıfır" ayrımı bu fonksiyonun tek işi. */
export function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/* "2:02.500" · "2:02,5" · "122.5" → saniye. Boş/bozuk → null.
   engine.parseLap boş girdide 0 döner (orada doğru davranış); burada 0
   dönmek yasak — yukarıdaki 2. sapmanın tam sebebi bu. */
export function parseLapSec(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const t = s.replace(",", ".");
  const p = t.split(":");
  if (p.length === 2) {
    const m = Number(p[0]), sec = Number(p[1]);
    if (!Number.isFinite(m) || !Number.isFinite(sec)) return null;
    return m * 60 + sec;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/* Saniye → "m:ss.mmm" (Excel'in AVG LAP TIME biçimi). Geçersiz → "". */
export function fmtLapMs(sec) {
  if (!Number.isFinite(sec)) return "";
  const neg = sec < 0;
  const ms = Math.round(Math.abs(sec) * 1000);
  const m = Math.floor(ms / 60000);
  const rest = (ms - m * 60000) / 1000;
  return `${neg ? "-" : ""}${m}:${rest.toFixed(3).padStart(6, "0")}`;
}

/* Boş takım kaydı — yeni satır eklerken kullanılır. Sayısal alanlar ""
   (girilmedi), 0 DEĞİL: 0 "ceza yok" demek, "" "bilinmiyor" demek. */
export const EMPTY_TEAM = {
  name: "",
  pits: "",
  stints: "",
  pitLane: "",
  fuelFull: "",
  fuelLast: "",
  tyreTime: "",
  tyreCount: "",
  avgLap: "",
  penalty: "",
  damage: "",
  ballast: "",
  notes: "",
};

/* Hesap için ZORUNLU alanlar. penalty/damage listede YOK: boş bırakılması
   "ceza/hasar yok" olarak okunur (0), çünkü yarış öncesi normal durum
   budur ve kullanıcıyı her satırda iki sıfır yazmaya zorlamak veri
   dürüstlüğü değil gürültü olurdu. Bu varsayım UI'da da yazılı. */
export const REQUIRED_FIELDS = ["pits", "pitLane", "fuelFull", "fuelLast",
  "tyreTime", "tyreCount", "avgLap"];

/* ---------- tek takım ---------- */
/* Bir takımın toplam yarış süresini ve kalem kalem dökümünü verir.
   raceLaps geçersizse tempo terimi kurulamaz → ok:false.

   Dönen: {
     ok, missing[], warnings[],
     pitLaneSec, fuelSec, tyreSec, penaltySec, damageSec,
     staticSec,            // sabit kayıplar toplamı
     paceSec,              // ortalamaTur × toplamTur
     totalSec,             // paceSec + staticSec
     avgLapSec, pits, raceLaps
   } — ok:false iken tüm süreler null (uydurma sayı yok). */
export function teamTime(team, raceLaps) {
  const t = team || {};
  const laps = num(raceLaps);
  const missing = [];

  const pits = num(t.pits);
  const pitLane = num(t.pitLane);
  const fuelFull = num(t.fuelFull);
  const fuelLast = num(t.fuelLast);
  const tyreTime = num(t.tyreTime);
  const tyreCount = num(t.tyreCount);
  const avgLapSec = parseLapSec(t.avgLap);

  const vals = { pits, pitLane, fuelFull, fuelLast, tyreTime, tyreCount, avgLap: avgLapSec };
  REQUIRED_FIELDS.forEach((k) => { if (vals[k] === null) missing.push(k); });
  if (laps === null || laps <= 0) missing.push("raceLaps");
  /* Negatif adet/süre fizik olarak yok — veri girişi hatasıdır, sessizce
     hesaplanıp makul görünen bir sonuç üretmesin. */
  if (pits !== null && pits < 0) missing.push("pits");
  if (tyreCount !== null && tyreCount < 0) missing.push("tyreCount");
  if (avgLapSec !== null && avgLapSec <= 0) missing.push("avgLap");

  const warnings = stintWarnings(t);

  if (missing.length) {
    return { ok: false, missing, warnings, pitLaneSec: null, fuelSec: null,
      tyreSec: null, penaltySec: null, damageSec: null, staticSec: null,
      paceSec: null, totalSec: null, avgLapSec, pits, raceLaps: laps };
  }

  const penaltySec = num(t.penalty) ?? 0;
  const damageSec = num(t.damage) ?? 0;
  const pitLaneSec = pits * pitLane;
  /* Yakıt: ilk (pit−1) durak tam servis, son durak kısa. pits=0 ise hiç
     durak yok → 0 (aksi halde fuelFull × −1 negatif süre üretirdi). */
  const fuelSec = pits > 0 ? fuelFull * (pits - 1) + fuelLast : 0;
  const tyreSec = tyreCount * tyreTime;
  const staticSec = pitLaneSec + fuelSec + tyreSec + penaltySec + damageSec;
  const paceSec = avgLapSec * laps;

  return { ok: true, missing, warnings, pitLaneSec, fuelSec, tyreSec,
    penaltySec, damageSec, staticSec, paceSec, totalSec: paceSec + staticSec,
    avgLapSec, pits, raceLaps: laps };
}

/* Tutarlılık uyarıları — HESABI DURDURMAZ, yalnız veri girişi hatasına
   işaret eder. Excel'de STINT NUMBERS sütunu hiçbir formüle girmiyordu
   (ölü sütun); burada en azından pit sayısıyla çapraz doğrulanıyor. */
export function stintWarnings(team) {
  const t = team || {};
  const w = [];
  const pits = num(t.pits), stints = num(t.stints), tyreCount = num(t.tyreCount);
  /* Bir yarışta stint sayısı = durak sayısı + 1 (ilk stint duraksız başlar). */
  if (pits !== null && stints !== null && stints !== pits + 1) w.push("stintMismatch");
  /* Her durakta en fazla bir kez lastik değişir → lastik adedi durağı geçemez. */
  if (pits !== null && tyreCount !== null && tyreCount > pits) w.push("tyreOverPits");
  return w;
}

/* ---------- iki takım ---------- */
/* A ve B'yi karşılaştırır. İşaret sözleşmesi: NEGATİF = A önde (A daha az
   toplam süre harcıyor). Excel'in D16/D17'si de (sol − sağ) yönündeydi;
   burada da A − B. UI rengi bu sözleşmeye göre kurulur — Excel'de renkler
   sağdaki takımın (kullanıcının kendi takımının) aleyhine okunuyordu. */
export function compareTeams(a, b, raceLaps) {
  const A = teamTime(a, raceLaps);
  const B = teamTime(b, raceLaps);
  if (!A.ok || !B.ok) {
    return { a: A, b: B, ok: false, staticDelta: null, paceDelta: null,
      lapDelta: null, totalDelta: null, leader: null, breakEvenLap: null };
  }
  const staticDelta = A.staticSec - B.staticSec;
  const paceDelta = A.paceSec - B.paceSec;
  const totalDelta = A.totalSec - B.totalSec;
  const lapDelta = A.avgLapSec - B.avgLapSec;
  /* Geride olan takımın tur başına bulması gereken saniye. Tek bölme —
     modellenmiş bir tahmin değil, farkın tur sayısına dağıtılmışı. */
  const laps = A.raceLaps;
  const breakEvenLap = laps > 0 ? Math.abs(totalDelta) / laps : null;
  return { a: A, b: B, ok: true, staticDelta, paceDelta, lapDelta, totalDelta,
    leader: totalDelta === 0 ? "tie" : (totalDelta < 0 ? "a" : "b"), breakEvenLap };
}

/* ---------- tüm saha ---------- */
/* Verisi TAM olan takımları toplam süreye göre sıralar; eksik olanlar
   ayrı listede döner (sıralamaya sokulmaz — uydurma sıra üretmemek için).
   Dönen: { ranked: [{ team, idx, res, gapToLeader }], incomplete: [{ team, idx, res }] } */
export function rankTeams(teams, raceLaps) {
  const rows = (Array.isArray(teams) ? teams : []).map((team, idx) => ({
    team, idx, res: teamTime(team, raceLaps),
  }));
  const named = rows.filter((r) => String(r.team?.name || "").trim());
  const ranked = named.filter((r) => r.res.ok).sort((x, y) => x.res.totalSec - y.res.totalSec);
  const lead = ranked.length ? ranked[0].res.totalSec : null;
  return {
    ranked: ranked.map((r) => ({ ...r, gapToLeader: lead === null ? null : r.res.totalSec - lead })),
    incomplete: named.filter((r) => !r.res.ok),
  };
}

/* ---------- kendi planından tohumlama ---------- */
/* Kullanıcının KENDİ takım satırını, uygulamanın zaten kurduğu yarış planından
   doldurur. Excel'de bu on alan elle giriliyordu ve dosyada tam da bu yüzden
   bir kalem eksik kalmıştı: son durak yakıt süresi hâlâ TAM SERVİS (40 sn)
   yazıyordu, oysa son durakta yalnız bitirmeye yetecek kadar alınır. Plan bunu
   `lastRefuelPct` olarak zaten hesaplıyor (engine.computePlan) — buradan
   okununca kalem kendiliğinden doğru gelir.

   ALANLAR NEREDEN:
     pits      = plan.fullStints − 1   (son stint duraksız biter)
     stints    = plan.fullStints
     pitLane   = st.pitLaneTime        (pist seçilince PIT_LANE_TIMES'tan gelir)
     fuelFull  = st.fuelTime           (tam depo dolum süresi)
     fuelLast  = st.fuelTime × plan.lastRefuelPct / 100
     tyreTime  = tyre4Sec              (planın kendi 4 lastik süresi — çağıran verir)
     tyreCount = st.pits içinde lastik işaretli durak sayısı
     avgLap    = plan.lapSec           (havaya göre düzeltilmiş efektif tur)
     raceLaps  = plan.totalLaps

   Plan geçersizse (`invalid`) null döner — yarım plandan sayı üretilmez. */
export function seedFromPlan(st, plan, tyre4Sec) {
  const s = st || {};
  const p = plan || {};
  if (p.invalid) return null;
  const stints = num(p.fullStints);
  const totalLaps = num(p.totalLaps);
  const lapSec = num(p.lapSec);
  if (!(stints > 0) || !(totalLaps > 0) || !(lapSec > 0)) return null;

  const pits = Math.max(0, stints - 1);
  const fuelFull = num(s.fuelTime);
  const lastPct = num(p.lastRefuelPct);
  /* lastRefuelPct yoksa (plan tek stint ya da hesap yakınsamadı) son durak
     yakıtını UYDURMA: tam servis süresine düşmek "40 sn" hatasını tekrarlardı,
     0 yazmak ise bedava durak iddiası olurdu. Alan boş bırakılır. */
  const fuelLast = fuelFull !== null && lastPct !== null
    ? Math.round(fuelFull * lastPct) / 100 : "";

  /* Lastik değişen durak sayısı: plandaki gerçek duraklarda dört köşeden biri
     bile işaretliyse o durak sayılır (pit satırı = stint indeksi). */
  const pitRows = Array.isArray(s.pits) ? s.pits.slice(0, pits) : [];
  const tyreCount = pitRows.filter(
    (r) => Array.isArray(r?.tyres) && r.tyres.some(Boolean)).length;

  return {
    ...EMPTY_TEAM,
    pits,
    stints,
    pitLane: num(s.pitLaneTime) ?? "",
    fuelFull: fuelFull ?? "",
    fuelLast,
    tyreTime: num(tyre4Sec) ?? "",
    tyreCount,
    avgLap: fmtLapMs(lapSec),
    penalty: 0,
    damage: 0,
  };
}

/* Plandan önerilen toplam yarış turu (Strateji Karşılaştırma başlığındaki alan).
   Geçersiz planda null — "0 tur" diye bir yarış yok. */
export function suggestedLaps(plan) {
  const n = num(plan?.totalLaps);
  return plan && !plan.invalid && n > 0 ? Math.round(n) : null;
}

/* ---------- plan varyantları (A planı mı B planı mı?) ---------- */
/* Uygulamanın kendi strateji varyantları: `st.strategies` = { A: 8, B: 9, … }
   (stint başına tur). `computePlan` bunlardan yalnız `st.chosen` olanı kurar;
   karşılaştırma için her varyantın planı ayrı ayrı hesaplatılabilir
   (`computePlan({ ...st, chosen: key })`).

   `ready` UCUZ bir ön kontroldür: engine.computePlan'ın `invalid` koşulunun
   tur-tur YÜRÜMEDEN bakılabilen kısmı. Dört varyantın planını her renderda
   kurmak pahalıdır (computePlan tur-tur yürüyüş + sabit-nokta döngüsü; kod
   tabanı bu yüzden üç çağrıyı bire indirmişti) — plan yalnız düğmeye
   BASILINCA hesaplanır, düğmenin aktifliği buradan okunur. */
export function strategyOptions(st) {
  const s = st || {};
  const map = s.strategies && typeof s.strategies === "object" ? s.strategies : {};
  /* Yarış süresi ve ortalama tur tüm varyantlarda ORTAK; biri geçersizse
     hiçbir varyant plan üretemez. */
  const raceOk = parseHMS(s.raceTime) > 0;
  const lapOk = parseLap(s.avgLap) >= MIN_LAP_SEC;
  return Object.keys(map).sort()
    .map((key) => ({ key, laps: num(map[key]) }))
    .filter((o) => o.laps !== null)
    .map((o) => ({ ...o, ready: raceOk && lapOk && o.laps > 0 }));
}
