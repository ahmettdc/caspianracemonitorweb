import { describe, it, expect } from "vitest";
import { shouldPush, shouldApplyRemote } from "./raceSyncGate";

/* v2.4.1 REGRESYON — oda değişiminde bekleyen yazım.
   Senaryo: kullanıcı A yarışında bir hücre düzenler (800 ms zamanlayıcı kurulur),
   800 ms dolmadan B yarışına geçer. Zamanlayıcı ateşlendiğinde `stRef.current`
   ARTIK B'nin state'idir; hedef yol ise hâlâ A'dır. Eskiden yazım gidiyordu →
   A'nın planı, rev arttığı için A'daki HER editörde B'nin verisiyle eziliyordu. */
describe("shouldPush — bekleyen yazım hedef odaya mı gidiyor", () => {
  it("normal durum: hedef = açık oda, uygulama yok → YAZ", () => {
    expect(shouldPush(false, "raceA", "raceA")).toBe(true);
  });

  it("ODA DEĞİŞTİ: zamanlayıcı A'ya kurulmuş, artık B açık → YAZMA", () => {
    expect(shouldPush(false, "raceA", "raceB")).toBe(false);
  });

  it("LOBİYE ÇIKILDI: açık oda yok → YAZMA", () => {
    expect(shouldPush(false, "raceA", "")).toBe(false);
    expect(shouldPush(false, "raceA", null)).toBe(false);
  });

  /* openRace'in `await raceStateGet` penceresi: `curRace` HENÜZ eski odadır
     (setCurRace daha çağrılmadı) ama setSt(loaded) ile `stRef` ÇOKTAN yeni
     odanındır. Yani rid karşılaştırması bu anı yakalayamaz — `applying` şart. */
  it("openRace await penceresi: rid eşleşiyor AMA applying → YAZMA", () => {
    expect(shouldPush(true, "raceA", "raceA")).toBe(false);
  });

  it("uzak state uygulanırken yankı yazımı → YAZMA", () => {
    expect(shouldPush(true, "raceB", "raceB")).toBe(false);
  });

  it("hedefsiz yazım (rid boş) → YAZMA", () => {
    expect(shouldPush(false, "", "")).toBe(false);
    expect(shouldPush(false, null, null)).toBe(false);
    expect(shouldPush(false, undefined, "raceA")).toBe(false);
  });
});

/* v2.4.1 REGRESYON — REV ÇAKIŞMASI.
   Rev sunucuda transaction ile değil istemcide `rev + 1` olarak üretiliyor ve
   düz `set` ile yazılıyor. İki editör aynı rev'ten yazınca ikisi de aynı
   numarayı üretir; sunucuda biri kalır. `remote.rev > localRev` koşulu yüzünden
   KAYBEDEN taraf kazananın yazımını hiç uygulamıyor, ekranında kendi state'i
   kalıyor ve bir sonraki düzenlemesi diğerinin işini sessizce siliyordu. */
describe("shouldApplyRemote — rev çakışmasında kaybeden tarafı uyandır", () => {
  it("daha yeni rev → UYGULA", () => {
    expect(shouldApplyRemote(7, 1000, 6, null)).toBe(true);
    expect(shouldApplyRemote(7, 1000, 6, 999)).toBe(true);
  });

  it("daha eski rev → UYGULAMA (geç gelen kare)", () => {
    expect(shouldApplyRemote(5, 1000, 6, null)).toBe(false);
  });

  it("ÇAKIŞMA: aynı rev, damga BAŞKASININ → UYGULA (yarışı kaybettik)", () => {
    // İkimiz de rev 6 yazdık; bizim damgamız 1000, sunucuda kalan 1001.
    expect(shouldApplyRemote(6, 1001, 6, 1000)).toBe(true);
  });

  it("KENDİ yazımımızın yankısı: aynı rev, aynı damga → UYGULAMA", () => {
    expect(shouldApplyRemote(6, 1000, 6, 1000)).toBe(false);
  });

  it("hiç yazmadık (mineAt null): aynı rev → UYGULAMA", () => {
    /* Odayı yeni açtık; ilk anlık görüntü aynı rev ile gelir. Uygulasaydık
       açılıştan hemen sonraki düzenleme geri alınırdı. */
    expect(shouldApplyRemote(6, 1000, 6, null)).toBe(false);
  });

  it("bozuk sayı → UYGULAMA (son iyi durumu koru)", () => {
    expect(shouldApplyRemote(undefined, 1000, 6, null)).toBe(false);
    expect(shouldApplyRemote(6, 1000, undefined, null)).toBe(false);
    expect(shouldApplyRemote("abc", 1000, 6, null)).toBe(false);
  });

  it("aynı rev ama uzak damga yok → UYGULAMA (ayırt edilemez)", () => {
    expect(shouldApplyRemote(6, null, 6, 1000)).toBe(false);
  });
});
