/* ============================================================
   traceCodec — telemetri izini (buildTrace çıktısı) kalıcı saklama için
   kompakt string'e çevir / geri aç.
   ------------------------------------------------------------
   NEDEN VAR: Pist haritası + gaz/fren grafikleri ham `.duckdb` dosyasından
   oturum-içi hesaplanıyordu (buildTrace → buildCompare) ve Firebase'e HİÇ
   yazılmadığı için program kapanınca kayboluyordu. Bu modül, bir stint
   kaydedilirken o turların izini Firebase'e sığacak boyutta stringler.

   HEDEF ŞEKİL (ldTrace.buildTrace çıktısı, birebir korunmalı — buildCompare bunu bekler):
     { dist[N], distUnit:"m"|"frac", len, time[N], frac[N],
       speed?[N], throttle?[N], brake?[N], gear?[N], rpm?[N], steer?[N],
       x?[N], y?[N], mapSrc?:"pos"|"g" }

   KOMPAKTLAMA (packBins deseni, src/trackShape.js):
   - `dist` ve `frac` SAKLANMAZ — grid uniform olduğu için len/N/distUnit'ten
     birebir türetilir (buildTrace: dGrid[k]=len*k/(N-1)).
   - Her kanal yuvarlanmış tamsayı dizisi; null → boş alan (ardışık virgül).
   - Var olmayan kanal başlık bayrağında 0 → string'e hiç yazılmaz (buildCompare
     zaten `a[k] && b[k]` ile yokluğu tolere eder).
   - Sayı ölçekleri unpack'te birebir tersine çevrilir; yuvarlama görünür kayıp
     vermez (harita metre, gaz/fren %, hız km/h, zaman 0.01 s).

   FORMAT (satır tabanlı, hızlı ve okunur):
     satır 0 : "1;N;distUnit;len;mapSrc"            ← sürüm + başlık
     sonraki : "<key>:v,v,v,…"  her mevcut kanal için (key: ti,sp,th,br,g,rp,st,x,y)
   ============================================================ */

const VER = "1";
export const MAX_TRACE_STR = 40000;   // Firebase yaprağı sınırı (kural .validate < 40000 ile uyumlu)

/* Kanal tanımları: pack anahtarı → { trace alanı, ölçek }.
   enc(v) = round(v*scale) yazılır; dec(n) = n/scale geri okunur. */
const CHANS = [
  { k: "ti", f: "time", s: 100 },   // saniye → 0.01 s
  { k: "sp", f: "speed", s: 1 },    // km/h
  { k: "th", f: "throttle", s: 1 }, // %
  { k: "br", f: "brake", s: 1 },    // %
  { k: "g", f: "gear", s: 1 },      // vites
  { k: "rp", f: "rpm", s: 0.1 },    // rpm → 10'a yuvarla (×0.1)
  { k: "st", f: "steer", s: 1 },    // derece
  { k: "x", f: "x", s: 1 },         // harita metre
  { k: "y", f: "y", s: 1 },
];

/* Bir sayı dizisini "v,v,,v" biçimine kodla (null/NaN → boş). */
function encArr(arr, scale) {
  const out = Array.from({ length: arr.length });
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    out[i] = Number.isFinite(v) ? String(Math.round(v * scale)) : "";
  }
  return out.join(",");
}

/* "v,v,,v" → sayı dizisi (boş → null, ölçek geri alınır). */
function decArr(str, scale) {
  const parts = str.split(",");
  const out = Array.from({ length: parts.length });
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    out[i] = p === "" ? null : Number(p) / scale;
  }
  return out;
}

/* buildTrace çıktısı → kompakt string. Geçersizse "" döner.
   Not: N azaltma pack'te DEĞİL, buildTrace(readers, lap, N) çağrısında yapılır
   (kaynağı düşük çözünürlükte üretmek daha temiz). */
export function packTrace(tr) {
  if (!tr || !Array.isArray(tr.time) || !tr.time.length) return "";
  const N = tr.time.length;
  const len = Number.isFinite(tr.len) ? tr.len : 0;
  const du = tr.distUnit === "frac" ? "frac" : "m";
  const head = `${VER};${N};${du};${len.toFixed(1)};${tr.mapSrc || ""}`;
  const lines = [head];
  for (const c of CHANS) {
    const arr = tr[c.f];
    if (Array.isArray(arr) && arr.length === N) lines.push(`${c.k}:${encArr(arr, c.s)}`);
  }
  return lines.join("\n");
}

const FIELD_BY_KEY = Object.fromEntries(CHANS.map((c) => [c.k, c]));

/* kompakt string → buildTrace şekli. Bozuk/eksikse null.
   Çıktı doğrudan buildCompare(a, b)'ye beslenebilir. */
export function unpackTrace(str) {
  if (typeof str !== "string" || !str) return null;
  const nl = str.indexOf("\n");
  const head = (nl < 0 ? str : str.slice(0, nl)).split(";");
  if (head[0] !== VER) return null;
  const N = Number(head[1]);
  if (!Number.isInteger(N) || N < 2) return null;
  const distUnit = head[2] === "frac" ? "frac" : "m";
  const len = Number(head[3]) || (distUnit === "frac" ? 1 : 0);
  const mapSrc = head[4] || null;

  // dist/frac grid'i türet (buildTrace ile birebir aynı formül)
  const dGrid = Array.from({ length: N });
  const frac = Array.from({ length: N });
  for (let k = 0; k < N; k++) {
    dGrid[k] = (len * k) / (N - 1);
    frac[k] = k / (N - 1);
  }
  const out = {
    distUnit, len,
    dist: distUnit === "frac" ? dGrid.map((d) => d * 100) : dGrid,
    frac,
  };
  if (mapSrc) out.mapSrc = mapSrc;

  const lines = nl < 0 ? [] : str.slice(nl + 1).split("\n");
  for (const line of lines) {
    const c = line.indexOf(":");
    if (c < 0) continue;
    const def = FIELD_BY_KEY[line.slice(0, c)];
    if (!def) continue;
    const arr = decArr(line.slice(c + 1), def.s);
    if (arr.length === N) out[def.f] = arr;   // boyut tutmuyorsa o kanalı yok say
  }
  // time zorunlu — yoksa iz kullanılamaz
  if (!Array.isArray(out.time) || out.time.length !== N) return null;
  return out;
}
