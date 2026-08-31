import { describe, it, expect } from "vitest";
import { binKey, packBins, unpackBins, LEGACY_NB } from "./trackShape.js";

describe("binKey", () => {
  it("pist adından Firebase-güvenli anahtar (yasak karakterler → _)", () => {
    expect(binKey("Spa-Francorchamps", 7004)).toBe("Spa-Francorchamps");
    expect(binKey("Le Mans / Circuit.24h", 13629)).toBe("Le Mans _ Circuit_24h");
    expect(binKey("a#b$c[d]", 0)).toBe("a_b_c_d_");
  });
  it("ad yoksa yuvarlanmış uzunluktan L{n}", () => {
    expect(binKey("", 5891.4)).toBe("L5891");
    expect(binKey(null, 5891.4)).toBe("L5891");
    expect(binKey("   ", 4000)).toBe("L4000");
  });
  it("ad ve uzunluk yoksa boş (paylaşım kapalı)", () => {
    expect(binKey("", 0)).toBe("");
    expect(binKey(null, null)).toBe("");
  });
});

describe("packBins / unpackBins", () => {
  it("round-trip: kutular korunur (TAM METRE), b'ye göre sıralı", () => {
    const bins = { 5: { x: 12.34, z: -5.67 }, 1: { x: 0, z: 100.25 } };
    const packed = packBins(bins);
    expect(packed).toBe("1:0,100;5:12,-6");
    const back = unpackBins(packed);
    expect(back[1]).toEqual({ x: 0, z: 100 });
    expect(back[5]).toEqual({ x: 12, z: -6 });
  });
  it("geçersiz koordinatlı kutu atlanır", () => {
    const packed = packBins({ 0: { x: NaN, z: 1 }, 2: { x: 3, z: 4 } });
    expect(packed).toBe("2:3,4");
  });
  /* v2.3.0: kutu sayısı 240→480'e çıkınca 1 ondalık MAX_STR'yi aşıp şeklin
     kuyruğunu kırpıyordu. Biçim tam metreye indirildi; eski kayıtlar okunmaya
     devam etmeli, yoksa sahadaki paylaşılmış şekiller bir anda bozulurdu. */
  it("GERİYE UYUM: eski ondalıklı stringler hâlâ okunur", () => {
    expect(unpackBins("1:0.0,100.3;5:12.3,-5.7"))
      .toEqual({ 1: { x: 0, z: 100.3 }, 5: { x: 12.3, z: -5.7 } });
  });
  it("bozuk / eksik string → {} veya sağlam parça", () => {
    expect(unpackBins("")).toEqual({});
    expect(unpackBins(null)).toEqual({});
    expect(unpackBins("çöp")).toEqual({});
    expect(unpackBins("3:1,2;bozuk;5:9,9")).toEqual({ 3: { x: 1, z: 2 }, 5: { x: 9, z: 9 } });
  });
  it("boş/null bins → boş string", () => {
    expect(packBins(null)).toBe("");
    expect(packBins({})).toBe("");
  });
  it("480 kutuluk gerçekçi şekil round-trip (boyut sınırı altında)", () => {
    const bins = {};
    for (let i = 0; i < 480; i++) bins[i] = { x: Math.sin(i) * 500, z: Math.cos(i) * 400 };
    const packed = packBins(bins);
    expect(packed.length).toBeLessThan(9000);
    expect(Object.keys(unpackBins(packed)).length).toBe(480);
  });
  /* EN KÖTÜ DURUM kilidi: Nordschleife ölçeğinde (±10000 m) NEGATİF koordinatlar
     en uzun stringi üretir. 1 ondalıkla bu 9490 karaktere çıkıp kırpılıyordu —
     paylaşılan şeklin sonu düşerdi ve kimse fark etmezdi. */
  /* ÇÖZÜNÜRLÜK GÖÇÜ — kutu sayısı 240→480'e çıkınca takımın v2.2.4'te kaydettiği
     şekil SESSİZCE bozuk okunuyordu: index'in anlamı NB'ye bağlı, index 120 eskiden
     yarım tur iken yenide çeyrek tur oluyor → tur ilk yarıya sıkışıyor. Üstelik
     240 kutu "yeterince dolu" eşiğini (480×0.45=216) aştığı için bozuk şekil hemen
     çiziliyordu. */
  it("BAŞLIKSIZ (v2.2.4) kayıt 240 varsayılıp hedef çözünürlüğe TAŞINIR", () => {
    expect(LEGACY_NB).toBe(240);
    // eski index 120 = yarım tur → 480'de ~240 olmalı
    const out = unpackBins("120:100,200", 480);
    const idx = Number(Object.keys(out)[0]);
    expect(idx / 480).toBeCloseTo(0.5, 2);
    expect(out[idx]).toEqual({ x: 100, z: 200 });
  });

  it("BAŞLIKLI kayıt kendi çözünürlüğünden taşınır", () => {
    expect(Number(Object.keys(unpackBins("n240;120:1,2", 480))[0]) / 480)
      .toBeCloseTo(0.5, 2);
    // aynı çözünürlük → indeks değişmez
    expect(unpackBins("n480;120:1,2", 480)).toEqual({ 120: { x: 1, z: 2 } });
  });

  it("packBins çözünürlük başlığı yazar; round-trip indeksi korur", () => {
    const packed = packBins({ 7: { x: 1, z: 2 } }, 480);
    expect(packed.startsWith("n480;")).toBe(true);
    expect(unpackBins(packed, 480)).toEqual({ 7: { x: 1, z: 2 } });
  });

  it("nb verilmezse eski çağrı biçimi korunur (taşıma yapılmaz)", () => {
    expect(unpackBins("120:1,2")).toEqual({ 120: { x: 1, z: 2 } });
  });

  it("EN KÖTÜ koordinatlarla 480 kutu kırpılmaz (hiç kutu kaybolmaz)", () => {
    const bins = {};
    for (let i = 0; i < 480; i++) bins[i] = { x: -9999.7, z: -8888.7 };
    const packed = packBins(bins);
    expect(packed.length).toBeLessThan(8800);
    expect(Object.keys(unpackBins(packed)).length).toBe(480);
  });
});
