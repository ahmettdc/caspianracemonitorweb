import { describe, it, expect } from "vitest";
import { parseSvm, setupSummary, b64ToText } from "./setupParse";

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
