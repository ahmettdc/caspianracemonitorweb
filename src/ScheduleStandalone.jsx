/* ============================================================
   ScheduleStandalone — Ana Menü → Resmi Yarışlar: BAĞIMSIZ takvim ekranı
   ------------------------------------------------------------
   Race Solo yolundan (entered/pick/setup/race workspace) TAMAMEN ayrı üst-düzey
   görünüm — TelemetryStandalone ile aynı desen. Bir yarış seçmeye, oda/solo açmaya
   veya takıma girmeye GEREK YOK; yalnız resmi yarış takvimi verisini (useLmuSchedule)
   kullanır. Çıkış (🏠 Ana Menü) → onExit yalnız scheduleOnly'yi kapatır; entered/
   curRace'e dokunmaz. Sayfa yenilense de doğrudan buraya girilebilir (race state gerekmez).

   SAF SUNUM: kendi hook'u YOK — App'teki useLmuSchedule çıktısı prop olarak verilir.
   onPlan (v1.7.3): bir resmi yarışı ÖN AYAR olarak kullan → App bunu "Yarış Ekle"
   formuna doldurup takvimi kapatır. Takım seçili değilse App onPlan geçmez →
   kartlarda 📋 butonu görünmez (takımsız yarış oluşturulamaz).
   ============================================================ */
import { lazy, Suspense } from "react";
import { css } from "./styles";
import { ASSET, APP_VERSION } from "./constants";
import { Icon, Btn } from "./components";

const ScheduleTab = lazy(() => import("./tabs/ScheduleTab"));

export default function ScheduleStandalone({
  t, lang, switchLang, races, updatedAt, loading, onExit, onPlan,
}) {
  return (
    <div className="rc">
      <style>{css}</style>
      <header>
        <img className="hlogo" src={`${ASSET}logo.png`} alt="Caspian Motorsport" />
        <h1 className="disp" style={{ fontSize: 20 }}>RACE MONITOR</h1>
        <span className="ver">{APP_VERSION}</span>
        <span className="hint" style={{ margin: 0 }}>· {t("Resmi Yarışlar")}</span>
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
          <ScheduleTab t={t} lang={lang} races={races}
            updatedAt={updatedAt} loading={loading} onPlan={onPlan} />
        </Suspense>
      </div>
    </div>
  );
}
