#!/usr/bin/env node
/* ============================================================
   scrape-lmu-schedule — lmugarage.com resmi LMU yarış takvimini çeker
   ------------------------------------------------------------
   Zamanlanmış GitHub Action (.github/workflows/lmu-schedule.yml) tarafından
   çalıştırılır. Herkese açık "/racing-today" fragmanını (robots.txt: Allow:/)
   indirir, src/lmuParse.js ile yapısal JSON'a çevirir ve bir dosyaya yazar;
   Action sonra `firebase-tools database:set /lmuSchedule` ile RTDB'ye basar.

   Nazik davranış: tek istek/çalışma (cron 15 dk; sayfanın cache-control'ü 60s).
   GÜVENLİK: yarış çıkmazsa (parse başarısız / ağ hatası) non-zero exit ile çıkar
   ve DOSYAYI YAZMAZ → Action adımı düşer, RTDB'deki son iyi kopya korunur.

   Kullanım: node scripts/scrape-lmu-schedule.mjs [cikti.json]
   ============================================================ */
import { writeFileSync } from "node:fs";
import { parseRacingToday } from "../src/lmuParse.js";

const SRC = "https://lmugarage.com/racing-today";
const OUT = process.argv[2] || "lmu-schedule.json";
const log = (...a) => process.stderr.write(a.join(" ") + "\n");

async function main() {
  log(`[lmu] fetch ${SRC}`);
  const res = await fetch(SRC, {
    headers: {
      // Kaynağa saygılı, kendini tanıtan UA (proje linkiyle).
      "User-Agent":
        "CaspianRaceMonitor/1.0 (+https://github.com/ahmettdc/caspianracemonitorweb) schedule-sync",
      Accept: "text/html",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

  const html = await res.text();
  const parsed = parseRacingToday(html);
  if (!parsed.races.length) {
    throw new Error("0 races parsed — layout değişmiş olabilir; RTDB'yi ezmiyorum");
  }

  const payload = {
    updatedAt: Date.now(),
    source: parsed.source,
    sourceUrl: "https://lmugarage.com",
    count: parsed.races.length,
    races: parsed.races,
  };
  writeFileSync(OUT, JSON.stringify(payload, null, 2));
  log(`[lmu] ${parsed.races.length} races → ${OUT}`);
}

main().catch((err) => {
  log(`[lmu] HATA: ${err.message}`);
  process.exit(1);
});
