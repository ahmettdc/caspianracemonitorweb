/* ============================================================
   TelemetryStandalone — Ana Menü → Telemetri: BAĞIMSIZ telemetri ekranı (v1.5.3)
   ------------------------------------------------------------
   Race Solo yolundan (entered/pick/setup/race workspace) TAMAMEN ayrı üst-düzey görünüm.
   SAF SUNUM: kendi hook'u YOK — App'teki İKİNCİ useTelemetry örneğinin dönüşü (`...tel`)
   ve o örneğin scratch `st`'si prop olarak verilir. Böylece Race Solo'nun `st`/ilk
   useTelemetry'sine hiç dokunmaz → iki taraf birbirine sızmaz, durumu uygulama açık
   kaldıkça korunur. Telemetri motoru (ldParser/duckParse/… + duckdb-wasm) ORTAK kullanılır;
   ayrılan yalnız UI + navigation + session + lifecycle.

   `up` no-op verilir ve TeleTab `standalone` ile strateji "DATA'ya uygula"/"ort." butonlarını
   gizler (Data/strateji yalnız Race Solo'da anlamlı). Çıkış (🏠 Ana Menü) → `onExit` yalnız
   teleOnly'yi kapatır; entered/curRace'e dokunmaz.
   ============================================================ */
import { lazy, Suspense } from "react";
import { css } from "./styles";
import { ASSET, APP_VERSION } from "./constants";
import { Icon, Btn } from "./components";

const TeleTab = lazy(() => import("./tabs/TeleTab"));

export default function TelemetryStandalone({ t, lang, switchLang, st, up, onSaveDuckSetup, onExit, ...tel }) {
  return (
    <div className="rc">
      <style>{css}</style>
      <header>
        <img className="hlogo" src={`${ASSET}logo.png`} alt="Caspian Motorsport" />
        <h1 className="disp" style={{ fontSize: 20 }}>RACE MONITOR</h1>
        <span className="ver">{APP_VERSION}</span>
        <span className="hint" style={{ margin: 0 }}>· {t("Telemetri")}</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          {["tr", "en"].map((l) => (
            <button key={l} className={`adminbtn${lang === l ? " on" : ""}`}
              onClick={() => switchLang?.(l)}>{l.toUpperCase()}</button>
          ))}
          <Btn variant="subtle" size="sm" onClick={onExit}
            title={t("Ana menüye dön")} iconLeft={<Icon name="home" size={14} />}>
            {t("Ana Menü")}
          </Btn>
        </div>
      </header>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 20px 60px" }}>
        <Suspense fallback={<div className="hint" style={{ padding: 20 }}>⏳ {t("Yükleniyor…")}</div>}>
          <TeleTab t={t} lang={lang} st={st} up={up} standalone
            {...tel} onSaveDuckSetup={onSaveDuckSetup} />
        </Suspense>
      </div>
    </div>
  );
}
