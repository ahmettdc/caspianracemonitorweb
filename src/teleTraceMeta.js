/* ============================================================
   teleTraceMeta — kalıcı iz düğümünün META şekli (saf)
   ------------------------------------------------------------
   KÖK-NEDEN (v2.4.1): meta iki AYRI yerde, iki AYRI şekilde ele alınıyordu.

   - Yazan taraf `teleTrace/{rid}/{slot}/meta` düğümüne
     `{ at, laps, n, mapSrc, capped }` yazıyor, ama aynı anda oturum-içi
     `savedTrace[slot].meta`'ya SEANS meta'sını ({venue, vehicle, driver,
     trk, amb}) koyuyordu.
   - Okuyan taraf ise geri yüklerken `meta: node.meta` diyordu — yani DÜĞÜM
     meta'sını.

   Sonuç: aynı slot, sayfa yenilenmeden ÖNCE ve SONRA farklı şekilde geliyordu.
   Yenilemeden sonra Tur Karşılaştırma kartında pist/araç/pilot/sıcaklık satırı
   hiç çizilmiyor, PDF raporunun künyesi boş kalıyor ve en önemlisi "farklı
   pist — kıyas dikkatli" uyarısı (venDiff) kalıcı kaynaklarda ASLA
   tetiklenemiyordu. O uyarı bir veri-dürüstlüğü korumasıdır (CLAUDE.md §1) ve
   sessizce devre dışıydı: kayıtlı bir Spa stinti, yüklü bir Monza dosyasıyla
   uyarısız karşılaştırılabiliyordu.

   Çözüm iki tarafı TEK kaynağa bağlamak: seans meta'sı düğümde `sess` altında
   saklanır, okuma da oradan yapılır. Böylece şekiller bir daha ayrışamaz.
   ============================================================ */

/* Firebase'e yazılacak meta düğümü.
   @param sess  seans meta'sı ({venue, vehicle, driver, trk, amb}) — yoksa null
   Not: `at` alanı ZORUNLU ve sayı olmalı (firebase-rules.json teleTrace
   .validate kuralı bunu şart koşuyor). */
export function packTraceMeta({ laps, mapSrc = null, capped = false, sess = null,
  at = Date.now() }) {
  const node = { at, laps: Array.isArray(laps) ? laps : [],
    n: Array.isArray(laps) ? laps.length : 0, mapSrc, capped };
  /* Boş/eksik seans meta'sı YAZILMAZ — "var ama boş" bir künye, olmayan
     künyeden daha kötüdür (uydurma alan görünümü verir). */
  if (sess && typeof sess === "object" && Object.keys(sess).length) node.sess = sess;
  return node;
}

/* Düğümden SEANS meta'sını çıkar. v2.4.1 öncesi kayıtlarda `sess` yoktur →
   null döner ve künye satırı hiç çizilmez (gözlem yoksa gösterme). */
export function readTraceSess(node) {
  const sess = node?.sess;
  return sess && typeof sess === "object" && Object.keys(sess).length ? sess : null;
}

/* Düğümden tur listesi (kalıcı izin kaç turu var, süreleri ne). */
export function readTraceLaps(node, fallbackLen = 0) {
  if (Array.isArray(node?.laps)) return node.laps;
  return Array.from({ length: Math.max(0, fallbackLen) }, () => ({}));
}
