/* Statik veri ve saf lookuplar: pistler, araçlar, sınıflar, bayraklar,
   sürüm/asset sabitleri. App.jsx içe aktarır. */
export const SLOT_COLORS = { A: "#40D68C", B: "#F0604D", C: "#F2A33C", D: "#6694FF" };

/* ---------- pist & araç seçimi ---------- */
export const APP_VERSION = "v1.4.6";   // tek kaynak — sürüm yazısı buradan
export const REPO_URL = "https://github.com/ahmettdc/caspianracemonitorweb";
export const SEEN_VER_KEY = "rm_seen_version";
export const ASSET = import.meta.env.BASE_URL + "assets/";
export const AV = "?v=3"; // görsel sürümü — dosya güncellenince artır (önbellek kırma)
export const TRACKS = [
  { id: "lemans", name: "Le Mans" },
  { id: "spa", name: "Spa-Francorchamps" },
  { id: "spa-endurance", name: "Spa (Endurance)" },
  { id: "monza", name: "Monza" },
  { id: "imola", name: "Imola" },
  { id: "silverstone", name: "Silverstone" },
  { id: "paulricard", name: "Paul Ricard" },
  { id: "portimao", name: "Portimão" },
  { id: "barcelona", name: "Barcelona" },
  { id: "bahrain", name: "Bahrain" },
  { id: "lusail", name: "Lusail" },
  { id: "fuji", name: "Fuji" },
  { id: "cota", name: "COTA" },
  { id: "sebring", name: "Sebring" },
  { id: "interlagos", name: "Interlagos" },
  { id: "daytona", name: "Daytona" },
  { id: "lagunaseca", name: "Laguna Seca" },
  { id: "watkinsglen", name: "Watkins Glen" },
  { id: "roadatlanta", name: "Road Atlanta" },
  { id: "longbeach", name: "Long Beach" },
  { id: "indianapolis", name: "Indianapolis" },
];
/* Pit yolu geçiş süreleri (sn) — LMU Endurance Planner v1.3 verisi.
   Pist seçilince pitLaneTime otomatik bu değere ayarlanır (elle değiştirilebilir).
   Listede olmayan pistlerde (Daytona vb.) mevcut değer korunur. */
export const PIT_LANE_TIMES = {
  bahrain: 27, cota: 23, fuji: 33, imola: 34, interlagos: 27,
  lemans: 31, lusail: 28, monza: 28, portimao: 31, sebring: 32,
  silverstone: 23, spa: 21, "spa-endurance": 53, paulricard: 23, barcelona: 23,
};
/* Layout varyantları için görsel eşlemesi (spa-endurance → spa görselleri) */
export const TRACK_ASSET = (id) => ({ "spa-endurance": "spa" }[id] || id);
/* pist → ülke bayrağı (emoji) */
export const TRACK_FLAG = {
  lemans: "🇫🇷", paulricard: "🇫🇷",
  spa: "🇧🇪", "spa-endurance": "🇧🇪",
  monza: "🇮🇹", imola: "🇮🇹",
  silverstone: "🇬🇧",
  portimao: "🇵🇹", barcelona: "🇪🇸",
  bahrain: "🇧🇭", lusail: "🇶🇦", fuji: "🇯🇵",
  cota: "🇺🇸", sebring: "🇺🇸", daytona: "🇺🇸", lagunaseca: "🇺🇸",
  watkinsglen: "🇺🇸", roadatlanta: "🇺🇸", longbeach: "🇺🇸", indianapolis: "🇺🇸",
  interlagos: "🇧🇷",
};
export const trackFlag = (id) => TRACK_FLAG[id] || "";
export const CARS = {
  hypercar: [
    { id: "toyota", name: "Toyota GR010" },
    { id: "ferrari", name: "Ferrari 499P" },
    { id: "porsche", name: "Porsche 963" },
    { id: "cadillac", name: "Cadillac V-Series.R" },
    { id: "bmw", name: "BMW M Hybrid V8" },
    { id: "alpine", name: "Alpine A424" },
    { id: "peugeot", name: "Peugeot 9X8" },
    { id: "astonmartin", img: "aston", name: "Aston Martin Valkyrie" },
    { id: "lamborghini", name: "Lamborghini SC63" },
    { id: "isotta", name: "Isotta Fraschini Tipo 6" },
    { id: "glickenhaus", name: "Glickenhaus SCG 007" },
    { id: "vanderwell", name: "Vanwall Vandervell 680" },
    { id: "genesis", name: "Genesis GMR-001" },
  ],
  lmp2: [
    { id: "oreca", img: "oreca07", name: "Oreca 07 Gibson" },
  ],
  lmp3: [
    { id: "ligier", name: "Ligier JS P320" },
    { id: "duqueine", name: "Duqueine D08" },
    { id: "adess", name: "ADESS AD25" },
  ],
  gte: [
    { id: "ferrari", name: "Ferrari 488 GTE Evo" },
    { id: "porsche", name: "Porsche 911 RSR-19" },
    { id: "aston", name: "Aston Martin Vantage AMR" },
    { id: "corvette", name: "Corvette C8.R" },
  ],
  gt3: [
    { id: "ferrari", name: "Ferrari 296 GT3" },
    { id: "porsche", name: "Porsche 911 GT3 R" },
    { id: "bmw", name: "BMW M4 GT3" },
    { id: "mercedes", name: "Mercedes-AMG GT3" },
    { id: "mclaren", name: "McLaren 720S GT3" },
    { id: "corvette", name: "Corvette Z06 GT3.R" },
    { id: "lexus", name: "Lexus RC F GT3" },
    { id: "ford", name: "Ford Mustang GT3" },
    { id: "aston", name: "Aston Martin Vantage GT3" },
  ],
};
/* ---------- i18n: Türkçe metin anahtar, EN sözlükten çevrilir ---------- */
/* EN çeviri sözlüğü → ./i18n.js (aşağıda/yukarıda import edildi). */

export const CAR_CLASSES = [
  ["hypercar", "Hypercar"], ["lmp2", "LMP2"], ["lmp3", "LMP3"],
  ["gte", "GTE"], ["gt3", "GT3"],
];
export const trackName = (id) => TRACKS.find((t) => t.id === id)?.name || "";
export const carName = (cls, id) => CARS[cls]?.find((c) => c.id === id)?.name || "";
/* araç görseli: dosya adı id'den farklıysa CARS girişindeki img alanı kullanılır */
export const carImg = (cls, id) => {
  const c = CARS[cls]?.find((x) => x.id === id);
  return `${ASSET}cars/${cls}/${c?.img || id}.png`;
};
/* ---- grafik yardımcıları (App + components ortak) ----
   BADGES/teamBadgesOf/hasBadge JSX (<Wheel/>) içerdiği için ./components.jsx'te. */
export const PIE_COLORS = ["#2DD4BF", "#F2C94C", "#960018", "#9B6DFF", "#4C9AFF",
  "#FF8A3D", "#59C36A", "#EC5CA6", "#00B8D9", "#C0CA33"];
export const quantile = (sorted, q) => {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};

/* Masaüstü uygulaması (Tauri) — installer dosya adı sürümle değiştiği için
   sabit bir dosya linki yerine Releases sayfasına yönlendirir; sonraki
   sürümler uygulama içi updater ile gelir (UpdateBanner). */
export const DESKTOP_RELEASE_URL =
  "https://github.com/ahmettdc/caspianracemonitorweb/releases/latest";
