/* ============================================================
   useSetups — ortak setup deposu: liste aboneliği, yükleme, indirme, süzgeç
   ------------------------------------------------------------
   App.jsx'ten çıkarıldı (Tanrı-bileşen borcunu azaltan güvenli dilim). Davranış
   BİREBİR korunur — mantık ve bağımlılıklar aynen taşındı. Sohbetin aksine
   zamanlama/scroll/effect-sırası riski yok (tek abonelik + form state + 3 handler).

   Girdi: { user, udoc, userName, teamData, t }.
   Çıktı (App render'ının kullandığı yüzey):
     { setups, suFile, suMeta, setSuMeta, suErr, suBusy, suOpen, setSuOpen,
       suUpOpen, setSuUpOpen, suFTrack, setSuFTrack, suFCond, setSuFCond,
       suFSess, setSuFSess, onSetupFile, saveSetup, downloadSetup, suList }. */
import { useState, useEffect } from "react";
import { addSetup, watchSetups } from "./storage";

export function useSetups({ user, udoc, userName, teamData, t }) {
  const [setups, setSetups] = useState([]);
  const [suFile, setSuFile] = useState(null);       // { name, b64, size }
  const [suMeta, setSuMeta] = useState({ track: "", cls: "", car: "",
    cond: "dry", sess: "R", champ: "", ver: "", note: "" });
  const [suErr, setSuErr] = useState("");
  const [suBusy, setSuBusy] = useState(false);
  const [suOpen, setSuOpen] = useState(false);      // lobi setup penceresi
  const [suUpOpen, setSuUpOpen] = useState(false);  // lobi yükleme formu açık mı
  const [suFTrack, setSuFTrack] = useState("");     // liste süzgeçleri
  const [suFCond, setSuFCond] = useState("");
  const [suFSess, setSuFSess] = useState("");

  useEffect(() => {
    if (!user || !udoc?.allowed) { setSetups([]); return undefined; }
    return watchSetups(setSetups);
  }, [user, udoc]);

  const onSetupFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 180 * 1024) {
      setSuErr(t("Dosya çok büyük (sınır 180 KB) — setup dosyaları normalde birkaç KB'dır."));
      return;
    }
    const rd = new FileReader();
    rd.onload = () => {
      const b64 = String(rd.result).split(",")[1] || "";
      setSuFile({ name: f.name, b64, size: f.size });
      setSuErr("");
    };
    rd.readAsDataURL(f);
  };

  const saveSetup = async () => {
    // Takım şartı YOK: setup'lar global havuza yazılır; onaylı her kullanıcı
    // (takımı olmasa da) yükleyebilir. team meta'sı varsa etiket, yoksa boş.
    if (!suFile || suBusy) return;
    if (!suMeta.track) { setSuErr(t("Pist seçilmeli.")); return; }
    setSuBusy(true);
    try {
      await addSetup(user, {
        name: suFile.name, size: suFile.size,
        uname: userName || user.displayName || "",
        team: teamData?.meta?.name || "",
        track: suMeta.track, cls: suMeta.cls, car: suMeta.car,
        cond: suMeta.cond, sess: suMeta.sess,
        champ: suMeta.champ.trim().slice(0, 40),
        ver: suMeta.ver.trim().slice(0, 16),
        note: suMeta.note.trim().slice(0, 140),
      }, suFile.b64);
      setSuFile(null);
      setSuMeta((m) => ({ ...m, note: "" }));
      setSuErr("");
    } catch (e2) {
      setSuErr(t("Yüklenemedi:") + " " + (e2?.message || ""));
    }
    setSuBusy(false);
  };

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

  const suList = setups.filter((x) =>
    (!suFTrack || x.track === suFTrack)
    && (!suFCond || x.cond === suFCond)
    && (!suFSess || x.sess === suFSess));

  return { setups, suFile, suMeta, setSuMeta, suErr, suBusy, suOpen, setSuOpen,
    suUpOpen, setSuUpOpen, suFTrack, setSuFTrack, suFCond, setSuFCond,
    suFSess, setSuFSess, onSetupFile, saveSetup, downloadSetup, suList };
}
