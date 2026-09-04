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
   Çıktı: { syncMsg, setSyncMsg, lastSync, setLastSync, sync, pushState,
            cancelPending, flushPending }.
   Oda değiştirirken ikisi de ÇAĞRILMALI (openRace/leaveRace): önce
   `flushPending` (bekleyen düzenleme HÂLÂ AÇIK odaya yazılsın), sonra
   `cancelPending` (geride zamanlayıcı kalmasın). */
import { useState, useEffect, useRef } from "react";
import { raceStateSet, raceStateSubscribe } from "./storage";
import { migrate } from "./engine";
import { safeParseState } from "./state";
import { shouldPush, shouldApplyRemote } from "./raceSyncGate";

export function useRaceSync({ st, setSt, curRace, curTeamRef, role, userName, stRef, t }) {
  const [syncMsg, setSyncMsg] = useState("");
  const [lastSync, setLastSync] = useState(null); // {by, at}
  const sync = useRef({ rev: 0, applying: false, timer: null, mineAt: null,
    lastAppliedJson: null });   // yankı koruması — bkz. pushState
  /* Hangi odadayız — bekleyen yazımın hedefiyle karşılaştırmak için.
     Effect'te güncellenir; debounce en az 800 ms olduğundan timer ateşlendiğinde
     ref güncel olur. */
  const curRaceRef = useRef(curRace);
  useEffect(() => { curRaceRef.current = curRace; }, [curRace]);

  /* Bekleyen (debounce + retry) yazımları İPTAL et. Oda değiştirirken şart:
     zamanlayıcı `rid`'i yakalar ama `stRef.current`'ı ATEŞLENDİĞİNDE okur.
     Aradan oda değişirse YENİ odanın state'i ESKİ odanın yoluna yazılıyordu —
     rev arttığı için eski odadaki diğer editörler de bunu uyguluyor ve o
     yarışın planı HER CİHAZDA kayboluyordu (v2.4.1). */
  const cancelPending = () => {
    clearTimeout(sync.current.timer); sync.current.timer = null;
    clearTimeout(sync.current.retry); sync.current.retry = null;
  };

  const pushState = async (rid, attempt = 0) => {
    const tid = curTeamRef.current;
    /* Gerekçe ve iki kapının NEDEN ikisinin de gerektiği: raceSyncGate.js.
       Eskiden `applying`'e yalnız `schedulePush` bakıyordu; `pushState` hiç
       bakmıyordu ve hedef odayı hiç doğrulamıyordu. */
    if (!shouldPush(sync.current.applying, rid, curRaceRef.current)) return;
    const stateJson = JSON.stringify(stRef.current);
    /* YANKI YAZIMI (v2.4.1): uzak durumu uyguladıktan sonra yankıyı engelleyen
       tek şey 50 ms'lik bir zamanlayıcıydı. `setSt(migrate(parsed))` her
       seferinde YENİ bir nesne ürettiği için `useEffect([st])` mutlaka
       ateşleniyor; render + effect zinciri 50 ms'yi aşarsa (yavaş cihaz, canlı
       timing yoğunken 14+ stintlik büyük bir state) bayrak çoktan düşmüş oluyor
       ve istemci ALDIĞI state'i rev+1 ile geri yazıyordu. Karşı taraf bunu yeni
       sürüm sanıp uyguluyor, o da yankı yazıyor → iki istemci arasında sonu
       gelmeyen yazım gidip gelmesi (Firebase trafiği + "Uzaktan güncellendi"
       uyarısının sürekli yanıp sönmesi).
       Süre varsayımı yerine KİMLİK: yazılacak içerik en son UYGULADIĞIMIZ
       içerikle birebir aynıysa yazacak bir şey yok. */
    if (stateJson === sync.current.lastAppliedJson) return;
    try {
      const rev = sync.current.rev + 1;
      const updatedAt = Date.now();
      await raceStateSet(tid, rid, {
        stateJson, rev, updatedBy: userName || "isimsiz", updatedAt,
      });
      sync.current.rev = rev;
      /* Kendi yazımımızın damgası — aynı rev'te BAŞKASININ yazımı geri gelirse
         (rev çakışması) ayırt edebilmek için. Bkz. raceSyncGate.shouldApplyRemote. */
      sync.current.mineAt = updatedAt;
      setLastSync({ by: t("sen"), at: updatedAt }); setSyncMsg("");
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
    cancelPending();                    // bekleyen retry dahil — yeni push güncel state'i yazar
    sync.current.timer = setTimeout(() => pushState(curRace), 800);
  };

  /* Bekleyen (debounce'lu) yazımı HEMEN gönder — sekme/pencere kapanmadan ya da arka
     plana alınmadan önce. Böylece son düzenleme 800 ms'yi beklemeden Firebase'e ulaşır
     ve normal kapanış/sekme değişiminde veri kaybı olmaz. Yazım async'tir; pagehide'da
     await edemeyiz ama açık bağlantıda istek yola çıkar. */
  const flush = () => {
    if (!curRace || role !== "editor" || sync.current.applying) return;
    if (!sync.current.timer && !sync.current.retry) return;   // bekleyen yok
    cancelPending();
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
      if (shouldApplyRemote(remote.rev, remote.updatedAt,
        sync.current.rev, sync.current.mineAt)) {
        /* bozuk/yarım uzak veri gelirse rev'i ilerletme, son iyi durumu koru */
        const parsed = safeParseState(remote.stateJson);
        if (!parsed) { console.warn("Bozuk uzak state atlandı (rev", remote.rev, ")"); return; }
        sync.current.applying = true;
        sync.current.lastAppliedJson = remote.stateJson;
        sync.current.rev = remote.rev;
        /* Uzak durumu aldık → artık "benim yazımım" diye bekleyen bir damga yok.
           Aksi halde aynı rev tekrar gelirse sonsuz uygulama döngüsü olurdu. */
        sync.current.mineAt = null;
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

  return { syncMsg, setSyncMsg, lastSync, setLastSync, sync, pushState,
    cancelPending, flushPending: flush };
}
