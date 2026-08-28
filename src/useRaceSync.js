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
import { raceStateSet, raceStateSubscribe, raceStateMirrorSave } from "./storage";
import { migrate } from "./engine";
import { safeParseState } from "./state";

export function useRaceSync({ st, setSt, curRace, curTeamRef, role, userName, stRef, t }) {
  const [syncMsg, setSyncMsg] = useState("");
  const [lastSync, setLastSync] = useState(null); // {by, at}
  const sync = useRef({ rev: 0, applying: false, timer: null });

  const pushState = async (rid, attempt = 0) => {
    const tid = curTeamRef.current;
    const stateJson = JSON.stringify(stRef.current);
    try {
      const rev = sync.current.rev + 1;
      const updatedAt = Date.now();
      await raceStateSet(tid, rid, {
        stateJson, rev, updatedBy: userName || "isimsiz", updatedAt,
      });
      sync.current.rev = rev; setLastSync({ by: t("sen"), at: updatedAt }); setSyncMsg("");
      /* Firebase'e ULAŞTI → yerel aynayı TEMİZ (dirty:false) ve yeni rev ile işaretle:
         sonraki açılışta gönderilmemiş düzenleme yok sayılır, gereksiz reconcile olmaz. */
      raceStateMirrorSave(tid, rid, stateJson, rev, false);
    } catch (e) {
      /* Eskiden "tekrar denenecek" yazıp aslında denemiyordu → geçici bir yazma hatasında
         (ör. telemetri yüklemesi) veri sessizce kayboluyordu. Artık gerçek exponential
         backoff ile 4 kez yeniden dener (stRef güncel state'i okur, güncel veri yazılır). */
      if (attempt < 4) {
        setSyncMsg(t("Yazma hatası — tekrar denenecek"));
        clearTimeout(sync.current.retry);
        sync.current.retry = setTimeout(() => pushState(rid, attempt + 1), 1000 * 2 ** attempt);
      } else {
        console.warn("Yarış state yazımı başarısız:", e?.message || e);
        setSyncMsg(t("Yazma başarısız — bağlantını kontrol et"));
      }
    }
  };

  const schedulePush = () => {
    if (!curRace || role !== "editor" || sync.current.applying) return;
    /* Firebase yazımı 800 ms debounce'lu; ama yerel aynayı HEMEN (senkron) ve
       GÖNDERİLMEMİŞ (dirty:true) olarak yaz — mevcut sunucu rev'i üzerine yapılan
       düzenleme olarak damgala. Uygulama debounce dolmadan/uçuşan yazım bitmeden
       kapansa bile veri kalır; açılışta rev eşleşirse güvenle geri yüklenir. */
    raceStateMirrorSave(curTeamRef.current, curRace, JSON.stringify(stRef.current), sync.current.rev, true);
    clearTimeout(sync.current.timer);
    clearTimeout(sync.current.retry);   // bekleyen retry'ı iptal et — yeni push güncel state'i yazar
    sync.current.timer = setTimeout(() => pushState(curRace), 800);
  };

  /* Bekleyen (debounce'lu) yazımı HEMEN gönder — sekme/pencere kapanmadan ya da arka
     plana alınmadan önce. Böylece son düzenleme 800 ms'yi beklemeden Firebase'e ulaşır
     ve "kapatıp açınca eski değere döndü" sorunu normal kapanışta yaşanmaz (mirror
     yalnız ani/zorla kapanma için güvenlik ağı kalır). Yazım async'tir; pagehide'da
     await edemeyiz ama açık bağlantıda istek yola çıkar. */
  const flush = () => {
    if (!curRace || role !== "editor" || sync.current.applying) return;
    if (!sync.current.timer && !sync.current.retry) return;   // bekleyen yok
    clearTimeout(sync.current.timer); sync.current.timer = null;
    clearTimeout(sync.current.retry); sync.current.retry = null;
    pushState(curRace);
  };

  // her state değişiminde (kullanıcı kaynaklı) paylaş
  useEffect(() => { schedulePush(); /* eslint-disable-next-line */ }, [st]);

  // sekme gizlenince / sayfa kapanınca bekleyen yazımı hemen gönder (veri kaybını önle)
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
    /* eslint-disable-next-line */
  }, [curRace, role]);

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

  return { syncMsg, setSyncMsg, lastSync, setLastSync, sync, pushState };
}
