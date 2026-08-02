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
