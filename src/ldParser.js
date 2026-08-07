/* ============================================================
   MoTeC .ld ikili telemetri çözümleyici (tarayıcıda, bağımlılıksız)
   ------------------------------------------------------------
   Kullanıcı .ld'yi doğrudan yükleyebilsin diye (MoTeC'te CSV'ye export etmeden).
   Çıktı, parsers.js'teki `parseMotecLog` ile BİREBİR aynı şekli döndürür
   → useTelemetry.saveMotec + TeleTab `parsed.motec` dalı sıfır değişiklikle işler.

   SEÇİCİ OKUMA (v1.4.103): dosyanın TAMAMI belleğe alınmaz. Önce başlık + kanal
   meta listesi (birkaç yüz KB) okunur; sonra YALNIZ gereken ~11 kanalın bayt bloğu
   `File.slice(...).arrayBuffer()` ile diskten çekilir. Bellek dosya boyutundan
   BAĞIMSIZ → 100MB+ endurance log'ları donmadan/şişmeden açılır. Örnekler talep
   üzerine okunur (dev Float64Array yok).

   Format (gerçek dosyada doğrulandı):
   - Başlık: meta_ptr @0x08, data_ptr @0x0C (uint32 LE).
   - Kanal meta bloğu 84 bayt, bağlı-liste (next @off+4): data_addr@8, n_data@12,
     dtype@20, freq@22, shift/mul/scale/dec (4×int16 @24), name@32(32s), unit@72(12s).
   - dtype 4=int32, 2=int16, 1=int8 (FLOAT DEĞİL); fiziksel = ham/scale·10^(−dec)·mul+shift.
   ============================================================ */

const OFF = { DATE: 0x5e, TIME: 0x7e, DRIVER: 0x9e, VENUE: 0x15e, VEHICLE: 0x1f94 };
const MAX_HEAD = 8 * 1024 * 1024;   // başlık+meta için üst sınır (asla tüm dosya değil)

const bytesOf = (dtype) => (dtype === 4 ? 4 : dtype === 2 ? 2 : dtype === 1 ? 1 : 0);

/* Blob/File'dan [start, start+len) dilimini ArrayBuffer olarak oku (FileReader'sız). */
async function readSlice(file, start, len) {
  const end = Math.min(file.size, start + Math.max(0, len));
  if (start < 0 || start >= file.size || end <= start) return null;
  return file.slice(start, end).arrayBuffer();
}

/* Bir kanalın ham bayt bloğunu diskten çek → hafif okuyucu {dv,c,bytes,ndata}.
   Float64Array MATERIALIZE ETMEZ; sampleAt/aralık döngüleri buradan talep üzerine okur. */
async function readChannel(file, c) {
  if (!c) return null;
  const bytes = bytesOf(c.dtype);
  if (!bytes) return null;                       // beklenmedik tip (ör. float) → atla
  const len = c.ndata * bytes;
  const buf = await readSlice(file, c.dptr, len);
  if (!buf || buf.byteLength < len) return null;
  return { dv: new DataView(buf), c, bytes, ndata: c.ndata };
}

/* Okuyucudan i. örneğin fiziksel değeri (dtype + ölçek). Sınır-korumalı. */
function sampleAt(r, i) {
  if (!r) return null;
  if (i < 0) i = 0;
  if (i >= r.ndata) i = r.ndata - 1;
  const o = i * r.bytes;
  const dt = r.c.dtype;
  const raw = dt === 4 ? r.dv.getInt32(o, true)
    : dt === 2 ? r.dv.getInt16(o, true) : r.dv.getInt8(o);
  return (raw / (r.c.scale || 1)) * 10 ** (-r.c.dec) * (r.c.mul || 1) + r.c.shift;
}

