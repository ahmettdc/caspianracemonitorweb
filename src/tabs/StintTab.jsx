import { fmtHMS, parseHMS, wxLog, wxAtRel, tyState, EMPTY_PIT, MAX_STINTS } from "../engine";
import { driverColorOf } from "../constants";

/* Stint plan sekmesi (stint + code80) — KPI'lar, S1 lastik kısayolları, stint/hava
   zaman çizelgeleri, plan tablosu (tur/VE/pit/override) ve pit formülü.
   Mode-aware plan, timeline, liveInfo ve tüm handler'lar App'ten prop gelir.
   handoff-spec/ekranlar/04-stint-plani.md — markup ve stil değerleri birebir;
   inline stil objeleri (koşullu renk/kenarlık) fişten, renkler --rc-* token. */
/* Lastik ışığı durumları (README §4 TY_STATE) — state.js applyUpTyre döngüsüne
   eşlenmiş: 0 taşı · 1 yeni kuru · 2 Qual'a dön · 3 wet · 4 eski kuru tekrar.
   col/bg fişteki lastik çipi renklerinin --rc-* karşılığı; tag/title UI metni. */
/* Renk kodu (kullanıcı isteği): sarı=yeni · mavi=qual · yeşil=wet · koyu=eski
   tekrar · pasif(dashed)=değişmeme. */
const TY_STATE = [
  { tag: "→", title: "Değişme (taşı) — tıkla: yeni kuru", col: "var(--rc-text-4)", bg: "transparent",           dashed: true },
  { tag: "N", title: "Yeni kuru — tıkla: Qual'a dön",     col: "var(--rc-warn)",   bg: "rgba(245,178,61,.16)" },
  { tag: "Q", title: "Qual lastiği — tıkla: wet",         col: "var(--rc-info-2)", bg: "rgba(102,148,255,.16)" },
  { tag: "W", title: "Wet (sınırsız) — tıkla: eski kuru", col: "var(--rc-ok)",     bg: "rgba(55,214,122,.16)" },
  { tag: "U", title: "Eski kuru tekrar — tıkla: taşı",    col: "var(--rc-text-3)", bg: "rgba(150,140,146,.14)" },
];
/* Pilot adından baş harfler (avatar rozeti) */
const initials = (name) => (name || "").split(/\s+/).filter(Boolean)
  .map((w) => w[0]).slice(0, 2).join("").toUpperCase();

