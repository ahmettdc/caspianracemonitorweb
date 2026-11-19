/* ============================================================
   YAKIT SENARYOLARI — kalıcı girdi (saf, v2.5.3)
   ------------------------------------------------------------
   KÖK NEDEN (kullanıcı bildirimi: "senaryo girdilerini yazıp başka sekmeye
   dönünce kaydetmiyor"): FuelTab senaryoları yerel `useState`'te tutuyordu.
   Sekme değişince bileşen söküldüğü için girdi her seferinde varsayılana
   dönüyordu; proje state'ine (Firebase) hiç yazılmıyordu → takım arkadaşı da
   göremiyordu.

   Çözüm: girdiler `st.fuelScen` altında saklanır. Eski davranışın İSTENEN
   yarısı korunur: tüketim değişince (ör. "Yakıt modeline uygula") senaryolar
   yeni tüketimden yeniden türetiliyordu. Bunu bir efektle state'e yazmak
   paylaşımlı kayıtta istemcileri birbirine yazdırırdı; onun yerine girdinin
   hangi tüketime göre yapıldığı (`base`) saklanır, tüketim değişmişse girdi
   bayat sayılıp OKUNURKEN yok sayılır — yazma yok.

   Birim: dahili % (cons ile aynı), ekran çevirisi FuelTab'da.
   React/Firebase bağımsız → fuelScen.test.js doğrudan test eder.
   ============================================================ */

export const SCEN_IDS = ["plan", "save", "push"];
/* Varsayılan oranlar — FuelTab'ın v2.0'dan beri kullandığı değerler. */
const FACTOR = { plan: 1, save: 0.95, push: 1.08 };

const fin = (v) => (v === null || v === "" || v === undefined ? NaN : Number(v));
const sameBase = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-6;

/* Varsayılan senaryo değeri (tüketimden türetilmiş). */
export const scenDefault = (id, cons) => {
  const c = Number(cons) || 0;
  return id === "plan" ? c : +(c * (FACTOR[id] ?? 1)).toFixed(2);
};

/* Ekranda gösterilecek senaryolar: kayıtlı girdi geçerli ve aynı tüketime
   göre yapılmışsa o, değilse türetilmiş varsayılan. */
export function resolveScen(cons, saved) {
  const s = saved && typeof saved === "object" ? saved : {};
  const fresh = sameBase(fin(s.base), Number(cons));
  const out = {};
  for (const id of SCEN_IDS) {
    const v = fin(s[id]);
    out[id] = fresh && Number.isFinite(v) && v >= 0 ? v : scenDefault(id, cons);
  }
  return out;
}

/* Bir senaryo girdisini yaz → yeni `fuelScen` nesnesi. Tüketim değişmişse
   (bayat girdi) önceki girdiler taşınmaz: ekranda zaten varsayılan görünüyorlardı,
   kullanıcının görmediği eski değerlerin geri dönmesi sürpriz olurdu. */
export function setScen(cons, saved, id, value) {
  const v = Number(value);
  if (!SCEN_IDS.includes(id) || !Number.isFinite(v) || v < 0) return saved ?? null;
  const s = saved && typeof saved === "object" ? saved : {};
  const keep = sameBase(fin(s.base), Number(cons)) ? s : {};
  const next = { base: Number(cons) };
  for (const k of SCEN_IDS) if (Number.isFinite(fin(keep[k]))) next[k] = fin(keep[k]);
  next[id] = v;
  return next;
}
