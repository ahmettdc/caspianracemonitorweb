import { useState, useEffect, useCallback, useRef } from "react";
import { isTauri } from "./tauriEnv";
import { APP_VERSION, SEEN_VER_KEY } from "./constants";

/* ============================================================
   useUpdater — güncelleme penceresinin (UpdateModal) durum/faz makinesi.
   İki kaynak, tek modal:
     • Web  — çalışan bundle yeni sürüme geçmiş (APP_VERSION, SEEN_VER_KEY'den
              farklı). "Şimdi güncelle" = sayfayı yenile. İndirme fazı yoktur.
     • Tauri— @tauri-apps/plugin-updater ile gerçek indirme; idle→downloading→ready,
              yüzde canlı, "Yeniden başlat" = relaunch.
   Faz: idle → downloading → ready. Dil modalde seçilmez (lang App'ten gelir).
   "Sonra" bu sürümü `dismissed` işaretler; aynı sürüm bir daha OTOMATİK açılmaz.
   Zorunlu mod: Tauri güncelleme notu "critical" içeriyorsa "Sonra" gizlenir,
   scrim/Esc/✕ kapatmaz.
   ============================================================ */

const DISMISS_KEY = "rc:update:dismissed";

const readLS = (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, v); } catch { /* yoksay */ } };

export function useUpdater() {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState(null);        // "web" | "tauri"
  const [phase, setPhase] = useState("idle");        // idle | downloading | ready
  const [pct, setPct] = useState(0);
  const [autoRestart, setAutoRestart] = useState(true);
  const [forced, setForced] = useState(false);
  const [meta, setMeta] = useState({ oldVersion: "", newVersion: "", size: "" });
  const tauriUpd = useRef(null);
  const autoRestartRef = useRef(true);
  autoRestartRef.current = autoRestart;

  /* Açılışta bir kez: Tauri'de gerçek denetim, web'de sürüm farkı. */
  useEffect(() => {
    let cancelled = false;

    if (!isTauri) {
      const seen = readLS(SEEN_VER_KEY);
      const dismissed = readLS(DISMISS_KEY);
      if (seen !== APP_VERSION && dismissed !== APP_VERSION) {
        setSource("web");
        setMeta({ oldVersion: seen || "", newVersion: APP_VERSION, size: "" });
        setOpen(true);
      }
      return undefined;
    }

    import("@tauri-apps/plugin-updater").then(({ check }) => check())
      .then((u) => {
        if (cancelled || !u) return;
        tauriUpd.current = u;
        const ver = u.version ? `v${String(u.version).replace(/^v/, "")}` : "";
        const critical = !!(u.body && /\bcritical\b/i.test(u.body));
        setSource("tauri");
        setForced(critical);
        setMeta({ oldVersion: APP_VERSION, newVersion: ver, size: "" });
        if (critical || readLS(DISMISS_KEY) !== ver) setOpen(true);
      })
      .catch((e) => { if (!cancelled) console.warn("Güncelleme denetimi başarısız:", e?.message || e); });

    return () => { cancelled = true; };
  }, []);

  const restart = useCallback(async () => {
    if (source !== "tauri") { window.location.reload(); return; }
    try {
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (e) { console.warn("Yeniden başlatılamadı:", e?.message || e); }
  }, [source]);

  const update = useCallback(async () => {
    /* Web: yeni bundle zaten sunucudan geliyor — sürümü görüldü işaretle, yenile. */
    if (source !== "tauri") {
      writeLS(SEEN_VER_KEY, APP_VERSION);
      window.location.reload();
      return;
    }
    const u = tauriUpd.current;
    if (!u) return;
    setPhase("downloading"); setPct(0);
    try {
      let total = 0, done = 0;
      const human = (b) => (b > 1e6 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
      await u.downloadAndInstall((ev) => {
        if (ev.event === "Started") { total = ev.data.contentLength || 0; if (total) setMeta((m) => ({ ...m, size: human(total) })); }
        else if (ev.event === "Progress") { done += ev.data.chunkLength || 0; if (total) setPct(Math.min(100, Math.round((done / total) * 100))); }
        else if (ev.event === "Finished") setPct(100);
      });
      setPct(100);
      setTimeout(() => {
        setPhase("ready");
        if (autoRestartRef.current) restart();
      }, 280);
    } catch (e) {
      console.warn("Güncelleme kurulamadı:", e?.message || e);
      setPhase("idle");
    }
  }, [source, restart]);

  /* "Sonra" (idle) / "Arka planda indir" (downloading): modalı kapat.
     idle iken sürümü dismissed işaretle → aynı sürüm tekrar otomatik açılmaz.
     downloading iken kapat ama indirme arka planda sürer. */
  const later = useCallback(() => {
    if (phase !== "downloading") {
      if (source === "web") writeLS(SEEN_VER_KEY, APP_VERSION);
      else writeLS(DISMISS_KEY, meta.newVersion || "");
    }
    setOpen(false);
  }, [phase, source, meta.newVersion]);

  /* ✕ / scrim / Esc: yalnız kapat (dismissed işaretlemez; sonraki oturumda döner). */
  const close = useCallback(() => { if (!forced) setOpen(false); }, [forced]);

  const toggleAuto = useCallback(() => setAutoRestart((v) => !v), []);

  /* Manuel "Güncellemeleri denetle": dismissed'a bakmadan aç. */
  const openManual = useCallback(() => {
    if (isTauri) {
      import("@tauri-apps/plugin-updater").then(({ check }) => check()).then((u) => {
        if (!u) return;
        tauriUpd.current = u;
        const ver = u.version ? `v${String(u.version).replace(/^v/, "")}` : "";
        setSource("tauri"); setForced(!!(u.body && /\bcritical\b/i.test(u.body)));
        setMeta({ oldVersion: APP_VERSION, newVersion: ver, size: "" });
        setPhase("idle"); setPct(0); setOpen(true);
      }).catch(() => {});
    } else {
      setSource("web");
      setMeta({ oldVersion: readLS(SEEN_VER_KEY) || "", newVersion: APP_VERSION, size: "" });
      setPhase("idle"); setOpen(true);
    }
  }, []);

  return {
    open, phase, pct, autoRestart, forced, source, meta,
    update, restart, later, close, toggleAuto, openManual,
  };
}