/* ArrayBuffer/Blob/File → { motec:true, laps, meta } ya da { error }. ASYNC. */
export async function parseLd(input) {
  const file = input instanceof ArrayBuffer ? new Blob([input]) : input;
  if (!file || typeof file.slice !== "function" || !file.size || file.size < 64) {
    return { error: "MoTeC .ld tanınmadı — dosya çok küçük" };
  }

  /* Başlık: önce 16 baytla data_ptr'yi öğren, sonra yalnız başlık+meta bölgesini oku. */
  const hb = await readSlice(file, 0, 16);
  if (!hb) return { error: "Dosya okunamadı" };
  const dataPtr = new DataView(hb).getUint32(12, true);
  const headLen = Math.min(file.size, MAX_HEAD, Math.max(dataPtr || 0, 0x2000));
  const headBuf = await readSlice(file, 0, headLen);
  if (!headBuf) return { error: "Dosya okunamadı" };
  const dv = new DataView(headBuf);
  const u8 = new Uint8Array(headBuf);
  const str = (off, len) => {
    if (off < 0 || off + len > u8.length) return "";
    let s = "";
    for (let i = 0; i < len; i++) { const ch = u8[off + i]; if (!ch) break; s += String.fromCharCode(ch); }
    return s.trim();
  };

  const metaPtr = dv.getUint32(8, true);
  if (!metaPtr || metaPtr + 84 > dv.byteLength) return { error: "MoTeC .ld tanınmadı ya da bozuk" };

  /* Kanal meta bağlı-listesini gez (isim → kanal). */
  const chans = {};
  const order = [];
  let off = metaPtr;
  const seen = new Set();
  let guard = 0;
  while (off && off + 84 <= dv.byteLength && !seen.has(off) && guard++ < 5000) {
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

  /* YALNIZ gereken kanalların bayt bloklarını diskten çek (tam dosya değil). */
  const rLap = await readChannel(file, cLap);
  if (!rLap || !rLap.ndata) return { error: "MoTeC .ld: veri çözümlenemedi" };
  const rFuel = await readChannel(file, cFuel);
  const rSpd = await readChannel(file, cSpd);
  const rPit = await readChannel(file, cPit);
  const rTrk = await readChannel(file, cTrk);
  const rAmb = await readChannel(file, cAmb);
  const rLast = await readChannel(file, cLast);
  const rWear = [];
  for (const c of cWear) rWear.push(await readChannel(file, c));   // sıralı (bellek dostu)

  /* Bir okuyucuyu seansa-göreli zamanda (saniye) örnekle — kanalın KENDİ freq'iyle. */
  const atT = (r, tSec) => (r ? sampleAt(r, Math.round(tSec * r.c.freq)) : null);
  /* Bir zaman aralığındaki hız örnekleri → {avg, max}. `excl` ise üst sınırdaki örnek
     (= sonraki turun ilk örneği) dahil edilmez → tur değeri komşu tura sızmaz. */
  const spdRange = (t0, t1, excl) => {
    if (!rSpd) return { avg: null, max: null };
    const a = Math.max(0, Math.round(t0 * rSpd.c.freq));
    const b = Math.min(rSpd.ndata - 1, Math.round(t1 * rSpd.c.freq) - (excl ? 1 : 0));
    let sum = 0, mx = -Infinity, n = 0;
    for (let i = a; i <= b; i++) { const v = sampleAt(rSpd, i); if (Number.isFinite(v)) { sum += v; if (v > mx) mx = v; n++; } }
    return n ? { avg: sum / n, max: mx } : { avg: null, max: null };
  };
  const pitInRange = (t0, t1, excl) => {
    if (!rPit) return false;
    const a = Math.max(0, Math.round(t0 * rPit.c.freq));
    const b = Math.min(rPit.ndata - 1, Math.round(t1 * rPit.c.freq) - (excl ? 1 : 0));
    for (let i = a; i <= b; i++) if ((sampleAt(rPit, i) || 0) > 0) return true;
    return false;
  };

  /* Turları Lap Number kanalıyla ZAMAN aralıklarına böl (kendi freq'i; slice'ı akıtarak). */
  const segs = [];
  let cur = null;
  for (let i = 0; i < rLap.ndata; i++) {
    const ln = Math.round(sampleAt(rLap, i));
    const tSec = i / rLap.c.freq;
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
    if (nx && rLast) {
      const v = atT(rLast, nx.t0 + Math.min(0.2, (nx.t1 - nx.t0) / 2));
      if (v && v > 20 && v < 1200) official = v;
    }
    const f0 = atT(rFuel, s.t0);
    const f1 = atT(rFuel, tEnd);
    const { avg, max } = spdRange(s.t0, tEnd, !!nx);
    return {
      lap: s.ln, n: s.n,
      sec: official != null ? official : span, official, span,
      fuelL: f0 != null && f1 != null && f0 > f1 ? f0 - f1 : null,
      w: rWear.map((r, wi) => {
        if (!r) return null;
        void wi;
        const x = atT(r, s.t0), y = atT(r, tEnd);
        return x != null && y != null ? Math.abs(y - x) : null;
      }),
      pit: pitInRange(s.t0, tEnd, !!nx),
      avgSpd: avg,
      maxSpd: max != null && Number.isFinite(max) ? max : null,
      partial: official == null,
    };
  }).filter((l) => l.n >= 5 && l.sec != null && l.sec > 10);

  if (!laps.length) return { error: "MoTeC .ld: geçerli tur bulunamadı" };

  const totalT = cElt.ndata / cElt.freq;
  return {
    motec: true, laps,
    meta: {
      venue: str(OFF.VENUE, 64),
      vehicle: str(OFF.VEHICLE, 64),
      driver: str(OFF.DRIVER, 64),
      date: str(OFF.DATE, 16),
      trk: atT(rTrk, totalT / 2),
      amb: atT(rAmb, totalT / 2),
    },
  };
}
