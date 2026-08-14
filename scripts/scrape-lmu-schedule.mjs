#!/usr/bin/env node
/* ============================================================
   scrape-lmu-schedule — lmugarage.com resmi LMU yarış takvimini çeker
   ------------------------------------------------------------
   Zamanlanmış GitHub Action (.github/workflows/lmu-schedule.yml) tarafından
   çalıştırılır. Herkese açık sayfaları (robots.txt: Allow:/) indirir, src/lmuParse.js
   ile yapısal JSON'a çevirir ve bir dosyaya yazar; Action sonra
   `firebase-tools database:set /lmuSchedule` ile RTDB'ye basar.

   ÜÇ KAYNAK:
     /racing-today  → daily/weekly (bugünkü .run-row listesi) — ZORUNLU (birincil)
     /special       → özel etkinlikler (article.race-card)     — best-effort
     /championships → şampiyonalar (article.race-card.champ-card) — best-effort
   id ile dedupe (racing-today önce; yarış süresi bilgisi onda).

   Nazik davranış: sayfa başına tek istek (cron 15 dk; cache-control 60s).
   GÜVENLİK: racing-today boş/başarısızsa non-zero exit → DOSYA YAZILMAZ, RTDB'deki
   son iyi kopya korunur. /special + /championships hatası UYARIDIR, akışı durdurmaz.

   Kullanım: node scripts/scrape-lmu-schedule.mjs [cikti.json]
   ============================================================ */
import { writeFileSync } from "node:fs";
import { parseRacingToday, parseCardsPage, parseRaceWeekend, parseTyreSets } from "../src/lmuParse.js";

const BASE = "https://lmugarage.com";
const OUT = process.argv[2] || "lmu-schedule.json";
const log = (...a) => process.stderr.write(a.join(" ") + "\n");

async function fetchHtml(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      // Kaynağa saygılı, kendini tanıtan UA (proje linkiyle).
      "User-Agent":
        "CaspianRaceMonitor/1.0 (+https://github.com/ahmettdc/caspianracemonitorweb) schedule-sync",
      Accept: "text/html",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.text();
}

async function main() {
  // 1) Birincil: racing-today (daily/weekly). Boşsa tüm çalışma başarısız (ezme yok).
  log(`[lmu] fetch /racing-today`);
  const today = parseRacingToday(await fetchHtml("/racing-today"));
  if (!today.races.length) {
    throw new Error("racing-today: 0 races — layout değişmiş olabilir; RTDB'yi ezmiyorum");
  }

  // 2) Ek kaynaklar: özel etkinlikler + şampiyonalar (best-effort).
  const extra = [];
  for (const [path, kind] of [["/special", "special"], ["/championships", "championship"]]) {
    try {
      const out = parseCardsPage(await fetchHtml(path), kind);
      log(`[lmu] ${path}: ${out.races.length} ${kind}`);
      extra.push(...out.races);
    } catch (err) {
      log(`[lmu] UYARI ${path} atlandı: ${err.message}`);
    }
  }

  // id ile dedupe — racing-today önceliklidir (yarış süresi bilgisini o taşır).
  const byId = new Map();
  for (const r of [...today.races, ...extra]) {
    if (!byId.has(r.id)) byId.set(r.id, r);
  }
  const races = [...byId.values()];

  // 3) Detay sayfalarından seans kırılımı (Qualifying süresi + eksik Race süresi).
  //    Liste sayfaları sıralama süresini VERMEZ; her yarışın kendi detay sayfasında
  //    "Race weekend" paneli var. Yalnız GELECEK/CANLI yarışlar zenginleştirilir
  //    (preset bunlar için; geçmiş yarışlara gerek yok → yük sınırlı). Her fetch
  //    try/catch (başarısız → qualSec yok, form tahmine düşer). Nazik: ~150 ms ara.
  const nowMs = Date.now();
  const need = races.filter((r) => r.url
    && (r.startMs == null || r.startMs > nowMs - 3 * 3600e3)).slice(0, 80);
  let enriched = 0;
  for (const r of need) {
    try {
      const path = r.url.replace(/^https?:\/\/[^/]+/, "");
      const detail = await fetchHtml(path);
      const w = parseRaceWeekend(detail);
      const ts = parseTyreSets(detail);
      if (w.qualSec != null) r.qualSec = w.qualSec;
      if (r.lenSec == null && w.raceSec != null) r.lenSec = w.raceSec;   // special/champ süresini doldur
      if (ts != null) r.tyreSets = ts;                                   // lastik seti sınırı
      if (w.qualSec != null || w.raceSec != null || ts != null) enriched++;
    } catch (err) {
      log(`[lmu] UYARI detay atlandı ${r.id}: ${err.message}`);
    }
    await new Promise((res) => setTimeout(res, 150));
  }
  log(`[lmu] detay zenginleştirme: ${enriched}/${need.length} (qualSec/raceSec)`);

  const payload = {
    updatedAt: Date.now(),
    source: "lmugarage.com",
    sourceUrl: BASE,
    count: races.length,
    races,
  };
  writeFileSync(OUT, JSON.stringify(payload, null, 2));
  const kinds = races.reduce((m, r) => ((m[r.kind] = (m[r.kind] || 0) + 1), m), {});
  log(`[lmu] ${races.length} races → ${OUT} ${JSON.stringify(kinds)}`);
}

main().catch((err) => {
  log(`[lmu] HATA: ${err.message}`);
  process.exit(1);
});
