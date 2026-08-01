/* ============================================================
   LASTİK GÖSTERİMİ — saf biçimleyiciler (React/Firebase bağımsız)
   ------------------------------------------------------------
   Saha tablosundaki Lastik sütunu tek bir yüzde gösteriyor: dört tekerin EN KÖTÜSÜ.
   Bu, "rakip pit'te kaç lastik değiştirdi" sorusunu cevaplayamaz — o yüzden köprü
   artık köşe köşe aşınma (`tyres4`), bileşim (`tyreComp`) ve son pitteki değişimi
   (`tyreChange`) da gönderiyor. Burası yalnız bunları OKUNUR metne çevirir;
   tespitin kendisi köprüdedir (Aggregator.tyre_change), çünkü durum gerektirir.
   tyreInfo.test.js doğrudan test eder.
   ============================================================ */

export const CORNER_LBL = { fl: "ÖnSol", fr: "ÖnSağ", rl: "ArkaSol", rr: "ArkaSağ" };
const ORDER = ["fl", "fr", "rl", "rr"];

/* Rakip telemetrisi online yarışta güncellenmeyebilir; bu kadar geriye düşmüş bir
   kare artık "canlı" sayılmaz (donmuş aşınmayı gerçekmiş gibi göstermeyelim). */
export const TELE_STALE_SEC = 1.0;

export function teleStale(lag) {
  const v = Number(lag);
  return Number.isFinite(v) && Math.abs(v) >= TELE_STALE_SEC;
}

/* Dört köşe + bileşim → tooltip metni. Veri yoksa "" (tooltip gösterilmez).
   `t` verilmezse Türkçe kaynak metin döner (i18n deseni: anahtar = Türkçe). */
export function tyreTitle(row, t = (s) => s) {
  const t4 = row?.tyres4;
  const parts = [];
  if (Array.isArray(t4) && t4.length >= 4) {
    parts.push(ORDER.map((c, i) => {
      const v = Number(t4[i]);
      return `${t(CORNER_LBL[c])} ${Number.isFinite(v) ? Math.round(v * 100) : "—"}%`;
    }).join(" · "));
  }
  if (row?.tyreComp) parts.push(`${t("Bileşim")}: ${row.tyreComp}`);
  if (teleStale(row?.teleLag)) {
    parts.push(`⚠ ${t("Bu aracın telemetrisi")} ${Math.abs(Number(row.teleLag)).toFixed(1)} `
      + t("sn geride — değer bayat olabilir"));
  }
  return parts.join("\n");
}

/* Son pitteki lastik değişimi → kısa rozet + açıklama.
   n=0 ise "lastik değişmedi" (yakıt-only durak) — bu da stratejik bilgidir. */
export function tyreChangeBadge(change, t = (s) => s) {
  if (!change || !Number.isFinite(Number(change.n))) return null;
  const n = Number(change.n);
  const corners = Array.isArray(change.corners) ? change.corners : [];
  const named = corners.map((c) => t(CORNER_LBL[c] || c));
  const side = shortSide(corners);
  let txt;
  if (n === 0 || n === 4) txt = String(n);
  else txt = `${n} ${side ? t(side) : ""}`.trim();
  const why = n === 0 ? t("Son pitte lastik değişmedi (yalnız yakıt/servis)")
    : `${t("Son pitte")} ${n} ${t("lastik değişti")}: ${named.join(" · ")}`;
  return { txt, title: change.comp ? `${why}\n${t("Bileşim")} → ${change.comp}` : why,
    comp: change.comp || null, n };
}

/* İki lastik hep bir tarafı/ekseni oluşturur — pit duvarında "ÖN"/"SAĞ" okumak
   köşe adlarını okumaktan hızlıdır. Kalıp tutmuyorsa boş döner (rozet yalnız sayı). */
function shortSide(corners) {
  const s = [...corners].sort().join(",");
  if (s === "fl,fr") return "ÖN";
  if (s === "rl,rr") return "ARKA";
  if (s === "fr,rr") return "SAĞ";
  if (s === "fl,rl") return "SOL";
  return "";
}
