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
