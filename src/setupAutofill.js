/* ============================================================
   setupAutofill — .svm dosyasından sınıf/araç otomatik algılama
   ------------------------------------------------------------
   Dosyanın ilk satırı aracı zaten söylüyor:
     VehicleClassSetting="GT3 Porsche_911_GT3_R_LMGT3 WEC2024"
   parseSvm bu satırı section:"" altında {key:"VehicleClassSetting", raw:"GT3 …"}
   olarak yakalar (tırnaklar soyulmuş). Buradan uygulamanın sınıf/araç id'lerine
   eşleriz → setup yükleme formu kendiliğinden dolar.
   Saf (React'siz) → birim test edilebilir. Desen: setupParse.js / setupPool.js.
   ============================================================ */
import { classId, CARS, brandKey } from "./constants";

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/* "GT3 Porsche_911_GT3_R_LMGT3 WEC2024" → { cls:"gt3", car:"porsche" } ya da null.
   İlk kelime sınıfı verir (classId toleranslı: GT3/LMGT3/Hypercar/LMH…); kalan
   metinde katalog aracının markası aranır (id + brandKey). Eşleşmezse null —
   uydurma yok, kullanıcı elle seçer. */
export function matchVehicle(vehicleClassStr) {
  const s = String(vehicleClassStr || "").trim();
  if (!s) return null;
  const parts = s.split(/\s+/);
  const cls = classId(parts[0]) || classId(s);
  if (!cls || !CARS[cls]) return null;
  const hay = norm(parts.slice(1).join(" ") || s);
  if (!hay) return null;
  for (const c of CARS[cls]) {
    const keys = [norm(c.id), norm(brandKey(c.name))].filter(Boolean);
    if (keys.some((k) => hay.includes(k))) return { cls, car: c.id };
  }
  return null;
}

/* parseSvm çıktısından VehicleClassSetting satırını bul → matchVehicle. */
export function detectVehicle(parsed) {
  if (!parsed?.ok) return null;
  const row = parsed.rows.find((r) => r.key === "VehicleClassSetting");
  return row ? matchVehicle(row.raw) : null;
}
