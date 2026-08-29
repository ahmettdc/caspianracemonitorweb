/* ============================================================
   chatDiag — sohbet penceresi "görünmez panel" teşhisi
   ------------------------------------------------------------
   NEDEN VAR: sol KANALLAR panelinin görünmemesi v2.2.1 ve v2.2.2'de iki kez
   yanlış teşhisle (GPU/compositing) düzeltilmeye çalışıldı. v2.2.3'te gerçek bir
   hata bulundu ve düzeltildi (kanal <button>'ları inline `color` vermiyordu →
   UA `color:buttontext` = siyah → koyu panelde kontrast 1.08:1). Ancak sahadan
   gelen ekran görüntüsü, ChatModal'ın KENDİ çizdiği her şeyin (sol panelin tamamı
   + sağ panelin başlık çubuğu) hâlâ görünmediğini, yalnız chatBody çıktısının
   (mesajlar) göründüğünü gösterdi. Yani başka bir sebep daha var.

   Sorun tablette/telefonda görüldüğü için KONSOL LOGU İŞE YARAMIYOR — geliştirici
   araçları açılamıyor. Bu modül bu yüzden ölçümü EKRANA basar: kullanıcı ekran
   görüntüsü alıp gönderebilir ya da "Kopyala" ile JSON'u panoya alabilir.

   KULLANIM
     • Adresin sonuna  ?debug=chat  ekle (tablet/telefon için en kolayı)
     • veya konsolda:  localStorage.rc_debug_chat = "1"
     • veya konsolda:  __rcChatDiag()        → anlık rapor + panel

   Panel bilerek "kurşun geçirmez" çizilir: CSS değişkeni yok, sınıf yok, sabit
   renkler, document.body'ye doğrudan eklenir ve en yüksek z-index'i alır — ölçtüğü
   hatadan kendisi etkilenmesin diye.
   Layout motoru olmayan ortamlarda (jsdom/test) sessizce çıkar. */
import { APP_VERSION } from "./constants";

const ID = "rc-chat-diag";

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

const desc = (el) => (el ? el.tagName.toLowerCase()
  + (el.getAttribute?.("data-rc-chat") ? `[${el.getAttribute("data-rc-chat")}]` : "")
  + (el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/)[0]}` : "")
  : "(yok)");

/* Elemanın ortasında GERÇEKTEN o eleman mı var? Değilse üstünü ne örtüyor?
   "Kutu duruyor ama içerik görünmüyor" vakasında örtme birinci şüphelidir. */
function coverTest(el) {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return { ok: false, not: "boyut yok" };
  const cx = Math.round(r.x + r.width / 2);
  const cy = Math.round(r.y + Math.min(r.height / 2, 60));
  if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) {
    return { ok: false, not: "ekran dışında" };
  }
  const hit = document.elementFromPoint(cx, cy);
  if (!hit) return { ok: false, not: "elementFromPoint boş" };
  if (hit === el || el.contains(hit)) return { ok: true, not: "" };
  /* Kendi ölçüm panelimiz de ekranda duruyor ve modalin üstüne gelebiliyor.
     Onu "örten eleman" diye raporlamak yanlış alarm olur — yok say. */
  if (hit.closest && hit.closest(`#${ID}`)) return { ok: true, not: "" };
  return { ok: false, not: `ÜSTÜNÜ ÖRTEN: ${desc(hit)}` };
}

/* Bir elemanın "neden görünmüyor" sorusunu yanıtlayabilecek tüm alanları topla. */
function snapshot(el, label) {
  if (!el) return { label, yok: true };
  const s = getComputedStyle(el);
  const r = box(el);
  const bg = effectiveBg(el);
  const cr = contrastRatio(s.color, bg);
  return {
    label,
    kutu: r,
    /* KRİTİK: "kutu doğru boyutta ama içi bomboş" vakasında asıl soru, çocukların
       DOM'a hiç girmemiş mi yoksa girip görünmez mi olduğudur. Bu üç alan onu ayırır. */
    cocuk: el.childElementCount,
    htmlUzunluk: el.innerHTML.length,
    html: el.innerHTML.replace(/\s+/g, " ").slice(0, 220),
    metin: (el.textContent || "").trim().slice(0, 42),
    renk: s.color,
    zemin: bg,
    kontrast: cr === null ? null : Number(cr.toFixed(2)),
    display: s.display, visibility: s.visibility, opacity: s.opacity,
    overflow: s.overflow, position: s.position, zIndex: s.zIndex,
    transform: s.transform === "none" ? "none" : s.transform.slice(0, 34),
    filter: s.filter, clipPath: s.clipPath, mixBlendMode: s.mixBlendMode,
    contain: s.contain, contentVisibility: s.contentVisibility,
    textFill: s.webkitTextFillColor || "",
    font: s.fontFamily.slice(0, 30), fontSize: s.fontSize,
    ort: coverTest(el),
  };
}

