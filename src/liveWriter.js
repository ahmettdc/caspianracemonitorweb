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

/* BAŞKA bir yazıcının taze karesi varken bu uygulama yazmaya HİÇ kalkışmamalı.
   Neden: hafif köprü (CaspianLiveBridge) kira seçimine KATILMAZ — doğrudan yazar.
   Kira-temelli seçim onu göremediğinden, uygulaması açık herhangi bir üyenin
   oto-köprüsü kirayı boş sanıp yazmaya başlıyor → iki yazıcı → tüm Canlı ekran
   kare kare yanıp sönüyor ve "Canlı kaynak" yanlış kişiyi gösteriyordu. Ayrıca
   AYNI hesabın iki penceresi kirayı ikisi de "benim" sayıyordu (uid eşit).
   Çözüm: her yazıcı kareye rastgele bir pencere kimliği (wid) koyar; bu pencereye
   ait OLMAYAN bir kare son YIELD penceresi içinde yazılmışsa boyun eğ (standby).
   Hafif köprünün karelerinde wid yok → "başkasının karesi" sayılır → hafif köprü
   her zaman kazanır. Yazıcı susarsa kare bayatlar → otomatik devralma sürer. */
export const LIVE_YIELD_MS = 7000;   // ~2.5 Hz yazıcıda 3+ kare kaçana dek bekle

export function shouldYield(remote, now, yieldMs = LIVE_YIELD_MS) {
  return !!(remote && typeof remote.ts === "number" && now - remote.ts < yieldMs);
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
