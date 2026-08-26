import { useEffect, useState } from "react";
import { isTauri } from "./tauriEnv";
import { Icon } from "./components";

/* Masaüstü (Tauri) kabuğu içinde çalışırken başlangıçta güncelleme kontrol
   eder; varsa küçük bir şerit gösterir. Web derlemesinde (isTauri=false)
   hiçbir şey render etmez ve @tauri-apps/plugin-updater'ı hiç import etmez
   (dinamik import — web bundle'ına dahil olmaz). */
export default function UpdateBanner({ t }) {
  const [update, setUpdate] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | checking | available | downloading | ready | error
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (!isTauri) return undefined;
    let cancelled = false;
    setStatus("checking");
    import("@tauri-apps/plugin-updater").then(({ check }) => check())
      .then((u) => {
        if (cancelled) return;
        if (u) { setUpdate(u); setStatus("available"); } else setStatus("idle");
      })
      .catch((e) => {
        console.warn("Güncelleme kontrolü başarısız:", e?.message || e);
        if (!cancelled) setStatus("idle");
      });
    return () => { cancelled = true; };
  }, []);

  const install = async () => {
    if (!update) return;
    setStatus("downloading");
    try {
      let total = 0;
      let done = 0;
      await update.downloadAndInstall((ev) => {
        if (ev.event === "Started") total = ev.data.contentLength || 0;
        else if (ev.event === "Progress") {
          done += ev.data.chunkLength || 0;
          if (total) setPct(Math.min(100, Math.round((done / total) * 100)));
        }
      });
      setStatus("ready");
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (e) {
      console.warn("Güncelleme kurulamadı:", e?.message || e);
      setStatus("error");
    }
  };

  if (!isTauri || status === "idle" || status === "checking") return null;

  return (
    <div className="updatebar" role="status">
      {status === "available" && (<>
        <span><Icon name="yukle" size={14} /> {t("Yeni sürüm hazır")}{update?.version ? ` — v${update.version}` : ""}</span>
        <button className="act" onClick={install}>{t("Güncelle")}</button>
      </>)}
      {status === "downloading" && <span>{t("İndiriliyor")}… {pct}%</span>}
      {status === "ready" && <span>{t("Yeniden başlatılıyor")}…</span>}
      {status === "error" && (
        <span style={{ color: "var(--red)" }}>{t("Güncelleme başarısız — sonra tekrar denenecek")}</span>
      )}
    </div>
  );
}
