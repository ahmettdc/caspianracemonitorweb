/* StintTab render testleri — plan eksik/yozlaşmış olduğunda kullanıcı UYARI görmeli.
   Regresyon (v1.4.53): "Avg Lap" boşaltılınca tablo 64 sahte stint satırına şişiyor,
   64 stint tavanına takılan plan ise sessizce yarım kalıyordu (uyarı yok, FINISH yok).
   components.render.test.jsx ile aynı desen: renderToStaticMarkup, DOM gerekmez. */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import StintTab from "./tabs/StintTab.jsx";
import { computePlan, migrate, DEFAULT_STATE, effCons } from "./engine.js";
import { buildTimeline } from "./state.js";

const noop = () => {};
const mk = (over) => migrate({
  ...DEFAULT_STATE, raceTime: "2:24:00", avgLap: "3:59.50",
  strategies: { A: 8, B: 9, C: 10, D: 11 }, chosen: "D", ...over,
});
/* → { html, plan, bodyRows } (bodyRows: tabloya basılan stint satırı sayısı) */
const draw = (st) => {
  const plan = computePlan(st, "race");
  const html = renderToStaticMarkup(
    <StintTab tab="stint" mode="race" t={(x) => x} st={st} plan={plan}
      totalVE={plan.totalFuel + st.extraLap * effCons(st)} totalFuelL={10}
      timeline={buildTimeline(plan)} liveInfo={{ status: "idle" }} pitSoon={false}
      tyreInfo={{ available: 22 }} quickTyre={noop} bumpLaps={noop} clearLaps={noop}
      upStintLap={noop} upTyre={noop} upPit={noop} assignDriver={noop} upOvr={noop}
      setRepair={noop} />);
  return { html, plan, bodyRows: (html.match(/<tbody>|<tr/g) || []).length - 2 };
};

describe("StintTab — plan uyarıları", () => {
  it("normal planda uyarı yok, satır sayısı planla eşit", () => {
    const { html, plan, bodyRows } = draw(mk({}));
    expect(html).not.toContain("Plan hesaplanamıyor");
    expect(html).not.toContain("Plan tamamlanamadı");
    expect(bodyRows).toBe(plan.rows.length);
    expect(html).toContain("FINISH");                 // son stint işaretli
  });

  it("Avg Lap boşsa: uyarı görünür, hayalet satır YOK", () => {
    const { html, bodyRows } = draw(mk({ avgLap: "" }));
    expect(html).toContain("Plan hesaplanamıyor");
    expect(bodyRows).toBe(0);                          // eskiden 64 sahte satır
  });

  it("strateji tur sayısı 0 ise: uyarı görünür", () => {
    const { html, bodyRows } = draw(
      mk({ strategies: { A: 0, B: 9, C: 10, D: 11 }, chosen: "A" }));
    expect(html).toContain("Plan hesaplanamıyor");
    expect(bodyRows).toBe(0);
  });

  it("64 stint tavanına takılan plan 'tamamlanamadı' uyarısı verir", () => {
    const { html } = draw(
      mk({ raceTime: "24:00:00", strategies: { A: 2, B: 9, C: 10, D: 11 }, chosen: "A" }));
    expect(html).toContain("Plan tamamlanamadı");
    expect(html).toContain("stint sınırı");
  });

  /* Bozuk/eski state: pit lastik bayrağı 0-4 aralığını aşarsa (ör. 9) plan tablosu
     TY_STATE[stv].title erişiminde ÇÖKMEMELİ — render sitesinde 0-4'e kırpılır. */
  it("aralık dışı pit lastik bayrağı plan tablosunu çökertmez", () => {
    const bad = mk({ pits: [
      { fuel: true, lane: true, tyres: [9, 7, 0, 0] },
      { fuel: true, lane: true, tyres: [-3, 0, 0, 0] },
    ] });
    expect(() => draw(bad)).not.toThrow();
  });
});

/* v2.0 alt şeridi (canlı senkron · geri al · PIT) KALDIRILDI — PIT işlemi yalnız
   Pit Board penceresinde (kullanıcı isteği). İlgili testler de kaldırıldı. */
