/* ============================================================
   MoTeC .ld ikili telemetri çözümleyici (tarayıcıda, bağımlılıksız)
   ------------------------------------------------------------
   Kullanıcı .ld'yi doğrudan yükleyebilsin diye (MoTeC'te CSV'ye export etmeden).
   Çıktı, parsers.js'teki `parseMotecLog` ile BİREBİR aynı şekli döndürür
   → useTelemetry.saveMotec + TeleTab `parsed.motec` dalı sıfır değişiklikle işler.

   Format (gerçek dosyada doğrulandı):
   - Başlık: meta_ptr @0x08, data_ptr @0x0C (uint32 LE).
   - Kanal meta bloğu 84 bayt, bağlı-liste (next @off+4): data_addr@8, n_data@12,
     dtype@20, freq@22, shift/mul/scale/dec (4×int16 @24), name@32(32s), unit@72(12s).
   - dtype 4=int32, 2=int16, 1=int8 (FLOAT DEĞİL); fiziksel = ham/scale·10^(−dec)·mul+shift.
   - Örnekler kanal başına ayrı blokta (data_addr); her kanal kendi freq'iyle zamanlanır.
   Yalnız gereken ~10 kanal decode edilir (245'in tamamı değil) → hızlı/hafif.
   ============================================================ */

const OFF = { DATE: 0x5e, TIME: 0x7e, DRIVER: 0x9e, VENUE: 0x15e, VEHICLE: 0x1f94 };

/* Bir kanalın ham örneklerini fiziksel Float64Array'e çevir (dtype + ölçek). */
function decodeChannel(dv, c) {
  if (!c) return null;
  const { dptr, ndata, dtype } = c;
  const sc = c.scale || 1;
  const mul = c.mul || 1;
  const p = 10 ** (-c.dec);
  const sh = c.shift;
  const out = new Float64Array(ndata);
  let o = dptr;
  if (dtype === 4) {
    if (o + ndata * 4 > dv.byteLength) return null;
    for (let i = 0; i < ndata; i++) { out[i] = (dv.getInt32(o, true) / sc) * p * mul + sh; o += 4; }
  } else if (dtype === 2) {
    if (o + ndata * 2 > dv.byteLength) return null;
    for (let i = 0; i < ndata; i++) { out[i] = (dv.getInt16(o, true) / sc) * p * mul + sh; o += 2; }
  } else if (dtype === 1) {
    if (o + ndata > dv.byteLength) return null;
    for (let i = 0; i < ndata; i++) { out[i] = (dv.getInt8(o) / sc) * p * mul + sh; o += 1; }
  } else {
    return null;   // beklenmedik tip (ör. float variantı) — CSV yoluyla doğrulanınca eklenir
  }
  return out;
}

