import { describe, it, expect } from "vitest";
import { parseSvm, setupSummary, b64ToText, diffSetups, categorizeSetup } from "./setupParse";

/* Kullanıcının paylaştığı gerçek LMU_Porsche_LMGT3.svm'den kesitler. */
const SAMPLE = `VehicleClassSetting="GT3 Porsche_911_GT3_R_LMGT3 WEC2024"
UpgradeSetting=(3171,0,0,0)
//VEH=C:\\Program Files (x86)\\Steam\\steamapps\\common\\Le Mans Ultimate\\Installed\\Vehicles\\911GT3R_2024\\1.05\\91_24_MANT4FC2B6C0.VEH
//Note: settings commented out if using the default

[GENERAL]
Notes=""
Symmetric=1
FuelSetting=82//0.83
VirtualEnergySetting=100//100% (19.8 laps)
CGRearSetting=0//Non-adjustable

[FRONTWING]
FWSetting=0//Standard

[REARWING]
RWSetting=2//8.3 deg

[SUSPENSION]
FrontAntiSwaySetting=7//P7 (hard)
RearAntiSwaySetting=3//P3
ChassisAdj00Setting=0//N/A

[CONTROLS]
RearBrakeSetting=43//46.2:53.8
BrakePressureSetting=80//120 kgf (100%)
AntilockBrakeSystemMapSetting=9//9 (Understeer)

[FRONTLEFT]
CamberSetting=24//-2.0 deg
PressureSetting=0//140 kPa
RideHeightSetting=0//5.0 cm
CompoundSetting=0//91% Medium

[REARLEFT]
CamberSetting=29//-1.5 deg
PressureSetting=0//140 kPa
RideHeightSetting=12//6.2 cm

[DRIVELINE]
DiffPreloadSetting=200//250 Nm
Gear1Setting=0//Fixed
`;

describe("parseSvm", () => {
  const p = parseSvm(SAMPLE);

  it("geçerli .svm için ok=true", () => {
    expect(p.ok).toBe(true);
  });

  it("ARKA KANAT değerini // etiketiyle okur (kullanıcının sorusu)", () => {
    const rw = p.rows.find((r) => r.section === "REARWING" && r.key === "RWSetting");
    expect(rw).toBeTruthy();
    expect(rw.raw).toBe("2");
    expect(rw.label).toBe("8.3 deg");
    expect(rw.meaningful).toBe(true);
  });

  it("çeşitli alanları doğru çözer", () => {
    const get = (sec, key) => p.rows.find((r) => r.section === sec && r.key === key)?.label;
    expect(get("FRONTWING", "FWSetting")).toBe("Standard");
    expect(get("SUSPENSION", "FrontAntiSwaySetting")).toBe("P7 (hard)");
    expect(get("CONTROLS", "RearBrakeSetting")).toBe("46.2:53.8");
    expect(get("FRONTLEFT", "PressureSetting")).toBe("140 kPa");
    expect(get("REARLEFT", "RideHeightSetting")).toBe("6.2 cm");
    expect(get("DRIVELINE", "DiffPreloadSetting")).toBe("250 Nm");
  });

  it("gürültü (N/A / Non-adjustable / Fixed) meaningful:false", () => {
    const noise = p.rows.filter((r) => !r.meaningful).map((r) => r.label);
    expect(noise).toContain("N/A");
    expect(noise).toContain("Non-adjustable");
    expect(noise).toContain("Fixed");
    // gerçek değerler meaningful kalır
    expect(p.rows.find((r) => r.key === "RWSetting").meaningful).toBe(true);
  });

  it("bölümlere gruplar + araç adını VEH yolundan yakalar", () => {
    expect(Object.keys(p.bySection)).toEqual(expect.arrayContaining(
      ["GENERAL", "REARWING", "SUSPENSION", "CONTROLS", "FRONTLEFT"]));
    expect(p.vehicle).toContain("91_24_MANT4FC2B6C0");
  });

  it("tırnaklı boş değer (Notes=\"\") soyulur", () => {
    const n = p.rows.find((r) => r.key === "Notes");
    expect(n.raw).toBe("");
  });

  it("LMU setup'ı olmayan metin → ok=false", () => {
    expect(parseSvm("merhaba dünya, bu bir setup değil").ok).toBe(false);
    expect(parseSvm("").ok).toBe(false);
    expect(parseSvm(null).ok).toBe(false);
  });
});

describe("setupSummary", () => {
  it("küratörlü özet — Arka Kanat = 8.3 deg", () => {
    const sum = setupSummary(parseSvm(SAMPLE));
    const rw = sum.find((x) => x.label === "Arka Kanat");
    expect(rw.value).toBe("8.3 deg");
    expect(sum.find((x) => x.label === "Ön ARB").value).toBe("P7 (hard)");
    expect(sum.find((x) => x.label === "Fren Dengesi").value).toBe("46.2:53.8");
    expect(sum.find((x) => x.label === "VE").value).toBe("100% (19.8 laps)");
  });

  it("ok değilse boş", () => {
    expect(setupSummary({ ok: false })).toEqual([]);
    expect(setupSummary(null)).toEqual([]);
  });
});

