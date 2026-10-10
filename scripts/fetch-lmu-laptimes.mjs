#!/usr/bin/env node
/* ============================================================
   fetch-lmu-laptimes — lmuportal.com GERÇEK leaderboard turlarından güncel
   referans tur zamanlarını çeker → public/assets/lmu-data.json üretir.
   ------------------------------------------------------------
   Bu JSON, Dashboard'daki araç kutusuna (DashTab "🏎 Araç" kartı) tıklayınca
   açılan pencerede gösterilen tabloyu besler. App.jsx onu fetch(`${ASSET}lmu-data.json`)
   ile okur; strateji sekmesi de pist×sınıf avgLap tohumunu buradan alır
   (src/stratComp.js trackDefaults).

   KAYNAK DEĞİŞİKLİĞİ: eski "Ohne Speed" Google Sheet'in (küratörlü tempo merdiveni:
   alien/%101…%107, modellenmiş) yerine lmuportal'ın herkese açık Supabase/PostgREST
   API'si — GERÇEK kayıtlı turlar (sürücü leaderboard'u: tur, sektör, compound, DR/SR).
   Dönüşüm mantığı SAF modülde: src/lmuLaptimes.js (bağımsız + testli).

   API: db.lmuportal.space (Supabase). Anon JWT İSTEMCİDE HERKESE AÇIK gömülüdür
   (RLS ile korunur) — gizli değildir, bu yüzden burada sabit. Tek tablo yeter:
     race_series_leaderboard_current  (+ embed race_series(track_friendly))
   Yalnız metadata.class DOLU satırlar sınıf-board'udur (sektör/compound onlarda);
   class=null satırlar çok-sınıflı birleşik board → mapClassId("")="" ile elenir.

   §1 (veri dürüstlüğü): araç alanı TAKIM/LIVERY adıdır ("Garage 59 #10"); çoğu
   üreticiyi belli etmez → AYNEN taşınır, uygulamanın araç id'sine ZORLANMAZ
   (bkz. lmuLaptimes.js carModelId). avgLap = P1×1.02 MODELLENMİŞ (etiketli).

   GÜVENLİK: hiç pist/sınıf üretilemezse non-zero exit → DOSYA YAZILMAZ, repodaki
   son iyi kopya korunur (scrape-lmu-schedule.mjs ile aynı ilke).

   Kullanım: node scripts/fetch-lmu-laptimes.mjs [cikti.json]
   ============================================================ */
import { writeFileSync } from "node:fs";
import { buildLaptimes, mergeLaptimes, applyTrackAliases } from "../src/lmuLaptimes.js";

const API = "https://db.lmuportal.space/rest/v1";
// Herkese açık anon JWT (istemci bundle'ında da aynısı; RLS korumalı — gizli değil).
const ANON =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3Njg3MDc4MCwiZXhwIjo0OTMyNTQ0MzgwLCJyb2xlIjoiYW5vbiJ9.aE59DqdkNMhjsD82MmAc2AYnwp2KENVjzoHTyWmUx3Y";
const OUT = process.argv[2] || "public/assets/lmu-data.json";
const log = (...a) => process.stderr.write(a.join(" ") + "\n");

const PAGE = 1000; // PostgREST varsayılan sayfa sınırı

async function fetchJson(path) {
  const res = await fetch(`${API}/${path}`, {
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      Accept: "application/json",
      "User-Agent":
        "CaspianRaceMonitor/1.0 (+https://github.com/ahmettdc/caspianracemonitorweb) laptimes-sync",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.json();
}

const fetchPage = (offset) => fetchJson(
  `race_series_leaderboard_current`
  + `?select=score_ms,metadata,display_initials,race_series(track_friendly)`
  + `&order=score_ms.asc&limit=${PAGE}&offset=${offset}`);

/* Ham leaderboard satırı → buildLaptimes girdisi. metadata.class yoksa classRaw
   boş → elenir (çok-sınıflı birleşik board; sektör/compound yalnız sınıf-board'unda). */
function flattenRow(row) {
  const m = row.metadata || {};
  return {
    trackLabel: row.race_series?.track_friendly || "",
    classRaw: m.class || "",
    scoreMs: row.score_ms,
    car: m.car || "",
    initials: row.display_initials || "",
    sectors: Array.isArray(m.sectors) ? m.sectors : null,
    compound: Array.isArray(m.compound) ? m.compound : null,
    drRank: m.dr?.rank || null,
    srRank: m.sr?.rank || null,
  };
}

/* race_series.fastest_laps.by_class → girdi listesi (sınıf P1'leri, GENİŞ pist
   kapsamı için fallback). Her seride sınıf başına TEK P1; aynı pist×sınıf birden
   çok seride geçerse buildLaptimes en hızlısını alır. Sektör/compound yok. */
function fastestLapsEntries(series) {
  const out = [];
  for (const s of series) {
    const byClass = s.fastest_laps?.by_class || {};
    for (const c of Object.values(byClass)) {
      out.push({
        trackLabel: s.track_friendly || "",
        classRaw: c.top_class || "",
        scoreMs: c.top_score_ms,
        car: c.top_car || "",
        initials: c.initials || "",
        sectors: null,
        compound: null,
        drRank: c.top_dr_rank || null,
        srRank: c.top_sr_rank || null,
      });
    }
  }
  return out;
}

async function main() {
  // 1) Canlı leaderboard (rotasyondaki pistler — zengin: sektör/compound, top-N).
  const rows = [];
  for (let off = 0; ; off += PAGE) {
    log(`[lmu] fetch leaderboard offset=${off}`);
    const page = await fetchPage(off);
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  log(`[lmu] ${rows.length} leaderboard satırı`);
  const live = buildLaptimes(rows.map(flattenRow));

  // 2) fastest_laps fallback (tüm seriler — geniş pist kapsamı, sınıf P1).
  const series = await fetchJson("race_series?select=track_friendly,fastest_laps");
  const broad = buildLaptimes(fastestLapsEntries(series));
  log(`[lmu] fastest_laps: ${series.length} seri → fallback pistler ${Object.keys(broad).length}`);

  const data = applyTrackAliases(mergeLaptimes(live, broad));

  const trackCount = Object.keys(data).length;
  const classCount = Object.values(data).reduce((a, t) => a + Object.keys(t).length, 0);
  if (!trackCount || !classCount) {
    throw new Error("0 pist/sınıf üretildi — API/şema değişmiş olabilir; dosyayı EZMİYORUM");
  }

  const out = {
    source: "lmuportal.com",
    sourceUrl: "https://lmuportal.com/lap-times",
    updated: new Date().toISOString().slice(0, 10),
    updatedAt: Date.now(),
    note: "lmuportal.com GERÇEK leaderboard turları. hot=sınıf P1 (gerçek en hızlı tur). "
      + "avgLap=P1×1.02 yarış-temposu TAHMİNİ (modellenmiş, gerçek okuma değil). "
      + "top[]=gerçek kayıtlar; car=takım/livery adı (aynen; §1: üreticiye zorlanmaz). "
      + "Otomatik üretildi: scripts/fetch-lmu-laptimes.mjs.",
    data,
  };
  writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
  log(`[lmu] yazıldı → ${OUT}: ${trackCount} pist, ${classCount} sınıf-girdisi (updated ${out.updated})`);
}

main().catch((err) => {
  log(`[lmu] HATA: ${err.message}`);
  process.exit(1);
});
