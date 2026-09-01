/* Lastik stratejisi (v2.0 · handoff-spec/ekranlar/06-lastik.md). Limit sayacı +
   set envanteri + köşe bazlı atama tablosu + hızlı atama + çakışma uyarısı.
   Türetilmiş tyreInfo/racePlan ve handler'lar App'ten prop gelir. */
import { useEffect, useState } from "react";
import { Icon } from "../components";
import { liveTyreSubscribe, liveLapsSubscribe, liveWearSubscribe } from "../storage";
import { buildLedger, ledgerSummary, planChanges, comparePlan } from "../tyreLedger";
import { planTread, changeTimeOf, totalChangeTime, measuredWear } from "../tyrePlanCalc";
import { wearSeries, wearRates, limitingCorner, lapsLeft, RECENT_LAPS } from "../lapWear";
import { CORNER_LBL } from "../tyreInfo";

const TY = ["FL", "FR", "RL", "RR"];
const TY_COL = { "": "#37D67A", t2: "#F2C94C", tq: "#4D9FFF", t3: "#F0604D", t4: "#B91C1C", tw: "#7FE3A0", terr: "var(--rc-danger)" };
const colOf = (cls) => TY_COL[cls] ?? "#37D67A";
/* Kalan diş → renk. TinyPedal 9 kademe kullanıyor; okunabilirlik için 5'e
   indirildi (aynı yeşil→kırmızı yön). */
const treadCol = (v) => (v > 0.75 ? "#37D67A" : v > 0.55 ? "#9ACD32"
  : v > 0.35 ? "#F2C94C" : v > 0.15 ? "#F0904D" : "#F0604D");

/* Trend eşiği: son pencere hızı dönem ortalamasından bu oranda saparsa "hızlanıyor/
   yavaşlıyor" yazılır. Salt GÖSTERİM eşiğidir (veri değil) — altında kalan fark
   ölçüm gürültüsünden ayırt edilemeyeceği için sessiz geçilir. */
const TREND_EPS = 0.15;

/* Hamur → şerit rengi. Oyun hamuru yalnız ÖN/ARKA verir (köşe başına YOK), o
   yüzden defter tek hamur metni taşır; "Ön/Arka" biçimindeki karma değerlerde
   ilk kelimeye bakılır. Tanınmayan hamur nötr renk alır — uydurma eşleme yok. */
const COMP_COL = (comp) => {
  const c = String(comp || "").toLowerCase();
  if (c.includes("wet") || c.includes("rain")) return "#4D9FFF";
  if (c.includes("soft")) return "#F0604D";
  if (c.includes("hard")) return "#E7E7E7";
  if (c.includes("medium")) return "#F2C94C";
  return "var(--rc-border-strong)";
};

