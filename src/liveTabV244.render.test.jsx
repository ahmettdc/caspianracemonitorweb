/* LiveTab render testleri (v2.4.4 — "Bizim araç" elle seçimi).

   Saha durumu: köprü SPECTATE/yayın feed'inden besleniyor → oyunun "player" aracı
   (isPlayer) bizim yarışan aracımız değil (ya da hiç yok). O zaman meRow/playerClass
   çözülmez: "Poz·Sınıf" süzgeci GT3'e çekmez, karşılaştırma açılmaz. Düzeltme:
   kullanıcı aracını elle sabitler (cihaza özel, oda başına localStorage) → meRow,
   playerClass, sınıf süzgeci ve isMe vurgusu bu seçimden beslenir.

   renderToStaticMarkup — efektler çalışmaz ama useState BAŞLATICISI çalışır, o da
   seçimi localStorage'dan senkron okur → sabitlenmiş durum statik render'da görünür. */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

globalThis.window ??= globalThis;
globalThis.document ??= {
  fullscreenEnabled: false, fullscreenElement: null,
  addEventListener() {}, removeEventListener() {}, createElement: () => ({}),
};
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
/* Gerçek bir store: sabitlenmiş seçimi render'dan ÖNCE yazıp okutabilelim. */
const store = {};
globalThis.localStorage ??= {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const { default: LiveTab } = await import("./tabs/LiveTab.jsx");
const { demoLive } = await import("./liveDemo.js");

const t = (s) => s;
const patch = (base, fn) => ({ ...base, field: base.field.map((c, i) => ({ ...c, ...fn(c, i) })) });
const render = (live, rid = "y") => renderToStaticMarkup(
  <LiveTab t={t} live={live} canEdit={false} tid="x" rid={rid} />);

describe("Bizim araç — spectate feed'inde isPlayer yokken", () => {
  const noPlayer = patch(demoLive(30), () => ({ isPlayer: false }));

  it("'Bizim araç' seçici HER ZAMAN render edilir (çare sunulur)", () => {
    const html = render(noPlayer, "r-none");
    expect(html).toContain("Bizim araç");
    expect(html).toMatch(/<select/);
  });

  it("isPlayer yok + seçim yok → Poz·Sınıf süzgeç butonu YOK (hata durumu birebir)", () => {
    const html = render(noPlayer, "r-none");
    // playerClass undefined → başlık düz metin; süzgeç butonunun title'ı çıkmamalı
    expect(html).not.toContain("Kendi sınıfım süzgeci");
    // kimse "bizim araç" değil → vurgulanan (live) satır da yok
    expect(html).not.toMatch(/class="live[ "]/);
  });
});

describe("Bizim araç — elle sabitlenince meRow/playerClass çözülür", () => {
  const noPlayer = patch(demoLive(30), () => ({ isPlayer: false }));
  const gt3 = noPlayer.field.find((c) => c.carClass === "LMGT3");

  it("fikstür sağlıklı: isPlayer'sız bir GT3 aracı var ve numarası belli", () => {
    expect(gt3).toBeTruthy();
    expect(gt3.number).toBeTypeOf("number");
  });

  it("numarayla sabitlenince: sınıf süzgeci aktifleşir ve o satır 'live' işaretlenir", () => {
    localStorage.setItem("caspian.myCar.r-pin",
      JSON.stringify({ num: gt3.number, key: gt3.lapKey }));
    const html = render(noPlayer, "r-pin");
    // playerClass artık LMGT3 → Poz·Sınıf tıklanabilir süzgeç butonu çıkar
    expect(html).toContain("Kendi sınıfım süzgeci");
    // sabitlenen araç satırı "bizim araç" olarak vurgulanır
    expect(html).toMatch(/class="live[ "]/);
  });

  it("numara eşleşmesi pilot değişiminden bağımsızdır (carKey değil numara)", () => {
    // sürücü adını değiştir ama numara aynı kalsın → yine eşleşmeli
    const swapped = patch(noPlayer, (c) =>
      (c.number === gt3.number ? { driver: "Yedek Pilot", lapKey: "bambaska" } : null));
    localStorage.setItem("caspian.myCar.r-swap",
      JSON.stringify({ num: gt3.number, key: gt3.lapKey }));
    const html = render(swapped, "r-swap");
    expect(html).toContain("Kendi sınıfım süzgeci");
    expect(html).toMatch(/class="live[ "]/);
  });
});

describe("Bırakanları gizle (DNF/DSQ) — turları tararken temiz liste", () => {
  // bir aracı yarıştan BIRAKMIŞ (finishStatus 2 = DNF) yap, benzersiz isim ver
  const withDnf = patch(demoLive(30), (c, i) =>
    (i === 0 ? { finishStatus: 2, driver: "Birakan Pilot" } : null));

  it("varsayılan (kapalı): bırakan araç listede görünür ve toggle sunulur", () => {
    localStorage.removeItem("caspian.hideRetired");
    const html = render(withDnf, "r-dnf-off");
    expect(html).toContain("Birakan Pilot");
    expect(html).toContain("Bırakanları gizle");   // sahada DNF var → düğme çıkar
  });

  it("açıkken: bırakan araç STANDINGS satırından çıkar (occurrence azalır)", () => {
    // Not: isim "Bizim araç" açılır menüsünde her hâlükârda listelenir; bu yüzden
    // tüm html'de yokluğunu değil, STANDINGS satırının gittiğini → occurrence
    // SAYISININ düştüğünü doğruluyoruz (kapalı: menü + satır; açık: yalnız menü).
    const occ = (s) => s.split("Birakan Pilot").length - 1;
    localStorage.removeItem("caspian.hideRetired");
    const off = render(withDnf, "r-dnf-a");
    localStorage.setItem("caspian.hideRetired", "1");
    const on = render(withDnf, "r-dnf-b");
    expect(occ(on)).toBeLessThan(occ(off));          // satır kalktı
    expect(on).toContain("Bırakanlar gizli");        // düğmenin açık etiketi
    expect(on).toContain("gizli");                   // "· N gizli" sayaç notu
    localStorage.removeItem("caspian.hideRetired");
  });

  it("sahada hiç DNF/DSQ yoksa toggle gösterilmez", () => {
    localStorage.removeItem("caspian.hideRetired");
    const noRetire = patch(demoLive(30), () => ({ finishStatus: 0 }));  // demo #9'u da temizle
    const html = render(noRetire, "r-nodnf");
    expect(html).not.toContain("Bırakanları gizle");
    expect(html).not.toContain("Bırakanlar gizli");
  });
});
