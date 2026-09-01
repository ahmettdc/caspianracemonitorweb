/* ============================================================
   LASTİK PLANI — DİŞ VE DEĞİŞİM SÜRESİ HESABI (saf, v2.3.0)
   ------------------------------------------------------------
   TinyPedal'ın `ui/tyre_strategy_planner.py` planlayıcısı incelendi. Tablo yapısı
   bizimkiyle neredeyse birebir (4 köşe × stint, köşe kilidi, stok limiti, wet
   muaf) — bağımsız olarak aynı modele varılmış. Fark ÜSTÜNE hesapladıkları:

     1. DİŞ MODELİ: hamur × köşe başına `starting_tread` + `wear_per_stint`;
        her hücre "New-70%" / "70-40%" yazıyor, diş eksiye düşerse "Blowout".
     2. DEĞİŞİM SÜRESİ: 5. sütun, değişen lastik sayısına göre +4.5s / +12.0s
        (bir taraf ucuz, üç-dört lastik pahalı).

   ---- BİZDEKİ İKİ FARK (bilinçli) ----
   a) TinyPedal'ın hücreleri HAMUR taşır, bizimkiler SET NUMARASI. Bu yüzden
      hamur başına aşınma/başlangıç dişi bize eşlenmiyor → TEK bir "stint başına
      aşınma" yüzdesi kullanılır. Q- lastiklerinin %90 başlangıç dişi gibi
      incelikler de bu yüzden alınmadı; uydurma bir eşleme yapılmadı.
   b) TinyPedal `wear_per_stint`'i kullanıcıya ELLE yazdırıyor (tahmin). Bizde
      canlı telemetri var: `measuredWear` gerçek okumadan ölçer (aşağıya bak),
      yani onun tahmin ettiği sayıyı biz ÖLÇÜYORUZ.

   React/Firebase bağımsız → tyrePlanCalc.test.js doğrudan test eder.
   ============================================================ */

/* Bir hücre "gerçek bir lastik" mi? Wet ("W") bir SET DEĞİL, "ıslak lastik"
   yer tutucusudur: iki ayrı W hücresi aynı fiziksel lastik değildir. Diş
   hesabına sokulursa her W birbirinin üstüne aşınma biriktirir → uydurma.
   Bu yüzden diş hesabı yalnız kuru set numaraları için yapılır. */
export const isDrySet = (v) => {
  const k = String(v ?? "").trim();
  return !!k && k !== "W";
};

/* Etkin ızgara: boş hücre = TAŞIMA (state.js carriedTyre semantiği) → yukarıdan
   ilk dolu değer devralınır. Satır 0 = Qual, 1..n = S1..Sn.
   Dönüş: satır × 4 etkin set numarası (yoksa ""). */
export function effectiveGrid(tyreQual, tyreStints) {
  const q = Array.isArray(tyreQual) ? tyreQual : [];
  const rows = Array.isArray(tyreStints) ? tyreStints : [];
  const out = [];
  const cur = ["", "", "", ""];
  for (let c = 0; c < 4; c += 1) cur[c] = String(q[c] ?? "").trim();
  out.push([...cur]);
  for (const row of rows) {
    const cells = Array.isArray(row) ? row : [];
    for (let c = 0; c < 4; c += 1) {
      const v = String(cells[c] ?? "").trim();
      if (v) cur[c] = v;
    }
    out.push([...cur]);
  }
  return out;
}

/* Her hücre için diş durumu (TinyPedal deseni: bu set kaçıncı stintinde?).
   wearPerStint: 0..1 (stint başına aşınan diş oranı).
   Dönüş: satır × 4 → { id, uses, start, end, fresh, blowout } ya da null (wet/boş).
     uses  : bu set BU SATIRDAN ÖNCE kaç stint koştu
     start : satıra girerken kalan diş (0..1) — yeni lastik 1.0 varsayılır
     end   : satır sonunda kalan diş
     fresh : uses === 0 → bu satır setin İLK kullanımı ("Yeni")
     blowout: end < 0 → plan bu seti kapasitesinin ötesinde çalıştırıyor
   NOT: başlangıç dişi HER set için 1.0 kabul edilir. Oyun "bu set daha önce
   kaç tur görmüş" bilgisini vermiyor; Q- lastiği gibi kısmi setler UYDURULMAZ. */
export function planTread(tyreQual, tyreStints, wearPerStint) {
  const grid = effectiveGrid(tyreQual, tyreStints);
  const w = Number(wearPerStint);
  const wear = Number.isFinite(w) && w > 0 ? w : 0;
  const seen = new Map();          // set → önceki stint sayısı
  return grid.map((row) => row.map((id) => {
    if (!isDrySet(id)) return null;
    const uses = seen.get(id) || 0;
    seen.set(id, uses + 1);
    const start = 1 - wear * uses;
    const end = start - wear;
    return { id, uses, start, end, fresh: uses === 0, blowout: end < 0 };
  }));
}

