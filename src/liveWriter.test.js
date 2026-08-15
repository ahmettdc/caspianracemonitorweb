import { describe, it, expect } from "vitest";
import { shouldClaim, LIVE_WRITER_STALE_MS, shouldYield, LIVE_YIELD_MS, bridgeWaitInfo } from "./liveWriter.js";

/* Tek-yazıcı seçimi (livewriter lease) saf kararı. now = server-hizalı ms.
   Kira: { uid, by, driving, ts }. STALE = LIVE_WRITER_STALE_MS. */
describe("shouldClaim — tek-yazıcı seçimi", () => {
  const NOW = 1_000_000;
  const fresh = (uid, driving) => ({ uid, by: uid, driving, ts: NOW });

  it("kira yoksa alır", () => {
    expect(shouldClaim(null, "A", false, NOW)).toBe(true);
    expect(shouldClaim(undefined, "A", true, NOW)).toBe(true);
  });

  it("kira benimse tazeler (alır)", () => {
    expect(shouldClaim(fresh("A", false), "A", false, NOW)).toBe(true);
    expect(shouldClaim(fresh("A", true), "A", true, NOW)).toBe(true);
  });

  it("kira başkasının ve taze ise — ben sürmüyorsam dokunmaz", () => {
    expect(shouldClaim(fresh("B", true), "A", false, NOW)).toBe(false);
    expect(shouldClaim(fresh("B", false), "A", false, NOW)).toBe(false);
  });

  it("kira bayatsa devralır (oyun kapandı → tazelenmedi)", () => {
    const stale = { uid: "B", by: "B", driving: true, ts: NOW - LIVE_WRITER_STALE_MS - 1 };
    expect(shouldClaim(stale, "A", false, NOW)).toBe(true);
  });

  it("tam eşikte henüz bayat değil (> katı)", () => {
    const edge = { uid: "B", by: "B", driving: false, ts: NOW - LIVE_WRITER_STALE_MS };
    expect(shouldClaim(edge, "A", false, NOW)).toBe(false);
  });

  it("BEN aktif sürücüyüm + tutan sürmüyor → önceliklendirir (anında devir)", () => {
    expect(shouldClaim(fresh("B", false), "A", true, NOW)).toBe(true);
  });

  it("BEN sürüyorum ama tutan da sürüyorsa çalmaz (yapışkan)", () => {
    expect(shouldClaim(fresh("B", true), "A", true, NOW)).toBe(false);
  });

  it("uid yoksa asla yazmaz (kimliksiz seçim yok)", () => {
    expect(shouldClaim(null, "", true, NOW)).toBe(false);
    expect(shouldClaim(fresh("A", true), "", true, NOW)).toBe(false);
  });

  it("kira ts sayı değilse bayat sayılmaz (benim/preempt dışında dokunmaz)", () => {
    const noTs = { uid: "B", by: "B", driving: false, ts: null };
    expect(shouldClaim(noTs, "A", false, NOW)).toBe(false);
    expect(shouldClaim(noTs, "A", true, NOW)).toBe(true);   // preempt yine geçerli
  });
});

/* Saha boşken köprü kartı mesaj seçimi — sidecar _diag.wait'inden. En kritik durum
   "noplugin": eklenti DLL'i yokken mmap hayalet mapping oluşturduğu için köprü
   "çalışıyor" görünüyordu ve eski tek mesaj sebebi söyleyemiyordu (üyenin PC'si
   "okumuyor" şikâyeti). */
describe("bridgeWaitInfo — bekleme nedeni mesaj seçimi", () => {
  it("noplugin → warn (kırmızı): kurulum hatası, bekleyerek düzelmez", () => {
    expect(bridgeWaitInfo({ wait: "noplugin" })).toEqual({ key: "noplugin", warn: true });
  });
  it("menu / novehicles → normal bekleme", () => {
    expect(bridgeWaitInfo({ wait: "menu" })).toEqual({ key: "menu", warn: false });
    expect(bridgeWaitInfo({ wait: "novehicles" })).toEqual({ key: "novehicles", warn: false });
  });
  it("eski sidecar (wait alanı yok) → generic (geriye uyum)", () => {
    expect(bridgeWaitInfo({ shm: true, cars: 0 }).key).toBe("generic");
    expect(bridgeWaitInfo(null).key).toBe("generic");
    expect(bridgeWaitInfo(undefined).key).toBe("generic");
    expect(bridgeWaitInfo({ wait: null }).key).toBe("generic");
  });
});

/* Başka yazıcıya boyun eğme (v1.8.8) — hafif köprü kiraya katılmaz, aynı hesabın
   iki penceresi kirayı ikisi de "benim" sayar → kira tek başına yetmiyordu (iki
   yazıcı, ekran kare kare yanıp sönüyordu). Bize ait olmayan TAZE bir kare varsa
   bu uygulama yazmaz; kare bayatlarsa devralır (failover). */
describe("shouldYield — başka yazıcının taze karesine boyun eğ", () => {
  const NOW = 5_000_000;
  it("taze yabancı kare → boyun eğ (hafif köprü / diğer pencere kazanır)", () => {
    expect(shouldYield({ ts: NOW - 1000, by: "savas" }, NOW)).toBe(true);
    expect(shouldYield({ ts: NOW - (LIVE_YIELD_MS - 1), by: "x" }, NOW)).toBe(true);
  });
  it("bayat kare → devral (yazıcı sustu, failover)", () => {
    expect(shouldYield({ ts: NOW - LIVE_YIELD_MS, by: "savas" }, NOW)).toBe(false);
    expect(shouldYield({ ts: NOW - 60_000, by: "savas" }, NOW)).toBe(false);
  });
  it("yabancı kare hiç yok / ts bozuk → yaz", () => {
    expect(shouldYield(null, NOW)).toBe(false);
    expect(shouldYield(undefined, NOW)).toBe(false);
    expect(shouldYield({ by: "x" }, NOW)).toBe(false);
    expect(shouldYield({ ts: "abc", by: "x" }, NOW)).toBe(false);
  });
});
