import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TeleTab from "./tabs/TeleTab.jsx";

/* TELE-FİŞİ (tele-paketi, 28 Ağu 2026) uyum testleri — telemetri ekranının
   fişten gelen görsel sözleşmesini kilitler:
     · §BS  — seans kutusundaki "Bu seansın setup'ı" butonu
     · slot — dolu stint kartında marka logosu + araç görseli
     · renk — grafik kroması tasarım tokenlarında (mavi-gri palet kalmadı) */
const t = (s) => s;

const baseSt = {
  telemetry: {
    A: { name: "Stint A", laps: [{ label: "Lap 1", ms: 139080, use: true, w: [1, 1, 1, 1] }],
      meta: { venue: "Spa", vehicle: "Ferrari 296 GT3", driver: "AD" } },
    B: null, C: null, D: null,
  },
  carClass: "gt3", car: "ferrari296", track: "spa", fuelRatio: 2.5,
};
const slotStats = { A: { laps: 18, medMs: 139080, empty: false, avgMs: 139500,
  bestMs: 138000, medFuel: 3.41, medW: [0.9, 0.9, 1.3, 1.2], tankLaps: 29,
  sdMs: 280, degMsPerLap: 80, theoMs: 137400 } };

const props = (over = {}) => ({
  t, lang: "tr", st: baseSt, slot: "A", setSlot: () => {}, onTeleFile: () => {},
  parsed: null, saveMotec: () => {}, loadedSlots: ["A"], slotStats,
  up: () => {}, apply105Slot: () => {}, removeSlot: () => {},
  chartMode: "line", setChartMode: () => {}, chartData: [{ lap: 1, A: 139 }],
  baseSlot: "A", toggleLap: () => {}, cmpMeta: null, cmpA: null, setCmpA: () => {},
  cmpB: null, setCmpB: () => {}, cmpData: null, cmpBusy: false, savedMsg: "",
  traceSaving: null, cmpSources: [], cmpASrc: "cur", setCmpASrc: () => {},
  cmpBSrc: "cur", setCmpBSrc: () => {}, onSaveDuckSetup: null, standalone: false,
  ...over,
});

describe("TeleTab — TELE-FİŞİ görsel sözleşmesi", () => {
  it("dolu stint kartında marka logosu + araç görseli var (fiş: 26px / 124×56)", () => {
    const html = renderToStaticMarkup(<TeleTab {...props()} />);
    expect(html).toContain("brands/ferrari.png");     // brandLogo(meta.vehicle)
    expect(html).toMatch(/width:124px/);              // araç görseli genişliği
  });

  it("§BS: seans setup'ı varsa buton çıkar, yoksa çıkmaz", () => {
    /* Not: statik markup kesme işaretini &#x27; olarak kaçırır → apostrofsuz ara. */
    const yok = renderToStaticMarkup(<TeleTab {...props()} />);
    expect(yok).not.toContain("Bu seansın setup");
    const varsa = renderToStaticMarkup(
      <TeleTab {...props({ cmpMeta: { venue: "Spa", vehicle: "Ferrari 296 GT3",
        setup: { a: 1 } } })} />);
    expect(varsa).toContain("Bu seansın setup");
    expect(varsa).toContain("içeriği incele");
    expect(varsa).toContain("Spa · Ferrari 296 GT3");   // alt satır künyesi
    // buton alt aksiyon barının ÜSTÜNDE ve dibe yaslı (fiş: auto → bar 12px)
    expect(varsa).toContain("margin-top:auto");
  });

  it("grafik kroması tasarım tokenlarında — eski mavi-gri palet kalmadı", () => {
    const html = renderToStaticMarkup(<TeleTab {...props()} />);
    for (const eski of ["#2B3542", "#8C97A5", "#1F2731"]) {
      expect(html).not.toContain(eski);
    }
  });

  it("boş durumda yalnız .duckdb metni geçer (.ld/CSV desteği kaldırılmıştı)", () => {
    const bos = renderToStaticMarkup(
      <TeleTab {...props({ st: { ...baseSt, telemetry: {} }, loadedSlots: [],
        slotStats: {}, baseSlot: undefined })} />);
    expect(bos).toContain("Henüz telemetri yok");
    expect(bos).not.toContain(".ld");
    expect(bos).not.toContain("CSV");
  });
});
