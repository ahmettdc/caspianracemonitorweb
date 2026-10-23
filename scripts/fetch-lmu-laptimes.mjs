#!/usr/bin/env node
/* ============================================================
   fetch-lmu-laptimes — "Ohne Speed's LMU laptimes" tablosundan güncel
   referans tur zamanlarını çeker → public/assets/lmu-data.json üretir.
   ------------------------------------------------------------
   Bu JSON, Dashboard'daki araç kutusuna (DashTab "🏎 Araç" kartı) tıklayınca
   açılan pencerede gösterilen tempo tablosunu (HOTLAP, ALIEN·100%, 1.01…1.07)
   besler. App.jsx onu fetch(`${ASSET}lmu-data.json`) ile okur.

   Kaynak, herkese açık yayınlanmış Google Sheet'tir; her sekme CSV export verir:
     …/pub?gid=<GID>&single=true&output=csv
   Zamanlanmış GitHub Action (.github/workflows/lmu-laptimes.yml) günde 1 çalıştırır,
   değişiklik varsa üretilen dosyayı repoya commit eder.

   SEKMELER:
     • "Laptimes" (gid 1766901750) — tüm sınıflar üst üste bloklar halinde
       (col16 = sınıf etiketi). Sınıf-seviyesi tempo tablosunu verir.
     • "<sınıf> car%" (LMGT3/LMH/LMP3/GTE) — araç başına pist tur zamanları;
       data[pist]["sınıf:araç"] (avgLap/hot) girdilerini besler. LMP2 spec araç
       olduğu için car% sekmesi yok — sadece sınıf-seviyesi + tek "oreca".

   KOLON EŞLEMESİ (Laptimes satırı, 0-indeksli — 6 sınıf bloğunda da aynı):
     0 pist+sınıf birleşik  1 Track  2 Patch
     3 Class avgW (=hot / Hotlap-Q)      4 ~100% (=alien)
     5 101%  6 102% (=avgLap "Good")  7 103%  8 104%  9 105%  10 106%  11 107%
     12 Fastest car  13 Laptime  14 Best/Avg   …   16 sınıf ("LMGT3"/"LMH"/…)

   GÜVENLİK: hiç pist/sınıf üretilemezse non-zero exit → DOSYA YAZILMAZ,
   repodaki son iyi kopya korunur (scrape-lmu-schedule.mjs ile aynı ilke).

   Kullanım: node scripts/fetch-lmu-laptimes.mjs [cikti.json]
   ============================================================ */
import { writeFileSync } from "node:fs";

const PUB =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTN03UvJDm99byA6vQPZHKOCYVvfxLu1zkJAzdaKyROykzEKY2-Xl1rl1q5znZEf36m88dxMKsY2eaO/pub";
const OUT = process.argv[2] || "public/assets/lmu-data.json";
const log = (...a) => process.stderr.write(a.join(" ") + "\n");

const LAPTIMES_GID = "1766901750";
// car% sekmeleri → uygulama sınıf id'si (LMP2 yok: spec araç).
const CARPCT = [
  { gid: "1991956603", cls: "gt3" },
  { gid: "306210712", cls: "hypercar" },
  { gid: "1738814445", cls: "lmp3" },
  { gid: "2143838563", cls: "gte" },
];

// Laptimes sheet'teki sınıf bloğu etiketi → uygulama sınıf id'si.
// LMP2 iki BoP varyantıyla gelir (elms/wec); uygulama tek "lmp2" tutuyor →
// mevcut lmu-data.json'a en yakın olan "LMP2elms" kullanılır, "LMP2wec" atlanır.
const CLASS_SECTION = {
  LMGT3: "gt3",
  LMH: "hypercar",
  LMP3: "lmp3",
  LMP2elms: "lmp2",
  GTE: "gte",
};

