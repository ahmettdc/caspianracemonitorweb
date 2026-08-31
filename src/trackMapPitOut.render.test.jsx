/* TrackMap pit çıkış tahmini (v2.3.0) render sözleşmesi.
   Eğri ve harita kutuları KARE KARE dolduğu için statik render'da tek kare
   veriliyor → 480 kutunun %35'ini doldurmak için sentetik olarak geniş bir saha
   kullanılır (gerçekte bunu saha birkaç saniyede yapar). */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

globalThis.window ??= globalThis;
globalThis.document ??= {
  fullscreenEnabled: false, fullscreenElement: null,
  addEventListener() {}, removeEventListener() {}, createElement: () => ({}),
};
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };

const { default: TrackMap } = await import("./tabs/TrackMap.jsx");

const t = (s) => s;
const L = 5000;
const N = 260;   // 480 kutunun yarısından fazlasını tek karede doldurur

/* Pistin her yerine yayılmış araçlar → hem harita şekli hem mesafe→zaman eğrisi
   tek karede kurulur. Sabit hızlı pist: timeIntoLap = tur × mesafeKesri. */
const spread = (extra = {}) => Array.from({ length: N }, (_, i) => {
  const f = i / N;
  return {
    carId: i, driver: `D${i}`, pos: i + 1, carClass: "Hypercar",
    lapDist: f * L, posX: 900 * Math.sin(f * 6.283), posZ: 700 * Math.cos(f * 6.283),
    location: "TRACK", inPits: false, lapsDone: 5,
    timeIntoLap: +(f * 100).toFixed(3), estLapTime: 100,
    avg5Sec: 100, lastSec: 100, bestSec: 100,
    ...(i === 0 ? extra : {}),
  };
});

const render = (field) => renderToStaticMarkup(
  <TrackMap t={t} field={field} session={{}} trackLength={L}
    tid="" trackKey="" canSave={false} />);

describe("TrackMap — pit çıkış tahmini", () => {
  /* Pit giriş/çıkış GÖZLEMLE oluşur (TRACK↔PIT geçişi). Statik tek karede gözlem
     yapılamaz → tahmin çizilemez. Bu, "gözlem yoksa çizme" kuralının kendisidir. */
  it("pit giriş/çıkışı gözlenmemişse tahmin ÇİZİLMEZ (uydurma yok)", () => {
    const out = render(spread({ isPlayer: true, pitState: 1 }));
    expect(out).not.toContain("Pit çıkış tahmini (sn)");
  });

  it("pit TALEBİ yokken tahmin çizilmez", () => {
    const out = render(spread({ isPlayer: true, pitState: 0 }));
    expect(out).not.toContain("Pit çıkış tahmini (sn)");
  });

  it("oyuncu sahada değilken çizilmez", () => {
    const out = render(spread());        // isPlayer yok
    expect(out).not.toContain("Pit çıkış tahmini (sn)");
  });

  it("harita normal çizilir, saha kalabalıkken de çökmez", () => {
    const out = render(spread({ isPlayer: true, pitState: 1 }));
    expect(out).toContain("S/F");
    expect(out).toContain("<svg");
  });

  it("boş / bozuk saha ile çökmez", () => {
    expect(() => render([])).not.toThrow();
    expect(() => render([{ carId: 1, lapDist: 0 }])).not.toThrow();
  });
});
