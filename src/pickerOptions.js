/* ============================================================
   pickerOptions — logolu açılır liste (ImgSelect) için seçenek + ikon üretimi
   ------------------------------------------------------------
   Setup formundaki Track/Class/Car dropdown'ları native <select> yerine ImgSelect
   kullanıyor; native <option> görsel taşıyamadığı için logolar buradan gelir.
   Saf (React'siz) → birim test edilebilir. Desen: engine.js / setupPool.js.

   Her seçenek: { value, label, icon } — icon bir görsel URL'i (yoksa "").
   ============================================================ */
import {
  TRACKS, CAR_CLASSES, CARS, ASSET, TRACK_ASSET, carImg, carName, brandLogo,
} from "./constants";

/* Pist seçenekleri — ikon: ülke bayrağı PNG'i (layout varyantı spa görselini paylaşır). */
export function trackOptions() {
  return TRACKS.map((tr) => ({
    value: tr.id, label: tr.name,
    icon: `${ASSET}flags/${TRACK_ASSET(tr.id)}.png`,
  }));
}

/* Sınıf seçenekleri — ikon: sınıf rozeti (HY/P2/P3/GTE/GT3). */
export function classOptions() {
  return CAR_CLASSES.map(([id, label]) => ({
    value: id, label,
    icon: `${ASSET}class/${id}.png`,
  }));
}

/* Araç seçenekleri — ikon: MARKA logosu (kullanıcı "brand logo dahil" istedi); marka
   eşleşmezse (custom livery vb.) araç görseline düşer. cls yoksa boş liste. */
export function carOptions(cls) {
  return (CARS[cls] || []).map((c) => ({
    value: c.id, label: c.name,
    icon: brandLogo(carName(cls, c.id)) || carImg(cls, c.id),
  }));
}
