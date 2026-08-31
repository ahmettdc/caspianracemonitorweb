/* ============================================================
   YARIŞ DURUMU + PİT AŞAMASI — saf (v2.3.0)
   ------------------------------------------------------------
   İki yeni VehicleScoring alanı (bkz. bridge/rf2_source.py). İkisi de TELEMETRİ
   DEĞİL scoring alanı → online yarışta rakipler için de güvenilir (rakip
   telemetrisi donabiliyor, `tyreInfo.teleStale` tam da onun için var).

   finishStatus — struct: 0=none, 1=finished, 2=dnf, 3=dq
     v2.2.4'e kadar okunmuyordu: yarışı bırakan araç tabloda hâlâ yarışıyormuş
     gibi duruyordu (gap'i donuyor ama satır normal görünüyordu). Endurance'ta
     "kim hâlâ sahada" temel sorudur.

   pitState — struct: 0=none, 1=request, 2=entering, 3=stopped, 4=exiting
     `1` araç DAHA PİSTTEYKEN gelir → "rakip pit çağırdı ama henüz girmedi".
     Pit duvarı için erken uyarı: undercut'a karşı önden pozisyon almayı sağlar.
     Ayrıca 2/3/4 sayesinde "pitte" durumu tek bir PIT çipi yerine aşama olarak
     gösterilebiliyor.

   GERİYE UYUM: köprü .exe kullanıcı tarafından ayrı güncelleniyor; sahadaki eski
   sürümler bu alanları GÖNDERMEZ. O yüzden hepsi "yoksa null / eski davranış"
   olacak şekilde yazıldı — özellik sessizce kaybolur, hiçbir şey bozulmaz.

   React/Firebase bağımsız → liveStatus.test.js doğrudan test eder.
   ============================================================ */

/* Sayıya çevir; yoksa/bozuksa null. Number(null)===0 tuzağı: 0 burada GEÇERLİ
   bir kod ("durum yok") olduğu için eksik veriden ayrılmak zorunda. */
const code = (v) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : null;
};

/* finishStatus → "FIN" | "DNF" | "DSQ" | null (yarışta / veri yok).
   Bilinmeyen kod null döner — uydurma etiket üretme. */
export function finishLabel(c) {
  switch (code(c && c.finishStatus)) {
    case 1: return "FIN";
    case 2: return "DNF";
    case 3: return "DSQ";
    default: return null;
  }
}

/* Araç yarışı BIRAKMIŞ mı (DNF/DSQ)? "FIN" bırakma değildir — yarış bitince
   herkes 1 olur, o normaldir ve satır soluklaştırılmaz. */
export function isRetired(c) {
  const n = code(c && c.finishStatus);
  return n === 2 || n === 3;
}

/* pitState → aşama anahtarı. 0/yok → null. */
export function pitPhase(c) {
  switch (code(c && c.pitState)) {
    case 1: return "request";
    case 2: return "entering";
    case 3: return "stopped";
    case 4: return "exiting";
    default: return null;
  }
}

/* Rakip pit ÇAĞIRDI ama henüz pistte — undercut erken uyarısı. */
export function pitRequested(c) {
  return pitPhase(c) === "request";
}

/* Pit sütununda gösterilecek çip: { txt, tone } ya da null.
   tone: "warn" (çağrı — dikkat) · "pit" (pit yolunda) · null.

   YEDEK: pitState yoksa (eski köprü) eski davranışa düşer — inPits ise "PIT".
   Böylece köprü güncellenmemiş kullanıcı hiçbir şey kaybetmez. */
export function pitChip(c) {
  switch (pitPhase(c)) {
    case "request": return { txt: "ÇAĞRI", tone: "warn" };
    case "entering": return { txt: "GİRİŞ", tone: "pit" };
    case "stopped": return { txt: "DURDU", tone: "pit" };
    case "exiting": return { txt: "ÇIKIŞ", tone: "pit" };
    default:
      return c && c.inPits ? { txt: "PIT", tone: "pit" } : null;
  }
}
