/* ============================================================
   useSetups — ortak setup deposu: liste aboneliği, yükleme, indirme, süzgeç
   ------------------------------------------------------------
   App.jsx'ten çıkarıldı (Tanrı-bileşen borcunu azaltan güvenli dilim). Davranış
   BİREBİR korunur — mantık ve bağımlılıklar aynen taşındı. Sohbetin aksine
   zamanlama/scroll/effect-sırası riski yok (tek abonelik + form state + 3 handler).

   Girdi: { user, udoc, userName, teamData, t, active }.
     active — havuz görünür mü (Setup sekmesi ya da lobi penceresi açık). Abonelik
     buna bağlıdır: kapalıyken hiç abone olunmaz. Eskiden yalnız user/allowed'a
     bağlıydı → kullanıcı Setup'a hiç girmese bile TÜM havuz (her kaydın base64
     `data` alanı dahil, kayıt başına ~254 KB'a kadar) girişte iniyordu.
   Çıktı (App render'ının kullandığı yüzey):
     { setups, suFile, suMeta, setSuMeta, suErr, suMsg, suBusy,
       suUpOpen, setSuUpOpen, suFTrack, setSuFTrack, suFCond, setSuFCond,
       suFSess, setSuFSess, onSetupFile, saveSetup, downloadSetup, suList }. */
import { useState, useEffect } from "react";
import { addSetup, watchSetups } from "./storage";
import { fileTooBig, filterSetups, trimSetupMeta, staleTrackFilter } from "./setupPool";

export function useSetups({ user, udoc, userName, teamData, t, active = true }) {
  const [setups, setSetups] = useState([]);
  const [suFile, setSuFile] = useState(null);       // { name, b64, size }
  const [suMeta, setSuMeta] = useState({ track: "", cls: "", car: "",
    cond: "dry", sess: "R", champ: "", ver: "", note: "" });
  const [suErr, setSuErr] = useState("");
  const [suMsg, setSuMsg] = useState("");          // başarı geri bildirimi ("✓ yüklendi")
  const [suBusy, setSuBusy] = useState(false);
  /* suOpen (lobi penceresi) App'te tutulur: aboneliği açan `active` girdisini o
     belirlediği için burada olsaydı döngüsel bağımlılık olurdu. */
  const [suUpOpen, setSuUpOpen] = useState(false);  // lobi yükleme formu açık mı
  const [suFTrack, setSuFTrack] = useState("");     // liste süzgeçleri
  const [suFCond, setSuFCond] = useState("");
  const [suFSess, setSuFSess] = useState("");

  /* Abonelik yalnız havuz görünürken (active) — bkz. başlıktaki not. */
  useEffect(() => {
    if (!user || !udoc?.allowed || !active) { setSetups([]); return undefined; }
    return watchSetups(setSetups);
  }, [user, udoc, active]);

  const onSetupFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setSuMsg("");
    if (fileTooBig(f.size)) {
      /* Sahnedeki dosya MUTLAKA temizlenir: eskiden eski dosya sahnede kalıyor,
         "çok büyük" uyarısına rağmen Yükle aktif kaldığı için basınca ESKİ dosya
         yükleniyordu (kullanıcı yenisini yüklediğini sanıyordu). */
      setSuFile(null);
      setSuErr(t("Dosya çok büyük (sınır 180 KB) — setup dosyaları normalde birkaç KB'dır."));
      return;
    }
    const rd = new FileReader();
    rd.onload = () => {
      const b64 = String(rd.result).split(",")[1] || "";
      setSuFile({ name: f.name, b64, size: f.size });
      setSuErr("");
    };
    /* Okuma hatası eskiden sessizdi: ne dosya sahneye giriyor ne uyarı çıkıyordu. */
    rd.onerror = () => { setSuFile(null); setSuErr(t("Dosya okunamadı — tekrar deneyin.")); };
    rd.readAsDataURL(f);
  };

  const saveSetup = async () => {
    // Takım şartı YOK: setup'lar global havuza yazılır; onaylı her kullanıcı
    // (takımı olmasa da) yükleyebilir. team meta'sı varsa etiket, yoksa boş.
    if (!suFile || suBusy) return;
    if (!suMeta.track) { setSuErr(t("Pist seçilmeli.")); return; }
    setSuBusy(true);
    const trimmed = trimSetupMeta(suMeta);   // champ/ver/note kırpma tek sözleşmeden
    try {
      await addSetup(user, {
        name: suFile.name, size: suFile.size,
        uname: userName || user.displayName || "",
        team: teamData?.meta?.name || "",
        track: trimmed.track, cls: trimmed.cls, car: trimmed.car,
        cond: trimmed.cond, sess: trimmed.sess,
        champ: trimmed.champ, ver: trimmed.ver, note: trimmed.note,
      }, suFile.b64);
      const nm = suFile.name;
      setSuFile(null);
      setSuMeta((m) => ({ ...m, note: "" }));
      setSuErr("");
      /* Başarı geri bildirimi — eskiden yalnız dosya çipi kayboluyordu, "oldu mu?"
         belirsizdi (v1.4.77'de bildirilen sessizlik sınıfı). */
      setSuMsg(`✓ ${t("Setup yüklendi")}: ${nm}`);
    } catch (e2) {
      setSuMsg("");
      setSuErr(t("Yüklenemedi:") + " " + (e2?.message || ""));
    }
    setSuBusy(false);
  };

  /* başarı mesajı birkaç saniye sonra kendiliğinden silinir */
  useEffect(() => {
    if (!suMsg) return undefined;
    const id = setTimeout(() => setSuMsg(""), 4000);
    return () => clearTimeout(id);
  }, [suMsg]);

  const downloadSetup = (su) => {
    try {
      const bin = atob(su.data || "");
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr]));
      const a = document.createElement("a");
      a.href = url; a.download = su.name || "setup";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch { /* bozuk kayıt */ }
  };

  /* "Hayalet süzgeç": seçili pistin son setup'ı silinince pist <select>'inden o
     option kalkıyor (liste yalnız havuzdaki pistleri gösterir) → kutu boş görünüyor
     ama süzgeç hâlâ uygulanıyordu, liste boş kalıp sebebi görünmüyordu. */
  useEffect(() => {
    if (setups.length && staleTrackFilter(setups, suFTrack)) setSuFTrack("");
  }, [setups, suFTrack]);

  const suList = filterSetups(setups, { track: suFTrack, cond: suFCond, sess: suFSess });

  return { setups, suFile, suMeta, setSuMeta, suErr, suMsg, suBusy,
    suUpOpen, setSuUpOpen, suFTrack, setSuFTrack,
    suFCond, setSuFCond, suFSess, setSuFSess,
    onSetupFile, saveSetup, downloadSetup, suList };
}
