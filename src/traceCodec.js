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
       x?[N], y?[N], mapSrc?:"pos"|"g"|"gps" }

   KOMPAKTLAMA (packBins deseni, src/trackShape.js):
   - `dist` ve `frac` SAKLANMAZ — grid uniform olduğu için len/N/distUnit'ten
     birebir türetilir (buildTrace: dGrid[k]=len*k/(N-1)).
   - Her kanal yuvarlanmış tamsayı dizisi; null → boş alan (ardışık virgül).
   - Var olmayan kanal başlık bayrağında 0 → string'e hiç yazılmaz (buildCompare
     zaten `a[k] && b[k]` ile yokluğu tolere eder).
   - Sayı ölçekleri unpack'te birebir tersine çevrilir; yuvarlama görünür kayıp
     vermez (gaz/fren %, hız km/h, zaman 0.01 s).

   HARİTA (x/y) — UYARLANIR ÖLÇEK (v2): Koordinatlar iki BÜYÜK BÜYÜKLÜK skalasında
   gelebilir — "g"/"pos" kaynağı METRE (birkaç bin), "gps" kaynağı DERECE (~0.01
   hassasiyet gerekir). Eski sabit tamsayı yuvarlama (s=1) dereceleri YOK EDİYORDU:
   6.9123→7, 45.9876→46 gibi tüm noktalar aynı tamsayıya çöküyor → kaydedilen
   harita boşa çıkıyordu (grafik kanalları etkilenmiyordu; bu yüzden "grafik
   kaydoluyor ama harita kaydolmuyor"). Çözüm: turun x/y yayılımından türeyen ORTAK
   bir `mapK` ile ~1e5 tamsayı çözünürlüğüne ölçekle (x ve y AYNI mapK → en-boy
   korunur), origin (x0/y0) çıkararak string'i kompakt tut. UI fit-to-box normalize
   ettiği için mutlak konum önemsiz; yalnız ŞEKİL + oran korunmalı, bu da korunur.

   FORMAT (satır tabanlı, hızlı ve okunur):
     satır 0 : "2;N;distUnit;len;mapSrc;mapK;x0;y0"   ← sürüm + başlık
               (mapK;x0;y0 yalnız harita varken yazılır)
     sonraki : "<key>:v,v,v,…"  her mevcut kanal için (key: ti,sp,th,br,g,rp,st,x,y)
   GERİYE UYUM: v1 stringleri (x/y tamsayı, s=1) da okunur — o veriler zaten yalnız
   metre kaynağı için doğruydu; GPS için bozuktu, yeniden kaydedince v2 ile düzelir.
   ============================================================ */

const VER = "2";
export const MAX_TRACE_STR = 40000;   // Firebase yaprağı sınırı (kural .validate < 40000 ile uyumlu)

/* Genel (sabit ölçekli) kanallar → { pack anahtarı, trace alanı, ölçek }.
   x/y BURADA DEĞİL — harita koordinatları uyarlanır ölçekle ayrı işlenir (aşağıda).
   enc(v) = round(v*scale) yazılır; dec(n) = n/scale geri okunur. */
const CHANS = [
  { k: "ti", f: "time", s: 100 },   // saniye → 0.01 s
  { k: "sp", f: "speed", s: 1 },    // km/h
  { k: "th", f: "throttle", s: 1 }, // %
  { k: "br", f: "brake", s: 1 },    // %
  { k: "g", f: "gear", s: 1 },      // vites
  { k: "rp", f: "rpm", s: 0.1 },    // rpm → 10'a yuvarla (×0.1)
  { k: "st", f: "steer", s: 1 },    // derece
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

/* Harita x/y için uyarlanır ölçek meta'sı: turun x/y yayılımından ORTAK mapK
   (x ve y AYNI ölçek → en-boy korunur) + origin (x0/y0). Sonlu değer yoksa null. */
function mapMeta(tr) {
  const fin = (arr) => (Array.isArray(arr) ? arr.filter(Number.isFinite) : []);
  const fx = fin(tr.x), fy = fin(tr.y);
  if (!fx.length || !fy.length) return null;
  const x0 = Math.min(...fx), y0 = Math.min(...fy);
  const spanX = Math.max(...fx) - x0, spanY = Math.max(...fy) - y0;
  const span = Math.max(spanX, spanY) || 1;   // en büyük eksen → 0..~1e5 tamsayıya
  return { x0, y0, mapK: 1e5 / span };
}

/* Harita ekseni → "v,v,,v" (origin çıkar, mapK ile ölçekle, tamsayıya yuvarla). */
function encMap(arr, origin, mapK) {
  const out = Array.from({ length: arr.length });
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    out[i] = Number.isFinite(v) ? String(Math.round((v - origin) * mapK)) : "";
  }
  return out.join(",");
}

/* "v,v,,v" → harita ekseni (mapK geri alınır, origin eklenir). */
function decMap(str, origin, mapK) {
  const parts = str.split(",");
  const out = Array.from({ length: parts.length });
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    out[i] = p === "" ? null : origin + Number(p) / mapK;
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
  const hasXY = Array.isArray(tr.x) && Array.isArray(tr.y)
    && tr.x.length === N && tr.y.length === N;
  const mm = hasXY ? mapMeta(tr) : null;
  /* mapK/x0/y0 yalnız harita varken yazılır → haritasız iz başlığı v1 ile aynı boyda.
     Sayılar String(...) ile TAM double hassasiyetinde yazılır → Number() birebir geri alır
     (aynı string parse edildiği için mapK/x0/y0 kayıpsız round-trip). */
  const head = mm
    ? `${VER};${N};${du};${len.toFixed(1)};${tr.mapSrc || ""};${mm.mapK};${mm.x0};${mm.y0}`
    : `${VER};${N};${du};${len.toFixed(1)};${tr.mapSrc || ""}`;
  const lines = [head];
  for (const c of CHANS) {
    const arr = tr[c.f];
    if (Array.isArray(arr) && arr.length === N) lines.push(`${c.k}:${encArr(arr, c.s)}`);
  }
  if (mm) {
    lines.push(`x:${encMap(tr.x, mm.x0, mm.mapK)}`);
    lines.push(`y:${encMap(tr.y, mm.y0, mm.mapK)}`);
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
  const ver = head[0];
  if (ver !== "1" && ver !== "2") return null;
  const N = Number(head[1]);
  if (!Number.isInteger(N) || N < 2) return null;
  const distUnit = head[2] === "frac" ? "frac" : "m";
  const len = Number(head[3]) || (distUnit === "frac" ? 1 : 0);
  const mapSrc = head[4] || null;
  /* v2 harita ölçeği (başlıkta varsa). Yoksa LEGACY (v1): x/y tamsayı, ölçek 1 —
     yalnız metre kaynağı için doğruydu, GPS için bozuktu (yeniden kaydedince düzelir). */
  const hasMapMeta = ver === "2" && head[5] != null && head[5] !== "";
  const mapK = hasMapMeta ? Number(head[5]) : null;
  const x0 = hasMapMeta ? Number(head[6]) || 0 : 0;
  const y0 = hasMapMeta ? Number(head[7]) || 0 : 0;

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
    const key = line.slice(0, c);
    const body = line.slice(c + 1);
    if (key === "x" || key === "y") {
      // v2: uyarlanır ölçek (mapK/origin); v1: tamsayı (ölçek 1)
      const arr = mapK != null
        ? decMap(body, key === "x" ? x0 : y0, mapK)
        : decArr(body, 1);
      if (arr.length === N) out[key] = arr;
      continue;
    }
    const def = FIELD_BY_KEY[key];
    if (!def) continue;
    const arr = decArr(body, def.s);
    if (arr.length === N) out[def.f] = arr;   // boyut tutmuyorsa o kanalı yok say
  }
  // time zorunlu — yoksa iz kullanılamaz
  if (!Array.isArray(out.time) || out.time.length !== N) return null;
  return out;
}