describe("categorizeSetup", () => {
  const cats = categorizeSetup(parseSvm(SAMPLE));
  const byCat = Object.fromEntries(cats.map((c) => [c.cat, c.rows]));
  const find = (cat, key) => (byCat[cat] || []).find((r) => r.key === key);

  it("ham bölüm/anahtarları dostça kategorilere toplar", () => {
    expect(find("aero", "RWSetting").value).toBe("8.3 deg");     // REARWING → aero
    expect(find("aero", "FWSetting").value).toBe("Standard");
    expect(find("engine", "VirtualEnergySetting").value).toBe("100% (19.8 laps)"); // GENERAL → engine
    expect(find("brake", "RearBrakeSetting").value).toBe("46.2:53.8");             // CONTROLS → brake
    expect(find("elec", "AntilockBrakeSystemMapSetting").value).toBe("9 (Understeer)"); // key → elec
    expect(find("diff", "DiffPreloadSetting").value).toBe("250 Nm");
    expect(find("susp", "FrontAntiSwaySetting").value).toBe("P7 (hard)");
  });

  it("köşe (FRONTLEFT/REARLEFT) eş anahtarları tek axle satırında ÖN·ARKA birleştirir", () => {
    const camber = find("align", "CamberSetting");
    expect(camber.kind).toBe("axle");
    expect(camber.front).toBe("-2.0 deg");   // FRONTLEFT
    expect(camber.rear).toBe("-1.5 deg");    // REARLEFT
    const ride = find("susp", "RideHeightSetting");
    expect(ride.kind).toBe("axle");
    expect(ride.front).toBe("5.0 cm");
    expect(ride.rear).toBe("6.2 cm");
  });

  it("gürültü varsayılan gizli; all=true ile dahil; ok değilse boş", () => {
    // N/A satırları (ChassisAdj, CGRear) varsayılan görünmez
    const withNoise = categorizeSetup(parseSvm(SAMPLE), true);
    const allKeys = withNoise.flatMap((c) => c.rows.map((r) => r.key));
    expect(allKeys).toContain("CGRearSetting");
    const noNoise = cats.flatMap((c) => c.rows.map((r) => r.key));
    expect(noNoise).not.toContain("CGRearSetting");
    expect(categorizeSetup({ ok: false })).toEqual([]);
    expect(categorizeSetup(null)).toEqual([]);
  });
});

describe("diffSetups", () => {
  /* SAMPLE'ın "düşük kanat" varyantı: RW 2→1, ön basınç 140→145; FrontAntiSway satırı
     YOK (yalnız A'da); DRIVELINE'a yalnız B'de olan Gear2Setting eklendi. */
  const SAMPLE_B = SAMPLE
    .replace("RWSetting=2//8.3 deg", "RWSetting=1//6.9 deg")
    .replace("PressureSetting=0//140 kPa\nRideHeightSetting=0//5.0 cm",
      "PressureSetting=1//145 kPa\nRideHeightSetting=0//5.0 cm")
    .replace("FrontAntiSwaySetting=7//P7 (hard)\n", "")
    .replace("DiffPreloadSetting=200//250 Nm",
      "DiffPreloadSetting=200//250 Nm\nGear2Setting=3//14/34 (bumped)");
  const d = diffSetups(parseSvm(SAMPLE), parseSvm(SAMPLE_B));
  const row = (sec, key) => d.find((r) => r.section === sec && r.key === key);

  it("farklı değer differ=true, insan etiketleri a/b'de", () => {
    expect(row("REARWING", "RWSetting")).toEqual({
      section: "REARWING", key: "RWSetting", a: "8.3 deg", b: "6.9 deg", differ: true });
    expect(row("FRONTLEFT", "PressureSetting").differ).toBe(true);
    expect(row("FRONTLEFT", "PressureSetting").b).toBe("145 kPa");
  });

  it("aynı değer differ=false", () => {
    expect(row("CONTROLS", "RearBrakeSetting")).toMatchObject({
      a: "46.2:53.8", b: "46.2:53.8", differ: false });
    expect(row("REARLEFT", "RideHeightSetting").differ).toBe(false);
  });

  it("yalnız birinde olan alan differ=true, diğer taraf —", () => {
    expect(row("SUSPENSION", "FrontAntiSwaySetting")).toMatchObject({
      a: "P7 (hard)", b: "—", differ: true });                    // yalnız A'da
    expect(row("DRIVELINE", "Gear2Setting")).toMatchObject({
      a: "—", b: "14/34 (bumped)", differ: true });               // yalnız B'de
  });

  it("gürültü (N/A / Non-adjustable / Fixed) diff'e girmez", () => {
    expect(row("SUSPENSION", "ChassisAdj00Setting")).toBeUndefined();
    expect(row("GENERAL", "CGRearSetting")).toBeUndefined();
    expect(row("DRIVELINE", "Gear1Setting")).toBeUndefined();
  });

  it("özdeş dosyalar → hiç differ yok; bozuk girdi patlamaz", () => {
    const same = diffSetups(parseSvm(SAMPLE), parseSvm(SAMPLE));
    expect(same.length).toBeGreaterThan(0);
    expect(same.every((r) => !r.differ)).toBe(true);
    expect(diffSetups(null, null)).toEqual([]);
    expect(diffSetups(parseSvm(SAMPLE), { ok: false })
      .every((r) => r.b === "—" && r.differ)).toBe(true);
  });
});

describe("b64ToText", () => {
  it("base64 → metin round-trip (UTF-8)", () => {
    const txt = "[REARWING]\nRWSetting=2//8.3 deg\nNot=düşük kanat";
    const b64 = Buffer.from(txt, "utf-8").toString("base64");
    expect(b64ToText(b64)).toBe(txt);
  });
  it("bozuk base64 → boş dize (çökmez)", () => {
    expect(b64ToText("@@@not-base64@@@")).toBe("");
    expect(b64ToText(null)).toBe("");
  });
});
