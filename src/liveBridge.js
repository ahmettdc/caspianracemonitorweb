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
  livePosAppend, livePosClear, liveSecAppend, liveSecClear,
  liveDrvAppend, liveDrvClear, liveTyreAppend, liveTyreClear,
  liveCondAppend, liveCondClear,
  liveWriterClaim, liveWriterRelease, liveWriterSubscribe, serverNow } from "./storage";
import { shouldClaim, bridgeWaitInfo } from "./liveWriter";

/* Saha boşken kartta gösterilecek mesaj — anahtar sidecar'ın _diag.wait alanından
   (bkz. liveWriter.bridgeWaitInfo). "noplugin" en kritik durum: Windows mmap eksik
   mapping'i sıfırlarla kendisi oluşturduğu için eklenti DLL'i kurulu/etkin değilken
   köprü "çalışıyor" görünüyordu ve eski tek mesaj sebebi söyleyemiyordu. */
const WAIT_MSG = {
  noplugin: "Eklenti verisi yok — rFactor2SharedMemoryMapPlugin64.dll kurulu ya da "
    + "etkin değil. CustomPluginVariables.JSON içinde ' Enabled': 1 olmalı.",
  menu: "Oyun açık, seans bekleniyor — pist/garaja girince veri başlar.",
  novehicles: "Seansta araç görünmüyor…",
  generic: "Oyun/seans bekleniyor…",
};
import { lapNumbersOf } from "./liveLaps";
import { rubberPct } from "./engine";

let child = null;          // çalışan sidecar süreci (Child)
let stopping = false;
let starting = false;      // spawn sürerken tekrar başlatmayı engelle (oto-yeniden dene)
let leaseCtx = null;       // { tid, rid, uid } — durdururken kirayı bırakmak için
let unsubLease = null;     // livewriter aboneliğini kaldıran fonksiyon

/* Köprüyü başlat. opts: { tid, rid, hz, mock, by }. onStatus(state) çağrılır:
   { running, phase: "starting|running|error|stopped", msg, lastTs, cars } */
