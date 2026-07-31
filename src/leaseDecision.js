/* Canlı köprü — bir kare için yazma kararı (saf, bağımlılıksız → birim test edilebilir).
   Aynı yarışa birden çok köprü yazarsa (bir sürücü sürerken başka üye izlemek için
   oyuna girince) kareler birbirini ezer. Karar sırası:
     - saha yoksa (oyun kapalı / seans yok, 0 araç) → yazma
     - driving === false (izleyici / garaj / spectator) → yazma, çakışmayı önle
     - yazma kilidi başkasındaysa (held false) → yazma (devir örtüşmesinde tek yazar)
     - aksi → yaz
   held: bu PC yazma kilidini (lease) tutuyor mu (liveLockClaim sonucu). */
export function leaseDecision(frame, held) {
  if (!frame || !Array.isArray(frame.field) || frame.field.length === 0) return "skip-empty";
  if (frame.driving === false) return "skip-spectator";
  if (!held) return "skip-other";
  return "write";
}
