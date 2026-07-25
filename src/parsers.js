/* Telemetri ayrıştırma — MoTeC CSV/log ve genel tablo içe aktarma.
   Saf fonksiyonlar; App.jsx içe aktarır. */
export const isLapLabel = (c) => /^(out ?lap|in ?lap|lap ?\d+)$/i.test(String(c).trim());

export const msFromCell = (v) => {
  const t = String(v).trim().replace(",", ".");
  if (/^\d+:\d{1,2}(\.\d+)?$/.test(t)) {
    const [m, s] = t.split(":");
    return Math.round(((+m) * 60 + (+s)) * 1000);
  }
  const n = parseFloat(t);
  if (isNaN(n)) return null;
  if (n > 20000) return Math.round(n);        // zaten milisaniye
  if (n > 30 && n < 1200) return Math.round(n * 1000); // saniye
  return null;
};

/* ---------- ham MoTeC kanal log'u (sample bazlı, 100 Hz, 200+ kanal) ----------
   MoTeC iki farklı çıktı verir:
   a) tur istatistiği raporu → "Out Lap / Lap 1" satırları (parseTelemetryText)
   b) ham kanal log'u → her satır bir örnek, tur bilgisi "Lap Number" kanalında
   Bu fonksiyon (b)'yi tur bazına indirger. */
export const splitCsvLine = (line, delim) => {
  const out = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
};
export const tnum = (v) => {
  const n = parseFloat(String(v == null ? "" : v).replace(",", "."));
  return isNaN(n) ? null : n;
};

export function parseMotecLog(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length < 20) return null;
  const head = lines.slice(0, 30).join("");
  const delim = (head.match(/;/g) || []).length > (head.match(/,/g) || []).length ? ";" : ",";

  let hi = -1, cols = null;
  for (let i = 0; i < Math.min(lines.length, 60); i++) {
    const c = splitCsvLine(lines[i], delim);
    if (c.length >= 8 && /^time$/i.test(c[0])) { hi = i; cols = c; break; }
  }
  if (hi === -1) return null;

  /* üst bilgi: "Venue","Spa",,,"Worksheet","" → hem 0-1 hem 4-5 çiftleri */
  const meta = {};
  for (let i = 0; i < hi; i++) {
    const c = splitCsvLine(lines[i], delim);
    for (const [k, v] of [[0, 1], [4, 5]]) {
      if (c[k] && c[v]) meta[c[k].toLowerCase()] = c[v];
    }
  }

  const find = (...res) => {
    for (const re of res) { const i = cols.findIndex((c) => re.test(c)); if (i >= 0) return i; }
    return -1;
  };
  const iLap = find(/^lap number$/i, /lap\s*num/i, /^lap$/i);
  if (iLap < 0) return null;
  const iTime = find(/^session elapsed time$/i, /elapsed/i, /^time$/i);
  const iFuel = find(/^fuel level$/i, /fuel\s*level/i, /^fuel$/i);
  const iLast = find(/^last laptime$/i, /last\s*lap\s*time/i);
  const iSpd = find(/^ground speed$/i, /^speed$/i);
  const iPit = find(/^in pits$/i, /^pitstatus$/i);
  const iWear = ["fl", "fr", "rl", "rr"].map((c) =>
    find(new RegExp(`^tyre wear ${c}$`, "i"), new RegExp(`wear\\s*${c}$`, "i")));
  const iTrk = find(/^track temperature$/i);
  const iAmb = find(/^ambient temperature$/i);

  const rows = [];
  for (let i = hi + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const c = splitCsvLine(lines[i], delim);
    if (c.length < cols.length - 2 || tnum(c[0]) == null) continue;
    rows.push(c);
  }
  if (rows.length < 20) return null;

  const groups = [];
  let cur = null;
  for (const r of rows) {
    const ln = tnum(r[iLap]);
    if (ln == null) continue;
    if (!cur || cur.lap !== ln) { cur = { lap: ln, rows: [] }; groups.push(cur); }
    cur.rows.push(r);
  }

  const laps = groups.map((g, gi) => {
    const a = g.rows[0], z = g.rows[g.rows.length - 1];
    const t0 = tnum(a[iTime]), t1 = tnum(z[iTime]);
    const span = t0 != null && t1 != null ? t1 - t0 : null;
    /* gerçek tur süresi: sonraki turun başındaki "Last Laptime" kanalı */
    let official = null;
    const nx = groups[gi + 1];
    if (nx && iLast >= 0) {
      const v = tnum(nx.rows[Math.min(3, nx.rows.length - 1)][iLast]);
      if (v && v > 20 && v < 1200) official = v;
    }
    const f0 = iFuel >= 0 ? tnum(a[iFuel]) : null;
    const f1 = iFuel >= 0 ? tnum(z[iFuel]) : null;
    const spds = iSpd >= 0 ? g.rows.map((r) => tnum(r[iSpd])).filter((x) => x != null) : [];
    return {
      lap: g.lap, n: g.rows.length,
      sec: official != null ? official : span, official, span,
      fuelL: f0 != null && f1 != null && f0 > f1 ? f0 - f1 : null,
      w: iWear.map((wi) => {
        if (wi < 0) return null;
        const x = tnum(a[wi]), y = tnum(z[wi]);
        return x != null && y != null ? Math.abs(y - x) : null;
      }),
      pit: iPit >= 0 && g.rows.some((r) => (tnum(r[iPit]) || 0) > 0),
      avgSpd: spds.length ? spds.reduce((x, y) => x + y, 0) / spds.length : null,
      maxSpd: spds.length ? Math.max(...spds) : null,
      partial: official == null,
    };
  }).filter((l) => l.n >= 20 && l.sec != null && l.sec > 10);

  if (!laps.length) return null;
  const mid = rows[Math.floor(rows.length / 2)];
  return {
    motec: true, laps,
    meta: {
      venue: meta.venue || "",
      vehicle: meta["vehicle desc"] || meta.vehicle || "",
      driver: meta.driver || "", date: meta["log date"] || "",
      trk: iTrk >= 0 ? tnum(mid[iTrk]) : null,
      amb: iAmb >= 0 ? tnum(mid[iAmb]) : null,
    },
  };
}

