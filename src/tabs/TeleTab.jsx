import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from "recharts";
import { fmtLap } from "../engine";
import { SLOT_COLORS } from "../constants";
import { Tyre, BoxPlot } from "../components";

/* Telemetri sekmesi — MoTeC içe aktarma, sütun eşleme, stint analizi + grafikler.
   Tüm state/derived (parsed/slotStats/chartData/loadedSlots/baseSlot) ve handler'lar
   App'ten prop gelir. fmtMs lokal (fmtLap sarmalayıcı). */
export default function TeleTab({
  t, lang, st, slot, setSlot, rawTele, setRawTele, doParse, onTeleFile,
  parsed, mapping, setMapping, saveMotec, saveSlot, loadedSlots, slotStats,
  up, apply105Slot, removeSlot, chartMode, setChartMode, chartData, baseSlot, toggleLap,
}) {
  const fmtMs = (ms) => fmtLap(ms / 1000);
  return (
    <div>
      <div className="card">
        <h2 data-tour="teleimport">{t("Telemetri İçe Aktar (MoTeC)")}</h2>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {["A", "B", "C", "D"].map((sl) => (
            <button key={sl} className="act"
              style={slot === sl
                ? { borderColor: SLOT_COLORS[sl], color: SLOT_COLORS[sl], fontWeight: 700 }
                : {}}
              onClick={() => setSlot(sl)}>
              Stint {sl}{st.telemetry[sl] ? " ●" : ""}
            </button>
          ))}
        </div>
        <label>{t("MoTeC tur istatistiklerini yapıştır veya dosya seç (CSV/TSV)")}</label>
        <textarea value={rawTele}
          onChange={(e) => { setRawTele(e.target.value); doParse(e.target.value); }}
          placeholder={"Out Lap\t310127\t-6.403 ...\nLap 1\t237350\t-6.36 ..."}
          style={{ width: "100%", height: 90, background: "var(--panel2)",
            border: "1px solid var(--line)", borderRadius: 6, color: "var(--txt)",
            fontFamily: "IBM Plex Mono", fontSize: 11, padding: 8 }} />
        <div style={{ margin: "6px 0" }}>
          <input type="file" accept=".csv,.tsv,.txt" onChange={onTeleFile} />
        </div>
        {parsed?.error && <div className="hint warn">⚠ {t(parsed.error)}</div>}
        {parsed?.motec && (<>
          <div className="hint" style={{ marginTop: 4 }}>
            <b>{parsed.laps.length}</b> {t("tur çözümlendi")}
            {parsed.meta.venue && <> · {parsed.meta.venue}</>}
            {parsed.meta.vehicle && <> · {parsed.meta.vehicle}</>}
            {parsed.meta.driver && <> · {parsed.meta.driver}</>}
            {parsed.meta.trk != null && <> · {t("Pist")} {parsed.meta.trk.toFixed(0)}°C</>}
            {parsed.meta.amb != null && <> / {t("Hava")} {parsed.meta.amb.toFixed(0)}°C</>}
          </div>
          <div style={{ overflowX: "auto", margin: "8px 0" }}>
            <table style={{ fontSize: 11.5 }}>
              <thead><tr>
                <th>{t("Tur")}</th><th>{t("Süre")}</th><th>{t("Yakıt")}</th>
                <th>VE %</th><th>{t("Aşınma")} FL/FR/RL/RR</th><th>{t("Ort/Max km/h")}</th>
              </tr></thead>
              <tbody>
                {parsed.laps.map((l) => (
                  <tr key={l.lap}>
                    <td>{l.lap}{l.pit ? " 🅿" : ""}
                      {l.partial && <span className="hint" style={{ marginLeft: 4 }}>
                        {t("kısmi")}</span>}</td>
                    <td className="mono">{fmtLap(l.sec)}</td>
                    <td className="mono">{l.fuelL != null ? `${l.fuelL.toFixed(2)} L` : "—"}</td>
                    <td className="mono">{l.fuelL != null && st.fuelRatio > 0
                      ? `${(l.fuelL / st.fuelRatio).toFixed(2)}` : "—"}</td>
                    <td className="mono">{l.w.map((x) =>
                      x == null ? "—" : x.toFixed(1)).join(" / ")}</td>
                    <td className="mono">{l.avgSpd != null
                      ? `${Math.round(l.avgSpd)} / ${Math.round(l.maxSpd)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!(st.fuelRatio > 0) && (
            <div className="hint warn">{t("VE karşılığı için Yarış·Data'da yakıt oranı girilmeli.")}</div>
          )}
          <button className="act" style={{ borderColor: SLOT_COLORS[slot],
            color: SLOT_COLORS[slot], marginTop: 4 }} onClick={saveMotec}>
            {lang === "en" ? <>Save as Stint {slot}</> : <>Stint {slot} olarak kaydet</>}
          </button>
        </>)}
        {parsed && !parsed.error && !parsed.motec && mapping && (<>
          <div className="hint">
            {parsed.lapRows.length} {t("tur satırı bulundu. Sütun eşleşmesini kontrol et:")}
          </div>
          {mapping.fuelCol >= 0 && (
            <div className="hint" style={{ marginTop: 2 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 5,
                margin: 0, textTransform: "none", letterSpacing: 0 }}>
                <input type="checkbox" checked={!!mapping.fuelIsLitre}
                  onChange={(e) => setMapping({ ...mapping, fuelIsLitre: e.target.checked })} />
                {t("Yakıt sütunu litre (VE % için orana bölünür)")}
              </label>
              {mapping.fuelIsLitre && !(st.fuelRatio > 0) &&
                <span className="warn" style={{ marginLeft: 8 }}>
                  {t("Yarış·Data'da yakıt oranı girilmeli")}</span>}
            </div>
          )}
          <details style={{ margin: "6px 0" }}>
          <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: 12 }}>
            {t("Sütun eşleşmesini düzenle")}</summary>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "6px 0" }}>
            {[["Tur Süresi", "timeCol"], ["VE Δ (%)", "fuelCol"]].map(([lbl, key]) => (
              <div key={key}>
                <label style={{ margin: 0 }}>{t(lbl)}</label>
                <select value={mapping[key]}
                  onChange={(e) => setMapping({ ...mapping, [key]: +e.target.value })}>
                  <option value={-1}>—</option>
                  {parsed.headers.map((h, i) =>
                    <option key={i} value={i}>{i}: {h || t("(başlıksız)")}</option>)}
                </select>
              </div>
            ))}
            {["FL", "FR", "RL", "RR"].map((c, ci) => (
              <div key={c}>
                <label style={{ margin: 0 }}>{t("Aşınma")} {c}</label>
                <select value={mapping.wear[ci]}
                  onChange={(e) => {
                    const wear = [...mapping.wear]; wear[ci] = +e.target.value;
                    setMapping({ ...mapping, wear });
                  }}>
                  <option value={-1}>—</option>
                  {parsed.headers.map((h, i) =>
                    <option key={i} value={i}>{i}: {h || t("(başlıksız)")}</option>)}
                </select>
              </div>
            ))}
          </div>
          </details>
          <button className="act" style={{ borderColor: SLOT_COLORS[slot],
            color: SLOT_COLORS[slot] }} onClick={saveSlot}
            disabled={mapping.timeCol < 0}>
            {lang === "en" ? <>Save as Stint {slot}</> : <>Stint {slot} olarak kaydet</>}
          </button>
          {mapping.timeCol < 0 &&
            <span className="hint warn" style={{ marginLeft: 8 }}>{t("Tur süresi sütunu seçilmeli")}</span>}
        </>)}
      </div>

      {loadedSlots.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <h2>{t("Stint Analizi")}</h2>
          <div className="kpis">
            {loadedSlots.map((sl) => {
              const s = slotStats[sl];
              if (!s || s.empty) return null;
              return (
                <div className="kpi" key={sl} style={{ borderColor: SLOT_COLORS[sl] }}>
                  <div className="v" style={{ color: SLOT_COLORS[sl], fontSize: 19 }}>
                    {fmtMs(s.medMs)}</div>
                  <div className="l">Stint {sl} {t("medyan tur")} · {s.laps} {t("Tur")}</div>
                  <div className="hint" style={{ marginTop: 4 }}>
                    {s.medFuel != null && <>⚡ {s.medFuel.toFixed(2)} %/tur VE
                      {s.tankLaps && <> · %100 ≈ {Math.floor(s.tankLaps)} tur</>}<br /></>}
                    {s.medW.some((w) => w != null) &&
                      <><Tyre size={13} /> {s.medW.map((w) => w == null ? "–" : w.toFixed(1)).join(" / ")} {t("%/tur")}<br /></>}
                    <span style={{ opacity: .7 }}>{t("ort.")} {fmtMs(s.avgMs)}
                      {s.avgFuel != null && <> · {s.avgFuel.toFixed(2)} %/tur</>}<br />
                      {t("en iyi")} {fmtMs(s.bestMs)} · %105 ≤ {fmtMs(s.lim105)}
                      {s.dropped > 0 && <> · {s.dropped} {t("tur hariç")}</>}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <button className="act" style={{ fontSize: 11 }}
                      onClick={() => up({
                        avgLap: fmtMs(s.medMs),
                        ...(s.medFuel != null
                          ? { consumption: +s.medFuel.toFixed(2) } : {}),
                      })}>{t("DATA'ya uygula")}</button>
                    <button className="act" style={{ fontSize: 11, opacity: .75 }}
                      title={t("Ortalamayı uygula")}
                      onClick={() => up({
                        avgLap: fmtMs(s.avgMs),
                        ...(s.avgFuel != null
                          ? { consumption: +s.avgFuel.toFixed(2) } : {}),
                      })}>{t("ort.")}</button>
                    <button className="act" style={{ fontSize: 11, opacity: .75 }}
                      title={t("En iyi turun %105'ini aşan turların tikini kaldır")}
                      onClick={() => apply105Slot(sl)}>%105</button>
                    <button className="act danger" style={{ fontSize: 11 }}
                      onClick={() => removeSlot(sl)}>{t("Sil")}</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 6, margin: "4px 0 2px" }}>
            {[["box", "Kutu grafiği"], ["line", "Tur tur"]].map(([m, lbl]) => (
              <button key={m} className="act" style={{ fontSize: 11,
                ...(chartMode === m ? { borderColor: "var(--teal)", color: "var(--teal)" } : {}) }}
                onClick={() => setChartMode(m)}>{t(lbl)}</button>
            ))}
          </div>
          {chartMode === "box" ? (
            <div style={{ margin: "6px 0 2px" }}>
              <BoxPlot height={300} fmt={(v) => fmtLap(v / 1000)}
                series={loadedSlots.map((sl) => ({
                  key: sl, label: `Stint ${sl}`, color: SLOT_COLORS[sl],
                  values: st.telemetry[sl].laps.filter((l) => l.use).map((l) => l.ms),
                })).filter((s) => s.values.length)} />
            </div>
          ) : (
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="#2B3542" strokeDasharray="3 3" />
                <XAxis dataKey="lap" stroke="#8C97A5" fontSize={11} />
                <YAxis stroke="#8C97A5" fontSize={11} domain={["auto", "auto"]}
                  tickFormatter={(v) => fmtLap(v)} width={70} />
                <Tooltip contentStyle={{ background: "#1F2731", border: "1px solid #2B3542" }}
                  labelFormatter={(l) => `Tur ${l}`}
                  formatter={(v, n) => [fmtLap(v), `Stint ${n}`]} />
                <Legend formatter={(v) => `Stint ${v}`} />
                {loadedSlots.map((sl) => (
                  <Line key={sl} dataKey={sl} stroke={SLOT_COLORS[sl]}
                    dot={false} strokeWidth={2} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          )}

          {loadedSlots.length > 1 && baseSlot && slotStats[baseSlot] && !slotStats[baseSlot].empty && (
            <table style={{ maxWidth: 460, marginTop: 10 }}>
              <thead><tr><th>{t("Karşılaştırma")}</th><th>{t("Ort. Fark")}</th><th>{t("Hızlı Olan")}</th></tr></thead>
              <tbody>
                {loadedSlots.slice(1).map((sl) => {
                  const a = slotStats[baseSlot], b = slotStats[sl];
                  /* karşılaştırma medyan üzerinden */
                  if (!b || b.empty) return null;
                  const d = (a.avgMs - b.avgMs) / 1000; // + ise rakip hızlı
                  return (
                    <tr key={sl}>
                      <td>Stint {baseSlot} vs Stint {sl}</td>
                      <td className={d > 0 ? "neg" : "pos"}>{Math.abs(d).toFixed(3)}s/tur</td>
                      <td style={{ color: SLOT_COLORS[d > 0 ? sl : baseSlot] }}>
                        Stint {d > 0 ? sl : baseSlot}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {loadedSlots.map((sl) => (
            <details key={sl} style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", color: SLOT_COLORS[sl] }}>
                Stint {sl} — {t("tur listesi")} ({st.telemetry[sl].laps.length})</summary>
              <table style={{ maxWidth: 560 }}>
                <thead><tr>
                  <th>{t("Dahil")}</th><th>{t("Tur")}</th><th>{t("Süre")}</th><th>VE %</th><th>FL/FR/RL/RR</th>
                </tr></thead>
                <tbody>
                  {st.telemetry[sl].laps.map((l, li) => (
                    <tr key={li} style={l.use ? {} : { opacity: .4 }}>
                      <td><input type="checkbox" checked={l.use}
                        onChange={() => toggleLap(sl, li)} /></td>
                      <td>{l.label}</td>
                      <td>{fmtMs(l.ms)}</td>
                      <td>{l.fuel != null ? l.fuel.toFixed(2) : "–"}</td>
                      <td>{l.w.map((w) => w == null ? "–" : w.toFixed(1)).join(" / ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
