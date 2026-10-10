/* ============================================================
   MapWindow — ⧉ ayrı PİST HARİTASI penceresi (yalnız masaüstü .exe)
   ------------------------------------------------------------
   NEDEN: Tarayıcıda "⧉ Pencere" düğmesi `window.open("", …)` ile açılan bir
   popup'a canlı SVG'yi React portalıyla basar. WebView2'de (masaüstü .exe) boş
   URL'li popup OLUŞMAZ → `window.open` null döner → düğme SESSİZCE tepkisiz kalır
   (saha bildirimi, v2.4.4). WebView2'de ayrı pencere = ayrı webview = ayrı DOM →
   portal oraya edilemez. Bu yüzden masaüstünde uygulama GERÇEK bir Tauri
   penceresinde `?view=map` moduyla açılır ve bu bileşen render edilir.

   Ana pencereden BAĞIMSIZ: canlı düğüme (teams/{tid}/live/{rid}) KENDİ aboneliğiyle
   bağlanır (LiveTab ile aynı türetim: field=live.field, session=live.session), böylece
   pencere 2. monitöre taşınabilir ve ana pencere hangi sekmede olursa olsun akar.
   Pencere SALT-OKUYUCUDUR: TrackMap'e canSave=false geçilir — şekil/sektör/pit
   gözlemlerini ana pencere zaten yazar, çift yazıcı olmasın (veri dürüstlüğü).

   Maliyet denetimi (CLAUDE.md §0): yeni REST yok, yeni yayın hızı yok. Köprüye
   (oyun PC'si) hiç dokunmaz — bu yalnız izleyici/pit duvarı tarafının bir penceresi.
   ============================================================ */
import { useState, useEffect, useCallback } from "react";
import TrackMap from "./tabs/TrackMap";
import { watchAuth } from "./auth";
import { liveTimingSubscribe } from "./storage";
import { binKey } from "./trackShape";

/* Minimal çevirmen — App'teki desenin ufak kopyası: EN sözlüğü lazy gelir
   (~70 KB; yalnız lang==="en" iken), gelene kadar anahtar (TR) gösterilir. */
function useMapT(lang) {
  const [dict, setDict] = useState(null);
  useEffect(() => {
    if (lang !== "en") return undefined;
    let on = true;
    import("./i18n").then((m) => { if (on) setDict(m.EN); }).catch(() => {});
    return () => { on = false; };
  }, [lang]);
  return useCallback((str) => (lang === "en" ? (dict?.[str] ?? str) : str), [lang, dict]);
}

export default function MapWindow() {
  const params = new URLSearchParams(window.location.search);
  const tid = params.get("tid") || "";
  const rid = params.get("rid") || "";
  const lang = params.get("lang") || "en";
  const t = useMapT(lang);

  /* Tema ana pencereyle aynı olsun — App ile birebir aynı mantık (crm-theme). */
  useEffect(() => {
    let theme = "dark";
    try { theme = localStorage.getItem("crm-theme") || "dark"; } catch { /* yoksay */ }
    try {
      document.documentElement.dataset.theme = theme;
      document.documentElement.lang = lang === "en" ? "en" : "tr";
      document.body.style.background = theme === "light" ? "#F4EEF0" : "#120C0E";
      document.body.style.margin = "0";
    } catch { /* yoksay */ }
  }, [lang]);

  /* Oturum: Firebase auth origin başına kalıcı (IndexedDB) → aynı origin'i paylaşan
     bu ikinci pencere ana pencerenin oturumunu otomatik geri yükler. Abonelik
     kullanıcı gelene kadar beklenir (uygulamanın tamamı zaten auth kapısı ardında;
     izinsiz okuma boş "permission denied" uyarısı üretmesin). */
  const [user, setUser] = useState(undefined);   // undefined=yükleniyor, null=yok
  useEffect(() => watchAuth((u) => setUser(u || null)), []);

  const [live, setLive] = useState(null);
  useEffect(() => {
    if (!user || !tid || !rid) return undefined;
    return liveTimingSubscribe(tid, rid, setLive);
  }, [user, tid, rid]);

  const s = live?.session || {};
  const field = Array.isArray(live?.field) ? live.field : [];
  const hasMap = s.trackLength > 0 && field.some((c) => c.posX != null);

  const msg = (txt) => (
    <div className="rc" style={{ display: "flex", alignItems: "center",
      justifyContent: "center", height: "100vh", textAlign: "center", padding: 24 }}>
      <span style={{ color: "var(--dim)", fontSize: 14 }}>{txt}</span>
    </div>
  );

  if (user === undefined) return msg(t("Oturum doğrulanıyor…"));
  if (user === null) return msg(t("Oturum bulunamadı — ana pencereden giriş yapın."));
  if (!tid || !rid) return msg(t("Oda bilgisi eksik."));
  if (!hasMap) return msg(t("Harita için canlı konum verisi bekleniyor…"));

  return (
    <div className="rc">
      <TrackMap t={t} field={field} session={s} trackLength={s.trackLength}
        tid={tid} rid={rid} trackKey={binKey(s.trackName, s.trackLength)}
        canSave={false} embed />
    </div>
  );
}