export async function startBridge(opts, onStatus) {
  const { tid, rid, hz = 2, mock = false, by = "", uid = "" } = opts || {};
  const say = (s) => { try { if (onStatus) onStatus(s); } catch { /* yoksay */ } };

  if (!tid || !rid) { say({ running: false, phase: "error", msg: "Takım/yarış seçili değil" }); return; }
  if (child || starting) return;   // zaten çalışıyor/başlıyor (oto-yeniden deneme sessiz)

  stopping = false;
  starting = true;
  say({ running: true, phase: "starting", msg: "Köprü başlatılıyor…" });

  let Command;
  try {
    ({ Command } = await import("@tauri-apps/plugin-shell"));
  } catch (e) {
    starting = false;
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
  let inFlight = false;    // bir yazım sürüyor mu (olay-güdümlü flush'ta üst üste binmeyi önler)
  let cars = 0;
  const lastLap = {};      // lapKey → yazılmış en yüksek tur no (append idempotent)
  const lastPit = {};      // lapKey → son görülen pit durak sayısı (pit turu işareti)
  const lastDrv = {};      // lapKey → son yazılan pilot adı (yalnız DEĞİŞİNCE yazılır)
  const lastTyre = {};     // lapKey → son yazılan pit-lastik-değişimi turu (idempotent)
  let diag = null;         // gizli teşhis (shm/lmu/cars/ve) — arayüzde gösterilmez
  let diagSig = "";        // teşhis özeti (yalnız durum değişince konsola yaz)

  // tek-yazıcı seçimi: kirayı dinle (yalnız kira sahibi / aktif sürücü kareyi yazar)
  const electing = !!uid;
  let lease = null;
  leaseCtx = { tid, rid, uid };
  if (unsubLease) { try { unsubLease(); } catch { /* yoksay */ } unsubLease = null; }
  if (electing) unsubLease = liveWriterSubscribe(tid, rid, (v) => { lease = v; });

  /* Kareyi yazmadan önce tur geçmişini kalıcı livelaps düğümüne taşı:
     her satırın laps[]/lapsFrom'undan yeni turları (n > lastLap) topla, tek update
     ile yaz, satırdan laps/lapsFrom'u SİL (kare küçük kalsın; lapKey satırda kalır).
     Böylece 300+ turluk yarış tümüyle kapsanır ama canlı kare şişmez. */
  const harvestLaps = async (frame) => {
    const rows = Array.isArray(frame?.field) ? frame.field : [];
    const entries = {};      // livelaps: lapKey/n → süre
    const posEntries = {};   // livepos: lapKey/n → pozisyon (pit turu → negatif)
    const secEntries = {};   // livesec: lapKey/n → "s1,s2,s3" (yalnız en yeni tur)
    const drvEntries = {};   // livedrv: lapKey/n → pilot adı (yalnız DEĞİŞİM turunda)
    const tyreEntries = {};  // livetyre: lapKey/n → "{adet}|{hamur}" (yalnız pit turunda)
    const condEntries = {};  // livecond: lapKey/n → "temp,wet,grip" (yalnız en yeni tur)
    let clears = [];
    /* Pist koşulları KARE BAŞINA aynı (seans geneli): asfalt sıcaklığı + zemin ıslaklığı
       seans karesinden, yol tutuş (grip) sahadaki tüm araçların tur toplamından türer
       (Tutuş KPI'sıyla aynı model). Tur tamamlandığı anda maxN'e yazılır → o turun koşulu. */
    const sess = frame?.session || {};
    const totalLaps = rows.reduce((a, r) => a + (r.lapsDone || 0), 0);
    const cGrip = rubberPct(sess.sessionType, totalLaps);
    const cTemp = Number.isFinite(sess.trackTemp) ? Math.round(sess.trackTemp) : "";
    const cWet = Number.isFinite(sess.wetness) ? Math.round(sess.wetness) : "";
    const condStr = (cTemp !== "" || cWet !== "") ? `${cTemp},${cWet},${cGrip}` : null;
    for (const r of rows) {
      const key = r.lapKey;
      const laps = Array.isArray(r.laps) ? r.laps : null;
      /* GERÇEK tur numaraları köprüden (lapNums); eski köprüde lapsFrom+i'ye düşer.
         Ardışık varsaymak, log'da bir boşluk olduğunda tur kaymasına yol açıyordu. */
      const nums = lapNumbersOf(r);
      if (key && laps && laps.length && nums.length === laps.length) {
        const first = nums[0];
        const maxN = nums[nums.length - 1];
        // yeni seans: gelen turlar yazdığımızdan geride → geçmişi sıfırla
        if (lastLap[key] != null && first <= lastLap[key] && maxN < lastLap[key]) {
          clears.push(key); lastLap[key] = 0; lastPit[key] = r.pitStops || 0;
          delete lastDrv[key]; delete lastTyre[key];
        }
        const prev = lastLap[key] || 0;
        /* PİLOT: endurance'ta yarış içinde değişir; lapKey ARAÇ kimliği olduğu için
           tur geçmişi bölünmüyor ama turu kimin attığı kayboluyordu. Ad stint boyunca
           sabit → yalnız DEĞİŞTİĞİ turu yaz (araç başına ~10 kayıt), okuma tarafı
           ileri doldurur (liveLaps.driverAtLap). Değişim pit'te olduğu için yeni ad
           ilk kez yeni pilotun out-lap'inde görünür — doğru atıf. */
        const drv = typeof r.driver === "string" ? r.driver.trim() : "";
        const firstNew = nums.find((n, i) => n > prev && laps[i] > 0);
        if (drv && firstNew != null && lastDrv[key] !== drv) {
          drvEntries[`${key}/${firstNew}`] = drv;
          lastDrv[key] = drv;
        }
        /* PİT LASTİK DEĞİŞİMİ: köprü pit çıkışında tyreChange {n, comp, lap} üretir
           (lap = in-lap). Yalnız YENİ bir değişim turu geldiğinde bir kez yaz →
           "+" geçmişinde o turda "N× hamur ikonu" görünür. Hamur = duraktan sonraki
           mevcut hamur ("aldığımız hamur"). Telemetrisi olmayan rakipte tyreChange
           gelmez → o araçta işaret olmaz (kabul). */
        const tch = r.tyreChange;
        if (tch && Number.isFinite(tch.lap) && tch.lap > 0 && lastTyre[key] !== tch.lap) {
          const comp = typeof r.tyreComp === "string" ? r.tyreComp : "";
          tyreEntries[`${key}/${tch.lap}`] = `${tch.n ?? 0}|${comp}`;
          lastTyre[key] = tch.lap;
        }
        // bu turlarda pit atıldı mı (durak sayısı arttı mı)? → maxN turu pit işaretli
        const pits = r.pitStops || 0;
        const pitted = pits > (lastPit[key] ?? pits);
        for (let i = 0; i < laps.length; i++) {
          const n = nums[i];
          if (n > prev && laps[i] > 0) entries[`${key}/${n}`] = laps[i];
          if (n > prev && r.pos > 0) {   // pozisyon geçmişi (pit turu → negatif)
            posEntries[`${key}/${n}`] = (n === maxN && pitted) ? -r.pos : r.pos;
          }
        }
        // sektörler: en yeni tur (maxN) için satırın son-tur S1/S2/S3'ü
        const sc = r.lastSectors;
        if (maxN > prev && Array.isArray(sc) && sc[0] > 0 && sc[1] > 0 && sc[2] > 0) {
          secEntries[`${key}/${maxN}`] = `${sc[0]},${sc[1]},${sc[2]}`;
        }
        // pist koşulları: en yeni tur (maxN) için bu karenin asfalt/ıslaklık/tutuşu
        if (maxN > prev && condStr) condEntries[`${key}/${maxN}`] = condStr;
        if (maxN > (lastLap[key] || 0)) lastLap[key] = maxN;
        lastPit[key] = pits;
      }
      // canlı kareyi küçük tut — geçmiş ayrı düğümde
      delete r.laps; delete r.lapsFrom; delete r.lapNums; delete r.lastSectors;
      delete r.tyreChange;   // pit değişimi artık livetyre'de (tabloda gösterilmiyor)
    }
    /* own da aynı tur listesini taşır (Aggregator oyuncu satırından kopyalar) ama web
       onu kullanmaz — geçmiş livelaps'ten okunur. Kareden çıkar: her yazımda ~50 sayı
       boşuna gitmesin. */
    if (frame && frame.own) {
      delete frame.own.laps; delete frame.own.lapsFrom; delete frame.own.lapNums;
    }
    try {
      for (const k of clears) {
        await liveLapsClear(tid, rid, k); await livePosClear(tid, rid, k);
        await liveSecClear(tid, rid, k); await liveDrvClear(tid, rid, k);
        await liveTyreClear(tid, rid, k); await liveCondClear(tid, rid, k);
      }
      if (Object.keys(entries).length) await liveLapsAppend(tid, rid, entries);
      if (Object.keys(posEntries).length) await livePosAppend(tid, rid, posEntries);
      if (Object.keys(secEntries).length) await liveSecAppend(tid, rid, secEntries);
      if (Object.keys(drvEntries).length) await liveDrvAppend(tid, rid, drvEntries);
      if (Object.keys(tyreEntries).length) await liveTyreAppend(tid, rid, tyreEntries);
      if (Object.keys(condEntries).length) await liveCondAppend(tid, rid, condEntries);
    } catch (e) {
      say({ running: true, phase: "running", msg: "Geçmiş yazılamadı: " + (e?.message || e) });
    }
  };

  const flush = async () => {
    writeTimer = null;
    // inFlight: olay-güdümlü flush'ta (gizliyken doğrudan çağrılır) önceki yazım henüz
    // bitmemişse üst üste binme → pending korunur, yazım bitince finally yeniden tetikler.
    if (!pending || stopping || inFlight) return;
    const frame = pending; pending = null;
    // oyun kapalı / seans yok (0 araç) → Firebase'e boşuna yazma (kota + eski veri).
    // Mesaj artık NEDENE göre seçilir (eklenti yok / menü / araç yok); diag da
    // geçilir — eskiden tam takılı kalınan bu durumda tooltip teşhisi kayboluyordu.
    if (!Array.isArray(frame.field) || frame.field.length === 0) {
      const w = bridgeWaitInfo(diag);
      say({ running: true, phase: w.warn ? "error" : "running", msg: WAIT_MSG[w.key], diag });
      return;
    }
    inFlight = true;
    lastWrite = Date.now();
    try {
      // tek-yazıcı seçimi: yalnız kira sahibi / aktif sürücü yazar (iki köprü çakışmasın).
      // Karar mantığı saf fonksiyonda (liveWriter.shouldClaim) → birim testlerle kilitli.
      if (electing) {
        const driving = !!(frame.own && frame.own.driving);
        if (!shouldClaim(lease, uid, driving, serverNow())) {
          say({ running: true, phase: "standby", msg: "Beklemede", writerBy: lease?.by || "", cars, diag });
          return;
        }
        const hold = await liveWriterClaim(tid, rid, { uid, by, driving });
        if (!hold) {
          say({ running: true, phase: "standby", msg: "Beklemede", writerBy: lease?.by || "", cars, diag });
          return;
        }
      }
      await harvestLaps(frame);   // laps'i livelaps'e taşı + kareden çıkar
      /* ts SERVER-hizalı olmalı: izleyen taraf tazeliği kendi saatiyle ölçüyor;
         yazan PC'nin saati kayıksa veri akarken bile "bağlantı koptu" görünüyordu. */
      await liveTimingSet(tid, rid, { ts: serverNow(), by, ...frame });
      say({ running: true, phase: "running", msg: "Gönderiliyor", lastTs: lastWrite, cars, writerBy: by, diag });
    } catch (e) {
      say({ running: true, phase: "error", msg: "Firebase yazma hatası: " + (e?.message || e) });
    } finally {
      inFlight = false;
      // yazım sürerken yeni kare geldiyse onu da gönder (son kareyi geç bırakma)
      if (pending && !stopping && !writeTimer) writeTimer = setTimeout(flush, 0);
    }
  };

  const onFrame = (frame) => {
    if (frame && frame.error) {
      say({ running: true, phase: "error", msg: "Okuma: " + frame.error });
      return;
    }
    // gizli teşhis: kareden _diag'ı al, Firebase'e gitmesin diye SİL. Arayüzde
    // gösterilmez; yalnız durum değişince (oyun/REST açıldı-kapandı) konsola yazılır
    // ve durum objesine eklenir (LiveTab'de dot'un title tooltip'inde erişilebilir).
    if (frame && frame._diag) {
      diag = frame._diag;
      delete frame._diag;
      const sig = `${!!diag.shm}|${!!diag.lmu}|${(diag.cars || 0) > 0}`;
      if (sig !== diagSig) {
        diagSig = sig;
        try {
          console.info(`[köprü] paylaşımlı-bellek=${diag.shm ? "✓" : "✗"} · araç=${diag.cars ?? 0}`
            + ` · LMU-REST=${diag.lmu ? "✓" : "✗"} · VE-alan=${diag.ve ?? 0}`);
        } catch { /* yoksay */ }
      }
    }
    cars = Array.isArray(frame?.field) ? frame.field.length : 0;
    pending = frame;
    // en fazla ~2.5 Hz yaz (kota dostu); gelen kare hızından bağımsız throttle.
    // wait===0 iken flush DOĞRUDAN (setTimeout değil) çağrılır → pencere gizli/arka
    // planda iken Chromium'un timer kısması yazımı ~1 Hz'e düşürmez; sidecar hızında
    // (~2 Hz) akmaya devam eder. Sürücü bakmasa da mühendis başka PC'de akıcı görür.
    const wait = Math.max(0, 400 - (Date.now() - lastWrite));
    if (wait === 0) {
      if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
      flush();
    } else if (!writeTimer) {
      writeTimer = setTimeout(flush, wait);
    }
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
    if (unsubLease) { try { unsubLease(); } catch { /* yoksay */ } unsubLease = null; }
    if (electing && uid) liveWriterRelease(tid, rid, uid);   // kirayı bırak → devir hızlı
    say({ running: false, phase: "stopped",
      msg: stopping ? "Durduruldu" : `Köprü kapandı (kod ${data?.code ?? "?"})` });
  });

  try {
    child = await cmd.spawn();
    starting = false;
    say({ running: true, phase: "running", msg: "Köprü çalışıyor", cars });
  } catch (e) {
    starting = false;
    child = null;
    say({ running: false, phase: "error", msg: "Sidecar başlatılamadı: " + (e?.message || e) });
  }
}

/* Köprüyü durdur — sidecar sürecini öldür. */
export async function stopBridge(onStatus) {
  stopping = true;
  const c = child;
  child = null;
  if (unsubLease) { try { unsubLease(); } catch { /* yoksay */ } unsubLease = null; }
  if (leaseCtx?.uid) { liveWriterRelease(leaseCtx.tid, leaseCtx.rid, leaseCtx.uid); leaseCtx = null; }
  if (c) {
    try { await c.kill(); } catch { /* zaten kapanmış olabilir */ }
  }
  try { if (onStatus) onStatus({ running: false, phase: "stopped", msg: "Durduruldu" }); } catch { /* yoksay */ }
}

export function bridgeRunning() {
  return !!child;
}
