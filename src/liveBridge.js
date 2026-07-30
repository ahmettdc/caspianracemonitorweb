/* ============================================================
   CANLI KÖPRÜ — masaüstü (Tauri) sidecar sürücüsü
   ------------------------------------------------------------
   Oyunun çalıştığı PC'de bu masaüstü uygulaması, paketlenmiş Python köprüsünü
   (`caspian-bridge` sidecar) `--emit` modunda çalıştırır. Sidecar yalnız
   rFactor2/LMU paylaşımlı belleğini OKUR ve her kareyi stdout'a bir JSON satırı
   ({session, own, field}) olarak basar — Firebase'e DOKUNMAZ.

   Buradaki JS, satırları okuyup `ts`/`by` ekler ve `liveTimingSet` ile
   teams/{tid}/live/{rid} düğümüne yazar — KULLANICININ giriş yapmış Firebase
   oturumuyla. Böylece bot hesabı / bridgeBots gerekmez (kural: takım owner/editor
   zaten yazabilir). Web/pit-wall Canlı sekmesi bu düğümü salt-okunur dinler.

   Yalnız Tauri kabuğunda anlamlıdır; `@tauri-apps/plugin-shell` dinamik import
   edilir (web derlemesi bu modülü yüklese de sidecar'ı hiç çalıştırmaz).
   ============================================================ */
import { liveTimingSet, liveLapsAppend, liveLapsClear,
  livePosAppend, livePosClear } from "./storage";

let child = null;          // çalışan sidecar süreci (Child)
let stopping = false;

/* Köprüyü başlat. opts: { tid, rid, hz, mock, by }. onStatus(state) çağrılır:
   { running, phase: "starting|running|error|stopped", msg, lastTs, cars } */
