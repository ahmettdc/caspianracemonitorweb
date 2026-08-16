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
  startMs: Date.parse("2026-08-13T08:00:00+00:00"),
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
    expect(html).toContain("Tüm sınıflar");             // birebir araç çubuğu: sınıf süzgeci (14-resmi-yarislar)
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

/* v2.0 (README §13): liste artık duruma göre (Şu An Canlı / Yaklaşan /
   Tamamlanan) değil GÜNE GÖRE gruplanıyor — Bugün / Yarın / tarih. */
describe("ScheduleTab — güne göre gruplama (v2.0)", () => {
  const day = 86400000;
  const at = (offset, over = {}) => ({
    ...RACE, id: `r${offset}${over.id || ""}`,
    startMs: Date.now() + offset, ...over,
  });
  const draw = (races) => renderToStaticMarkup(
    <ScheduleTab t={t} lang="tr" races={races} updatedAt={Date.now()}
      loading={false} onPlan={null} />);

  it("bugün ve yarın başlıkları çizilir", () => {
    const html = draw([at(2 * 3600000, { id: "a" }), at(day + 3600000, { id: "b" })]);
    expect(html).toContain("sch-day");
    expect(html).toContain("Bugün");
    expect(html).toContain("Yarın");
  });

  it("eski durum bölümü başlıkları KALKTI", () => {
    const html = draw([at(2 * 3600000)]);
    expect(html).not.toContain("Şu An Canlı");
    expect(html).not.toContain("Tamamlanan");
  });

  it("gün başlığında o günkü yarış sayısı var", () => {
    const html = draw([at(3600000, { id: "a" }), at(2 * 3600000, { id: "b" })]);
    expect(html).toMatch(/sch-cnt">2</);
  });

  it("boş liste çökertmez", () => {
    expect(draw([]).length).toBeGreaterThan(0);
  });
});
