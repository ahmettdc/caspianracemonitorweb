/* ============================================================
   useLiveSync — stint planını canlı timing'e senkronlayan otomasyonlar
   ------------------------------------------------------------
   Stint bölümü canlıdan önce tasarlandı; pit işaretleme ve yarış saati elle
   giriliyordu. Bu hook köprünün gerçeğini plana bağlar (karar mantığı saf
   liveSync.js'te):

   - Oto-PIT: araç pit yoluna girince markPit otomatik basılır.
   - Oto-saat: planın geri sayımı oyunun timeLeftSec'inden >5 sn kayınca
     raceStartMs hizalanır (30 sn'de bir en fazla).
   Yazan otomasyonlar YALNIZ canlı kareyi yazan istemcide tetiklenir
   (live.by === user.email — sürüş PC'si; lease tek yazıcı garanti eder) →
   izleyici PC'ler aynı anda yazmaz. Öneriler (hava, avg lap) her editor'da
   gösterilir; uygulamak tek tık, otomatik yazmaz.

   Aç/kapa tercihleri cihaza aittir (localStorage) — odaya senkron edilmez.
   Dönüş: { sync, setSyncOpt, drift, lastAuto, wxSug, avgSug, pitMismatch }. */
import { useState, useEffect, useMemo, useRef } from "react";
import { detectPitEntry, clockDriftSec, alignedStartMs, weatherSuggestion,
  avgLapSuggestion, isFrameFresh } from "./liveSync";
import { serverNow } from "./storage";

const LS_KEY = "caspian.liveSync";
const DEFAULTS = { autoPit: true, autoClock: true };
const DRIFT_MIN = 5;        // sn — bu eşikten küçük kaymaya dokunma (timeLeftSec ±1 sn titrer)
const ALIGN_COOLDOWN = 30000; // ms — art arda düzeltme yok

export function useLiveSync({ live, st, liveInfo, up, markPit, canEdit, user }) {
  const [sync, setSync] = useState(() => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS_KEY) || "{}") }; }
    catch { return { ...DEFAULTS }; }
  });
  const setSyncOpt = (k, v) => setSync((s) => {
    const nx = { ...s, [k]: v };
    try { localStorage.setItem(LS_KEY, JSON.stringify(nx)); } catch { /* yoksay */ }
    return nx;
  });

  const [lastAuto, setLastAuto] = useState(null);  // { stint, at } — "🤖 işaretlendi" rozeti
  const [drift, setDrift] = useState(null);        // sn — kayma çipi (izleyicide de görünür)
  const prevOwnRef = useRef(null);
  const prevSidRef = useRef(null);   // seans belirteci — değişince prevOwn geçersiz
  const lastAlignRef = useRef(0);

  // Senkron YALNIZ YARIŞ seansında: antrenman/sıralamada oto-PIT, saat hizalama ve
  // hava/avgLap önerileri anlamsız (pit stratejisi ve geri sayım yarışa özgü).
  const isRace = live?.session?.sessionType === "Yarış";

  /* Kare başına tetikleme — yalnız canlı kareyi YAZAN istemci durum yazar. */
  useEffect(() => {
    const own = live?.own;
    /* SEANS DEĞİŞTİYSE önceki kare geçersizdir. Aksi halde antrenman→yarış
       geçişinde (ya da köprü yeniden başlayınca) iki farklı seansın karesi
       karşılaştırılıp sahte bir pit girişi üretilebiliyordu. Yarış değişimini
       useLive zaten `setLive(null)` ile kapatıyor; bu, aynı odadaki seans
       değişiminin karşılığı. */
    const sid = live?.session?.sessionId ?? null;
    const prevOwn = prevSidRef.current === sid ? prevOwnRef.current : null;
    prevSidRef.current = sid;
    prevOwnRef.current = own || null;
    const now = Date.now();
    const amWriter = !!live?.by && !!user?.email && live.by === user.email;

    const d = clockDriftSec(st, live?.session, now);
    setDrift((p) => (p === d ? p : d));   // skaler/null — değişmediyse render tetikleme

    if (!canEdit || !amWriter || !isRace) return;
    /* BAYAT KARE PLANA YAZAMAZ (bkz. liveSync.isFrameFresh). Karenin ts'i
       server-hizalı yazılır, bu yüzden serverNow() ile karşılaştırılır. */
    if (!isFrameFresh(live?.ts, serverNow())) return;

    // Oto-PIT: pit yoluna giriş karesi → markPit (applyMarkPit pit fazında/çiftte null)
    if (sync.autoPit && detectPitEntry(prevOwn, own)
        && liveInfo.status === "live" && liveInfo.phase === "stint") {
      markPit();
      setLastAuto({ stint: liveInfo.stintIdx + 1, at: now });
    }

    // Oto-saat: |kayma| > eşik → raceStartMs'i oyuna hizala (cooldown'lu)
    if (sync.autoClock && d != null && Math.abs(d) > DRIFT_MIN
        && now - lastAlignRef.current > ALIGN_COOLDOWN) {
      lastAlignRef.current = now;
      up({ raceStartMs: alignedStartMs(st, live.session, now) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live?.ts]);

  const wxSug = useMemo(() => (isRace ? weatherSuggestion(live?.session, st) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isRace, live?.session?.rain, live?.session?.wetness, st.weatherLog, st.weather]);
  const avgSug = useMemo(() => (isRace ? avgLapSuggestion(live?.own, st) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isRace, live?.own?.avg5Sec, st.avgLap]);

  /* Oyun pit sayısı ↔ planda işaretli pit sayısı tutarsızlığı (salt gösterge; yalnız yarış) */
  const pitMismatch = useMemo(() => {
    const gamePits = live?.own?.pitStops;
    if (!isRace || !(gamePits > 0) || liveInfo.status !== "live") return null;
    const marked = liveInfo.pitsDone || 0;
    return gamePits !== marked ? { game: gamePits, marked } : null;
  }, [isRace, live?.own?.pitStops, liveInfo]);

  return { sync, setSyncOpt, drift, lastAuto, wxSug, avgSug, pitMismatch };
}
