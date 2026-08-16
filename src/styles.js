/* Global tema / CSS — main.jsx tarafından boot'ta bir kez <head>'e enjekte edilir.
   Fontlar index.html'deki <link> ile gelir (@import buradan kaldırıldı — JS'ten
   keşfedilen font isteği ilk boyamayı geciktiriyordu). */
export const css = `
:root{
  /* ── v2.0 DESIGN TOKENS ────────────────────────────────────────────────────
     Kaynak: docs/design-handoff/README.md "Design Tokens". Prototipteki her stil
     değeri buradan bir token'a bağlanır; bileşen dosyalarında inline stil YOK
     (tek istisna: hesaplanan değerler — çubuk genişliği %, SVG koordinatı,
     canlı renk eşiği). Yeni ad uydurma — adlar README tablosundan.
     v1 adları (--panel2/--line2/--teal/--brand2/--sel-*) geri-uyum için korunur. */

  /* zemin ve yüzey */
  --bg:#0B0708;            /* sayfa zemini */
  --panel:#120C0E;         /* kart / tablo zemini */
  --panel-alt:#150E10;     /* ikincil kart, alt şerit, açılır menü zemini */
  --panel2:#1E1418;        /* girdi, düğme, hücre zemini */
  --line:#34232A;          /* ana çizgi / çerçeve */
  --line-soft:#241519;     /* tablo satır ayracı */
  --line-softer:#1B1013;   /* iç liste ayracı */
  --line-strong:#4A2F38;   /* vurgulu çerçeve, panel kenarı */
  --line-dim:#5C3B44;      /* pasif ikon / çizgi */
  --line2:var(--line-strong);          /* v1 alias */

  /* marka ve metin */
  --car:#960018;           /* marka kırmızısı (birincil düğme, kendi araç satırı) */
  --accent:#D24357;        /* vurgu (başlık, aktif çerçeve, vites) */
  --accent-soft:#C51E38;   /* rozet zemini (okunmamış sayacı) */
  --txt:#F3EAEC;           /* ana metin */
  --dim:#C9B3B9;           /* ikincil metin */
  --muted:#A88C93;         /* etiket / üçüncül metin */
  --faint:#6B4A52;         /* pasif metin */
  --on-car:#FFE9ED;        /* marka zemin üstü metin */
  --teal:var(--accent);                /* v1 alias */
  --brand2:var(--accent-soft);         /* v1 alias */

  /* durum */
  --green:#37D67A;         /* iyi / canlı / kişisel en iyi */
  --yellow:#F5B23D;        /* uyarı, sarı bayrak, favori */
  --red:#FF4D5E;           /* hata, ceza, kritik */
  --purple:#B58BFF;        /* sınıf en iyi turu, telemetri vurgusu */
  --blue:#4C9AFF;          /* LMP2, sürücü rozeti, karşılaştırma B */
  --focus:var(--accent);

  /* sınıf renkleri — constants.js CLASS_ACCENT ile BİREBİR aynı */
  --cls-hypercar:#E7443B; --cls-lmp2:#4C9AFF; --cls-lmp3:#B58BFF;
  --cls-gt3:#EF8A2B; --cls-gte:#37D67A;

  /* zemin ıslaklığı — WX_COL */
  --wx-dry:#F5C84C; --wx-damp:#8FD0E8; --wx-slwet:#4D9FFF;
  --wx-wet:#7B8FF7; --wx-xwet:#5C6BC0;

  /* lastik kullanım renkleri — .t2/.tq/.t3/.t4/.tw/.terr ile eşit */
  --ty-new:#C9B3B9; --ty-2x:#F2C94C; --ty-qual:#6694FF;
  --ty-3x:#E8842A; --ty-4x:#DC2626; --ty-wet:#7FE3A0; --ty-err:#F0604D;

  /* telemetri yuvaları — SLOT_COLORS + A/B iz renkleri */
  --slot-a:#40D68C; --slot-b:#F0604D; --slot-c:#F2A33C; --slot-d:#6694FF;
  --trace-a:#ff5470; --trace-b:#4d9fff; --trace-neutral:#7a8797; --trace-cur:#3ad07a;

  /* seçili/aktif durum dolgusu */
  --sel-bg:rgba(150,0,24,.22); --sel-bg-soft:rgba(150,0,24,.12);
  --sel-strong:rgba(150,0,24,.28);     /* kendi araç satırı */
  --sel-border:var(--accent);
  --hover-row:rgba(255,255,255,.05);
  --scrim:rgba(10,6,10,.74);           /* pencere zemini */

  /* tipografi */
  --font-ui:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  --font-disp:'Rajdhani','Inter',system-ui,sans-serif;
  --font-mono:'IBM Plex Mono',ui-monospace,'Cascadia Code',Consolas,monospace;
  --fs-page:22px;      /* sayfa başlığı, 700, uppercase .06em */
  --fs-card:14px;      /* kart başlığı 14–16, 700, uppercase .08em */
  --fs-card-lg:16px;
  --fs-body:13px; --fs-body-sm:12.5px;
  --fs-label:10px;     /* etiket, uppercase .1em */
  --fs-kpi:20px; --fs-kpi-lg:36px;
  --hud-num:clamp(30px,3.2vw,44px);
  --hud-num-lg:clamp(38px,4.2vw,60px);
  --ls-page:.06em; --ls-card:.08em; --ls-label:.1em; --ls-eyebrow:.14em;

  /* yarıçap */
  --r-xs:7px; --r-sm:8px; --r-md:9px; --r-lg:10px; --r-xl:12px;
  --r-modal:14px; --r-modal-lg:16px; --r-pill:99px;

  /* boşluk */
  --sp-1:5px; --sp-2:6px; --sp-3:8px; --sp-4:10px; --sp-5:12px;
  --sp-6:14px; --sp-7:16px; --sp-8:20px;

  /* gölge */
  --sh-modal:0 24px 70px rgba(0,0,0,.6);
  --sh-tray:0 16px 46px rgba(0,0,0,.55);
  --sh-panel:-18px 0 50px rgba(0,0,0,.5);

  /* ölçüler */
  --rail-w:76px;          /* sol ray */
  --side-w:320px;         /* canlı sağ paneli */
  --rd-w:min(400px,94vw); /* yarış datası paneli */

  /* katman sırası — README "Interactions & Behavior" */
  --z-racebar:20; --z-rd-scrim:40; --z-rd:45; --z-tray:40;
  --z-rail:60; --z-modal:1000; --z-modal-nested:1010;
  --z-race-add:1030; --z-pdf:1040;

  /* hareket */
  --t-fast:.15s ease; --t-hover:.18s ease;
  --t-panel:.28s cubic-bezier(.4,0,.2,1);
  --t-panel-slow:.32s cubic-bezier(.4,0,.2,1);
  --t-screen:.26s ease-out;
}
/* --- Light mode — v2.0 KAPSAM DIŞI. v2.0 tek koyu temayla çıkar; header ☀/🌙
   anahtarı gizlendi (kod silinmedi). Bu blok v1'den olduğu gibi duruyor ve v2
   token'larının (--panel-alt, --faint, --on-car, --blue, --line-soft…) açık
   karşılıkları HENÜZ ÜRETİLMEDİ — sonraki turda tamamlanacak. --- */
:root[data-theme="light"]{
  --bg:#F4EEF0; --panel:#FFFFFF; --panel2:#F6EEF0; --line:#E2D3D8; --line2:#CBB4BC;
  --txt:#1B1215; --dim:#6C5A61; --muted:#87737B;
  --accent:#BC2A44; --teal:var(--accent); --brand2:#A5182F; --car:#960018;
  --green:#128A4D; --yellow:#B0790C; --red:#D22F3C; --purple:#7A4FD0;
  --focus:var(--accent);
  --sel-bg:rgba(150,0,24,.12); --sel-bg-soft:rgba(150,0,24,.06);
  --sel-border:var(--accent);
}
/* light modda koyu-sabit dekoratif zeminleri açık tona çevir (aksi halde açık zeminde
   koyu leke gibi durur). Tam-ekran pit board/big board bilinçli koyu kalır. */
:root[data-theme="light"] .rc .livestrip{background:#FBE9EC}
:root[data-theme="light"] .rc .hudstrip{
  background:radial-gradient(130% 180% at 100% 0,rgba(150,0,24,.10),#FBE9EC 62%)}
:root[data-theme="light"] .rc .lobby{
  background:radial-gradient(ellipse at 50% 0%,#F6D9DE 0%,var(--bg) 60%)}
.rc *{box-sizing:border-box}
.rc{min-height:100vh;background:var(--bg);color:var(--txt);
  font-family:var(--font-ui);font-size:13px;padding:0 0 40px}
.rc .mono{font-family:var(--font-mono)}
.rc .disp{font-family:var(--font-disp);letter-spacing:.04em}
.rc header{display:flex;align-items:center;flex-wrap:wrap;gap:12px;padding:14px 20px;
  border-bottom:1px solid var(--line)}
@media(max-width:720px){.rc header{gap:8px;padding:10px 14px}}
.rc header h1{margin:0;font-size:26px;font-weight:700;text-transform:uppercase;line-height:1}
.rc header h1 b{color:var(--accent)}
.rc header .ver{color:var(--dim);font-size:12px;margin-left:-4px;align-self:flex-end;
  padding-bottom:2px}
.rc .grid{display:grid;grid-template-columns:300px 1fr;gap:16px;padding:16px 20px;
  align-items:start;transition:grid-template-columns .28s ease,gap .28s ease}
.rc .grid.noside{grid-template-columns:0px 1fr;gap:0}
.rc .sidecol{overflow:hidden;min-width:0}
.rc .sideinner{width:300px;transition:opacity .22s ease}
.rc .grid.noside .sideinner{opacity:0;pointer-events:none}
.rc .sidetoggle{position:fixed;left:0;top:50%;transform:translateY(-50%);z-index:40;
  width:20px;height:72px;padding:0;border:1px solid var(--line);border-left:none;
  border-radius:0 10px 10px 0;background:var(--panel2);color:var(--dim);
  cursor:pointer;font-size:11px;line-height:1;transition:color .15s,border-color .15s}
.rc .sidetoggle:hover{color:var(--accent);border-color:var(--accent)}
@media(max-width:900px){.rc .grid{grid-template-columns:1fr}.rc .sidetoggle{display:none}}
/* Birleşik buton ölçeği (<Btn/>) — eski bespoke sınıflar korunuyor, kademeli geçiş.
   --subtle görünümü mevcut .adminbtn ile eşleşir. */
.rc .btn{position:relative;display:inline-flex;align-items:center;gap:6px;cursor:pointer;
  border:1px solid var(--line);border-radius:8px;background:var(--panel2);color:var(--txt);
  font-family:var(--font-ui);line-height:1.2;white-space:nowrap;
  transition:border-color .15s,color .15s,background .15s}
.rc .btn .btn-i{display:inline-flex;flex:0 0 auto}
.rc .btn--sm{padding:5px 11px;font-size:12px}
.rc .btn--md{padding:7px 13px;font-size:13px}
.rc .btn--lg{padding:11px 18px;font-size:16px;font-family:var(--font-disp);font-weight:700;
  letter-spacing:.05em;text-transform:uppercase}
.rc .btn--subtle:hover{border-color:var(--accent);color:var(--accent)}
.rc .btn--ghost{background:transparent;border-color:var(--accent);color:var(--accent)}
.rc .btn--ghost:hover{background:var(--sel-bg-soft)}
.rc .btn--primary{background:var(--car);color:#FFE9ED;border-color:var(--accent)}
.rc .btn--primary:hover{filter:brightness(1.08)}
.rc .btn--danger{background:transparent;border-color:var(--red);color:var(--red)}
.rc .btn--danger:hover{background:rgba(255,77,94,.12)}
.rc .btn:disabled{opacity:.5;cursor:not-allowed}
.rc .card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px}
.rc .card h2{margin:0 0 10px;font-size:15px;text-transform:uppercase;
  font-family:var(--font-disp);letter-spacing:.08em;color:var(--accent)}
.rc label{display:block;color:var(--dim);font-size:11px;margin:8px 0 3px;
  text-transform:uppercase;letter-spacing:.05em}
.rc input[type=text],.rc input[type=number],.rc input[type=datetime-local]{width:100%;background:var(--panel2);
  border:1px solid var(--line);border-radius:6px;color:var(--txt);
  padding:6px 8px;font-family:var(--font-mono);font-size:13px}
.rc input:focus{outline:2px solid var(--accent);outline-offset:-1px}
/* sayı alanlarında yukarı/aşağı ok her zaman görünür (madde: elle girme yerine tıkla) */
.rc input[type=number]{-moz-appearance:auto;appearance:auto}
.rc input[type=number]::-webkit-inner-spin-button,
.rc input[type=number]::-webkit-outer-spin-button{
  -webkit-appearance:inner-spin-button;appearance:auto;opacity:1;
  height:24px;cursor:pointer;filter:invert(.85) hue-rotate(300deg)}
.rc .row2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.rc .row4{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.rc .strat{display:flex;gap:6px;margin-top:4px}
.rc .strat button{flex:1;padding:7px 0;border-radius:6px;border:1px solid var(--line);
  background:var(--panel2);color:var(--dim);font-family:var(--font-disp);
  font-size:15px;font-weight:600;cursor:pointer}
.rc .strat button.on{background:var(--car);color:#FFE9ED;border-color:var(--accent)}
.rc .tabs{display:flex;gap:8px;margin-bottom:12px}
.rc .tabs button{padding:8px 16px;border-radius:8px 8px 0 0;border:1px solid var(--line);
  border-bottom:none;background:transparent;color:var(--dim);cursor:pointer;
  font-family:var(--font-disp);font-size:16px;font-weight:600;letter-spacing:.05em;
  text-transform:uppercase}
.rc .tabs button.on{background:var(--panel);color:var(--txt);border-color:var(--accent)}
.rc table{width:100%;border-collapse:collapse}
.rc th{color:var(--dim);font-size:10px;text-transform:uppercase;letter-spacing:.06em;
  text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}
.rc td{padding:7px 8px;border-bottom:1px solid #2E1D21;font-family:var(--font-mono);
  font-size:12.5px}
.rc tr.last td{background:rgba(64,214,140,.06)}
.rc .neg{color:var(--red)} .rc .pos{color:var(--green)}
.rc .chip{display:inline-block;padding:1px 7px;border-radius:99px;font-size:11px;
  border:1px solid var(--line);color:var(--dim)}
.rc .tyrebox{display:inline-flex;gap:3px;margin-right:8px}
.rc .tyrebox button{width:26px;height:22px;border-radius:4px;border:1px solid var(--line);
  background:var(--panel2);color:var(--dim);font-size:9px;cursor:pointer;
  font-family:var(--font-mono)}
.rc .tyrebox button.on{background:var(--yellow);color:#3A2E00;border-color:var(--yellow)}
.rc .tyrebox button.qual{background:#4D9FFF;color:#04213F;border-color:#4D9FFF}
.rc .tyrebox button.wet{background:#7FE3A0;color:#0C3A1F;border-color:#7FE3A0}
.rc .tyrebox button.used{background:#0B0D12;color:#E8E8EE;border-color:#6B7280;
  box-shadow:inset 0 0 0 1px #2a2e38}
.rc .pitopt{display:inline-flex;gap:4px}
.rc .pitopt button{padding:2px 8px;border-radius:4px;border:1px solid var(--line);
  background:var(--panel2);color:var(--dim);font-size:10px;cursor:pointer}
.rc .pitopt button:disabled{opacity:.35;cursor:not-allowed}
.rc .pitopt button.on{background:var(--car);color:#FFE9ED;border-color:var(--accent)}
/* §3: Fuel yanı Hasar/tamir süresi (s) — canlı pit board ile aynı st.pitRepairs[i]. */
.rc .pitopt .dmg{display:inline-flex;align-items:center;gap:2px;font-size:10px;color:var(--dim)}
.rc .pitopt .dmg input{width:34px;padding:2px 4px;border-radius:4px;border:1px solid var(--line);
  background:var(--panel2);color:var(--txt);font-size:10px;text-align:right;
  font-family:var(--font-mono)}
.rc .pitopt .dmg input::-webkit-outer-spin-button,
.rc .pitopt .dmg input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.rc .ovr{width:82px!important;padding:3px 6px!important;font-size:11px!important}
.rc .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));
  gap:10px;margin-bottom:14px}
.rc .kpi{background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:10px}
.rc .kpi .v{font-family:var(--font-disp);font-size:24px;font-weight:700;line-height:1}
.rc .kpi .l{color:var(--dim);font-size:10px;text-transform:uppercase;letter-spacing:.06em;
  margin-top:4px}
.rc .timeline{height:34px;display:flex;border-radius:6px;overflow:hidden;
  border:1px solid var(--line);margin:4px 0 14px}
.rc .timeline .seg{position:relative;min-width:2px}
.rc .timeline .seg span{position:absolute;inset:0;display:flex;align-items:center;
  justify-content:center;font-family:var(--font-disp);font-size:12px;font-weight:700;
  color:#FFE3E8;letter-spacing:.02em;overflow:hidden}
.rc .timeline .pit{background:var(--yellow)}
/* pilot şeridi (timeline omurgasının altı) */
.rc .drvlane{position:relative;display:flex;height:20px;margin:-8px 0 14px}
.rc .drvlane .dcell{display:flex;align-items:center;justify-content:center;overflow:hidden;
  white-space:nowrap;font-size:10.5px;color:var(--dim);background:var(--panel2);
  border:1px solid var(--line);border-left:none;border-radius:0}
.rc .drvlane .dcell:first-child{border-left:1px solid var(--line);border-radius:6px 0 0 6px}
.rc .drvlane .dcell:last-of-type{border-radius:0 6px 6px 0}
.rc .drvlane .dcell span{overflow:hidden;text-overflow:ellipsis;padding:0 6px;letter-spacing:.02em}
.rc .drvlane .dcell.cur{color:var(--txt);border-color:var(--accent);
  background:var(--sel-bg);font-weight:600}
.rc .drvlane .dgap{background:transparent;flex:0 0 auto}
.rc .hint{color:var(--dim);font-size:11px;margin-top:6px;line-height:1.5}
.rc .warn{color:var(--yellow)}
.rc .fuelbig{font-family:var(--font-disp);font-size:52px;font-weight:700;
  color:var(--green);line-height:1;margin:6px 0}
.rc .teambar{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-start;gap:8px;
  padding:10px 20px;border-bottom:1px solid var(--line);background:var(--panel)}
.rc .teambar.collapsed{padding:5px 20px}
.rc .bartoggle{background:var(--panel2);border:1px solid var(--line);border-radius:6px;
  color:var(--dim);cursor:pointer;padding:2px 12px;font-size:11px;line-height:1.4;
  font-family:var(--font-mono)}
.rc .bartoggle:hover{color:var(--txt);border-color:var(--accent)}
.rc .teambar input{width:110px;background:var(--panel2);border:1px solid var(--line);
  border-radius:6px;color:var(--txt);padding:6px 8px;font-family:var(--font-mono);
  font-size:12px;text-transform:uppercase}
.rc .teambar button{padding:6px 12px;border-radius:6px;border:1px solid var(--accent);
  background:transparent;color:var(--accent);cursor:pointer;font-family:var(--font-disp);
  font-size:14px;font-weight:600;letter-spacing:.05em;text-transform:uppercase}
.rc .teambar button.solid{background:var(--car);color:#FFE9ED}
.rc .teambar button.leave{border-color:var(--red);color:var(--red)}
.rc .dot{width:9px;height:9px;border-radius:99px;display:inline-block}
.rc .dot.on{background:var(--green);box-shadow:0 0 6px var(--green)}
.rc .dot.off{background:var(--dim)}
.rc .roomcode{font-family:var(--font-disp);font-weight:700;font-size:17px;
  color:var(--yellow);letter-spacing:.02em}
.rc .syncinfo{color:var(--dim);font-size:11px;margin-left:auto}
/* --- lobi --- */
.rc .lobby{min-height:100vh;display:flex;align-items:center;justify-content:center;
  padding:20px;background:radial-gradient(ellipse at 50% 0%,#2A0D14 0%,var(--bg) 60%)}
.rc .logo{display:block;margin:0 auto 14px;max-width:280px;width:70%;height:auto;
  filter:drop-shadow(0 6px 18px rgba(0,0,0,.5))}
.rc header img.hlogo{height:38px;width:auto;display:block;filter:drop-shadow(0 2px 6px rgba(0,0,0,.4))}
.rc .pitboard img.plogo{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);
  height:34px;width:auto;opacity:.85}
.rc .lobby .box{width:100%;max-width:430px;background:var(--panel);
  border:1px solid var(--line);border-radius:14px;padding:30px 28px}
.rc .lobby h1{margin:0;font-size:30px;font-weight:700;text-transform:uppercase;
  text-align:center;font-family:var(--font-disp);letter-spacing:.04em}
.rc .lobby h1 b{color:var(--accent)}
.rc .lobby .sub{text-align:center;color:var(--dim);font-size:12px;margin:4px 0 22px}
.rc .lobby .bigbtn{width:100%;padding:12px;border-radius:8px;border:1px solid var(--accent);
  background:var(--car);color:#FFE9ED;cursor:pointer;font-family:var(--font-disp);
  font-size:18px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-top:8px}
.rc .lobby .bigbtn.ghost{background:transparent;color:var(--accent);border-color:var(--accent)}
.rc .lobby .bigbtn:disabled{opacity:.5;cursor:wait}
.rc .lobby .divider{display:flex;align-items:center;gap:10px;color:var(--dim);
  margin:20px 0 8px;font-size:10px;text-transform:uppercase;letter-spacing:.12em}
.rc .lobby .divider::before,.rc .lobby .divider::after{
  content:"";flex:1;height:1px;background:var(--line)}
.rc .lobby .solo{display:block;width:100%;margin-top:22px;background:none;border:none;
  color:var(--dim);cursor:pointer;font-size:12px;text-decoration:underline;
  text-underline-offset:3px}
.rc .lobby .solo:hover{color:var(--txt)}
.rc .lobby .lmsg{margin-top:12px;color:var(--yellow);font-size:12px;text-align:center;
  min-height:16px}
/* --- pist & araç seçimi --- */
.rc .picksec{margin-top:18px}
.rc .picksec h3{margin:0 0 8px;font-size:12px;text-transform:uppercase;
  letter-spacing:.08em;color:var(--dim);font-family:var(--font-disp);font-size:15px}
.rc .trackgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}
.rc .trackgrid button{display:flex;align-items:center;gap:8px;padding:9px 10px;
  border-radius:8px;border:1px solid var(--line);background:var(--panel2);
  color:var(--txt);cursor:pointer;font-size:12px;text-align:left}
.rc .trackgrid button img{width:22px;height:auto;border-radius:2px;flex-shrink:0}
.rc .trackgrid button.on{border-color:var(--accent);background:var(--sel-bg);
  color:var(--accent);font-weight:600}
.rc .classtoggle{display:flex;flex-wrap:wrap;gap:8px}
.rc .classtoggle button{min-width:120px}
.rc .wxsel{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:4px 0 2px}
.rc .wxsel button{padding:6px 2px;border:1px solid var(--line);border-radius:8px;
  background:var(--panel2);color:var(--dim);cursor:pointer;font-size:11px;line-height:1.3;
  text-align:center;transition:border-color .15s,color .15s}
.rc .wxsel button small{font-family:var(--font-mono);opacity:.8;font-size:10px}
.rc .wxsel button.on{background:rgba(255,255,255,.05)}
.rc .minibtn{width:22px;height:22px;padding:0;border:1px solid var(--line);border-radius:6px;
  background:var(--panel2);color:var(--txt);cursor:pointer;font-size:13px;line-height:1}
.rc .minibtn:hover{border-color:var(--accent);color:var(--accent)}
.rc .histbtn{border:1px solid var(--line);border-radius:8px;background:var(--panel2);
  color:var(--txt);cursor:pointer;font-size:12px;padding:5px 12px;transition:border-color .15s}
.rc .histbtn:hover{border-color:var(--accent);color:var(--accent)}
.rc .gbtn{display:inline-flex;align-items:center;gap:10px;margin:0 auto;padding:11px 22px;
  border:1px solid var(--line);border-radius:10px;background:#fff;color:#1f1f1f;
  font-family:var(--font-disp);font-size:16px;letter-spacing:.04em;text-transform:uppercase;
  font-weight:600;cursor:pointer;transition:box-shadow .18s,transform .12s}
.rc .gbtn:hover{box-shadow:0 6px 20px rgba(0,0,0,.45);transform:translateY(-1px)}
.rc .gbtn:active{transform:scale(.98)}
.rc .adminbtn{position:relative;align-self:center;display:inline-flex;align-items:center;gap:5px;
  background:var(--panel2);border:1px solid var(--line);border-radius:8px;color:var(--txt);
  cursor:pointer;font-size:12px;padding:5px 11px}
.rc .adminbtn:hover{border-color:var(--accent);color:var(--accent)}
.rc .adminbtn .badge{position:absolute;top:-6px;right:-6px;background:var(--car);color:#fff;
  border-radius:9px;font-size:10px;padding:1px 6px;line-height:1.4}
.rc .lobbyteams{margin-bottom:14px;text-align:left}
/* Ana menü iki-kolon: sol ray (takım/sezon/yönetim) + sağ yarış grid'i.
   Dar ekranda tek kolona iner. İkincil footer (solo/indirme) ortalanır. */
.rc .lobbygrid{display:grid;grid-template-columns:232px 1fr;gap:18px;align-items:start}
.rc .lobbyrail{display:flex;flex-direction:column;gap:9px;min-width:0}
.rc .lobbyrail .rail-lbl{font-size:10px;letter-spacing:.12em;text-transform:uppercase;
  color:var(--muted);margin:6px 0 0 2px}
.rc .seasonfilter{display:flex;flex-wrap:wrap;gap:6px}
.rc .railmgmt{display:flex;flex-direction:column;gap:8px;margin-top:4px}
.rc .railmgmt .histbtn{width:100%;text-align:left}
.rc .lobbymain{min-width:0}
.rc .racegrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;
  margin-bottom:4px}
.rc .racegrid .lseason{grid-column:1/-1;margin:6px 0 2px 2px}
.rc .racegrid .lrace{margin-bottom:0;height:100%}
/* yarış satırı + owner/editor sil düğmesi (kart butonunun kardeşi, iç içe değil) */
.rc .lracewrap{display:flex;align-items:stretch;gap:6px}
.rc .lracewrap .lrace{flex:1;min-width:0}
.rc .lrdel{flex:0 0 auto;width:34px;border-radius:10px;background:transparent;
  border:1px solid var(--line2);color:var(--dim);font-size:13px;cursor:pointer;
  display:flex;align-items:center;justify-content:center}
.rc .lrdel:hover{border-color:#ff4d5e;color:#ff4d5e;background:var(--panel2)}
.rc .lobbyfoot{max-width:520px;margin-left:auto;margin-right:auto}
@media(max-width:720px){.rc .lobbygrid{grid-template-columns:1fr}}
.rc .lrace{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;margin-bottom:6px;
  border:1px solid var(--line);border-radius:10px;background:var(--panel2);cursor:pointer;
  transition:border-color .15s,transform .12s;text-align:left}
.rc .lrace:hover{border-color:var(--accent);transform:translateX(2px)}
.rc .lrace.next{border-color:var(--car);background:var(--sel-bg-soft)}
.rc .lrace .lrtrack{width:54px;height:34px;object-fit:contain;opacity:.85;flex:0 0 auto}
.rc .lrace .lrinfo{display:flex;flex-direction:column;flex:1;min-width:0;gap:1px}
.rc .lrace .lrinfo b{font-size:13px;color:var(--txt);overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
.rc .lrace .lrmeta{font-size:11px;color:var(--dim);overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
.rc .lrace .lrdate{font-size:10.5px;color:var(--accent);letter-spacing:.03em}
.rc .tmroom .rmeta{display:block;font-size:10.5px;color:var(--dim);font-weight:400}
.rc .lroom{display:flex;align-items:center;gap:9px;width:100%;padding:10px 12px;margin-bottom:6px;
  border:1px solid var(--line);border-radius:10px;background:var(--panel2);cursor:pointer;
  transition:border-color .15s,transform .12s}
.rc .lroom:hover{border-color:var(--accent);transform:translateX(2px)}
.rc .lroom .rcode{font-weight:700;color:var(--accent);letter-spacing:.08em;font-size:13px}
.rc .lroom .rlabel{flex:1;font-size:12px;color:var(--txt);overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;text-align:left}
.rc .lroom .rrole{font-size:9px;text-transform:uppercase;letter-spacing:.05em;padding:2px 7px;
  border-radius:5px;border:1px solid var(--line);color:var(--dim)}
.rc .lroom .rrole.ed{color:var(--green);border-color:rgba(46,204,113,.4)}
.rc .lroom .rgo{color:var(--dim);font-size:15px}
.rc .tmtabs{display:flex;gap:6px;padding:10px 14px 0;flex-wrap:wrap}
.rc .tmtabs button{padding:5px 12px;border:1px solid var(--line);border-radius:8px;
  background:var(--panel2);color:var(--dim);cursor:pointer;font-size:12px}
.rc .tmtabs button.on{border-color:var(--car);color:#FFD9E0;background:var(--sel-bg)}
.rc .tmsec{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--car);
  font-weight:700;margin:6px 0 7px}
/* §1 — Ana Menü kompakt dashboard (v1.5.0) */
.rc .mmcap{font-family:var(--font-disp);text-transform:uppercase;letter-spacing:.1em;
  font-size:11px;color:var(--muted);margin:8px 0 8px;text-align:left}
.rc .mmteams{display:flex;gap:8px;overflow-x:auto;padding:2px 0 10px;scrollbar-width:thin;
  text-align:left}
.rc .mmtm{flex:none;display:flex;align-items:center;gap:8px;background:var(--panel2);
  border:1px solid var(--line);border-radius:10px;padding:7px 14px 7px 8px;cursor:pointer;
  min-width:140px;color:var(--txt)}
.rc .mmtm.on{border-color:var(--accent);background:var(--sel-bg-soft)}
.rc .mmtm .mmtlg{width:26px;height:26px;border-radius:7px;background:var(--panel);
  border:1px solid var(--line2);display:grid;place-items:center;font-size:14px;flex:none}
.rc .mmtm .mmtnm{font-family:var(--font-disp);font-weight:600;font-size:14px;white-space:nowrap}
.rc .mmtm.add{min-width:0;color:var(--dim)}
.rc .mmquick{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:6px 0 4px;
  text-align:left}
@media(max-width:560px){.rc .mmquick{grid-template-columns:repeat(2,1fr)}}
.rc .mmqa{display:flex;flex-direction:column;gap:3px;align-items:flex-start;
  background:var(--panel2);border:1px solid var(--line);border-radius:11px;padding:11px 13px;
  cursor:pointer;color:var(--txt)}
.rc .mmqa:hover{border-color:var(--line2)}
.rc .mmqa .mmqi{font-size:19px}
.rc .mmqa .mmql{font-family:var(--font-disp);font-weight:600;font-size:14px;
  display:inline-flex;align-items:center;gap:6px}
.rc .mmqa .mmqs{font-size:10.5px;color:var(--muted)}
.rc .mmbadge{background:var(--brand2);color:#fff;border-radius:9px;font-size:10px;padding:0 6px;
  font-weight:600;font-family:var(--font-ui)}
.rc .mmchips{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 4px}
.rc .mmchip{background:var(--panel2);border:1px solid var(--line);color:var(--dim);
  border-radius:20px;font-size:11.5px;padding:4px 11px;cursor:pointer}
.rc .mmchip.on{border-color:var(--accent);color:var(--accent)}
.rc .mmraces{text-align:left}
.rc .mmsec{font-family:var(--font-disp);text-transform:uppercase;letter-spacing:.05em;
  font-size:14px;color:var(--txt);margin:18px 0 9px;display:flex;align-items:center;gap:8px}
.rc .mmsec.sub{font-size:12px;color:var(--muted);margin:14px 0 8px}
.rc .mmnext{display:flex;align-items:center;gap:14px;width:100%;text-align:left;
  border:1px solid var(--brand2);border-radius:13px;padding:14px;cursor:pointer;color:var(--txt);
  background:radial-gradient(120% 160% at 100% 0,var(--sel-bg),var(--panel2) 60%)}
.rc .mmnext:hover{border-color:var(--accent)}
.rc .mmnext .mmntrk{height:52px;border-radius:9px;background:var(--panel);
  border:1px solid var(--line2);display:flex;align-items:center;justify-content:center;
  gap:8px;padding:0 10px;font-size:26px;flex:none}
.rc .mmnext .mmntrk .mmnflag{width:30px;height:20px;object-fit:cover;border-radius:3px;
  border:1px solid var(--line);flex:0 0 auto}
.rc .mmnext .mmntrk .mmntrkimg{width:58px;height:40px;object-fit:contain;flex:0 0 auto}
.rc .mmnext .mmninfo{display:flex;flex-direction:column;min-width:0;flex:1;gap:2px}
.rc .mmnext .mmnrnd{font-size:11px;color:var(--accent);font-weight:600;letter-spacing:.04em}
.rc .mmnext .mmnttl{font-family:var(--font-disp);font-weight:700;font-size:20px;line-height:1.05;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rc .mmnext .mmnmt{font-size:12px;color:var(--dim);overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
.rc .mmnext .mmncd{margin-left:auto;text-align:right;flex:none;display:flex;
  flex-direction:column;align-items:flex-end;gap:6px}
.rc .mmnext .mmncdd{font-family:var(--font-mono);font-weight:600;font-size:13px}
.rc .mmnext .mmngo{background:var(--car);color:#fff;border-radius:8px;padding:6px 14px;
  font-family:var(--font-disp);font-weight:600;font-size:13px;white-space:nowrap}
/* sıradaki yarış hero + owner/editor sil düğmesi (tam boy sağ sütun, kardeş) */
.rc .mmnextwrap{display:flex;align-items:stretch;gap:8px}
.rc .mmnextwrap .mmnext{flex:1;min-width:0}
.rc .mmdel{flex:0 0 auto;width:46px;border-radius:13px;background:var(--panel);
  border:1px solid var(--line2);color:var(--dim);font-size:17px;cursor:pointer;
  display:flex;align-items:center;justify-content:center}
.rc .mmdel:hover{border-color:#ff4d5e;color:#ff4d5e;background:var(--panel2)}
.rc .mmpasthd{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.rc .mmpasthd .mmsec{margin:18px 0 9px}
.rc .mmsrch{margin-left:auto;background:var(--panel2);border:1px solid var(--line);
  border-radius:8px;color:var(--txt);font-size:12.5px;padding:6px 10px;width:200px;max-width:44vw}
.rc .mmsrch::placeholder{color:var(--muted)}
.rc .mmmore{margin:12px auto 0;display:block;background:var(--panel2);border:1px solid var(--line);
  color:var(--dim);border-radius:8px;padding:8px 18px;font-size:12.5px;cursor:pointer}
.rc .mmmore:hover{border-color:var(--line2);color:var(--txt)}
.rc .tmroom{display:flex;align-items:center;gap:9px;padding:7px 9px;border-radius:8px;
  background:rgba(255,255,255,.03);margin-bottom:5px}
.rc .tmroom .rcode{font-weight:700;color:var(--accent);letter-spacing:.08em}
.rc .tmroom .rlabel{flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rc .tmroom .rpin{font-size:11px;color:var(--yellow)}
.rc .tmroom .rpin.dim{color:var(--dim)}
.rc .tmroom .ubtn{padding:4px 12px;font-size:11px}
.rc .tmadd{display:flex;gap:6px;margin-top:8px;align-items:center}
.rc .tmadd input{margin:0}
.rc .tmmem{display:flex;align-items:center;gap:9px;padding:5px 9px;font-size:12px}
.rc .tmmem .mbadges{display:inline-flex;gap:3px;flex:0 0 auto}
.rc .btgl{width:26px;height:24px;padding:0;border:1px solid var(--line);border-radius:6px;
  background:var(--panel2);color:var(--dim);cursor:pointer;font-size:12px;line-height:1;
  opacity:.5;transition:opacity .15s}
.rc .btgl.on{opacity:1}
.rc .btgl:hover{opacity:1}
.rc .tmmem .mrole{font-size:10px;text-transform:uppercase;letter-spacing:.05em;padding:2px 8px;
  border-radius:6px;border:1px solid var(--line);color:var(--dim)}
.rc .tmmem .muid{color:var(--muted);font-size:11px}
.rc .tmfoot{display:flex;gap:6px;padding:10px 14px;border-top:1px solid var(--line);
  align-items:center;flex-wrap:wrap}
.rc .tmfoot input{margin:0;flex:1;min-width:120px}
/* v1.6 — Team Management: mantıksal kart bölümleri + hizalı üye satırları */
.rc .tmbody{padding:12px 14px 14px}
.rc .tmcard{background:var(--panel2);border:1px solid var(--line);border-radius:12px;
  padding:12px 14px;margin:0 0 12px}
.rc .tmcard:last-child{margin-bottom:0}
.rc .tmcard-h{font-family:var(--font-disp);text-transform:uppercase;letter-spacing:.06em;
  font-size:12px;font-weight:700;color:var(--accent);margin:0 0 10px;
  display:flex;align-items:center;gap:8px}
.rc .tmid{display:flex;align-items:center;gap:10px}
.rc .tmid-name{font-family:var(--font-disp);font-size:17px;font-weight:700}
.rc .tmlegend{display:flex;flex-direction:column;gap:3px;margin:0 0 10px;
  font-size:11px;color:var(--muted);line-height:1.5}
.rc .tmmembers{display:flex;flex-direction:column;gap:2px}
.rc .tmmem2{display:grid;grid-template-columns:auto auto minmax(0,1fr) auto;align-items:center;
  gap:10px;padding:7px 9px;border-radius:9px}
/* v1.7.0 — avatar baş harf rozeti + görsel yükleme kutuları */
.rc .avfb{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;
  border:1px solid;font-weight:700;flex:0 0 auto;line-height:1;user-select:none}
.rc .astgrid{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}
.rc .astbox{display:flex;flex-direction:column;gap:6px}
.rc .astcap{font-size:10.5px;color:var(--dim);text-transform:uppercase;letter-spacing:.05em}
.rc .astprev{border:1px dashed var(--line);border-radius:8px;background:var(--panel);
  display:flex;align-items:center;justify-content:center;overflow:hidden;max-width:100%}
.rc .astprev img{max-width:100%;max-height:100%;object-fit:contain;display:block}
.rc .astact{display:flex;gap:6px}
.rc .mmtm .mmtlg img{width:100%;height:100%;object-fit:contain;border-radius:6px;display:block}
.rc .hdteamlogo{width:16px;height:16px;object-fit:contain;border-radius:4px}
.rc .tmmembers .tmmem2:nth-child(odd){background:rgba(255,255,255,.03)}
.rc .tmm-badges{display:inline-flex;gap:4px;flex:0 0 auto}
.rc .tmm-name{display:flex;align-items:center;gap:9px;min-width:0}
.rc .tmm-name b{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rc .tmm-role{flex:0 0 auto;font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;
  padding:2px 8px;border-radius:6px;border:1px solid var(--line);color:var(--dim);white-space:nowrap}
.rc .tmm-act{display:inline-flex;gap:5px;flex:0 0 auto}
.rc .tmcode{display:inline-flex;align-items:center;gap:12px;background:var(--panel);
  border:1px solid var(--line2);border-radius:9px;padding:7px 14px;margin:0 0 8px}
.rc .tmcode-k{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.rc .tmcode-v{font-family:var(--font-disp);font-weight:700;letter-spacing:.16em;font-size:17px;color:var(--txt)}
/* v1.6 — Create & Join: sade kur/katıl ekranı */
.rc .cjsec{margin:0 0 16px}
.rc .cjsec:last-child{margin-bottom:0}
.rc .cjsec-h{font-family:var(--font-disp);text-transform:uppercase;letter-spacing:.06em;
  font-size:12px;font-weight:700;color:var(--accent);margin:0 0 8px;display:flex;align-items:center;gap:7px}
.rc .cjrow{display:flex;gap:8px;align-items:center}
.rc .cjrow input{margin:0;flex:1;min-width:0}
.rc .cjrow .ubtn{flex:0 0 auto;white-space:nowrap}
@media(max-width:440px){.rc .cjrow{flex-wrap:wrap}.rc .cjrow .ubtn{width:100%}}
.rc .urow{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px}
.rc .urow:nth-child(odd){background:rgba(255,255,255,.03)}
.rc .urow img,.rc .urow .uav{width:32px;height:32px;border-radius:50%;object-fit:cover;flex:0 0 auto;
  background:var(--panel2);display:flex;align-items:center;justify-content:center;color:var(--dim)}
.rc .urow .uinfo{display:flex;flex-direction:column;min-width:0;flex:1}
.rc .urow .uinfo b{font-size:13px}
.rc .urow .umail{font-size:11px;color:var(--dim);overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
.rc .urow .unote{font-size:11px;color:var(--muted);font-style:italic}
.rc .urow .ustat{font-size:10px;text-transform:uppercase;letter-spacing:.05em;padding:2px 8px;
  border-radius:6px;border:1px solid var(--line);color:var(--dim);white-space:nowrap}
.rc .urow .ustat.ok{color:var(--green);border-color:rgba(46,204,113,.4)}
.rc .urow .ustat.wait{color:var(--yellow);border-color:rgba(242,201,76,.4)}
.rc .urow .ubtn{padding:5px 14px;font-size:12px;background:var(--green);color:#04240F;border:none}
.rc .userchip{display:inline-flex;align-items:center;gap:7px;align-self:center;
  background:var(--panel2);border:1px solid var(--line);border-radius:20px;padding:3px 5px 3px 3px}
.rc .userchip img{width:24px;height:24px;border-radius:50%;object-fit:cover}
.rc .ubadge{font-size:12px;line-height:1;padding:3px 6px;border-radius:6px;border:1px solid}
.rc .bchip{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;
  padding:5px 12px;border-radius:8px;border:1px solid;margin-bottom:14px;letter-spacing:.03em}
.rc .bsel{width:auto;min-width:130px;font-size:11px;padding:3px 6px;margin:0}
.rc .userchip .unamebtn{background:none;border:none;color:var(--txt);font-size:12px;cursor:pointer;
  max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:2px 2px}
.rc .userchip .unamebtn:hover{color:var(--accent);text-decoration:underline}
.rc .userchip .uname{font-size:12px;color:var(--txt);max-width:150px;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.rc .userchip button{background:none;border:none;color:var(--dim);cursor:pointer;
  font-size:13px;padding:2px 6px;border-radius:6px}
.rc .userchip button:hover{color:var(--car);background:rgba(150,0,24,.15)}
.rc .lapcell{display:inline-flex;align-items:center;gap:4px}
.rc .lapcell b{min-width:20px;text-align:center;font-variant-numeric:tabular-nums}
.rc .lapcell b.lapman{color:var(--accent)}
.rc .lapstep{width:18px;height:18px;padding:0;border:1px solid var(--line);border-radius:5px;
  background:var(--panel2);color:var(--txt);cursor:pointer;font-size:12px;line-height:1}
.rc .lapstep:hover:not(:disabled){border-color:var(--accent);color:var(--accent)}
.rc .lapstep:disabled{opacity:.3;cursor:not-allowed}
.rc .lapclr{width:16px;height:16px;padding:0;border:none;border-radius:4px;
  background:transparent;color:var(--dim);cursor:pointer;font-size:11px}
.rc .lapclr:hover{color:var(--car)}
/* Canlı timing satır flash: MOR = sınıf rekoru, YEŞİL = kişisel rekor (timing-tower
   konvansiyonu). Renkli zeminden şeffafa 1.5 sn'de söner; td'lere uygulanır (tr bg
   animasyonu bazı tarayıcılarda güvenilmez). */
/* Rengi ~3.5 sn tam tut, son ~1.5 sn'de sön → toplam 5 sn belirgin vurgu. */
@keyframes rowflashpurple{0%,70%{background:rgba(181,139,255,.60)}100%{background:transparent}}
@keyframes rowflashgreen{0%,70%{background:rgba(55,214,122,.55)}100%{background:transparent}}
.rc tr.flashpurple>td{animation:rowflashpurple 5s ease-out}
.rc tr.flashgreen>td{animation:rowflashgreen 5s ease-out}
@media (prefers-reduced-motion:reduce){
  .rc tr.flashpurple>td,.rc tr.flashgreen>td{animation-duration:.01ms}}
.rc .wxmodal{position:fixed;inset:0;z-index:1000;background:rgba(10,6,10,.72);
  backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;
  padding:20px;animation:lbfade .18s ease}
.rc .wxmbox{background:var(--panel);border:1px solid var(--line);border-radius:14px;
  width:min(440px,94vw);max-height:80vh;display:flex;flex-direction:column;overflow:hidden;
  animation:lbzoom .26s cubic-bezier(.2,.85,.3,1.12)}
.rc .wxmhead{display:flex;align-items:center;justify-content:space-between;
  padding:12px 16px;border-bottom:1px solid var(--line);font-family:var(--font-disp);
  font-size:18px;letter-spacing:.04em;text-transform:uppercase}
/* tur listesi penceresi: pilot sütunu için biraz geniş */
.rc .wxmbox.laps{width:min(520px,94vw)}
/* pist haritası penceresi: kare harita için geniş varyant (⛶ Büyüt) */
.rc .wxmbox.map{width:auto;max-width:96vw;max-height:94vh}
.rc .wxmbox.map .mapwrap{display:flex;justify-content:center;padding:10px;position:relative}
/* Yalnız DOĞRUDAN çocuk harita svg'sini büyüt — üstteki durum rozetindeki (.mapcond)
   WetIcon svg'sini de kapsamasın (yoksa ıslaklık ikonu kocaman görünürdü). */
.rc .wxmbox.map .mapwrap > svg{width:min(88vw,78vh);height:auto}
/* harita durum rozeti — bayrak/hava/sıcaklık, harita köşesinde (v1.4.95) */
.rc .mapcond{position:absolute;top:6px;left:6px;z-index:2;display:flex;flex-direction:column;
  gap:3px;align-items:flex-start;pointer-events:none}
.rc .mapcond span{display:inline-flex;align-items:center;gap:4px;padding:2px 7px;
  border-radius:6px;font-size:11px;font-weight:600;background:rgba(11,7,8,.72);
  border:1px solid var(--line);line-height:1.3}
.rc .mapcond .mapcond-flag{color:#F2C037;border-color:rgba(242,192,55,.5)}
.rc .mapcond .mapcond-wx{color:#7cc3f0}
.rc .mapcond .mapcond-temp{color:var(--dim)}
/* Büyük Pano zenginleştirme (v1.4.96): lejant + strateji şeridi */
.rc .maplegend{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;
  padding:6px 10px 2px;font-size:12px;color:var(--dim)}
.rc .maplegend span{display:inline-flex;align-items:center;gap:5px}
.rc .maplegend i{width:11px;height:11px;border-radius:3px;display:inline-block;flex:0 0 auto}
.rc .wxmbox.map .mapbig-strat{padding:2px 10px 0}
.rc .wxmlist{overflow:auto;padding:8px}
/* Setup içeriği penceresi — özet çipleri + bölüm/alan listesi */
.rc .setupsum{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}
.rc .setupchip{font-family:var(--font-ui);font-variant-numeric:tabular-nums;font-size:11.5px;padding:4px 8px;border-radius:7px;
  background:rgba(150,0,24,.12);border:1px solid rgba(210,67,87,.35);color:var(--txt)}
.rc .setupchip b{color:var(--accent);font-weight:600;margin-right:4px}
.rc .setupsec{margin:0 0 10px}
.rc .setupsec-h{font-family:var(--font-disp);text-transform:uppercase;letter-spacing:.05em;
  font-size:12px;color:var(--dim);border-bottom:1px solid var(--line);padding:0 2px 3px;margin-bottom:4px}
.rc .setuprow{display:flex;justify-content:space-between;gap:12px;padding:3px 4px;font-size:12px}
.rc .setuprow:nth-child(even){background:rgba(255,255,255,.03)}
.rc .setuprow-k{color:var(--muted)}
.rc .setuprow-v{font-family:var(--font-ui);font-variant-numeric:tabular-nums;color:var(--txt);text-align:right}
/* v1.6 — Setup penceresi: daktilo (Roboto Mono) yerine gövde fontu + hizalı rakamlar */
.rc .setupmono{font-family:var(--font-ui);font-variant-numeric:tabular-nums}
/* §9 Setup İçeriği kategori düzeni — araç toolbar (Anlamlı/Tümü + ara) + iki-kolon kategori */
.rc .setuptools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:2px 0 12px}
.rc .setuptools .seg{display:inline-flex;background:var(--panel2);border:1px solid var(--line);
  border-radius:8px;overflow:hidden}
.rc .setuptools .seg button{border:0;background:transparent;color:var(--dim);
  font-family:var(--font-ui);font-size:12px;padding:6px 12px;cursor:pointer}
.rc .setuptools .seg button[aria-pressed=true]{background:var(--car);color:#fff}
.rc .setupsearch{margin-left:auto;background:var(--panel2);border:1px solid var(--line);
  border-radius:8px;color:var(--txt);font-family:var(--font-ui);font-size:12px;
  padding:6px 10px;width:200px;max-width:44vw}
.rc .setupsearch::placeholder{color:var(--muted)}
.rc .setupcats{column-count:2;column-gap:24px}
@media(max-width:600px){.rc .setupcats{column-count:1}}
/* Seans Setup kutusu (v1.5.2) — .duckdb telemetriye gömülü kurulum */
.rc .sessetup{border-color:var(--brand2);
  background:linear-gradient(180deg,var(--sel-bg-soft),var(--panel) 55%)}
.rc .sessetup h2 .n{margin-left:8px;font-family:var(--font-ui);font-size:11px;
  font-weight:400;color:var(--muted);text-transform:none;letter-spacing:0}
.rc .newtag{background:var(--brand2);color:#fff;border-radius:20px;font-family:var(--font-disp);
  font-weight:600;font-size:10px;padding:2px 9px;letter-spacing:.05em;vertical-align:middle}
.rc .setupcat{break-inside:avoid;margin:0 0 16px}
.rc .setupcat-h{display:flex;align-items:center;gap:8px;margin:0 0 5px;
  font-family:var(--font-disp);text-transform:uppercase;letter-spacing:.06em;font-size:13px;
  color:var(--txt);border-bottom:1px solid var(--line);padding-bottom:4px}
.rc .setupcat-h .ic{color:var(--accent);font-size:13px}
.rc .setupcat-h .n{margin-left:auto;font-family:var(--font-ui);font-weight:500;font-size:10.5px;
  color:var(--muted)}
.rc .setupcat .setuprow{padding:3px 2px}
.rc .setupcat .setuprow:not(:last-child){border-bottom:1px solid rgba(255,255,255,.04)}
.rc .setuprow-v.axle{display:inline-flex;gap:10px}
.rc .setuprow-v.axle span{min-width:56px;text-align:right}
.rc .setuprow-v.axle b{display:block;color:var(--muted);font-weight:500;font-size:9.5px;
  letter-spacing:.08em;text-transform:uppercase;margin-bottom:-2px}
/* §6 Pilotlar — baş-harf rozeti + pilot kartları + stint programı */
.rc .drvav{display:inline-grid;place-items:center;border-radius:50%;flex:none;
  font-family:var(--font-disp);font-weight:700;color:#0B0708;line-height:1;vertical-align:middle}
.rc .drvcap{font-family:var(--font-disp);text-transform:uppercase;letter-spacing:.1em;
  font-size:11px;color:var(--muted);margin:18px 0 8px}
.rc .drivers{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
.rc .drv{background:linear-gradient(180deg,var(--panel2),var(--panel));border:1px solid var(--line);
  border-left:3px solid var(--c);border-radius:12px;padding:13px 14px}
.rc .drvtop{display:flex;align-items:center;gap:11px}
.rc .drvwho{min-width:0}
.rc .drvnm{font-family:var(--font-disp);font-weight:700;font-size:18px;line-height:1.05;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rc .drvteam{font-size:11px;color:var(--muted);margin-top:1px}
.rc .drvbig{margin-left:auto;text-align:right;flex:none}
.rc .drvbig .v{font-family:var(--font-disp);font-weight:700;font-size:20px;color:var(--c);
  font-variant-numeric:tabular-nums;letter-spacing:.01em}
.rc .drvbig .l{font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.rc .drvbar{height:6px;border-radius:4px;background:var(--panel3);margin:12px 0 7px;overflow:hidden}
.rc .drvbar i{display:block;height:100%;background:var(--c);border-radius:4px}
.rc .drvmeta{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dim)}
.rc .drvmeta .pct{margin-left:auto;font-family:var(--font-disp);font-weight:700;color:var(--txt);
  font-variant-numeric:tabular-nums}
.rc .drvstints{display:flex;gap:4px;flex-wrap:wrap;margin-top:9px}
.rc .drvstints .st{font-family:var(--font-disp);font-weight:600;font-size:11px;background:var(--panel3);
  border:1px solid var(--line2);border-radius:5px;padding:1px 6px;color:var(--dim);
  font-variant-numeric:tabular-nums}
.rc .drvsched{border:1px solid var(--line);border-radius:10px;overflow:hidden}
.rc .drvsched .srow{display:grid;grid-template-columns:34px 1fr auto;align-items:center;gap:10px;
  padding:7px 12px;font-size:13px}
.rc .drvsched .srow:not(:last-child){border-bottom:1px solid var(--line)}
.rc .drvsched .srow:nth-child(even){background:rgba(255,255,255,.02)}
.rc .drvsched .sno{font-family:var(--font-disp);font-weight:700;font-size:15px;color:var(--muted)}
.rc .drvsched .swin{color:var(--dim);font-size:12px;font-variant-numeric:tabular-nums}
.rc .drvsched .swin b{color:var(--txt);font-weight:600}
.rc .drvsched .sasg{display:inline-flex;align-items:center;gap:7px}
.rc .drvsched .sasg select{background:var(--panel2);border:1px solid var(--line);border-radius:7px;
  color:var(--txt);font-family:var(--font-ui);font-size:12.5px;padding:5px 8px}
.rc .drvlegend{flex:1 1 300px;display:flex;flex-direction:column;gap:2px}
.rc .drvlegend .lrow{display:flex;align-items:center;gap:8px;padding:4px 2px;font-size:13px;
  border-bottom:1px solid rgba(255,255,255,.04)}
.rc .drvlegend .dot{width:12px;height:12px;border-radius:3px;flex:none}
.rc .drvlegend .ln{font-weight:500}
.rc .drvlegend .ls{margin-left:auto;color:var(--dim);font-size:12px;font-variant-numeric:tabular-nums}
.rc .drvlegend .lp{font-family:var(--font-disp);font-weight:700;color:var(--txt);min-width:46px;
  text-align:right;font-variant-numeric:tabular-nums}
/* ⚖ setup karşılaştırma penceresi + alt-sabit seçim çubuğu */
.rc .cmphead{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;
  margin:0 0 6px}
.rc .cmpside{display:flex;flex-direction:column;gap:2px;min-width:0}
.rc .cmpvs{color:var(--accent);font-weight:600;white-space:nowrap}
.rc .cmprow{display:grid;grid-template-columns:1.25fr 1fr 1fr;gap:8px;padding:3px 4px;
  font-size:12px;align-items:baseline}
.rc .cmprow:nth-child(even){background:rgba(255,255,255,.03)}
.rc .cmprow .cmpv{text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rc .cmprow.diffhl{background:rgba(210,67,87,.10)}
.rc .cmprow.diffhl .cmpv{color:var(--accent);font-weight:600}
.rc .cmpbar{position:fixed;left:50%;transform:translateX(-50%);bottom:14px;z-index:1150;
  display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:10px;
  background:var(--panel);border:1px solid var(--accent);box-shadow:0 8px 30px rgba(0,0,0,.45);
  animation:lbzoom .18s ease}
.rc .cmpbar .act[disabled]{opacity:.45;cursor:default}
.rc .fastlap{color:var(--green);font-weight:700}
.rc .lapdelta{color:var(--muted);font-size:11px;font-weight:400}
/* setup kart görünümü — tabloyla aynı satırlar/handler'lar, göz gezdirme için */
.rc .sucards{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
.rc .sucard{background:var(--panel2);border:1px solid var(--line);border-radius:10px;
  padding:9px 10px;display:flex;flex-direction:column;gap:6px;min-width:0}
.rc .sucard.here{border-color:rgba(150,0,24,.55);background:rgba(150,0,24,.08)}
.rc .sucard-img{margin:-9px -10px 0;border-radius:10px 10px 0 0;overflow:hidden;
  max-height:84px;background:rgba(255,255,255,.03)}
.rc .sucard-img img{width:100%;height:84px;object-fit:cover;display:block;opacity:.9}
.rc .sucard-row{display:flex;align-items:center;gap:6px;min-width:0}
.rc .sucard-row b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rc .sucard-row img.fl{width:18px;border-radius:2px;flex:0 0 auto}
.rc .sucard-row img.cb{height:15px;flex:0 0 auto}
.rc .sucard-row img.br{height:15px;width:auto;flex:0 0 auto}
.rc .sucard-row .nm{font-size:12px;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
.rc .sucard-lap{font-size:15px}
.rc .sucard-file{font-size:11px;color:var(--dim);overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
.rc .sucard-foot{display:flex;align-items:center;gap:6px;margin-top:auto;
  padding-top:6px;border-top:1px solid var(--line)}
/* setup sürükle-bırak bölgesi — .svm dosyası buraya bırakılınca form kendiliğinden dolar */
.rc .sudrop{border:1.5px dashed var(--line);border-radius:8px;padding:8px 10px;
  display:flex;flex-direction:column;gap:5px;transition:border-color .15s,background .15s}
.rc .sudrop.on{border-color:var(--accent);background:rgba(210,67,87,.08)}
/* Setup formu — sabit row2/row4 yerine responsive grid (dar ekranda sarar, kırpılmaz).
   generic .row2/.row4 (Drivers/Fuel'de kullanılıyor) korunur; bunlar Setup'a özel. */
.rc .suform{max-width:960px}
.rc .suform-2{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:start}
.rc .suform-4{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:9px;align-items:start}
@media(max-width:560px){.rc .suform-2{grid-template-columns:1fr}}
/* Setup havuzu araç çubuğu — filtre grubu | aksiyon grubu; eşit kontrol yüksekliği. */
.rc .toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;
  background:var(--panel2);border:1px solid var(--line);border-radius:9px;padding:9px 11px;margin-bottom:10px}
.rc .toolbar .tb-group{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.rc .toolbar select,.rc .toolbar input[type=text],.rc .toolbar .act{height:32px;font-size:12px}
.rc .toolbar input[type=text]{width:auto}
.rc .toolbar .tb-sep{width:1px;align-self:stretch;background:var(--line);margin:0 1px}
.rc .wxrow{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:8px}
.rc .wxrow:nth-child(odd){background:rgba(255,255,255,.03)}
.rc .wxrow .wxdot{width:11px;height:11px;border-radius:3px;flex:0 0 auto}
.rc .wxrow .wxnm{font-weight:600;min-width:96px}
.rc .wxrow .wxml{color:var(--dim);font-size:12px}
.rc .wxrow .wxat{margin-left:auto;color:var(--muted);font-size:12px}
/* v1.8.15 — tur geçmişi (LapsModal) satırı: TEK SATIR kompakt (dikey padding 8→3,
   satırlar arası küçük boşluk, dar ekranda doğal sar). .wxrow geneli DEĞİŞMEZ. */
.rc .wxrow.laprow{padding:6px 10px;gap:8px;row-gap:3px;flex-wrap:wrap}
.rc .wxmfoot{padding:10px 16px;border-top:1px solid var(--line);display:flex;
  justify-content:flex-end}
.rc .wxsrc{font-size:9px;text-transform:uppercase;letter-spacing:.06em;padding:1px 6px;
  border-radius:5px;border:1px solid}
.rc .wxsrc.live{color:var(--accent);border-color:rgba(210,67,87,.42);background:rgba(210,67,87,.12)}
.rc .wxsrc.plan{color:#c9a227;border-color:rgba(201,162,39,.4);background:rgba(201,162,39,.1)}
.rc .wxrow .wxat{margin-left:auto}
.rc .wxmplan{padding:10px 16px;border-top:1px solid var(--line)}
.rc .wxmptitle{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--dim);
  margin-bottom:7px}
.rc .wxmprow{display:flex;gap:6px;align-items:center}
.rc .wxmprow select{flex:1}
.rc .wxmprow input{width:90px;text-align:center}
.rc .wxmquick{display:flex;gap:6px;margin-top:7px}
.rc .wxbar{position:relative;display:flex;height:16px;margin-top:4px;border-radius:6px;
  overflow:hidden;border:1px solid var(--line)}
.rc .wxbar .wseg{position:relative;min-width:2px;display:flex;align-items:center;
  justify-content:center;font-size:9px;transition:width .4s ease}
.rc .wxbar .wseg span{opacity:.85;filter:drop-shadow(0 0 1px rgba(0,0,0,.5))}
.rc .wxbar .wseg.rain::after{content:"";position:absolute;inset:0;
  background:repeating-linear-gradient(115deg,rgba(255,255,255,.22) 0 2px,
    transparent 2px 9px);background-size:200% 100%;animation:wxrain 1.1s linear infinite}
@keyframes wxrain{from{background-position:0 0}to{background-position:-36px 0}}
.rc .classtoggle button{flex:1;display:flex;align-items:center;justify-content:center;
  gap:8px;padding:10px;border-radius:8px;border:1px solid var(--line);
  background:var(--panel2);color:var(--dim);cursor:pointer;
  font-family:var(--font-disp);font-size:16px;font-weight:600;letter-spacing:.05em}
.rc .classtoggle button img{width:26px;height:auto}
.rc .classtoggle button.on{border-color:var(--accent);background:var(--sel-bg);
  color:var(--accent)}
.rc .cargrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
.rc .cargrid button{padding:10px 10px 8px;border-radius:10px;border:1px solid var(--line);
  background:var(--panel2);cursor:pointer;color:var(--dim);font-size:11.5px}
.rc .cargrid button img{width:100%;height:auto;margin-bottom:6px;
  filter:drop-shadow(0 4px 8px rgba(0,0,0,.45))}
.rc .cargrid button.on{border-color:var(--accent);background:var(--sel-bg);
  color:var(--txt);font-weight:600}
.rc .lteam{display:flex;align-items:center;gap:6px;font-size:14px;font-weight:700;
  color:var(--txt);padding:8px 10px;margin-bottom:10px;border-radius:8px;
  background:var(--panel2);border:1px solid var(--line)}
.rc .lseason{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;
  color:var(--dim);margin:10px 0 4px 2px;display:flex;align-items:center;gap:8px}
.rc .lseason::after{content:"";flex:1;height:1px;background:var(--line)}
.rc .floatstream{position:fixed;z-index:900;width:320px;background:var(--panel);
  border:1px solid var(--line);border-radius:10px;overflow:hidden;
  box-shadow:0 10px 34px rgba(0,0,0,.55)}
.rc .floatstream.br{right:16px;bottom:16px}
.rc .floatstream.bl{left:16px;bottom:16px}
.rc .floatstream.tr{right:16px;top:110px}
.rc .floatstream.tl{left:16px;top:110px}
.rc .floatstream .fshead{display:flex;align-items:center;gap:6px;
  padding:5px 8px;background:var(--panel2);border-bottom:1px solid var(--line)}
.rc .floatstream .fsgrip{cursor:nwse-resize;color:var(--dim);font-size:12px;
  padding:0 2px;user-select:none;touch-action:none}
.rc .floatstream .fsgrip:hover{color:var(--accent)}
.rc .floatstream .fsshield{position:absolute;inset:0;z-index:2}
.rc .floatstream .fstitle{font-size:10.5px;letter-spacing:.1em;color:var(--muted);
  font-family:var(--font-disp);margin-right:auto}
.rc .floatstream .fsbtns{display:flex;gap:2px;align-items:center}
.rc .floatstream .fsbtns button,.rc .floatstream .fsbtns a{background:none;border:0;
  color:var(--dim);cursor:pointer;font-size:11px;padding:1px 4px;line-height:1;
  text-decoration:none}
.rc .floatstream .fsbtns button:hover,.rc .floatstream .fsbtns a:hover{color:var(--accent)}
.rc .floatstream .fsbtns button.on{color:var(--red)}
.rc .floatstream .fsbody{aspect-ratio:16/9;background:#000;position:relative}
.rc .floatstream .fsbody iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.rc .floatstream.min{width:210px}
.rc .floatstream.min .fsbody{display:none}
.rc .tourbtn{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;
  border-radius:6px;border:1px solid var(--line);background:var(--panel2);
  color:var(--muted);font-size:11.5px;cursor:pointer;transition:.15s;
  align-self:center;white-space:nowrap}
.rc .tourbtn:hover{border-color:var(--accent);color:var(--accent)}
.rc .tourwrap{position:fixed;inset:0;z-index:3000}
.rc .tourdim{position:absolute;inset:0;background:rgba(8,4,8,.78)}
.rc .tourhole{position:absolute;border-radius:12px;
  box-shadow:0 0 0 9999px rgba(8,4,8,.78), 0 0 0 2px var(--red),
    0 0 22px rgba(150,0,24,.55);transition:all .28s ease;pointer-events:none}
.rc .tourcard{position:absolute;background:var(--panel);border:1px solid var(--red);
  border-radius:12px;padding:14px 16px;box-shadow:0 12px 40px rgba(0,0,0,.6);
  transition:all .28s ease}
.rc .tourcard h3{margin:0 0 6px;font-size:15px;color:var(--red);
  font-family:var(--font-disp);letter-spacing:.04em}
.rc .tourcard p{margin:0 0 12px;font-size:12.5px;line-height:1.55;color:var(--txt)}
.rc .tourstep{font-size:10px;color:var(--dim);letter-spacing:.14em;margin-bottom:4px}
/* ilerleme çubuğu — uzun turda nerede olduğun tek bakışta belli olsun */
.rc .tourbar{height:3px;border-radius:2px;background:rgba(255,255,255,.10);
  overflow:hidden;margin:0 0 8px}
.rc .tourbar i{display:block;height:100%;background:var(--red);
  transition:width .25s ease}
@media (prefers-reduced-motion:reduce){.rc .tourbar i{transition:none}}
.rc .tourbtns{display:flex;gap:8px;align-items:center}
.rc .chattabs{display:flex;gap:4px;padding:8px 12px 0;border-bottom:1px solid var(--line);
  overflow-x:auto}
.rc .ctab{position:relative;background:none;border:1px solid var(--line);border-bottom:0;
  border-radius:8px 8px 0 0;color:var(--dim);font-size:11.5px;padding:6px 12px;
  cursor:pointer;white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis}
.rc .ctab.on{color:var(--red);border-color:var(--red);background:var(--panel2)}
.rc .ctab .cdot{position:absolute;top:1px;right:2px;background:var(--red);color:#fff;
  border-radius:8px;font-size:9px;padding:0 4px;line-height:13px}
.rc .chatwrap{display:flex;flex-direction:column;height:min(62vh,460px)}
.rc .chatlist{flex:1;overflow-y:auto;padding:10px 14px;display:flex;
  flex-direction:column;gap:9px}
.rc .cmsg{max-width:78%;align-self:flex-start}
.rc .cmsg.me{align-self:flex-end}
.rc .cmsg .who{font-size:10.5px;color:var(--dim);margin:0 0 2px 2px;
  display:flex;gap:6px;align-items:center}
.rc .cmsg.me .who{justify-content:flex-end;margin:0 2px 2px 0}
.rc .cmsg .bub{background:var(--panel2);border:1px solid var(--line);
  border-radius:12px;padding:7px 11px;font-size:13px;line-height:1.45;
  white-space:pre-wrap;word-break:break-word}
.rc .cmsg.me .bub{background:rgba(150,0,24,.22);border-color:rgba(150,0,24,.55)}
.rc .cmsg .del{background:none;border:0;color:var(--dim);cursor:pointer;
  font-size:10px;padding:0 2px;opacity:0;transition:.15s}
.rc .cmsg:hover .del{opacity:1}
.rc .cmsg .del:hover{color:var(--red)}
.rc .chatbar{display:flex;gap:8px;padding:10px 14px;border-top:1px solid var(--line)}
.rc .chatbar input{flex:1;margin:0;text-transform:none;letter-spacing:0}
.rc .chatday{align-self:center;font-size:10px;color:var(--dim);
  border:1px solid var(--line);border-radius:10px;padding:1px 9px}
.rc .infobtn{position:relative;width:26px;height:26px;flex:0 0 26px;padding:0;
  border-radius:50%;border:1px solid var(--line);background:var(--panel2);
  color:var(--muted);font:700 14px/1 Georgia,serif;cursor:pointer;
  display:inline-flex;align-items:center;justify-content:center;transition:.15s}
.rc .infobtn:hover{border-color:var(--red);color:var(--red)}
.rc .infobtn .nd{position:absolute;top:-2px;right:-2px;width:8px;height:8px;
  border-radius:50%;background:var(--red);border:1px solid var(--panel)}
.rc .clgv{padding:12px 16px 4px;border-top:1px solid var(--line)}
.rc .clgv:first-child{border-top:0}
.rc .clgv h4{margin:0 0 2px;font-size:14px;letter-spacing:.04em}
.rc .clgv h4 .cur{margin-left:8px;font-size:10px;padding:1px 6px;border-radius:4px;
  border:1px solid var(--red);color:var(--red);letter-spacing:.08em;vertical-align:2px}
.rc .clgv .cdate{color:var(--dim);font-size:11px;margin-bottom:8px}
.rc .clgv ul{margin:0 0 10px;padding-left:18px}
.rc .clgv li{font-size:12.5px;line-height:1.55;color:var(--txt);margin-bottom:4px}
.rc .langsw{display:inline-flex;gap:4px;margin-left:auto;align-self:center}
.rc .langsw button{padding:3px 9px;border-radius:5px;border:1px solid var(--line);
  background:var(--panel2);color:var(--dim);font-size:11px;cursor:pointer;font-weight:600}
.rc .langsw button.on{border-color:var(--accent);color:var(--accent)}
.rc .hdsel{display:inline-flex;align-items:center;gap:7px;color:var(--dim);font-size:12px;align-self:center}
.rc .hdsel img.flag{width:18px;height:auto;border-radius:2px}
.rc .hdsel img.car{height:22px;width:auto}
/* viewer (yarışta): girişler pasif kalır — her tuş/seçimde toast spam'ı olmasın. */
.rc .viewonly input,.rc .viewonly select,.rc .viewonly textarea,
.rc .viewonly input[type=file],.rc .viewonly input[type=checkbox]{pointer-events:none;opacity:.55}
/* viewer: düzenleme DÜĞMELERİ soluk ama TIKLANABİLİR kalır → tık edit() muhafızına ulaşır
   ve "yetkiniz yok" kutucuğunu tetikler; salt-okunur .card .act eylemleri (+, ⛶) de erişilir. */
.rc .viewonly .strat button,.rc .viewonly .tyrebox button,
.rc .viewonly .pitopt button,.rc .viewonly .card .act{pointer-events:auto;opacity:.55}
.rc .viewonly .tabs button{pointer-events:auto;opacity:1}
/* Yetki reddi kutucuğu (DenyToast) — alt-orta, kırmızı kenar, kayarak belirir. */
.rc .denytoast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:1200;
  display:flex;align-items:center;gap:10px;max-width:min(520px,92vw);
  padding:12px 18px;border-radius:12px;background:var(--panel);border:1px solid var(--red);
  box-shadow:0 12px 34px rgba(150,0,24,.34),inset 0 0 0 1px rgba(255,77,94,.16);
  color:var(--txt);font-size:14px;font-weight:600;line-height:1.35;
  animation:dtin .28s cubic-bezier(.2,.85,.3,1.12)}
.rc .denytoast .dticon{font-size:18px;flex:0 0 auto}
@keyframes dtin{from{opacity:0;transform:translate(-50%,14px) scale(.96)}
  to{opacity:1;transform:translate(-50%,0) scale(1)}}
@media (prefers-reduced-motion:reduce){.rc .denytoast{animation:none}}
.rc textarea:focus{outline:2px solid var(--accent)}
.rc select{background:var(--panel2);border:1px solid var(--line);border-radius:6px;
  color:var(--txt);padding:5px 6px;font-family:var(--font-mono);font-size:12px}
/* Logolu açılır liste (ImgSelect) — native select görünümüyle uyumlu tetik + fixed popup */
.rc .imgsel-btn{display:flex;align-items:center;gap:6px;width:100%;
  background:var(--panel2);border:1px solid var(--line);border-radius:6px;
  color:var(--txt);padding:5px 6px;font-family:var(--font-mono);font-size:12px;
  cursor:pointer;text-align:left}
.rc .imgsel-btn.off{opacity:.5;cursor:not-allowed}
.rc .imgsel-btn:hover:not(.off){border-color:var(--muted)}
.rc .imgsel-cur{display:flex;align-items:center;gap:7px;min-width:0;flex:1}
.rc .imgsel-cur img{height:18px;width:auto;flex:0 0 auto}
.rc .imgsel-cur span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rc .imgsel-ph{flex:1;color:var(--muted)}
.rc .imgsel-car{color:var(--dim);flex:0 0 auto;font-size:10px}
.rc .imgsel-back{position:fixed;inset:0;z-index:1290}
.rc .imgsel-pop{position:fixed;z-index:1300;max-height:280px;overflow-y:auto;
  background:var(--panel);border:1px solid var(--line);border-radius:8px;
  box-shadow:0 12px 30px rgba(0,0,0,.5);padding:4px;min-width:150px}
.rc .imgsel-opt{display:flex;align-items:center;gap:8px;width:100%;
  background:transparent;border:0;border-radius:6px;color:var(--txt);
  padding:6px 8px;font-family:var(--font-mono);font-size:12px;cursor:pointer;text-align:left}
.rc .imgsel-opt img{height:20px;width:auto;flex:0 0 auto}
.rc .imgsel-opt:hover{background:rgba(255,255,255,.06)}
.rc .imgsel-opt.on{background:var(--sel-bg-soft);color:var(--txt)}
.rc .tin{width:56px!important;text-align:center}
.rc .drvsel{min-width:96px;max-width:120px;padding:4px 6px}
.rc .tsel{width:76px;text-align:center;background:transparent!important}
.rc td.tcarry .tsel{color:var(--dim);font-style:italic;opacity:.75}
.rc td.terr{background:rgba(240,96,77,.18);outline:2px solid var(--red);outline-offset:-2px}
.rc td.t2{background:rgba(242,201,76,.22)}
.rc td.tq{background:rgba(102,148,255,.25)}
.rc td.t3{background:rgba(232,132,42,.30)}
.rc td.t4{background:rgba(220,38,38,.42)}
.rc td.tw{background:rgba(127,227,160,.22)}
.rc td.t4 input{color:var(--red);border-color:var(--red)}
.rc .act{padding:6px 12px;border-radius:6px;border:1px solid var(--line);
  background:var(--panel2);color:var(--txt);cursor:pointer;font-size:12px}
.rc .act.danger{border-color:var(--red);color:var(--red)}
.rc .rchip{display:inline-flex;align-items:center;gap:6px;padding:3px 8px;
  border-radius:99px;border:1px solid var(--line);background:var(--panel2);
  margin:0 6px 6px 0;font-size:12px}
.rc .rchip b{cursor:pointer;color:var(--red)}
.rc .legend{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;font-size:11px;color:var(--dim)}
.rc .legend i{display:inline-block;width:12px;height:12px;border-radius:3px;
  margin-right:4px;vertical-align:-2px;border:1px solid var(--line)}
/* --- code 80 sarı efekt --- */
.rc .card.c80{border-color:rgba(242,201,76,.55);
  box-shadow:0 0 0 1px rgba(242,201,76,.18),0 0 26px rgba(242,201,76,.08)}
.rc .card.c80 h2{color:var(--yellow)}
.rc .card.c80 .kpi{border-color:rgba(242,201,76,.30)}
.rc .tabs button.on.c80t{border-color:var(--yellow);color:var(--yellow)}
/* --- canlı mod --- */
.rc .livestrip{display:flex;flex-wrap:wrap;align-items:center;gap:16px;
  padding:8px 20px;border-bottom:1px solid var(--line);background:#210B10}
.rc .livestrip .big{font-family:var(--font-disp);font-size:22px;font-weight:700}
.rc .livestrip .lbl{color:var(--dim);font-size:10px;text-transform:uppercase;
  letter-spacing:.07em;display:block}
@keyframes rcpulse{0%,100%{opacity:1}50%{opacity:.35}}
.rc .pulse{animation:rcpulse 1.1s ease-in-out infinite;color:var(--yellow)}
@media (prefers-reduced-motion: reduce){.rc .pulse{animation:none}}
.rc .timeline{position:relative}
.rc .nowline{position:absolute;top:-4px;bottom:-4px;width:2px;background:#fff;
  box-shadow:0 0 8px #fff;z-index:2}
.rc tr.live td{background:rgba(150,0,24,.16);border-left:3px solid var(--accent)}
.rc tr.pitsoon td{background:rgba(242,201,76,.12)}
/* --- canlı timing rozeti --- */
.rc .livebadge{display:inline-flex;align-items:center;gap:6px;font-size:11px;
  font-family:var(--font-mono);letter-spacing:.04em;padding:2px 9px;border-radius:99px;
  border:1px solid var(--line);text-transform:uppercase}
.rc .livebadge i{width:8px;height:8px;border-radius:50%;flex:0 0 auto}
.rc .livebadge.on{color:var(--green);border-color:rgba(55,214,122,.5)}
.rc .livebadge.on i{background:var(--green);box-shadow:0 0 8px var(--green);
  animation:rcpulse 1.2s ease-in-out infinite}
.rc .livebadge.lag{color:var(--yellow);border-color:rgba(245,178,61,.5)}
.rc .livebadge.lag i{background:var(--yellow)}
.rc .livebadge.off{color:var(--muted)}
.rc .livebadge.off i{background:var(--muted)}
/* --- büyük pano (pit duvarı / tam ekran) — uzaktan okunur --- */
.rc .bigboard{background:var(--bg);overflow:auto;padding:16px}
.rc .bigboard .card{margin-bottom:14px}
.rc .bigboard h2{font-size:22px}
.rc .bigboard table{font-size:19px}
.rc .bigboard td,.rc .bigboard th{padding:9px 12px}
.rc .bigboard .disp{font-size:22px}
.rc .bigboard .hint{display:none}
/* --- masaüstü (Tauri) güncelleme şeridi --- */
.rc .updatebar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;
  padding:8px 20px;background:linear-gradient(90deg,rgba(150,0,24,.35),rgba(150,0,24,.12));
  border-bottom:1px solid var(--line);color:var(--txt);font-size:12.5px}
.rc .updatebar .act{padding:5px 14px;font-size:12px}
/* --- HUD şeridi (canlı mod kokpit) --- */
.rc .hudstrip{display:flex;flex-wrap:wrap;align-items:center;gap:18px;
  padding:12px 20px;border-bottom:1px solid var(--line);
  background:radial-gradient(130% 180% at 100% 0,rgba(150,0,24,.22),#1E0A0E 62%)}
.rc .hudstrip .hcell{display:flex;flex-direction:column;justify-content:center;gap:2px;min-width:0}
.rc .hudstrip .lbl{color:var(--dim);font-size:10px;text-transform:uppercase;letter-spacing:.07em}
.rc .hudstrip .hclock{font-family:var(--font-disp);font-weight:700;font-variant-numeric:tabular-nums;
  font-size:clamp(30px,5vw,48px);line-height:.95;color:var(--green);
  text-shadow:0 0 20px rgba(55,214,122,.28)}
.rc .hudstrip .hbar{height:4px;border-radius:3px;background:var(--panel2);overflow:hidden;
  margin-top:5px;min-width:150px}
.rc .hudstrip .hbar i{display:block;height:100%;border-radius:3px;
  background:linear-gradient(90deg,var(--car),var(--accent))}
.rc .hudstrip .hstint{font-family:var(--font-disp);font-weight:700;font-size:30px;line-height:1;
  letter-spacing:.02em}
.rc .hudstrip .hdrv{color:var(--accent);font-weight:600;font-size:14px}
.rc .hudstrip .hgauge{align-items:center;gap:4px}
.rc .hudstrip .hudpit{margin-left:auto;align-self:center}
@media(max-width:720px){.rc .hudstrip{gap:12px}.rc .hudstrip .hudpit{margin-left:0}}
/* --- pit board --- */
.rc .pitboard{position:fixed;inset:0;z-index:50;
  background:radial-gradient(1100px 550px at 50% -12%,#2E0C15 0%,#06040A 64%);
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:3vh;text-align:center;padding:4vh 4vw}
.rc .pitboard .huge{font-family:var(--font-disp);font-weight:700;
  font-size:clamp(70px,18vw,220px);line-height:.95;color:var(--green);
  font-variant-numeric:tabular-nums}
.rc .pitboard .mid{font-family:var(--font-disp);font-weight:600;
  font-size:clamp(28px,6vw,64px);color:var(--txt)}
.rc .pitboard .plbl{color:var(--dim);font-size:clamp(12px,2vw,18px);
  text-transform:uppercase;letter-spacing:.15em}
.rc .pitboard .close{position:absolute;top:16px;right:20px;font-size:26px;
  background:none;border:1px solid var(--line);border-radius:8px;color:var(--dim);
  width:44px;height:44px;cursor:pointer}
.rc .pbrow{display:flex;gap:1.6vw;flex-wrap:wrap;justify-content:center;align-items:center}
.rc .pitboard .pbcard.pbgauge{display:flex;flex-direction:column;align-items:center;gap:8px;
  background:none;border:none;padding:0;min-width:150px}
.rc .pitboard .pbcard.pbgauge svg{filter:drop-shadow(0 6px 22px rgba(0,0,0,.5))}
.rc .pitboard .pbcard{background:rgba(255,255,255,.035);border:1px solid var(--line);
  border-radius:16px;padding:1.4vh 2.6vw;min-width:170px}
.rc .pitboard .chips{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;
  align-items:center}
.rc .pitboard .chip2{font-family:var(--font-disp);font-weight:700;letter-spacing:.08em;
  padding:5px 16px;border-radius:9px;font-size:clamp(15px,2.4vw,22px);line-height:1;
  border:1px solid}
.rc .pitboard .chip2.fuel{color:var(--green);border-color:var(--green);
  background:rgba(46,204,113,.12)}
.rc .pitboard .chip2.tyre{color:var(--accent);border-color:var(--accent);
  background:rgba(210,67,87,.12)}
.rc .pitboard .chip2.none{color:var(--dim);border-color:var(--line);
  background:rgba(255,255,255,.03)}
/* --- dashboard --- */
.rc .dgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
.rc .infocard{text-align:center}
.rc .infocard .disp{justify-content:center}
.rc .infocard .hint{text-align:center}
/* tıklanabilir kart + büyütme (lightbox) animasyonları */
.rc .infocard.clickable{cursor:zoom-in;transition:transform .18s ease,border-color .18s ease,
  box-shadow .18s ease}
.rc .infocard.clickable:hover{transform:translateY(-3px) scale(1.02);border-color:var(--accent);
  box-shadow:0 8px 24px rgba(0,0,0,.45)}
.rc .infocard.clickable:active{transform:scale(.98)}
.rc .lightbox{position:fixed;inset:0;z-index:1000;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:14px;padding:32px;cursor:zoom-out;
  background:rgba(10,6,10,.88);backdrop-filter:blur(5px);animation:lbfade .22s ease}
.rc .lightbox img{max-width:90vw;max-height:78vh;object-fit:contain;
  animation:lbzoom .3s cubic-bezier(.2,.85,.3,1.12);
  filter:drop-shadow(0 16px 48px rgba(0,0,0,.75))}
.rc .lightbox .lbcap{font-family:var(--font-disp);font-size:20px;letter-spacing:.05em;
  text-transform:uppercase;color:var(--txt);animation:lbfade .4s ease}
.rc .lightbox .lbclose{position:absolute;top:18px;right:22px;background:var(--panel2);
  border:1px solid var(--line);border-radius:8px;color:var(--txt);font-size:16px;
  padding:6px 12px;cursor:pointer}
.rc .lightbox .lbclose:hover{border-color:var(--car);color:#FFE9ED}
@keyframes lbfade{from{opacity:0}to{opacity:1}}
@keyframes lbzoom{from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1}}
/* lightbox tempo kademeleri paneli */
.rc .lbtiers{background:var(--panel2);border:1px solid var(--line);border-radius:12px;
  padding:12px 18px;min-width:320px;cursor:default;animation:lbzoom .3s cubic-bezier(.2,.85,.3,1.12)}
.rc .lbtr{display:flex;align-items:center;gap:10px;padding:3px 0;font-size:13px}
.rc .lbtr i{width:10px;height:10px;border-radius:3px;flex:0 0 auto}
.rc .lbtr .lbl{flex:1;letter-spacing:.06em;font-size:11px;color:var(--muted);
  text-transform:uppercase}
.rc .lbtr b{font-size:14px}
.rc .lbtr:first-child .lbl{color:var(--txt);font-weight:700}
.rc .lbtr:first-child{border-bottom:1px solid var(--line);padding-bottom:6px;margin-bottom:4px}
.rc .lbsrc{margin-top:8px;padding-top:6px;border-top:1px solid var(--line);font-size:9.5px;
  color:var(--muted);letter-spacing:.04em}
/* ============================================================
   RTÖTUŞ — ergonomi + cila (muhafazakar; yalnız görsel)
   ============================================================ */
/* sayısal hizalama + biraz daha okunur tablo gövdesi */
.rc td,.rc .mono{font-variant-numeric:tabular-nums}
.rc td{font-size:13px}
/* veri tablolarında satır-hover (yoğun tabloyu taramak kolaylaşır) */
.rc tbody tr{transition:background .12s}
.rc tbody tr:hover td{background:rgba(255,255,255,.035)}
.rc tbody tr.last:hover td,.rc tbody tr.live:hover td{background:rgba(255,255,255,.06)}
/* KPI: üst-kenar vurgu (hafif derinlik + hiyerarşi) */
.rc .kpi{position:relative;overflow:hidden}
.rc .kpi::before{content:"";position:absolute;left:10px;right:10px;top:0;height:2px;
  border-radius:2px;background:linear-gradient(90deg,var(--accent),transparent 72%);opacity:.6}
/* dokunma hedeflerini büyüt (fare) */
.rc .tyrebox button{width:30px;height:28px;font-size:10px}
.rc .lapstep{width:22px;height:22px}
.rc .lapclr{width:20px;height:20px;font-size:12px}
.rc .minibtn{width:24px;height:24px}
.rc .pitopt button{padding:4px 10px}
/* dokunmatik cihazlarda biraz daha büyük — masaüstü etkilenmez */
@media (pointer:coarse){
  .rc .tyrebox button{width:36px;height:32px}
  .rc .lapstep{width:26px;height:26px}
  .rc .pitopt button{padding:7px 12px}
  .rc .lapclr{width:24px;height:24px}
}
/* --- Yoğunluk modu: "comfort" → biraz daha nefes alan boşluk/tipografi.
   data-density html'de (:root); tüm .rc köklerini (lobi/seçici/ana) kapsar. --- */
:root[data-density="comfort"] .rc{font-size:14px}
:root[data-density="comfort"] .rc td{font-size:13.5px;padding:9px 10px}
:root[data-density="comfort"] .rc th{padding:8px 10px}
:root[data-density="comfort"] .rc .card{padding:18px}
:root[data-density="comfort"] .rc .kpi{padding:13px}
:root[data-density="comfort"] .rc .grid{gap:20px}
:root[data-density="comfort"] .rc .tabs button{padding:10px 18px}
:root[data-density="comfort"] .rc input[type=text],
:root[data-density="comfort"] .rc input[type=number],
:root[data-density="comfort"] .rc input[type=datetime-local]{padding:8px 10px}
/* --- Komut paleti (Ctrl+K) --- */
.rc .wxmbox.cmdk{width:min(560px,94vw);align-self:flex-start;margin-top:12vh}
.rc .cmdk-in{display:flex;align-items:center;gap:9px;padding:12px 16px;
  border-bottom:1px solid var(--line);color:var(--dim)}
.rc .cmdk-in input{flex:1;background:none;border:none;outline:none;color:var(--txt);
  font-family:var(--font-ui);font-size:16px;padding:0}
.rc .cmdk-list{max-height:min(52vh,420px);overflow-y:auto;padding:6px}
.rc .cmdk-opt{display:flex;align-items:center;gap:10px;width:100%;background:none;border:none;
  border-radius:8px;color:var(--txt);cursor:pointer;padding:9px 11px;text-align:left;font-size:13px}
.rc .cmdk-opt.on{background:var(--sel-bg)}
.rc .cmdk-i{display:inline-flex;color:var(--dim);flex:0 0 auto}
.rc .cmdk-opt.on .cmdk-i{color:var(--accent)}
.rc .cmdk-l{flex:1}
.rc .cmdk-h{font-size:11px;color:var(--muted);font-family:var(--font-mono)}
.rc .cmdk-foot{display:flex;gap:16px;padding:8px 14px;border-top:1px solid var(--line);
  font-size:10.5px;color:var(--muted);letter-spacing:.04em}
/* --- İskelet yükleme (Suspense / veri beklerken düz metin yerine) --- */
.rc .skelwrap{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;padding:4px 0}
.rc .skel{background:var(--panel);border:1px solid var(--line);border-radius:10px;
  padding:14px;min-height:96px;position:relative;overflow:hidden}
.rc .skel::after{content:"";position:absolute;inset:0;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent);
  transform:translateX(-100%);animation:skelsh 1.25s ease-in-out infinite}
.rc .skel .sl{height:12px;border-radius:5px;background:var(--panel2);margin-bottom:9px}
.rc .skel .sl.w40{width:40%}.rc .skel .sl.w70{width:70%}.rc .skel .sl.w55{width:55%}
@keyframes skelsh{100%{transform:translateX(100%)}}
@media (prefers-reduced-motion:reduce){.rc .skel::after{animation:none}}
/* klavye odağı her interaktif öğede görünür */
.rc button:focus-visible,.rc select:focus-visible,.rc a:focus-visible,
.rc [role="button"]:focus-visible{outline:2px solid var(--accent);outline-offset:2px;
  border-radius:6px}

/* ===== Resmi Yarış Merkezi (ScheduleTab) — mevcut token'lar, yeni UI dili yok ===== */
.rc .sch-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.rc .sch-head h2{margin:0}
.rc .sch-upd{margin-left:auto;font-size:12px}
.rc .sch-summary{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.rc .sch-stat{background:var(--panel2);border:1px solid var(--line);border-radius:8px;
  padding:8px 12px;min-width:70px;display:flex;flex-direction:column;gap:2px}
.rc .sch-stat .n{font-family:var(--font-disp);font-size:20px;font-weight:700;line-height:1}
.rc .sch-stat .l{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.rc .sch-next{flex:1 1 260px;min-width:220px;background:var(--sel-bg-soft);border:1px solid var(--line);
  border-radius:8px;padding:8px 12px;display:flex;flex-direction:column;gap:2px}
.rc .sch-next .l{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--accent);font-weight:600}
.rc .sch-next .nm{font-family:var(--font-disp);font-weight:600;font-size:15px}
.rc .sch-next .mt{font-size:11.5px;color:var(--dim)}
.rc .sch-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
.rc .sch-search{flex:1 1 240px;min-width:150px;padding:8px 10px;background:var(--panel2);
  border:1px solid var(--line);border-radius:8px;color:var(--txt);font-size:13px}
.rc .sch-clear{padding:6px 12px;border-radius:8px;border:1px solid var(--line);
  background:var(--panel2);color:var(--dim);cursor:pointer;font-size:12px;white-space:nowrap}
.rc .sch-clear:hover{border-color:var(--accent);color:var(--accent)}
.rc .sch-series{margin:4px 0 8px}
.rc .sch-selrow{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.rc .sch-sel{display:flex;flex-direction:column;gap:2px;font-size:10px;text-transform:uppercase;
  letter-spacing:.04em;color:var(--muted);margin:0}
.rc .sch-sel select{padding:6px 8px;background:var(--panel2);border:1px solid var(--line);
  border-radius:6px;color:var(--txt);font-size:12px;min-width:108px}
.rc .sch-sec{display:flex;align-items:center;gap:8px;margin:14px 0 8px;font-family:var(--font-disp);
  text-transform:uppercase;letter-spacing:.05em;font-size:13px;color:var(--txt)}
.rc .sch-sec .sch-cnt{font-size:11px;color:var(--muted);background:var(--panel2);
  border:1px solid var(--line);border-radius:99px;padding:1px 8px}
.rc .sch-list{display:flex;flex-direction:column;gap:8px}
.rc .sch-card{display:flex;align-items:center;gap:12px;background:var(--panel2);
  border:1px solid var(--line);border-left:3px solid var(--line2);border-radius:10px;padding:10px 12px}
.rc .sch-card[data-status="live"]{border-left-color:var(--green)}
.rc .sch-card[data-status="upcoming"]{border-left-color:var(--accent)}
.rc .sch-card[data-status="completed"]{opacity:.72}
.rc .sch-when{display:flex;flex-direction:column;gap:2px;min-width:92px;flex:none}
.rc .sch-when .sch-time{font-family:var(--font-disp);font-weight:700;font-size:15px}
.rc .sch-when .sch-date{font-size:11px;color:var(--dim)}
.rc .sch-when .sch-rel{font-size:11px;color:var(--muted)}
.rc .sch-badge{display:inline-flex;align-items:center;gap:4px;font-size:9.5px;font-weight:700;
  text-transform:uppercase;letter-spacing:.05em;padding:2px 7px;border-radius:99px;width:fit-content;
  border:1px solid var(--line);color:var(--dim);background:var(--panel)}
.rc .sch-badge[data-status="live"]{color:var(--green);border-color:var(--green)}
.rc .sch-badge[data-status="upcoming"]{color:var(--accent);border-color:var(--accent)}
.rc .sch-badge[data-status="completed"]{color:var(--muted)}
.rc .sch-dot{width:7px;height:7px;border-radius:99px;background:var(--green);
  box-shadow:0 0 6px var(--green);animation:schpulse 1.4s ease-in-out infinite}
@keyframes schpulse{50%{opacity:.35}}
@media (prefers-reduced-motion:reduce){.rc .sch-dot{animation:none}}
.rc .sch-thumb{width:56px;height:38px;flex:none;border-radius:6px;overflow:hidden;background:var(--panel);
  border:1px solid var(--line);display:flex;align-items:center;justify-content:center}
.rc .sch-thumb img{width:100%;height:100%;object-fit:cover}
.rc .sch-main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:3px}
.rc .sch-title{font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rc .sch-sub{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.rc .sch-kind{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);
  border:1px solid var(--line);border-radius:4px;padding:1px 6px}
.rc .sch-cls{font-size:10px;font-weight:600;padding:1px 6px;border-radius:4px;
  background:var(--panel);border:1px solid var(--line2);color:var(--dim)}
.rc .sch-venue{font-size:12px;color:var(--dim)}
.rc .sch-venue .sch-len{color:var(--muted);margin-left:4px}
/* pist bayrağı — emoji flag Windows'ta "BE/FR" harflerine düşüyordu → PNG asset */
.rc .sch-flag{width:19px;height:13px;object-fit:cover;border-radius:2px;
  border:1px solid var(--line);vertical-align:-2px;margin-right:5px}
.rc .sch-side{display:flex;align-items:center;gap:8px;flex:none;margin-left:auto}
.rc .sch-sr{font-size:10.5px;font-weight:600;padding:2px 7px;border-radius:6px;
  border:1px solid var(--line);color:var(--dim);white-space:nowrap}
.rc .sch-sr[data-rank="Bronze"]{color:#C77B3B}
.rc .sch-sr[data-rank="Silver"]{color:#9FA7AE}
.rc .sch-sr[data-rank="Gold"]{color:var(--yellow)}
.rc .sch-actions{display:flex;gap:4px}
.rc .sch-open{width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;
  border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--dim);
  cursor:pointer;text-decoration:none;font-size:14px}
.rc .sch-open:hover{border-color:var(--accent);color:var(--accent)}
.rc .sch-empty{text-align:center;padding:28px 12px;color:var(--dim);display:flex;
  flex-direction:column;align-items:center;gap:8px}
.rc .sch-empty-i{font-size:28px;opacity:.7}
.rc .sch-src{margin-top:12px;font-size:12px}
@media(max-width:640px){
  .rc .sch-card{flex-wrap:wrap;gap:8px}
  .rc .sch-thumb{display:none}
  .rc .sch-side{margin-left:0;width:100%;justify-content:space-between}
  .rc .sch-sel select{min-width:0}
}

/* ══════════════════════════════════════════════════════════════════════════════
   v2.0 KABUK — sol ray (76px) + sticky yarış çubuğu + ekran yönlendirmesi
   Kaynak: docs/design-handoff/Yeni Tasarım.dc.html (markup) + README.md §2, §Interactions
   ══════════════════════════════════════════════════════════════════════════════ */

/* --- Animasyonlar (README "Animasyonlar (keyframes)") --- */
@keyframes rcin{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes rcfade{from{opacity:0}to{opacity:1}}
@keyframes rcpop{from{opacity:0;transform:translateY(14px) scale(.975)}to{opacity:1;transform:none}}
@keyframes rcalert{0%,100%{box-shadow:0 0 0 0 rgba(245,178,61,.42)}
  50%{box-shadow:0 0 0 7px rgba(245,178,61,0)}}
@keyframes rcpb{0%{background:rgba(55,214,122,.34)}70%{background:rgba(55,214,122,.20)}
  100%{background:transparent}}
@keyframes rcpbc{0%{background:rgba(181,139,255,.36)}70%{background:rgba(181,139,255,.22)}
  100%{background:transparent}}
@keyframes rcspin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){
  .rc *,.rc *::before,.rc *::after{
    animation-duration:.01ms !important;animation-iteration-count:1 !important;
    transition-duration:.01ms !important}
}

/* --- Kabuk düzeni: ray + içerik --- */
.rc.v2{padding:0;display:flex;min-height:100vh}
.rc.v2 .v2main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column}
.rc.v2 .v2screen{flex:1 1 auto;min-width:0;padding:var(--sp-7) var(--sp-8) 40px;
  animation:rcin var(--t-screen)}

/* --- Sol ray (76px) --- */
.rc .rail{flex:0 0 var(--rail-w);width:var(--rail-w);position:sticky;top:0;align-self:flex-start;
  height:100vh;display:flex;flex-direction:column;align-items:center;gap:2px;
  padding:10px 0 12px;background:var(--panel-alt);border-right:1px solid var(--line);
  z-index:var(--z-rail);overflow-y:auto;scrollbar-width:none;
  transition:margin-left var(--t-panel)}
.rc .rail::-webkit-scrollbar{display:none}
.rc .rail.hidden{margin-left:calc(var(--rail-w) * -1)}
.rc .railtoggle{position:absolute;top:8px;right:4px;width:18px;height:18px;padding:0;
  display:flex;align-items:center;justify-content:center;border:none;background:transparent;
  color:var(--faint);cursor:pointer;font-size:13px;line-height:1}
.rc .railtoggle:hover{color:var(--accent)}
.rc .railopen{position:fixed;top:10px;left:0;z-index:var(--z-rail);width:26px;height:34px;
  display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;
  border:1px solid var(--line);border-left:none;border-radius:0 var(--r-sm) var(--r-sm) 0;
  background:var(--panel-alt);color:var(--dim)}
.rc .railopen:hover{color:var(--accent);border-color:var(--line-strong)}
.rc .railbtn{width:64px;display:flex;flex-direction:column;align-items:center;gap:4px;
  padding:9px 2px;border:1px solid transparent;border-radius:var(--r-lg);background:transparent;
  color:var(--muted);cursor:pointer;transition:color var(--t-fast),background var(--t-fast),
  border-color var(--t-fast)}
.rc .railbtn span{font-family:var(--font-disp);font-weight:600;font-size:9.5px;
  letter-spacing:.04em;text-transform:uppercase;line-height:1}
.rc .railbtn:hover{color:var(--dim);background:var(--panel2)}
.rc .railbtn.on{color:var(--on-car);background:var(--sel-bg);border-color:var(--accent)}
.rc .railsep{width:40px;height:1px;background:var(--line);margin:6px 0 8px;flex:0 0 auto}
.rc .railfoot{margin-top:auto;display:flex;flex-direction:column;align-items:center;gap:4px;
  padding-top:8px}
.rc .railver{font-size:9px;color:var(--faint);letter-spacing:.04em}
.rc .railbadge{position:absolute;top:4px;right:12px;min-width:15px;height:15px;padding:0 4px;
  display:flex;align-items:center;justify-content:center;border-radius:var(--r-pill);
  background:var(--accent-soft);color:var(--on-car);font-size:9.5px;font-weight:700}
.rc .railbtnwrap{position:relative;display:flex}

/* --- Birleşik sticky yarış çubuğu --- */
/* NOT: v1'deki '.rc header' kuralı (flex-wrap:wrap, gap:12px, padding:14px 20px)
   aynı elemana uyduğu için burada AÇIKÇA sıfırlanır — aksi halde sağ blok alt
   satıra sarıyor. */
.rc .racebar{position:sticky;top:0;z-index:var(--z-racebar);display:flex;align-items:stretch;
  flex-wrap:nowrap;gap:0;padding:0;background:linear-gradient(180deg,#1A1013,var(--panel));
  border-bottom:1px solid var(--line)}
.rc .rbblock{display:flex;flex-direction:column;justify-content:center;gap:2px;
  padding:9px var(--sp-6);border-left:1px solid var(--line);min-width:0}
.rc .rbblock:first-child{border-left:none}
.rc .rblabel{font-size:var(--fs-label);text-transform:uppercase;letter-spacing:var(--ls-label);
  color:var(--muted);font-weight:600;white-space:nowrap}
.rc .rbrace{flex:1 1 auto;flex-direction:row;align-items:center;gap:var(--sp-4);min-width:0}
.rc .rbrace>div{display:flex;flex-direction:column;min-width:0}
.rc .rbflag{width:34px;height:auto;border-radius:3px;flex:0 0 auto}
.rc .rbname{font-family:var(--font-disp);font-size:var(--fs-page);font-weight:700;
  letter-spacing:.02em;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rc .rbmeta{font-size:11px;color:var(--muted);white-space:nowrap}
.rc .rbviewer{display:inline-flex;align-items:center;justify-content:center;gap:5px;
  margin:4px auto 0;padding:2px 8px;border-radius:var(--r-pill);
  border:1px solid var(--yellow);background:rgba(245,178,61,.08);color:var(--yellow);
  font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em}
.rc .rbnum{font-family:var(--font-disp);font-weight:700;line-height:1;
  font-variant-numeric:tabular-nums;font-size:var(--hud-num)}
.rc .rbnum.lg{font-size:var(--hud-num-lg)}
.rc .rbbar{height:3px;border-radius:2px;background:var(--line);overflow:hidden;margin-top:4px}
.rc .rbbar i{display:block;height:100%;background:var(--accent);border-radius:2px}
.rc .rbpit .rbnum{color:var(--yellow)}
.rc .rbpitring{border-radius:var(--r-lg);animation:rcalert 2.6s infinite}
.rc .rbenergy .rbnum{color:var(--green)}
.rc .rbcls{font-family:var(--font-disp);font-weight:700;font-size:16px}
.rc .rbside{margin-left:auto;flex:0 0 auto;display:flex;flex-direction:column;gap:6px;
  justify-content:center;padding:9px var(--sp-6);border-left:1px solid var(--line)}
.rc .rbsiderow{display:flex;gap:6px}
.rc .rbsiderow>*{flex:1 1 0;min-width:0}
.rc .rblive{display:flex;align-items:center;justify-content:center;gap:7px;padding:6px 12px;
  border-radius:var(--r-sm);cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap;
  border:1px solid var(--green);background:rgba(55,214,122,.14);color:var(--green)}
.rc .rblive.off{border-color:var(--line);background:var(--panel2);color:var(--muted)}
.rc .rblive i{width:7px;height:7px;border-radius:50%;background:currentColor;
  animation:rcpulse 1.2s infinite;flex:0 0 auto}
.rc .rbbtn{position:relative;display:flex;align-items:center;justify-content:center;gap:6px;
  padding:6px 10px;border-radius:var(--r-sm);cursor:pointer;font-size:12px;white-space:nowrap;
  border:1px solid var(--line);background:var(--panel2);color:var(--dim);
  transition:border-color var(--t-fast),color var(--t-fast)}
.rc .rbbtn:hover{border-color:var(--line-strong);color:var(--txt)}
.rc .rbbtn .rbdirty{min-width:16px;height:16px;padding:0 4px;border-radius:var(--r-pill);
  background:var(--yellow);color:#1B1013;font-size:10px;font-weight:700;
  display:inline-flex;align-items:center;justify-content:center}

/* --- Rehber kutuları (README §17) --- */
.rc .guide{display:flex;align-items:baseline;gap:var(--sp-4);margin-bottom:var(--sp-6);
  padding:9px var(--sp-6);border-radius:var(--r-lg);
  border:1px solid var(--line-strong);background:rgba(181,139,255,.07)}
.rc .guide b{font-family:var(--font-disp);font-size:var(--fs-card);font-weight:700;
  color:var(--txt);white-space:nowrap}
.rc .guide span{font-size:11.5px;color:var(--dim);line-height:1.45}

/* --- Sistematik boş durumlar --- */
.rc .empty{display:flex;flex-direction:column;align-items:center;gap:var(--sp-4);
  padding:34px var(--sp-8);text-align:center;border-radius:var(--r-xl);
  border:1px dashed var(--line-strong);background:var(--panel-alt)}
.rc .empty-i{color:var(--line-dim);line-height:0}
.rc .empty b{font-family:var(--font-disp);font-size:17px;font-weight:700;color:var(--txt)}
.rc .empty p{margin:0;max-width:46ch;font-size:12.5px;color:var(--muted);line-height:1.5}
.rc .empty-act{display:flex;gap:var(--sp-3);flex-wrap:wrap;justify-content:center}

/* --- İzleyici modu pasifleştirme (README §18) --- */
.rc .ro-off{opacity:.5;pointer-events:none}
.rc .ro-note{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--yellow)}

/* --- Sağdan kayan panel (yarış datası) --- */
.rc .rdscrim{position:fixed;inset:0;z-index:var(--z-rd-scrim);background:var(--scrim);
  animation:rcfade .18s ease-out}
.rc .rdpanel{position:fixed;top:0;right:0;bottom:0;z-index:var(--z-rd);width:var(--rd-w);
  display:flex;flex-direction:column;background:var(--panel);
  border-left:1px solid var(--line-strong);box-shadow:var(--sh-panel);
  transform:translateX(102%);transition:transform var(--t-panel)}
.rc .rdpanel.open{transform:none}

/* --- Alttan kayan karşılaştırma tepsisi --- */
.rc .cmptray{position:fixed;left:50%;bottom:20px;z-index:var(--z-tray);
  display:flex;align-items:center;gap:var(--sp-5);padding:var(--sp-4) var(--sp-7);
  border-radius:var(--r-xl);background:var(--panel-alt);border:1px solid var(--accent);
  box-shadow:var(--sh-tray);transform:translate(-50%,140%);
  transition:transform var(--t-panel)}
.rc .cmptray.open{transform:translate(-50%,0)}

/* --- Yükleme göstergesi --- */
.rc .spin{width:16px;height:16px;border-radius:50%;border:2px solid var(--line-strong);
  border-top-color:var(--accent);animation:rcspin .8s linear infinite;flex:0 0 auto}

/* ── v2.0 CANLI TIMING — saha tablosu (README §6) ─────────────────────────────
   Yoğunluk YALNIZ bu ekranda: .wall = Pit duvarı (seyrek satır, büyük sayı),
   .eng = Mühendis (sık satır, 12.5px). Sütunlar İKİ MODDA DA görünür — yalnız
   ölçek değişir. Global yoğunluk anahtarı v2.0'da kaldırıldı. */
/* v2 ekran alanı: sol data kolonu kalktığı için grid tek kolon, tam genişlik */
.rc .grid.v2grid{display:block;padding:0}
.rc .grid.v2grid>.v2screen{padding:var(--sp-7) var(--sp-8) 40px}

/* ── v2.0 İZLEYİCİ MODU görsel sistemi (README §18) ──────────────────────────
   Rol 'viewer' olduğunda düzenleme yolları TUTARLI biçimde pasifleşir. İşlevsel
   engel zaten App.jsx blocked()/edit() zincirinde (DenyToast) — buradaki kurallar
   görsel karşılığı. Yarış çubuğundaki amber "İZLEYİCİ MODU" rozeti dışında
   BAŞKA HİÇBİR YERDE açıklama metni yok; tek istisna Yakıt ekranındaki
   "👁 İzleyici modunda pasif" notu. */
.rc .viewonly .tylight,.rc .viewonly .availcell,.rc .viewonly .denbtn,
.rc .viewonly .rbbtn.apply,.rc .viewonly .pdfbtn{pointer-events:none;opacity:.5}
/* gezinme, süzgeç ve görünüm anahtarları izleyicide de ÇALIŞIR (salt-okur
   inceleme bozulmasın): ray, başlık geçişleri, yoğunluk-dışı düğmeler. */
.rc .viewonly .railbtn,.rc .viewonly .fieldtbl th button,
.rc .viewonly .secbtn,.rc .viewonly .sideflip,
.rc .viewonly .flapsbtn{pointer-events:auto;opacity:1}

/* ── v2.0 YARIŞ DATASI PANELİ — sahnele + uygula (README §14) ────────────────*/
.rc .rdhead{display:flex;align-items:center;gap:var(--sp-4);flex:0 0 auto;
  padding:var(--sp-5) var(--sp-6);border-bottom:1px solid var(--line)}
.rc .rdhead .ttl{flex:1 1 auto;font-size:16px;font-weight:700;text-transform:uppercase;
  letter-spacing:var(--ls-card)}
.rc .rdbody{flex:1 1 auto;overflow-y:auto;padding:var(--sp-5) var(--sp-6)}
.rc .rdaffect{display:flex;flex-direction:column;gap:5px;margin-top:var(--sp-6);
  padding:var(--sp-5);border-radius:var(--r-lg);border:1px solid var(--line-strong);
  background:var(--panel-alt)}
.rc .rdaffect b{font-family:var(--font-disp);font-size:13px;font-weight:700;
  text-transform:uppercase;letter-spacing:var(--ls-card);color:var(--muted)}
.rc .rdaffect span{font-size:12px;color:var(--dim)}
.rc .rdfoot{flex:0 0 auto;display:flex;align-items:center;gap:var(--sp-3);
  padding:var(--sp-4) var(--sp-6);border-top:1px solid var(--line);background:var(--panel-alt)}
.rc .rdfoot .spacer{margin-left:auto}
.rc .rdfoot .dirty{font-size:11.5px;color:var(--yellow);font-weight:600}
.rc .rdfoot .clean{font-size:11.5px;color:var(--muted)}
.rc .rbbtn.apply{border-color:var(--accent);background:var(--car);color:var(--on-car);
  font-weight:600}
.rc .rbbtn:disabled{opacity:.5;cursor:default}
.rc .rbbtn.apply:disabled{background:var(--panel2);color:var(--muted);
  border-color:var(--line)}

/* ── v2.0 PİLOT UYGUNLUĞU (README §8) ────────────────────────────────────────
   Izgara varsayılan olarak tüm hücreler uygun (yeşil ✓); tıklayınca kırmızı ✕. */
.rc .drvcaprow{display:flex;align-items:center;gap:var(--sp-4)}
.rc .drvcaprow .spacer{margin-left:auto}
.rc .availhint{font-size:11.5px;color:var(--muted);margin-bottom:var(--sp-4)}
.rc .availwrap{overflow-x:auto}
.rc .availgrid{border-collapse:collapse;width:100%}
.rc .availgrid th{padding:6px var(--sp-2);font-size:var(--fs-label);text-transform:uppercase;
  letter-spacing:var(--ls-label);color:var(--muted);text-align:center;white-space:nowrap;
  border-bottom:1px solid var(--line)}
.rc .availgrid th.l{text-align:left}
.rc .availgrid th .tm{display:block;font-size:9.5px;color:var(--faint);font-weight:400}
.rc .availgrid td{padding:4px var(--sp-2);text-align:center;
  border-bottom:1px solid var(--line-softer)}
.rc .availgrid td.l{text-align:left}
.rc .availnm{display:flex;align-items:center;gap:var(--sp-3);white-space:nowrap}
.rc .availnm b{font-family:var(--font-disp);font-size:14px;font-weight:700}
.rc .availnm .fsub{font-size:10.5px;color:var(--muted)}
.rc .availcell{width:30px;height:26px;border-radius:var(--r-xs);cursor:pointer;
  font-size:12px;line-height:1;border:1px solid var(--line);background:var(--panel2);
  color:var(--dim);transition:border-color var(--t-fast),background var(--t-fast)}
.rc .availcell.ok{border-color:var(--green);background:rgba(55,214,122,.14);color:var(--green)}
.rc .availcell.no{border-color:var(--red);background:rgba(255,77,94,.16);color:var(--red)}
.rc .availcell:disabled{cursor:default;opacity:.5}
.rc .availfoot{display:flex;align-items:center;gap:var(--sp-4);flex-wrap:wrap;
  margin-top:var(--sp-5);padding-top:var(--sp-4);border-top:1px solid var(--line)}
.rc .availfoot .spacer{margin-left:auto}
.rc .availfoot .lg{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;
  color:var(--dim)}
.rc .availfoot .lg i{width:10px;height:10px;border-radius:3px;display:inline-block}
.rc .availfoot .lg i.ok{background:var(--green)}
.rc .availfoot .lg i.no{background:var(--red)}
.rc .availwarn{color:var(--yellow);font-size:13px;margin-left:4px}
/* uygun olmayan pilot seçim listesinde soluk + üstü çizili */
.rc option.unavail,.rc option:disabled{color:var(--faint);text-decoration:line-through}

/* ── v2.0 STINT alt şeridi (README §4) ───────────────────────────────────────*/
.rc .stintfoot{display:flex;align-items:center;gap:var(--sp-4);flex-wrap:wrap;
  margin-top:var(--sp-6);padding-top:var(--sp-5);border-top:1px solid var(--line)}
.rc .stintfoot .spacer{margin-left:auto}
.rc .stintfoot .sync{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;
  color:var(--muted)}
.rc .stintfoot .sync i{font-style:normal;padding:2px 8px;border-radius:var(--r-pill);
  border:1px solid var(--line);color:var(--faint);font-size:10.5px}
.rc .stintfoot .sync i.on{border-color:var(--green);color:var(--green);
  background:rgba(55,214,122,.12)}
.rc .driftchip{padding:2px 9px;border-radius:var(--r-pill);border:1px solid var(--line);
  color:var(--dim);font-size:11.5px;font-variant-numeric:tabular-nums}
.rc .driftchip.warn{border-color:var(--yellow);color:var(--yellow)}
.rc .pitbig{padding:8px 22px;border-radius:var(--r-lg);cursor:pointer;
  font-family:var(--font-disp);font-weight:700;letter-spacing:.04em;
  font-size:clamp(20px,2.6vw,30px);line-height:1.05;
  border:1px solid var(--accent);background:var(--car);color:var(--on-car)}
.rc .pitbig:hover:not(:disabled){background:var(--accent-soft)}
.rc .pitbig:disabled{cursor:default;opacity:.6;background:var(--panel2);
  color:var(--muted);border-color:var(--line)}

/* ── v2.0 LASTİK — set envanteri (README §7) ─────────────────────────────────*/
.rc .setinv{display:flex;align-items:center;gap:var(--sp-2);flex-wrap:wrap;
  margin:var(--sp-4) 0 var(--sp-2)}
.rc .setinv .cap{font-size:var(--fs-label);text-transform:uppercase;
  letter-spacing:var(--ls-label);color:var(--muted);margin-right:var(--sp-2)}
.rc .setchip{display:inline-flex;align-items:baseline;gap:4px;padding:3px 9px;
  border-radius:var(--r-pill);border:1px solid var(--line);background:var(--panel2);
  font-size:11.5px}
.rc .setchip b{font-family:var(--font-disp);font-weight:700;font-size:13px}
.rc .setchip i{font-style:normal;color:var(--muted);font-size:10.5px}
.rc .setchip em{font-style:normal;font-size:9.5px;color:var(--faint);
  text-transform:uppercase;letter-spacing:.06em}
/* kullanım rengi tablo hücreleriyle AYNI sınıflardan gelir (.t2/.tq/.t3/.t4/.terr) */
.rc .setchip.t2{border-color:var(--ty-2x);color:var(--ty-2x)}
.rc .setchip.tq{border-color:var(--ty-qual);color:var(--ty-qual)}
.rc .setchip.t3{border-color:var(--ty-3x);color:var(--ty-3x)}
.rc .setchip.t4{border-color:var(--ty-4x);color:var(--ty-4x)}
.rc .setchip.terr{border-color:var(--ty-err);color:var(--ty-err);border-width:2px}
/* lastik limiti aşıldıysa kart kırmızı çerçeve (README §7) */
.rc .card.tyover{border-color:var(--red)}

/* ── v2.0 YAKIT — senaryolar (README §5) ─────────────────────────────────────*/
.rc .scenrows{display:flex;flex-direction:column;gap:var(--sp-2);margin:var(--sp-4) 0}
.rc .scenrow{display:flex;align-items:center;gap:var(--sp-4);padding:7px var(--sp-4);
  border-radius:var(--r-sm);border:1px solid var(--line);background:var(--panel2)}
.rc .scenrow .nm{flex:1 1 auto;font-size:12.5px;min-width:0}
.rc .scenrow .inp{display:inline-flex;align-items:baseline;gap:4px;flex:0 0 auto}
.rc .scenrow .inp input{width:74px;text-align:right;padding:3px 6px;font-size:12.5px}
.rc .scenrow .inp i{font-style:normal;font-size:10.5px;color:var(--muted)}
.rc .scenrow .val{flex:0 0 auto;min-width:62px;text-align:right;
  font-family:var(--font-disp);font-weight:700;font-size:16px;
  font-variant-numeric:tabular-nums}
.rc .scenrow .dlt{flex:0 0 auto;min-width:46px;text-align:right;font-size:11.5px;
  color:var(--muted);font-variant-numeric:tabular-nums}
.rc .scenrow .dlt.down{color:var(--green)}
.rc .scenrow .dlt.up{color:var(--yellow)}

/* Tam sayfa kabuğu — modalden çıkarılan ekranlar (Takım · Sohbet · …) */
.rc .v2page{display:block;animation:rcin var(--t-screen)}
.rc .v2pagehead{display:flex;align-items:center;gap:var(--sp-4);margin-bottom:var(--sp-6);
  padding-bottom:var(--sp-4);border-bottom:1px solid var(--line)}
.rc .v2pagehead .ttl{flex:1 1 auto;font-size:var(--fs-page);font-weight:700;
  text-transform:uppercase;letter-spacing:var(--ls-page);min-width:0}

/* ── v2.0 STINT — S1 / pit lastik ışıkları (README §4) ───────────────────────
   Tek düğme, tıklandıkça durum döner; düğme köşe adını (FL/FR/RL/RR) ve durum
   etiketini birlikte gösterir. Renkler README'deki TY_STATE tablosundan.

   NOT — durum modeli: tasarımdaki beşli (U/W/N/✕/→) ile uygulamanın mevcut
   beşli döngüsü (state.js applyUpTyre: taşı · yeni kuru · Qual'a dön · wet ·
   eski kuru) birebir örtüşmüyor. "Yeni veri katmanı yok" kuralı gereği MEVCUT
   MANTIK korundu; tasarımın görsel dili uygulamanın durumlarına eşlendi.
   Qual (LMU'ya özgü, tasarımda yok) --ty-qual rengiyle "Q" olarak kaldı. */
.rc .tylight{display:inline-flex;align-items:baseline;gap:5px;padding:5px 10px;
  border-radius:var(--r-sm);cursor:pointer;font-family:var(--font-disp);font-weight:700;
  font-size:13px;line-height:1;border:1px solid var(--line);background:var(--panel2);
  color:var(--dim);transition:border-color var(--t-fast),background var(--t-fast)}
.rc .tylight .tag{font-size:11px;opacity:.95}
.rc .tylight.carry{border-style:dashed;border-color:var(--line-strong);
  background:transparent;color:var(--line-dim);opacity:.6}
.rc .tylight.new{border-color:var(--green);background:rgba(55,214,122,.16);color:var(--green)}
.rc .tylight.qual{border-color:var(--ty-qual);background:rgba(102,148,255,.16);color:var(--ty-qual)}
.rc .tylight.wet{border-color:var(--blue);background:rgba(76,154,255,.16);color:var(--blue)}
.rc .tylight.used{border-color:var(--yellow);background:rgba(245,178,61,.16);color:var(--yellow)}
.rc .tylight:hover{border-color:var(--accent)}
/* pistteki pilot çipi */
.rc .ontrack{display:inline-flex;align-items:center;gap:4px;padding:1px 7px;
  border-radius:var(--r-pill);border:1px solid var(--green);color:var(--green);
  background:rgba(55,214,122,.12);font-size:10px;font-weight:700;text-transform:uppercase;
  letter-spacing:.06em}

/* ── v2.0 DASHBOARD (README §3) — iki kolon ──────────────────────────────────
   Sol: araç + pist görsel kartı (tıkla → büyütme penceresi), altında stint
   programı. Sağ: 4 KPI, canlı durum satırı, lastik, son stint VE, pilot dağılımı. */
.rc .dashgrid{display:flex;gap:var(--sp-5);align-items:flex-start;flex-wrap:wrap}
.rc .dashcol{display:flex;flex-direction:column;gap:var(--sp-5);min-width:0}
.rc .dashcol.left{flex:1 1 520px}
.rc .dashcol.right{flex:1 1 380px}
.rc .dashvis{display:flex;gap:var(--sp-5);flex-wrap:wrap}
.rc .dashvis>*{flex:1 1 240px;min-width:0}
.rc .dashhead{display:flex;align-items:center;gap:var(--sp-4);margin-bottom:var(--sp-4)}
.rc .dashhead .spacer{margin-left:auto}
.rc .pdfbtn{padding:5px var(--sp-7);border-radius:var(--r-xs);cursor:pointer;font-size:12px;
  background:var(--panel2);color:var(--txt);border:1px solid var(--line)}
.rc .pdfbtn:hover{border-color:var(--accent);color:var(--accent)}
/* son stint VE — 36px yeşil yüzde */
.rc .vebig{font-family:var(--font-disp);font-weight:700;font-size:var(--fs-kpi-lg);
  color:var(--green);line-height:1.05;font-variant-numeric:tabular-nums}
.rc .vebig .sub{font-size:18px;color:var(--dim);margin-left:8px;font-weight:600}
/* pilot dağılımı — pilot renkli çubuklar (renk veriye bağlı → inline) */
.rc .drvsplit{display:flex;flex-direction:column;gap:6px;margin-top:var(--sp-3)}
.rc .drvsplit .row{display:flex;flex-direction:column;gap:3px}
.rc .drvsplit .top{display:flex;justify-content:space-between;font-size:12px;gap:var(--sp-3)}
.rc .drvsplit .top .nm{display:flex;align-items:center;gap:6px;min-width:0;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rc .drvsplit .dot{width:9px;height:9px;border-radius:3px;flex:0 0 auto}
.rc .drvsplit .bar{height:5px;border-radius:3px;background:var(--panel2);overflow:hidden}
.rc .drvsplit .bar i{display:block;height:100%;border-radius:3px}
/* araç / pist görselleri */
.rc .infoimg{display:block;width:100%;max-height:140px;object-fit:contain;
  margin:var(--sp-3) 0 var(--sp-4);filter:drop-shadow(0 4px 12px rgba(0,0,0,.5))}
.rc .infoimg.track{max-height:160px}

/* Canlı Timing iki kolon: saha tablosu + 320px sağ panel (kayarak kapanır) */
.rc .livegrid{display:flex;gap:var(--sp-5);align-items:flex-start}
.rc .livemain{flex:1 1 auto;min-width:0}
.rc .liveside{flex:0 0 var(--side-w);width:var(--side-w);
  transition:margin-right var(--t-panel),opacity var(--t-panel)}
.rc .livegrid.noside .liveside{margin-right:calc(var(--side-w) * -1);opacity:0;
  pointer-events:none}
.rc .sideflip{flex:0 0 auto;align-self:flex-start;width:14px;height:38px;margin-top:4px;
  display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:10px;
  border:1px solid var(--line);border-right:none;
  border-radius:var(--r-sm) 0 0 var(--r-sm);background:var(--panel-alt);color:var(--dim)}
.rc .sideflip:hover{color:var(--accent);border-color:var(--line-strong)}
@media(max-width:1180px){
  .rc .livegrid{flex-wrap:wrap}
  .rc .liveside{flex:1 1 100%;width:auto}
}

/* rakip karşılaştırma tepsisi içeriği */
.rc .cmptray .cmphead{display:flex;flex-direction:column;padding-right:var(--sp-3);
  border-right:1px solid var(--line);margin-right:var(--sp-2)}
.rc .cmptray .cmphead b{font-family:var(--font-disp);font-size:15px;font-weight:700}
.rc .cmpcell{display:flex;flex-direction:column;align-items:flex-end;gap:1px;min-width:64px}
.rc .cmpk{font-size:var(--fs-label);text-transform:uppercase;letter-spacing:var(--ls-label);
  color:var(--muted)}
.rc .cmpv{font-family:var(--font-disp);font-size:15px;font-weight:700;
  font-variant-numeric:tabular-nums}
.rc .cmpd{font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums}
.rc .cmpd.up{color:var(--green)}
.rc .cmpd.down{color:var(--red)}
.rc .brandimg{height:16px;width:16px;object-fit:contain;vertical-align:middle;margin-right:6px}
.rc .fieldtbl .brandimg{margin-right:0}
.rc .fieldwrap{overflow-x:auto;overflow-y:visible}
.rc .fieldtbl{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
.rc .fieldtbl th{position:sticky;top:0;z-index:2;background:var(--panel);
  color:var(--muted);font-size:var(--fs-label);font-weight:600;text-transform:uppercase;
  letter-spacing:var(--ls-label);text-align:right;padding:10px var(--sp-5);
  border-bottom:1px solid var(--line);white-space:nowrap}
.rc .fieldtbl th.l{text-align:left}
/* başlık geçişleri: --accent + kesikli alt çizgi + ⇄ */
.rc .fieldtbl th button{all:unset;cursor:pointer;color:var(--accent);
  border-bottom:1px dashed currentColor;white-space:nowrap}
.rc .fieldtbl th button:hover{color:var(--txt)}
.rc .fieldtbl th button.on{font-weight:700}
.rc .fieldtbl td{text-align:right;border-bottom:1px solid var(--line-soft);
  color:var(--txt);white-space:nowrap}
.rc .fieldtbl td.l{text-align:left}
.rc .fieldtbl tbody tr{transition:background var(--t-fast)}
.rc .fieldtbl tbody tr:hover{background:var(--hover-row)}
/* satır sol kenarı 4px sınıf rengi — renk inline (hesaplanan/veriye bağlı) */
.rc .fieldtbl tbody td:first-child{border-left:4px solid transparent}
.rc .fieldtbl tr.me td{background:var(--sel-strong)}
.rc .fieldtbl tr.me{cursor:default}
.rc .fieldtbl tbody tr.pick{cursor:pointer}
/* kişisel en iyi (yeşil) / sınıf en iyi (mor) tur parlaması — 5 sn */
.rc .fieldtbl tr.pb>td{animation:rcpb 5s ease-out}
.rc .fieldtbl tr.pbc>td{animation:rcpbc 5s ease-out}

/* --- Pit duvarı yoğunluğu --- */
.rc .fieldtbl.wall td{padding:13px var(--sp-5);font-size:16px}
.rc .fieldtbl.wall .fpos{font-family:var(--font-disp);font-weight:700;font-size:26px;line-height:1}
.rc .fieldtbl.wall .fdrv{font-family:var(--font-disp);font-weight:700;font-size:21px;line-height:1.1}
.rc .fieldtbl.wall .fbrand{width:26px;height:26px}
/* --- Mühendis yoğunluğu --- */
.rc .fieldtbl.eng td{padding:7px var(--sp-5);font-size:12.5px}
.rc .fieldtbl.eng .fpos{font-family:var(--font-disp);font-weight:700;font-size:18px;line-height:1}
.rc .fieldtbl.eng .fdrv{font-family:var(--font-disp);font-weight:700;font-size:15px;line-height:1.1}
.rc .fieldtbl.eng .fbrand{width:20px;height:20px}

/* sınıf-içi pozisyon: yalnız rakam, sınıf renginde, ÇERÇEVESİZ */
.rc .fieldtbl .fclspos{font-family:var(--font-disp);font-weight:700;margin-left:6px}
.rc .fieldtbl .fdrvcell{display:flex;align-items:center;gap:var(--sp-3)}
.rc .fieldtbl .fbrand{object-fit:contain;flex:0 0 auto}
.rc .fieldtbl .fsub{display:block;font-size:11px;color:var(--muted);font-family:var(--font-ui)}
.rc .fieldtbl .fsec{font-size:11px;color:var(--dim)}
.rc .fieldtbl .fbest{color:var(--purple);font-weight:700}
.rc .fieldtbl .fdim{color:var(--dim)}
/* Incident — çarpan olarak yazılır (rozet YOK) */
.rc .fieldtbl .finc{color:var(--red);font-weight:600}
.rc .fieldtbl .flapsbtn{all:unset;cursor:pointer;padding:1px 8px;border-radius:var(--r-xs);
  border:1px solid var(--line);color:var(--dim);font-size:14px;line-height:1.4}
.rc .fieldtbl .flapsbtn:hover{border-color:var(--accent);color:var(--accent)}

/* saha başlığı: yoğunluk + sektör görünürlüğü anahtarları */
.rc .fieldhead{display:flex;align-items:center;gap:var(--sp-4);flex-wrap:wrap}
.rc .fieldhead .spacer{margin-left:auto}
.rc .denbtn,.rc .secbtn{padding:5px var(--sp-5);border-radius:var(--r-sm);cursor:pointer;
  font-size:12px;white-space:nowrap;border:1px solid var(--line);background:var(--panel2);
  color:var(--txt)}
.rc .denbtn.on{border-color:var(--accent);background:var(--sel-bg)}
.rc .secbtn{color:var(--muted)}
.rc .secbtn:hover{border-color:var(--line-strong);color:var(--txt)}
`;