/* ArrayBuffer → { motec:true, laps, meta } (parseMotecLog ile aynı) ya da { error }. */
export function parseLd(buffer) {
  let dv;
  try { dv = new DataView(buffer); } catch { return { error: "Dosya okunamadı" }; }
  if (dv.byteLength < 64) return { error: "MoTeC .ld tanınmadı — dosya çok küçük" };

  const u8 = new Uint8Array(buffer);
  const str = (off, len) => {
    if (off < 0 || off + len > u8.length) return "";
    let s = "";
    for (let i = 0; i < len; i++) { const ch = u8[off + i]; if (!ch) break; s += String.fromCharCode(ch); }
    return s.trim();
  };

  const metaPtr = dv.getUint32(8, true);
  if (!metaPtr || metaPtr + 84 > dv.byteLength) {
    return { error: "MoTeC .ld tanınmadı ya da bozuk" };
  }

  /* Kanal meta bağlı-listesini gez (isim → kanal). */
  const chans = {};
  const order = [];
  let off = metaPtr;
  const seen = new Set();
  let guard = 0;
  while (off && off + 84 <= dv.byteLength && !seen.has(off) && guard++ < 4000) {
    seen.add(off);
    const next = dv.getUint32(off + 4, true);
    const c = {
      dptr: dv.getUint32(off + 8, true),
      ndata: dv.getUint32(off + 12, true),
      dtype: dv.getUint16(off + 20, true),
      freq: dv.getUint16(off + 22, true) || 1,
      shift: dv.getInt16(off + 24, true),
      mul: dv.getInt16(off + 26, true),
      scale: dv.getInt16(off + 28, true),
      dec: dv.getInt16(off + 30, true),
      name: str(off + 32, 32),
    };
    if (c.name) { chans[c.name.toLowerCase()] = c; order.push(c.name); }
    off = next;
  }
  if (!order.length) return { error: "MoTeC .ld: kanal bulunamadı" };

  const find = (...res) => {
    for (const re of res) {
      const k = order.find((n) => re.test(n));
      if (k) return chans[k.toLowerCase()];
    }
    return null;
  };
  const cLap = find(/^lap number$/i, /lap\s*num/i, /^lap$/i);
  const cElt = find(/^session elapsed time$/i, /elapsed/i, /^time$/i);
  if (!cLap || !cElt) return { error: "MoTeC .ld: tur/zaman kanalı bulunamadı" };

  const cFuel = find(/^fuel level$/i, /fuel\s*level/i, /^fuel$/i);
  const cSpd = find(/^ground speed$/i, /^speed$/i);
  const cPit = find(/^in pits$/i, /^pit\s*status$/i);
  const cTrk = find(/^track temp/i);
  const cAmb = find(/^ambient temp/i);
  const cLast = find(/^last laptime$/i, /last\s*lap\s*time/i);
  const cWear = ["fl", "fr", "rl", "rr"].map((x) =>
    find(new RegExp(`^tyre wear ${x}$`, "i"), new RegExp(`wear\\s*${x}$`, "i")));

  const lap = decodeChannel(dv, cLap);
  const elt = decodeChannel(dv, cElt);
  if (!lap || !elt || !lap.length) return { error: "MoTeC .ld: veri çözümlenemedi" };
  const fuel = decodeChannel(dv, cFuel);
  const spd = decodeChannel(dv, cSpd);
  const pit = decodeChannel(dv, cPit);
  const trk = decodeChannel(dv, cTrk);
  const amb = decodeChannel(dv, cAmb);
  const last = decodeChannel(dv, cLast);
  const wear = cWear.map((c) => decodeChannel(dv, c));

  /* Bir kanalı seansa-göreli zamanda (saniye) örnekle — kanalın KENDİ freq'iyle. */
  const at = (arr, c, tSec) => {
    if (!arr || !c) return null;
    let i = Math.round(tSec * c.freq);
    if (i < 0) i = 0;
    if (i >= arr.length) i = arr.length - 1;
    return arr[i];
  };
  /* Bir zaman aralığındaki hız örnekleri → {avg, max}. `excl` ise üst sınırdaki örnek
     (= sonraki turun ilk örneği) dahil edilmez → tur değeri komşu tura sızmaz. */
  const spdRange = (t0, t1, excl) => {
    if (!spd || !cSpd) return { avg: null, max: null };
    const a = Math.max(0, Math.round(t0 * cSpd.freq));
    const b = Math.min(spd.length - 1, Math.round(t1 * cSpd.freq) - (excl ? 1 : 0));
    let sum = 0, mx = -Infinity, n = 0;
    for (let i = a; i <= b; i++) { const v = spd[i]; if (Number.isFinite(v)) { sum += v; if (v > mx) mx = v; n++; } }
    return n ? { avg: sum / n, max: mx } : { avg: null, max: null };
  };
  const pitInRange = (t0, t1, excl) => {
    if (!pit || !cPit) return false;
    const a = Math.max(0, Math.round(t0 * cPit.freq));
    const b = Math.min(pit.length - 1, Math.round(t1 * cPit.freq) - (excl ? 1 : 0));
    for (let i = a; i <= b; i++) if ((pit[i] || 0) > 0) return true;
    return false;
  };

  /* Turları Lap Number kanalıyla ZAMAN aralıklarına böl (kendi freq'i = kanıtlanan yöntem). */
  const segs = [];
  let cur = null;
  for (let i = 0; i < lap.length; i++) {
    const ln = Math.round(lap[i]);
    const tSec = i / cLap.freq;
    if (!cur || cur.ln !== ln) { cur = { ln, t0: tSec, t1: tSec, n: 0 }; segs.push(cur); }
    cur.t1 = tSec;
    cur.n++;
  }

  const laps = segs.map((s, gi) => {
    const nx = segs[gi + 1];
    const tEnd = nx ? nx.t0 : s.t1;        // tur L, sonraki turun başına kadar sürer
    const span = tEnd - s.t0;
    /* resmi süre: sonraki turun başındaki "Last Laptime" kanalı (parseMotecLog deseni) */
    let official = null;
    if (nx && cLast && last) {
      const v = at(last, cLast, nx.t0 + Math.min(0.2, (nx.t1 - nx.t0) / 2));
      if (v && v > 20 && v < 1200) official = v;
    }
    const f0 = at(fuel, cFuel, s.t0);
    const f1 = at(fuel, cFuel, tEnd);
    const { avg, max } = spdRange(s.t0, tEnd, !!nx);
    return {
      lap: s.ln, n: s.n,
      sec: official != null ? official : span, official, span,
      fuelL: f0 != null && f1 != null && f0 > f1 ? f0 - f1 : null,
      w: wear.map((arr, wi) => {
        const c = cWear[wi];
        if (!arr || !c) return null;
        const x = at(arr, c, s.t0), y = at(arr, c, tEnd);
        return x != null && y != null ? Math.abs(y - x) : null;
      }),
      pit: pitInRange(s.t0, tEnd, !!nx),
      avgSpd: avg,
      maxSpd: max != null && Number.isFinite(max) ? max : null,
      partial: official == null,
    };
  }).filter((l) => l.n >= 5 && l.sec != null && l.sec > 10);

  if (!laps.length) return { error: "MoTeC .ld: geçerli tur bulunamadı" };

  const totalT = elt.length / cElt.freq;
  return {
    motec: true, laps,
    meta: {
      venue: str(OFF.VENUE, 64),
      vehicle: str(OFF.VEHICLE, 64),
      driver: str(OFF.DRIVER, 64),
      date: str(OFF.DATE, 16),
      trk: at(trk, cTrk, totalT / 2),
      amb: at(amb, cAmb, totalT / 2),
    },
  };
}
