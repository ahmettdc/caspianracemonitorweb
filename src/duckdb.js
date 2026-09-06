/* ============================================================
   duckdb — LMU .duckdb telemetri adaptörü (v1.5.1) · YALNIZ TARAYICI, LAZY
   ------------------------------------------------------------
   duckdb-wasm'ı (WebAssembly) tembel yükler, .duckdb dosyasını buffer olarak kaydedip
   ATTACH eder ve gereken kanalları BİR kez belleğe çeker → düz `dataset` döndürür.
   Saf mantık (duckParse/duckTrace) bu dataset'i işler. Ağır WASM (~35 MB) yalnız bir
   .duckdb açılınca indirilir → ana paket/site etkilenmez.

   duckdb-wasm çalışma-zamanı bu ortamda (tarayıcı yok) doğrulanamaz; SQL/şema Node'da
   duckdb-wasm 1.29 ile gerçek dosyaya karşı doğrulandı (§8). Kanal eşlemesi + tur/iz
   dönüşümünün saf kısmı birim-testlidir.
   ============================================================ */
import { DUCK_CONT, DUCK_CONT4, DUCK_EVT, DUCK_CLOCK } from "./duckParse";

/* Sürekli kanallar arasındaki EN UZUN SÜRE (saniye). Saat kanalı yoksa seans
   süresi buradan gelir.

   NEDEN SAF VE AYRI (v2.4.1): eskiden bu seçim satır içinde ÖRNEK SAYISINA
   göre yapılıyordu (`v.length > baseLen`) ve süre `baseLen / baseHz` diye
   hesaplanıyordu — yorumun kendisi "en uzun sürekli kanaldan" dediği halde.
   Yüksek frekanslı ama KISA bir kanal (100 Hz × 12000 = 120 sn) düşük
   frekanslı uzun bir kanalı (10 Hz × 2400 = 240 sn) yeniyor ve seans süresini
   yarıya düşürüyordu → tEnd erken, son turun izi kırpılıyor ve duckMeta
   orta-seans sıcaklığını yanlış noktadan örnekliyordu. */
export function longestContSec(cont) {
  let best = 0;
  for (const c of Object.values(cont || {})) {
    const hz = Number(c?.hz), n = c?.v?.length;
    if (!(hz > 0) || !(n > 0)) continue;
    const d = n / hz;
    if (d > best) best = d;
  }
  return best;
}

/* Vite: WASM + worker'ı ayrı varlık olarak emit et (CDN yok — offline/Tauri güvenli). */
async function makeDB() {
  const duckdb = await import("@duckdb/duckdb-wasm");
  const [mvpWasm, mvpWorker, ehWasm, ehWorker] = await Promise.all([
    import("@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url"),
    import("@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url"),
    import("@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url"),
    import("@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url"),
  ]);
  const bundles = {
    mvp: { mainModule: mvpWasm.default, mainWorker: mvpWorker.default },
    eh: { mainModule: ehWasm.default, mainWorker: ehWorker.default },
  };
  const bundle = await duckdb.selectBundle(bundles);
  const worker = new Worker(bundle.mainWorker);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  return { duckdb, db, worker };
}

const numify = (v) => (typeof v === "bigint" ? Number(v) : v);
/* İç anahtar → gerçek tablo adı (channelsList/eventsList'ten toleranslı eşleme). */
function resolve(names, regexes) {
  for (const re of regexes) { const hit = names.find((n) => re.test(n)); if (hit) return hit; }
  return null;
}

/* ---- Motor önbelleği (v1.8.0) ----
   WASM instantiate pahalı (motor ~35 MB + worker kurulumu) ve eskiden HER .duckdb
   açılışında sıfırdan yapılıp finally'de terminate ediliyordu — arka arkaya stint
   dosyaları açan kullanıcı her seferinde saniyeler bekliyordu. Artık modül-seviyesi
   singleton: ilk açılış kurar, sonrakiler anında; 5 dk boşta kalınca terminate
   (bellek geri verilir). Her açılış BENZERSİZ dosya/katalog adı kullanır ve
   finally'de DETACH + dropFile ile iz bırakmaz. Hata yolunda hard-reset: bozuk
   motor sonraki açılışları zehirlemesin (eski davranışla aynı güvence). */
let enginePromise = null;
let idleTimer = null;
let seq = 0;
const IDLE_MS = 5 * 60 * 1000;

function getEngine() {
  if (!enginePromise) enginePromise = makeDB();
  return enginePromise;
}

async function resetEngine() {
  const p = enginePromise;
  enginePromise = null;
  clearTimeout(idleTimer); idleTimer = null;
  if (!p) return;
  try {
    const { db, worker } = await p;
    try { await db.terminate(); } catch { /* yut */ }
    try { worker.terminate(); } catch { /* yut */ }
  } catch { /* makeDB zaten patlamış — kapatılacak motor yok */ }
}

function armIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(resetEngine, IDLE_MS);
}

