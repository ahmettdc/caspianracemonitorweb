/* ============================================================
   MERKEZİ ASSET ERİŞİMİ — takım görselleri (v1.7.0)
   ------------------------------------------------------------
   teams/{tid}/assets = {
     logo: dataURI,
     cars: { "{cls}_{carId}": { top: dataURI, side: dataURI } }
   }
   Tüm tüketiciler (pick ekranı, Dash, header, LiveTab OwnCar, PDF) araç
   görselini BURADAN çözer: özel yükleme varsa o, yoksa statik asset fallback
   (side → assets/cars/{cls}/{id}.png, top → assets/cartop/default.png).
   Saf modül — vitest'te test edilir.
   ============================================================ */
import { ASSET, carImg } from "./constants";

/* Araç anahtarı sınıf+id birleşimi — aynı id birden çok sınıfta var (ferrari). */
export const carAssetKey = (cls, id) => `${cls}_${id}`;

/* angle: "side" | "top". Özel görsel → o; yoksa statik fallback. */
export function carImageSrc(assets, cls, id, angle) {
  const custom = assets?.cars?.[carAssetKey(cls, id)]?.[angle];
  if (typeof custom === "string" && custom.startsWith("data:image/")) return custom;
  return angle === "top" ? `${ASSET}cartop/default.png` : carImg(cls, id);
}

/* Takım logosu — yoksa "" (çağıran fallback ikonu gösterir). */
export function teamLogoSrc(assets) {
  const v = assets?.logo;
  return typeof v === "string" && v.startsWith("data:image/") ? v : "";
}
