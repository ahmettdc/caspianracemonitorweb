/* ============================================================
   chatDiag — sohbet penceresi "görünmez panel" teşhisi
   ------------------------------------------------------------
   NEDEN VAR: v2.2.1 ve v2.2.2'de sol KANALLAR panelinin görünmemesi iki kez
   yanlış teşhisle (GPU/compositing) düzeltilmeye çalışıldı. Gerçek sebep, kanal
   <button>'larının inline `color` vermemesiydi: <button> metin rengini miras
   ALMAZ, UA `color:buttontext` (siyah) atar → koyu panelde kontrast 1.08:1.

   Bu modül aynı sınıf hatayı bir daha uzaktan tahmin etmeden yakalayabilmek için
   pencere açıldığında GERÇEK DOM'u ölçer: geometri (0 boyut / satır kayması) ve
   efektif metin/zemin kontrastı. Sorun bulursa her zaman console.warn basar;
   ayrıntılı dökümü yalnız hata ayıklama açıkken verir.

   KULLANIM (kullanıcı tarafında):
     • Konsolda:  __rcChatDiag()      → anlık rapor döker
     • Kalıcı ayrıntı:  localStorage.rc_debug_chat = "1"  (veya adres sonuna ?debug=chat)
   Ölçüm yapılamayan ortamlarda (jsdom/test — layout motoru yok) sessizce çıkar. */

const TRANSPARENT = /^(transparent|rgba\(0,\s*0,\s*0,\s*0\))$/;

/* "rgb(r, g, b)" / "rgba(r, g, b, a)" → bağıl parlaklık (WCAG 2.1).
   YALNIZ rgb(a) kabul eder: tarayıcılar getComputedStyle().color'ı her zaman böyle
   serileştirir. oklch()/hsl() gibi bir biçim gelirse rakamları körlemesine ayıklayıp
   yanlış bir sayı üretmek yerine null döner — ölçemediğimizi bilmek, yanlış ölçmekten iyi. */
function luminance(rgb) {
  if (!/^rgba?\(/.test(String(rgb).trim())) return null;
  const m = String(rgb).match(/\d+(\.\d+)?/g);
  if (!m || m.length < 3) return null;
  const f = (c) => {
    const s = Number(c) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]);
}

/* İki renk arası WCAG kontrast oranı (1–21). Hesaplanamazsa null. */
export function contrastRatio(fg, bg) {
  const a = luminance(fg); const b = luminance(bg);
  if (a === null || b === null) return null;
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/* Elemanın ARDINDAKİ gerçek zemini bul: saydam olmayan ilk ataya çık. */
function effectiveBg(el) {
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const bg = getComputedStyle(n).backgroundColor;
    if (bg && !TRANSPARENT.test(bg.replace(/\s/g, ""))) return bg;
  }
  return "rgb(0, 0, 0)";
}

const box = (el) => {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
};

