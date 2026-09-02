/* Strateji Karşılaştırma — YARIŞ ÖNCESİ karar aracı (v2.4.0).

   Kaynak: takımın kendi Excel'i (Caspian Motorsport Race Control v1.28),
   "TEAMS STRATEGY" (takım kayıt defteri) + "STRATEGY COMP" (karşılaştırma)
   sayfaları. Ekran o iki sayfanın işini yapar: hesap `stratComp.js`'te (saf,
   46 test), burada yalnız giriş ve gösterim var.

   OYUN PC'Sİ: bu sekme yarış sırasında kullanılmaz, canlı kareye ve köprüye
   hiç dokunmaz (CLAUDE.md §0 — yeni REST/thread/hız yok).

   EXCEL'DEN GÖRÜNÜR ÜÇ SAPMA (hepsi veri dürüstlüğü, CLAUDE.md §1):

   1) KAZANAN ADIYLA YAZILIR, renge bırakılmaz. Excel'de koşullu biçim
      "negatif → yeşil" idi ve tüm deltalar (sol − sağ) yönündeydi; kullanıcının
      kendi takımı sağdaki panelde olduğu için TOTAL RESULT −13.9 (rakip önde)
      YEŞİL, STRATEGY RESULT +47 (biz öndeyiz) KIRMIZI görünüyordu. Burada
      sonuç cümlesi hangi takımın kaç saniye önde olduğunu yazar; renk yalnız
      o cümleyi tekrarlar.

   2) EKSİK ALAN SAYIYA ÇEVRİLMEZ. Excel'in XLOOKUP'larında if_not_found yoktu;
      defterdeki 25 takımın 23'ü boş olduğu için biri seçilince ortalama tur 0
      sanılıyor ve 174 turluk yarışta −21.867 sn'lik (≈ −6 saat) uydurma bir
      sonuç çıkıyordu. Burada eksik alanlar adıyla listelenir, hiçbir sayı
      gösterilmez.

   3) SEÇİCİ TÜM DEFTERİ GÖSTERİR. Excel'in açılır listesi A2:A25'e bağlıydı
      ama takımlar A26'ya kadar gidiyordu → son takım (#306) hiç seçilemiyordu. */
import { useMemo } from "react";
import { Icon } from "../components";
import { teamTime, compareTeams, rankTeams, suggestedLaps, fmtLapMs, strategyOptions } from "../stratComp";
import { stratPick } from "../state";
import { fmtDur } from "../engine";

/* Kayıt defteri sütunları — Excel'in TEAMS STRATEGY başlıklarıyla aynı sırada.
   `w` genişlik, `step` sayı adımı, `lap` alanı serbest metindir (m:ss.mmm). */
const COLS = [
  { k: "pits", lbl: "Pit", w: 52, step: "1", hint: "Durak sayısı" },
  { k: "stints", lbl: "Stint", w: 56, step: "1", hint: "Stint sayısı (= pit + 1)" },
  { k: "pitLane", lbl: "Pit yolu", w: 64, step: "0.1", hint: "Pit yolu geçiş süresi (sn)" },
  { k: "fuelFull", lbl: "Yakıt (tam)", w: 74, step: "0.1", hint: "Tam servis yakıt süresi (sn)" },
  { k: "fuelLast", lbl: "Yakıt (son pit)", w: 88, step: "0.1", hint: "Son durakta yalnız bitirmeye yetecek yakıt alınır — kısa sürer" },
  { k: "tyreTime", lbl: "Lastik süresi", w: 82, step: "0.1", hint: "Bir değişimin süresi (sn)" },
  { k: "tyreCount", lbl: "Lastik adedi", w: 78, step: "1", hint: "Lastik değişen durak sayısı" },
  { k: "avgLap", lbl: "Ort. tur", w: 82, lap: true, hint: "m:ss.mmm" },
  { k: "penalty", lbl: "Ceza süresi", w: 76, step: "1", hint: "Ceza süresi (sn) — boş = ceza yok" },
  { k: "damage", lbl: "Hasar süresi", w: 80, step: "1", hint: "Hasar/tamir süresi (sn) — boş = hasar yok" },
  { k: "ballast", lbl: "Balast", w: 62, step: "0.1", hint: "Bilgi amaçlı — hesaba GİRMEZ (oyun kg → sn/tur karşılığını vermiyor)" },
];