/* Bir anlık görüntüden "bu görünmez" gerekçelerini çıkar. */
function faultsOf(s) {
  const out = [];
  if (s.yok) return [`${s.label}: DOM'da YOK`];
  if (s.kutu.w < 1 || s.kutu.h < 1) out.push(`${s.label}: boyut sıfır (${s.kutu.w}x${s.kutu.h})`);
  if (s.display === "none") out.push(`${s.label}: display:none`);
  if (s.visibility !== "visible") out.push(`${s.label}: visibility:${s.visibility}`);
  if (Number(s.opacity) < 0.05) out.push(`${s.label}: opacity:${s.opacity}`);
  if (!s.ort.ok && s.ort.not.startsWith("ÜSTÜNÜ")) out.push(`${s.label}: ${s.ort.not}`);
  // Kutu yerinde ama içi tamamen boş → çocuklar DOM'a hiç girmemiş demektir.
  if (s.htmlUzunluk === 0 && s.kutu.w > 1 && s.kutu.h > 1) {
    out.push(`${s.label}: kutu var (${s.kutu.w}×${s.kutu.h}) ama İÇİ BOŞ — çocuk render edilmemiş`);
  }
  if (s.metin && s.kontrast !== null && s.kontrast < 1.6) {
    out.push(`${s.label}: metin görünmez — kontrast ${s.kontrast}:1 (${s.renk} / ${s.zemin})`);
  }
  if (s.textFill && s.textFill !== s.renk && !TRANSPARENT.test(s.textFill.replace(/\s/g, ""))) {
    out.push(`${s.label}: -webkit-text-fill-color farklı (${s.textFill})`);
  }
  return out;
}

/* Sohbet penceresini ölç. Rapor veya null (pencere kapalı / layout yok). */
export function inspectChat(root = document) {
  const q = (k) => root.querySelector(`[data-rc-chat="${k}"]`);
  const modal = q("box"); const panel = q("panel");
  if (!modal || !panel) return null;
  const mb = box(modal);
  if (!mb.w && !mb.h) return null;   // jsdom/test — ölçüm anlamsız

  const parts = [
    snapshot(modal, "pencere"),
    snapshot(panel, "sol panel"),
    snapshot(q("panel-hdr"), "sol başlık"),
    snapshot(q("panel-list"), "kanal listesi"),
    snapshot(q("msgs"), "sağ sütun"),
    snapshot(q("msgs-hdr"), "sağ başlık"),
  ];
  const kanallar = [...panel.querySelectorAll("[data-chat-chan]")].map((b, i) =>
    snapshot(b.querySelector("b") || b, `kanal ${b.getAttribute("data-chat-chan") || i}`));

  const sorunlar = [...parts, ...kanallar].flatMap(faultsOf);

  // flex-wrap: dar pencerede sağ sütun alt satıra düşer → düzen bozulur.
  const pb = parts[1].kutu; const rb = parts[4].yok ? null : parts[4].kutu;
  if (rb && rb.h > 0 && rb.y >= pb.y + pb.h) {
    sorunlar.push(`düzen satır kaydı (flex-wrap): sağ sütun alt satıra düştü (pencere ${innerWidth}px)`);
  }
  if (!kanallar.length) sorunlar.push("hiç kanal butonu render edilmemiş");

  return {
    ok: sorunlar.length === 0,
    sorunlar,
    surum: APP_VERSION,
    ortam: {
      ekran: `${innerWidth}x${innerHeight}`, dpr: devicePixelRatio,
      tema: document.documentElement.getAttribute("data-theme") || "dark(varsayılan)",
      fontlar: (document.fonts && document.fonts.status) || "?",
      ua: navigator.userAgent.slice(0, 90),
    },
    parcalar: parts,
    kanallar,
  };
}

/* Teşhis yalnız hata ayıklama bayrağı açıkken çalışır: ?debug=chat (adres) veya
   localStorage.rc_debug_chat="1". ChatModal otomatik ölçüm kancasını da buna bağlar. */
