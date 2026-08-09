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
import { startBridge, stopBridge, bridgeRunning } from "./liveBridge";

export function useLiveBridge({ isMember, curTeam, curRace, user, noRest = false }) {
  const [bridge, setBridge] = useState({ supported: isTauri, running: false, phase: "idle", msg: "" });
  useEffect(() => {
    if (!isTauri) return undefined;
    if (!isMember || !curTeam || !curRace || !user) { stopBridge(setBridge); return undefined; }
    let stopped = false, timer = null;
    const by = user?.email || "masaüstü";
    const tick = () => {
      if (stopped) return;
      // noRest değişince deps yeniden çalışır → cleanup stopBridge, burada yeni bayrakla
      // yeniden başlar (yarış değişimindeki restart deseninin aynısı → güvenli).
      if (!bridgeRunning()) startBridge({ tid: curTeam, rid: curRace, hz: 2, by, uid: user.uid, noRest }, setBridge);
      timer = setTimeout(tick, 4000);
    };
    tick();
    return () => { stopped = true; if (timer) clearTimeout(timer); stopBridge(setBridge); };
  }, [isMember, curTeam, curRace, user, noRest]);
  return bridge;
}
