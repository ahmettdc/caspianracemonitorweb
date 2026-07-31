/* ============================================================
   useLiveBridge — canlı köprü yaşam döngüsü (masaüstü, OTOMATİK)
   ------------------------------------------------------------
   App.jsx'ten çıkarıldı (Tanrı-bileşen borcunu azaltan ilk güvenli dilim).
   Davranış birebir korunur: oyunun PC'sinde uygulama açık (Tauri) + kullanıcı
   takımda owner/editor + bir yarış seçiliyse köprüyü kendiliğinden başlatır;
   çalışmıyorsa ~4 sn'de bir yeniden dener (oyun sonradan açılırsa da bağlanır);
   koşul kalkınca / çıkışta durdurur. Elle Başlat/Durdur yok — sidecar oyunu
   okuyup veriyi kullanıcının oturumuyla teams/{tid}/live/{rid}'e yazar.

   Dönen `bridge` durum objesi ({ supported, running, phase, msg, writerBy, diag })
   LiveTab'e prop olarak geçirilir. */
import { useState, useEffect } from "react";
import { isTauri } from "./tauriEnv";
import { startBridge, stopBridge, bridgeRunning } from "./liveBridge";

export function useLiveBridge({ canEditTeam, curTeam, curRace, user }) {
  const [bridge, setBridge] = useState({ supported: isTauri, running: false, phase: "idle", msg: "" });
  useEffect(() => {
    if (!isTauri) return undefined;
    if (!canEditTeam || !curTeam || !curRace || !user) { stopBridge(setBridge); return undefined; }
    let stopped = false, timer = null;
    const by = user?.email || "masaüstü";
    const tick = () => {
      if (stopped) return;
      if (!bridgeRunning()) startBridge({ tid: curTeam, rid: curRace, hz: 2, by, uid: user.uid }, setBridge);
      timer = setTimeout(tick, 4000);
    };
    tick();
    return () => { stopped = true; if (timer) clearTimeout(timer); stopBridge(setBridge); };
  }, [canEditTeam, curTeam, curRace, user]);
  return bridge;
}
