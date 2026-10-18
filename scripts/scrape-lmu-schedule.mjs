#!/usr/bin/env node
/* ============================================================
   scrape-lmu-schedule — lmuportal.com resmi LMU yarış takvimini çeker
   ------------------------------------------------------------
   Zamanlanmış GitHub Action (.github/workflows/lmu-schedule.yml) tarafından
   çalıştırılır. lmuportal'ın herkese açık Supabase/PostgREST API'sinden canlı +
   yaklaşan yarışları çeker, src/lmuScheduleMap.js ile /lmuSchedule yapısına çevirir
   ve bir dosyaya yazar; Action sonra `firebase-tools database:set /lmuSchedule`
   ile RTDB'ye basar. Web uygulaması bunu onValue ile okur (Resmi Yarışlar sekmesi).

   KAYNAK DEĞİŞİKLİĞİ: eski lmugarage.com HTML kazıması (çalışmıyordu → sayfa boştu)
   yerine lmuportal.com. İki tablo:
     race_event (+ race_series)         → daily / weekly / special
     championship_event (+ series)      → championship (pist round_name'den)
   Yalnız CANLI + YAKLAŞAN (race_ends_at >= now) çekilir; durum client-side hesaplanır.

   API: db.lmuportal.space (Supabase). Anon JWT İSTEMCİDE HERKESE AÇIK (RLS korumalı)
   — gizli değildir. Dönüşüm mantığı SAF modülde: src/lmuScheduleMap.js (testli).

   GÜVENLİK: hiç yarış üretilemezse non-zero exit → DOSYA YAZILMAZ, RTDB'deki son
   iyi kopya korunur (eski davranışla aynı ilke). championship hatası UYARIDIR.

   Kullanım: node scripts/scrape-lmu-schedule.mjs [cikti.json]
   ============================================================ */
import { writeFileSync } from "node:fs";
import { buildSchedule } from "../src/lmuScheduleMap.js";

const API = "https://db.lmuportal.space/rest/v1";
// Herkese açık anon JWT (istemci bundle'ında da aynısı; RLS korumalı — gizli değil).
const ANON =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3Njg3MDc4MCwiZXhwIjo0OTMyNTQ0MzgwLCJyb2xlIjoiYW5vbiJ9.aE59DqdkNMhjsD82MmAc2AYnwp2KENVjzoHTyWmUx3Y";
const OUT = process.argv[2] || "lmu-schedule.json";
const log = (...a) => process.stderr.write(a.join(" ") + "\n");

async function fetchJson(path) {
  const res = await fetch(`${API}/${path}`, {
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      Accept: "application/json",
      "User-Agent":
        "CaspianRaceMonitor/1.0 (+https://github.com/ahmettdc/caspianracemonitorweb) schedule-sync",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.json();
}

async function main() {
  const nowIso = new Date().toISOString();

  // 1) Birincil: daily/weekly/special (race_event + race_series). Boşsa tüm çalışma
  //    başarısız (RTDB'yi ezme yok).
  const evSel = "event_id,race_starts_at,race_ends_at,series_name,race_series("
    + "type,track_friendly,car_classes,sr_requirement,setup,"
    + "race_duration_minutes,qualifying_duration_minutes,practice_duration_minutes,"
    + "tyre_allowance,fuel_multiplier)";
  log(`[lmu] fetch race_event (live+upcoming)`);
  const events = await fetchJson(
    `race_event?select=${evSel}&race_ends_at=gte.${nowIso}&order=race_starts_at.asc&limit=400`);

  // 2) Ek kaynak: championship (best-effort — hata akışı durdurmaz).
  let champEvents = [];
  try {
    const chSel = "event_id,race_starts_at,race_ends_at,round_name,championship_series("
      + "type,series_name,car_classes,sr_requirement,setup,"
      + "race_duration_minutes,qualifying_duration_minutes,practice_duration_minutes,"
      + "tyres_available,fuel_multiplier)";
    champEvents = await fetchJson(
      `championship_event?select=${chSel}&race_ends_at=gte.${nowIso}&order=race_starts_at.asc&limit=200`);
    log(`[lmu] championship_event: ${champEvents.length}`);
  } catch (err) {
    log(`[lmu] UYARI championship atlandı: ${err.message}`);
  }

  const races = buildSchedule({ events, champEvents });
  if (!races.length) {
    throw new Error("0 yarış üretildi — API/şema değişmiş olabilir; RTDB'yi ezmiyorum");
  }

  const payload = {
    updatedAt: Date.now(),
    source: "lmuportal.com",
    sourceUrl: "https://lmuportal.com/upcoming",
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