export default function TyreTab({
  t, st, up, tyreInfo, racePlan, carriedAt, upTyreCell, quickTyre,
  qsel, setQsel, QSEL_LBL, clearTyres, tid, rid, lapKey,
  ownTyres, lastLapNo, stintLaps,
}) {
  /* ---- LASTİK DEFTERİ (v2.3.0) — kendi kendini dolduran GERÇEK kayıt ----
     Köprü her pit değişimini `livetyre/{rid}/{araç}/{tur}` olarak zaten yazıyor
     (bridge/harvest.py); bu ekran onu ilk kez okuyor. Elle giriş yok. */
  const [tyreLog, setTyreLog] = useState(null);
  const [lapMap, setLapMap] = useState(null);
  /* TUR BAŞI AŞINMA (v2.3.1): köprü her turun dört köşe dişini `livewear`e yazar
     (harvest.py / liveBridge.js). Kaynak `tyres4` zaten canlı karede olduğu için
     oyun PC'sine yeni okuma/istek eklenmedi. */
  const [wearLog, setWearLog] = useState(null);
  useEffect(() => {
    if (!tid || !rid || !lapKey) {
      setTyreLog(null); setLapMap(null); setWearLog(null); return undefined;
    }
    const a = liveTyreSubscribe(tid, rid, lapKey, setTyreLog);
    const b = liveLapsSubscribe(tid, rid, lapKey, setLapMap);
    const c = liveWearSubscribe(tid, rid, lapKey, setWearLog);
    return () => { a(); b(); c(); };
  }, [tid, rid, lapKey]);
  const ledger = buildLedger(tyreLog, lapMap);
  const sum = ledgerSummary(ledger);
  /* PLAN ↔ GERÇEK (adım 2). Plan için yeni model YOK — mevcut gridden türetilir
     (boş hücre = taşı, dolu hücre = pit işlemi). Eşleme SIRAYLA: planda tur
     numarası olmadığı için tur-hassas hizalama mümkün değil. */
  const plan = planChanges(st.tyreStints);
  const cmp = comparePlan(plan, ledger);
  const cmpOff = cmp.filter((r) => r.state === "diff" || r.state === "extra").length;

  /* ---- DİŞ + DEĞİŞİM SÜRESİ (TinyPedal tyre_strategy_planner deseni) ---- */
  const wearPct = Number(st.tyreWearPerStint);
  const wear = Number.isFinite(wearPct) && wearPct > 0 ? wearPct / 100 : 0;
  const t12 = Number.isFinite(Number(st.tyreChangeT12)) ? Number(st.tyreChangeT12) : 4.5;
  const t34 = Number.isFinite(Number(st.tyreChangeT34)) ? Number(st.tyreChangeT34) : 12;
  const tread = planTread(st.tyreQual, st.tyreStints, wear);
  const changeSum = totalChangeTime(plan, t12, t34);
  /* ÖLÇÜLEN aşınma: TinyPedal bu sayıyı kullanıcıya yazdırır, biz canlı
     telemetriden ölçüyoruz. Yalnız taze setle başlayan ve süren dönemde. */
  const openPeriod = ledger.length ? ledger[ledger.length - 1] : null;
  const meas = measuredWear(openPeriod, ownTyres, lastLapNo, stintLaps);

  /* ---- TUR BAŞI AŞINMA (v2.3.1) ---- köşe başına GERÇEK tur farklarından.
     `measuredWear`den iki farkı var: (1) dört köşeyi "en kötü"ye indirmez,
     (2) hızı anlık dişten değil tur-tur seriden çıkarır → son pencereyle
     degradasyonun hızlanıp hızlanmadığı da okunur. */
  const wSeries = wearSeries(wearLog);
  const wRates = wearRates(wSeries);
  const wLim = limitingCorner(wSeries);
  const slaps = Number(stintLaps);
  /* Öneri kaynağı: tur-tur kayıt VARSA o kullanılır (gerçek tur farkı, köşe
     ayrışmış). Yoksa eski anlık ölçüme düşülür — eski köprüde ya da kayıt
     henüz birikmemişken buton kaybolmasın. */
  const suggest = (wLim && slaps > 0)
    ? { pct: wLim.perLap * slaps, laps: wLim.laps, tread: wLim.tread,
      corner: wLim.corner, live: true }
    : (meas && meas.perStint != null
      ? { pct: meas.perStint, laps: meas.laps, tread: meas.tread,
        corner: null, live: false }
      : null);
  const limit = Math.max(0, st.tyreLimit);
  const wetCount = tyreInfo.rows.reduce((n, r) => n + r.vals.filter((v) => String(v).trim() === "W").length, 0);
  const lockCorner = (id) => {
    for (const r of tyreInfo.rows) { const ci = r.vals.findIndex((v) => String(v).trim() === id); if (ci >= 0) return TY[ci]; }
    return "";
  };

  const card = { border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)" };
  const kpi = { flex: "1 1 150px", ...card, padding: "13px 16px" };
  const kpiL = { color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em" };
  const bigV = { fontFamily: "var(--rc-font-display)", fontSize: 36, fontWeight: 700, lineHeight: 1.1 };
  const hdT = { fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 14, fontWeight: 700 };
  const th = (left) => ({ textAlign: left ? "left" : "center", padding: "9px 14px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--rc-text-3)", borderBottom: "1px solid var(--rc-border)", whiteSpace: "nowrap" });

  return (
    <div style={{ padding: "2px 0 8px", fontFamily: "var(--rc-font-ui)", animation: "rcin .26s ease-out" }} data-tour="tyrecard">
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".06em", fontSize: 22, fontWeight: 700 }}>{t("Lastik stratejisi")}</h2>
        <span style={{ fontSize: 12, color: "var(--rc-text-3)" }}>{t("Bir lastik ilk takıldığı köşeye kilitlenir · wet limitten bağımsız")}</span>
        <button onClick={clearTyres} style={{ marginLeft: "auto", padding: "8px 14px", borderRadius: 9, cursor: "pointer", border: "1px solid var(--rc-danger)", background: "transparent", color: "var(--rc-danger)", fontSize: 12.5 }}>{t("Tümünü temizle")}</button>
      </div>

      {/* KPI kartları */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: "1 1 190px", ...card, padding: "13px 16px" }}>
          <div style={{ ...kpiL, marginBottom: 8 }}>{t("Lastik limiti")}</div>
          <div style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--rc-border)", borderRadius: 10, overflow: "hidden" }}>
            <button onClick={() => up({ tyreLimit: Math.max(0, limit - 1) })} style={{ width: 34, height: 38, border: "none", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 15 }}>−</button>
            <b style={{ minWidth: 52, textAlign: "center", fontFamily: "var(--rc-font-display)", fontSize: 26, fontWeight: 700 }}>{limit}</b>
            <button onClick={() => up({ tyreLimit: Math.min(40, limit + 1) })} style={{ width: 34, height: 38, border: "none", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 15 }}>+</button>
          </div>
        </div>
        <div style={kpi}><div style={kpiL}>{t("Kullanılan")}</div><div style={bigV}>{tyreInfo.used}</div></div>
        <div style={{ ...kpi, border: `1px solid ${tyreInfo.available < 0 ? "var(--rc-danger)" : "var(--rc-border)"}` }}><div style={kpiL}>{t("Kalan")}</div><div style={{ ...bigV, color: tyreInfo.available < 0 ? "var(--rc-danger)" : "var(--rc-ok)" }}>{tyreInfo.available}</div></div>
        <div style={kpi}><div style={kpiL}>{t("Stint sayısı")}</div><div style={bigV}>{racePlan.fullStints}</div></div>
        <div style={kpi}><div style={kpiL}>{t("Wet · limitsiz")}</div><div style={{ ...bigV, color: wetCount ? "#7FE3A0" : "var(--rc-border-strong)" }}>{wetCount}</div></div>
        {/* AŞINMA AYARI (v2.3.0) — plandaki diş hesabını besler. TinyPedal bu
            sayıyı hamur başına ELLE yazdırır; bizde canlı telemetriden ölçülen
            değer öneri olarak sunulur (tek tık uygular), otomatik YAZILMAZ. */}
        <div style={{ flex: "1 1 210px", ...card, padding: "13px 16px" }}>
          <div style={{ ...kpiL, marginBottom: 8 }}>{t("Stint başına aşınma")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--rc-border)", borderRadius: 10, overflow: "hidden" }}>
              <button onClick={() => up({ tyreWearPerStint: Math.max(0, wearPct - 5) })}
                style={{ width: 30, height: 34, border: "none", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 15 }}>−</button>
              <b style={{ minWidth: 54, textAlign: "center", fontFamily: "var(--rc-font-display)", fontSize: 20, fontWeight: 700 }}>%{wearPct || 0}</b>
              <button onClick={() => up({ tyreWearPerStint: Math.min(100, wearPct + 5) })}
                style={{ width: 30, height: 34, border: "none", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 15 }}>+</button>
            </div>
            {suggest && (
              <button onClick={() => up({ tyreWearPerStint: Math.round(suggest.pct * 100) })}
                title={[
                  suggest.live
                    ? `${t("Tur tur diş kaydından ölçüldü")} (${suggest.laps} ${t("tur")})`
                    : `${t("Canlı ölçüm")}: ${suggest.laps} ${t("tur")}`,
                  suggest.corner
                    ? `${t("Belirleyen köşe")}: ${t(CORNER_LBL[suggest.corner])}`
                    : "",
                  `${t("kalan diş")} %${Math.round(suggest.tread * 100)}`,
                ].filter(Boolean).join("\n")}
                style={{ padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontSize: 11.5,
                  border: "1px solid var(--rc-ok)", background: "transparent", color: "var(--rc-ok)" }}>
                {t("ölçülen")} %{Math.round(suggest.pct * 100)} →
              </button>
            )}
          </div>
          {!!changeSum && (
            <div style={{ fontSize: 11, color: "var(--rc-text-3)", marginTop: 7 }}>
              {t("Plandaki lastik değişimi")}: <b style={{ color: "var(--rc-warn)" }}>+{changeSum.toFixed(1)}s</b>
            </div>
          )}
        </div>
      </div>

      {/* ---- TUR BAŞI AŞINMA (v2.3.1) — köşe başına GERÇEK ölçüm ----
           Kaynak: köprünün her tur yazdığı dört köşe dişi (livewear). Bu kart
           `measuredWear`in iki kör noktasını kapatır: köşeleri "en kötü"ye
           indirmesi ve hızı tur-tur değil anlık dişten çıkarması. */}
      <div style={{ ...card, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 11 }}>
          <span style={hdT}>{t("Tur başı aşınma")}</span>
          <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>
            {t("her turun diş kaydından ölçülür — elle giriş yok")}</span>
          {wLim && wLim.left != null && (
            <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--rc-warn)" }}>
              {t("Pit penceresini belirleyen")}: <b>{t(CORNER_LBL[wLim.corner])}</b>
              {` · ~${Math.round(wLim.left)} ${t("tur")}`}
            </span>
          )}
        </div>
        {!wSeries.length ? (
          <div style={{ fontSize: 12.5, color: "var(--rc-text-3)", padding: "6px 0" }}>
            {t("Henüz diş kaydı yok — köprü çalışırken her tamamlanan tur buraya kendiliğinden düşer.")}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {wRates.map((r) => {
                const left = r.perLap != null ? lapsLeft(r.tread, r.perLap) : null;
                const trend = (r.perLap != null && r.recent != null)
                  ? (r.recent > r.perLap * (1 + TREND_EPS) ? "up"
                    : r.recent < r.perLap * (1 - TREND_EPS) ? "down" : "flat")
                  : null;
                return (
                  <div key={r.corner} style={{ flex: "1 1 150px", borderRadius: 10, padding: "10px 12px",
                    border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 10.5, color: "var(--rc-text-3)", textTransform: "uppercase", letterSpacing: ".06em" }}>
                        {t(CORNER_LBL[r.corner])}</span>
                      {r.tread != null && (
                        <span style={{ marginLeft: "auto", fontFamily: "var(--rc-font-display)",
                          fontSize: 13, fontWeight: 700, color: treadCol(r.tread) }}>
                          %{Math.round(r.tread * 100)}</span>
                      )}
                    </div>
                    {r.perLap == null ? (
                      <div style={{ fontSize: 11.5, color: "var(--rc-border-strong)" }}
                        title={t("Bu köşede henüz iki geçerli tur okuması yok — hız üretilmiyor")}>—</div>
                    ) : (
                      <>
                        <div style={{ fontFamily: "var(--rc-font-display)", fontSize: 18, fontWeight: 700 }}>
                          %{(r.perLap * 100).toFixed(2)}
                          <span style={{ fontSize: 11, color: "var(--rc-text-3)", fontWeight: 400 }}> /{t("tur")}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--rc-text-3)", marginTop: 3 }}>
                          {left != null ? `~${Math.round(left)} ${t("tur kaldı")}` : "—"}
                        </div>
                        {trend && trend !== "flat" && (
                          <div style={{ fontSize: 10.5, marginTop: 3,
                            color: trend === "up" ? "var(--rc-danger)" : "var(--rc-ok)" }}
                            title={`${t("Son")} ${RECENT_LAPS} ${t("tur")}: %${(r.recent * 100).toFixed(2)}`}>
                            {trend === "up" ? `↑ ${t("hızlanıyor")}` : `↓ ${t("yavaşlıyor")}`}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: "var(--rc-text-3)", marginTop: 10, lineHeight: 1.5 }}>
              {t("Aşınma hızı GERÇEK okumadır (turlar arası diş farkı). KALAN TUR, hızın sabit kalacağı varsayımıyla modellenmiş tahmindir — gerçek okuma değil; diş %0'a inene kadar hesaplanır. Lastik değişimi serinin kendisinden okunur (diş artışı), pit kaydından tahmin edilmez: 2 lastik değiştiğinde yalnız o köşeler sıfırlanır.")}
            </div>
          </>
        )}
      </div>

      {/* ---- LASTİK DEFTERİ (gerçek) ---- */}
      <div style={{ ...card, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 11 }}>
          <span style={hdT}>{t("Lastik defteri")}</span>
          <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>
            {t("yarıştaki GERÇEK lastik değişimleri — elle giriş yok")}</span>
          {!!ledger.length && (
            <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--rc-text-3)" }}>
              {sum.fullSets} {t("tam set")} · {sum.axleChanges} {t("aks")} · {sum.fuelOnly} {t("yakıt-only")}
            </span>
          )}
        </div>
        {!ledger.length ? (
          <div style={{ fontSize: 12.5, color: "var(--rc-text-3)", padding: "6px 0" }}>
            {t("Henüz kayıt yok — köprü çalışırken pit değişimleri buraya kendiliğinden düşer.")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ledger.map((r) => {
              const col = COMP_COL(r.comp);
              /* Şerit genişliği tur sayısıyla orantılı → uzun stint göz kararı okunur. */
              const w = Math.max(6, Math.round((r.laps / Math.max(1, sum.totalLaps)) * 100));
              return (
                <div key={r.idx} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ minWidth: 78, fontFamily: "var(--rc-font-display)", fontSize: 12.5, color: "var(--rc-text-2)" }}>
                    {t("Tur")} {r.fromLap}–{r.toLap}</span>
                  {/* Dönem başında ne takıldı: YENİ (4) · 2 AKS · Başlangıç (bilinmiyor) */}
                  <span className="chip" style={{ fontSize: 10,
                    color: r.fresh ? "var(--rc-ok)" : r.partial ? "var(--rc-warn)" : "var(--rc-text-3)",
                    borderColor: r.fresh ? "var(--rc-ok)" : r.partial ? "var(--rc-warn)" : "var(--rc-border-strong)" }}
                    title={r.n == null
                      ? t("Yarış başındaki set — oyun ne takıldığını söylemiyor")
                      : `${r.n} ${t("lastik takıldı")}`}>
                    {r.n == null ? t("Başlangıç") : r.fresh ? t("YENİ") : `${r.n} ${t("aks")}`}</span>
                  <span style={{ flex: `0 0 ${w}%`, minWidth: 30, height: 10, borderRadius: 5,
                    background: col, opacity: r.fresh ? 1 : 0.72 }}
                    title={r.comp || t("hamur bilinmiyor")} />
                  <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>
                    {r.laps} {t("tur")}{r.comp ? ` · ${r.comp}` : ""}
                    {r.fuelOnly ? ` · ${r.fuelOnly} ${t("yakıt-only")}` : ""}
                    {r.open ? ` · ${t("sürüyor")}` : ""}</span>
                </div>
              );
            })}
          </div>
        )}
        {/* ---- PLAN ↔ GERÇEK ---- yalnız ikisi de varken anlamlı */}
        {!!cmp.length && !!ledger.length && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--rc-border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 9 }}>
              <span style={{ ...hdT, fontSize: 12 }}>{t("Plan ↔ Gerçek")}</span>
              <span style={{ fontSize: 11.5, color: cmpOff ? "var(--rc-warn)" : "var(--rc-ok)" }}>
                {cmpOff ? `${cmpOff} ${t("sapma")}` : t("plana uyuyor")}</span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {cmp.map((r) => {
                const col = r.state === "match" ? "var(--rc-ok)"
                  : r.state === "diff" ? "var(--rc-warn)"
                    : r.state === "extra" ? "var(--rc-danger)" : "var(--rc-border-strong)";
                const lbl = r.state === "pending" ? t("bekliyor")
                  : r.state === "extra" ? t("planda yok")
                    : `${r.plan.n} → ${r.actual.n}`;
                return (
                  <span key={r.i} className="chip" style={{ fontSize: 10.5, color: col, borderColor: col }}
                    title={[
                      r.plan ? `${t("Plan")}: S${r.plan.stint} · ${r.plan.n} ${t("lastik")}` : t("Planda karşılığı yok"),
                      r.actual ? `${t("Gerçek")}: ${t("tur")} ${r.actual.fromLap} · ${r.actual.n} ${t("lastik")}` : t("Henüz gerçekleşmedi"),
                    ].join("\n")}>
                    {r.i + 1}. {lbl}
                  </span>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: "var(--rc-text-3)", marginTop: 8, lineHeight: 1.5 }}>
              {t("Plan mevcut tablodan türetilir (dolu hücre = pit işlemi). Planda tur numarası olmadığı için eşleme SIRAYLA yapılır, tur-hassas değildir.")}
            </div>
          </div>
        )}
        <div style={{ fontSize: 11, color: "var(--rc-text-3)", marginTop: 10, lineHeight: 1.5 }}>
          {t("Oyun lastik SET KİMLİĞİ vermiyor; defter pit olaylarından türetilir. Hamur yalnız ön/arka okunabilir, köşe başına değil.")}
        </div>
      </div>

      {/* Set envanteri */}
      <div style={{ ...card, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 11 }}>
          <span style={hdT}>{t("Set envanteri")}</span>
          <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{t("her setin kullanım sayısı ve kilitli köşesi")}</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Array.from({ length: limit }, (_, i) => {
            const id = String(i + 1);
            const uses = tyreInfo.counts[id] || 0;
            const col = colOf(tyreInfo.cellCls(id));
            const corner = lockCorner(id);
            return (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, border: `1px solid ${uses ? col : "var(--rc-border)"}`, background: uses ? "rgba(255,255,255,.04)" : "var(--rc-surface-3)", opacity: uses ? 1 : .55 }}>
                <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 19, fontWeight: 700, lineHeight: 1 }}>{id}</b>
                <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 10.5, color: corner ? "var(--rc-text-2)" : "var(--rc-border-strong)", letterSpacing: ".04em" }}>{corner || t("boş")}</span>
                <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 11, fontWeight: 600, color: uses ? col : "var(--rc-border-strong)" }}>{uses ? `${uses}×` : "—"}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Atama tablosu */}
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table aria-label={t("Lastik strateji tablosu")} style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead><tr>
              <th style={th(true)}>Stint</th>{TY.map((c) => <th key={c} style={th()}>{c}</th>)}
              <th style={th()} title={t("Bu stintte lastik değiştirmenin pit süresine maliyeti")}>{t("Değişim")}</th>
              <th style={th(true)}>{t("Hızlı atama")}</th>
            </tr></thead>
            <tbody>
              {tyreInfo.rows.map((r) => (
                <tr key={r.label} style={{ background: r.row === -1 ? "rgba(76,154,255,.06)" : "transparent" }}>
                  <td style={{ padding: "9px 14px", borderBottom: "1px solid var(--rc-line-soft)", textAlign: "left", fontFamily: "var(--rc-font-display)", fontSize: 17, fontWeight: 700, whiteSpace: "nowrap" }}>{r.label}</td>
                  {r.vals.map((v, ci) => {
                    const empty = !String(v).trim();
                    const carried = r.row >= 0 && empty ? carriedAt(r.row, ci) : "";
                    const cls = tyreInfo.cellCls(v);
                    const col = colOf(cls);
                    const err = cls === "terr";
                    return (
                      <td key={ci} style={{ padding: "7px 8px", borderBottom: "1px solid var(--rc-line-soft)", textAlign: "center" }}>
                        <select value={String(v)} onChange={(e) => upTyreCell(r.row, ci, e.target.value)}
                          style={{ minWidth: 62, padding: "8px 10px", borderRadius: 9, cursor: "pointer", fontFamily: "var(--rc-font-display)", fontSize: 14, fontWeight: 600, textAlign: "center",
                            border: err ? "2px solid var(--rc-danger)" : empty ? "1px dashed var(--rc-border-strong)" : `1px solid ${col}`,
                            background: empty ? "transparent" : `${col}2E`, color: empty ? (carried ? "var(--rc-text-3)" : "var(--rc-border-strong)") : col }}>
                          <option value="">{carried ? `⟳ ${carried}` : "—"}</option>
                          <option value="W" style={{ background: "#0C3A1F", color: "#7FE3A0" }}>🌧 W</option>
                          {Array.from({ length: limit }, (_, n) => {
                            const k = String(n + 1);
                            const cur = String(v).trim() === k;
                            if (!cur && !tyreInfo.allowedIn(k, ci)) return null;
                            const c = tyreInfo.counts[k] || 0;
                            return <option key={k} value={k}>{k}{c > 0 ? ` · ${c}×` : ""}</option>;
                          })}
                        </select>
                        {/* DİŞ (v2.3.0): "Yeni-%70" / "%70-%40". Kullanıcının asıl
                            sorusu — hangi stint YENİ lastik kullanıyor — burada
                            birebir yazıyor. Wet hücrelerinde gösterilmez (W bir
                            set değil, yer tutucu). */}
                        {(() => {
                          const tr = tread[r.row + 1] && tread[r.row + 1][ci];
                          if (!tr || !wear) return null;
                          return (
                            <div style={{ fontSize: 9.5, marginTop: 3, whiteSpace: "nowrap",
                              fontFamily: "var(--rc-font-display)",
                              color: tr.blowout ? "var(--rc-danger)" : treadCol(tr.end) }}
                              title={tr.blowout
                                ? t("Plan bu seti kapasitesinin ötesinde çalıştırıyor")
                                : `${t("Bu setin")} ${tr.uses + 1}. ${t("stinti")}`}>
                              {tr.blowout ? t("PATLAK")
                                : `${tr.fresh ? t("Yeni") : `%${Math.round(tr.start * 100)}`}–%${Math.round(tr.end * 100)}`}
                            </div>
                          );
                        })()}
                      </td>
                    );
                  })}
                  {/* Değişim süresi: 1–2 lastik ucuz (tek taraf), 3–4 pahalı. */}
                  <td style={{ padding: "9px 8px", borderBottom: "1px solid var(--rc-line-soft)", textAlign: "center", fontFamily: "var(--rc-font-display)", fontSize: 12 }}>
                    {(() => {
                      if (r.row < 0) return <span style={{ color: "var(--rc-border-strong)" }}>—</span>;
                      const n = r.vals.filter((v) => String(v ?? "").trim()).length;
                      const sec = changeTimeOf(n, t12, t34);
                      if (!sec) return <span style={{ color: "var(--rc-border-strong)" }}>—</span>;
                      return <span style={{ color: "var(--rc-warn)" }} title={`${n} ${t("lastik")}`}>+{sec.toFixed(1)}s</span>;
                    })()}
                  </td>
                  <td style={{ padding: "9px 14px", borderBottom: "1px solid var(--rc-line-soft)" }}>
                    {r.row >= 0 && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <select value="" onChange={(e) => { if (e.target.value) { quickTyre(r.row, e.target.value); setQsel((q) => ({ ...q, [r.row]: e.target.value })); } }}
                          style={{ width: 140, textAlign: "left", padding: "7px 10px", borderRadius: 9, cursor: "pointer", fontSize: 12, background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", color: "var(--rc-text-2)" }}>
                          <option value="">⚡ {t("Hızlı atama")}</option>
                          <option value="new4" disabled={tyreInfo.available < 4}>{t("4 yeni")}</option>
                          <option value="wet4">{t("4 wet")}</option>
                          <option value="qual4">{t("Qual'a dön")}</option>
                          <option value="carry">⟳ {t("Devam")}</option>
                          <option value="fronts" disabled={tyreInfo.available < 2}>{t("2 yeni ön")}</option>
                          <option value="rears" disabled={tyreInfo.available < 2}>{t("2 yeni arka")}</option>
                          <option value="lefts" disabled={tyreInfo.available < 2}>{t("2 yeni sol")}</option>
                          <option value="rights" disabled={tyreInfo.available < 2}>{t("2 yeni sağ")}</option>
                          <optgroup label={t("Tek teker")}>
                            {[["fl", "FL"], ["fr", "FR"], ["rl", "RL"], ["rr", "RR"]].map(([vv, l]) => (
                              <option key={vv} value={vv} disabled={tyreInfo.available < 1}>{l} {t("yeni")}</option>
                            ))}
                          </optgroup>
                          <option value="clear">✕ {t("Temizle")}</option>
                        </select>
                        {qsel[r.row] && (
                          <span style={{ fontSize: 10.5, padding: "3px 9px", borderRadius: 99, border: "1px solid var(--rc-border-strong)", color: "var(--rc-text-3)", whiteSpace: "nowrap" }}>{t(QSEL_LBL[qsel[r.row]] || qsel[r.row])}</span>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", padding: "11px 16px", borderTop: "1px solid var(--rc-border)", background: "var(--rc-surface-2)" }}>
          {[["Yeni kuru (1×)", "#37D67A"], ["2× tekrar", "#F2C94C"], ["Qual'a dönüş", "#4D9FFF"], ["3× tekrar", "#F0604D"], ["4×+ aşırı", "#B91C1C"], ["Wet · limitsiz", "#7FE3A0"]].map(([lbl, c]) => (
            <span key={lbl} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--rc-text-2)" }}><i style={{ width: 10, height: 10, borderRadius: 3, display: "inline-block", flex: "0 0 auto", background: c }} />{t(lbl)}</span>
          ))}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--rc-text-2)" }}><i style={{ width: 10, height: 10, borderRadius: 3, display: "inline-block", flex: "0 0 auto", background: "transparent", border: "1px dashed var(--rc-text-3)" }} />⟳ {t("önceki setle devam")}</span>
          <button onClick={clearTyres} style={{ marginLeft: "auto", padding: "8px 14px", borderRadius: 9, border: "1px solid var(--rc-border-strong)", background: "var(--rc-surface-3)", color: "var(--rc-text-3)", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}>✕ {t("Seçimleri temizle")}</button>
        </div>
      </div>

      {tyreInfo.conflicts.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 14px", borderRadius: 11, border: "1px solid var(--rc-danger)", background: "rgba(255,77,94,.08)", fontSize: 12, color: "#FFC9C0", lineHeight: 1.6 }}>
          <span style={{ flex: "0 0 auto", fontSize: 14 }}><Icon name="uyari" size={14} /></span>
          <span>{t("Köşe kuralı ihlali")} — <b>{tyreInfo.conflicts.join(", ")}</b> {t("birden fazla köşede kullanılmış. Bir lastik ilk takıldığı köşeye kilitlenir; hatalı hücreyi düzelt.")}</span>
        </div>
      )}
    </div>
  );
}
