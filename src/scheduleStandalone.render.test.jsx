import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ScheduleStandalone from "./ScheduleStandalone.jsx";
import ScheduleTab from "./tabs/ScheduleTab.jsx";

/* Official Races = Ana Menü'den doğrudan erişilen, yarıştan BAĞIMSIZ yarış merkezi.
   Bu testler navigation/state izolasyonu + kart/empty/eksik-asset dayanıklılığını doğrular. */
const t = (s) => s;

const RACE = {
  id: "weekly-1", kind: "weekly", name: "2.4h Spa", live: false,
  sr: "S2", srRank: "Silver", trackId: "spa", trackRaw: "Spa-Francorchamps",
  classes: ["LMP2", "GT3"], lenSec: 8640, lenLabel: "2h24m",
  startMs: Date.now() + 2 * 86400000,   // gelecek: gün-gruplu ajandada görünür
  url: "https://lmugarage.com/weekly/1",
};

describe("ScheduleStandalone (Ana Menü → Resmi Yarışlar, bağımsız)", () => {
  const html = renderToStaticMarkup(
    <ScheduleStandalone t={t} lang="tr" switchLang={() => {}}
      races={[RACE]} updatedAt={Date.now()} loading={false} onExit={() => {}} />);
  it("kabuk render olur: marka + Ana Menü + Resmi Yarışlar başlığı", () => {
    expect(html).toContain("RACE MONITOR");
    expect(html).toContain("Ana Menü");
    expect(html).toContain("Resmi Yarışlar");
  });
  it("race/team/tab prop'u OLMADAN render olur (bağımsız) — çökmez", () => {
    expect(html.length).toBeGreaterThan(0);
  });
  it("Race Solo çıpalarına referans vermez", () => {
    expect(html).not.toContain('data-tour="home"');
    expect(html).not.toContain('data-tour="tabs"');
    expect(html).not.toContain('data-tour="livecard"');
  });
});

describe("ScheduleTab — yarış merkezi UI", () => {
  it("özet + filtre barı + yarış kartı render olur", () => {
    const html = renderToStaticMarkup(
      <ScheduleTab t={t} lang="tr" races={[RACE]} updatedAt={Date.now()} loading={false} />);
    expect(html).toContain("2.4h Spa");                 // yarış adı
    expect(html).toContain("Toplam");                   // özet
    expect(html).toContain("Tümü");                     // seri filtresi (her zaman render)
    expect(html).toContain("lmugarage.com");            // kaynak atfı
  });
  it("onPlan YOKSA 'Planla' butonu görünmez (saf görüntüleyici)", () => {
    const html = renderToStaticMarkup(
      <ScheduleTab t={t} lang="tr" races={[RACE]} updatedAt={Date.now()} loading={false} />);
    expect(html).not.toContain("Bu yarışa planla");
  });
  it("eksik track/flag asset'i UI'ı KIRMAZ (graceful fallback)", () => {
    const noTrack = { ...RACE, id: "x", trackId: "", trackRaw: "Unknown Circuit" };
    const html = renderToStaticMarkup(
      <ScheduleTab t={t} lang="tr" races={[noTrack]} updatedAt={Date.now()} loading={false} />);
    expect(html).toContain("Unknown Circuit");          // fallback venue adı
    expect(html.length).toBeGreaterThan(0);             // çökmedi
  });
  it("veri yüklenmediğinde bilgilendirici durum gösterir", () => {
    const html = renderToStaticMarkup(
      <ScheduleTab t={t} lang="tr" races={[]} updatedAt={null} loading={false} />);
    expect(html).toContain("Takvim henüz yüklenmedi");
  });
});
