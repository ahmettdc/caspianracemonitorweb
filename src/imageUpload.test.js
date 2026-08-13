import { describe, it, expect } from "vitest";
import { sniffImageType, fitRect, IMG_SPECS, IMG_ACCEPT_TYPES } from "./imageUpload.js";

/* Magic byte tespiti — uzantı/MIME sahteciliğine karşı ikinci savunma hattı. */
describe("sniffImageType", () => {
  it("PNG imzasını tanır (89 50 4E 47)", () => {
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])))
      .toBe("png");
  });

  it("JPEG imzasını tanır (FF D8 FF)", () => {
    expect(sniffImageType(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10])))
      .toBe("jpeg");
  });

  it("WebP imzasını tanır (RIFF....WEBP)", () => {
    const b = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38]);
    expect(sniffImageType(b)).toBe("webp");
  });

  it("GIF imzasını tanır (görsel ama KABUL edilmeyen tür → çağıran reddeder)", () => {
    expect(sniffImageType(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])))
      .toBe("gif");
  });

  it("RIFF ama WEBP olmayan (ör. WAV) → null", () => {
    const b = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00,
      0x57, 0x41, 0x56, 0x45]);   // "WAVE"
    expect(sniffImageType(b)).toBe(null);
  });

  it("tanınmayan/eksik veri → null (sahte-uzantılı .exe yakalanır)", () => {
    expect(sniffImageType(new Uint8Array([0x4D, 0x5A, 0x90, 0x00]))).toBe(null); // MZ (exe)
    expect(sniffImageType(new Uint8Array([0x89]))).toBe(null);
    expect(sniffImageType(null)).toBe(null);
    expect(sniffImageType(new Uint8Array([]))).toBe(null);
  });
});

/* Yerleşim matematiği — cover merkez kırpma, contain şeffaf dolgu.
   Tuval boyutları statik asset'lerle birebir → hizalama garantisi buradan. */
describe("fitRect", () => {
  it("cover: geniş kaynak yatayda merkezden kırpılır (avatar 256²)", () => {
    const r = fitRect(1000, 500, 256, 256, "cover");
    // ölçek = max(256/1000, 256/500) = 0.512 → kaynaktan 500×500 pencere
    expect(r.sWidth).toBeCloseTo(500);
    expect(r.sHeight).toBeCloseTo(500);
    expect(r.sx).toBeCloseTo(250);       // (1000-500)/2 → merkez
    expect(r.sy).toBeCloseTo(0);
    expect(r.dx).toBe(0); expect(r.dy).toBe(0);
    expect(r.dWidth).toBe(256); expect(r.dHeight).toBe(256);
  });

  it("contain: dik kaynak side tuvaline (1000×400) dolgu ile sığar", () => {
    const r = fitRect(400, 400, 1000, 400, "contain");
    // ölçek = min(1000/400, 400/400) = 1 → 400×400, yatayda ortalanır
    expect(r.dWidth).toBeCloseTo(400);
    expect(r.dHeight).toBeCloseTo(400);
    expect(r.dx).toBeCloseTo(300);       // (1000-400)/2
    expect(r.dy).toBeCloseTo(0);
    expect(r.sx).toBe(0); expect(r.sWidth).toBe(400);
  });

  it("contain: yatay kaynak top tuvaline (400×1000) dikeyde ortalanır", () => {
    const r = fitRect(800, 400, 400, 1000, "contain");
    // ölçek = min(400/800, 1000/400) = 0.5 → 400×200
    expect(r.dWidth).toBeCloseTo(400);
    expect(r.dHeight).toBeCloseTo(200);
    expect(r.dx).toBeCloseTo(0);
    expect(r.dy).toBeCloseTo(400);       // (1000-200)/2
  });

  it("kaynak = hedef → birebir kopya (her iki fit)", () => {
    for (const fit of ["cover", "contain"]) {
      const r = fitRect(256, 256, 256, 256, fit);
      expect(r.sx).toBe(0); expect(r.sy).toBe(0);
      expect(r.dx).toBe(0); expect(r.dy).toBe(0);
      expect(r.dWidth).toBe(256); expect(r.dHeight).toBe(256);
    }
  });

  it("geçersiz boyutlar → null (çağıran hata verir)", () => {
    expect(fitRect(0, 100, 256, 256, "cover")).toBe(null);
    expect(fitRect(100, -5, 256, 256, "contain")).toBe(null);
    expect(fitRect(100, 100, 0, 256, "cover")).toBe(null);
  });
});

/* Spec sözleşmesi — cap değerleri firebase-rules.json validate'leriyle hizalı,
   tuval boyutları statik asset'lerle birebir. Kayarsa hizalama/kural bozulur. */
describe("IMG_SPECS sözleşmesi", () => {
  it("tuval boyutları statik asset boyutlarıyla eşleşir", () => {
    expect(IMG_SPECS.carSide.w).toBe(1000); expect(IMG_SPECS.carSide.h).toBe(400);
    expect(IMG_SPECS.carTop.w).toBe(400);  expect(IMG_SPECS.carTop.h).toBe(1000);
  });

  it("cap değerleri kural validate sınırlarıyla hizalı", () => {
    expect(IMG_SPECS.avatar.cap).toBe(60000);
    expect(IMG_SPECS.logo.cap).toBe(100000);
    expect(IMG_SPECS.carSide.cap).toBe(200000);
    expect(IMG_SPECS.carTop.cap).toBe(200000);
  });

  it("avatar cover, diğerleri contain (şeffaf dolgu = hizalama)", () => {
    expect(IMG_SPECS.avatar.fit).toBe("cover");
    expect(IMG_SPECS.logo.fit).toBe("contain");
    expect(IMG_SPECS.carSide.fit).toBe("contain");
    expect(IMG_SPECS.carTop.fit).toBe("contain");
  });

  it("kabul edilen türler: png/jpeg/webp (gif yok)", () => {
    expect(IMG_ACCEPT_TYPES).toEqual(["image/png", "image/jpeg", "image/webp"]);
  });
});
