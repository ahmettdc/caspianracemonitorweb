/* ============================================================
   useRaceSync — işbirlikçi yarış-durumu senkronizasyonu (son yazan kazanır)
   ------------------------------------------------------------
   App.jsx'ten çıkarıldı. DİKKAT: bu, işbirlikçi düzenlemenin kalbidir; mantık ve
   TÜM zamanlama (debounce, `applying` bayrağı, rev karşılaştırması) BİREBİR taşındı.
   Custom hook App'e satır-içi genişlediğinden effect listesi/sırası ve paylaşılan
   ref'ler (sync, stRef) aynı davranır — davranış değişmez.

   Akış:
   - Her `st` değişiminde (kullanıcı kaynaklı) 800 ms debounce ile Firebase'e YAZ
     (yalnız editör; `applying` sırasında yazma — uzak yükleme yankılanmaz).
   - `curRace` için canlı DİNLE; gelen rev daha yeniyse uzak durumu uygula
     (safeParseState + migrate), `applying` bayrağıyla yankı-döngüsünü engelle.

   openRace/leaveRace App'te KALIR (navigasyon durumuna dokunur); dönen `sync` ref'ini
   ve setSyncMsg/setLastSync'i kullanır — aynı `sync` nesnesi paylaşılır.

   Girdi: { st, setSt, curRace, curTeamRef, role, userName, stRef, t }.
   Çıktı: { syncMsg, setSyncMsg, lastSync, setLastSync, sync }. */
import { useState, useEffect, useRef } from "react";
import { raceStateSet, raceStateSubscribe } from "./storage";
import { migrate } from "./engine";
import { safeParseState } from "./state";

export function useRaceSync({ st, setSt, curRace, curTeamRef, role, userName, stRef, t }) {
  const [syncMsg, setSyncMsg] = useState("");
  const [lastSync, setLastSync] = useState(null); // {by, at}
  const sync = useRef({ rev: 0, applying: false, timer: null });

  const pushState = async (rid) => {
    try {
      const rev = sync.current.rev + 1;
      await raceStateSet(curTeamRef.current, rid, {
        stateJson: JSON.stringify(stRef.current), rev,
        updatedBy: userName || "isimsiz", updatedAt: Date.now(),
      });
      sync.current.rev = rev; setLastSync({ by: t("sen"), at: Date.now() }); setSyncMsg("");
    } catch { setSyncMsg(t("Yazma hatası — tekrar denenecek")); }
  };

  const schedulePush = () => {
    if (!curRace || role !== "editor" || sync.current.applying) return;
    clearTimeout(sync.current.timer);
    sync.current.timer = setTimeout(() => pushState(curRace), 800);
  };

  // her state değişiminde (kullanıcı kaynaklı) paylaş
  useEffect(() => { schedulePush(); /* eslint-disable-next-line */ }, [st]);

  // odayı anlık dinle (Firebase onValue — polling'e gerek yok)
  useEffect(() => {
    if (!curRace) return undefined;
    const off = raceStateSubscribe(curTeamRef.current, curRace, (remote) => {
      if (remote.rev > sync.current.rev) {
        /* bozuk/yarım uzak veri gelirse rev'i ilerletme, son iyi durumu koru */
        const parsed = safeParseState(remote.stateJson);
        if (!parsed) { console.warn("Bozuk uzak state atlandı (rev", remote.rev, ")"); return; }
        sync.current.applying = true;
        sync.current.rev = remote.rev;
        setSt(migrate(parsed));
        setLastSync({ by: remote.updatedBy, at: remote.updatedAt });
        /* başka bir editör yazdı → kısa görünürlük uyarısı (son yazan kazanır) */
        if (remote.updatedBy && remote.updatedBy !== userName)
          setSyncMsg(t("Uzaktan güncellendi: ") + remote.updatedBy);
        setTimeout(() => { sync.current.applying = false; }, 50);
      }
    });
    return () => off();
  }, [curRace]);

  return { syncMsg, setSyncMsg, lastSync, setLastSync, sync };
}
