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
  liveCondAppend, liveCondClear, liveWearAppend, liveWearClear,
  liveSessionIdGet, liveHistoryClearAll,
  liveWriterClaim, liveWriterRelease, liveWriterSubscribe,
  liveTimingSubscribe, serverNow } from "./storage";
import { shouldClaim, shouldYield, bridgeWaitInfo } from "./liveWriter";

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
/* ÇALIŞTIRMA JETONU (v2.4.1). startBridge iki `await` içerir (dinamik import +
   liveSessionIdGet). Bu pencerede stopBridge gelirse eskiden `starting` hiç
   sıfırlanmıyor, `stopping` true kalıyordu: askıdaki çağrı devam edip sidecar'ı
   YİNE DE spawn ediyor, ama flush her karede `stopping` yüzünden erken dönüyordu
   → oyun PC'sinde paylaşımlı bellek okuyan bir süreç çalışıyor, arayüz
   "çalışıyor" diyor, Firebase'e TEK KARE gitmiyordu ("zombi köprü"). Üstelik
   bridgeRunning() true olduğu için 4 sn'lik oto-yeniden deneme onu asla
   canlandırmıyordu.
   Ayrıca eski sürecin `close` olayı, sahiplik kontrolü olmadığı için YENİ
   köprünün aboneliklerini ve kirasını siliyordu (v1.8.8'de düzeltilen iki-yazıcı
   yanıp sönmesi geri geliyordu). Her çalıştırma kendi jetonunu taşır; jeton
   güncel değilse hiçbir paylaşılan duruma dokunulmaz. */
let runSeq = 0;
let leaseCtx = null;       // { tid, rid, uid } — durdururken kirayı bırakmak için
let unsubLease = null;     // livewriter aboneliğini kaldıran fonksiyon
let unsubRemote = null;    // canlı kare aboneliği (başka yazıcıya boyun eğme — shouldYield)

/* Köprüyü başlat. opts: { tid, rid, hz, mock, by }. onStatus(state) çağrılır:
   { running, phase: "starting|running|error|stopped", msg, cars } */
