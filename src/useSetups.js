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
import { addSetup, watchSetups, getSetupBlob } from "./storage";
import { fileTooBig, filterSetups, trimSetupMeta, staleTrackFilter,
  searchSetups, sortSetups, b64Sha256Hex, setupFileName, withFileNames } from "./setupPool";
import { parseSvm, b64ToText } from "./setupParse";
import { detectVehicle } from "./setupAutofill";
import { carName } from "./constants";
import { confirmDialog, alertDialog } from "./confirm";

export function useSetups({ user, udoc, userName, teamData, t, active = true,
  raceSel = null }) {
  const [setups, setSetups] = useState([]);
  const [suFile, setSuFile] = useState(null);       // { name, b64, size }
  const [suMeta, setSuMeta] = useState({ track: "", cls: "", car: "",
    cond: "dry", sess: "R", champ: "", ver: "", note: "", lap: "", pilot: "" });
  const [suErr, setSuErr] = useState("");
  const [suMsg, setSuMsg] = useState("");          // başarı geri bildirimi ("✓ yüklendi")
  const [suBusy, setSuBusy] = useState(false);
  /* suOpen (lobi penceresi) App'te tutulur: aboneliği açan `active` girdisini o
     belirlediği için burada olsaydı döngüsel bağımlılık olurdu. */
  const [suUpOpen, setSuUpOpen] = useState(false);  // lobi yükleme formu açık mı
  const [suFTrack, setSuFTrack] = useState("");     // liste süzgeçleri
  const [suFCond, setSuFCond] = useState("");
  const [suFSess, setSuFSess] = useState("");
  const [suQuery, setSuQuery] = useState("");       // serbest metin arama
  const [suSort, setSuSort] = useState({ key: "date", dir: "desc" }); // sıralama
  const [suMine, setSuMine] = useState(false);      // yalnız benim yüklediklerim
  const [suLimit, setSuLimit] = useState(150);      // sayfalama: son N kayıt

  /* Abonelik yalnız havuz görünürken (active) — bkz. başlıktaki not.
     limitToLast(suLimit): "Daha fazla yükle" limiti artırıp yeniden abone olur. */
  useEffect(() => {
    if (!user || !udoc?.allowed || !active) { setSetups([]); return undefined; }
    /* withFileNames: ad META'DAN türetilir (bkz. setupPool). Tek enjeksiyon
       noktası — süzme/arama/sıralama/pencere/indirme hepsi bunu kullanır. */
    return watchSetups((rows) => setSetups(withFileNames(rows)), suLimit);
  }, [user, udoc, active, suLimit]);

  /* Pencere doluysa (tam limit kadar kayıt indiyse) muhtemelen devamı vardır. */
  const suHasMore = setups.length >= suLimit;
  const loadMoreSetups = () => setSuLimit((n) => n + 150);

  /* Ortak dosya alma yolu — hem <input type=file> hem sürükle-bırak buradan geçer. */
  const handleFile = (f) => {
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
      /* Otomatik algılama: dosyanın VehicleClassSetting satırından sınıf/araç.
         Kullanıcının elle yaptığı seçim EZİLMEZ — yalnız boş alanlar dolar. */
      const v = detectVehicle(parseSvm(b64ToText(b64)));
      if (v) {
        setSuMeta((m) => {
          if (!m.cls && !m.car) return { ...m, cls: v.cls, car: v.car };
          if (m.cls === v.cls && !m.car) return { ...m, car: v.car };
          return m;
        });
        setSuMsg(`✓ ${t("Araç dosyadan algılandı")}: ${carName(v.cls, v.car)}`);
      }
    };
    /* Okuma hatası eskiden sessizdi: ne dosya sahneye giriyor ne uyarı çıkıyordu. */
    rd.onerror = () => { setSuFile(null); setSuErr(t("Dosya okunamadı — tekrar deneyin.")); };
    rd.readAsDataURL(f);
  };

  const onSetupFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    handleFile(f);
  };

  /* Sürükle-bırak: SetupForm'daki .sudrop bölgesi çağırır. */
  const onSetupDrop = (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer?.files?.[0]);
  };

  /* Aktif yarıştan ön-doldurma: form görünür olduğunda BOŞ alanlar yarış seçiminden
     dolar (pist/sınıf/araç). Kullanıcının doldurduğu alanlara dokunulmaz; araç yalnız
     sınıf yarışınkiyle aynıysa alınır. */
  useEffect(() => {
    if (!active || !raceSel?.track) return;
    setSuMeta((m) => {
      const cls = m.cls || raceSel.cls || "";
      return {
        ...m,
        track: m.track || raceSel.track || "",
        cls,
        car: m.car || (cls === raceSel.cls ? raceSel.car || "" : ""),
      };
    });
  }, [active]);  // eslint-disable-line react-hooks/exhaustive-deps

  const saveSetup = async () => {
    // Takım şartı YOK: setup'lar global havuza yazılır; onaylı her kullanıcı
    // (takımı olmasa da) yükleyebilir. team meta'sı varsa etiket, yoksa boş.
    if (!suFile || suBusy) return;
    if (!suMeta.track) { setSuErr(t("Pist seçilmeli.")); return; }
    setSuBusy(true);
    const trimmed = trimSetupMeta(suMeta);   // champ/ver/note kırpma tek sözleşmeden
    /* Mükerrer koruması: aynı içeriğin SHA-256'sı yüklü penceredeki bir kayıtla
       eşleşirse kullanıcıya sor. Dürüst kısıt: yalnız o an inmiş liste penceresi
       kontrol edilir; eski (hash'siz) kayıtlar yakalanmaz. */
    const hash = await b64Sha256Hex(suFile.b64);
    if (hash) {
      const dup = setups.find((x) => x.hash === hash);
      if (dup && !(await confirmDialog({
        title: t("Mükerrer setup"),
        message: `${t("Bu dosya zaten havuzda")}: ${dup.name || "?"} · ${dup.uname || "?"}\n`
          + t("Yine de yüklensin mi?"),
        confirmText: t("Yükle") }))) {
        setSuBusy(false);
        return;
      }
    }
    try {
      /* Standart ad meta'dan (kırpılmış) türetilir; türetilemezse ham ada düşer.
         Kayıtta DA saklanır ki veritabanı tutarlı olsun — okuma yolu
         (withFileNames) eski kayıtlar için zaten yeniden türetiyor. */
      const stdName = setupFileName(trimmed) || suFile.name;
      await addSetup(user, {
        name: stdName,
        origName: suFile.name, size: suFile.size,
        uname: userName || user.displayName || "",
        team: teamData?.meta?.name || "",
        track: trimmed.track, cls: trimmed.cls, car: trimmed.car,
        cond: trimmed.cond, sess: trimmed.sess,
        champ: trimmed.champ, ver: trimmed.ver, note: trimmed.note, lap: trimmed.lap,
        ...((suMeta.pilot || "").trim() ? { pilot: (suMeta.pilot || "").trim().slice(0, 40) } : {}),
        ...(hash ? { hash } : {}),
      }, suFile.b64);
      const nm = stdName;   // onay mesajı standart adı göstersin
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

  /* İndirme async oldu (v1.4.93): yeni kayıtlarda gövde ayrı düğümde — legacy
     su.data varsa doğrudan, yoksa getSetupBlob ile talep üzerine çekilir. */
  const downloadSetup = async (su) => {
    try {
      const b64 = su.data || await getSetupBlob(su.id);
      if (!b64) { alertDialog(t("Dosya alınamadı — bağlantıyı kontrol et.")); return; }
      const bin = atob(b64);
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

  /* Başlığa tıklayınca: aynı anahtar → yön değişir; yeni anahtar → doğal yönle
     başlar (tarih en-yeni-üstte, tur en-hızlı-üstte). */
  const toggleSort = (key) => setSuSort((s) =>
    s.key === key
      ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
      : { key, dir: key === "lap" ? "asc" : "desc" });

  /* boru hattı: benimkiler → süzgeç → arama → sıralama */
  const base = suMine && user?.uid ? setups.filter((x) => x.uid === user.uid) : setups;
  const suList = sortSetups(
    searchSetups(
      filterSetups(base, { track: suFTrack, cond: suFCond, sess: suFSess }),
      suQuery),
    suSort.key, suSort.dir);

  return { setups, suFile, suMeta, setSuMeta, suErr, suMsg, suBusy,
    suUpOpen, setSuUpOpen, suFTrack, setSuFTrack,
    suFCond, setSuFCond, suFSess, setSuFSess,
    suQuery, setSuQuery, suSort, toggleSort, suMine, setSuMine,
    suHasMore, loadMoreSetups,
    onSetupFile, onSetupDrop, saveSetup, downloadSetup, suList };
}