export async function startBridge(opts, onStatus) {
  const { tid, rid, hz = 2, mock = false, by = "" } = opts || {};
  const say = (s) => { try { if (onStatus) onStatus(s); } catch { /* yoksay */ } };

  if (!tid || !rid) { say({ running: false, phase: "error", msg: "Takım/yarış seçili değil" }); return; }
  if (child) { say({ running: true, phase: "running", msg: "Zaten çalışıyor" }); return; }

  stopping = false;
  say({ running: true, phase: "starting", msg: "Köprü başlatılıyor…" });

  let Command;
  try {
    ({ Command } = await import("@tauri-apps/plugin-shell"));
  } catch (e) {
    say({ running: false, phase: "error", msg: "Sidecar kabuğu yüklenemedi: " + (e?.message || e) });
    return;
  }

  const args = ["--emit", "--hz", String(hz)];
  if (mock) args.push("--mock");

  const cmd = Command.sidecar("binaries/caspian-bridge", args);

  // stdout satırlarını tampondan ayır (bir "data" birden çok/parça satır olabilir)
  let buf = "";
  let lastWrite = 0;
  let pending = null;      // en son çözülen kare (throttle penceresinde)
  let writeTimer = null;
  let cars = 0;
  const lastLap = {};      // lapKey → yazılmış en yüksek tur no (append idempotent)
  const lastPit = {};      // lapKey → son görülen pit durak sayısı (pit turu işareti)

  /* Kareyi yazmadan önce tur geçmişini kalıcı livelaps düğümüne taşı:
     her satırın laps[]/lapsFrom'undan yeni turları (n > lastLap) topla, tek update
     ile yaz, satırdan laps/lapsFrom'u SİL (kare küçük kalsın; lapKey satırda kalır).
     Böylece 300+ turluk yarış tümüyle kapsanır ama canlı kare şişmez. */
  const harvestLaps = async (frame) => {
    const rows = Array.isArray(frame?.field) ? frame.field : [];
    const entries = {};      // livelaps: lapKey/n → süre
    const posEntries = {};   // livepos: lapKey/n → pozisyon (pit turu → negatif)
    let clears = [];
    for (const r of rows) {
      const key = r.lapKey;
      const laps = Array.isArray(r.laps) ? r.laps : null;
      const from = r.lapsFrom;
      if (key && laps && laps.length && from > 0) {
        // yeni seans: gelen ilk tur no, yazdığımızdan küçük/eşit → geçmişi sıfırla
        if (lastLap[key] != null && from <= lastLap[key]
            && (from + laps.length - 1) < lastLap[key]) {
          clears.push(key); lastLap[key] = 0; lastPit[key] = r.pitStops || 0;
        }
        const prev = lastLap[key] || 0;
        const maxN = from + laps.length - 1;
        // bu turlarda pit atıldı mı (durak sayısı arttı mı)? → maxN turu pit işaretli
        const pits = r.pitStops || 0;
        const pitted = pits > (lastPit[key] ?? pits);
        for (let i = 0; i < laps.length; i++) {
          const n = from + i;
          if (n > prev && laps[i] > 0) entries[`${key}/${n}`] = laps[i];
          if (n > prev && r.pos > 0) {   // pozisyon geçmişi (pit turu → negatif)
            posEntries[`${key}/${n}`] = (n === maxN && pitted) ? -r.pos : r.pos;
          }
        }
        if (maxN > (lastLap[key] || 0)) lastLap[key] = maxN;
        lastPit[key] = pits;
      }
      // canlı kareyi küçük tut — geçmiş ayrı düğümde
      delete r.laps; delete r.lapsFrom;
    }
    try {
      for (const k of clears) { await liveLapsClear(tid, rid, k); await livePosClear(tid, rid, k); }
      if (Object.keys(entries).length) await liveLapsAppend(tid, rid, entries);
      if (Object.keys(posEntries).length) await livePosAppend(tid, rid, posEntries);
    } catch (e) {
      say({ running: true, phase: "running", msg: "Geçmiş yazılamadı: " + (e?.message || e) });
    }
  };

  const flush = async () => {
    writeTimer = null;
    if (!pending || stopping) return;
    const frame = pending; pending = null;
    lastWrite = Date.now();
    try {
      await harvestLaps(frame);   // laps'i livelaps'e taşı + kareden çıkar
      await liveTimingSet(tid, rid, { ts: Date.now(), by, ...frame });
      say({ running: true, phase: "running", msg: "Gönderiliyor", lastTs: lastWrite, cars });
    } catch (e) {
      say({ running: true, phase: "error", msg: "Firebase yazma hatası: " + (e?.message || e) });
    }
  };

  const onFrame = (frame) => {
    if (frame && frame.error) {
      say({ running: true, phase: "error", msg: "Okuma: " + frame.error });
      return;
    }
    cars = Array.isArray(frame?.field) ? frame.field.length : 0;
    pending = frame;
    // en fazla ~2.5 Hz yaz (kota dostu); gelen kare hızından bağımsız throttle
    const wait = Math.max(0, 400 - (Date.now() - lastWrite));
    if (!writeTimer) writeTimer = setTimeout(flush, wait);
  };

  cmd.stdout.on("data", (line) => {
    buf += line;
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const s = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!s) continue;
      try { onFrame(JSON.parse(s)); }
      catch { /* JSON olmayan satır (bilgi/uyarı) — atla */ }
    }
  });
  cmd.stderr.on("data", (line) => {
    const s = String(line).trim();
    if (s) say({ running: true, phase: "running", msg: s });   // bilgi satırı
  });
  cmd.on("error", (e) => {
    say({ running: false, phase: "error", msg: "Sidecar hatası: " + (e?.message || e) });
    child = null;
  });
  cmd.on("close", (data) => {
    if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
    child = null;
    say({ running: false, phase: "stopped",
      msg: stopping ? "Durduruldu" : `Köprü kapandı (kod ${data?.code ?? "?"})` });
  });

  try {
    child = await cmd.spawn();
    say({ running: true, phase: "running", msg: "Köprü çalışıyor", cars });
  } catch (e) {
    child = null;
    say({ running: false, phase: "error", msg: "Sidecar başlatılamadı: " + (e?.message || e) });
  }
}

/* Köprüyü durdur — sidecar sürecini öldür. */
export async function stopBridge(onStatus) {
  stopping = true;
  const c = child;
  child = null;
  if (c) {
    try { await c.kill(); } catch { /* zaten kapanmış olabilir */ }
  }
  try { if (onStatus) onStatus({ running: false, phase: "stopped", msg: "Durduruldu" }); } catch { /* yoksay */ }
}

export function bridgeRunning() {
  return !!child;
}
