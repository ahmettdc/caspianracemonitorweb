/* ============================================================
   setupParse — LMU (.svm) setup dosyasını çözümle
   ------------------------------------------------------------
   LMU/rFactor2 oyuncu setup'ları DÜZ METİN: [BÖLÜM] başlıkları + "Anahtar=Değer//etiket"
   satırları. İnsana dönük değer satırın // yorumunda hazır yazar (ör. RWSetting=2//8.3 deg),
   bu yüzden araç-başına aralık tablosuna gerek yoktur. Saf (React'siz) → birim test edilebilir.
   Desen: engine.js / setupPool.js.
   ============================================================ */

/* base64 → metin (UTF-8 güvenli; Notes Türkçe olabilir). downloadSetup atob/Uint8Array deseni. */
export function b64ToText(b64) {
  try {
    const bin = atob(String(b64 || ""));
    const arr = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(arr);
  } catch {
    return "";
  }
}

/* Anlamsız (görünmeye değmez) etiketler — onlarca ChassisAdjNN=0//N/A vb. gizlenir. */
const NOISE = new Set(["N/A", "Non-adjustable", "Fixed", "Detached", ""]);

/* .svm metnini çözümle → { ok, vehicle, rows[], bySection }.
   rows: { section, key, raw, label, meaningful }.  ok=false → LMU setup'ı değil/bozuk. */
export function parseSvm(text) {
  const s = String(text || "");
  if (!s.includes("[") || !/=.*/.test(s)) return { ok: false, vehicle: "", rows: [], bySection: {} };

  const rows = [];
  const bySection = {};
  let section = "";
  let vehicle = "";

  for (const rawLine of s.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    // dosya-düzeyi yorum: VEH yolundan araç adını yakala (opsiyonel)
    if (line.startsWith("//")) {
      const m = line.match(/\\([^\\]+)\.VEH/i);
      if (m && !vehicle) vehicle = m[1];
      continue;
    }
    const sec = line.match(/^\[([^\]]+)\]$/);
    if (sec) { section = sec[1]; bySection[section] = bySection[section] || []; continue; }

    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let rest = line.slice(eq + 1);
    let label = "";
    const cm = rest.indexOf("//");
    if (cm >= 0) { label = rest.slice(cm + 2).trim(); rest = rest.slice(0, cm); }
    let raw = rest.trim().replace(/^"(.*)"$/, "$1");   // Notes="" gibi tırnakları soy
    if (!label) label = raw;                            // yorum yoksa ham değer etiket olur

    const row = { section, key, raw, label, meaningful: !NOISE.has(label) };
    rows.push(row);
    (bySection[section] = bySection[section] || []).push(row);
  }

  if (!rows.length) return { ok: false, vehicle, rows: [], bySection: {} };
  return { ok: true, vehicle, rows, bySection };
}

/* Özet: pit-duvarının hızlı bakacağı anahtar alanlar (bölüm/anahtar → TR ad). */
const SUMMARY_MAP = [
  ["FRONTWING/FWSetting", "Ön Kanat"],
  ["REARWING/RWSetting", "Arka Kanat"],
  ["FRONTLEFT/RideHeightSetting", "Ön Yükseklik"],
  ["REARLEFT/RideHeightSetting", "Arka Yükseklik"],
  ["FRONTLEFT/PressureSetting", "Ön Basınç"],
  ["REARLEFT/PressureSetting", "Arka Basınç"],
  ["FRONTLEFT/CamberSetting", "Ön Kamber"],
  ["REARLEFT/CamberSetting", "Arka Kamber"],
  ["SUSPENSION/FrontAntiSwaySetting", "Ön ARB"],
  ["SUSPENSION/RearAntiSwaySetting", "Arka ARB"],
  ["CONTROLS/RearBrakeSetting", "Fren Dengesi"],
  ["CONTROLS/BrakePressureSetting", "Fren Basıncı"],
  ["CONTROLS/TractionControlMapSetting", "TC"],
  ["CONTROLS/AntilockBrakeSystemMapSetting", "ABS"],
  ["DRIVELINE/DiffPreloadSetting", "Diff Preload"],
  ["ENGINE/EngineMixtureSetting", "Karışım"],
  ["FRONTLEFT/CompoundSetting", "Lastik"],
  ["GENERAL/VirtualEnergySetting", "VE"],
  ["GENERAL/FuelSetting", "Yakıt"],
];

/* İki çözümlenmiş setup'ın farkı — bölüm/anahtar birleşimi üzerinde
   [{ section, key, a, b, differ }]. Yalnız meaningful satırlar; yalnız birinde olan
   alan differ=true, diğer taraf "—". Değer karşılaştırması İNSAN etiketi (label)
   üzerinden: aynı ham indeks farklı araçlarda farklı gerçek değere denk gelebilir,
   pit duvarının kıyasladığı şey etikettir (ör. "8.3 deg" ↔ "7.1 deg"). */
