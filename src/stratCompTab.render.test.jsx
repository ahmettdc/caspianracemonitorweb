/* StratCompTab render testleri — sözleşme: EKSİK VERİ SAYIYA ÇEVRİLMEZ.
   Regresyon kaynağı Excel'in kendisi (Caspian Motorsport Race Control v1.28):
   STRATEGY COMP'un XLOOKUP'larında `if_not_found` yoktu ve kayıt defterindeki
   25 takımın 23'ü boştu → boş bir takım seçilince ortalama tur 0 sanılıyor,
   174 turluk yarışta TOTAL RESULT −21.867 sn (≈ −6 saat) çıkıyor ve negatif
   olduğu için "avantaj" rengiyle YEŞİLE boyanıyordu. Ekran bunu YAPMAMALI.
   stintTab.render.test.jsx ile aynı desen: renderToStaticMarkup, DOM gerekmez. */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import StratCompTab from "./tabs/StratCompTab.jsx";
import { computePlan, migrate, DEFAULT_STATE } from "./engine.js";

const noop = () => {};
/* Excel'in iki DOLU satırı — dosyadaki değerler birebir. */
const PESCARA = { name: "#4 PESCARA SRT", pits: 7, stints: 8, pitLane: 40,
  fuelFull: 40, fuelLast: 7, tyreTime: 12, tyreCount: 6, avgLap: "2:02.150" };
const CASPIAN = { name: "#75 CASPIAN MOTORSPORT", pits: 6, stints: 7, pitLane: 40,
  fuelFull: 40, fuelLast: 40, tyreTime: 12, tyreCount: 6, avgLap: "2:02.500" };

const mk = (over) => migrate({ ...DEFAULT_STATE, ...over });
const draw = (st, opt = {}) => renderToStaticMarkup(
  <StratCompTab t={(x) => x} st={st} plan={computePlan(st, "race")}
    onLaps={noop} onAdd={noop} onUp={noop} onDel={noop} onSeed={noop} onPick={noop}
    {...opt} />);

describe("StratCompTab — karşılaştırma", () => {
  const st = mk({ stratTeams: [PESCARA, CASPIAN], stratA: 0, stratB: 1, stratLaps: 174 });

  it("kazananı ADIYLA ve farkıyla yazar (renge bırakmaz)", () => {
    const html = draw(st);
    expect(html).toContain("#4 PESCARA SRT");
    expect(html).toContain("13.9");        // Excel D17 = −13.9 sn
    expect(html).toContain("sn önde");
  });

  /* Kalemler projenin tek süre biçimleyicisiyle (engine.fmtDur) yazılır:
     280 sn → "4:40.0". Excel'in ham saniyeleri burada dakika:saniye okunur. */
  it("Excel'in kalem dökümünü üretir (280/247/72 ve 240/240/72 sn)", () => {
    const html = draw(st);
    ["4:40.0", "4:07.0", "1:12.0", "9:59.0"].forEach((v) => expect(html).toContain(v));
    expect(html).toContain("4:00.0");   // Caspian pit yolu 240 sn = yakıt 240 sn
    expect(html).toContain("9:12.0");   // Caspian sabit kayıp 552 sn
  });

  it("sabit kayıp farkı +47 sn olarak görünür", () => {
    expect(draw(st)).toContain("+47.0");   // Excel D16
  });

  it("breakeven satırı çizilir", () => {
    expect(draw(st)).toContain("Geride kalan takımın farkı kapatması için");
  });
});

describe("StratCompTab — eksik veri (CLAUDE.md §1)", () => {
  /* Excel'in gerçek davranışı: boş takım seçilince −21.867 sn. Burada hiçbir
     sayı çıkmamalı, bunun yerine eksik alanlar adıyla listelenmeli. */
  it("boş takım seçilince SONUÇ ÜRETİLMEZ, eksik alanlar listelenir", () => {
    const html = draw(mk({ stratTeams: [PESCARA, { name: "#8 GR SIMTRUST ESPORT" }],
      stratA: 0, stratB: 1, stratLaps: 174 }));
    expect(html).toContain("Karşılaştırma yapılamıyor");
    expect(html).toContain("#8 GR SIMTRUST ESPORT");
    expect(html).not.toContain("sn önde");
    expect(html).not.toContain("21867");
    expect(html).not.toContain("-21");
  });

  it("toplam tur girilmemişse de sonuç üretilmez", () => {
    const html = draw(mk({ stratTeams: [PESCARA, CASPIAN], stratA: 0, stratB: 1, stratLaps: "" }));
    expect(html).toContain("Karşılaştırma yapılamıyor");
    expect(html).not.toContain("sn önde");
  });

  it("defter boşken çökmez ve yönlendirme gösterir", () => {
    const html = draw(mk({ stratTeams: [] }));
    expect(html).toContain("Aşağıdaki deftere en az iki takım ekleyin.");
    expect(html).toContain("Henüz takım yok.");
  });

  /* Excel'de STINT NUMBERS sütunu hiçbir formüle girmiyordu (ölü sütun);
     burada en azından pit sayısıyla çapraz doğrulanıp uyarı basılır. */
  it("stint ≠ pit + 1 satırında uyarı işareti çizilir", () => {
    const html = draw(mk({ stratTeams: [{ ...CASPIAN, stints: 99 }], stratLaps: 174 }));
    expect(html).toContain("Stint sayısı pit sayısı + 1 olmalı");
  });
});

describe("StratCompTab — sıralama ve izleyici modu", () => {
  it("verisi tam olanlar sıralanır, eksik olanlar ayrı yazılır", () => {
    const html = draw(mk({ stratTeams: [CASPIAN, PESCARA, { name: "#13 TEAM SHIBA" }],
      stratA: 0, stratB: 1, stratLaps: 174 }));
    expect(html).toContain("Tüm defter — tahmini bitiş sırası");
    expect(html).toContain("Sıralamaya girmeyen (eksik veri)");
    expect(html).toContain("#13 TEAM SHIBA");
  });

  it("izleyici modunda yazma eylemleri çizilmez", () => {
    const st = mk({ stratTeams: [PESCARA, CASPIAN], stratA: 0, stratB: 1, stratLaps: 174 });
    const ro = draw(st, { readOnly: true });
    expect(ro).not.toContain("Planımdan ekle");
    expect(ro).not.toContain("Boş satır");
    expect(ro).toContain("disabled");
    // düzenlenebilir modda butonlar yerinde
    expect(draw(st)).toContain("Planımdan ekle");
  });
});
