import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { contrastRatio } from "./chatDiag";
import { ChatModal } from "./components.jsx";
import { css } from "./styles";

/* v2.2.3 regresyon kilidi — "sohbet kanalları görünmüyor" hatası.
   Kök neden: kanal <button>'ları inline style'ında `color` vermiyordu. <button>
   metin rengini MİRAS ALMAZ (UA `color:buttontext` = siyah atar), bu yüzden koyu
   panelde kanal adları 1.08:1 kontrastla okunamaz hale geliyordu. Hata iki sürüm
   boyunca (v2.2.1, v2.2.2) "GPU/compositing" diye yanlış teşhis edildi.
   Aşağıdaki testler üç savunma katmanının da yerinde kalmasını şart koşar. */

const noop = () => {};
const chans = [
  { id: "global", lbl: "Genel", ico: "🌍", path: "globalChat" },
  { id: "team", lbl: "Takım", ico: "🏢", path: "teams/t1/chat" },
];

const renderChat = () => renderToStaticMarkup(
  <ChatModal open onClose={noop} t={(s) => s} chatSound toggleChatSound={noop}
    chatChans={chans} unreadOf={() => 0} chatChan="global" setChatChan={noop}
    teamData={null} curChan={chans[0]} chatBody={() => null}
    chatAll={{}} fmtClock={() => "12:00"} />);

/* markup'tan data-chat-chan taşıyan <button ...> etiketlerini çıkar */
const chanButtons = (html) => html.match(/<button[^>]*data-chat-chan[^>]*>/g) || [];

describe("contrastRatio", () => {
  it("siyah metin / koyu panel = okunamaz (hatanın imzası)", () => {
    const cr = contrastRatio("rgb(0, 0, 0)", "rgb(18, 12, 14)");
    expect(cr).toBeLessThan(1.6);
    expect(cr).toBeCloseTo(1.08, 1);
  });

  it("tema metni / koyu panel = okunur", () => {
    expect(contrastRatio("rgb(243, 234, 236)", "rgb(18, 12, 14)")).toBeGreaterThan(4.5);
  });

  it("simetriktir ve ayrıştırılamayan renkte null döner", () => {
    expect(contrastRatio("rgb(0,0,0)", "rgb(255,255,255)"))
      .toBeCloseTo(contrastRatio("rgb(255,255,255)", "rgb(0,0,0)"), 6);
    expect(contrastRatio("oklch(0 0 0)", "rgb(0,0,0)")).toBeNull();
  });
});

describe("sohbet kanal listesi görünürlüğü", () => {
  it("her kanal butonu açık bir metin rengi bildirir", () => {
    const btns = chanButtons(renderChat());
    expect(btns.length).toBe(chans.length);
    // `color:` olmalı — ama background-color/border-color eşleşmesi sayılmamalı.
    for (const b of btns) expect(b).toMatch(/(?<!-)\bcolor:\s*var\(--rc-text\)/);
  });

  /* Teşhis bu işaretlerle ölçüm alır; biri düşerse rapor sessizce körleşir. */
  it("teşhis kancasının hedefleri (data-rc-chat) yerinde", () => {
    const html = renderChat();
    for (const k of ["box", "panel", "panel-hdr", "panel-list", "msgs", "msgs-hdr"]) {
      expect(html).toContain(`data-rc-chat="${k}"`);
    }
  });
});

/* v2.2.3 asıl hata — sahadan alınan ölçümle bulundu:
   kutu y=157 h=660 iken çocukları y=-13 h=911 ve kutu scrollTop=2182.
   flexWrap:"wrap", flex satırının kutunun kesin yüksekliği yerine içeriğin doğal
   boyuna uzamasına izin veriyordu; kutu taşınca scrollIntoView({block:"end"})
   (overflow:hidden PROGRAMATİK kaydırmayı engellemez) modalin kendisini kaydırıp
   iki başlığı ve kanal listesini kırpma çizgisinin üstünde bırakıyordu. */
describe("pencere kendi kendine kaymamalı (başlıkların kırpılma hatası)", () => {
  const boxTag = (html) => html.match(/<div[^>]*data-rc-chat="box"[^>]*>/)[0];
  const tagOf = (html, key) => html.match(new RegExp(`<div[^>]*data-rc-chat="${key}"[^>]*>`))[0];

  it("flex satırı sarmalanmaz — içerik kutuyu uzatamaz", () => {
    const b = boxTag(renderChat());
    expect(b).toMatch(/flex-wrap:\s*nowrap/);
    expect(b).not.toMatch(/flex-wrap:\s*wrap/);
  });

  it("iki sütun da min-height:0 bildirir (iç kaydırma flex'te ancak böyle çalışır)", () => {
    const html = renderChat();
    for (const k of ["panel", "msgs"]) {
      expect(tagOf(html, k)).toMatch(/min-height:\s*0/);
    }
  });

  it("sol panel dar ekranda küçülebilir (alt satıra düşemeyeceği için)", () => {
    expect(tagOf(renderChat(), "panel")).toMatch(/flex:\s*0 1 280px/);
  });
});

describe("global güvenlik ağı (styles.js)", () => {
  it("koyu temada color-scheme:dark bildirilir", () => {
    expect(css).toMatch(/color-scheme:\s*dark/);
    expect(css).toMatch(/color-scheme:\s*light/);
  });

  it("form elemanları metin rengini miras alır", () => {
    expect(css).toMatch(/\.rc button[^{]*\{[^}]*color:\s*inherit/);
  });

  it("dosya bir template literal — CSS metninde ters tırnak kalmamalı", () => {
    expect(css).not.toContain("`");
  });
});
