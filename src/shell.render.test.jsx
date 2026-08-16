/* Kabuk bileşenleri — renderToStaticMarkup duman testi (repo deseni:
   oxlint no-undef yapmadığından eksik prop yalnız çalışma anında patlar). */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Rail, RaceBar, Guide, EmptyState, RAIL_ITEMS } from "./shell";

const t = (s) => s;
const noop = () => {};
const render = (el) => renderToStaticMarkup(el);

describe("Rail — 76px sol ray", () => {
  const base = { t, screen: "live", go: noop, onHome: noop, onToggle: noop, version: "v2.0.0" };

  it("ray sırası README'deki sırayla", () => {
    expect(RAIL_ITEMS.map((i) => i.id)).toEqual(
      ["team", "dash", "stint", "fuel", "live", "tyre", "drivers", "tele", "setup"]);
  });
  it("her ray düğmesi çizilir + sürüm altta", () => {
    const html = render(<Rail {...base} />);
    for (const it of RAIL_ITEMS) expect(html).toContain(`>${it.label}</span>`);
    expect(html).toContain("v2.0.0");
    expect(html).toContain("Sohbet");
  });
  it("aktif ekran .on + aria-current alır", () => {
    const html = render(<Rail {...base} screen="tyre" />);
    expect(html).toMatch(/class="railbtn on"[^>]*aria-current="page"/);
  });
  it("code80 Stint'i aktif gösterir", () => {
    expect(render(<Rail {...base} screen="code80" />)).toMatch(/railbtn on/);
  });
  it("kapalıyken .hidden + açma tırnağı", () => {
    const html = render(<Rail {...base} open={false} />);
    expect(html).toContain("rail hidden");
    expect(html).toContain("railopen");
  });
  it("okunmamış rozeti 99+ ile sınırlanır", () => {
    expect(render(<Rail {...base} unread={3} />)).toContain(">3</b>");
    expect(render(<Rail {...base} unread={412} />)).toContain(">99+</b>");
    expect(render(<Rail {...base} unread={0} />)).not.toContain("railbadge");
  });
  it("hideChat sohbet düğmesini kaldırır", () => {
    expect(render(<Rail {...base} hideChat />)).not.toContain("Sohbet");
  });
});

describe("RaceBar — birleşik sticky yarış çubuğu", () => {
  const base = {
    t, name: "6H SPA", meta: "R3 · Spa-Francorchamps",
    remain: "4:12:38", remainPct: 30,
    nextPit: "22:14", nextPitSub: "S2/7 · Kerem Yılmaz",
    pos: "P9", posCls: "GT3 P2", posClsColor: "#EF8A2B", posSub: "12 araç",
    energy: "%64", energyPct: 64, energySub: "8.97 %/tur",
    liveLabel: "canlı · 1s", liveOn: true,
    onBridge: noop, onRaceData: noop, onPitBoard: noop,
  };
  it("beş blok + sağ blok çizilir", () => {
    const html = render(<RaceBar {...base} />);
    for (const s of ["6H SPA", "Bayrağa kalan", "4:12:38", "Sıradaki pit", "22:14",
      "Pozisyon", "P9", "Enerji", "Yarış datası", "Pit Board"]) {
      expect(html).toContain(s);
    }
  });
  it("ilerleme çubukları hesaplanan genişliği alır ve %0-100'e kırpılır", () => {
    expect(render(<RaceBar {...base} />)).toContain("width:30%");
    expect(render(<RaceBar {...base} remainPct={-5} />)).toContain("width:0%");
    expect(render(<RaceBar {...base} remainPct={180} />)).toContain("width:100%");
  });
  it("izleyici rozeti yalnız viewer'da", () => {
    expect(render(<RaceBar {...base} />)).not.toContain("İzleyici modu");
    expect(render(<RaceBar {...base} viewer />)).toContain("İzleyici modu");
  });
  it("sıradaki pit uyarısı nabız halkası sınıfı ekler", () => {
    expect(render(<RaceBar {...base} pitAlert />)).toContain("rbpitring");
    expect(render(<RaceBar {...base} />)).not.toContain("rbpitring");
  });
  it("bekleyen değişiklik sayısı amber rozet olur", () => {
    expect(render(<RaceBar {...base} dirtyN={4} />)).toContain('class="rbdirty">4<');
    expect(render(<RaceBar {...base} />)).not.toContain("rbdirty");
  });
  it("köprü kapalıysa canlı düğmesi .off", () => {
    expect(render(<RaceBar {...base} liveOn={false} />)).toContain("rblive off");
  });
  it("verilmeyen blok hiç çizilmez", () => {
    const html = render(<RaceBar {...base} nextPit={null} energy={null} />);
    expect(html).not.toContain("Sıradaki pit");
    expect(html).not.toContain("Enerji");
    expect(html).toContain("Bayrağa kalan");
  });
});

describe("Guide / EmptyState", () => {
  it("rehber kutusu başlık + metin (ikon ve kapatma yok)", () => {
    const html = render(<Guide title="Canlı timing" text="Sütun başlıklarına tıkla" />);
    expect(html).toContain("Canlı timing");
    expect(html).toContain("Sütun başlıklarına tıkla");
    expect(html).not.toContain("button");
  });
  it("boş başlık ve metin → hiç çizmez", () => {
    expect(render(<Guide />)).toBe("");
  });
  it("boş durum başlık/metin/aksiyon", () => {
    const html = render(
      <EmptyState icon="📡" title="Canlı veri gelmiyor" text="Köprü çalışmıyor">
        <button>Yeniden bağlan</button>
      </EmptyState>);
    expect(html).toContain("Canlı veri gelmiyor");
    expect(html).toContain("Köprü çalışmıyor");
    expect(html).toContain("Yeniden bağlan");
    expect(html).toContain("empty-act");
  });
});
