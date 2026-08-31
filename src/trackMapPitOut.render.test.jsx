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

const render = (field, classFilter = null) => renderToStaticMarkup(
  <TrackMap t={t} field={field} session={{}} trackLength={L}
    tid="" trackKey="" canSave={false} classFilter={classFilter} />);

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

/* "Kendi sınıfım" süzgeci — LiveTab'daki Poz·Sınıf başlığıyla senkron. */
describe("TrackMap — sınıf süzgeci", () => {
  /* Yarısı Hypercar yarısı LMGT3, hepsi pistte ve konumlu. */
  const mixed = () => Array.from({ length: N }, (_, i) => {
    const f = i / N;
    return {
      carId: i, driver: `D${i}`, pos: i + 1,
      carClass: i % 2 === 0 ? "Hypercar" : "LMGT3",
      lapDist: f * L, posX: 900 * Math.sin(f * 6.283), posZ: 700 * Math.cos(f * 6.283),
      location: "TRACK", inPits: false, lapsDone: 5,
      timeIntoLap: +(f * 100).toFixed(3), estLapTime: 100,
      avg5Sec: 100, lastSec: 100, bestSec: 100,
    };
  });

  /* Nokta sayısı: her araç dış halkada + iç şekilde birer <g> alıyor. Sınıf
     rengiyle sayarak süzgecin gerçekten uygulandığını ölçüyoruz. */
  const countColor = (html, hex) => (html.match(new RegExp(hex, "g")) || []).length;

  it("süzgeç KAPALIYKEN iki sınıf da çizilir", () => {
    const out = render(mixed());
    expect(countColor(out, "#E7443B")).toBeGreaterThan(0);   // Hypercar
    expect(countColor(out, "#EF8A2B")).toBeGreaterThan(0);   // GT3
  });

  it("süzgeç AÇIKKEN yalnız kendi sınıfım çizilir", () => {
    const out = render(mixed(), "hypercar");
    expect(countColor(out, "#E7443B")).toBeGreaterThan(0);
    expect(countColor(out, "#EF8A2B")).toBe(0);              // GT3 hiç yok
  });

  /* EN ÖNEMLİ GARANTİ: süzgeç yalnız ÇİZİMİ etkiler. Pist şekli kutuları tüm
     sahadan birikmeye devam etmeli — süzülmüş listeyle biriktirseydik harita
     yarı yarıya yavaş dolar, üstelik süzgeç kapatılınca bile eksik kalırdı. */
  it("süzgeç harita ŞEKLİNİ etkilemez (kutular tüm sahadan dolar)", () => {
    const binsOf = (html) => {
      const m = html.match(/(\d+)\/480/);
      return m ? Number(m[1]) : -1;
    };
    const all = binsOf(render(mixed()));
    const filtered = binsOf(render(mixed(), "hypercar"));
    expect(all).toBeGreaterThan(0);
    expect(filtered).toBe(all);
  });

  it("bilinmeyen sınıf süzgecinde çökmez", () => {
    expect(() => render(mixed(), "yoksinif")).not.toThrow();
  });
});
