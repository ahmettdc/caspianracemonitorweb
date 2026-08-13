/* ============================================================
   GÖRSEL YÜKLEME — doğrulama + normalize (v1.7.0)
   ------------------------------------------------------------
   Kullanıcı/takım görselleri (avatar, takım logosu, araç TOP/SIDE) RTDB'ye
   base64 dataURI olarak yazılır (globalSetupData blob deseni — Firebase Storage
   kabloları YOK, bilinçli). Bu modül yüklenen dosyayı:
     1. doğrular (MIME + magic byte + ham boyut ≤ 10 MB),
     2. spec tuvaline normalize eder (cover = merkez kırp / contain = şeffaf dolgu),
     3. WebP'ye sıkıştırır (kalite kademeli düşer, cap altına inene dek).
   Tuval boyutları statik asset'lerle BİREBİR (side 1000×400, top 400×1000) →
   yüklenen görseller mevcut container'larda statiklerle aynı hizada durur.
   cap = dataURI KARAKTER sınırı — firebase-rules.json validate'leriyle hizalı.
   Saf parçalar (sniffImageType, fitRect) vitest'te test edilir; canvas/WebP
   kısmı jsdom'da koşamaz → çalışma zamanında kullanıcı doğrular (dürüst kısıt).
   ============================================================ */

export const IMG_SPECS = {
  avatar:  { w: 256,  h: 256,  fit: "cover",   cap: 60000 },
  logo:    { w: 512,  h: 512,  fit: "contain", cap: 100000 },
  carSide: { w: 1000, h: 400,  fit: "contain", cap: 200000 },
  carTop:  { w: 400,  h: 1000, fit: "contain", cap: 200000 },
};

/* Ham girdi sınırı — decode öncesi kaba koruma (dev dosya tarayıcıyı kilitlemesin). */
export const IMG_MAX_INPUT_BYTES = 10 * 1024 * 1024;

/* Kabul edilen MIME tipleri (input accept ile aynı liste). */
export const IMG_ACCEPT_TYPES = ["image/png", "image/jpeg", "image/webp"];

/* Magic byte'tan görsel tipi — uzantı/MIME sahteciliğine karşı ikinci kontrol.
   bytes: Uint8Array (ilk ~16 bayt yeter). Dönen: "png"|"jpeg"|"webp"|"gif"|null. */
export function sniffImageType(bytes) {
  if (!bytes || bytes.length < 4) return null;
  const b = bytes;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return "png";
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return "jpeg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "gif";
  if (b.length >= 12
      && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46   // RIFF
      && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) // WEBP
    return "webp";
  return null;
}

/* Kaynak (sw×sh) görseli hedef (dw×dh) tuvale yerleştirme dikdörtgenleri.
   cover  → tuvali tamamen doldur, taşan kenarı merkezden KIRP (avatar).
   contain→ tümünü sığdır, boş kalan alan şeffaf dolgu (logo/araç — hizalama).
   Dönen: { sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight } (drawImage 9-arg). */
export function fitRect(sw, sh, dw, dh, fit) {
  if (!(sw > 0) || !(sh > 0) || !(dw > 0) || !(dh > 0)) return null;
  const scaleCover = Math.max(dw / sw, dh / sh);
  const scaleContain = Math.min(dw / sw, dh / sh);
  if (fit === "cover") {
    const sWidth = Math.min(sw, dw / scaleCover);
    const sHeight = Math.min(sh, dh / scaleCover);
    return {
      sx: (sw - sWidth) / 2, sy: (sh - sHeight) / 2, sWidth, sHeight,
      dx: 0, dy: 0, dWidth: dw, dHeight: dh,
    };
  }
  const dWidth = sw * scaleContain;
  const dHeight = sh * scaleContain;
  return {
    sx: 0, sy: 0, sWidth: sw, sHeight: sh,
    dx: (dw - dWidth) / 2, dy: (dh - dHeight) / 2, dWidth, dHeight,
  };
}

/* Blob → dataURI (FileReader — useSetups b64 okuma deseni). */
const blobToDataUri = (blob) => new Promise((resolve, reject) => {
  const rd = new FileReader();
  rd.onload = () => resolve(String(rd.result || ""));
  rd.onerror = () => reject(new Error("read"));
  rd.readAsDataURL(blob);
});

const decodeImage = async (file) => {
  if (typeof createImageBitmap === "function") {
    try { return await createImageBitmap(file); } catch { /* yedeğe düş */ }
  }
  // Yedek: Image + objectURL (eski WebView)
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode")); };
    img.src = url;
  });
};

/* Dosyayı doğrula + spec tuvaline normalize et + WebP dataURI döndür.
   Hatalar TR mesajlı Error — çağıran t() ile çevirip hint warn'da gösterir. */
export async function processImageFile(file, specKey) {
  const spec = IMG_SPECS[specKey];
  if (!file || !spec) throw new Error("Geçersiz görsel dosyası.");
  if (file.size > IMG_MAX_INPUT_BYTES)
    throw new Error("Görsel çok büyük — en fazla 10 MB olabilir.");
  if (!IMG_ACCEPT_TYPES.includes(file.type))
    throw new Error("Desteklenmeyen dosya türü — PNG, JPEG ya da WebP yükleyin.");
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const sniffed = sniffImageType(head);
  if (!sniffed || !["png", "jpeg", "webp"].includes(sniffed))
    throw new Error("Geçersiz görsel dosyası — içerik PNG/JPEG/WebP değil.");

  let img;
  try { img = await decodeImage(file); }
  catch { throw new Error("Görsel işlenemedi — dosya bozuk olabilir."); }
  const sw = img.width, sh = img.height;
  if (!(sw > 0) || !(sh > 0)) throw new Error("Görsel işlenemedi — dosya bozuk olabilir.");

  const canvas = document.createElement("canvas");
  canvas.width = spec.w; canvas.height = spec.h;
  const ctx = canvas.getContext("2d");
  const r = fitRect(sw, sh, spec.w, spec.h, spec.fit);
  ctx.clearRect(0, 0, spec.w, spec.h);   // contain → şeffaf dolgu (WebP alfa)
  ctx.drawImage(img, r.sx, r.sy, r.sWidth, r.sHeight, r.dx, r.dy, r.dWidth, r.dHeight);
  if (typeof img.close === "function") { try { img.close(); } catch { /* yoksay */ } }

  /* Kalite kademeli düşürülür → dataURI cap altına inene dek. */
  for (const q of [0.85, 0.75, 0.65, 0.55, 0.5]) {
    const blob = await new Promise((res) => canvas.toBlob(res, "image/webp", q));
    if (!blob) break;
    const uri = await blobToDataUri(blob);
    if (uri.startsWith("data:image/") && uri.length < spec.cap) return uri;
  }
  throw new Error("Görsel sıkıştırılamadı — daha küçük/az detaylı bir görsel deneyin.");
}