export async function startBridge(opts, onStatus) {
  const { tid, rid, hz = 2, mock = false, by = "", uid = "", noRest = false } = opts || {};
  const say = (s) => { try { if (onStatus) onStatus(s); } catch { /* yoksay */ } };

  if (!tid || !rid) { say({ running: false, phase: "error", msg: "Takım/yarış seçili değil" }); return; }
  if (child || starting) return;   // zaten çalışıyor/başlıyor (oto-yeniden deneme sessiz)

  stopping = false;
  starting = true;
  const myRun = ++runSeq;          // bu çalıştırmanın jetonu
  /* Bu çalıştırma hâlâ güncel mi? Değilse araya stopBridge (ya da yeni bir
     startBridge) girmiştir; askıda kalan iş paylaşılan duruma DOKUNMAMALI. */
  const mine = () => myRun === runSeq;
  say({ running: true, phase: "starting", msg: "Köprü başlatılıyor…" });

  let Command;
  try {
    ({ Command } = await import("@tauri-apps/plugin-shell"));
  } catch (e) {
    if (mine()) starting = false;
    say({ running: false, phase: "error", msg: "Sidecar kabuğu yüklenemedi: " + (e?.message || e) });
    return;
  }
  if (!mine()) return;             // import beklerken durduruldu → sidecar'ı HİÇ doğurma

  const args = ["--emit", "--hz", String(hz)];
  if (mock) args.push("--mock");
  // Takılma teşhisi: REST'i kapat → sidecar oyunun localhost sunucusuna istek atmaz.
  if (noRest) args.push("--no-rest");

  const cmd = Command.sidecar("binaries/caspian-bridge", args);

  // stdout satırlarını tampondan ayır (bir "data" birden çok/parça satır olabilir)
  let buf = "";
  let lastWrite = 0;
  let pending = null;      // en son çözülen kare (throttle penceresinde)
  let writeTimer = null;
  let inFlight = false;    // bir yazım sürüyor mu (olay-güdümlü flush'ta üst üste binmeyi önler)
  let cars = 0;
  let lastLap = {};        // lapKey → yazılmış en yüksek tur no (append idempotent)
  let lastPit = {};        // lapKey → son görülen pit durak sayısı (pit turu işareti)
  let lastDrv = {};        // lapKey → son yazılan pilot adı (yalnız DEĞİŞİNCE yazılır)
  let lastTyre = {};       // lapKey → son yazılan pit-lastik-değişimi turu (idempotent)
  // KARARLI seans belirteci (bkz. rf2_source session.sessionId). Spawn'dan ÖNCE
  // Firebase'den okunur → yarış-ortası köprü yeniden başlatmada yanlış temizleme YOK
  // (frame'ler ancak spawn sonrası gelir; ilk frame'in sid'i saklanana eşitse temizlemez).
  let knownSessionId = null;
  let freshChecked = false; // v1.6: ilk harvest'te "aynı yarışı tekrar koşma" temizliği bir kez
  let prevMaxLaps = 0;      // v1.6.3 — yarış-restart dedektörü: sahadaki en yüksek lapsDone
  let zeroFrames = 0;       // v1.6.3 — ardışık "saha 0 turda" kare sayacı (tek bozuk kareye karşı)
  let diag = null;         // gizli teşhis (shm/lmu/cars/ve) — arayüzde gösterilmez
  let diagSig = "";        // teşhis özeti (yalnız durum değişince konsola yaz)

  // tek-yazıcı seçimi: kirayı dinle (yalnız kira sahibi / aktif sürücü kareyi yazar)
  const electing = !!uid;
  let lease = null;
  leaseCtx = { tid, rid, uid };
  if (unsubLease) { try { unsubLease(); } catch { /* yoksay */ } unsubLease = null; }
  if (electing) unsubLease = liveWriterSubscribe(tid, rid, (v) => { lease = v; });
  const myUnsubLease = unsubLease;   // BU çalıştırmanın aboneliği (modül değişkeni sonra ezilebilir)
  /* BAŞKA yazıcıya boyun eğme (v1.8.8): hafif köprü kiraya katılmadığından kira
     seçimi onu GÖREMİYOR; aynı hesabın iki penceresi de kirayı ikisi de "benim"
     sayıyordu → iki yazıcı, ekran kare kare yanıp sönüyordu. Her karemize rastgele
     bir pencere kimliği (wid) koyarız; bize ait OLMAYAN taze bir kare varsa flush
     yazmaz (standby). Hafif köprü karelerinde wid yok → hep "başkası" → o kazanır. */
  const myWid = Math.random().toString(36).slice(2, 10);
  let remote = null;   // { ts, by } — başka bir yazıcının en taze karesi
  if (unsubRemote) { try { unsubRemote(); } catch { /* yoksay */ } unsubRemote = null; }
  unsubRemote = liveTimingSubscribe(tid, rid, (v) => {
    if (v && typeof v.ts === "number" && v.wid !== myWid) remote = { ts: v.ts, by: v.by || "" };
  });
  const myUnsubRemote = unsubRemote;
  /* Bu çalıştırmanın aboneliklerini bırak — modül değişkenlerine DOKUNMADAN
     (onlar artık yeni çalıştırmaya ait olabilir). */
  const dropMySubs = () => {
    try { if (myUnsubLease) myUnsubLease(); } catch { /* yoksay */ }
    try { if (myUnsubRemote) myUnsubRemote(); } catch { /* yoksay */ }
  };

  /* Kareyi yazmadan önce tur geçmişini kalıcı livelaps düğümüne taşı:
     her satırın laps[]/lapsFrom'undan yeni turları (n > lastLap) topla, tek update
     ile yaz, satırdan laps/lapsFrom'u SİL (kare küçük kalsın; lapKey satırda kalır).
     Böylece 300+ turluk yarış tümüyle kapsanır ama canlı kare şişmez. */
  const harvestLaps = async (frame) => {
    /* YENİ SEANS → o yarışın TÜM canlı-geçmişini bir kez temizle. Köprü yeniden
       başlasa da (yarış ortasında) sessionId aynı kalır → geçmiş KORUNUR; yeni bir
       seans başlayınca (antrenman→yarış) belirteç değişir → eski turlar temizlenir,
       "+" tur listesi popup'ına önceki seansın verisi sızmaz. Belirteç yoksa (eski
       köprü) mevcut per-araç gerileme-temizleme ikincil güvenlik olarak devreye girer. */
    const hadHistory = knownSessionId != null;   // FB'den yüklenen belirteç: bu rid'de eski veri var mı (sid bloğu değiştirmeden ÖNCE yakala)
    const sid = frame?.session?.sessionId;
    if (sid && sid !== knownSessionId) {
      if (knownSessionId != null) {   // ilk görüşte (spawn'da okunan değerle) temizleme yok
        try { await liveHistoryClearAll(tid, rid); } catch { /* yoksay */ }
        lastLap = {}; lastPit = {}; lastDrv = {}; lastTyre = {};
      }
      knownSessionId = sid;
    }
    const rows = Array.isArray(frame?.field) ? frame.field : [];
    /* v1.6 — AYNI takvim yarışını (rid) TEKRAR koşma: sessionId = mSession (yarış=10)
       olduğundan seans-indeksi değişmez → yukarıdaki sessionId-temizlemesi ateşlenmez ve
       önceki koşunun turları/pilotları "+" geçmişine sızar (kullanıcı bug'ı: "olmayan
       veriler/pilotlar"). Ek güvenlik: köprü YENİ başladığında (ilk harvest) ve yarış TAM
       BAŞINDAYSA (sahadaki en yüksek lapsDone == 0) ve rid'de zaten kayıtlı geçmiş varsa
       (hadHistory) → bir kez temizle. lapsDone SUNUCU-SENKRON (tüm PC'lerde AYNI) → çok-PC
       kira devrinde yanlış temizleme YOK: yarış-ortası devralan PC lapsDone > 0 görür,
       temizlemez. (Köprüyü re-run'ın ORTASINDA açarsan lapsDone>0 → temizlemez; o durumda
       Canlı kartındaki "Geçmişi Temizle" düğmesi elle temizler.) */
    if (rows.length) {
      const maxLaps = rows.reduce((m, r) => Math.max(m, r.lapsDone || 0), 0);
      if (!freshChecked) {
        freshChecked = true;
        if (hadHistory && maxLaps === 0) {
          try { await liveHistoryClearAll(tid, rid); } catch { /* yoksay */ }
          lastLap = {}; lastPit = {}; lastDrv = {}; lastTyre = {};
        }
      } else if (maxLaps === 0 && prevMaxLaps >= 2) {
        /* v1.6.3 — yarış, köprü ÇALIŞIRKEN yeniden başlatıldı (lobby restart):
           sessionId (=mSession, yarış hep 10) DEĞİŞMEZ ve fresh-start kontrolü çoktan
           tüketildi → yukarıdaki iki temizleme de ateşlenmez, eski koşunun turları yeni
           koşuya sızardı. Saha max lapsDone'un ≥2'den 0'a düşmesi restart demektir;
           İKİ ARDIŞIK karede görülmesi şartı tekil bozuk kareye karşı koruma. lapsDone
           paylaşımlı bellekte tüm PC'lerde AYNI → çok-PC kira devrinde yanlış temizleme yok. */
        zeroFrames += 1;
        if (zeroFrames >= 2) {
          try { await liveHistoryClearAll(tid, rid); } catch { /* yoksay */ }
          lastLap = {}; lastPit = {}; lastDrv = {}; lastTyre = {};
          prevMaxLaps = 0; zeroFrames = 0;
        }
      } else {
        zeroFrames = 0;
        if (maxLaps > 0) prevMaxLaps = maxLaps;
      }
    }
    const entries = {};      // livelaps: lapKey/n → süre
    const posEntries = {};   // livepos: lapKey/n → pozisyon (pit turu → negatif)
    const secEntries = {};   // livesec: lapKey/n → "s1,s2,s3" (yalnız en yeni tur)
    const drvEntries = {};   // livedrv: lapKey/n → pilot adı (yalnız DEĞİŞİM turunda)
    const tyreEntries = {};  // livetyre: lapKey/n → "{adet}|{hamur}" (yalnız pit turunda)
    const condEntries = {};  // livecond: lapKey/n → "temp,wet,grip" (yalnız en yeni tur)
    const wearEntries = {};  // livewear: lapKey/n → "fl,fr,rl,rr" (yalnız en yeni tur)
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
        /* LASTİK DİŞİ (v2.3.1): dört köşe, yalnız en yeni tur. `tyres4` zaten
           karede (köprü _wear4) → oyun PC'sine yeni okuma/istek/thread YOK.
           Online rakipte tyres4 null gelir (oyun yaymıyor) → yazılmaz.
           harvest.py'deki koşulla BİREBİR aynı: v2.3.0'da bir alan yalnız bu iki
           yoldan birine eklenip diğeri atlanmıştı, tekrarlanmasın. */
        const w4 = r.tyres4;
        if (maxN > prev && Array.isArray(w4) && w4.length === 4
            && w4.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) {
          wearEntries[`${key}/${maxN}`] = w4.map((v) => v.toFixed(3)).join(",");
        }
        // pist koşulları: en yeni tur (maxN) için bu karenin asfalt/ıslaklık/tutuşu
        if (maxN > prev && condStr) condEntries[`${key}/${maxN}`] = condStr;
        if (maxN > (lastLap[key] || 0)) lastLap[key] = maxN;
        lastPit[key] = pits;
      }
      // canlı kareyi küçük tut — geçmiş ayrı düğümde. lastSectors KALIR: standings'te
      // "Sektör" sütunu (son turun S1/S2/S3'ü) canlı kareden okunur (v1.4.139).
      delete r.laps; delete r.lapsFrom; delete r.lapNums;
      /* v2.3.0: `tyreChange` ARTIK KAREDE KALIYOR. v2.2.x'te "tabloda
         gösterilmiyor" gerekçesiyle siliniyordu, ama tyreInfo.tyreChangeBadge()
         o zaman da yazılı ve testliydi — yalnız hiç bağlanmamıştı. Pit sütunu
         artık rozeti çiziyor ("2 ÖN" / "4" / yakıt-only durakta "0"), yani veri
         kullanılıyor. Boyut: araç başına tek küçük nesne ({n, corners, comp}),
         Firebase yaprak sınırının çok altında. */
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
        await liveWearClear(tid, rid, k);
      }
      if (Object.keys(entries).length) await liveLapsAppend(tid, rid, entries);
      if (Object.keys(posEntries).length) await livePosAppend(tid, rid, posEntries);
      if (Object.keys(secEntries).length) await liveSecAppend(tid, rid, secEntries);
      if (Object.keys(drvEntries).length) await liveDrvAppend(tid, rid, drvEntries);
      if (Object.keys(tyreEntries).length) await liveTyreAppend(tid, rid, tyreEntries);
      if (Object.keys(condEntries).length) await liveCondAppend(tid, rid, condEntries);
      if (Object.keys(wearEntries).length) await liveWearAppend(tid, rid, wearEntries);
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
      // Başka bir yazıcının (hafif köprü / başka pencere-PC) taze karesi varsa YAZMA:
      // tek yazıcı kalır, ekran yanıp sönmez, "Canlı kaynak" gerçek yayıncıyı gösterir.
      // Yazıcı susarsa kare bayatlar (>7 sn) → otomatik devralırız (failover korunur).
      if (shouldYield(remote, serverNow())) {
        say({ running: true, phase: "standby", msg: "Beklemede",
          writerBy: remote?.by || "", cars, diag });
        return;
      }
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
      await liveTimingSet(tid, rid, { ts: serverNow(), by, wid: myWid, ...frame });
      /* lastTs kaldırıldı (v1.8.0): hiç tüketicisi yoktu ve her karede farklı
         değer taşıdığı için durum objesi asla eşit çıkmıyor, App her karede
         boşuna render oluyordu. */
      say({ running: true, phase: "running", msg: "Gönderiliyor", cars, writerBy: by, diag });
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
    if (!mine()) return;      // eski çalıştırmanın hatası — yeni köprüyü bozma
    say({ running: false, phase: "error", msg: "Sidecar hatası: " + (e?.message || e) });
    child = null;
  });
  cmd.on("close", (data) => {
    if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
    dropMySubs();
    /* SAHİPLİK: eski sürecin `close`'u ms'ler geç gelebilir. Kontrol olmadan
       YENİ köprünün aboneliklerini iptal edip kirasını bırakıyordu → kira hep
       null (her karede transaction), remote hep null (hafif köprüye boyun
       eğilmiyor), child=null (4 sn sonra İKİNCİ bir sidecar). */
    if (!mine()) return;
    child = null;
    unsubLease = null;
    unsubRemote = null;
    if (electing && uid) liveWriterRelease(tid, rid, uid);   // kirayı bırak → devir hızlı
    say({ running: false, phase: "stopped",
      msg: stopping ? "Durduruldu" : `Köprü kapandı (kod ${data?.code ?? "?"})` });
  });

  // Saklanan seans belirtecini spawn'dan ÖNCE oku → ilk frame yarış-ortası yeniden
  // başlatmada (sid saklanana eşit) geçmişi temizlemez; okunamazsa (null) yine
  // temizlemeyiz (ancak GERÇEK bir seans değişikliğinde temizler → güvenli taraf).
  try { knownSessionId = await liveSessionIdGet(tid, rid); } catch { knownSessionId = null; }
  /* Firebase okumasını beklerken durdurulduysak sidecar'ı HİÇ doğurma —
     doğsaydı yazamayan bir "zombi köprü" olurdu. */
  if (!mine()) { dropMySubs(); return; }

  try {
    child = await cmd.spawn();
    starting = false;
    /* spawn beklerken durdurulduysak süreci HEMEN öldür (oyun PC'sinde başıboş
       bir okuyucu bırakma — CLAUDE.md §0). */
    if (!mine()) {
      const c = child; child = null;
      dropMySubs();
      try { await c.kill(); } catch { /* zaten kapanmış olabilir */ }
      return;
    }
    say({ running: true, phase: "running", msg: "Köprü çalışıyor", cars });
  } catch (e) {
    if (mine()) { starting = false; child = null; }
    dropMySubs();
    say({ running: false, phase: "error", msg: "Sidecar başlatılamadı: " + (e?.message || e) });
  }
}

/* Köprüyü durdur — sidecar sürecini öldür. */
export async function stopBridge(onStatus) {
  stopping = true;
  /* Askıdaki startBridge'i geçersiz kıl VE `starting` kilidini aç. Eskiden
     `starting` true kalıyordu: sonraki startBridge `if (child || starting)`
     ile sessizce çıkıyor, askıdaki eski çağrı ise sidecar'ı doğurup hiç kare
     yazmıyordu (zombi köprü). */
  runSeq += 1;
  starting = false;
  const c = child;
  child = null;
  if (unsubLease) { try { unsubLease(); } catch { /* yoksay */ } unsubLease = null; }
  if (unsubRemote) { try { unsubRemote(); } catch { /* yoksay */ } unsubRemote = null; }
  if (leaseCtx?.uid) { liveWriterRelease(leaseCtx.tid, leaseCtx.rid, leaseCtx.uid); leaseCtx = null; }
  if (c) {
    try { await c.kill(); } catch { /* zaten kapanmış olabilir */ }
  }
  try { if (onStatus) onStatus({ running: false, phase: "stopped", msg: "Durduruldu" }); } catch { /* yoksay */ }
}

export function bridgeRunning() {
  return !!child;
}
