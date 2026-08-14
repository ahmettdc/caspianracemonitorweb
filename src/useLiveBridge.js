/* ============================================================
   useLiveBridge — canlı köprü yaşam döngüsü (masaüstü, OTOMATİK)
   ------------------------------------------------------------
   App.jsx'ten çıkarıldı (Tanrı-bileşen borcunu azaltan ilk güvenli dilim).
   Oyunun PC'sinde uygulama açık (Tauri) + kullanıcı takımın HERHANGİ bir üyesi
   (owner/editor/viewer) + bir yarış seçiliyse köprüyü kendiliğinden başlatır;
   çalışmıyorsa ~4 sn'de bir yeniden dener (oyun sonradan açılırsa da bağlanır);
   koşul kalkınca / çıkışta durdurur. Elle Başlat/Durdur yok — sidecar oyunu
   okuyup veriyi kullanıcının oturumuyla teams/{tid}/live/{rid}'e yazar.

   Dönen `bridge` durum objesi ({ supported, running, phase, msg, writerBy, diag })
   LiveTab'e prop olarak geçirilir. */
import { useState, useEffect } from "react";
import { isTauri } from "./tauriEnv";

/* liveBridge.js (~22 KB, sidecar sürücüsü) yalnız masaüstünde işe yarar →
   web paketinden çıkarıldı; Tauri'de effect ilk koştuğunda dynamic import ile
   gelir (yerel asset, anında). api modül-seviyesi cache: bir kez yüklenince
   defansif stopBridge çağrıları eski (senkron) semantikle çalışır; modül hiç
   yüklenmediyse çalışan köprü de olamaz → durduracak şey yok. */
let api = null;
export function useLiveBridge({ isMember, curTeam, curRace, user }) {
  const [bridge, setBridge] = useState({ supported: isTauri, running: false, phase: "idle", msg: "" });
  useEffect(() => {
    if (!isTauri) return undefined;
    if (!isMember || !curTeam || !curRace || !user) {
      if (api) api.stopBridge(setBridge);
      return undefined;
    }
    let stopped = false, timer = null;
    const by = user?.email || "masaüstü";
    const tick = () => {
      if (stopped) return;
      if (!api.bridgeRunning()) api.startBridge({ tid: curTeam, rid: curRace, hz: 2, by, uid: user.uid }, setBridge);
      timer = setTimeout(tick, 4000);
    };
    if (api) tick();
    else import("./liveBridge").then((m) => { api = m; if (!stopped) tick(); });
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (api) api.stopBridge(setBridge);
    };
  }, [isMember, curTeam, curRace, user]);
  return bridge;
}
