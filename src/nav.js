/* ============================================================
   nav.js — v2.0 ekran yönlendirmesi (SAF modül, React'siz)
   ------------------------------------------------------------
   v1'de gezinme iki ayrı mekanizmaya dağılmıştı: App.jsx'teki erken-return
   zinciri (entered/pickDone/setupDone/teleOnly/scheduleOnly) ve ayrı bir
   `tab` state'i. Takım · Sohbet · Telemetri · Setup havuzu modal kabuğundan
   çıkıp tam sayfa olunca tek bir yönlendirme noktası şart oldu.

   Burada yalnız SAF yardımcılar var; React state'i ve history çağrıları
   App.jsx'te. Böylece davranış vitest ile jsdom olmadan test edilebilir
   (repo deseni: state.js / engine.js).
   ============================================================ */

/* Yarış bağlamında sol raydan erişilen ekranlar. Sıra = raydaki sıra
   (README "Interactions & Behavior" → Menü / Takım / Dash / Stint / Yakıt /
   Canlı / Lastik / Pilot / Tele / Setup, altta Sohbet). */
export const RACE_SCREENS = [
  "dash", "stint", "fuel", "live", "tyre", "drivers", "tele", "setup",
];

/* Tam sayfaya taşınanlar (v1'de modaldı) + yarış sohbeti. */
export const PAGE_SCREENS = ["team", "chat", "rchat"];

/* Yarış açılmadan da girilebilen üst düzey ekranlar. */
export const LOBBY_SCREENS = ["home", "pick", "data", "official"];

export const SCREENS = [...LOBBY_SCREENS, ...RACE_SCREENS, ...PAGE_SCREENS];

/* code80 ayrı bir ekran değil — StintTab'in ikinci modu (v1 davranışı korunur). */
export const STINT_SCREENS = ["stint", "code80"];

export function isScreen(s) {
  return SCREENS.includes(s) || s === "code80";
}

/* Bilinmeyen/boş değeri güvenli bir ekrana indirger. */
export function normalizeScreen(s, fallback = "home") {
  return isScreen(s) ? s : fallback;
}

/* Ekran "yarış çalışma alanı" içinde mi — kabuk (ray + yarış çubuğu) buna göre çizilir. */
export function isWorkspaceScreen(s) {
  return RACE_SCREENS.includes(s) || PAGE_SCREENS.includes(s) || s === "code80";
}

/* Birleşik sticky yarış çubuğunu gösteren ekranlar — prototipteki
   `isRace: ["live","dash","stint","fuel","tyre","drivers"]` ile BİREBİR aynı.
   Telemetri, Setup havuzu, Takım ve Sohbet yarıştan bağımsız içerik gösterdiği
   için çubuk çizilmez (kendi başlıkları var). */
export const RACEBAR_SCREENS = ["dash", "stint", "fuel", "live", "tyre", "drivers"];

export function showsRaceBar(s) {
  return RACEBAR_SCREENS.includes(s) || s === "code80" || s === "rchat";
}

/* --- Geri yığını ------------------------------------------------------------
   Tarayıcı geri tuşu ve masaüstü (Tauri) aynı davransın diye ekran geçmişi
   uygulama tarafında da tutulur: açık pencereyi kapatmak yerine ÖNCEKİ EKRANA
   dönülür. Aynı ekrana arka arkaya gidiş yığına yazılmaz. */
export function pushScreen(stack, next) {
  const cur = stack[stack.length - 1];
  if (cur === next) return stack;
  return [...stack, next].slice(-30);
}

/* Bir adım geri; yığın tek elemanlıysa olduğu gibi kalır. */
export function popScreen(stack) {
  if (stack.length <= 1) return { stack, screen: stack[0] || "home" };
  const next = stack.slice(0, -1);
  return { stack: next, screen: next[next.length - 1] };
}

/* --- URL eşlemesi -----------------------------------------------------------
   Tauri'de de çalışsın diye hash kullanılır (pathname yok). */
export function hashForScreen(s) {
  return `#/${normalizeScreen(s)}`;
}

export function screenFromHash(hash, fallback = "home") {
  const raw = String(hash || "").replace(/^#\/?/, "").split("?")[0];
  return normalizeScreen(raw, fallback);
}