/* Değişim süresi: bir tarafı değiştirmek (1–2 lastik) dört lastikten belirgin
   ucuzdur — TinyPedal da eşiği 2/3'te koyuyor. */
export function changeTimeOf(n, t12, t34) {
  const c = Number(n);
  if (!(c > 0)) return 0;
  const a = Number(t12);
  const b = Number(t34);
  return c <= 2 ? (Number.isFinite(a) ? a : 0) : (Number.isFinite(b) ? b : 0);
}

/* Plandaki TOPLAM lastik değişim süresi (saniye). rows: planChanges() çıktısı. */
export function totalChangeTime(changes, t12, t34) {
  return (Array.isArray(changes) ? changes : [])
    .reduce((s, c) => s + changeTimeOf(c.n, t12, t34), 0);
}

/* ---- ÖLÇÜLEN AŞINMA (TinyPedal'da yok: o kullanıcıya yazdırır, biz ölçeriz) ----
   Yalnız TAZE SETLE başlayan ve HÂLÂ SÜREN dönemde anlamlıdır: başlangıç dişini
   ancak o zaman biliriz (yeni set = 1.0). Kısmi (2 lastik) değişimde iki köşenin
   geçmişi bilinmediği için ölçüm YAPILMAZ — tahmin üretmek yerine null döner.
   period: buildLedger'ın açık dönemi · tyres: {fl:{wear},…} canlı okuma.
   Dönüş: { perLap, perStint, laps, tread } | null   (perStint = stintLaps × perLap) */
export function measuredWear(period, tyres, currentLap, stintLaps) {
  if (!period || period.n !== 4 || !period.open) return null;
  if (!tyres || typeof tyres !== "object") return null;
  const vals = ["fl", "fr", "rl", "rr"]
    .map((k) => Number(tyres[k] && tyres[k].wear))
    .filter((v) => Number.isFinite(v) && v >= 0 && v <= 1);
  if (vals.length < 4) return null;
  const tread = Math.min(...vals);            // en kötü köşe belirler
  const laps = Number(currentLap) - Number(period.fromLap);
  if (!(laps >= 1)) return null;              // tek turluk veri hız vermez
  const perLap = (1 - tread) / laps;
  if (!(perLap > 0)) return null;             // hiç aşınma okunmadı → ölçüm yok
  const sl = Number(stintLaps);
  return {
    perLap,
    perStint: sl > 0 ? perLap * sl : null,
    laps,
    tread,
  };
}

/* ============================================================
   PATLAK — patlayan set bir daha kullanılamaz (v2.3.1)
   ------------------------------------------------------------
   Tasarım fişi "patlayan set yeniden kullanılamaz" diyor (set kutusu ipucu da
   bunu yazıyor) ama fişin verdiği seçici kodu bunu HİÇ uygulamıyordu: yalnız
   köşe kilidine bakıyordu, patlak set sonraki stintlerde yeniden seçilebiliyordu
   (kullanıcı bildirimi). Kural SATIRA duyarlıdır: lastik patladığı satırdan
   SONRASI için geçersizdir — öncesinde araçtaydı, orada geçerli kalır.
   ============================================================ */

/* Patlak işaretleri ({"satır:köşe": true}) + ızgara → Map(setId → patladığı İLK
   satır). Wet ("W") bir set değildir, sayılmaz; boş hücreler atlanır. */
export function popRows(tyPop, grid) {
  const out = new Map();
  if (!tyPop || typeof tyPop !== "object") return out;
  const rows = Array.isArray(grid) ? grid : [];
  for (const k of Object.keys(tyPop)) {
    if (!tyPop[k]) continue;
    const [ri, ci] = String(k).split(":").map(Number);
    if (!Number.isInteger(ri) || !Number.isInteger(ci)) continue;
    const id = String((rows[ri] || [])[ci] ?? "").trim();
    if (!id || id === "W") continue;
    const prev = out.get(id);
    if (prev == null || ri < prev) out.set(id, ri);
  }
  return out;
}

/* Set `id`, `row` satırında patlak yüzünden yasak mı? Yalnız patladığı satırdan
   SONRASI yasaktır (patladığı satırın kendisi ve öncesi geçerli okumadır). */
export function popBlockedAt(rowsMap, id, row) {
  if (!(rowsMap instanceof Map)) return false;
  const pr = rowsMap.get(String(id ?? "").trim());
  return pr != null && Number(row) > pr;
}
