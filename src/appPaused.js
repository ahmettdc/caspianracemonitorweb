/* ============================================================
   Sürüş Modu — pencere görünmez/örtülüyken AĞIR render'ı durdur
   ------------------------------------------------------------
   Sürüş PC'sinde oyun tam-ekran/önde iken bizim ağır Canlı ekranımız (55 satırlık
   tablo + SVG harita + grafikler) BOŞUNA çizilir ve oyunla GPU/CPU için yarışıp
   takılmaya yol açar (kullanıcı raporu). Köprü render'dan BAĞIMSIZ çalıştığından
   (modül-global state + sidecar 'data' olayı → Firebase) render'ı durdurmak veri
   akışını KESMEZ: mühendis başka PC'de Firebase'i okumaya devam eder.

   Bu modül yalnız KARARI verir (saf) + görünürlük olaylarını dinleyen ince bir hook.
   Görünürlük Rust'tan gelir (lib.rs): win-visible (tepsiye gizle/göster) + win-focus
   (odak: tam-ekran oyun arkasına düşme / minimize). document.visibilitychange
   WebView2'de güvenilmez → yalnız yedek.
   ============================================================ */
import { useEffect, useState } from "react";
import { isTauri } from "./tauriEnv";

/* Ağır render duraklatılsın mı?
   - web (izleyici/mühendis) → asla (isTauri false).
   - pencere gizli (tepside) → daima (gerçekten görünmez).
   - odak yok + köprü CANLI oyun verisi yazıyor (bu PC sürüş PC'si, sürücü yarışta) →
     duraklat. `bridgeLive` şartı, ikinci monitörde izleyen mühendisin / boşta duran
     editörün penceresini yanlışlıkla karartmaz.
   Saf → appPaused.test.js doğrudan test eder. */
export function computePaused({ isTauri: tauri, hidden, focused, bridgeLive }) {
  if (!tauri) return false;
  if (hidden) return true;
  if (!focused && bridgeLive) return true;
  return false;
}

/* Görünürlüğü Tauri olaylarından süren hook → `paused` bool. `bridgeLive`: köprü şu an
   canlı oyun verisi yazıyor mu (App: bridge.phase==="running" && writerBy===ben). */
export function useAppPaused(bridgeLive) {
  const [hidden, setHidden] = useState(false);
  const [focused, setFocused] = useState(true);

  useEffect(() => {
    if (!isTauri) return undefined;
    let unVis = null, unFoc = null, alive = true;
    (async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unVis = await listen("win-visible", (e) => { if (alive) setHidden(!e.payload); });
        unFoc = await listen("win-focus", (e) => { if (alive) setFocused(!!e.payload); });
      } catch { /* olay sistemi yok → yer tutucu davranış (web gibi) */ }
    })();
    // Yedek (tek dayanak DEĞİL): bazı WebView2 sürümleri visibilitychange verir.
    const onVis = () => { if (alive) setHidden(document.visibilityState === "hidden"); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVis);
      if (unVis) unVis();
      if (unFoc) unFoc();
    };
  }, []);

  return computePaused({ isTauri, hidden, focused, bridgeLive: !!bridgeLive });
}
