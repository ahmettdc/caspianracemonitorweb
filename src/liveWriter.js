/* ============================================================
   Tek-yazıcı seçimi — SAF karar mantığı (Firebase'siz, test edilebilir)
   ------------------------------------------------------------
   Aynı yarışta birden çok masaüstü köprüsü (ör. ayrı PC'lerdeki co-sürücüler)
   canlı düğüme aynı anda yazıp çakışmasın diye tek bir "yazıcı kirası" tutulur:
   teams/{tid}/livewriter/{rid} = { uid, by, driving, ts }.

   Bu modül yalnız KARARI verir (yan etkisiz): eldeki kirayı ve kendi durumumuzu
   alıp "bu makine kareyi yazmalı mı" sorusunu yanıtlar. Firebase transaction'ı
   (storage.js/liveWriterClaim) ayrı; böylece bu mantık birim testlerle kilitlenir.
   ============================================================ */

/* Kira, son tazelemeden bu kadar süre geçince "bayat" sayılır → başka makine
   devralabilir. Köprü ~2.5 Hz yazar, oyun kapanınca kare gelmez → kira tazelenmez. */
export const LIVE_WRITER_STALE_MS = 6000;

/* Bu makine kirayı almalı/tazelemeli mi?
   - mine:    kira zaten benim → tazele.
   - stale:   kira yok veya son tazeleme > staleMs → al (devir).
   - preempt: BEN aktif sürücüyüm (driving) ve kirayı tutan sürmüyorsa → önceliklendir.
   Aksi halde başkası aktif → dokunma (false).
   `now` server ile hizalı ms olmalı (storage.js/serverNow) — PC saat kayması etkilemez. */
export function shouldClaim(lease, uid, driving, now, staleMs = LIVE_WRITER_STALE_MS) {
  if (!uid) return false;                        // kimliksiz seçim yapılmaz
  const mine = !!lease && lease.uid === uid;
  const stale = !lease || (typeof lease.ts === "number" && now - lease.ts > staleMs);
  const preempt = !!driving && !!lease && !lease.driving && lease.uid !== uid;
  return mine || stale || preempt;
}

/* Saha (field) boşken köprü kartında NE söylenmeli? Sidecar'ın _diag.wait'i üç
   durumu ayırır — en kritiği "noplugin": Windows mmap eksik mapping'i sıfırlarla
   kendisi oluşturduğundan eklenti DLL'i kurulu/etkin değilken köprü "çalışıyor"
   görünür; eski tek mesaj ("Oyun/seans bekleniyor…") bunu menü beklemesinden ayırt
   edemiyordu. Eski sidecar (wait alanı yok) → generic (geriye uyum).
   Dönen: { key: "noplugin"|"menu"|"novehicles"|"generic", warn: bool }. */
export function bridgeWaitInfo(diag) {
  const w = diag?.wait;
  if (w === "noplugin") return { key: "noplugin", warn: true };
  if (w === "menu") return { key: "menu", warn: false };
  if (w === "novehicles") return { key: "novehicles", warn: false };
  return { key: "generic", warn: false };
}