export const chatDiagEnabled = () => {
  try {
    return localStorage.getItem("rc_debug_chat") === "1"
      || /[?&#]debug=chat\b/.test(location.search + location.hash);
  } catch { return /[?&#]debug=chat\b/.test(location.search + location.hash); }
};
const flagOn = chatDiagEnabled;

/* ---- ekran üstü panel -------------------------------------------------
   Konsolu olmayan cihazlar (tablet/telefon) için. Sabit renk + inline stil:
   ölçtüğü görünürlük hatasından kendisi etkilenmesin. */
function line(k, v, renk) {
  return `<div style="display:flex;gap:8px;padding:1px 0">
    <span style="color:#9aa;flex:0 0 108px">${k}</span>
    <span style="color:${renk || "#fff"};word-break:break-all">${v}</span></div>`;
}

function partHtml(s) {
  if (s.yok) return `<div style="color:#ff6b6b;padding:3px 0">■ ${s.label}: DOM'da YOK</div>`;
  const kotu = faultsOf(s).length > 0;
  return `<div style="border-top:1px solid #333;padding:5px 0;margin-top:4px">
    <div style="color:${kotu ? "#ff6b6b" : "#5fd97f"};font-weight:700">
      ${kotu ? "✘" : "✔"} ${s.label}</div>
    ${line("kutu", `${s.kutu.w}×${s.kutu.h} @ ${s.kutu.x},${s.kutu.y}`)}
    ${line("içerik", `${s.cocuk} çocuk · ${s.htmlUzunluk} karakter html`,
    s.cocuk === 0 ? "#ff6b6b" : "#5fd97f")}
    ${s.htmlUzunluk ? line("html", `<span style="color:#8ab">${s.html
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span>`) : ""}
    ${s.metin ? line("metin", `"${s.metin}"`) : ""}
    ${line("renk", `${s.renk} / zemin ${s.zemin}`)}
    ${line("kontrast", s.kontrast === null ? "?" : `${s.kontrast}:1`,
    s.kontrast !== null && s.kontrast < 1.6 ? "#ff6b6b" : "#5fd97f")}
    ${line("görünürlük", `display:${s.display} · vis:${s.visibility} · op:${s.opacity}`)}
    ${line("katman", `pos:${s.position} · z:${s.zIndex} · tf:${s.transform}`)}
    ${line("kırpma", `overflow:${s.overflow} · clip:${s.clipPath} · contain:${s.contain}`)}
    ${line("üstünde", s.ort.ok ? "kendisi (örtülmemiş)" : s.ort.not,
    s.ort.ok ? "#5fd97f" : "#ff6b6b")}
  </div>`;
}

export function showOverlay(rep) {
  if (typeof document === "undefined" || !rep) return;
  document.getElementById(ID)?.remove();
  const el = document.createElement("div");
  el.id = ID;
  el.setAttribute("style", [
    "position:fixed", "left:8px", "bottom:8px", "width:min(560px,94vw)",
    "max-height:74vh", "overflow:auto", "z-index:2147483647",
    "background:#0a0a0c", "border:2px solid #d24357", "border-radius:10px",
    "padding:10px 12px", "color:#fff", "font:11.5px/1.45 ui-monospace,Menlo,Consolas,monospace",
    "box-shadow:0 10px 40px rgba(0,0,0,.8)", "-webkit-text-fill-color:#fff",
  ].join(";"));

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <b style="color:#ff97a6;font-size:13px">SOHBET TEŞHİS</b>
      <span style="color:#9aa">${rep.surum}</span>
      <span style="margin-left:auto;display:flex;gap:6px">
        <button id="${ID}-copy" style="background:#2a1a1f;color:#fff;border:1px solid #d24357;
          border-radius:6px;padding:3px 10px;font:inherit;cursor:pointer">Kopyala</button>
        <button id="${ID}-x" style="background:#2a1a1f;color:#fff;border:1px solid #555;
          border-radius:6px;padding:3px 10px;font:inherit;cursor:pointer">Kapat</button>
      </span>
    </div>
    <div style="padding:5px 7px;border-radius:6px;margin-bottom:5px;
      background:${rep.ok ? "#0d2b16" : "#3a0f16"};color:${rep.ok ? "#5fd97f" : "#ff9aa6"}">
      ${rep.ok ? "Ölçümde sorun bulunamadı."
    : `${rep.sorunlar.length} SORUN:<br>• ${rep.sorunlar.join("<br>• ")}`}
    </div>
    ${line("ekran", `${rep.ortam.ekran} · dpr ${rep.ortam.dpr} · tema ${rep.ortam.tema}`)}
    ${line("fontlar", rep.ortam.fontlar)}
    ${line("tarayıcı", rep.ortam.ua)}
    ${[...rep.parcalar, ...rep.kanallar].map(partHtml).join("")}`;

  document.body.appendChild(el);
  el.querySelector(`#${ID}-x`).onclick = () => el.remove();
  el.querySelector(`#${ID}-copy`).onclick = async (e) => {
    const txt = JSON.stringify(rep, null, 1);
    try {
      await navigator.clipboard.writeText(txt);
      e.target.textContent = "Kopyalandı ✓";
    } catch {
      // Pano izni yoksa: metni seçilebilir bir kutuya bas, kullanıcı elle kopyalasın.
      const ta = document.createElement("textarea");
      ta.value = txt;
      ta.setAttribute("style", "width:100%;height:150px;margin-top:6px;background:#000;color:#fff");
      el.appendChild(ta); ta.select();
      e.target.textContent = "Seç & kopyala";
    }
  };
}

/* Ölçüm yapılamadığında da ayrıntı modunda EKRANA bir şey basmalıyız: aksi halde
   kullanıcı "panel hiç çıkmadı" der ve elimizde yine veri olmaz. En sık sebep,
   tarayıcının ESKİ bir paketi önbellekten sunması — o pakette data-rc-chat
   işaretleri yoktur. Sürümü göstermek bunu tek bakışta ayırır. */
function showMissingOverlay(reason) {
  if (typeof document === "undefined") return;
  document.getElementById(ID)?.remove();
  const el = document.createElement("div");
  el.id = ID;
  el.setAttribute("style", [
    "position:fixed", "left:8px", "bottom:8px", "width:min(560px,94vw)",
    "z-index:2147483647", "background:#0a0a0c", "border:2px solid #d24357",
    "border-radius:10px", "padding:10px 12px", "color:#fff",
    "font:11.5px/1.45 ui-monospace,Menlo,Consolas,monospace", "-webkit-text-fill-color:#fff",
  ].join(";"));
  el.innerHTML = `<b style="color:#ff97a6">SOHBET TEŞHİS</b>
    <span style="color:#9aa"> ${APP_VERSION}</span>
    <div style="margin-top:6px;color:#ff9aa6">${reason}</div>
    ${line("işaretler", document.querySelector("[data-rc-chat]")
    ? "bulundu" : "YOK → tarayıcı eski paketi sunuyor olabilir (sayfayı sert yenile)")}
    ${line("ekran", `${innerWidth}x${innerHeight} · dpr ${devicePixelRatio}`)}
    ${line("tarayıcı", navigator.userAgent.slice(0, 90))}
    <button id="${ID}-x" style="margin-top:8px;background:#2a1a1f;color:#fff;
      border:1px solid #555;border-radius:6px;padding:3px 10px;font:inherit">Kapat</button>`;
  document.body.appendChild(el);
  el.querySelector(`#${ID}-x`).onclick = () => el.remove();
}

/* Ölçümü yap; sorun varsa HER ZAMAN konsola uyar, ayrıntı modunda ekrana bas. */
export function reportChat(root = document) {
  let rep = null;
  try { rep = inspectChat(root); }
  catch (e) {
    if (flagOn()) showMissingOverlay(`Ölçüm hata verdi: ${e?.message || e}`);
    return null;
  }
  if (!rep) {
    if (flagOn()) showMissingOverlay("Sohbet penceresi ölçülemedi (bulunamadı ya da düzen yok).");
    return null;
  }
  if (!rep.ok) console.warn("[sohbet] GÖRÜNÜRLÜK SORUNU:\n  - " + rep.sorunlar.join("\n  - "));
  if (flagOn()) { try { showOverlay(rep); } catch { /* panel çizilemedi, yoksay */ } }
  return rep;
}

/* Konsoldan elle çağrılabilsin: __rcChatDiag() — panel de açar. */
export function installChatDiag() {
  if (typeof window === "undefined") return;
  window.__rcChatDiag = () => {
    const rep = inspectChat();
    if (!rep) {
      console.warn("[sohbet] pencere kapalı ya da ölçülemiyor — önce sohbeti aç.");
      showMissingOverlay("Sohbet penceresi ölçülemedi — önce sohbeti aç, sonra tekrar dene.");
      return null;
    }
    console.log("[sohbet] rapor:", rep);
    try { showOverlay(rep); } catch { /* yoksay */ }
    return rep;
  };
}