export function parseTelemetryText(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return null;
  /* Ayırıcıyı tırnak-duyarlı ayrıştırarak seç: MoTeC raporlarında ondalık virgül
     tırnak içinde geçer ("-4,174"), ham split bunları parçalar. */
  const cand = ["\t", ";", ","];
  const probe = lines.slice(0, 12);
  const delim = cand.map((d) => {
    const counts = probe.map((l) => splitCsvLine(l, d).length);
    return [d, Math.max(...counts)];
  }).sort((a, b) => b[1] - a[1])[0][0];
  const rows = lines.map((l) => splitCsvLine(l, delim));
  const firstLap = rows.findIndex((r) => r.some(isLapLabel));
  if (firstLap === -1) return { error: "Dosya tanınmadı — MoTeC tur raporu ya da ham kanal log'u bekleniyor" };
  const ncols = Math.max(...rows.map((r) => r.length));
  const headers = Array.from({ length: ncols }, (_, i) =>
    rows.slice(0, firstLap).map((h) => h[i] || "").join(" ").trim());
  const lapRows = rows.slice(firstLap).filter((r) => r.some(isLapLabel));
  return { headers, lapRows, ncols };
}

export function guessMapping(parsed) {
  const { headers, lapRows, ncols } = parsed;
  const labelCol = (() => {
    const scores = Array.from({ length: ncols }, (_, i) =>
      lapRows.filter((r) => isLapLabel(r[i] || "")).length);
    return scores.indexOf(Math.max(...scores));
  })();
  const numStats = Array.from({ length: ncols }, (_, i) => {
    const vals = lapRows.map((r) => parseFloat(String(r[i] || "").replace(",", ".")))
      .filter((n) => !isNaN(n));
    if (!vals.length) return null;
    const abs = vals.map(Math.abs);
    return {
      i, n: vals.length,
      medAbs: abs.sort((a, b) => a - b)[Math.floor(abs.length / 2)],
      negRatio: vals.filter((v) => v < 0).length / vals.length,
    };
  }).filter(Boolean);
  const byHeader = (re) => headers.findIndex((h) => re.test(h));
  /* Tur süresi milisaniye (310127) ya da saniye (140.808) olabilir.
     Saniye durumunda yakıt seviyesi gibi sütunlar da aralığa düşer; ayırt etmek için
     en dar dağılımlı sütunu seçiyoruz — tur süreleri birbirine yakın, yakıt monoton düşer. */
  let timeCol = numStats.find((s) => s.medAbs > 30000 && s.medAbs < 3600000)?.i ?? -1;
  if (timeCol < 0) {
    const secCand = numStats
      .filter((s) => s.i !== labelCol && s.n === lapRows.length
        && s.medAbs > 30 && s.medAbs < 1200 && s.negRatio === 0)
      .map((s) => {
        const vals = lapRows.map((r) => parseFloat(String(r[s.i] || "").replace(",", ".")))
          .filter((n) => !isNaN(n));
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
        return { i: s.i, cv: mean ? sd / mean : 99 };
      })
      .sort((a, b) => a.cv - b.cv);
    if (secCand.length && secCand[0].cv < 0.25) timeCol = secCand[0].i;
  }
  let fuelCol = byHeader(/fuel.*(change|used|delta)/i);
  if (fuelCol === -1)
    fuelCol = numStats.find((s) => s.i !== timeCol && s.medAbs > 0.5 && s.medAbs < 40
      && s.negRatio > 0.5)?.i ?? -1;
  const wear = ["fl", "fr", "rl", "rr"].map((c) =>
    byHeader(new RegExp(`wear\\s*${c}.*change`, "i")));
  /* MoTeC "Fuel Level [l] Change" litre verir; eski raporlar VE % veriyordu. */
  const fuelIsLitre = fuelCol >= 0
    && /\[\s*l\s*\]|\(\s*l\s*\)|litre|liter/i.test(headers[fuelCol] || "");
  return { labelCol, timeCol, fuelCol, wear, fuelIsLitre };
}
