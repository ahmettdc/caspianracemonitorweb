/* StratCompTab render testleri — sözleşme: EKSİK VERİ SAYIYA ÇEVRİLMEZ.
   Regresyon kaynağı Excel'in kendisi (Caspian Motorsport Race Control v1.28):
   STRATEGY COMP'un XLOOKUP'larında `if_not_found` yoktu ve kayıt defterindeki
   25 takımın 23'ü boştu → boş bir takım seçilince ortalama tur 0 sanılıyor,
   174 turluk yarışta TOTAL RESULT −21.867 sn (≈ −6 saat) çıkıyor ve negatif
   olduğu için "avantaj" rengiyle YEŞİLE boyanıyordu. Ekran bunu YAPMAMALI.
   stintTab.render.test.jsx ile aynı desen: renderToStaticMarkup, DOM gerekmez. */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import StratCompTab, { RowEditModal } from "./tabs/StratCompTab.jsx";
import { computePlan, migrate, DEFAULT_STATE } from "./engine.js";
import { TRACKS, CAR_CLASSES, PIT_LANE_TIMES, CARS } from "./constants.js";
import { trackDefaults, teamTime, stintWarnings } from "./stratComp.js";

const noop = () => {};
/* Excel'in iki DOLU satırı — dosyadaki değerler birebir. */
const PESCARA = { name: "#4 PESCARA SRT", pits: 7, stints: 8, pitLane: 40,
  fuelFull: 40, fuelLast: 7, tyreTime: 12, tyreCount: 6, avgLap: "2:02.150" };
const CASPIAN = { name: "#75 CASPIAN MOTORSPORT", pits: 6, stints: 7, pitLane: 40,
  fuelFull: 40, fuelLast: 40, tyreTime: 12, tyreCount: 6, avgLap: "2:02.500" };

const mk = (over) => migrate({ ...DEFAULT_STATE, ...over });
const LMU = { data: { lemans: { hypercar: { avgLap: "3:28.50" }, gt3: { avgLap: "3:55.10" } } } };
const draw = (st, opt = {}) => renderToStaticMarkup(
  <StratCompTab t={(x) => x} st={st} plan={computePlan(st, "race")}
    tracks={TRACKS} carClasses={CAR_CLASSES} lmuReady
    trackDefs={trackDefaults(st.stratTrack || st.track, st.stratClass || st.carClass, LMU, PIT_LANE_TIMES)}
    onLaps={noop} onTrack={noop} onClass={noop} onAdd={noop} onUp={noop} onDel={noop}
    onSeed={noop} onSeedInto={noop} onPick={noop}
    {...opt} />);

describe("StratCompTab — karşılaştırma", () => {
  const st = mk({ stratTeams: [PESCARA, CASPIAN], stratA: 0, stratB: 1, stratLaps: 174 });

  it("kazananı ADIYLA ve farkıyla yazar (renge bırakmaz)", () => {
    const html = draw(st);
    expect(html).toContain("#4 PESCARA SRT");
    expect(html).toContain("13.9");        // Excel D17 = −13.9 sn
    expect(html).toContain("sn önde");
  });

  /* v2.4.0 tasarım fişi: sabit kayıp kalemleri DÜZ saniye, tek ondalık
     ("280.0") — fişin kendi fmtDur'u. Excel'in ham saniyeleriyle aynı okuma. */
  it("Excel'in kalem dökümünü üretir (280/247/72 ve 240/240/72 sn)", () => {
    const html = draw(st);
    ["280.0", "247.0", "72.0", "599.0"].forEach((v) => expect(html).toContain(v));
    expect(html).toContain("240.0");   // Caspian pit yolu 240 sn = yakıt 240 sn
    expect(html).toContain("552.0");   // Caspian sabit kayıp 552 sn
  });

  it("sabit kayıp farkı +47 sn olarak görünür", () => {
    expect(draw(st)).toContain("+47.0");   // Excel D16
  });

  it("breakeven satırı çizilir", () => {
    expect(draw(st)).toContain("Geride kalan turda");
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
    expect(html).toContain("Karşılaştırma yapılamıyor");
    expect(html).toContain("Kayıt defteri");
  });

  /* Excel'de STINT NUMBERS sütunu hiçbir formüle girmiyordu (ölü sütun);
     burada en azından pit sayısıyla çapraz doğrulanıp uyarı basılır. */
  it("stint ≠ pit + 1 satırında uyarı işareti çizilir", () => {
    const html = draw(mk({ stratTeams: [{ ...CASPIAN, stints: 99 }], stratLaps: 174 }));
    expect(html).toContain("Stint sayısı pit + 1 olmalı");
  });
});