export default function StintTab({
  tab, mode, t, st, plan, totalVE, totalFuelL, timeline, liveInfo, pitSoon,
  tyreInfo, quickTyre, bumpLaps, clearLaps, upStintLap, upTyre, upPit,
  assignDriver, upOvr, setRepair, driverPlan,
}) {
  const TY = ["FL", "FR", "RL", "RR"];
  /* pilot renkleri Dashboard ve Pilotlar ile AYNI kaynaktan (constants.js). */
  const drvNames = driverPlan ? st.roster.filter((n) => driverPlan.totals[n]) : (st.roster || []);

  /* --- yeniden kullanılan stil objeleri (fiş: 04-stint-plani.md) --- */
  const disp = "var(--rc-font-display)";
  const card = { border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)" };
  const sectTtl = { fontFamily: disp, textTransform: "uppercase", letterSpacing: ".08em", fontSize: 15, fontWeight: 700 };
  const badge = { border: "1px solid var(--rc-border)", borderRadius: 11, background: "var(--rc-surface)", padding: "9px 14px" };
  const badgeLbl = { color: "var(--rc-text-3)", fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".09em", marginTop: 3 };
  const badgeNum = (weight, color) => ({ fontFamily: disp, fontSize: 20, fontWeight: weight, lineHeight: 1, ...(color ? { color } : {}) });
  /* tablo hücreleri */
  const tdB = { padding: "10px 14px", borderBottom: "1px solid var(--rc-line-soft)", textAlign: "right", fontFamily: disp, fontSize: 13, fontVariantNumeric: "tabular-nums" };
  const tdLeft = { ...tdB, textAlign: "left", fontFamily: "var(--rc-font-ui)", fontSize: 12.5 };
  /* th/thLeft fişte verilmemiş (renderVals bloğu kesik) — tdB desenine göre kuruldu (FLAG) */
  const th = { padding: "11px 14px", borderBottom: "1px solid var(--rc-border)", textAlign: "right", color: "var(--rc-text-3)", fontFamily: disp, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", whiteSpace: "nowrap" };
  const thLeft = { ...th, textAlign: "left" };
  /* lastik köşe düğmesi (fiş r.corners.style) */
  const cornerBtn = (stv) => ({
    width: 30, height: 26, borderRadius: 7, cursor: "pointer", fontSize: 10.5, fontFamily: disp, fontWeight: 600,
    border: TY_STATE[stv].dashed ? "1px dashed var(--rc-border-strong)" : `1px solid ${TY_STATE[stv].col}`,
    color: TY_STATE[stv].col, background: TY_STATE[stv].bg, opacity: TY_STATE[stv].dashed ? 0.6 : 1,
  });
  /* S1 başlangıç lastiği çipi (fiş s1.style) */
  const s1chip = (stv) => ({
    display: "inline-flex", alignItems: "baseline", padding: "5px 10px", borderRadius: 8,
    fontFamily: disp, fontSize: 12, fontWeight: 600,
    border: `1px solid ${TY_STATE[stv].col}`, color: TY_STATE[stv].col, background: TY_STATE[stv].bg,
  });
  /* S1 hızlı ön ayar düğmesi (fiş s1quick.style) */
  const quickBtn = (disabled) => ({
    padding: "6px 12px", borderRadius: 8, fontSize: 11.5,
    border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text)",
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.35 : 1,
  });
  /* satır içi stil kurucular (fiş planRows) */
  const stepBtn = (locked) => ({ width: 24, height: 24, borderRadius: 6, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: locked ? "var(--rc-border-strong)" : "var(--rc-text-2)", cursor: locked ? "not-allowed" : "pointer", fontSize: 12, lineHeight: 1 });
  const lapStyle = (on, locked) => ({ minWidth: 26, textAlign: "center", fontFamily: disp, fontSize: 14, color: on ? "var(--rc-warn)" : locked ? "var(--rc-text-3)" : "var(--rc-text)" });
  const lapClearBtn = { width: 22, height: 22, borderRadius: 6, border: "1px solid var(--rc-warn)", background: "transparent", color: "var(--rc-warn)", cursor: "pointer", fontSize: 10, lineHeight: 1 };
  /* ovrLapStyle/ovrStyle fişte kesik — repair input desenine (width/padding/font) göre kuruldu (FLAG) */
  const ovrLapStyle = (bad) => ({ width: 74, background: "var(--rc-surface-3)", border: `1px solid ${bad ? "var(--rc-danger)" : "var(--rc-border)"}`, borderRadius: 7, color: bad ? "var(--rc-danger)" : "var(--rc-text)", padding: "5px 8px", fontFamily: disp, fontSize: 11.5, textAlign: "right" });
  const ovrLapClear = (bad) => ({ width: 22, height: 22, borderRadius: 6, border: `1px solid ${bad ? "var(--rc-danger)" : "var(--rc-border)"}`, background: "transparent", color: bad ? "var(--rc-danger)" : "var(--rc-text-3)", cursor: "pointer", fontSize: 10, lineHeight: 1 });
  const ovrStyle = (disabled) => ({ width: 90, background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 7, color: "var(--rc-text)", padding: "5px 8px", fontFamily: disp, fontSize: 11.5, textAlign: "right", opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "text" });
  const fuelBtn = (on) => ({ padding: "5px 10px", borderRadius: 7, cursor: "pointer", fontSize: 11, fontFamily: disp, fontWeight: 600, border: `1px solid ${on ? "var(--rc-brand-bright)" : "var(--rc-border)"}`, background: on ? "var(--rc-brand)" : "var(--rc-surface-3)", color: on ? "var(--rc-on-brand)" : "var(--rc-text-2)" });

  /* zaman çizelgesi göstergesi (statik). #8FD0E8/#7B8FF7/#5C6BC0 tokensuz →
     en yakın --rc-* ile eşlendi (FLAG); az ıslak #4D9FFF ve kuru #F5C84C tam eşleşir */
  const wxLegend = [
    { c: "var(--rc-brand)",     w: 12, label: "stint" },
    { c: "var(--rc-warn)",      w: 6,  label: "pit" },
    { c: "var(--rc-warn-2)",    w: 11, label: "kuru" },
    { c: "var(--rc-info-soft)", w: 11, label: "nemli" },
    { c: "var(--rc-delta)",     w: 11, label: "az ıslak" },
    { c: "var(--rc-info-2)",    w: 11, label: "ıslak" },
    { c: "var(--rc-info)",      w: 11, label: "çok ıslak" },
  ];

  /* S1 hızlı ön ayarlar — App quickTyre(0, key); lastik stoğu yetmezse pasif */
  const s1quick = [
    { label: "Qual ile başla", key: "carry", need: 0 },
    { label: "4 yeni", key: "new4", need: 4 },
    { label: "2 yeni ön", key: "fronts", need: 2 },
    { label: "2 yeni arka", key: "rears", need: 2 },
    { label: "2 yeni sol", key: "lefts", need: 2 },
    { label: "2 yeni sağ", key: "rights", need: 2 },
  ];

  const nowLive = liveInfo.status === "live" && mode === "race";
  const nowPct = Math.min(100, ((liveInfo.elapsed || 0) / (liveInfo.raceMs || 1)) * 100);

  return (
    <div style={{ padding: "16px 20px 40px", display: "flex", flexDirection: "column", gap: 14, animation: "rcin .26s ease-out" }}>

      {/* --- başlık + KPI rozetleri --- */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontFamily: disp, textTransform: "uppercase", letterSpacing: ".07em", fontSize: 20, fontWeight: 700 }}>
          {t("Stint planı")}</h2>
        <span style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", gap: 10 }}>
          <div style={{ ...badge, minWidth: 104 }}>
            <div style={badgeNum(600)}>{fmtHMS(plan.raceSec)}</div>
            <div style={badgeLbl}>{tab === "code80" ? t("Code 80 Kalan") : t("Yarış süresi")}</div>
          </div>
          <div style={{ ...badge, minWidth: 104 }}>
            <div style={badgeNum(700, "var(--rc-brand-bright)")}>{st.chosen}-{plan.laps}</div>
            <div style={badgeLbl}>{t("Strateji")}</div>
          </div>
          <div style={{ ...badge, minWidth: 88 }}>
            <div style={badgeNum(700)}>{plan.fullStints}</div>
            <div style={badgeLbl}>{t("Stint")}</div>
          </div>
          <div style={{ ...badge, minWidth: 88 }}>
            <div style={badgeNum(700)}>{plan.totalLaps.toFixed(1)}</div>
            <div style={badgeLbl}>{t("Tahmini tur")}</div>
          </div>
          <div style={{ border: "1px solid rgba(55,214,122,.35)", borderRadius: 11, background: "rgba(55,214,122,.07)", padding: "9px 14px", minWidth: 132 }}>
            <div style={badgeNum(700, "var(--rc-ok)")}>{totalVE.toFixed(0)}%</div>
            <div style={badgeLbl}>⚡ {t("Toplam VE")} · {totalFuelL.toFixed(1)} L</div>
          </div>
        </span>
      </div>

      {/* plan bayrağa ulaşamadıysa sessiz kalmasın: yarım plan tamam sanılıyordu */}
      {(plan.truncated || !plan.rows.length) && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 15px", borderRadius: 11, border: "1px solid var(--rc-warn)", background: "rgba(245,178,61,.10)", fontSize: 12.5, color: "var(--rc-warn)", lineHeight: 1.5 }}>
          {plan.invalid
            ? t("⚠ Plan hesaplanamıyor — süre, \"Avg Lap\" ve seçili stratejinin tur sayısı dolu ve geçerli olmalı (tur ≥ 0:30).")
            : `${t("⚠ Plan tamamlanamadı")} — ${fmtHMS(plan.rows.length
                ? plan.rows[plan.rows.length - 1].timeLeft : plan.raceSec)} ${t("planlanmadı")} (${t("stint sınırı")}: ${MAX_STINTS}).`}
        </div>
      )}

      {/* --- S1 başlangıç lastikleri --- */}
      {tab === "stint" && (
        <div style={{ ...card, padding: "13px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span data-tour="s1" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: disp, textTransform: "uppercase", letterSpacing: ".07em", fontSize: 14, fontWeight: 700, color: "var(--rc-brand-bright)" }}>
            🛞 {t("S1 start lastikleri")}</span>
          <span style={{ display: "flex", gap: 5 }}>
            {TY.map((corner, ci) => {
              /* S1 hücresi SET NUMARASI tutar (tyState değil — o ham sayıyı TY_STATE
                 index'i sanıp taşıyordu → 5+ set numarasında çöküyordu). Durumu
                 anlamlıca türet: boş=değişme · W=wet · qual seti=qual · yeni=yeni. */
              const s1v = String(st.tyreStints[0]?.[ci] ?? "").trim();
              const stv = s1v === "" ? 0 : s1v === "W" ? 3
                : (st.tyreQual || []).some((q) => String(q).trim() === s1v) ? 2 : 1;
              return (
                <span key={corner} style={s1chip(stv)}>{corner}
                  <b style={{ fontSize: 9.5, opacity: 0.8, marginLeft: 4 }}>{TY_STATE[stv].tag}</b></span>
              );
            })}
          </span>
          <span style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginLeft: "auto" }}>
            {s1quick.map((q) => {
              const dis = tyreInfo.available < q.need;
              return (
                <button key={q.key} disabled={dis} onClick={() => quickTyre(0, q.key)} style={quickBtn(dis)}>{t(q.label)}</button>
              );
            })}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, paddingLeft: 9, marginLeft: 2, borderLeft: "1px solid var(--rc-border)" }}>
              <span style={{ fontSize: 10, color: "var(--rc-text-3)", letterSpacing: ".08em", textTransform: "uppercase" }}>{t("1 yeni")}</span>
              {TY.map((c, ci) => {
                const dis = tyreInfo.available < 1;
                return (
                  <button key={c} disabled={dis} title={`${t("Tek yeni lastik")} — ${c}`}
                    onClick={() => quickTyre(0, ["fl", "fr", "rl", "rr"][ci])}
                    style={{ width: 30, height: 26, borderRadius: 7, cursor: dis ? "not-allowed" : "pointer", fontSize: 10.5, fontFamily: disp, fontWeight: 600, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", opacity: dis ? 0.35 : 1 }}>{c}</button>
                );
              })}
            </span>
            <button onClick={() => quickTyre(0, "clear")} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-3)", cursor: "pointer", fontSize: 11.5 }}>{t("Temizle")}</button>
          </span>
          {!(st.tyreStints[0] || []).some((v) => String(v).trim()) && (
            <span style={{ flex: "1 1 100%", fontSize: 11.5, color: "var(--rc-warn)" }}>
              {t("⚠ Başlangıç lastiği seçilmedi — önce buradan başla, pit seçimleri buna zincirlenir")}</span>
          )}
          {tyreInfo.available <= 0 && (
            <span style={{ flex: "1 1 100%", fontSize: 11.5, color: "var(--rc-danger)" }}>
              {t("⚠ Lastik limiti doldu — yeni lastik seçilemez")}</span>
          )}
        </div>
      )}

      {/* --- Zaman çizelgesi --- */}
      <div style={{ ...card, padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={sectTtl}>{t("Zaman çizelgesi")}</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 12, fontSize: 10.5, color: "var(--rc-text-3)", flexWrap: "wrap" }}>
            {wxLegend.map((L) => (
              <span key={L.label} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <i style={{ width: L.w, height: 8, borderRadius: 2, background: L.c, display: "inline-block" }} />{t(L.label)}</span>
            ))}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <i style={{ width: 2, height: 10, background: "var(--rc-ok)", display: "inline-block" }} />{t("şu an")}</span>
          </span>
        </div>
        <div style={{ position: "relative" }}>
          {/* stint şeridi */}
          <div role="img" aria-label={t("Stint zaman çizelgesi")} style={{ display: "flex", gap: 0, height: 34, borderRadius: 8, overflow: "hidden", border: "1px solid var(--rc-border)" }}>
            {timeline.map((s, i) => {
              /* fiş 06-stint: pit=amber, o an SÜRÜLEN stint=marka kırmızı,
                 planlı stintler tek düze koyu (#2A171C). Numaralar koyu zemin
                 üstünde açık metinle net okunur (eski dönüşümlü bordo → soluk). */
              /* s.idx 1-tabanlı (label S1,S2…, buildTimeline r.idx=engine i+1) ama
                 liveInfo.stintIdx 0-tabanlı (computeLiveInfo stintIdx=i) — +1 ile hizala.
                 (Plan tablosu ve pilot şeridi zaten 0-tabanlı i ile karşılaştırıyor.) */
              const isLive = nowLive && s.cls === "stint" && s.idx === liveInfo.stintIdx + 1;
              const bg = s.cls === "pit" ? "var(--rc-warn)" : isLive ? "var(--rc-brand)" : "#2A171C";
              return (
              <div key={i} style={{ width: `${s.w}%`, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: bg, borderRight: "1px solid var(--rc-surface)" }}>
                <span style={s.w > 5 ? { fontFamily: disp, fontWeight: 700, fontSize: 12, color: s.cls === "pit" ? "var(--rc-bg)" : "var(--rc-text)", letterSpacing: ".04em" } : { display: "none" }}>{s.label}</span>
              </div>
              );
            })}
          </div>

          {/* pilot şeridi: stint segmentleriyle hizalı; aynı pilotun ardışık
              stint'leri (aradaki pit dahil) tek blokta birleşir, farklı pilot
              arasında pit boşluk olur. Canlıda direksiyondaki pilot vurgulanır. */}
          {(st.driverAssign || []).some(Boolean) && (() => {
            const rows = plan.rows;
            const cells = [];
            let i = 0;
            while (i < rows.length) {
              const drv = st.driverAssign[i] || "";
              let w = (rows[i].stintSec / plan.raceSec) * 100;
              let j = i;
              while (j + 1 < rows.length && (st.driverAssign[j + 1] || "") === drv) {
                w += ((rows[j].pitSec || 0) / plan.raceSec) * 100;
                w += (rows[j + 1].stintSec / plan.raceSec) * 100;
                j++;
              }
              const isCur = nowLive && liveInfo.stintIdx >= i && liveInfo.stintIdx <= j;
              cells.push({ type: "drv", w, drv, cur: isCur });
              if (j < rows.length - 1)
                cells.push({ type: "gap", w: ((rows[j].pitSec || 0) / plan.raceSec) * 100 });
              i = j + 1;
            }
            return (
              <div role="img" aria-label={t("Pilot şeridi")} style={{ display: "flex", gap: 0, height: 26, marginTop: 5, borderRadius: 8, overflow: "hidden", border: "1px solid var(--rc-border)" }}>
                {cells.map((c, k) => {
                  const gap = c.type === "gap";
                  return (
                    <div key={k} title={gap ? undefined : (c.drv || t("Atanmadı"))}
                      style={{ width: `${c.w}%`, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderRight: "1px solid var(--rc-surface)", background: gap ? "var(--rc-surface-2)" : driverColorOf(drvNames, c.drv), opacity: gap ? 1 : c.cur ? 1 : 0.62, boxShadow: c.cur ? "inset 0 0 0 2px var(--rc-text)" : "none" }}>
                      <span style={c.w > 6 && !gap ? { fontSize: 11, fontWeight: 600, color: "var(--rc-bg)", whiteSpace: "nowrap" } : { display: "none" }}>{gap ? "" : (c.drv || "—")}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* hava kronolojisi: doğrudan log'dan, yarış süresi üzerinden
              (stint sınırlarından bağımsız → canlı + planlı her geçiş görünür) */}
          {(() => {
            const log = wxLog(st);
            const total = plan.raceSec || parseHMS(st.raceTime) || 1;
            const cuts = [0, ...log.map((e) => e.t).filter((tt) => tt > 0.5 && tt < total - 0.5), total].sort((a, b) => a - b);
            const segs = [];
            for (let i = 0; i < cuts.length - 1; i++) {
              const a = cuts[i], b = cuts[i + 1];
              if (b - a < 0.5) continue;
              segs.push({ w: (b - a) / total * 100, wx: wxAtRel(log, (a + b) / 2) });
            }
            if (!segs.some((x) => x.wx.lap > 1)) return null; // hep dry → çubuk gizli
            return (
              <div role="img" aria-label={t("Hava zaman çizelgesi")} style={{ display: "flex", gap: 0, height: 14, marginTop: 5, borderRadius: 6, overflow: "hidden", border: "1px solid var(--rc-border)" }}>
                {segs.map((s2, i) => (
                  <div key={i} title={`${t(s2.wx.lbl)} ×${s2.wx.lap.toFixed(2)}`}
                    style={{ width: `${s2.w}%`, flex: "0 0 auto", background: s2.wx.col, borderRight: "1px solid var(--rc-surface)" }} />
                ))}
              </div>
            );
          })()}

          {/* şu an çizgisi + etiket (yalnız canlı yarışta) */}
          {nowLive && (<>
            <div style={{ position: "absolute", top: -4, bottom: -4, left: `${nowPct}%`, width: 2, background: "var(--rc-ok)", boxShadow: "0 0 8px rgba(55,214,122,.7)" }} />
            <div style={{ position: "absolute", top: -18, left: `${nowPct}%`, transform: "translateX(-50%)", fontFamily: disp, fontSize: 10, color: "var(--rc-ok)", whiteSpace: "nowrap" }}>{fmtHMS((liveInfo.elapsed || 0) / 1000)}</div>
          </>)}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: disp, fontSize: 10, color: "var(--rc-text-3)" }}>
          {[0, 0.25, 0.5, 0.75, 1].map((f, i) => <span key={i}>{fmtHMS(plan.raceSec * f)}</span>)}
        </div>
      </div>

      {/* --- Plan tablosu --- */}
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderBottom: "1px solid var(--rc-border)", flexWrap: "wrap" }}>
          <span style={sectTtl}>{t("Plan tablosu")}</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table data-tour="stinttable" aria-label={t("Stint plan tablosu")} style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
            <thead><tr>
              <th style={thLeft}>#</th>
              <th style={thLeft}>{t("Stint · tur")}</th>
              <th style={th}>⚡ {t("VE iht.")}</th>
              <th style={thLeft}>{t("Ort. tur")}</th>
              <th style={thLeft}>{t("Pit ayarı")}</th>
              <th style={th}>Pit</th>
              <th style={thLeft}>{t("Pilot")}</th>
              <th style={th}>{t("Bitiş")}</th>
              <th style={th}>{t("Kalan")}</th>
              <th style={thLeft}>Override</th>
            </tr></thead>
            <tbody>
              {plan.rows.map((r, i) => {
                const timeLocked = parseHMS(st.overrides[i] || "") > 0;
                const lapOvr = (Number(st.lapOverrides?.[i]) || 0) > 0;
                const live = nowLive && i === liveInfo.stintIdx;
                const last = r.isLast;
                const ovrTxt = (st.stintLaps || [])[i] || "";
                const ovrBad = !!ovrTxt && !(r.fixLap > 0);
                const fuelOn = (st.pits[i] || EMPTY_PIT).fuel;
                const drv = st.driverAssign[i] || "";
                return (
                  <tr key={i} style={{ background: live ? "rgba(150,0,24,.20)" : "transparent", borderLeft: `3px solid ${live ? "var(--rc-brand-bright)" : last ? "var(--rc-warn)" : "transparent"}` }}>
                    <td style={{ ...tdB, textAlign: "left", width: 54 }}>
                      <span style={{ fontFamily: disp, fontWeight: 700, fontSize: 17, color: live ? "var(--rc-text)" : "var(--rc-text-3)" }}>{r.idx}</span>
                      {live && <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "var(--rc-ok)", marginLeft: 6, boxShadow: "0 0 6px var(--rc-ok)" }} />}
                    </td>
                    <td style={tdLeft}>
                      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <b style={{ fontFamily: disp, fontSize: 14 }}>{fmtHMS(r.stintSec)}</b>
                        {last ? (
                          <b style={lapStyle(lapOvr, timeLocked)}>{r.lapsInStint}</b>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <button style={stepBtn(timeLocked)} disabled={timeLocked}
                              title={timeLocked ? t("Önce süre override'ı temizle") : t("Tur −1")}
                              onClick={() => bumpLaps(i, r.lapsInStint, -1)}>−</button>
                            <b style={lapStyle(lapOvr, timeLocked)}>{r.lapsInStint}</b>
                            <button style={stepBtn(timeLocked)} disabled={timeLocked}
                              title={timeLocked ? t("Önce süre override'ı temizle") : t("Tur +1")}
                              onClick={() => bumpLaps(i, r.lapsInStint, 1)}>+</button>
                            {lapOvr && <button style={lapClearBtn} title={t("Otomatiğe dön")} onClick={() => clearLaps(i)}>✕</button>}
                          </span>
                        )}
                      </span>
                    </td>
                    <td style={{ ...tdB, color: r.fuelNeed > 100 ? "var(--rc-danger)" : "var(--rc-text)" }} title={`≈ ${(r.fuelNeed * st.fuelRatio).toFixed(1)} L`}>{r.fuelNeed.toFixed(1)}%</td>
                    <td style={tdLeft}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <input type="text" value={ovrTxt} placeholder={st.avgLap || "m:ss.00"}
                          onChange={(e) => upStintLap(i, e.target.value)}
                          title={ovrBad
                            ? t("Geçersiz tur süresi — 'm:ss.00' biçiminde yaz (örn. 2:21.0); bu stint yarış ortalamasıyla hesaplanıyor")
                            : r.fixLap > 0
                              ? t("Bu stint girilen tur süresiyle hesaplanıyor — hava çarpanı uygulanmaz")
                              : t("Boş: yarış datasındaki ortalama tur kullanılır")}
                          style={ovrLapStyle(ovrBad)} />
                        {(r.fixLap > 0 || ovrBad) && (
                          <button style={ovrLapClear(ovrBad)} title={t("Otomatiğe dön")} onClick={() => upStintLap(i, "")}>✕</button>
                        )}
                      </span>
                    </td>
                    <td style={tdLeft}>
                      {last ? (
                        <span style={{ display: "inline-block", padding: "3px 12px", borderRadius: 99, border: "1px solid var(--rc-warn)", color: "var(--rc-warn)", fontSize: 11.5 }}>FINISH 🏁</span>
                      ) : (
                        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ display: "flex", gap: 3 }}>
                            {TY.map((corner, ti) => {
                              const stv = tyState((st.pits[i] || EMPTY_PIT).tyres[ti]);
                              return (
                                <button key={corner} style={cornerBtn(stv)} title={t(TY_STATE[stv].title)} onClick={() => upTyre(i, ti)}>{corner}</button>
                              );
                            })}
                          </span>
                          <button style={fuelBtn(fuelOn)} onClick={() => upPit(i, { fuel: !fuelOn })}>FUEL</button>
                          <span title={t("Hasar tamir süresi (s) — plana eklenir")} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--rc-text-3)" }}>🔧
                            <input type="number" min="0" step="1" placeholder="0" value={(st.pitRepairs || [])[i] || ""}
                              onChange={(e) => setRepair?.(i, e.target.value)}
                              style={{ width: 46, background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 7, color: "var(--rc-text)", padding: "4px 6px", fontFamily: disp, fontSize: 11.5, textAlign: "right" }} />
                          </span>
                        </span>
                      )}
                    </td>
                    <td style={tdB}>{last ? "—" : (<>
                      {fmtHMS(r.pitSec)}
                      {r.repairSec > 0 && <span style={{ color: "var(--rc-warn)", fontSize: 11, marginLeft: 4 }}>🔧+{r.repairSec}s</span>}
                    </>)}</td>
                    <td style={tdLeft}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        {drv && (
                          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 6, fontFamily: disp, fontSize: 10.5, fontWeight: 700, color: "var(--rc-bg)", background: driverColorOf(drvNames, drv) }}>{initials(drv)}</span>
                        )}
                        <select value={drv} onChange={(e) => assignDriver(i, e.target.value)}
                          style={{ background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 8, color: "var(--rc-text)", padding: "6px 8px", fontSize: 12 }}>
                          <option value="">—</option>
                          {(st.roster || []).map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </span>
                    </td>
                    <td style={tdB}>{fmtHMS(r.endSec)}</td>
                    <td style={{ ...tdB, color: r.timeLeft < 0 ? "var(--rc-danger)" : "var(--rc-ok)" }}>{fmtHMS(r.timeLeft)}</td>
                    <td style={tdLeft}>
                      <input type="text" placeholder="h:mm:ss" value={st.overrides[i] || ""} disabled={lapOvr}
                        title={lapOvr ? t("Tur override aktif — önce onu temizle") : undefined}
                        onChange={(e) => upOvr(i, e.target.value)} style={ovrStyle(lapOvr)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alt şerit (PIT / Geri al + canlı senkron) KALDIRILDI — PIT işlemi yalnız
         Pit Board penceresinde (kullanıcı isteği). markPit/unmarkPit App'te durur. */}
    </div>
  );
}
