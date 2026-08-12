import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TelemetryStandalone from "./TelemetryStandalone.jsx";

/* Smoke: bağımsız telemetri kabuğu (header + 🏠 Ana Menü + telemetri gövdesi) çökmeden
   render olur ve Race Solo'ya (entered/curRace/tab) HİÇ referans vermez. TeleTab lazy
   olduğundan statik render'da Suspense fallback görünür — kabuğun bağımsızlığı asıl test. */
const t = (s) => s;
const tel = {            // ikinci useTelemetry örneğinin dönüşünü taklit eden minimal yüzey
  slot: "A", setSlot: () => {}, chartMode: "box", setChartMode: () => {},
  rawTele: "", setRawTele: () => {}, parsed: null, mapping: null, setMapping: () => {},
  onTeleFile: () => {}, doParse: () => {}, apply105Slot: () => {}, saveMotec: () => {},
  saveSlot: () => {}, toggleLap: () => {}, removeSlot: () => {}, slotStats: {}, chartData: [],
  loadedSlots: [], baseSlot: undefined, cmpMeta: null, cmpA: null, setCmpA: () => {},
  cmpB: null, setCmpB: () => {}, cmpData: null, cmpBusy: false, savedMsg: "",
  cmpSources: [], cmpASrc: "cur", setCmpASrc: () => {}, cmpBSrc: "cur", setCmpBSrc: () => {},
};

describe("TelemetryStandalone (bağımsız telemetri ekranı)", () => {
  const html = renderToStaticMarkup(
    <TelemetryStandalone t={t} lang="tr" switchLang={() => {}} st={{ telemetry: {} }}
      up={() => {}} onSaveDuckSetup={null} onExit={() => {}} {...tel} />);
  it("kabuk render olur: marka + Ana Menü", () => {
    expect(html).toContain("RACE MONITOR");
    expect(html).toContain("Ana Menü");
  });
  it("Race Solo çıpalarına referans vermez (data-tour home/tabs/live yok)", () => {
    expect(html).not.toContain('data-tour="home"');
    expect(html).not.toContain('data-tour="tabs"');
    expect(html).not.toContain('data-tour="livecard"');
  });
});