// Sheet pist-varyant adı (TAM eşleşme) → uygulama pist id'si. Uygulamanın tek
// pisti karşısında sheet'te birden çok varyant olduğundan (Bahrain wec/endurance/
// outer/paddock…) her pist için TEK kanonik varyant seçilir; buradaki adlar dışı
// (national/short/school/straight/curvagrande/1A…) bilinçli atlanır.
const VARIANT_TRACK = {
  "Bahrain (wec)": "bahrain",
  Barcelona: "barcelona",
  "Circuit de la Sarthe": "lemans",
  COTA: "cota",
  "Fuji (chicane)": "fuji",
  Imola: "imola",
  Interlagos: "interlagos",
  Qatar: "lusail",
  Monza: "monza",
  Portimao: "portimao",
  Sebring: "sebring",
  "Silverstone (GP)": "silverstone",
  Spa: "spa",
  "Paul Ricard": "paulricard",
  Daytona: "daytona",
  "Laguna Seca": "lagunaseca",
};
// "Spa" verisi hem spa hem de spa-endurance için kullanılır (aynı fiziksel pist).
const TRACK_ALIAS = { spa: ["spa", "spa-endurance"] };

// Sheet araç adındaki marka anahtarı → uygulama araç id'si (sınıf başına).
// CARS (src/constants.js) id'leriyle birebir; tabloda olup uygulamada olmayan
// araçlar (gt3 Lamborghini, lmp3 Ginetta…) haritada yoktur → atlanır.
const CAR_ID = {
  gt3: { ferrari: "ferrari", porsche: "porsche", bmw: "bmw", mercedes: "mercedes", mclaren: "mclaren", corvette: "corvette", lexus: "lexus", ford: "ford", aston: "aston" },
  hypercar: { toyota: "toyota", ferrari: "ferrari", porsche: "porsche", cadillac: "cadillac", bmw: "bmw", alpine: "alpine", peugeot: "peugeot", lamborghini: "lamborghini", isotta: "isotta", glickenhaus: "glickenhaus", vanwall: "vanderwell", vandervell: "vanderwell", genesis: "genesis" },
  lmp3: { ligier: "ligier", duqueine: "duqueine", adess: "adess" },
  gte: { ferrari: "ferrari", porsche: "porsche", aston: "aston", corvette: "corvette" },
};
const carIdFor = (cls, rawName) => {
  const s = String(rawName || "").toLowerCase();
  for (const [token, id] of Object.entries(CAR_ID[cls] || {})) {
    if (s.includes(token)) return id;
  }
  return "";
};

/* ---- yardımcılar ---- */
// RFC4180-benzeri CSV parser (tırnaklı alanlar + gömülü virgül/tırnak).
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* yut */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const TIME_RE = /^\d+:\d{2}\.\d{1,3}$/;
const isTime = (v) => TIME_RE.test(String(v || "").trim());
const toSec = (v) => {
  const [m, s] = String(v).trim().split(":");
  return Number(m) * 60 + Number(s);
};
const fmt = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
};
// hot (araç gerçek turu) → avgLap: sınıfın hot→avg oranıyla ölçekle.
const scaleTime = (timeStr, ratio) => fmt(toSec(timeStr) * ratio);

async function fetchCsv(gid) {
  const url = `${PUB}?gid=${gid}&single=true&output=csv`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "CaspianRaceMonitor/1.0 (+https://github.com/ahmettdc/caspianracemonitorweb) laptimes-sync",
      Accept: "text/csv,text/plain",
    },
  });
  if (!res.ok) throw new Error(`gid ${gid}: HTTP ${res.status} ${res.statusText}`);
  return parseCsv(await res.text());
}