export function diffSetups(parsedA, parsedB) {
  const rowsA = parsedA?.ok ? parsedA.rows.filter((r) => r.meaningful) : [];
  const rowsB = parsedB?.ok ? parsedB.rows.filter((r) => r.meaningful) : [];
  const idxB = new Map();
  for (const r of rowsB) idxB.set(`${r.section}/${r.key}`, r);
  const out = [];
  const seen = new Set();
  for (const r of rowsA) {                       // A'nın dosya sırası esas
    const k = `${r.section}/${r.key}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const rb = idxB.get(k);
    out.push({ section: r.section, key: r.key, a: r.label,
      b: rb ? rb.label : "—", differ: !rb || rb.label !== r.label });
  }
  for (const r of rowsB) {                       // yalnız B'de olanlar sona
    const k = `${r.section}/${r.key}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ section: r.section, key: r.key, a: "—", b: r.label, differ: true });
  }
  return out;
}

/* ---- Kategori gruplama (§9) — ham bölüm/anahtarları dostça kategorilere topla ----
   Anahtar → kategori (birincil); bulunmazsa bölüm → kategori (yedek); o da yoksa "other".
   Böylece hiçbir alan kaybolmaz (tam kapsama). SAF — test edilebilir. */
const FIELD_CAT = {
  FWSetting: "aero", RWSetting: "aero", WaterRadiatorSetting: "aero",
  OilRadiatorSetting: "aero", BrakeDuctSetting: "aero", BrakeDuctRearSetting: "aero",
  PressureSetting: "tyre", CompoundSetting: "tyre",
  FrontAntiSwaySetting: "susp", RearAntiSwaySetting: "susp", SpringSetting: "susp",
  RideHeightSetting: "susp", SlowBumpSetting: "susp", FastBumpSetting: "susp",
  SlowReboundSetting: "susp", FastReboundSetting: "susp",
  CamberSetting: "align", FrontToeInSetting: "align", RearToeInSetting: "align",
  SteerLockSetting: "align",
  RearBrakeSetting: "brake", BrakeMigrationSetting: "brake", BrakePressureSetting: "brake",
  DiffPreloadSetting: "diff",
  TractionControlMapSetting: "elec", TCPowerCutMapSetting: "elec",
  TCSlipAngleMapSetting: "elec", AntilockBrakeSystemMapSetting: "elec",
  FuelSetting: "engine", VirtualEnergySetting: "engine", EngineMixtureSetting: "engine",
  RevLimitSetting: "engine",
};
const SECTION_CAT = {
  FRONTWING: "aero", REARWING: "aero", BODYAERO: "aero",
  SUSPENSION: "susp", CONTROLS: "brake", DRIVELINE: "diff", ENGINE: "engine", GENERAL: "engine",
};
/* Kategori sırası + kimliği (görsel meta component'te — burada yalnız id/sıra). */
export const SETUP_CATS = ["aero", "tyre", "susp", "align", "brake", "diff", "elec", "engine", "other"];
const CORNER = /^(FRONT|REAR)(LEFT|RIGHT)$/;

/* parsed → [{ cat, rows:[{ key, kind:"single"|"axle", value?, front?, rear? }] }] (dolu kategoriler,
   SETUP_CATS sırasında). Köşe bölümlerindeki (FRONTLEFT/REARLEFT…) eş anahtarlar tek "axle" satırında
   ÖN·ARKA olarak birleşir (LEFT tarafı temsilci; yoksa RIGHT). `all=true` → gürültü satırları da dahil. */
export function categorizeSetup(parsed, all = false) {
  if (!parsed?.ok) return [];
  const buckets = {};            // cat -> { order:[key], single:{key:value}, axle:{key:{front,rear}} }
  const bucket = (c) => (buckets[c] = buckets[c] || { order: [], single: {}, axle: {} });
  for (const r of parsed.rows) {
    if (!all && !r.meaningful) continue;
    const cat = FIELD_CAT[r.key] || SECTION_CAT[r.section] || "other";
    const b = bucket(cat);
    const m = r.section.match(CORNER);
    if (m) {
      const side = m[1] === "FRONT" ? "front" : "rear";
      const ax = b.axle[r.key] || (b.axle[r.key] = {});
      // LEFT tarafı öncelikli: boşsa ya da mevcut RIGHT'ten geldiyse yaz
      if (ax[side] == null || m[2] === "LEFT") ax[side] = r.label;
      if (!b.order.includes("ax:" + r.key)) b.order.push("ax:" + r.key);
    } else {
      if (b.single[r.key] == null) { b.single[r.key] = r.label; b.order.push(r.key); }
    }
  }
  const out = [];
  for (const cat of SETUP_CATS) {
    const b = buckets[cat];
    if (!b) continue;
    const rows = b.order.map((o) => o.startsWith("ax:")
      ? { key: o.slice(3), kind: "axle", front: b.axle[o.slice(3)].front ?? "—",
          rear: b.axle[o.slice(3)].rear ?? "—" }
      : { key: o, kind: "single", value: b.single[o] });
    if (rows.length) out.push({ cat, rows });
  }
  return out;
}