const card = {
  background: "var(--rc-surface-2)", border: "1px solid var(--rc-border)",
  borderRadius: "var(--rc-r-12)", padding: "var(--rc-sp-14)", marginBottom: "var(--rc-sp-14)",
};
const capLbl = {
  color: "var(--rc-text-3)", fontSize: "var(--rc-fs-10)", textTransform: "uppercase",
  letterSpacing: "var(--rc-ls-label)", fontWeight: 700,
};
const th = {
  ...capLbl, textAlign: "right", padding: "6px 8px", whiteSpace: "nowrap",
  borderBottom: "1px solid var(--rc-border)",
};
const td = { padding: "5px 8px", textAlign: "right", fontFamily: "var(--rc-font-mono)", fontSize: "var(--rc-fs-12)" };

/* Saniye → "+12.3" / "−12.3" (işaret her zaman görünür; sıfır işaretsiz).
   fmtDur işaretsiz olduğu için işaret burada eklenir — negatif farkı
   "—" göstermek karşılaştırmayı okunmaz yapardı. */
const signed = (v) => {
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v) < 0.05) return "0.0";
  return `${v > 0 ? "+" : "−"}${fmtDur(Math.abs(v))}`;
};
/* Mutlak süre — toplam yarış süresi gibi büyük değerler için h:mm:ss. */
const hms = (v) => {
  if (!Number.isFinite(v)) return "—";
  const s = Math.round(v);
  const h = Math.floor(s / 3600), m = Math.floor((s - h * 3600) / 60), r = s - h * 3600 - m * 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
    : `${m}:${String(r).padStart(2, "0")}`;
};

