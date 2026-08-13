import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ScheduleStandalone from "./ScheduleStandalone.jsx";
import ScheduleTab from "./tabs/ScheduleTab.jsx";

/* Official Races = Ana Menü'den doğrudan erişilen, yarıştan BAĞIMSIZ takvim.
   Bu testler navigation/state izolasyonunu doğrular: standalone kabuk hiçbir
   race/team/tab prop'u olmadan render olur ve Race Solo çıpalarına referans vermez. */
const t = (s) => s;

const RACE = {
  id: "weekly-1", kind: "weekly", name: "2.4h Spa", live: false,
  sr: "S2", srRank: "Silver", trackId: "spa", trackRaw: "Spa-Francorchamps",
  classes: ["LMP2", "GT3"], lenSec: 8640, lenLabel: "2h24m",
  startMs: Date.parse("2026-08-13T08:00:00+00:00"),
  url: "https://lmugarage.com/weekly/1",
};

describe("ScheduleStandalone (Ana Menü → Resmi Yarışlar, bağımsız)", () => {
  const html = renderToStaticMarkup(
    <ScheduleStandalone t={t} lang="tr" switchLang={() => {}}
      live={[]} upcoming={[RACE]} updatedAt={Date.now()} loading={false}
      onExit={() => {}} />);

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

describe("ScheduleTab — onPlan opsiyonel (race-coupling izolasyonu)", () => {
  it("onPlan YOKSA 'Planla' butonu görünmez (saf görüntüleyici)", () => {
    const html = renderToStaticMarkup(
      <ScheduleTab t={t} live={[]} upcoming={[RACE]} updatedAt={Date.now()} loading={false} />);
    expect(html).toContain("2.4h Spa");                  // yarış listelenir
    expect(html).not.toContain("Bu yarışa planla");      // ama planlama butonu (race-coupled) yok
  });
  it("onPlan VERİLİRSE 'Planla' butonu görünür (geriye dönük uyum)", () => {
    const html = renderToStaticMarkup(
      <ScheduleTab t={t} live={[]} upcoming={[RACE]} updatedAt={Date.now()}
        loading={false} onPlan={() => {}} />);
    expect(html).toContain("Bu yarışa planla");
  });
});