/* Sohbet penceresini ölç. Rapor: { ok, sorunlar[], panel, kanallar[] } veya null. */
export function inspectChat(root = document) {
  const panel = root.querySelector('[data-rc-chat="panel"]');
  const modal = root.querySelector('[data-rc-chat="box"]');
  if (!panel || !modal) return null;

  const mb = box(modal);
  // Layout motoru yok (jsdom/test) → ölçüm anlamsız, sessizce çık.
  if (!mb.w && !mb.h) return null;

  const pb = box(panel);
  const ps = getComputedStyle(panel);
  const sorunlar = [];

  if (pb.w < 1 || pb.h < 1) sorunlar.push(`sol panel boyutu sıfır (${pb.w}x${pb.h})`);
  if (ps.display === "none") sorunlar.push("sol panel display:none");
  if (ps.visibility === "hidden") sorunlar.push("sol panel visibility:hidden");
  if (Number(ps.opacity) === 0) sorunlar.push("sol panel opacity:0");

  const right = root.querySelector('[data-rc-chat="msgs"]');
  if (right) {
    const rb = box(right);
    // flex-wrap: dar pencerede sağ sütun alt satıra düşer → düzen bozulur.
    if (rb.h > 0 && rb.y >= pb.y + pb.h) {
      sorunlar.push(`düzen satır kaydı (flex-wrap): sağ sütun alt satıra düştü `
        + `— pencere ${Math.round(window.innerWidth)}px`);
    }
  }

  const kanallar = [...panel.querySelectorAll("[data-chat-chan]")].map((btn) => {
    const label = btn.querySelector("b");
    const target = label || btn;
    const cs = getComputedStyle(target);
    const bg = effectiveBg(btn);
    const cr = contrastRatio(cs.color, bg);
    const bb = box(btn);
    const kanal = {
      id: btn.getAttribute("data-chat-chan"),
      metin: (label?.textContent || "").trim(),
      renk: cs.color, zemin: bg,
      kontrast: cr === null ? null : Number(cr.toFixed(2)),
      kutu: bb,
    };
    if (bb.w < 1 || bb.h < 1) sorunlar.push(`kanal "${kanal.id}" boyutu sıfır`);
    // 1.6:1 altı = pratikte okunamaz (siyah-üstü-siyah 1.08:1 ile bulunmuştu).
    else if (cr !== null && cr < 1.6) {
      sorunlar.push(`kanal "${kanal.id}" metni görünmez — kontrast ${cr.toFixed(2)}:1 `
        + `(${cs.color} / ${bg})`);
    }
    return kanal;
  });

  if (!kanallar.length) sorunlar.push("hiç kanal butonu render edilmemiş");

  return { ok: sorunlar.length === 0, sorunlar, panel: { kutu: pb, zemin: ps.backgroundColor }, kanallar };
}

const verbose = () => {
  try {
    return localStorage.getItem("rc_debug_chat") === "1"
      || /[?&]debug=chat\b/.test(location.search);
  } catch { return false; }
};

/* Ölçümü yap ve konsola yaz. Sorun varsa HER ZAMAN uyarır; tam döküm yalnız
   ayrıntı modunda. Raporu döndürür (konsoldan çağrılabilsin diye). */
export function reportChat(root = document) {
  let rep = null;
  try { rep = inspectChat(root); } catch { return null; }
  if (!rep) return null;

  if (!rep.ok) {
    console.warn("[sohbet] GÖRÜNÜRLÜK SORUNU:\n  - " + rep.sorunlar.join("\n  - "));
  }
  if (verbose()) {
    console.groupCollapsed(`[sohbet] teşhis — ${rep.ok ? "sorun yok" : rep.sorunlar.length + " sorun"}`);
    console.log("sol panel:", rep.panel);
    console.table(rep.kanallar.map((k) => ({
      kanal: k.id, metin: k.metin, renk: k.renk, zemin: k.zemin,
      kontrast: k.kontrast, gen: k.kutu.w, yuk: k.kutu.h,
    })));
    console.groupEnd();
  }
  return rep;
}

/* Konsoldan elle çağrılabilsin: __rcChatDiag() */
export function installChatDiag() {
  if (typeof window === "undefined") return;
  window.__rcChatDiag = () => {
    const rep = inspectChat();
    if (!rep) { console.warn("[sohbet] pencere kapalı ya da ölçülemiyor — önce sohbeti aç."); return null; }
    console.log("[sohbet] sol panel:", rep.panel);
    console.table(rep.kanallar.map((k) => ({
      kanal: k.id, metin: k.metin, renk: k.renk, zemin: k.zemin,
      kontrast: k.kontrast, gen: k.kutu.w, yuk: k.kutu.h,
    })));
    console.log(rep.ok ? "[sohbet] sorun bulunamadı." : "[sohbet] sorunlar:\n  - " + rep.sorunlar.join("\n  - "));
    return rep;
  };
}