export default function StratCompTab({ t, st, plan, readOnly = false,
  tracks = [], carClasses = [], trackDefs = {}, lmuReady = false,
  onLaps, onTrack, onClass, onAdd, onUp, onDel, onSeed, onPick }) {
  const teams = Array.isArray(st.stratTeams) ? st.stratTeams : [];
  const laps = st.stratLaps;
  /* Seçili indeksler state.stratPick'ten — kural TEK yerde. Satır silinmiş
     eski kayıtta ya da bozuk değerde 0'a düşer; kırpılmadan stratTeams[-1]
     okunurdu. */
  const iA = stratPick(st, "stratA");
  const iB = stratPick(st, "stratB");
  const cmp = useMemo(() => compareTeams(teams[iA], teams[iB], laps), [teams, iA, iB, laps]);
  const rank = useMemo(() => rankTeams(teams, laps), [teams, laps]);
  const sugg = suggestedLaps(plan);
  const opts = strategyOptions(st);
  /* İki satırın ortalama turu BİREBİR aynıysa fark yalnız pit/yakıt/lastikten
     gelir. Bu, iki planı da uygulamadan tohumlayınca olağan durumdur:
     computePlan tek bir efektif tur süresi kullanır, yakıt yükünün ve lastik
     yaşının turu yavaşlatmasını MODELLEMEZ. Söylenmezse araç "az durak hep
     kazanır" der — uzun stintin gerçek bedeli görünmez (CLAUDE.md §1:
     modellenmeyen şey etiketlenir). */
  const samePace = cmp.ok && cmp.a.avgLapSec === cmp.b.avgLapSec;

  const fieldLbl = (k) => t(COLS.find((c) => c.k === k)?.lbl || (k === "raceLaps" ? "Toplam yarış turu" : k));
  const nameOf = (i) => String(teams[i]?.name || "").trim() || `${t("Satır")} ${i + 1}`;

  return (
    <div>
      {/* ---------- yarış ---------- */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--rc-sp-10)", flexWrap: "wrap" }}>
          <Icon name="karsilastir" size={17} />
          <span style={{ fontFamily: "var(--rc-font-display)", fontSize: "var(--rc-fs-15)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "var(--rc-ls-label)" }}>
            {t("Strateji Karşılaştırma")}
          </span>
          <span style={{ color: "var(--rc-text-4)", fontSize: "var(--rc-fs-11)" }}>
            {t("Yarış öncesi hesap aracı — canlı veri kullanmaz")}
          </span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "var(--rc-sp-8)" }}>
            <span style={capLbl}>{t("Toplam yarış turu")}</span>
            <input className="ovr" type="number" min="1" step="1" value={laps ?? ""}
              disabled={readOnly} placeholder="—"
              onChange={(e) => onLaps?.(e.target.value)} />
            {sugg !== null && String(laps) !== String(sugg) && !readOnly && (
              <button type="button" onClick={() => onLaps?.(sugg)}
                title={t("Stint planındaki toplam tur sayısını buraya yaz")}
                style={{ background: "var(--rc-surface-4)", border: "1px solid var(--rc-border)", color: "var(--rc-text-2)", borderRadius: "var(--rc-r-8)", padding: "4px 9px", fontSize: "var(--rc-fs-11)", cursor: "pointer" }}>
                {t("Plandan al")}: {sugg}
              </button>
            )}
          </div>
        </div>
        {/* pist + sınıf → yeni satırda pit yolu ve ortalama tur otomatik gelir */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--rc-sp-10)", flexWrap: "wrap", marginTop: "var(--rc-sp-12)" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={capLbl}>{t("Pist")}</span>
            <select value={st.stratTrack || ""} disabled={readOnly}
              onChange={(e) => onTrack?.(e.target.value)}
              style={{ padding: "6px 8px", borderRadius: "var(--rc-r-8)", background: "var(--rc-surface-4)", color: "var(--rc-text)", border: "1px solid var(--rc-border)", fontSize: "var(--rc-fs-12)", minWidth: 150 }}>
              <option value="">{t("Pist seç (isteğe bağlı)")}</option>
              {tracks.map((tr) => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={capLbl}>{t("Sınıf")}</span>
            <select value={st.stratClass || ""} disabled={readOnly}
              onChange={(e) => onClass?.(e.target.value)}
              style={{ padding: "6px 8px", borderRadius: "var(--rc-r-8)", background: "var(--rc-surface-4)", color: "var(--rc-text)", border: "1px solid var(--rc-border)", fontSize: "var(--rc-fs-12)", minWidth: 110 }}>
              <option value="">{t("Sınıf")}</option>
              {carClasses.map(([id, lbl]) => <option key={id} value={id}>{lbl}</option>)}
            </select>
          </label>
          {(st.stratTrack || st.stratClass) && (
            <span style={{ fontSize: "var(--rc-fs-11)", color: "var(--rc-text-3)", lineHeight: 1.6, paddingBottom: 6 }}>
              {t("Öneri")}:{" "}
              <b>{t("pit yolu")}</b> {trackDefs.pitLane != null ? `${trackDefs.pitLane} sn` : t("veri yok")}
              {" · "}
              <b>{t("ort. tur")}</b> {trackDefs.avgLap || (lmuReady ? t("veri yok") : "…")}
              {" — "}{t("yeni satıra otomatik gelir, üstüne yazabilirsiniz")}
            </span>
          )}
        </div>
        <div style={{ color: "var(--rc-text-4)", fontSize: "var(--rc-fs-11)", marginTop: 8, lineHeight: 1.6 }}>
          {t("Model: toplam süre = ortalama tur × toplam tur + (pit yolu + yakıt + lastik + ceza + hasar). İki satırın farkı bu toplamların farkıdır. Satırlar rakip takım da olabilir, kendi A/B planınız da.")}
        </div>
      </div>

      {/* ---------- karşılaştırma ---------- */}
      <div style={card}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--rc-sp-10)", marginBottom: "var(--rc-sp-12)" }}>
          {[["stratA", iA], ["stratB", iB]].map(([key, idx]) => (
            <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={capLbl}>{key === "stratA" ? t("A") : t("B")}</span>
              <select value={idx} disabled={readOnly || !teams.length}
                onChange={(e) => onPick?.(key, Number(e.target.value))}
                style={{ padding: "6px 8px", borderRadius: "var(--rc-r-8)", background: "var(--rc-surface-4)", color: "var(--rc-text)", border: "1px solid var(--rc-border)", fontSize: "var(--rc-fs-12)" }}>
                {teams.length ? teams.map((r, i) => (
                  <option key={i} value={i}>{String(r?.name || "").trim() || `${t("Satır")} ${i + 1}`}</option>
                )) : <option value={0}>{t("Kayıt yok")}</option>}
              </select>
            </label>
          ))}
        </div>

        {!teams.length ? (
          <div style={{ color: "var(--rc-text-4)", fontSize: "var(--rc-fs-12)", padding: "10px 0" }}>
            {t("Aşağıdaki deftere en az iki satır ekleyin (iki rakip ya da kendi A/B planınız).")}
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: "left" }}>{t("Kalem")}</th>
                    <th style={th}>{nameOf(iA)}</th>
                    <th style={th}>{nameOf(iB)}</th>
                    <th style={th}>{t("Fark (A − B)")}</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((r) => {
                    const va = r.get(cmp.a), vb = r.get(cmp.b);
                    const d = Number.isFinite(va) && Number.isFinite(vb) ? va - vb : NaN;
                    return (
                      <tr key={r.k} style={r.sub ? { background: "var(--rc-surface-inset)" } : undefined}>
                        <td style={{ ...td, textAlign: "left", fontFamily: "var(--rc-font-ui)", fontWeight: r.sub ? 700 : 400, color: r.sub ? "var(--rc-text)" : "var(--rc-text-3)" }}>
                          {t(r.lbl)}
                        </td>
                        <td style={{ ...td, fontWeight: r.sub ? 700 : 400 }}>{r.fmt(va)}</td>
                        <td style={{ ...td, fontWeight: r.sub ? 700 : 400 }}>{r.fmt(vb)}</td>
                        <td style={{ ...td, fontWeight: r.sub ? 700 : 400, color: deltaCol(d, r.k) }}>
                          {r.k === "avgLapSec" ? sgnLap(d)
                            : r.k === "pits" ? sgnInt(d) : signed(d)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* sonuç — kazanan ADIYLA yazılır (Excel'de yalnız renk vardı ve
                kullanıcının kendi takımı aleyhine okunuyordu) */}
            <div style={{ marginTop: "var(--rc-sp-12)", padding: "var(--rc-sp-12)", borderRadius: "var(--rc-r-10)", background: "var(--rc-surface-inset)", border: "1px solid var(--rc-border)" }}>
              {cmp.ok ? (
                <>
                  <div style={{ fontFamily: "var(--rc-font-display)", fontSize: "var(--rc-fs-17)", fontWeight: 700 }}>
                    {cmp.leader === "tie" ? t("İki strateji eşit") : (
                      <>
                        <span style={{ color: "var(--rc-ok)" }}>{nameOf(cmp.leader === "a" ? iA : iB)}</span>
                        {" "}{fmtDur(Math.abs(cmp.totalDelta))} {t("sn önde")}
                      </>
                    )}
                  </div>
                  <div style={{ color: "var(--rc-text-3)", fontSize: "var(--rc-fs-12)", marginTop: 6, lineHeight: 1.7 }}>
                    {t("Sabit kayıp farkı")}: <b>{signed(cmp.staticDelta)}</b> ·{" "}
                    {t("tempo farkı")}: <b>{signed(cmp.paceDelta)}</b>{" "}
                    ({sgnLap(cmp.lapDelta)} {t("sn/tur")})
                  </div>
                  {samePace && (
                    <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: "var(--rc-r-8)", background: "var(--rc-tint-warn)", border: "1px solid var(--rc-warn)", color: "var(--rc-text-2)", fontSize: "var(--rc-fs-11)", lineHeight: 1.6 }}>
                      <Icon name="uyari" size={13} />{" "}
                      {t("İki satırın ortalama turu aynı — fark yalnız pit/yakıt/lastik kaleminden geliyor. Uzun stintin yakıt yükü ve lastik yaşı yüzünden turu yavaşlatması bu modelde YOK; gerçek tempo farkını biliyorsanız ortalama turu satır başına elle girin.")}
                    </div>
                  )}
                  {cmp.leader !== "tie" && (
                    <div style={{ color: "var(--rc-text-3)", fontSize: "var(--rc-fs-12)", marginTop: 4 }}>
                      {t("Geride kalanın farkı kapatması için")}:{" "}
                      <b>{cmp.breakEvenLap.toFixed(3)}</b> {t("sn/tur")}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: "var(--rc-fs-12)", color: "var(--rc-warn)" }}>
                  <Icon name="uyari" size={14} />{" "}
                  {t("Karşılaştırma yapılamıyor — eksik alan var:")}
                  <ul style={{ margin: "6px 0 0 18px", padding: 0, color: "var(--rc-text-3)" }}>
                    {[[iA, cmp.a], [iB, cmp.b]].filter(([, r]) => !r.ok).map(([i, r]) => (
                      <li key={i}>{nameOf(i)} — {r.missing.map(fieldLbl).join(", ")}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ---------- kayıt defteri ---------- */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--rc-sp-8)", marginBottom: "var(--rc-sp-10)" }}>
          <span style={{ ...capLbl, fontSize: "var(--rc-fs-12)" }}>{t("Kayıt defteri")}</span>
          <span style={{ color: "var(--rc-text-4)", fontSize: "var(--rc-fs-11)" }}>
            {teams.length} {t("satır")}
          </span>
          {!readOnly && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={capLbl} title={t("Seçtiğiniz strateji varyantının GERÇEK planından satır oluşturur — pit sayısı, süreler ve ortalama tur plandan gelir")}>
                <Icon name="plan" size={12} /> {t("Planımdan ekle")}
              </span>
              {opts.map((o) => (
                <button key={o.key} type="button" disabled={!o.ready}
                  onClick={() => onSeed?.(o.key)}
                  title={o.ready
                    ? `${t("Plan")} ${o.key} — ${o.laps} ${t("tur")}/stint`
                    : t("Bu varyantın planı kurulamıyor (yarış süresi, ortalama tur ya da stint turu eksik/geçersiz)")}
                  style={btn(o.key === st.chosen, !o.ready)}>
                  {o.key} · {o.laps}
                </button>
              ))}
              <button type="button" onClick={() => onAdd?.()} style={btn(false, false)}>
                <Icon name="ekle" size={13} /> {t("Boş satır")}
              </button>
            </div>
          )}
        </div>

        {!teams.length ? (
          <div style={{ color: "var(--rc-text-4)", fontSize: "var(--rc-fs-12)" }}>
            {t("Henüz satır yok. \"Planımdan ekle\" ile bir strateji varyantını (A/B/C/D) hazır doldurun; iki varyant ekleyip hangisinin hızlı olduğunu karşılaştırabilirsiniz.")}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", minWidth: "100%" }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: "left" }}>{t("Ad")}</th>
                  {COLS.map((c) => (
                    <th key={c.k} style={th} title={t(c.hint)}>{t(c.lbl)}</th>
                  ))}
                  <th style={{ ...th, textAlign: "left" }}>{t("Not")}</th>
                  <th style={th} />
                </tr>
              </thead>
              <tbody>
                {teams.map((row, i) => {
                  const res = teamTime(row, laps);
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid var(--rc-line-soft)" }}>
                      <td style={{ ...td, textAlign: "left" }}>
                        <input type="text" value={row?.name ?? ""} disabled={readOnly}
                          placeholder={t("Takım ya da plan adı")} style={{ width: 168, fontSize: "var(--rc-fs-12)" }}
                          onChange={(e) => onUp?.(i, { name: e.target.value })} />
                      </td>
                      {COLS.map((c) => (
                        <td key={c.k} style={td}>
                          <input className="ovr" type={c.lap ? "text" : "number"}
                            step={c.step} min={c.lap ? undefined : "0"}
                            value={row?.[c.k] ?? ""} disabled={readOnly}
                            placeholder={c.lap ? "m:ss.mmm" : "—"}
                            title={t(c.hint)}
                            style={{
                              width: c.w,
                              ...(res.missing.includes(c.k)
                                ? { borderColor: "var(--rc-warn)", color: "var(--rc-warn)" } : {}),
                            }}
                            onChange={(e) => onUp?.(i, { [c.k]: e.target.value })} />
                        </td>
                      ))}
                      <td style={{ ...td, textAlign: "left" }}>
                        <input type="text" value={row?.notes ?? ""} disabled={readOnly}
                          placeholder={t("örn. 13 tur-tek")} style={{ width: 120, fontSize: "var(--rc-fs-11)" }}
                          onChange={(e) => onUp?.(i, { notes: e.target.value })} />
                      </td>
                      <td style={td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                          {res.warnings.length > 0 && (
                            <span title={res.warnings.map((w) => t(WARN_TXT[w])).join(" · ")}
                              style={{ color: "var(--rc-warn)", display: "inline-flex" }}>
                              <Icon name="uyari" size={13} />
                            </span>
                          )}
                          {!readOnly && (
                            <button type="button" onClick={() => onDel?.(i)} title={t("Satırı sil")}
                              style={{ background: "none", border: "none", color: "var(--rc-text-4)", cursor: "pointer", padding: 2, display: "inline-flex" }}>
                              <Icon name="sil" size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ color: "var(--rc-text-4)", fontSize: "var(--rc-fs-10)", marginTop: 8, lineHeight: 1.6 }}>
          {t("Boş bırakılan ceza ve hasar 0 sn sayılır. Diğer alanlar boşsa o takım hesaplanmaz — eksik veri sıfır varsayılmaz.")}
        </div>
      </div>

      {/* ---------- sıralama ---------- */}
      {rank.ranked.length > 1 && (
        <div style={card}>
          <div style={{ ...capLbl, fontSize: "var(--rc-fs-12)", marginBottom: "var(--rc-sp-10)" }}>
            {t("Tüm defter — tahmini bitiş sırası")}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left", width: 34 }}>#</th>
                <th style={{ ...th, textAlign: "left" }}>{t("Ad")}</th>
                <th style={th}>{t("Sabit kayıp")}</th>
                <th style={th}>{t("Ort. tur")}</th>
                <th style={th}>{t("Toplam")}</th>
                <th style={th}>{t("Lidere fark")}</th>
              </tr>
            </thead>
            <tbody>
              {rank.ranked.map((r, i) => (
                <tr key={r.idx} style={{ borderBottom: "1px solid var(--rc-line-soft)" }}>
                  <td style={{ ...td, textAlign: "left", color: "var(--rc-text-4)" }}>{i + 1}</td>
                  <td style={{ ...td, textAlign: "left", fontFamily: "var(--rc-font-ui)" }}>
                    {String(r.team?.name || "").trim() || `${t("Satır")} ${r.idx + 1}`}
                  </td>
                  <td style={td}>{fmtDur(r.res.staticSec)}</td>
                  <td style={td}>{fmtLapMs(r.res.avgLapSec)}</td>
                  <td style={td}>{hms(r.res.totalSec)}</td>
                  <td style={{ ...td, color: i === 0 ? "var(--rc-ok)" : "var(--rc-text-3)" }}>
                    {i === 0 ? t("lider") : `+${fmtDur(r.gapToLeader)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rank.incomplete.length > 0 && (
            <div style={{ color: "var(--rc-text-4)", fontSize: "var(--rc-fs-11)", marginTop: 8 }}>
              {t("Sıralamaya girmeyen (eksik veri)")}:{" "}
              {rank.incomplete.map((r) => String(r.team?.name || "").trim() || `#${r.idx + 1}`).join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- yardımcılar (bileşen dışında — her renderda yeniden kurulmasın) ---------- */

const WARN_TXT = {
  stintMismatch: "Stint sayısı pit sayısı + 1 olmalı",
  tyreOverPits: "Lastik değişimi durak sayısını geçemez",
};

/* Karşılaştırma tablosunun satırları — Excel'in STRATEGY COMP alt bloğu. */
const ROWS = [
  { k: "pits", lbl: "Pit sayısı", get: (r) => r.pits, fmt: (v) => (Number.isFinite(v) ? String(v) : "—") },
  { k: "pitLaneSec", lbl: "Pit yolu toplamı", get: (r) => r.pitLaneSec, fmt: fmtCell },
  { k: "fuelSec", lbl: "Yakıt toplamı", get: (r) => r.fuelSec, fmt: fmtCell },
  { k: "tyreSec", lbl: "Lastik toplamı", get: (r) => r.tyreSec, fmt: fmtCell },
  { k: "penaltySec", lbl: "Ceza süresi", get: (r) => r.penaltySec, fmt: fmtCell },
  { k: "damageSec", lbl: "Hasar süresi", get: (r) => r.damageSec, fmt: fmtCell },
  { k: "staticSec", lbl: "Sabit kayıp", get: (r) => r.staticSec, fmt: fmtCell, sub: true },
  { k: "avgLapSec", lbl: "Ortalama tur", get: (r) => r.avgLapSec, fmt: (v) => (Number.isFinite(v) ? fmtLapMs(v) : "—") },
  { k: "paceSec", lbl: "Tempo (ort. tur × tur)", get: (r) => r.paceSec, fmt: (v) => (Number.isFinite(v) ? hms(v) : "—") },
  { k: "totalSec", lbl: "TOPLAM", get: (r) => r.totalSec, fmt: (v) => (Number.isFinite(v) ? hms(v) : "—"), sub: true },
];

/* 0 sn GEÇERLİ bir okumadır (ceza yok / duraksız strateji) — fmtDur onu "—"
   gösterir ve "veri yok" ile karıştırılırdı. Tam da CLAUDE.md §1'in ayrımı. */
/* Adet farkı — süre değil, ondalık gösterilmez ("+1", "0"). */
function sgnInt(v) {
  if (!Number.isFinite(v)) return "—";
  return v === 0 ? "0" : `${v > 0 ? "+" : "−"}${Math.abs(v)}`;
}

function fmtCell(v) {
  if (!Number.isFinite(v)) return "—";
  return v === 0 ? "0.0" : fmtDur(v);
}

/* Tur farkı 0.001 sn hassasiyetinde okunur (fmtDur desisaniyeye yuvarlar ve
   0.35 sn'lik tempo farkını "0.4" gösterirdi — karşılaştırmanın tüm konusu
   bu üçüncü hane). */
function sgnLap(v) {
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v) < 0.0005) return "0.000";
  return `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(3)}`;
}

/* Fark rengi: DAHA AZ süre iyidir → negatif fark A'nın lehine (yeşil).
   Tek istisna "ortalama tur" değil — o da az olan iyi, aynı kural geçerli. */
function deltaCol(d, k) {
  if (!Number.isFinite(d) || Math.abs(d) < (k === "avgLapSec" ? 0.0005 : 0.05)) return "var(--rc-text-3)";
  return d < 0 ? "var(--rc-ok)" : "var(--rc-danger-3)";
}

function btn(primary, disabled) {
  return {
    display: "inline-flex", alignItems: "center", gap: 5,
    background: primary ? "var(--rc-brand)" : "var(--rc-surface-4)",
    color: primary ? "var(--rc-on-brand)" : "var(--rc-text-2)",
    border: `1px solid ${primary ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
    borderRadius: "var(--rc-r-8)", padding: "5px 10px",
    fontSize: "var(--rc-fs-11)", fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
  };
}