/* parseSvm çıktısından küratörlü özet → [{ label, value }] (bulunmayan alan atlanır). */
export function setupSummary(parsed) {
  if (!parsed?.ok) return [];
  const idx = {};
  for (const r of parsed.rows) idx[`${r.section}/${r.key}`] = r.label;
  const out = [];
  for (const [path, label] of SUMMARY_MAP) {
    const v = idx[path];
    if (v != null && !NOISE.has(v)) out.push({ label, value: v });
  }
  return out;
}

/* ---------- DuckDB gömülü setup (VM_/WM_ JSON) → parseSvm şekli (v1.5.2) ----------
   LMU .duckdb'sinin metadata.CarSetup'ı `.svm` değil, VM_/WM_ anahtarlı JSON'dur
   (her değer {stringValue,...}). Aşağıdaki eşleme onu parseSvm'in ürettiği
   { section, key, label } satırlarına çevirir → categorizeSetup/setupSummary/
   SVM_FIELDS AYNEN çalışır (Setup İçerik penceresiyle tek düzen). */
const DUCK_MAP = {   // VM_<...> → [SECTION, Key]
  VM_FRONT_WING: ["FRONTWING", "FWSetting"], VM_REAR_WING: ["REARWING", "RWSetting"],
  VM_BRAKE_BALANCE: ["CONTROLS", "RearBrakeSetting"],
  VM_BRAKE_PRESSURE: ["CONTROLS", "BrakePressureSetting"],
  VM_BRAKE_MIGRATION: ["CONTROLS", "BrakeMigrationSetting"],
  VM_BRAKE_DUCTS: ["CONTROLS", "BrakeDuctSetting"],
  VM_BRAKE_DUCTS_REAR: ["CONTROLS", "BrakeDuctRearSetting"],
  VM_ANTILOCKBRAKESYSTEMMAP: ["CONTROLS", "AntilockBrakeSystemMapSetting"],
  VM_TRACTIONCONTROLMAP: ["CONTROLS", "TractionControlMapSetting"],
  VM_STEER_LOCK: ["CONTROLS", "SteerLockSetting"],
  VM_FRONT_ANTISWAY: ["SUSPENSION", "FrontAntiSwaySetting"],
  VM_REAR_ANTISWAY: ["SUSPENSION", "RearAntiSwaySetting"],
  VM_DIFF_PRELOAD: ["DRIVELINE", "DiffPreloadSetting"],
  VM_ENGINE_MIXTURE: ["ENGINE", "EngineMixtureSetting"],
  VM_FUEL_CAPACITY: ["GENERAL", "FuelSetting"],
  VM_VIRTUALENERGY: ["GENERAL", "VirtualEnergySetting"],
  VM_VIRTUAL_ENERGY: ["GENERAL", "VirtualEnergySetting"],
};
/* Köşe kanalları (WM_<BASE>-W_FL/FR/RL/RR) — tek anahtar, dört köşe → categorizeSetup
   ÖN·ARKA "axle" satırında birleştirir. */
const DUCK_CORNER = { PRESSURE: "PressureSetting", CAMBER: "CamberSetting", RIDEHEIGHT: "RideHeightSetting" };
const CORNER_SEC = { FL: "FRONTLEFT", FR: "FRONTRIGHT", RL: "REARLEFT", RR: "REARRIGHT" };

export function duckSetupToParsed(jsonStr) {
  let obj;
  try { obj = JSON.parse(jsonStr); } catch { return { ok: false }; }
  if (!obj || typeof obj !== "object") return { ok: false };
  const rows = [];
  const bySection = {};
  const add = (section, key, label) => {
    const lbl = label ?? "";
    rows.push({ section, key, raw: "", label: lbl, meaningful: !NOISE.has(lbl) });
    (bySection[section] = bySection[section] || []).push({ key, label: lbl });
  };
  for (const [k, v] of Object.entries(obj)) {
    const label = (v && typeof v === "object") ? (v.stringValue ?? "") : String(v ?? "");
    if (DUCK_MAP[k]) { add(DUCK_MAP[k][0], DUCK_MAP[k][1], label); continue; }
    const cm = k.match(/^WM_([A-Z0-9]+)-W_(FL|FR|RL|RR)$/);
    if (cm && DUCK_CORNER[cm[1]]) add(CORNER_SEC[cm[2]], DUCK_CORNER[cm[1]], label);
  }
  return { ok: rows.some((r) => r.meaningful), vehicle: "", rows, bySection };
}

/* Duck setup → .svm metni (Setup Havuzu bu formatı saklar/okur → tek tıkla kaydet). */
export function duckSetupToSvm(jsonStr) {
  const p = duckSetupToParsed(jsonStr);
  if (!p.ok) return "";
  const secs = {}; const order = [];
  for (const r of p.rows) {
    if (!secs[r.section]) { secs[r.section] = []; order.push(r.section); }
    secs[r.section].push(r);
  }
  let out = "//Caspian Race Monitor — telemetriden alınan setup\n";
  for (const s of order) { out += `[${s}]\n`; for (const r of secs[s]) out += `${r.key}=0//${r.label}\n`; }
  return out;
}

/* UTF-8 güvenli metin → base64 (Setup Havuzu data'sı; b64ToText'in tersi). */
export function textToB64(text) {
  return btoa(unescape(encodeURIComponent(String(text || ""))));
}