/* .duckdb (File/Blob) → dataset (duckParse/duckTrace sözleşmesi). Bağlantı ve
   geçici dosya açılış sonunda temizlenir — dataset düz veridir, bağlantı sızmaz. */
export async function openDuck(file) {
  clearTimeout(idleTimer);                      // açılış sürerken idle kapanmasın
  const n = ++seq;
  const fname = `t${n}.duckdb`, dbname = `tel${n}`;
  try {
    const { db } = await getEngine();
    let conn;
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      await db.registerFileBuffer(fname, buf);
      conn = await db.connect();
      await conn.query(`ATTACH '${fname}' AS ${dbname} (READ_ONLY);`);
      await conn.query(`USE ${dbname};`);

      const q = async (sql) => (await conn.query(sql)).toArray();
      const col = async (table, cols) => {
        const t = await conn.query(`SELECT ${cols} FROM "${table.replace(/"/g, '""')}"`);
        return cols.split(",").map((c) => {
          const child = t.getChild(c.trim());
          return child ? Array.from(child.toArray(), numify) : [];
        });
      };

      // kayıt tabloları
      const meta = {};
      for (const r of await q("SELECT key, value FROM metadata")) meta[r.key] = r.value;
      const chList = await q("SELECT channelName, frequency FROM channelsList");
      const hzOf = new Map(chList.map((r) => [r.channelName, Number(r.frequency)]));
      const chNames = chList.map((r) => r.channelName);
      const evNames = (await q("SELECT eventName FROM eventsList")).map((r) => r.eventName);

      // ana saat → t0
      const clockName = resolve(chNames, DUCK_CLOCK);
      let t0 = 0, clockLen = 0, clockHz = 100;
      if (clockName) {
        const [cv] = await col(clockName, "value");
        clockLen = cv.length; clockHz = hzOf.get(clockName) || 100;
        if (cv.length) t0 = cv[0];
      }

      // sürekli kanallar (tek değer)
      const cont = {};
      /* En UZUN kanalın SÜRESİ (sn) — örnek SAYISI değil.
         Eskiden `v.length > baseLen` ile en çok ÖRNEKLİ kanal seçiliyor ve süre
         `baseLen / baseHz` diye hesaplanıyordu; oysa yorumun kendisi "en uzun
         sürekli kanaldan" diyor. Yüksek frekanslı ama KISA bir kanal (100 Hz ×
         12000 = 120 sn) düşük frekanslı uzun bir kanalı (10 Hz × 2400 = 240 sn)
         yeniyor ve seans süresini YARIYA düşürüyordu → tEnd erken, son turun
         izi kırpılıyor ve duckMeta orta-seans sıcaklığını yanlış noktadan
         örnekliyordu. (Yalnız saat kanalı bulunamadığında devreye girer.) */
      for (const key of Object.keys(DUCK_CONT)) {
        const name = resolve(chNames, DUCK_CONT[key]);
        if (!name) continue;
        const [v] = await col(name, "value");
        cont[key] = { hz: hzOf.get(name) || 10, v };
      }
      const baseDur = longestContSec(cont);
      // 4-köşe sürekli kanallar
      const cont4 = {};
      for (const key of Object.keys(DUCK_CONT4)) {
        const name = resolve(chNames, DUCK_CONT4[key]);
        if (!name) continue;
        const v = await col(name, "value1,value2,value3,value4");
        cont4[key] = { hz: hzOf.get(name) || 10, v };
      }
      // olay kanalları
      const evt = {};
      let minTs = Infinity;
      for (const key of Object.keys(DUCK_EVT)) {
        const name = resolve(evNames, DUCK_EVT[key]);
        if (!name) continue;
        const rows = await q(`SELECT ts, value FROM "${name.replace(/"/g, '""')}" ORDER BY ts`);
        evt[key] = rows.map((r) => ({ ts: numify(r.ts), value: numify(r.value) }));
        if (evt[key].length) minTs = Math.min(minTs, evt[key][0].ts);
      }
      if (!t0 && Number.isFinite(minTs)) t0 = minTs;   // saat yoksa en küçük olay ts'i

      // veri sonu: saat ya da en uzun (SÜRE olarak) sürekli kanaldan
      const dur = clockLen ? clockLen / clockHz : baseDur;
      const tEnd = t0 + dur;

      return { meta, t0, tEnd, cont, cont4, evt };
    } finally {
      /* motoru DEĞİL, bu açılışın izlerini temizle: varsayılan kataloğa dön +
         DETACH + geçici dosyayı bırak. Motor sıradaki açılış için sıcak kalır. */
      try { if (conn) { await conn.query("USE memory;"); await conn.query(`DETACH ${dbname};`); } } catch { /* yut */ }
      try { if (conn) await conn.close(); } catch { /* yut */ }
      try { await db.dropFile(fname); } catch { /* yut */ }
    }
  } catch (e) {
    await resetEngine();   // şüpheli motoru at — sonraki açılış temiz kurar
    throw e;
  } finally {
    if (enginePromise) armIdle();
  }
}