/* ---- 1) Sınıf-seviyesi tempo tablosu (Laptimes sekmesi) ---- */
function parseClassLevel(rows, data) {
  let updated = "";
  const ratio = {}; // ratio[trackId][cls] = classAvgLap/classHot (araç ölçekleme için)
  for (const r of rows) {
    if (!updated) {
      const m = r.join(" ").match(/(\d{4})\.(\d{2})\.(\d{2})/); // "Last updated: 2026.08.12."
      if (m) updated = `${m[1]}-${m[2]}-${m[3]}`;
    }
    if (r.length < 17) continue;
    const cls = CLASS_SECTION[String(r[16]).trim()];
    const base = VARIANT_TRACK[String(r[1]).trim()];
    if (!cls || !base) continue;
    const hot = String(r[3]).trim();
    if (!isTime(hot) || !isTime(r[6])) continue; // veri satırı değil → atla

    const tiers = {};
    for (const [k, col] of [["alien", 4], ["c101", 5], ["c102", 6], ["c103", 7], ["c104", 8], ["c105", 9], ["c106", 10], ["c107", 11]]) {
      if (isTime(r[col])) tiers[k] = String(r[col]).trim();
    }
    const avgLap = String(r[6]).trim(); // 102% "Good"
    const entry = { avgLap, tiers, hot };

    for (const tid of TRACK_ALIAS[base] || [base]) {
      (data[tid] ||= {})[cls] = JSON.parse(JSON.stringify(entry));
      (ratio[tid] ||= {})[cls] = toSec(avgLap) / toSec(hot);
      // LMP2 spec → tek "oreca" aracı sınıf değerlerini kopyalar.
      if (cls === "lmp2") data[tid]["lmp2:oreca"] = { avgLap, hot };
    }
  }
  return { updated, ratio };
}

/* ---- 2) Araç-seviyesi (car% sekmeleri) ---- */
function parseCarLevel(rows, cls, data, ratio) {
  // Başlık satırı: col1 === "%"; pist adları col6'dan başlar (ilk = laptime bloğu).
  const head = rows.find((r) => String(r[1]).trim() === "%");
  if (!head) { log(`[lmu] UYARI ${cls} car%: başlık bulunamadı, atlandı`); return 0; }
  const colTrack = []; // {col, tid}
  for (let c = 6; c < head.length; c++) {
    const tid = VARIANT_TRACK[String(head[c]).trim()];
    if (tid && !colTrack.some((x) => x.tid === tid)) colTrack.push({ col: c, tid });
    if (String(head[c]).trim() === "Car") break; // laptime bloğu bitti
  }
  let n = 0;
  for (const r of rows) {
    if (r === head) continue;
    const id = carIdFor(cls, r[0]);
    if (!id) continue;
    for (const { col, tid } of colTrack) {
      const lap = String(r[col] || "").trim();
      if (!isTime(lap)) continue;
      const rt = ratio[tid]?.[cls];
      if (!rt) continue;
      const key = `${cls}:${id}`;
      for (const t of TRACK_ALIAS[tid] || [tid]) {
        (data[t] ||= {})[key] = { avgLap: scaleTime(lap, rt), hot: lap };
      }
      n++;
    }
  }
  return n;
}

async function main() {
  const data = {};
  log(`[lmu] fetch Laptimes (gid ${LAPTIMES_GID})`);
  const { updated, ratio } = parseClassLevel(await fetchCsv(LAPTIMES_GID), data);

  const trackCount = Object.keys(data).length;
  const classCount = Object.values(data).reduce((a, t) => a + Object.keys(t).filter((k) => !k.includes(":")).length, 0);
  if (!trackCount || !classCount) {
    throw new Error("Laptimes: 0 pist/sınıf üretildi — sheet düzeni değişmiş olabilir; dosyayı EZMİYORUM");
  }
  log(`[lmu] sınıf-seviyesi: ${trackCount} pist, ${classCount} sınıf-girdisi`);

  for (const { gid, cls } of CARPCT) {
    try {
      const n = parseCarLevel(await fetchCsv(gid), cls, data, ratio);
      log(`[lmu] ${cls} car% (gid ${gid}): ${n} araç×pist`);
    } catch (err) {
      log(`[lmu] UYARI ${cls} car% atlandı: ${err.message}`);
    }
  }

  const out = {
    source: "Ohne Speed's LMU laptimes spreadsheet",
    updated: updated || new Date().toISOString().slice(0, 10),
    note: "avgLap='Good ~1.02' temposu. tiers: alien(~100%)..c107. hot=hotlap (Class avgW; araçta kendi en iyi turu). data[pist]['sinif:arac'] araç özel. Otomatik üretildi: scripts/fetch-lmu-laptimes.mjs.",
    data,
  };
  writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
  log(`[lmu] yazıldı → ${OUT} (updated ${out.updated})`);
}

main().catch((err) => {
  log(`[lmu] HATA: ${err.message}`);
  process.exit(1);
});