describe("StratCompTab — sıralama ve izleyici modu", () => {
  it("verisi tam olanlar sıralanır, eksik olanlar ayrı yazılır", () => {
    const html = draw(mk({ stratTeams: [CASPIAN, PESCARA, { name: "#13 TEAM SHIBA" }],
      stratA: 0, stratB: 1, stratLaps: 174 }));
    expect(html).toContain("Tüm defter · tahmini bitiş sırası");
    expect(html).toContain("Sıralamaya girmeyen (eksik veri)");
    expect(html).toContain("#13 TEAM SHIBA");
  });

  it("başlıklar takım/plan ayrımı yapmaz (aynı ekran ikisine de hizmet eder)", () => {
    const html = draw(mk({ stratTeams: [PESCARA, CASPIAN], stratA: 0, stratB: 1, stratLaps: 174 }));
    expect(html).toContain("Kayıt defteri");
    expect(html).toContain("satır · rakip ya da kendi A/B planınız");
    expect(html).not.toContain("Takım A");
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

describe("StratCompTab — A planı mı B planı mı (kendi varyantlarımız)", () => {
  /* Uygulamanın kendi strateji varyantları (st.strategies = {A:8,B:9,C:10,D:11},
     stint başına tur). Her biri için ayrı tohumlama düğmesi çizilir; plan
     TIKLANINCA hesaplanır, dördü birden renderda kurulmaz. */
  it("her strateji varyantı için tohumlama düğmesi çizilir", () => {
    const html = draw(mk({ stratTeams: [CASPIAN], stratLaps: 174 }));
    ["A · 8", "B · 9", "C · 10", "D · 11"].forEach((v) => expect(html).toContain(v));
  });

  it("stint turu geçersiz varyantın düğmesi pasif", () => {
    const html = draw(mk({ strategies: { A: 0, B: 9, C: 10, D: 11 },
      stratTeams: [CASPIAN], stratLaps: 174 }));
    expect(html).toContain("Bu varyantın planı kurulamıyor");
  });

  /* CLAUDE.md §1 — MODELLENMEYEN ŞEY ETİKETLENİR. İki planı da uygulamadan
     tohumlayınca ortalama tur BİREBİR aynı gelir: computePlan tek bir efektif
     tur süresi kullanır, uzun stintin yakıt yükü ve lastik yaşı yüzünden
     yavaşlamasını modellemez. Uyarı olmadan araç "az durak hep kazanır" der. */
  it("iki satırın temposu aynıysa 'fark yalnız pit/yakıt/lastikten' uyarısı çıkar", () => {
    const planA = { name: "Plan A · 8 tur", pits: 8, stints: 9, pitLane: 40,
      fuelFull: 40, fuelLast: 12, tyreTime: 12, tyreCount: 8, avgLap: "2:02.500" };
    const planB = { ...planA, name: "Plan B · 11 tur", pits: 6, stints: 7, tyreCount: 6 };
    const html = draw(mk({ stratTeams: [planA, planB], stratA: 0, stratB: 1, stratLaps: 174 }));
    expect(html).toContain("uzun stintin lastik/yakıt yavaşlaması modelde yok");
    expect(html).toContain("sn önde");           // sonuç yine de hesaplanır
  });

  it("tempolar FARKLIYSA uyarı çıkmaz", () => {
    const html = draw(mk({ stratTeams: [PESCARA, CASPIAN], stratA: 0, stratB: 1, stratLaps: 174 }));
    expect(html).not.toContain("uzun stintin lastik/yakıt yavaşlaması modelde yok");
  });
});

describe("StratCompTab — pist seçimi ve otomatik doldurma önerisi", () => {
  it("pist seçince pit yolu ve ortalama tur önerisi gösterilir (gerçek kaynak)", () => {
    const html = draw(mk({ stratTrack: "lemans", stratClass: "gt3", stratTeams: [CASPIAN], stratLaps: 174 }));
    expect(html).toContain("Öneri");
    expect(html).toContain("31 sn");       // PIT_LANE_TIMES.lemans
    expect(html).toContain("3:55.10");     // LMU lemans/gt3 avgLap
    expect(html).toContain("otomatik gelir");
  });
  it("pit yolu verisi olmayan pistte 'veri yok' — uydurma yok (CLAUDE.md §1)", () => {
    // daytona PIT_LANE_TIMES'ta yok
    const html = draw(mk({ stratTrack: "daytona", stratClass: "gt3", stratTeams: [CASPIAN], stratLaps: 174 }));
    expect(html).toContain("veri yok");
  });
  it("pist seçili değilken öneri satırı çizilmez", () => {
    const html = draw(mk({ stratTeams: [CASPIAN], stratLaps: 174 }));
    expect(html).not.toContain("Öneri:");
  });
});

describe("StratCompTab — v2.4.0 tasarım fişi parçaları", () => {
  const st = mk({ stratTeams: [{ ...PESCARA, num: "4", car: "ferrari", cls: "gt3" },
    { ...CASPIAN, num: "75", car: "corvette", cls: "gt3" }],
    stratA: 0, stratB: 1, stratLaps: 174, stratTrack: "spa" });

  it("hero kartları PLAN A / PLAN B ve tahmini bitişi çizer", () => {
    const html = draw(st);
    expect(html).toContain("PLAN A");
    expect(html).toContain("PLAN B");
    expect(html).toContain("Tahmini bitiş");
    expect(html).toContain("6:04:13");   // Pescara toplam (21853.1 sn)
    expect(html).toContain("6:04:27");   // Caspian toplam (21867 sn)
  });

  it("hayalet araç numarası ve araç görseli satırdan gelir", () => {
    const html = draw(st);
    expect(html).toContain("#4");
    expect(html).toContain("#75");
    expect(html).toContain("cars/gt3/ferrari");
    expect(html).toContain("class/gt3.png");
  });

  it("karar kartı: sonuç, kazanan, fark ve iki istatistik kutusu", () => {
    const html = draw(st);
    expect(html).toContain("Sonuç");
    expect(html).toContain("Tempo farkı");
    expect(html).toContain("Sabit farkı");
    expect(html).toContain("−60.9");     // tempo farkı
    expect(html).toContain("0.080");     // breakeven sn/tur
  });

  /* Fişin kuralı: iki satır ORTAK ölçekte çizilir (max = büyük sabit kayıp),
     değeri 0 olan segment hiç çizilmez, %11'den dar segmentin yazısı gizlenir. */
  it("sabit kayıp dağılımı ortak ölçekte, sıfır segmentsiz çizilir", () => {
    const html = draw(st);
    expect(html).toContain("Sabit kayıp dağılımı");
    expect(html).toContain("Pit yolu");
    expect(html).toContain("Hasar");        // efsane (legend) her zaman tam
    // ceza/hasar 0 → ÇUBUKTA segment yok (segmentin title'ı "Ceza: …" olurdu).
    // Döküm TABLOSU yine "0.0" yazar — fişin kuralı bu, ikisi farklı yer.
    expect(html).not.toContain('title="Ceza:');
    expect(html).not.toContain('title="Hasar:');
    expect(html).toContain('title="Pit yolu:');   // dolu kalem segmenti var
  });

  it("pist seçilince başlıkta bayrak ve pist adı görünür", () => {
    const html = draw(st);
    expect(html).toContain("flags/spa.png");
    expect(html).toContain("Spa-Francorchamps");
  });

  it("kayıt defteri satırı araç görseli + ad ile çizilir, izleyicide düzenleme yok", () => {
    expect(draw(st)).toContain("✎");
    expect(draw(st, { readOnly: true })).not.toContain("✎");
  });
});

describe("RowEditModal — fişin 6. bölümü (satır düzenleme penceresi)", () => {
  const row = { name: "#4 PESCARA SRT", num: "4", car: "ferrari", cls: "gt3",
    pits: "6", stints: "7", pitLane: "24", fuelFull: "40", fuelLast: "2",
    tyreTime: "12", tyreCount: "4", avgLap: "2:02.150" };
  const drawModal = (r, opt = {}) => renderToStaticMarkup(
    <RowEditModal t={(x) => x} row={r} idx={0} res={teamTime(r, 174)}
      warns={stintWarnings(r)} carList={CARS.gt3} carClasses={CAR_CLASSES} clsSel="gt3"
      opts={[{ key: "A", laps: 8, ready: true }, { key: "B", laps: 9, ready: true }]}
      carSrc="/assets/cars/gt3/ferrari.webp"
      onUp={noop} onDel={noop} onSeedInto={noop} onClose={noop} {...opt} />);

  it("başlık, ad/araç alanları ve 11 sayısal alan çizilir", () => {
    const html = drawModal(row);
    expect(html).toContain("Kayıt satırı");
    expect(html).toContain("değerleri düzenle");
    expect(html).toContain("Takım / plan adı");
    expect(html).toContain("Ferrari 296 GT3");     // gerçek CARS listesinden
    expect(html).toContain("Strateji planından doldur");
    expect(html).toContain("Bitti");
    expect(html).toContain("Satırı sil");
  });

  it("adı boş satırda alt yazı 'yeni satır' olur", () => {
    expect(drawModal({ ...row, name: "" })).toContain("yeni satır — değerleri gir");
  });

  /* Eksik zorunlu alan amber kenarlıkla işaretlenir — hesabı durduran alanı
     kullanıcı pencerede görebilmeli (CLAUDE.md §1). */
  it("eksik zorunlu alan amber işaretlenir", () => {
    const html = drawModal({ ...row, avgLap: "" });
    expect(html).toContain("var(--rc-warn)");
  });

  it("tutarsız satırda uyarı bloğu çıkar", () => {
    expect(drawModal({ ...row, stints: "99" })).toContain("Stint sayısı pit + 1 olmalı");
  });
});

describe("StratCompTab — kod incelemesi düzeltmeleri (regresyon)", () => {
  /* REGRESYON: tek satırlık defterde stratPick A ve B'yi de 0'a kırpıyordu;
     ekran satırı KENDİSİYLE karşılaştırıp "İki strateji eşit · 0.0" yazıyordu —
     hiçbir karşılaştırma yokken üretilmiş uydurma bir "sonuç". */
  it("tek satırlık defterde satır KENDİSİYLE karşılaştırılmaz", () => {
    const html = draw(mk({ stratTeams: [CASPIAN], stratA: 0, stratB: 0, stratLaps: 174 }));
    expect(html).not.toContain("İki strateji eşit");
    expect(html).not.toContain("sn önde");
    expect(html).toContain("Karşılaştırma için deftere en az iki satır ekleyin.");
  });

  it("A ve B aynı satırı gösterirse ayrı uyarı çıkar", () => {
    const html = draw(mk({ stratTeams: [PESCARA, CASPIAN], stratA: 1, stratB: 1, stratLaps: 174 }));
    expect(html).toContain("A ve B aynı satırı gösteriyor");
    expect(html).not.toContain("İki strateji eşit");
  });

  /* REGRESYON: yerel clamp tam sayı olmayan indeksi geçiriyor, teams[1.5]
     okunuyordu. state.stratPick bunu eler. */
  it("tam sayı olmayan seçim indeksi 0'a düşer, çökmez", () => {
    const html = draw(mk({ stratTeams: [PESCARA, CASPIAN], stratA: 1.5, stratB: 1, stratLaps: 174 }));
    expect(html).toContain("#4 PESCARA SRT");   // 1.5 → 0 (Pescara)
    expect(html).toContain("sn önde");
  });
});
