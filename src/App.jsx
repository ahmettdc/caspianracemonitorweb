import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense, Fragment } from "react";
import UpdateModal from "./UpdateModal";
import { useUpdater } from "./useUpdater";
import { CHANGELOG } from "./changelog";
import { isTauri } from "./tauriEnv";
import { useLiveBridge } from "./useLiveBridge";
import { useLive } from "./useLive";
import { useLiveSync } from "./useLiveSync";
import { useMiniPlayer } from "./useMiniPlayer";
import { useAuth } from "./useAuth";
import { useTeams } from "./useTeams";
import { useChat } from "./useChat";
import { useSetups } from "./useSetups";
import { useLmuSchedule } from "./useLmuSchedule";
import { officialRaceToForm } from "./lmuSchedule";
import { useRaceSync } from "./useRaceSync";
import { useTelemetry } from "./useTelemetry";
import TelemetryStandalone from "./TelemetryStandalone";
import ScheduleStandalone from "./ScheduleStandalone";
import { firebaseReady,
  requestAccess, watchAllUsers, setUserAllowed, updateProfile,
  setTeamRole, toggleTeamBadge, setTeamMemberName,
  deleteChat, syncMyTeamName,
  deleteSetup, addSetup,
  createRace, updateRace, deleteRace,
  raceStateGet,
  getUserAvatar, saveUserAvatar, clearUserAvatar,
  liveHistoryClearAll, serverNow } from "./storage";
import { processImageFile, IMG_ACCEPT_TYPES } from "./imageUpload";
import { carImageSrc, teamLogoSrc } from "./teamAssets";
import { duckSetupToSvm, textToB64 } from "./setupParse";
import { signInGoogle, signOut, authReady } from "./auth";
import { confirmDialog, alertDialog } from "./confirm";
import {
  parseHMS, fmtHMS, fmtLap, parseLap, msToLocalInput, isRacePast,
  DEFAULT_STATE, EMPTY_PIT, TYRE_2_SEC, TYRE_4_SEC,
  WEATHER, wxLog, wxAtRel, effCons, tyState,
  computePlan, migrate, lastStintFuel,
} from "./engine";
import {
  SLOT_COLORS, APP_VERSION, SEEN_VER_KEY, ASSET, AV,
  TRACKS, PIT_LANE_TIMES, TRACK_ASSET, trackFlag,
  CARS, CAR_CLASSES, trackName, carName, classId, classAccent, venueToTrackId,
  PIE_COLORS, DESKTOP_RELEASE_URL, BRIDGE_EXE_URL, fuelView,
} from "./constants";
import {
  safeParseState, carriedTyre,
  applyUpPit, applyUpTyre, applyUpOvr, applyBumpLaps, applyClearLaps,
  applyQuickTyre, applyUpStintLap, applyUpStintCons, applyUpTyreCell, applyAssignDriver, applyClearTyres,
  computeTyreInfo, computeDriverPlan,
  computeLiveInfo, buildTimeline,
  applyMarkPit, applyUnmarkPit, applyResetPits,
} from "./state";
import { poolEmptyReason } from "./setupPool";
import {
  CoachTour, TOUR_FOR, Wheel, RoleIcon, NumField, Bolt, Tyre, Ring, Icon, Btn, Avatar,
  BADGES, teamBadgesOf, hasBadge, ChatPanel, SetupForm, SetupTable, SetupCards,
  VersionModal, RaceEditModal,
  ChatModal, SetupModal, TeamModal, TeamScreen, CreateJoinModal, DenyToast, SetupContentModal, SetupCompareModal,
  CommandPalette, AdminModal,
} from "./components";
import { WetIcon } from "./WetIcon";

/* ---- i18n sözlüğü lazy (v1.8.0) ----
   EN sözlüğü ~70 KB kaynak ve yalnız lang==="en" iken okunur; başlangıç
   paketinden çıkarıldı. Varsayılan dil "en" olduğundan boot'ta (modül yüklenir
   yüklenmez, React'ten önce) paralel import başlatılır → chunk neredeyse her
   zaman Firebase auth round-trip'inden önce gelir. TR kullanıcı hiç indirmez.
   Auth kapısındaki langReady, EN kullanıcının bir an bile Türkçe metin
   görmemesini garanti eder. */
let EN_CACHE = null;
const wantsEN = (() => {
  try { return (localStorage.getItem("crm-lang") || "en") === "en"; } catch { return true; }
})();
if (wantsEN) import("./i18n").then((m) => { EN_CACHE = m.EN; });

/* Sekmeler talep üzerine yüklenir (kod bölme) — ilk bundle küçülür,
   recharts yalnız Telemetri açılınca gelir. */
/* Dinamik import (lazy sekme) başarısızsa — genelde deploy sonrası tarayıcının
   elindeki eski index.html artık var olmayan bir parça adını ister — bir kez
   sayfayı otomatik yenile: taze index.html + güncel parça adları gelir.
   10 sn'lik zaman damgası guard'ı yenileme döngüsünü önler. */
const lazyRetry = (factory) => lazy(() => factory().catch((err) => {
  try {
    const last = +sessionStorage.getItem("chunkReloadAt") || 0;
    if (Date.now() - last > 10000) {
      sessionStorage.setItem("chunkReloadAt", String(Date.now()));
      window.location.reload();
      return new Promise(() => {}); // reload gelene kadar askıda tut
    }
  } catch { /* sessionStorage yoksa */ }
  throw err;
}));

const DashTab = lazyRetry(() => import("./tabs/DashTab"));
const StintTab = lazyRetry(() => import("./tabs/StintTab"));
const FuelTab = lazyRetry(() => import("./tabs/FuelTab"));
const TyreTab = lazyRetry(() => import("./tabs/TyreTab"));
const DriversTab = lazyRetry(() => import("./tabs/DriversTab"));
const TeleTab = lazyRetry(() => import("./tabs/TeleTab"));
const LiveTab = lazyRetry(() => import("./tabs/LiveTab"));

/* ============================================================
   CASPIAN MOTORSPORT — RACE MONITOR  ·  Faz 2
   Faz 2: Yarış odası + gerçek zamanlı takım senkronizasyonu.
   - Oda verisi paylaşımlı depoda "room:KOD" anahtarında tutulur
   - Yazma: değişiklikten 800ms sonra (debounce), rev sayacı ile
   - Okuma: 3 sn'de bir poll; uzak rev daha yeniyse uygula
   - Çakışma: son yazan kazanır (last-write-wins)
   Faz 1 çekirdeği (aşağıda) değişmedi:
   Excel V1.28 hesap mantığının birebir taşınması:
   - STINT: stint süresi = tur × ort. tur süresi (veya manuel override)
     pit = (yakıt? F9) + (pit lane? F8) + lastik sayısı × F10
   - CODE80: aynı motor, lastik süresi F10/4
   - SON STİNT YAKITI: kalan tur = countdown / tur süresi
     yakıt = (kalan tur + extra lap) × tüketim
   - TOPLAM TUR: stint sayısı × stint turu × traffic error rate
   Tüm durum tek bir JSON objesinde tutulur (Faz 2 senkronizasyona hazır).
   ============================================================ */

/* Zaman/tur yardımcıları, DEFAULT_STATE ve strateji motoru artık
   ./engine.js içinde (yukarıda import edildi) — saf ve test edilebilir. */

/* ---------- Faz 4: MoTeC telemetri ayrıştırma ---------- */
/* Statik veri/lookuplar (TRACKS, CARS, ASSET, SLOT_COLORS, ...) → ./constants.js */
/* Telemetri parserları → ./parsers.js (import edildi). */

/* ---------- çekirdek motor ---------- */
/* EMPTY_PIT, TYRE_2_SEC, TYRE_4_SEC → ./engine.js (import edildi) */
/* zemin/hava durumu: tur süresi çarpanı + yakıt tüketim çarpanı (LMU) */
/* direksiyon simgesi — Unicode'da direksiyon emojisi yok, rozet rengini devralır */

/* ============================================================
   REHBER TURU — ekranı karartır, sıradaki öğeyi ışıklandırır.
   steps: [{ sel, title, body, pos? }] — sel bulunamazsa adım atlanır.
   ============================================================ */


/* kullanıcı rozetleri */
/* Rozet listesi: sahiplik ve admin otomatik, diğerleri takım sahibince atanır.
   badges[uid] eski sürümde metin, yenisinde { driver:true, ... } olabilir. */

/* Hava modeli (WEATHER, wxLog, wxAtRel, WX, effCons), tyState,
   MAX_STINTS ve strateji motoru (computePlan, migrate, lastStintFuel)
   → ./engine.js (yukarıda import edildi) — saf ve test edilebilir. */

/* ---------- UI parçaları ---------- */
/* CSS bloğu → ./styles.js (yukarıda import edildi). */


/* pilot dağılımı için donut grafik */

/* marka şimşek logosu (favicon.svg) — Virtual Energy simgesi olarak ⚡ yerine kullanılır */
/* Kutu grafiği (box plot): kutu = Q1–Q3, orta çizgi = medyan,
   bıyıklar 1.5×IQR içindeki en uç turlara uzanır, dışındakiler nokta olarak çizilir. */



function ytId(url) {
  if (!url) return null;
  const m = String(url).match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/|embed\/|shorts\/)|v=)([\w-]{11})/);
  return m ? m[1] : null;
}


export default function App() {
  const [st, setSt] = useState(DEFAULT_STATE);
  const [tab, setTab] = useState("dash");

  /* ---------- Faz 2: takım senkronizasyonu + yetki ---------- */
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("crm-lang") || "en"; } catch { return "en"; }
  });
  /* EN sözlüğü lazy geldiğinden state'e bağlanır; boot'taki paralel import
     çoğu zaman ilk render'dan önce bitmiştir (EN_CACHE dolu başlar). TR→EN
     geçişinde effect chunk'ı yükler (modül cache'i sayesinde anında). */
  const [dict, setDict] = useState(EN_CACHE);
  useEffect(() => {
    if (lang !== "en" || dict) return undefined;
    if (EN_CACHE) { setDict(EN_CACHE); return undefined; }
    let on = true;
    import("./i18n").then((m) => { EN_CACHE = m.EN; if (on) setDict(m.EN); })
      .catch(() => {});
    /* güvenlik ağı: aynı origin chunk'ı ~her zaman anında gelir; yine de bir
       yükleme hatası/çok yavaş ağda dil kapısı sonsuz takılmasın — 8 sn sonra
       kaynakla (TR) devam et (kullanıcı TR/EN düğmesiyle de geçebilir). */
    const timer = setTimeout(() => { if (on && !EN_CACHE) setDict({}); }, 8000);
    return () => { on = false; clearTimeout(timer); };
  }, [lang, dict]);
  /* t useCallback: kimliği yalnız dil/sözlük değişince değişir — alt ağaçlardaki
     memo'ların (PosChart, TraceRow…) boşuna kırılmaması için ön şart. */
  const t = useCallback(
    (str) => (lang === "en" ? ((dict || EN_CACHE)?.[str] ?? str) : str),
    [lang, dict]);
  const langReady = lang !== "en" || !!(dict || EN_CACHE);
  const switchLang = (l) => {
    setLang(l);
    try { localStorage.setItem("crm-lang", l); } catch {}
  };
  /* CSS text-transform:uppercase harf kurallarını belge diline göre uygular.
     lang="tr" sabit kalırsa İngilizce'de de i → İ olur (STİNT, PİT...). */
  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "tr";
  }, [lang]);
  /* Yoğunluk modu — varsayılan "compact" (yoğun pit-duvarı); "comfort" biraz daha
     nefes alan boşluk/tipografi. data-density html'de → tüm .rc köklerini kapsar. */
  const [density, setDensity] = useState(() => {
    try { return localStorage.getItem("crm-density") || "compact"; } catch { return "compact"; }
  });
  useEffect(() => {
    try { document.documentElement.dataset.density = density; } catch { /* yoksay */ }
  }, [density]);
  const toggleDensity = () => setDensity((d) => {
    const nx = d === "comfort" ? "compact" : "comfort";
    try { localStorage.setItem("crm-density", nx); } catch { /* özel mod */ }
    return nx;
  });
  /* Tema — koyu "Pit Wall OS" ana kimlik (varsayılan); light opsiyonel. Tokenlar
     :root'ta koyu tanımlı, :root[data-theme="light"] override eder. body bg + meta
     theme-color de temaya göre güncellenir (index.html sabitini ezmek için). */
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("crm-theme") || "dark"; } catch { return "dark"; }
  });
  useEffect(() => {
    try {
      document.documentElement.dataset.theme = theme;
      const bg = theme === "light" ? "#F4EEF0" : "#120C0E";
      document.body.style.background = bg;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", theme === "light" ? "#F4EEF0" : "#960018");
    } catch { /* yoksay */ }
  }, [theme]);
  const toggleTheme = () => setTheme((v) => {
    const nx = v === "light" ? "dark" : "light";
    try { localStorage.setItem("crm-theme", nx); } catch { /* özel mod */ }
    return nx;
  });
  /* Komut paleti (Ctrl/Cmd+K) — hızlı sekme/aksiyon erişimi. */
  const [cmdOpen, setCmdOpen] = useState(false);
  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault(); setCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const [entered, setEntered] = useState(false); // lobi geçildi mi (solo/oda)
  const [teleOnly, setTeleOnly] = useState(false); // bağımsız telemetri ekranı (Race Solo'dan AYRI)
  const [scheduleOnly, setScheduleOnly] = useState(false); // bağımsız Resmi Yarışlar takvimi (yarıştan AYRI)
  const [pickDone, setPickDone] = useState(false); // pist/araç seçimi tamamlandı mı
  const [setupDone, setSetupDone] = useState(false); // data giriş adımı tamamlandı mı
  const [userName, setUserName] = useState("");
  const [curRace, setCurRace] = useState("");    // aktif yarış id (takım içinde)
  /* canlı timing + yakıt öğrenici → useLive hook'u (aşağıda, curTeamRef kurulduktan
     sonra çağrılır). live/liveFuelObs oradan gelir. */
  const [role, setRole] = useState("editor");    // "editor" | "viewer" (takım rolünden)
  /* stRef: mevcut st'nin ref aynası — useRaceSync (push) ve useLive salt-okur.
     İşbirlikçi yarış-durumu senkronizasyonu → useRaceSync (curTeamRef kurulduktan
     sonra aşağıda çağrılır); syncMsg / lastSync / sync oradan gelir. */
  const stRef = useRef(st);
  stRef.current = st;
  /* canEditRef: canEditTeam'in ref aynası — useLive (tur geçmişi hasadı) yazımı yalnız
     editörde yapsın diye. useLive satır ~801'de, canEditTeam satır ~885'te tanımlanıyor
     (sonra) → curTeamRef/stRef gibi ref hilesi (render'da güncel tutulur). */
  const canEditRef = useRef(false);

  /* ---------- YARIŞ AÇ / KAPAT (oda kodu ve PIN yok) ---------- */
  /* landTab: yarış açılınca inilecek sekme. "Yarışı aç"/"Aç" butonları "stint" geçer
     (kullanıcı yarışa girince önce STINT planını görür). Rail menü öğeleri landTab
     GEÇMEZ; kendi setTab(k) seçimleri korunur (ör. menüden doğrudan "Canlı"ya girme). */
  const openRace = async (rid, landTab) => {
    if (!curTeam || !rid) return;
    try {
      const remote = await raceStateGet(curTeam, rid);
      sync.current.applying = true;
      sync.current.rev = remote?.rev || 0;
      if (remote?.stateJson) {
        const parsed = safeParseState(remote.stateJson);
        if (parsed) {
          setSt(migrate(parsed));
          setLastSync({ by: remote.updatedBy, at: remote.updatedAt });
        } else {
          console.warn("Yarış açılışında bozuk uzak state atlandı");
        }
      }
      setCurRace(rid);
      setRole(canEditTeam ? "editor" : "viewer");
      setEntered(true); setPickDone(true); setSetupDone(true);
      if (landTab) setTab(landTab);
      setTeamOpen(false); setSyncMsg("");
      setTimeout(() => { sync.current.applying = false; }, 60);
    } catch (e) { setSyncMsg(t("Bağlantı hatası: ") + e.message); }
  };

  const leaveRace = () => {
    setCurRace(""); setRole("editor"); setLastSync(null); setSyncMsg("");
    setEntered(false); setPickDone(false); setSetupDone(false);
    setScheduleOnly(false);   // rail "Menü" → bağımsız Resmi Yarışlar ekranından da çık
    setTeamOpen(false);       // rail "Menü" → Takım ekranından da çık
  };

  /* Yetki muhafızı: viewer bir yarışta düzenleme denerse "yetkiniz yok" kutucuğu göster
     ve state'i DEĞİŞTİRME. `edit` gövdesi yalnız kullanıcı etkileşiminde çalıştığından
     canEdit/showDeny (aşağıda tanımlı) çağrı anında okunur — render sırasında erişilmez,
     TDZ yok. Tüm kullanıcı-düzenleme sarmalayıcıları setSt yerine bundan geçer;
     yalnız sync-apply (uzak state → viewer) doğrudan setSt kalır. */
  const [deny, setDeny] = useState(0);
  const showDeny = () => setDeny(Date.now());   // damga → toast tetikler + her tıkta yeniden animasyon
  /* yarışta viewer → düzenleme kilitli (= !canEdit). canEdit aşağıda tanımlı olduğundan
     no-use-before-define'a takılmamak için curRace/role doğrudan okunur (ikisi de yukarıda). */
  const blocked = () => curRace && role !== "editor";
  const edit = (updater) => { if (blocked()) { showDeny(); return; } setSt(updater); };

  const up = (patch) => edit((s) => ({ ...s, ...patch }));
  /* dizileri gerektiği kadar uzatır (14 stint sınırını kaldırır) */
  /* grow + reducer'lar (upPit/upTyre/quickTyre/... ) → ./state.js */

  const upPit = (i, patch) => edit((s0) => applyUpPit(s0, i, patch));
  const upTyre = (i, t) => edit((s0) => applyUpTyre(s0, i, t));
  const upOvr = (i, val) => edit((s0) => applyUpOvr(s0, i, val));
  /* Tur manuel override: computed'dan başlayıp ±adım; time override'ı temizler */
  const bumpLaps = (i, curLaps, delta) => edit((s0) => applyBumpLaps(s0, i, curLaps, delta));
  const clearLaps = (i) => edit((s0) => applyClearLaps(s0, i));

  const mode = tab === "code80" ? "code80" : "race";
  /* computePlan pahalı (tur-tur yürüyüş × sabit-nokta döngüsü). Eskiden her st
     değişiminde 3 kez koşuyordu (plan + racePlan + lsf içindeki üçüncü çağrı);
     race modunda plan === racePlan ve lsf'nin ihtiyacı zaten racePlan.flagExtra →
     tek çağrıya indirildi (code80 sekmesinde 2). */
  const racePlan = useMemo(() => computePlan(st, "race"), [st]);
  const plan = useMemo(() => (mode === "race" ? racePlan : computePlan(st, mode)),
    [st, mode, racePlan]);
  const lsf = useMemo(() => lastStintFuel(st.lastStintCountdown, st, racePlan.flagExtra),
    [st, racePlan]);
  const lsf80 = useMemo(() => lastStintFuel(st.code80LastStint, st), [st]);
  /* Toplam VE = satırların tur-tur (gerçek havayla) yürütülmüş toplamı + güvenlik turu.
     Eskiden `effCons × totalLaps` idi; effCons yalnız EN GÜNCEL havayı uygular →
     karma havada tablo toplamıyla saparıydı (dry→wet 2:24 yarışta ~21% VE ≈ 18 L eksik).
     Tek havada iki formül birebir aynı sonucu verir. */
  const totalVE = plan.totalFuel + st.extraLap * effCons(st); // % VE (DATA I2)
  const totalFuelL = totalVE * st.fuelRatio;            // gerçek litre karşılığı
  const fuelCarried = 100 * st.fuelRatio;               // %100 = taşınan yakıt (L)
  /* Yakıt sunumu: VE sınıfları (Hypercar/GT3) yüzde, diğerleri (LMP2/LMP3/GTE) litre.
     Dahili temsil aynı kalır; race data formunda VE olmayan sınıflar için L/tur + depo
     girişi bu türetilmiş değerler ve setter'larla dahili consumption/fuelRatio'ya yazılır. */
  const fv = fuelView(st);
  const fuelPerLapL = +fv.perLapL.toFixed(2);           // yarış datası: litre / tur
  const fuelTankL = +fv.tankL.toFixed(1);               // depo (L)
  /* L/tur değiştir → depo (fuelRatio) sabit, consumption'ı (=%/tur) yeniden türet. */
  const setFuelPerLapL = (v) => { const L = Number(v); if (!(st.fuelRatio > 0) || !isFinite(L)) return; up({ consumption: +(L / st.fuelRatio).toFixed(4) }); };
  /* Depo (L) değiştir → fuelRatio=depo/100; mutlak L/tur korunacak şekilde consumption
     yeniden ölçeklenir (aksi halde tank büyüyünce L/tur de büyürdü). */
  const setFuelTankL = (v) => { const T = Number(v); const fr = T / 100; if (!(fr > 0) || !isFinite(fr)) return; const perLapL = (Number(st.consumption) || 0) * (Number(st.fuelRatio) || 0); up({ fuelRatio: +fr.toFixed(4), consumption: perLapL > 0 ? +(perLapL / fr).toFixed(4) : st.consumption }); };
  const TY = ["FL", "FR", "RL", "RR"];

  /* ---------- Faz 3: lastik stratejisi ---------- */
  /* stint bazlı hızlı lastik atama
     FL=0 FR=1 RL=2 RR=3 · fresh: kullanılmamış en küçük numaralar */
  const quickTyre = (rowIdx, action) => edit((s0) => applyQuickTyre(s0, rowIdx, action));

  /* stinte özel ortalama tur süresi (boş → yarış datasındaki ortalama kullanılır) */
  const upStintLap = (i, v) => edit((s0) => applyUpStintLap(s0, i, v));
  const upStintCons = (i, v) => edit((s0) => applyUpStintCons(s0, i, v));

  const upTyreCell = (row, col, val) => edit((s0) => applyUpTyreCell(s0, row, col, val));
  /* tablo + pit lastik bayrakları birlikte sıfırlanır (bayraklar kalırsa plan
     tabloda olmayan lastik değişimlerine süre eklemeye devam ediyordu) */
  const clearTyres = () => edit((s0) => applyClearTyres(s0));

  /* boş hücre = o köşede lastik değişmedi → önceki stintten (yoksa Qual'dan) taşınan lastik.
     Depoya yazılmaz, sadece görsel; fiziksel olarak aynı lastik olduğu için sayıma girmez. */
  const carriedAt = (row, col) => carriedTyre(st, row, col);
  const tyreInfo = useMemo(() => computeTyreInfo(st, racePlan),
    [st.tyreQual, st.tyreStints, st.tyreLimit, racePlan.rows.length]);

  /* hızlı lastik atamada satır başına son seçilen aksiyon (rozet gösterimi) */
  const [qsel, setQsel] = useState({});
  const QSEL_LBL = {
    new4: "🆕 4 Yeni", carry: "⟳ Devam", fronts: "Önler", rears: "Arkalar",
    lefts: "Sollar", rights: "Sağlar", wet4: "🌧 4 Wet", qual4: "Q Qual", clear: "✕",
    fl: "FL", fr: "FR", rl: "RL", rr: "RR",
  };

  /* ---------- Faz 3: pilotlar ---------- */
  const removeDriver = (n) => edit((s) => ({
    ...s,
    roster: s.roster.filter((x) => x !== n),
    driverAssign: s.driverAssign.map((a) => (a === n ? "" : a)),
  }));
  const assignDriver = (i, n) => edit((s0) => applyAssignDriver(s0, i, n));
  const clearAssign = () => edit((s) => ({
    ...s, driverAssign: s.driverAssign.map(() => ""),
  }));
  /* Takım havuzundan pilot ekle — düzenleme kapısından geçer (viewer'da deny toast). */
  const addPoolDriver = (n) => edit((s) => (s.roster.includes(n) ? s : { ...s, roster: [...s.roster, n] }));

  const driverPlan = useMemo(() => computeDriverPlan(st, racePlan),
    [st.raceStartMs, st.driverAssign, racePlan]);

  const fmtClock = (ms, refMs) => {
    const d = new Date(ms);
    const t = d.toLocaleTimeString(lang === "en" ? "en-GB" : "tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    if (refMs != null && new Date(refMs).toDateString() !== d.toDateString()) {
      const date = d.toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR",
        { day: "2-digit", month: "2-digit" });
      return `${date} ${t}`; // gün değişti → tarih + saat
    }
    return t;
  };

  /* Start'a geri sayım: 24 saatten uzaksa yıl/ay/gün/saat (en anlamlı 3 birim,
     takvim farkıyla), son 24 saatte tik-tik HH:MM:SS. */
  const startCountdown = (li) => {
    if (!(li.toStart > 0)) return "00:00:00";
    if (li.toStart < 86400000) return fmtHMS(li.toStart / 1000);
    const a = new Date(li.startMs - li.toStart), b = new Date(li.startMs);
    let yr = b.getFullYear() - a.getFullYear();
    let mo = b.getMonth() - a.getMonth();
    let dy = b.getDate() - a.getDate();
    let hr = b.getHours() - a.getHours();
    let mn = b.getMinutes() - a.getMinutes();
    if (mn < 0) { mn += 60; hr--; }
    if (hr < 0) { hr += 24; dy--; }
    if (dy < 0) { dy += new Date(b.getFullYear(), b.getMonth(), 0).getDate(); mo--; }
    if (mo < 0) { mo += 12; yr--; }
    const U = lang === "en"
      ? { yr: "y", mo: "mo", dy: "d", hr: "h", mn: "m" }
      : { yr: "yıl", mo: "ay", dy: "g", hr: "sa", mn: "dk" };
    const parts = [];
    if (yr) parts.push(`${yr} ${U.yr}`);
    if (mo) parts.push(`${mo} ${U.mo}`);
    if (dy) parts.push(`${dy} ${U.dy}`);
    if (hr) parts.push(`${hr} ${U.hr}`);
    if ((mn || !parts.length) && parts.length < 3) parts.push(`${mn} ${U.mn}`);
    return parts.slice(0, 3).join(" ");
  };

  /* ---------- Faz 4: telemetri → useTelemetry hook'u (MoTeC içe aktar + analiz) ---------- */
  const { slot, setSlot, chartMode, setChartMode, rawTele, setRawTele, parsed, mapping,
    setMapping, onTeleFile, doParse, apply105Slot, saveMotec, saveSlot, toggleLap,
    removeSlot, slotStats, chartData, loadedSlots, baseSlot,
    cmpMeta: telCmpMeta, cmpA: telCmpA, setCmpA: setTelCmpA, cmpB: telCmpB, setCmpB: setTelCmpB,
    cmpData: telCmpData, cmpBusy: telCmpBusy, savedMsg: telSavedMsg,
    cmpSources: telCmpSources, cmpASrc: telCmpASrc, setCmpASrc: setTelCmpASrc,
    cmpBSrc: telCmpBSrc, setCmpBSrc: setTelCmpBSrc } = useTelemetry({ st, setSt });
  /* Bağımsız Telemetri ekranı (Ana Menü → Telemetri): Race Solo'dan TAMAMEN ayrı, KENDİ
     telemetri örneği + kendi scratch `st`'si. Race Solo'nun `st`/ilk useTelemetry'sine
     dokunmaz → iki taraf birbirine sızmaz, uygulama açık kaldıkça durumu korunur. */
  /* Bağımsız telemetri (Ana Menü → Telemetri) yarışa/Firebase'e bağlı değil; bu yüzden
     yüklenen stint'ler cihaz-yerel localStorage'da tutulur → sayfa yenilense/uygulama
     kapatılıp açılsa da kayıtlı kalır. Yalnız `telemetry` alanı saklanır (ham .duckdb izi
     değil — o yeniden dosyadan gelir; box plot + SEANS + çözülen turlar meta/laps'tan döner). */
  const [teleSt, setTeleSt] = useState(() => {
    try {
      const raw = localStorage.getItem("rm_tele_solo_v1");
      if (raw) {
        const tel = JSON.parse(raw);
        if (tel && typeof tel === "object") return { ...DEFAULT_STATE, telemetry: { ...DEFAULT_STATE.telemetry, ...tel } };
      }
    } catch { /* yoksay */ }
    return { ...DEFAULT_STATE };
  });
  useEffect(() => {
    try { localStorage.setItem("rm_tele_solo_v1", JSON.stringify(teleSt.telemetry || {})); } catch { /* yoksay */ }
  }, [teleSt.telemetry]);
  const teleHook = useTelemetry({ st: teleSt, setSt: setTeleSt });

  /* ---------- canlı yarış modu ---------- */
  const [now, setNow] = useState(Date.now());
  const [pitboard, setPitboard] = useState(false);
  /* Saat kapısı (v1.8.0): now'un tek tüketicisi liveInfo ve idle/done'da tüm
     değerleri statik → geri sayım yokken saniyelik setNow (= tam-App render)
     atlanır. pre/live'a dönüşte effect taze setNow ile yeniden tohumlar. */
  const clockNeededRef = useRef(true);
  useEffect(() => {
    const iv = setInterval(() => {
      if (!clockNeededRef.current) return;
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const liveInfo = useMemo(() => computeLiveInfo(st, racePlan, now),
    [now, st.raceStartMs, st.driverAssign, st.actualPits, st.pitRepairs, st.autoOvr, racePlan]);
  useEffect(() => {
    const needed = liveInfo.status === "pre" || liveInfo.status === "live";
    if (needed && !clockNeededRef.current) setNow(Date.now());   // durmuş saati tazele
    clockNeededRef.current = needed;
  }, [liveInfo.status]);

  /* --- gerçek pit işaretleme (sadece düzenleyici) --- */
  const canEdit = !curRace || role === "editor";

  /* Canlıdan öğrenilen yakıt değerlerini modele uygula (yalnız editör, opt-in) */
  const applyLiveFuel = () => {
    if (!liveFuelObs) return;
    const patch = {};
    if (liveFuelObs.obsRatio) patch.fuelRatio = liveFuelObs.obsRatio;
    if (liveFuelObs.obsCons) patch.consumption = liveFuelObs.obsCons;
    if (Object.keys(patch).length) up(patch);
  };
  /* gerçek pit işaretleme mantığı → ./state.js (saf, test edilebilir) */
  const markPit = () => {
    const patch = applyMarkPit(st, liveInfo, Date.now());
    if (patch) up(patch);
  };
  const unmarkPit = () => {
    const patch = applyUnmarkPit(st);
    if (patch) up(patch);
  };
  const resetPits = async () => {
    if (!(await confirmDialog({ title: t("Pitleri sıfırla"), message: t("Gerçek pit işaretlemelerini sıfırla?"), confirmText: t("Sıfırla"), danger: true }))) return;
    up(applyResetPits(st));
  };
  const setRepair = (i, v) => {
    const arr = [...(st.pitRepairs || [])];
    while (arr.length <= i) arr.push(0);
    arr[i] = Math.max(0, Number(v) || 0);
    up({ pitRepairs: arr });
  };
  const fmtDev = (ms) => {
    const a = Math.abs(ms) / 1000, m = Math.floor(a / 60), sec = Math.floor(a % 60);
    return `${m}:${String(sec).padStart(2, "0")} ${ms >= 0 ? t("geç") : t("erken")}`;
  };
  /* --- PDF çıktısı: yazdırma penceresi açar, tarayıcının "PDF olarak kaydet"i kullanılır --- */
  const exportPdf = (kind) => {
    const esc = (x) => String(x ?? "").replace(/[&<>]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    /* PDF başlığı: seçili yarıştan otomatik — Sezon · Round N · Yarış Adı */
    const rcInfo = races[curRace] || {};
    const seasonNm = seasons[rcInfo.seasonId]?.name || "";
    const raceNm = rcInfo.name || (rcInfo.trackId ? trackName(rcInfo.trackId) : "");
    const docTitle = [seasonNm, rcInfo.round ? `Round ${rcInfo.round}` : "", raceNm]
      .filter(Boolean).join(" · ");
    /* araç + pist görselleri için mutlak URL (yeni pencerede relatif çözülmez) */
    const abs = (p) => new URL(p, window.location.href).href;
    /* Özel görsel dataURI ise abs() zarar vermez (data: mutlak URL'dir). */
    const carUrl = st.car ? abs(carImageSrc(teamData?.assets, st.carClass, st.car, "side")) : "";
    const trackUrl = st.track ? abs(`${ASSET}tracks/${TRACK_ASSET(st.track)}.png`) : "";
    const logoUrl = abs(`${ASSET}logo.png`);
    const classUrl = st.carClass ? abs(`${ASSET}class/${st.carClass}.png`) : "";
    /* cols: her sütun için hücre class'ı (renk tonu); rowCls: satır class'ı üreten fn */
    const mkTable = (head, rows, cols = [], rowCls = null) => {
      const hh = head.map((h, i) => `<th class="${cols[i] || ""}">${esc(h)}</th>`).join("");
      const bb = rows.map((r, ri) => {
        const cls = rowCls ? rowCls(ri) : "";
        return `<tr class="${cls}">${r.map((c, i) =>
          `<td class="${cols[i] || ""}">${
            c && typeof c === "object" && "html" in c ? c.html : esc(c)}</td>`).join("")}</tr>`;
      }).join("");
      return `<table><thead><tr>${hh}</tr></thead><tbody>${bb}</tbody></table>`;
    };
    let title, html;
    if (kind === "stint") {
      title = `${t("Stint Programı")} · ${st.chosen}-${racePlan.laps}`;
      const rows = racePlan.rows;
      const TYN = ["FL", "FR", "RL", "RR"];
      const svcCell = (i, isLast) => {
        if (isLast) return { html: `<span class="svc n">🏁</span>` };
        const pit = st.pits[i] || EMPTY_PIT;
        const parts = [];
        TYN.forEach((c, ti) => {
          const sv = tyState(pit.tyres[ti]);
          if (sv === 1) parts.push(`<span class="svc t">${c}</span>`);
          else if (sv === 2) parts.push(`<span class="svc q">${c}</span>`);
          else if (sv === 3) parts.push(`<span class="svc w">${c}</span>`);
          else if (sv === 4) parts.push(`<span class="svc u">${c}</span>`);
        });
        if (pit.fuel) parts.push(`<span class="svc f">${fv.hasVE ? "⚡VE" : "⛽" + esc(t("Yakıt"))}</span>`);
        return { html: parts.length ? parts.join("") : `<span class="svc n">${esc(t("geçiş"))}</span>` };
      };
      html = mkTable(
        ["#", "Stint", t("Tur"), "Start", "Finish", t("Pilot"), t("Servis"), "Pit", "End Stint", "Time Left"],
        rows.map((r, i) => {
          const dp = driverPlan?.rows?.[i];
          return [
            r.idx, fmtHMS(r.stintSec), r.lapsInStint,
            dp ? fmtClock(dp.start, driverPlan.startMs) : "—",
            dp ? fmtClock(dp.finish, driverPlan.startMs) : "—",
            st.driverAssign[i] || "—",
            svcCell(i, r.isLast),
            r.isLast ? "🏁 FINISH" : fmtHMS(r.pitSec) + (r.repairSec > 0 ? ` (+${r.repairSec}s)` : ""),
            fmtHMS(r.endSec), fmtHMS(r.timeLeft),
          ];
        }),
        ["c-idx", "", "c-lap", "c-clk", "c-clk", "c-drv", "c-svc", "c-pit", "", "c-left"],
        (ri) => rows[ri].isLast ? "r-last" : "");
    } else {
      if (!driverPlan) { alertDialog(t("Pilotlar sekmesinden başlangıç zamanını gir")); return; }
      title = t("Pilot Programı");
      const rows = driverPlan.rows;
      html = mkTable(
        ["#", "Start", "Finish", t("Süre"), t("Pilot")],
        rows.map((r, i) => [
          r.idx, fmtClock(r.start, driverPlan.startMs), fmtClock(r.finish, driverPlan.startMs),
          fmtHMS(r.dur / 1000), st.driverAssign[i] || "—",
        ]),
        ["c-idx", "", "", "c-lap", "c-drv"],
        /* driverPlan satırlarında `isLast` alanı YOK (yalnız idx/start/finish/dur) →
           eski koşul hep undefined'dı, son satır hiç vurgulanmıyordu. */
        (ri) => (ri === rows.length - 1 ? "r-last" : ""));
      const tot = (st.roster || []).filter((n) => driverPlan.totals[n]);
      if (tot.length) {
        html += `<h2>${esc(t("Pilot Toplamları"))}</h2>` + mkTable(
          [t("Pilot"), "Stint", t("Toplam Süre"), "%"],
          tot.map((n) => {
            const d = driverPlan.totals[n];
            return [n, d.stints, fmtHMS(d.ms / 1000), driverPlan.grandMs
              ? `${((d.ms / driverPlan.grandMs) * 100).toFixed(1)}%` : "—"];
          }),
          ["c-drv", "c-idx", "", "c-ve"]);
      }
    }
    /* A4 alt bilgi kartları: stint/tur, son stint VE, pilot dağılım donut'u */
    const donutCard = (() => {
      if (!driverPlan || !Object.keys(driverPlan.totals).length) return "";
      const names = (st.roster || []).filter((n) => driverPlan.totals[n]);
      const size = 110, th2 = 20, r2 = (size - th2) / 2, c2 = 2 * Math.PI * r2;
      let acc = 0;
      const segs = names.map((n, i) => {
        const dash = (driverPlan.totals[n].ms / (driverPlan.grandMs || 1)) * c2;
        const s = `<circle cx="${size / 2}" cy="${size / 2}" r="${r2}" fill="none"
          stroke="${PIE_COLORS[i % PIE_COLORS.length]}" stroke-width="${th2}"
          stroke-dasharray="${dash} ${c2 - dash}" stroke-dashoffset="${-acc}"/>`;
        acc += dash; return s;
      }).join("");
      const legend = names.map((n, i) => {
        const ms = driverPlan.totals[n].ms;
        const p = driverPlan.grandMs ? ((ms / driverPlan.grandMs) * 100).toFixed(0) : "0";
        return `<div class="lg"><i style="background:${PIE_COLORS[i % PIE_COLORS.length]}"></i>${esc(n)} ${p}% · <b class="mono">${fmtHMS(Math.round(ms / 1000))}</b></div>`;
      }).join("");
      return `<div class="bcard"><div class="bt">${esc(t("Pilot Dağılımı"))}</div>
       <div style="display:flex;align-items:center;gap:12px;justify-content:center">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
         <g transform="rotate(-90 ${size / 2} ${size / 2})">${segs}</g></svg>
        <div>${legend}</div></div></div>`;
    })();
    const bottomBar = `<div class="bbar">
 <div class="bcard"><div class="bt">Stint · ${esc(t("Tahmini Tur"))}</div>
  <div class="bv">${racePlan.fullStints} <span>stint</span></div>
  <div class="bv">${racePlan.totalLaps.toFixed(0)} <span>${esc(t("tur"))}</span></div></div>
 <div class="bcard"><div class="bt">⚡ ${esc(fv.hasVE ? t("Son Stint VE") : t("Son Stint Yakıt"))}</div>
  <div class="bv" style="color:#0d7a43">${fv.hasVE ? `${planLsf.refuel.toFixed(1)}%` : `${planLsf.refuelL.toFixed(1)} L`}</div>
  <div class="bv"><span>+${st.extraLap} lap${fv.hasVE ? ` · ≈ ${planLsf.refuelL.toFixed(1)} L` : ""}</span></div></div>
 ${donutCard}
 ${trackUrl ? `<div class="trackcard"><img src="${trackUrl}" alt="">
  <div class="tcap">${esc(trackName(st.track))}</div></div>` : ""}
</div>`;
    /* Yeni pencere yerine GİZLİ iframe: WebView2 (masaüstü) popup'ları engelliyor →
       window.open null dönüyordu → PDF alınamıyordu. iframe'e yazınca içindeki
       window.onload→print() iframe'i yazdırır (tarayıcı + WebView2 print diyaloğu). */
    document.getElementById("pdfframe")?.remove();
    const ifr = document.createElement("iframe");
    ifr.id = "pdfframe";
    ifr.setAttribute("aria-hidden", "true");
    ifr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(ifr);
    const doc = ifr.contentWindow.document;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8">
<title>${esc(docTitle || title)}</title>
<style>
 *{box-sizing:border-box}
 body{font-family:Arial,Helvetica,sans-serif;color:#1a1113;margin:26px;font-size:12px}
 h1{font-size:19px;margin:0 0 2px;letter-spacing:.04em;text-transform:uppercase}
 h1 b{color:#960018} h2{font-size:13px;margin:20px 0 4px;text-transform:uppercase;color:#960018}
 .sub{color:#777;margin:0 0 16px;font-size:11px;border-bottom:2px solid #960018;padding-bottom:8px}
 table{border-collapse:collapse;width:100%;margin-top:6px}
 th,td{border:1px solid #d9c9cd;padding:5px 9px;text-align:left;font-variant-numeric:tabular-nums}
 th{background:#960018;color:#fff;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em}
 tbody tr:nth-child(even) td{background:#faf6f7}
 /* sütun tonları */
 td.c-idx,th.c-idx{text-align:center;font-weight:700;background:#f2e6e8}
 td.c-lap,th.c-lap{text-align:center}
 td.c-ve{background:#eafaf1;color:#0d7a43;font-weight:600}
 th.c-ve{background:#2c9c63}
 td.c-clk{background:#eaf1fb;color:#1b5fae;font-weight:600}
 th.c-clk{background:#3b78c2}
 td.c-svc{white-space:nowrap}
 th.c-svc{background:#7a4dbc}
 .svc{display:inline-block;border-radius:5px;padding:1px 6px;font-size:9px;font-weight:700;
   margin:0 1px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
 .svc.t{background:#f5c84c;color:#4a3200;border:1px solid #d9a92c}
 .svc.f{background:#c01030;color:#fff;border:1px solid #8e0a22}
 .svc.n{background:#efe9ea;color:#8a7f81;border:1px solid #d9c9cd}
 .svc.q{background:#4d9fff;color:#04213f;border:1px solid #2b7fe0}
 .svc.w{background:#7fe3a0;color:#0c3a1f;border:1px solid #4fc47e}
 .svc.u{background:#1a1c22;color:#e8e8ee;border:1px solid #3a3d46}
 td.c-drv{background:#eef4fb;font-weight:600}
 th.c-drv{background:#2f6fb0}
 td.c-pit{background:#fef7e6}
 th.c-pit{background:#c9982a}
 td.c-left{font-weight:600}
 th.c-left{background:#5a3d8a}
 tbody tr.r-last td{background:#fde8ea!important;font-weight:700;color:#960018}
 /* üst başlık: logo + araç; pist sağ altta büyük sabit kutu */
 .hd{display:flex;align-items:center;gap:16px;border-bottom:2px solid #960018;
   padding-bottom:12px;margin-bottom:14px}
 .hd .logo{height:52px;width:auto;flex:0 0 auto}
 .hd .txt{flex:1 1 auto}
 .hd .carbox{width:210px;height:88px;display:flex;align-items:center;justify-content:center;
   flex:0 0 auto}
 .hd .carbox img{max-width:100%;max-height:88px;object-fit:contain}
 /* alt şerit: bilgi kartları + pist kutusu tek hizalı satır */
 .bbar{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:stretch;
   margin-top:16px;page-break-inside:avoid;break-inside:avoid}
 .bcard{flex:1;border:1px solid #d9c9cd;border-radius:10px;padding:10px 12px;background:#faf6f7;
   display:flex;flex-direction:column;justify-content:center;
   -webkit-print-color-adjust:exact;print-color-adjust:exact}
 .bcard .bt{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#960018;
   font-weight:700;margin-bottom:6px}
 .bcard .bv{font-size:21px;font-weight:800;line-height:1.25}
 .bcard .bv span{font-size:10.5px;color:#777;font-weight:600}
 .bcard .lg{font-size:10px;display:flex;align-items:center;gap:4px;margin:2px 0;white-space:nowrap}
 .bcard .lg i{display:inline-block;width:9px;height:9px;border-radius:2px}
 .trackcard{background:#14101a;border-radius:10px;padding:10px 12px;
   display:flex;flex-direction:column;align-items:center;justify-content:center;
   -webkit-print-color-adjust:exact;print-color-adjust:exact}
 .trackcard img{max-width:100%;max-height:140px;object-fit:contain}
 .trackcard .tcap{color:#e8dfe2;font-size:10px;letter-spacing:.08em;
   text-transform:uppercase;margin-top:6px}
 .brand{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#960018;font-weight:700}
 .brand b{color:#1a1113}
 .ptitle{font-size:22px;font-weight:800;margin:2px 0 4px;letter-spacing:.01em}
 @media print{body{margin:9mm}
   th{-webkit-print-color-adjust:exact;print-color-adjust:exact}
   td,.trackcard,.bcard{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="hd">
 <img class="logo" src="${logoUrl}" alt="" onerror="this.style.display='none'">
 <div class="txt">
  <div class="brand"><b>CASPIAN</b> MOTORSPORT · RACE MONITOR</div>
  <div class="ptitle">${esc(docTitle || title)}</div>
  <div style="color:#777;font-size:11px">${esc(title)} · ${esc(new Date().toLocaleString(lang === "en" ? "en-GB" : "tr-TR"))}${
      st.raceStartMs ? " · Start: " + esc(new Date(st.raceStartMs).toLocaleString(lang === "en" ? "en-GB" : "tr-TR")) : ""}${
      st.track ? " · " + esc(trackName(st.track)) : ""}${
      st.car ? " · " + esc(carName(st.carClass, st.car)) : ""}</div>
 </div>
 ${classUrl ? `<img src="${classUrl}" alt="" style="height:30px;flex:0 0 auto"
   onerror="this.style.display='none'">` : ""}
 ${carUrl ? `<div class="carbox"><img src="${carUrl}" alt=""></div>` : ""}
</div>
${html}
${bottomBar}
<script>window.onload=function(){window.print()}<\/script></body></html>`);
    doc.close();
  };
  /* Son stintte pit YOK: phaseEnd = yarış bitişi olduğu için nextPitIn aslında
     bayrağa kalan süredir. "Sıradaki Pit" etiketi + son 5 dk'daki sarı pit alarmı
     olmayan bir pit için uyarı veriyordu → son stintte ikisi de kapalı. */
  const onLastStint = liveInfo.status === "live"
    && !!racePlan.rows[liveInfo.stintIdx]?.isLast;
  const pitSoon = liveInfo.status === "live" && liveInfo.phase === "stint"
    && !onLastStint && liveInfo.nextPitIn < 300000;
  /* son stint countdown — canlıdan DEĞİL, stint planından: sondan önceki stintin Time Left'i.
     Pit tuşu override yazdıkça racePlan güncellenir, bu değer gerçeğe göre kayar. */
  const planLastCd = racePlan.rows.length >= 2
    ? racePlan.rows[racePlan.rows.length - 2].timeLeft
    : racePlan.raceSec;
  /* son stint VE — plandan (elle girilen countdown yerine gerçek kalan süreden) */
  const planLsf = lastStintFuel(fmtHMS(planLastCd), st, racePlan.flagExtra);
  const [autoCd, setAutoCd] = useState(true); // plandan otomatik countdown
  const [sideOpen, setSideOpen] = useState(true); // sol data sidebar aç/kapa
  const [rail, setRail] = useState(true);   // v2.0 kabuk: sol dikey menü rayı aç/kapa
  const [bridgePopOpen, setBridgePopOpen] = useState(false); // v2.0 üst çubuk: köprü açılır paneli
  const [menuInfo, setMenuInfo] = useState(false);  // v2.0 ana menü: bilgi (ℹ) açılır paneli
  const [menuAcct, setMenuAcct] = useState(false);  // v2.0 ana menü: hesap açılır menüsü
  const [menuCal, setMenuCal] = useState("up");     // v2.0 ana menü: takvim görünümü (active|up|past)
  const [pickTrackQ, setPickTrackQ] = useState(""); // v2.0 pist&araç: pist arama
  /* ---- kimlik doğrulama (Google) → useAuth hook'u ---- */
  const { user, authLoading, udoc } = useAuth();
  const [authErr, setAuthErr] = useState("");
  const [authMode, setAuthMode] = useState("in"); // "in" giriş | "up" kayıt
  const [signingIn, setSigningIn] = useState(false); // v2.0 giriş ekranı: düğme yükleniyor durumu
  const [regNote, setRegNote] = useState("");
  const [regName, setRegName] = useState("");
  // kayıt adı ön-doldurma (useAuth'tan gelen user'a göre) — hook'tan ayrı tutuldu
  useEffect(() => {
    if (user) setRegName((v) => v || user.displayName || "");
  }, [user]);
  /* oda üyelik adı: kayıtta verilen ad soyad (yoksa Google adı) */
  useEffect(() => {
    const n = (udoc?.fullName || user?.displayName || "").trim();
    if (n) setUserName(n);
  }, [udoc, user]);
  const access = udoc?.allowed === true;
  const isAdmin = udoc?.admin === true;
  const [adminOpen, setAdminOpen] = useState(false);
  const [profOpen, setProfOpen] = useState(false);
  /* ---- takımlar ---- */
  const [teamOpen, setTeamOpen] = useState(false);
  const [createJoinOpen, setCreateJoinOpen] = useState(false); // v1.6 — sade Kur & Katıl ekranı (yönetimden ayrı)
  /* ---- takım/sezon/yarış abonelikleri → useTeams hook'u ---- */
  const { myTeams, curTeam, setCurTeam, teamData, seasons, races } = useTeams({ user, access });
  /* .duckdb telemetrisine gömülü setup'ı Setup Havuzuna kaydet (v1.5.2): VM_/WM_ JSON'u
     .svm metnine çevir → mevcut addSetup borusuna ver (havuz bu formatı okur). Pist/sınıf
     telemetri meta'sından en iyi çaba etiketlenir. */
  const saveTeleSetup = async (rawJson, meta) => {
    if (!user) throw new Error(t("Kaydetmek için giriş yapmalısın."));
    const svm = duckSetupToSvm(rawJson);
    if (!svm) throw new Error(t("Setup okunamadı."));
    await addSetup(user, {
      track: venueToTrackId(meta?.venue) || "",
      cls: classId(meta?.carClass) || "",
      car: "", cond: "", sess: "", champ: "", ver: "", lap: "",
      note: [t("Telemetriden"), meta?.driver, meta?.session].filter(Boolean).join(" · "),
      team: teamData?.meta?.name || "",
    }, textToB64(svm));
  };
  const [tForm, setTForm] = useState({ name: "", join: "" });
  const [curSeason, setCurSeason] = useState("");   // "" = tümü
  const [rForm, setRForm] = useState(null);          // yarış ekleme/düzenleme formu
  const [tErr, setTErr] = useState("");
  const [profName, setProfName] = useState("");
  /* ---- kullanıcı avatarı (v1.7.0) ----
     Kendi avatarımız state'te tutulur (header chip + profil önizlemesi anında
     güncellensin); diğer kullanıcılar <Avatar> bileşeninin cache'li get'iyle çözülür.
     avStage: profil modalında seçilen ama henüz kaydedilmemiş görsel. */
  const [myAvatar, setMyAvatar] = useState("");
  const [avStage, setAvStage] = useState("");
  const [avErr, setAvErr] = useState("");
  const [avBusy, setAvBusy] = useState(false);
  useEffect(() => {
    let on = true;
    setMyAvatar("");
    if (user?.uid && access) getUserAvatar(user.uid)
      .then((v) => { if (on) setMyAvatar(v || ""); });
    return () => { on = false; };
  }, [user?.uid, access]);
  const onAvatarFile = async (f) => {
    if (!f) return;
    setAvErr(""); setAvBusy(true);
    try { setAvStage(await processImageFile(f, "avatar")); }
    catch (e) { setAvErr(t(e?.message || "Görsel işlenemedi — dosya bozuk olabilir.")); }
    finally { setAvBusy(false); }
  };
  const curTeamRef = useRef("");
  curTeamRef.current = curTeam;
  /* işbirlikçi yarış-durumu senkronizasyonu (debounce push + canlı dinle) → hook.
     openRace/leaveRace App'te kalır ve dönen `sync` ref'ini + setter'ları kullanır. */
  const { syncMsg, setSyncMsg, lastSync, setLastSync, sync } = useRaceSync({
    st, setSt, curRace, curTeamRef, role, userName, stRef, t });
  /* canlı timing aboneliği + yakıt öğrenici (App.jsx'ten çıkarıldı) */
  const { live, liveFuelObs, lapCapture } = useLive({ curRace, curTeamRef, stRef, canEditRef });
  /* stint ↔ canlı senkron: oto-PIT + saat hizalama (yalnız canlı yazıcı PC yazar),
     hava/avg-lap ÖNERİ çipleri (tek tık, otomatik yazmaz) */
  const { sync: liveSyncOpt, setSyncOpt, drift, lastAuto, wxSug, avgSug, pitMismatch } =
    useLiveSync({ live, st, liveInfo, up, markPit, canEdit, user });
  /* ---- sohbet: genel / takım / yarış kanalları ---- */
  /* ---- rehber (koçmark turu) — CoachTour bileşeni ---- */
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachStart, setCoachStart] = useState(0);

  /* ---- setup deposu → useSetups hook'u (liste/yükle/indir/süzgeç) ---- */
  /* active: havuz yalnız görünürken abone olunur (Setup sekmesi ya da lobi penceresi).
     Eskiden girişte herkes tüm havuzu (base64 dosyalar dahil) indiriyordu. */
  const [suOpen, setSuOpen] = useState(false);   // lobi setup penceresi (abonelik kapısı)
  const [suDelErr, setSuDelErr] = useState("");  // silme hatası (yükleme hatasından ayrı)
  const [viewSu, setViewSu] = useState(null);    // "🔍 İçerik" ile açılan setup
  /* ⚖ karşılaştırma seçimi — en çok 2 setup id'si; 2 seçilince alt çubuktan pencere. */
  const [cmpSel, setCmpSel] = useState([]);
  const [cmpOpen, setCmpOpen] = useState(false);
  const cmpToggle = (su) => setCmpSel((sel) => {
    if (sel.includes(su.id)) return sel.filter((x) => x !== su.id);
    if (sel.length < 2) return [...sel, su.id];
    return [sel[0], su.id];                      // 2 doluysa son seçim değişir
  });
  /* Havuz görünümü (tablo/kart) — cihaz tercihi, odaya senkron edilmez. */
  const [suView, setSuView] = useState(() => {
    try { return localStorage.getItem("rm_setup_view") || "table"; }
    catch { return "table"; }
  });
  const toggleSuView = () => setSuView((v) => {
    const next = v === "cards" ? "table" : "cards";
    try { localStorage.setItem("rm_setup_view", next); } catch { /* özel mod */ }
    return next;
  });
  const { setups, suFile, suMeta, setSuMeta, suErr, suMsg, suBusy,
    suUpOpen, setSuUpOpen, suFTrack, setSuFTrack,
    suFCond, setSuFCond, suFSess, setSuFSess,
    suQuery, setSuQuery, suSort, toggleSort, suMine, setSuMine,
    suHasMore, loadMoreSetups,
    onSetupFile, onSetupDrop, saveSetup, downloadSetup, suList } = useSetups({
    user, udoc, userName, teamData, t, active: tab === "setup" || suOpen,
    /* aktif yarıştan ön-doldurma: form açıldığında boş alanlar buradan dolar */
    raceSel: { track: st.track, cls: st.carClass, car: st.car } });

  /* ---- lmugarage.com resmi LMU yarış takvimi — Ana Menü → Resmi Yarışlar ----
     Yarıştan BAĞIMSIZ: yalnız scheduleOnly görünürken abone olur; race state gerekmez. */
  const lmu = useLmuSchedule({ user, udoc, active: scheduleOnly });
  /* Resmi Yarışlar → ön ayar (v1.7.3): bir resmi yarışın 📋 butonu, o yarışın
     pist/sınıf/süre/başlangıcıyla "Yarış Ekle" formunu doldurur ve takvimi kapatır
     → kullanıcı (belirli aracı seçip) Kaydet der → takım yarışı + strateji state
     oluşur (saveRaceForm/createRace). Takım yoksa buton hiç görünmez (curTeam gate). */
  const planOfficialRace = (r) => {
    if (!curTeam) return;
    /* flow:"data" → RaceEditModal 'İlerle →' butonu: önce takım takvimine kaydet,
       sonra DATA ekranında aç (raceToData). '+ Yarış ekle' ile aynı akış. */
    setRForm({ ...officialRaceToForm(r, {
      seasonId: curSeason || null,
      fallbackRaceTime: DEFAULT_STATE.raceTime,
      classId,
    }), flow: "data" });
    setScheduleOnly(false);
  };

  /* ---- yüzen mini oynatıcı → useMiniPlayer hook'u (konum/boyut/sürükle) ---- */
  const { streamCorner, streamMin, setStreamMin, streamW, streamDrag,
    startResize, moveStream } = useMiniPlayer();

  /* ---- sohbet bildirim sesi (mini oynatıcıdan bağımsız; useChat'e girdi) ---- */
  const [chatSound, setChatSound] = useState(() => {
    try { return localStorage.getItem("rm_chat_sound") !== "0"; } catch { return true; }
  });
  const toggleChatSound = () => setChatSound((v) => {
    try { localStorage.setItem("rm_chat_sound", v ? "0" : "1"); } catch { /* yoksay */ }
    return !v;
  });

  const [lobSeason, setLobSeason] = useState("all"); // lobide şampiyona süzgeci
  const [lobQuery, setLobQuery] = useState("");      // geçmiş yarış araması (§1.3)
  const [pastLimit, setPastLimit] = useState(12);    // geçmiş yarış sayfalama (§1.3)
  const [tnEdit, setTnEdit] = useState(null);        // takım adı düzenleme metni

  const myRole = teamData?.members?.[user?.uid] || "";
  const canEditTeam = myRole === "owner" || myRole === "editor";
  canEditRef.current = canEditTeam;   // useLive tur-geçmişi yazımı için güncel tut
  /* Canlı köprüyü ÇALIŞTIRMA yetkisi: takımın HERHANGİ bir üyesi (owner/editor/viewer).
     Strateji düzenlemeden (canEditTeam) AYRI: endurance'ta koltuğa geçecek co-sürücü
     "viewer" rolünde olsa da kendi PC'sinden canlıyı yayınlayabilmeli. Tek-yazıcı kirası
     çakışmayı zaten yönetir; strateji yazımı yine yalnız editor'de. */
  const isMember = !!myRole;
  /* rozet/rol yönetimi: takım sahibi veya site admini */
  const canManageTeam = myRole === "owner" || isAdmin;

  /* Canlı köprü (masaüstü) OTOMATİK yaşam döngüsü → useLiveBridge hook'una çıkarıldı
     (App.jsx Tanrı-bileşen borcunu azaltan ilk güvenli dilim). Davranış birebir aynı. */
  const bridge = useLiveBridge({ isMember, curTeam, curRace, user });
  /* not: yetki rozetten türer — 🎧 mühendis editor, 🛞 sürücü/rozetsiz viewer */
  const myBadges = teamBadgesOf(teamData, user?.uid, udoc);

  /* Kendi görünen adımı + Google foto URL'imi takım düğümüne yaz —
     diğer üyeler pilot listesinde ad + avatar görsün */
  useEffect(() => {
    if (!curTeam || !user?.uid || !teamData?.members?.[user.uid]) return;
    const nm = (userName || "").trim();
    if (!nm) return;
    const ph = user.photoURL || "";
    const nameSame = teamData?.names?.[user.uid] === nm;
    const photoSame = (teamData?.photos?.[user.uid] || "") === ph;
    if (nameSame && photoSame) return;
    setTeamMemberName(curTeam, user.uid, nm, ph).catch(() => {});
  }, [curTeam, user, userName, teamData]);

  /* Rozet yetkiyi belirler: 🎧 Mühendis → editor (datayı değiştirir),
     🛞 Sürücü / rozetsiz → viewer (sadece görür). Takım sahibi her zaman owner.
     Firebase kuralları rolü baz aldığı için rozet değişince rol de yazılır. */
  /* ---- sohbet (kanallar / okunmamış / ses / okundu takibi) → useChat hook'u ---- */
  const { chatOpen, setChatOpen, chatChan, setChatChan, chatChans, raceChan,
    chatAll, chatText, setChatText, doSendTo, curChan, chatEndRef, raceEndRef,
    unreadOf, chatUnread } = useChat({
    user, userName, curTeam, curRace, races, tab, chatSound });

  /* Sohbet gövdesi — hem pencerede hem yarış sekmesinde kullanılır */
  /* Sohbet paneli artık <ChatPanel> (./components). chatBody, doğru prop'ları
     ileten ince bir sarmalayıcı — iki çağrı yeri de bunu kullanır. */
  const chatBody = (chan, h) => (
    <ChatPanel
      msgs={(chan && chatAll[chan.path]) || []}
      h={h}
      t={t}
      lang={lang}
      user={user}
      teamData={teamData}
      fmtClock={fmtClock}
      canManage={chan?.id === "global" ? isAdmin : canManageTeam}
      chatText={chatText}
      setChatText={setChatText}
      onSend={() => doSendTo(chan)}
      onDelete={(id) => deleteChat(chan.path, id).catch(() => {})}
      endRef={chan === curChan ? chatEndRef : raceEndRef}
    />
  );

  /* Lobi setup penceresi — indirme odaklı sade liste.
     Yükleme/yönetim pit wall'daki Setup sekmesinde. */
  /* Ortak setup tablosu — hem lobi penceresinde hem pit wall sekmesinde. */
  /* Ortak setup yükleme formu — pit wall sekmesi ve lobi penceresi. */
  /* setupForm/setupTable artik <SetupForm>/<SetupTable> (./components) —
     ince sarmalayicilar dogru prop'lari iletir; lobi ve Setup sekmesi ayni. */
  const setupForm = (onCancel) => (
    <SetupForm t={t} onSetupFile={onSetupFile} onSetupDrop={onSetupDrop}
      suFile={suFile} suMeta={suMeta}
      setSuMeta={setSuMeta} seasons={seasons} suErr={suErr} suMsg={suMsg} suBusy={suBusy}
      saveSetup={saveSetup} onCancel={onCancel} />
  );

  /* Silme hatası eskiden yutuluyordu (.catch(()=>{})) → kural reddi/ağ hatasında
     satır ekranda kalıyor, kullanıcı sebebini göremiyordu. Tablo + kart ortak. */
  const onDeleteSetup = async (su) => {
    if (!(await confirmDialog({ title: t("Setupu sil"), message: t("Bu setup silinsin mi?") + "\n" + (su.name || ""), confirmText: t("Sil"), danger: true }))) return;
    deleteSetup(su.id)
      .then(() => setSuDelErr(""))
      .catch((e) => setSuDelErr(t("Silinemedi:") + " " + (e?.message || "")));
  };

  /* ⊞ kart / ☰ tablo — aynı satırlar ve handler'lar, yalnız sunum değişir. */
  const setupTable = (rows) => suView === "cards"
    ? <SetupCards rows={rows} t={t} st={st} lang={lang} isAdmin={isAdmin}
        cmpSel={cmpSel} onCmpToggle={cmpToggle}
        onDownload={downloadSetup} onView={setViewSu} onDelete={onDeleteSetup} />
    : <SetupTable rows={rows} t={t} st={st} lang={lang} isAdmin={isAdmin}
        sort={suSort} onSort={toggleSort} cmpSel={cmpSel} onCmpToggle={cmpToggle}
        onDownload={downloadSetup} onView={setViewSu} onDelete={onDeleteSetup} />;

  /* ⚖ alt-sabit karşılaştırma çubuğu — seçim varken görünür; 2 seçilince aç. */
  const cmpA = setups.find((x) => x.id === cmpSel[0]) || null;
  const cmpB = setups.find((x) => x.id === cmpSel[1]) || null;
  const cmpBar = cmpSel.length > 0 && !cmpOpen && (
    <div style={{ position: "fixed", left: "50%", bottom: 20, transform: "translateX(-50%)", zIndex: 40,
      display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderRadius: 12,
      background: "var(--rc-surface-2)", border: "1px solid var(--rc-brand-bright)", boxShadow: "0 8px 30px rgba(0,0,0,.45)", maxWidth: "94vw", flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, color: "var(--rc-text-2)" }}>
        {cmpSel.length} {t("setup seçili")}{cmpSel.length === 1 ? ` · ${t("bir tane daha seç")}` : ""}</span>
      <button onClick={() => setCmpOpen(true)} disabled={!(cmpA && cmpB)}
        style={{ padding: "7px 16px", borderRadius: 9, border: "1px solid var(--rc-brand-bright)", background: "var(--rc-brand)", color: "var(--rc-on-brand)", cursor: cmpA && cmpB ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 600, opacity: cmpA && cmpB ? 1 : .55 }}><Icon name="karsilastir" size={14} /> {t("Karşılaştır")}</button>
      <button onClick={() => setCmpSel([])}
        style={{ padding: "7px 12px", borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 13 }}>{t("Temizle")}</button>
    </div>
  );

  const setupCompareModal = (
    <SetupCompareModal open={cmpOpen && !!cmpA && !!cmpB} a={cmpA} b={cmpB}
      onClose={() => setCmpOpen(false)} t={t} />
  );

  const setupModal = (
    <SetupModal open={suOpen} onClose={() => setSuOpen(false)} t={t}
      suUpOpen={suUpOpen} setSuUpOpen={setSuUpOpen} suList={suList} setups={setups}
      suFTrack={suFTrack} setSuFTrack={setSuFTrack} suFCond={suFCond} setSuFCond={setSuFCond}
      suFSess={suFSess} setSuFSess={setSuFSess} suQuery={suQuery} setSuQuery={setSuQuery}
      suMine={suMine} setSuMine={setSuMine} suView={suView} toggleSuView={toggleSuView}
      suHasMore={suHasMore} loadMoreSetups={loadMoreSetups}
      setupForm={setupForm} setupTable={setupTable} />
  );

  const setupContentModal = (
    <SetupContentModal open={!!viewSu} su={viewSu} onClose={() => setViewSu(null)} t={t}
      onDownload={downloadSetup} onAddCompare={cmpToggle} inCompare={!!viewSu && cmpSel.includes(viewSu.id)} />
  );

  const chatModal = (
    <ChatModal open={chatOpen && !!user && !!curChan} onClose={() => setChatOpen(false)}
      t={t} lang={lang} chatSound={chatSound} toggleChatSound={toggleChatSound}
      chatChans={chatChans} unreadOf={unreadOf} chatChan={chatChan} setChatChan={setChatChan}
      teamData={teamData} curChan={curChan} chatBody={chatBody} chatAll={chatAll} fmtClock={fmtClock} />
  );

  /* Mini oynatıcı: sekmeden bağımsız, köşede sabit. iframe hep aynı ağaçta kalır,
     küçültünce yalnız gizlenir — yayın kesilmez. */
  const streamPlayer = curRace && ytId(st.streamUrl) && (
    <div className={`floatstream ${streamCorner} ${streamMin ? "min" : ""}`}
      style={streamMin ? undefined : { width: streamW }}>
      <div className="fshead">
        <span className="fsgrip" title={t("Boyutlandırmak için sürükle")}
          onPointerDown={startResize}>⤡</span>
        <span className="fstitle"><Icon name="goz" size={14} /> {t("Canlı Yayın")}</span>
        <span className="fsbtns">
          {[["tl", "◤"], ["tr", "◥"], ["bl", "◣"], ["br", "◢"]].map(([c, ch]) => (
            <button key={c} className={streamCorner === c ? "on" : ""}
              title={t("Köşeye taşı")} onClick={() => moveStream(c)}>{ch}</button>
          ))}
          <button title={streamMin ? t("Büyüt") : t("Küçült")}
            onClick={() => setStreamMin(!streamMin)}>{streamMin ? "▢" : "—"}</button>
          <a href={st.streamUrl} target="_blank" rel="noreferrer"
            title={t("YouTube'da aç")}>↗</a>
        </span>
      </div>
      <div className="fsbody">
        {streamDrag && <div className="fsshield" />}
        <iframe title="stream"
          src={`https://www.youtube.com/embed/${ytId(st.streamUrl)}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen />
      </div>
    </div>
  );


  /* Takım adı değişince kendi users/{uid}/teams kopyamı tazele — lobideki
     takım sekmeleri bu kopyayı okuyor, yoksa eski ad takılı kalır. */
  useEffect(() => {
    const nm = teamData?.meta?.name;
    if (!curTeam || !user?.uid || !nm) return;
    if (myTeams[curTeam] === nm) return;
    syncMyTeamName(user.uid, curTeam, nm).catch(() => {});
  }, [curTeam, user, teamData, myTeams]);

  /* Koçmark turu: yarış üst barındaki ? düğmesiyle, bulunulan ekranın adımından açılır.
     onCoachGo(scr) arkadaki ekranı senkronlar (sekme/takım). */
  const openCoach = () => { setCoachStart(TOUR_FOR[tab] ?? 0); setCoachOpen(true); };
  const onCoachGo = (scr) => {
    if (!scr) return;
    if (scr === "team") { setTeamOpen(true); return; }
    if (scr === "sys") { setBridgePopOpen(true); return; }
    setTeamOpen(false);
    setTab(scr);
  };
  const tourOverlay = (
    <CoachTour open={coachOpen} start={coachStart} onClose={() => setCoachOpen(false)} onGo={onCoachGo} t={t} />
  );

  const wantRole = (uid) => (hasBadge(teamData, uid, "engineer") ? "editor" : "viewer");
  const setBadge = async (uid, id, on) => {
    if (!curTeam) return;
    try {
      await toggleTeamBadge(curTeam, uid, id, on);
      const cur = teamData?.badges?.[uid];
      const bs = typeof cur === "string" ? { [cur]: true } : { ...(cur || {}) };
      bs[id] = on;
      if (teamData?.members?.[uid] !== "owner") {
        await setTeamRole(curTeam, uid, bs.engineer ? "editor" : "viewer");
      }
    } catch (e) { console.warn("rozet/rol yazılamadı:", e?.message); }
  };

  /* Rozetler yetkiye bağlanmadan önce atanmış üyelerde rol eski kalmış olabilir.
     Sahip/admin takımı açtığında rolleri rozetlerden bir kez hizala. */
  useEffect(() => {
    if (!curTeam || !canManageTeam || !teamData?.members) return;
    Object.entries(teamData.members).forEach(([uid, r]) => {
      if (r === "owner") return;
      const w = wantRole(uid);
      if (r !== w) setTeamRole(curTeam, uid, w).catch(() => {});
    });
  }, [curTeam, canManageTeam, teamData]);
  const roleLabel = (r) => (r === "owner" ? "Takım Sahibi"
    : r === "editor" ? "Düzenleyebilir" : "Sadece görür");

  /* Takımdaki pilotlar — rozetli olanlar önce, kadroda olmayanlar ayrı grupta */
  const teamDrivers = useMemo(() => {
    const names = teamData?.names || {};
    const list = Object.entries(names)
      .map(([uid, nm]) => ({ uid, nm: String(nm || "").trim() }))
      .filter((x) => x.nm)
      .sort((a, b) => {
        const da = hasBadge(teamData, a.uid, "driver") ? 0 : 1;
        const db2 = hasBadge(teamData, b.uid, "driver") ? 0 : 1;
        return da - db2 || a.nm.localeCompare(b.nm, "tr");
      })
      .map((x) => x.nm);
    return Array.from(new Set(list));
  }, [teamData]);

  const [allUsers, setAllUsers] = useState({});
  useEffect(() => {
    if (!isAdmin || !adminOpen) return;
    return watchAllUsers((u) => setAllUsers(u || {}));
  }, [isAdmin, adminOpen]);
  const doSignIn = async (mode = "in") => {
    if (signingIn) return; // ikinci tıklamayı yok say (v2.0 giriş ekranı)
    setAuthErr(""); setAuthMode(mode); setSigningIn(true);
    try { await signInGoogle(); }
    catch (e) {
      const em = e?.message || String(e);
      setAuthErr(em === "POPUP_BLOCKED"
        ? t("Tarayıcı açılır pencereyi engelledi. Bu site için açılır pencerelere izin verip tekrar deneyin.")
        : em === "OAUTH_CLIENT_MISSING"
        ? t("Masaüstü Google girişi yapılandırılmamış (VITE_GOOGLE_OAUTH_CLIENT_ID eksik). Yeni sürümü bekleyin.")
        : em === "OAUTH_TIMEOUT"
        ? t("Giriş zaman aşımına uğradı. Tarayıcıda açılan Google penceresinde giriş yapıp tekrar deneyin.")
        : isTauri
        ? t("Giriş tamamlanamadı — tarayıcıda açılan Google penceresinde giriş yapın. Sorun sürerse:") + " " + em
        : em);
      setSigningIn(false); // hata: düğmeyi tekrar aktif et (başarıda kapı zaten kapanır)
    }
  };
  /* ---- sürüm notları penceresi ---- */
  const [verOpen, setVerOpen] = useState(false);
  const [seenVer, setSeenVer] = useState(() => {
    try { return localStorage.getItem(SEEN_VER_KEY) || ""; } catch { return ""; }
  });
  const openVersions = () => {
    setVerOpen(true);
    try { localStorage.setItem(SEEN_VER_KEY, APP_VERSION); } catch { /* yoksay */ }
    setSeenVer(APP_VERSION);
  };
  const versionModal = (
    <VersionModal open={verOpen} onClose={() => setVerOpen(false)} t={t} lang={lang}
      onStartGuide={() => { setVerOpen(false); setCoachStart(TOUR_FOR[tab] ?? 0); setCoachOpen(true); }} />
  );

  /* ---- güncelleme penceresi (ortada modal — eski üst şeritlerin yerine) ---- */
  const updater = useUpdater();
  const updateHighlights = (CHANGELOG?.[0]?.[lang === "en" ? "en" : "tr"] || []).slice(0, 3);
  const updateModal = (
    <UpdateModal
      open={updater.open} lang={lang} phase={updater.phase} pct={updater.pct}
      autoRestart={updater.autoRestart} forced={updater.forced}
      oldVersion={updater.meta.oldVersion} newVersion={updater.meta.newVersion} size={updater.meta.size}
      highlights={updateHighlights}
      onToggleAuto={updater.toggleAuto} onUpdate={updater.update} onRestart={updater.restart}
      onLater={updater.later} onClose={updater.close}
      onAllChanges={() => { updater.close(); openVersions(); }} />
  );
  /* Üye yönetimi modalı — ana menü, takvim VE yarış görünümlerinde açılabilsin diye
     değişken olarak tutulur (buton ana menüdeydi ama modal yalnız yarış görünümünde
     render ediliyordu → ana menüde "Üyeler" açılmıyordu). */
  const adminModal = adminOpen && isAdmin && user && (
    <AdminModal open onClose={() => setAdminOpen(false)} users={allUsers} meUid={user.uid}
      onToggle={(uid, allow) => setUserAllowed(uid, allow).catch(() => {})} t={t} lang={lang} />
  );
  /* Profil & rozetler modalı — ana menü VE yarış görünümlerinde açılabilsin diye
     değişken (buton ana menüdeydi ama modal yalnız yarış görünümünde çiziliyordu). */
  const profileModal = profOpen && user && (() => {
        const av = avStage || myAvatar || user.photoURL;
        const initials = ((profName || user.email || "?").trim().split(/\s+/).filter(Boolean)
          .map((w) => w[0]).slice(0, 2).join("") || (user.email || "?")[0]).toUpperCase();
        const lbl = { display: "block", color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 };
        return (
        <div className="rc" onClick={() => setProfOpen(false)} role="dialog" aria-modal="true"
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,6,10,.74)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "rcfade .18s ease" }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: "min(680px,96vw)", maxHeight: "86vh", background: "var(--rc-surface)", border: "1px solid var(--rc-border-strong)", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 70px rgba(0,0,0,.6)", animation: "rcpop .24s cubic-bezier(.2,.9,.3,1.1)" }}>
            {/* başlık */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", borderBottom: "1px solid var(--rc-border)" }}>
              <span style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--rc-brand)", color: "var(--rc-on-brand)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 20, flex: "0 0 auto", overflow: "hidden" }}>
                {av ? <img src={av} alt="" referrerPolicy={/^https?:/.test(av) ? "no-referrer" : undefined} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}</span>
              <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 22, letterSpacing: ".02em" }}>{profName || user.email}</b>
                <span style={{ fontSize: 11.5, color: "var(--rc-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[user.email, teamData?.meta?.name].filter(Boolean).join(" · ")}</span>
              </span>
              <button onClick={() => setProfOpen(false)} style={{ marginLeft: "auto", width: 32, height: 32, borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 15, lineHeight: 1 }}>✕</button>
            </div>
            {/* gövde: ad + görsel | rozetler */}
            <div style={{ overflowY: "auto", padding: "18px 20px 22px", display: "flex", flexWrap: "wrap", gap: 18 }}>
              <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={lbl}>{t("Görünen ad")}</label>
                  <input type="text" value={profName} onChange={(e) => setProfName(e.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", background: "var(--rc-surface-3)", border: "1px solid var(--rc-border-strong)", borderRadius: 10, color: "var(--rc-text)", padding: "11px 14px", fontFamily: "var(--rc-font-display)", fontSize: 18, fontWeight: 700, textTransform: "none" }} />
                  <div style={{ color: "var(--rc-text-3)", fontSize: 11, marginTop: 5 }}>{t("Timing tablosunda ve sohbette bu ad görünür")}</div>
                </div>
                <div>
                  <label style={lbl}>{t("Profil görseli")}</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 70, height: 70, flex: "0 0 auto", border: "1.5px dashed var(--rc-border-strong)", borderRadius: "50%", background: "var(--rc-surface-2)", display: "grid", placeItems: "center", fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 20, color: "var(--rc-text-3)", overflow: "hidden" }}>
                      {av ? <img src={av} alt="" referrerPolicy={/^https?:/.test(av) ? "no-referrer" : undefined} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      <span style={{ display: "flex", gap: 7 }}>
                        <input id="avfile" type="file" accept={IMG_ACCEPT_TYPES.join(",")} style={{ display: "none" }}
                          onChange={(e) => { onAvatarFile(e.target.files?.[0]); e.target.value = ""; }} />
                        <button disabled={avBusy} onClick={() => document.getElementById("avfile")?.click()}
                          style={{ padding: "6px 13px", borderRadius: 8, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text)", cursor: "pointer", fontSize: 12 }}>{avBusy ? t("Yükleniyor…") : t("Yükle")}</button>
                        {(myAvatar || avStage) && (
                          <button disabled={avBusy} onClick={async () => { setAvStage(""); setAvErr(""); await clearUserAvatar(user.uid).catch(() => {}); setMyAvatar(""); }}
                            style={{ padding: "6px 13px", borderRadius: 8, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-3)", cursor: "pointer", fontSize: 12 }}>{t("Kaldır")}</button>
                        )}
                      </span>
                      <span style={{ fontSize: 10.5, color: "var(--rc-text-3)" }}>{avStage ? t("Önizleme — Kaydet ile uygulanır") : t("Boşsa baş harflerin kullanılır")}</span>
                    </div>
                  </div>
                  {avErr && <div style={{ fontSize: 12, color: "var(--rc-warn)", marginTop: 6 }}><Icon name="uyari" size={14} /> {avErr}</div>}
                </div>
              </div>
              {myBadges.length > 0 && (
                <div style={{ flex: "1 1 280px", minWidth: 260, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface-2)", padding: 16 }}>
                    <div style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 13, fontWeight: 700, color: "var(--rc-brand-bright)", marginBottom: 12 }}>{t("Rozetler")}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
                      {myBadges.map((b) => {
                        const on = !b.locked;
                        return (
                          <span key={b.lbl} title={t(b.lbl)} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 13px 8px 9px", borderRadius: 10, border: `1px solid ${on ? b.col + "66" : "var(--rc-border)"}`, background: on ? "var(--rc-surface-3)" : "transparent", opacity: on ? 1 : .5 }}>
                            <span style={{ width: 27, height: 27, flex: "0 0 auto", borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", background: on ? b.col + "1F" : "var(--rc-surface-3)", color: on ? b.col : "var(--rc-icon-off)" }}>{b.ico}</span>
                            <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                              <b style={{ fontSize: 12, whiteSpace: "nowrap" }}>{t(b.lbl)}</b>
                              {b.note && <span style={{ fontSize: 10, color: "var(--rc-text-3)", whiteSpace: "nowrap" }}>{t(b.note)}</span>}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* alt */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderTop: "1px solid var(--rc-border)", background: "var(--rc-surface-2)" }}>
              <span style={{ color: "var(--rc-text-3)", fontSize: 11.5 }}>{t("Odalarda ve stint programında bu isim görünür.")}</span>
              <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button onClick={() => { setAvStage(""); setAvErr(""); setProfOpen(false); }}
                  style={{ padding: "9px 16px", borderRadius: 10, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 13 }}>{t("Vazgeç")}</button>
                <button disabled={!profName.trim()} style={{ padding: "9px 20px", borderRadius: 10, border: `1px solid ${profName.trim() ? "var(--rc-brand-bright)" : "var(--rc-border)"}`, background: profName.trim() ? "var(--rc-brand)" : "var(--rc-surface-3)", color: profName.trim() ? "var(--rc-on-brand)" : "var(--rc-text-3)", cursor: profName.trim() ? "pointer" : "not-allowed", fontFamily: "var(--rc-font-display)", fontSize: 15, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" }}
                  onClick={async () => {
                    const n = profName.trim().slice(0, 60);
                    await updateProfile(user.uid, { fullName: n }).catch(() => {});
                    if (avStage) {
                      try { await saveUserAvatar(user.uid, avStage); setMyAvatar(avStage); }
                      catch { setAvErr(t("Avatar kaydedilemedi — tekrar deneyin.")); return; }
                      setAvStage("");
                    }
                    setUserName(n); setProfOpen(false);
                  }}>{t("Kaydet")}</button>
              </span>
            </div>
          </div>
        </div>
        );
  })();
  /* Yetki reddi kutucuğu — viewer bir yarışta düzenleme deneyince belirir (edit() muhafızı).
     key={deny} her tıkta remount → animasyon yeniden oynar; ~2.6 sn sonra kendini kapatır. */
  const denyToast = deny > 0 && (
    <DenyToast key={deny}
      text={t("Bu işlem için yetkiniz yok — düzenleme Yarış Mühendisi/Takım Sahibine açık")}
      onDone={() => setDeny(0)} />
  );
  /* Komut paleti aksiyonları — sekmeler + hızlı ayarlar. */
  const cmdActions = [
    { id: "dash", label: t("Dashboard"), keywords: "dash panel", icon: <Icon name="gosterge" size={15} />, run: () => setTab("dash") },
    { id: "schedule", label: t("Resmi Yarışlar"), keywords: "schedule takvim race yarış lmugarage resmi official", icon: <Icon name="takvim" size={15} />, run: () => setScheduleOnly(true) },
    { id: "stint", label: t("Stint"), keywords: "stint", icon: <Icon name="stint" size={15} />, run: () => setTab("stint") },
    { id: "fuel", label: t("Son Stint Yakıtı"), keywords: "fuel yakıt", icon: <Icon name="yakit" size={15} />, run: () => setTab("fuel") },
    { id: "live", label: t("Canlı"), keywords: "live canlı timing", icon: <Icon name="canli" size={15} />, run: () => setTab("live") },
    { id: "tyre", label: t("Lastik"), keywords: "tyre lastik", icon: <Icon name="lastik" size={15} />, run: () => setTab("tyre") },
    { id: "drivers", label: t("Pilotlar"), keywords: "drivers pilot", icon: <Icon name="kask" size={15} />, run: () => setTab("drivers") },
    { id: "tele", label: t("Telemetri"), keywords: "telemetry telemetri", icon: <Icon name="telemetri" size={15} />, run: () => setTab("tele") },
    { id: "setup", label: t("Setup"), keywords: "setup", icon: <Icon name="setup" size={15} />, run: () => setTab("setup") },
    ...(raceChan ? [{ id: "rchat", label: t("Yarış Sohbeti"), keywords: "chat sohbet", icon: <Icon name="sohbet" size={15} />, run: () => setTab("rchat") }] : []),
    { id: "theme", label: theme === "light" ? t("Koyu temaya geç") : t("Açık temaya geç"), keywords: "theme tema dark light", icon: <Icon name={theme === "light" ? "moon" : "sun"} size={15} />, run: toggleTheme },
    { id: "density", label: t("Yoğunluğu değiştir"), keywords: "density yoğunluk", icon: <Icon name="rows" size={15} />, run: toggleDensity },
    { id: "lang", label: lang === "en" ? "Türkçe" : "English", keywords: "language dil", run: () => switchLang(lang === "en" ? "tr" : "en") },
    ...(user ? [{ id: "chat", label: t("Sohbet"), keywords: "chat sohbet team", icon: <Icon name="sohbet" size={15} />, run: () => setChatOpen(true) }] : []),
    ...(curRace ? [{ id: "home", label: t("Ana Menü"), keywords: "home ana menü lobby", icon: <Icon name="home" size={15} />, run: leaveRace }] : []),
  ].map((a) => ({ ...a, group: ["theme", "density", "lang", "home"].includes(a.id) ? t("Komutlar") : t("Ekranlar") }));
  const cmdPalette = (
    <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} actions={cmdActions} t={t} />
  );

  const [wxPlanW, setWxPlanW] = useState("wet"); // planlı geçiş: hava
  const [wxPlanT, setWxPlanT] = useState("");    // planlı geçiş: yarış saati
  const [wxModal, setWxModal] = useState(false); // v2.0 Hava geçişi ekle modalı
  const [zoom, setZoom] = useState(null); // "car" | "track" | null — kart büyütme (lightbox)
  /* LMU referans verisi (Ohne Speed tablosundan gömülü JSON) — 47 KB; giriş/izin
     ekranlarında gerekmez → yalnız erişim onaylanınca çekilir. */
  const [lmuData, setLmuData] = useState(null);
  useEffect(() => {
    if (!access && authReady) return;   // authReady=false (yapılandırmasız dev) → kapı yok, hemen çek
    fetch(`${ASSET}lmu-data.json`).then((r) => (r.ok ? r.json() : null))
      .then((j) => setLmuData(j)).catch(() => {});
  }, [access]);
  const lmuSuggest = (() => {
    const d = lmuData?.data?.[st.track];
    if (!d) return null;
    return d[`${st.carClass}:${st.car}`] || d[st.carClass] || null;
  })();
  /* pist/araç değişince LMU temposunu varsayılan olarak yaz (ilk yüklemede
     kayıtlı değeri ezmez; kullanıcı sonradan elle değiştirebilir) */
  const lmuPrevSel = useRef(null);
  useEffect(() => {
    const sel = `${st.track}|${st.carClass}|${st.car}`;
    if (lmuPrevSel.current === null) { lmuPrevSel.current = sel; return; }
    if (lmuPrevSel.current === sel) return;
    lmuPrevSel.current = sel;
    if (lmuSuggest?.avgLap) up({ avgLap: lmuSuggest.avgLap,
      ...(lmuSuggest.consumption != null ? { consumption: lmuSuggest.consumption } : {}) });
  }, [st.track, st.carClass, st.car, lmuData]);
  /* multiclass: lider turu = seçili lider sınıfın COMPETITIVE (1.01) temposu */
  useEffect(() => {
    if (!st.multiclass) return;
    const e = lmuData?.data?.[st.track]?.[st.leaderClass];
    const v = e?.tiers?.c101 || e?.avgLap;
    if (v && v !== st.leaderLap) up({ leaderLap: v });
  }, [st.multiclass, st.leaderClass, st.track, lmuData]);
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e) => { if (e.key === "Escape") setZoom(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  const upcomingPit = liveInfo.status === "live" ? (st.pits[liveInfo.stintIdx] || EMPTY_PIT) : null;
  const upcomingIsLast = liveInfo.status === "live"
    && liveInfo.stintIdx >= racePlan.rows.length - 2;

  const timeline = useMemo(() => buildTimeline(plan), [plan]);

  /* yarış ekleme / düzenleme penceresi → RaceEditModal (sunum); kaydetme iş
     mantığı burada (createRace/updateRace + init state hazırlığı). */
  const saveRaceForm = async (f) => {
    const payload = {
      seasonId: f.seasonId || null,
      round: f.round ? Number(f.round) : null,
      name: f.name || "", trackId: f.trackId || "",
      carClass: f.carClass || "", carId: f.carId || "",
      raceTime: f.raceTime || "", startsAt: f.startsAt || 0,
    };
    let rid = f.rid || null;
    if (f.rid) {
      await updateRace(curTeam, f.rid, payload).catch(() => {});
    } else {
      /* yarış verisi önceden hazırlanır: pist/araç/süre/başlangıç dolu gelir.
         Resmi ön ayardan geldiyse lastik seti sınırı (f.tyreSets → st.tyreLimit). */
      const init = migrate({
        ...DEFAULT_STATE,
        track: payload.trackId, carClass: payload.carClass, car: payload.carId,
        raceTime: payload.raceTime || DEFAULT_STATE.raceTime,
        raceStartMs: payload.startsAt || Date.now(),
        pitLaneTime: PIT_LANE_TIMES[payload.trackId] ?? DEFAULT_STATE.pitLaneTime,
        tyreLimit: f.tyreSets > 0 ? f.tyreSets : DEFAULT_STATE.tyreLimit,
      });
      rid = await createRace(curTeam, payload, init, user?.uid).catch(() => null);
    }
    setRForm(null);
    return rid;
  };
  /* "İlerle →": önce yarışı TAKIM takvimine kaydet (solo değil), sonra o yarışı
     data (setup) ekranında aç → kullanıcı stint/yakıt verisini girip planı kurar.
     Kaydedilen yarış takım listesinde de görünür. */
  const raceToData = async (f) => {
    if (!curTeam) return;
    const rid = await saveRaceForm(f);
    if (!rid) return;
    await openRace(rid);          // uzak state + sync kurulumu (setup done=true yapar)
    setScheduleOnly(false);
    setSetupDone(false);          // → race workspace yerine DATA ekranında başla
  };
  const raceForm = (
    <RaceEditModal rForm={rForm} setRForm={setRForm} t={t} seasons={seasons} onSave={saveRaceForm} onProceed={raceToData} lmuData={lmuData} />
  );

  /* v2.0 Hava geçişi ekle modalı (handoff-spec/katmanlar/wxOpen.md). Planlı hava
     geçişini yarış saatine ekler; weatherLog'a src:"plan" olarak yazılır. */
  const wxTransModal = wxModal && (() => {
    const raceTotal = parseHMS(st.raceTime) || 0;
    const tSec = parseHMS(wxPlanT) || 0;
    const pos = raceTotal > 0 ? Math.min(1, Math.max(0, tSec / raceTotal)) : 0;
    const clockAt = st.raceStartMs ? new Date(st.raceStartMs + tSec * 1000) : null;
    const mult = (WEATHER[wxPlanW] || WEATHER.dry).lap;
    const lapDelta = (parseLap(st.avgLap) || 0) * (mult - 1);
    const planList = (st.weatherLog || []).filter((e) => e.src === "plan").sort((a, b) => a.t - b.t);
    const hh = Math.floor(tSec / 3600), mm = Math.floor((tSec % 3600) / 60);
    const stintSec = (st.strategies[st.chosen] ?? 0) * (parseLap(st.avgLap) || 0); // stint süresi = tur×lapSec
    const addTrans = () => {
      if (tSec <= 0) return;
      const log = [...(st.weatherLog || []).filter((e) => Math.abs(e.t - tSec) > 0.5), { t: tSec, w: wxPlanW, src: "plan" }].sort((a, b) => a.t - b.t);
      up({ weatherLog: log }); setWxModal(false); setWxPlanT("");
    };
    return (
      <div onClick={() => setWxModal(false)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "var(--rc-scrim)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "rcfade .18s ease" }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: "min(720px,96vw)", background: "var(--rc-surface)", border: "1px solid var(--rc-border-strong)", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,.6)", animation: "rcpop .24s cubic-bezier(.2,.9,.3,1.1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--rc-border)" }}>
            <span style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".07em", fontSize: 19, fontWeight: 700 }}>{t("Hava geçişi ekle")}</span>
            <span style={{ color: "var(--rc-text-3)", fontSize: 12 }}>{t("Yarış saatinde havanın değiştiği an")}</span>
            <button onClick={() => setWxModal(false)} style={{ marginLeft: "auto", width: 32, height: 32, borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 15, lineHeight: 1 }}>✕</button>
          </div>
          <div style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={{ display: "block", color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>{t("Yarış saati")}</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <input type="text" value={wxPlanT} placeholder="s:dd:ss" onChange={(e) => setWxPlanT(e.target.value)} style={{ width: 150, background: "var(--rc-surface-3)", border: "1px solid var(--rc-border-strong)", borderRadius: 10, color: "var(--rc-text)", padding: "11px 14px", fontFamily: "var(--rc-font-display)", fontSize: 22, fontWeight: 600 }} />
                <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{tSec > 0 ? `start + ${hh > 0 ? `${hh}sa ` : ""}${mm}dk${clockAt ? ` · ${t("saat")} ${clockAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}` : t("geçiş saatini gir")}</span>
                <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  <button onClick={() => setWxPlanT(fmtHMS(liveInfo.status === "live" ? Math.round(liveInfo.elapsed / 1000) : 0))} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 11.5 }}>{t("Şu an")}</button>
                  <button onClick={() => setWxPlanT(fmtHMS(Math.round((stintSec > 0 ? Math.max(1, Math.round(tSec / stintSec)) : 1) * stintSec)))} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 11.5 }}>{t("Stint başı")}</button>
                </span>
              </div>
              <div style={{ position: "relative", height: 44, marginTop: 14, border: "1px solid var(--rc-border)", borderRadius: 10, background: "var(--rc-surface-2)", overflow: "hidden" }}>
                {raceTotal > 0 && (() => {
                  /* girilen değer önizleme olarak zone'lara katılır (eklemeden önce görünür) */
                  const base = (st.weatherLog || []).filter((e) => !(tSec > 0 && Math.abs(e.t - tSec) <= 0.5));
                  const trans = [...base, ...(tSec > 0 ? [{ t: tSec, w: wxPlanW, src: "preview" }] : [])].sort((a, b) => a.t - b.t);
                  const startW = (trans.find((e) => e.t <= 0.5)?.w) || st.weather || "dry";
                  const zones = []; let pT = 0, pW = startW;
                  for (const e of trans.filter((x) => x.t > 0.5)) { zones.push({ from: pT, to: e.t, w: pW }); pT = e.t; pW = e.w; }
                  zones.push({ from: pT, to: raceTotal, w: pW });
                  return (<>
                    {zones.map((z, i) => (
                      <span key={`z${i}`} style={{ position: "absolute", left: `${(z.from / raceTotal) * 100}%`, width: `${Math.max(0, ((z.to - z.from) / raceTotal) * 100)}%`, top: 0, bottom: 0, background: (WEATHER[z.w] || WEATHER.dry).col, opacity: .22, transition: "left .28s cubic-bezier(.4,0,.2,1), width .28s cubic-bezier(.4,0,.2,1)" }} />
                    ))}
                    {trans.filter((e) => e.t > 0.5).map((e, i) => (
                      <span key={`m${i}`} style={{ position: "absolute", left: `${(e.t / raceTotal) * 100}%`, top: 0, bottom: 0, width: 2, background: (WEATHER[e.w] || WEATHER.dry).col, transition: "left .28s cubic-bezier(.4,0,.2,1)" }} title={`${fmtHMS(e.t)} · ${t((WEATHER[e.w] || WEATHER.dry).lbl)}`} />
                    ))}
                  </>);
                })()}
                {pos > 0 && <span style={{ position: "absolute", left: `${pos * 100}%`, top: 0, bottom: 0, width: 2, background: "var(--rc-brand-bright)", boxShadow: "0 0 8px var(--rc-brand-bright)", animation: "rcpulse 1.2s ease-in-out infinite", transition: "left .28s cubic-bezier(.4,0,.2,1)" }} />}
                {pos > 0 && <span style={{ position: "absolute", left: `${pos * 100}%`, top: 5, transform: "translateX(-50%)", fontFamily: "var(--rc-font-display)", fontSize: 10, color: "var(--rc-brand-bright)", background: "var(--rc-surface-2)", padding: "0 5px", whiteSpace: "nowrap", transition: "left .28s cubic-bezier(.4,0,.2,1)" }}>{wxPlanT}</span>}
                <span style={{ position: "absolute", left: 10, bottom: 5, fontSize: 10, color: "var(--rc-text-3)", fontFamily: "var(--rc-font-display)" }}>0:00</span>
                <span style={{ position: "absolute", right: 10, bottom: 5, fontSize: 10, color: "var(--rc-text-3)", fontFamily: "var(--rc-font-display)" }}>{st.raceTime}</span>
              </div>
            </div>
            <div>
              <label style={{ display: "block", color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>{t("Bu andan sonraki hava")}</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
                {Object.entries(WEATHER).map(([id, w]) => {
                  const on = wxPlanW === id;
                  return (
                    <button key={id} onClick={() => setWxPlanW(id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 4px", borderRadius: 11, cursor: "pointer", textAlign: "center", border: `1px solid ${on ? w.col : "var(--rc-border)"}`, background: on ? "rgba(255,255,255,.05)" : "var(--rc-surface-3)", color: on ? w.col : "var(--rc-text-2)" }}>
                      <WetIcon id={id} size={28} />
                      <span style={{ fontSize: 12, marginTop: 5 }}>{t(w.lbl)}</span>
                      <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 10.5, color: "var(--rc-text-3)", marginTop: 2 }}>×{w.lap.toFixed(2)}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, padding: "11px 14px", borderRadius: 10, border: "1px solid var(--rc-border-strong)", background: "var(--rc-surface-2)", flexWrap: "wrap" }}>
                <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{t("Plana etkisi")}</span>
                <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 14, color: lapDelta > 0 ? "var(--rc-warn)" : "var(--rc-ok)" }}>tur {lapDelta >= 0 ? "+" : ""}{lapDelta.toFixed(1)} sn</b>
                <span style={{ color: "var(--rc-border-strong)" }}>·</span>
                <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 14 }}>×{mult.toFixed(2)} {t("çarpan")}</b>
              </div>
            </div>
            <div>
              <label style={{ display: "block", color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>{t("Planlı geçişler")}</label>
              <div style={{ border: "1px solid var(--rc-border)", borderRadius: 11, background: "var(--rc-surface-2)", overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderBottom: planList.length ? "1px solid var(--rc-line-soft)" : "none" }}>
                  <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 14, width: 64 }}>0:00:00</b>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--rc-text-2)" }}>{t((WEATHER[(st.weatherLog || [])[0]?.w] || WEATHER.dry).lbl)}</span>
                  <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", padding: "2px 9px", borderRadius: 99, border: "1px solid var(--rc-border)", color: "var(--rc-text-3)" }}>{t("başlangıç")}</span>
                </div>
                {planList.map((e, i) => (
                  <div key={`${e.t}-${i}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderTop: i > 0 ? "1px solid var(--rc-line-soft)" : "none" }}>
                    <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 14, width: 64, color: "var(--rc-brand-bright)" }}>{fmtHMS(e.t)}</b>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: (WEATHER[e.w] || WEATHER.dry).col }}>{t((WEATHER[e.w] || WEATHER.dry).lbl)}</span>
                    <button onClick={() => up({ weatherLog: (st.weatherLog || []).filter((x) => x !== e) })} style={{ marginLeft: "auto", width: 30, height: 28, borderRadius: 8, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-3)", cursor: "pointer", fontSize: 12 }}><Icon name="sil" size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderTop: "1px solid var(--rc-border)", background: "var(--rc-surface-2)" }}>
            <span style={{ color: "var(--rc-text-3)", fontSize: 11.5 }}>{t("Geçişler plan hesabına anında yansır")}</span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button onClick={() => setWxModal(false)} style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 13 }}>{t("Vazgeç")}</button>
              <button onClick={addTrans} style={{ padding: "10px 22px", borderRadius: 10, border: "1px solid var(--rc-brand-bright)", background: "var(--rc-brand)", color: "var(--rc-on-brand)", cursor: "pointer", fontFamily: "var(--rc-font-display)", fontSize: 15, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" }}>{t("Geçişi ekle")}</button>
            </span>
          </div>
        </div>
      </div>
    );
  })();

  /* takım penceresi → TeamModal (sunum); depo fn'leri bileşende, navigasyon/
     rozet/rol yardımcıları (openRace/setRForm/setBadge/roleLabel) App'ten prop. */
  const teamModal = (
    <TeamModal open={teamOpen} onClose={() => setTeamOpen(false)} user={user} t={t} lang={lang}
      myTeams={myTeams} curTeam={curTeam} setCurTeam={setCurTeam} teamData={teamData}
      tnEdit={tnEdit} setTnEdit={setTnEdit} canManageTeam={canManageTeam} canEditTeam={canEditTeam}
      curSeason={curSeason} setCurSeason={setCurSeason} seasons={seasons} races={races} st={st}
      myRole={myRole} openRace={(rid) => openRace(rid, "stint")} setRForm={setRForm} setBadge={setBadge}
      roleLabel={roleLabel}
      onCreateJoin={() => { setTeamOpen(false); setCreateJoinOpen(true); }} />
  );

  /* Create & Join — takım kur / katıl (yönetimden AYRI, sade ekran; v1.6) */
  const createJoinModal = (
    <CreateJoinModal open={createJoinOpen} onClose={() => setCreateJoinOpen(false)}
      user={user} t={t} userName={userName}
      tForm={tForm} setTForm={setTForm} setTErr={setTErr} tErr={tErr} setCurTeam={setCurTeam} />
  );

  /* ---------- YARIŞ DATALARI yan paneli — handoff-spec/ekranlar/12-yaris-datalari.md
     BİREBİR. Fişteki markup eleman sırası/iç içe yapı/stil değerleriyle kopyalandı; renk
     → var(--rc-*) token tablosu, {{ }} → gerçek veri, <sc-for>→.map, <sc-if>→koşul.
     TEK FARK: alttaki sabit "Uygula/Geri/Yarışı aç" çubuğu YOK — her giriş up() ile
     plana anında yansır (yan panelde ayrı uygula adımı istenmedi). Dar (300px) kolonda
     flex-wrap ile tek sütuna iner. ---------- */
  const dataCards = (() => {
    const rc = races[curRace] || {};
    const clsD = st.carClass || "hypercar";
    const totLaps = racePlan.totalLaps || 0;
    const lapSec = parseLap(st.avgLap) || 0;
    const fmtStint = (laps) => (lapSec > 0 && laps > 0 ? fmtHMS(laps * lapSec) : "—");
    const stStints = racePlan.rows?.length || 0;
    const lapsPerStint = st.strategies[st.chosen] ?? 0;
    const chosenPits = stStints > 0 ? Math.max(0, stStints - 1)
      : (lapsPerStint > 0 && totLaps > 0 ? Math.max(0, Math.ceil(totLaps / lapsPerStint) - 1) : 0);
    const pitTotal = (Number(st.pitLaneTime) || 0) + (Number(st.fuelTime) || 0);
    const pitRaceSec = pitTotal * chosenPits;
    const pitRace = `${Math.floor(pitRaceSec / 60)}:${String(Math.round(pitRaceSec % 60)).padStart(2, "0")}`;
    const range = st.consumption > 0 ? Math.round(100 / st.consumption) : null;
    const planList = (st.weatherLog || []).filter((e) => e.src === "plan").sort((a, b) => a.t - b.t);
    const wxNow = WEATHER[st.weather] || WEATHER.dry;
    const pickWx = (id) => {
      const el = liveInfo.status === "live" ? Math.max(0, Math.round(liveInfo.elapsed / 1000)) : 0;
      let past = (st.weatherLog || []).filter((e) => e.t < el - 0.5);
      const future = (st.weatherLog || []).filter((e) => e.t > el + 0.5);
      if (el < 1) past = [];
      const log = [...past, { t: el, w: id, src: "live" }, ...future].sort((a, b) => a.t - b.t);
      const cur = wxAtRel(log, el);
      up({ weather: Object.keys(WEATHER).find((k) => WEATHER[k] === cur) || id, weatherLog: log });
    };
    /* fişteki stil objeleri (renk→token) */
    const lbl = { display: "block", color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 };
    const card = { border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)", padding: "16px 18px" };
    const hd = { fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 16, fontWeight: 700 };
    const bigInp = { width: "100%", boxSizing: "border-box", background: "var(--rc-surface-3)", border: "1px solid var(--rc-border-strong)", borderRadius: 10, color: "var(--rc-text)", padding: "12px 14px", fontFamily: "var(--rc-font-display)", fontSize: 22, fontWeight: 600 };
    const stepWrap = { display: "inline-flex", alignItems: "center", border: "1px solid var(--rc-border)", borderRadius: 10, overflow: "hidden" };
    const stepB = { width: 38, height: 44, border: "none", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 16 };
    const stepV = { minWidth: 52, textAlign: "center", fontFamily: "var(--rc-font-display)", fontSize: 19 };
    /* yanlarda − + butonlu, ortada elle yazılabilir (ondalık-güvenli) sayı alanı
       → native yukarı/aşağı ok yerine soldan/sağdan artır-azalt. */
    const stepSideB = { width: 36, height: 44, border: "none", background: "transparent", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 18, lineHeight: 1, flex: "0 0 auto" };
    const stepField = (value, onC, step, dec = 0) => {
      const r = (n) => (dec ? Math.round(n * 100) / 100 : Math.round(n));
      return (
        <span className="stepnum" style={{ display: "flex", alignItems: "center", border: "1px solid var(--rc-border)", borderRadius: 10, overflow: "hidden", background: "var(--rc-surface-3)" }}>
          <button onClick={() => onC(Math.max(0, r((Number(value) || 0) - step)))} style={stepSideB}>−</button>
          <NumField value={value} onC={onC} step={String(step)} style={{ flex: 1, minWidth: 0, textAlign: "center", background: "transparent", border: "none", color: "var(--rc-text)", padding: "11px 2px", fontFamily: "var(--rc-font-display)", fontSize: 19, fontWeight: 600 }} />
          <button onClick={() => onC(r((Number(value) || 0) + step))} style={stepSideB}>+</button>
        </span>
      );
    };
    const statBox = (ok) => ({ flex: "1 1 150px", padding: "11px 14px", borderRadius: 10, border: `1px solid ${ok ? "rgba(55,214,122,.35)" : "var(--rc-border)"}`, background: ok ? "rgba(55,214,122,.07)" : "var(--rc-surface-2)" });
    const statV = (ok) => ({ fontFamily: "var(--rc-font-display)", fontSize: 19, fontWeight: 600, ...(ok ? { color: "var(--rc-ok)" } : {}) });
    const statL = { color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", marginTop: 3 };
    return (
      <div data-tour="data">
        {/* başlık: ← Yarış dataları · pist/araç (yan panelde ← yerine paneli gizle) */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <button onClick={() => setSideOpen(false)} title={t("Paneli gizle")} style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 14 }}>✕</button>
          <h2 style={{ margin: 0, fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".06em", fontSize: 22, fontWeight: 700 }}>{t("Yarış dataları")}</h2>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--rc-text-2)" }}>
            {st.track && <img src={`${ASSET}flags/${TRACK_ASSET(st.track)}.png${AV}`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ width: 20, borderRadius: 2 }} />}{trackName(st.track) || "—"}
            {st.car && <><span style={{ color: "var(--rc-border-strong)" }}>·</span><img src={`${ASSET}class/${clsD}.png${AV}`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ height: 16 }} />{carName(clsD, st.car)}</>}
          </span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>

          {/* ---- SOL KOLON ---- */}
          <div style={{ flex: "1 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Yarış */}
            <div style={card}>
              <div style={{ ...hd, marginBottom: 14 }}>{t("Yarış")}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                <div style={{ flex: "1 1 170px", minWidth: 0 }}>
                  <label style={lbl}>{t("Yarış süresi")} · h:mm:ss</label>
                  <input type="text" value={st.raceTime} onChange={(e) => up({ raceTime: e.target.value })} style={bigInp} />
                </div>
                <div style={{ flex: "1 1 170px", minWidth: 0 }}>
                  <label style={lbl}>{t("Ortalama tur")} · m:ss.00</label>
                  <input type="text" value={st.avgLap} onChange={(e) => up({ avgLap: e.target.value })} style={bigInp} />
                  {avgSug && canEdit && (
                    <button onClick={() => up({ avgLap: avgSug.txt })} title={t("Canlı son 5 turun ortalaması — tıkla, plana uygula")}
                      style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 7, padding: "7px 12px", borderRadius: 9, border: "1px solid rgba(55,214,122,.45)", background: "rgba(55,214,122,.10)", color: "var(--rc-ok)", cursor: "pointer", fontSize: 11.5, width: "100%" }}><Icon name="simsek" size={14} /> {t("Canlı AVG5")} <b style={{ fontFamily: "var(--rc-font-display)" }}>{avgSug.txt}</b> — {t("uygula")}</button>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 14, alignItems: "flex-end" }}>
                <div style={{ flex: "0 0 auto" }}>
                  <label style={lbl}>{t("Ekstra tur")}</label>
                  <span style={stepWrap}>
                    <button onClick={() => up({ extraLap: Math.max(0, (st.extraLap || 0) - 1) })} style={stepB}>−</button>
                    <b style={stepV}>{st.extraLap ?? 0}</b>
                    <button onClick={() => up({ extraLap: (st.extraLap || 0) + 1 })} style={stepB}>+</button>
                  </span>
                </div>
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <button onClick={() => up({ multiclass: !st.multiclass })}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 13px", borderRadius: 10, cursor: "pointer", color: "var(--rc-text)", border: `1px solid ${st.multiclass ? "var(--rc-brand-bright)" : "var(--rc-border)"}`, background: st.multiclass ? "rgba(150,0,24,.18)" : "var(--rc-surface-3)" }}>
                    <span style={{ width: 20, height: 20, borderRadius: 6, flex: "0 0 auto", display: "grid", placeItems: "center", fontSize: 11, border: `1px solid ${st.multiclass ? "var(--rc-brand-bright)" : "var(--rc-border-strong)"}`, background: st.multiclass ? "var(--rc-brand)" : "transparent", color: st.multiclass ? "var(--rc-on-brand)" : "transparent" }}>✓</span>
                    <span style={{ display: "flex", flexDirection: "column", gap: 1, textAlign: "left" }}>
                      <b style={{ fontSize: 13 }}>{t("Multiclass yarış")}</b>
                      <span style={{ fontSize: 10.5, color: "var(--rc-text-3)" }}>{t("Lider sınıfa göre bayrak hesabı")}</span>
                    </span>
                  </button>
                </div>
              </div>
              {st.multiclass && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--rc-border)" }}>
                  <div style={{ flex: "1 1 170px", minWidth: 0 }}>
                    <label style={lbl}>{t("Lider sınıf")}</label>
                    <select value={st.leaderClass} onChange={(e) => up({ leaderClass: e.target.value })} style={{ width: "100%", boxSizing: "border-box", background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 10, color: "var(--rc-text)", padding: "11px 12px", fontSize: 13 }}>
                      {CAR_CLASSES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: "1 1 170px", minWidth: 0 }}>
                    <label style={lbl}>{t("Lider tur")} · m:ss.00</label>
                    <input type="text" value={st.leaderLap} placeholder={st.avgLap} onChange={(e) => up({ leaderLap: e.target.value })} style={{ width: "100%", boxSizing: "border-box", background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 10, color: "var(--rc-text)", padding: "11px 12px", fontFamily: "var(--rc-font-display)", fontSize: 17 }} />
                  </div>
                  {racePlan.flagExtra > 0.5 && <div style={{ flex: "1 1 100%", fontSize: 11.5, color: "var(--rc-warn)" }}><Icon name="bayrak" size={12} /> {t("Lider bayrağı")}: +{racePlan.flagExtra.toFixed(0)}s → {t("son tur otomatik eklenir")}</div>}
                </div>
              )}
            </div>

            {/* Strateji */}
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={hd}>{t("Strateji")}</span>
                <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{t("Stint uzunluğu · pit sayısı")}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
                {["A", "B", "C", "D"].map((k) => {
                  const on = st.chosen === k, laps = st.strategies[k] ?? 0;
                  const pits = laps > 0 && totLaps > 0 ? Math.max(0, Math.ceil(totLaps / laps) - 1) : 0;
                  return (
                    <div key={k} onClick={() => up({ chosen: k })} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", padding: "13px 14px", borderRadius: 11, cursor: "pointer", color: "var(--rc-text)", border: `1px solid ${on ? "var(--rc-brand-bright)" : "var(--rc-border)"}`, background: on ? "rgba(150,0,24,.22)" : "var(--rc-surface-2)" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{k}</b>
                        <span style={{ fontSize: 11.5, color: on ? "var(--rc-text)" : "var(--rc-text-3)" }}>{pits} pit</span>
                      </div>
                      <div style={{ fontFamily: "var(--rc-font-display)", fontSize: 15, marginTop: 8 }}>{fmtStint(laps)}</div>
                      {/* − + STINT BAŞINA TUR sayısını değiştirir (pit değil; pit türetilir) */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--rc-border)", borderRadius: 8, overflow: "hidden", background: "var(--rc-surface-3)" }}>
                          <button onClick={(e) => { e.stopPropagation(); up({ strategies: { ...st.strategies, [k]: Math.max(1, laps - 1) } }); }} style={{ width: 28, height: 28, border: "none", background: "transparent", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>−</button>
                          <b style={{ minWidth: 30, textAlign: "center", fontFamily: "var(--rc-font-display)", fontSize: 16 }}>{laps}</b>
                          <button onClick={(e) => { e.stopPropagation(); up({ strategies: { ...st.strategies, [k]: laps + 1 } }); }} style={{ width: 28, height: 28, border: "none", background: "transparent", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>+</button>
                        </span>
                        <span style={{ fontSize: 10, color: "var(--rc-text-3)", textTransform: "uppercase", letterSpacing: ".08em" }}>{t("tur")} / stint</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pit · süreler */}
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={hd}>{t("Pit · Süreler")}</span><span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{t("saniye")}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                  <label style={lbl}>Pit line</label>
                  {stepField(st.pitLaneTime, (v) => up({ pitLaneTime: v }), 1)}
                  {st.track && PIT_LANE_TIMES[st.track] != null && <div style={{ fontSize: 10.5, color: "var(--rc-text-3)", marginTop: 5 }}>{t("Pist verisi")}: {PIT_LANE_TIMES[st.track]}s · {trackName(st.track)}</div>}
                </div>
                <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                  <label style={{ ...lbl, display: "flex", alignItems: "center", gap: 4 }}><Icon name="yakit" size={13} /> {t("Yakıt")}{fv.hasVE && <> & <Bolt size={11} /> VE</>}</label>
                  {stepField(st.fuelTime, (v) => up({ fuelTime: v }), 1)}
                  <div style={{ fontSize: 10.5, color: "var(--rc-text-3)", marginTop: 5 }}>{t("Duraklamada geçen dolum süresi")}</div>
                </div>
                <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                  <label style={{ ...lbl, display: "flex", alignItems: "center", gap: 4 }}><Tyre size={12} /> {t("Lastik limiti · adet")}</label>
                  <span style={stepWrap}>
                    <button onClick={() => up({ tyreLimit: Math.max(0, (st.tyreLimit || 0) - 1) })} style={stepB}>−</button>
                    <b style={stepV}>{st.tyreLimit || 0}</b>
                    <button onClick={() => up({ tyreLimit: (st.tyreLimit || 0) + 1 })} style={stepB}>+</button>
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, padding: "11px 14px", borderRadius: 10, border: "1px solid var(--rc-border)", background: "var(--rc-surface-2)", flexWrap: "wrap" }}>
                <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{t("Toplam pit kaybı")}</span>
                <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 17 }}>{pitTotal} sn</b>
                <span style={{ color: "var(--rc-border-strong)" }}>·</span>
                <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{chosenPits} pit {t("ile yarış boyunca")}</span>
                <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 17, color: "var(--rc-warn)" }}>{pitRace}</b>
              </div>
            </div>

            {/* Yakıt · VE sınıflarında (Hypercar/GT3) Virtual Energy, diğerlerinde düz yakıt */}
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={hd}><Icon name={fv.hasVE ? "simsek" : "yakit"} size={14} /> {fv.hasVE ? "Virtual Energy" : t("Yakıt")}</span><span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{fv.hasVE ? t("Tüketim ve yakıt karşılığı") : t("Tüketim ve depo")}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                {fv.hasVE ? (<>
                  <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                    <label style={lbl}>{t("VE tüketim · %/tur")}</label>
                    {stepField(st.consumption, (v) => up({ consumption: v }), 0.1, 2)}
                  </div>
                  <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                    <label style={lbl}>Fuel ratio · L / %1</label>
                    {stepField(st.fuelRatio, (v) => up({ fuelRatio: v }), 0.01, 2)}
                  </div>
                </>) : (<>
                  <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                    <label style={lbl}>{t("Yakıt tüketim · L/tur")}</label>
                    {stepField(fuelPerLapL, setFuelPerLapL, 0.1, 2)}
                  </div>
                  <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                    <label style={lbl}>{t("Depo · L")}</label>
                    {stepField(fuelTankL, setFuelTankL, 1, 1)}
                  </div>
                </>)}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                <div style={statBox(true)}>
                  <div style={statV(true)}>{fuelCarried.toFixed(1)} L</div>
                  <div style={statL}>{fv.hasVE ? t("%100 = taşınan yakıt") : t("Depo (toplam)")}</div>
                </div>
                <div style={statBox(false)}>
                  <div style={statV(false)}>{range != null ? `${range} ${t("tur")}` : "—"}</div>
                  <div style={statL}>{t("Tam depo menzili")}</div>
                </div>
              </div>
            </div>
          </div>

          {/* ---- SAĞ KOLON ---- */}
          <div style={{ flex: "1 1 340px", minWidth: 260, display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Plan özeti */}
            <div style={{ border: "1px solid var(--rc-border-strong)", borderRadius: 12, background: "radial-gradient(120% 160% at 100% 0,rgba(150,0,24,.22),var(--rc-surface-2) 62%)", padding: "16px 18px" }}>
              <div style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 13, fontWeight: 700, color: "var(--rc-brand-bright)", marginBottom: 12 }}>{t("Plan özeti")}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{ flex: "0 0 auto", textAlign: "center" }}>
                  {st.track && <img src={`${ASSET}tracks/${TRACK_ASSET(st.track)}.png${AV}`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ display: "block", width: 104, height: 64, objectFit: "contain" }} />}
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--rc-text-2)", marginTop: 2 }}>{st.track && <img src={`${ASSET}flags/${TRACK_ASSET(st.track)}.png${AV}`} alt="" style={{ width: 15, borderRadius: 2 }} />}{trackName(st.track) || "—"}</span>
                </div>
                <span style={{ width: 1, alignSelf: "stretch", background: "var(--rc-border-strong)" }} />
                <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
                  {st.car && <img src={carImageSrc(teamData?.assets, clsD, st.car, "side")} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ display: "block", width: "100%", maxWidth: 170, height: 64, objectFit: "contain", margin: "0 auto" }} />}
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--rc-text-2)", marginTop: 2 }}>{st.car && <img src={`${ASSET}class/${clsD}.png${AV}`} alt="" style={{ height: 13 }} />}{st.car ? carName(clsD, st.car) : "—"}</span>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingTop: 12, borderTop: "1px solid var(--rc-border-strong)" }}>
                <div><div style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 24, lineHeight: 1 }}>{totLaps.toFixed(0)}</div><div style={statL}>{t("Toplam tur")}</div></div>
                <div><div style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 24, lineHeight: 1 }}>{st.chosen} · {chosenPits} pit</div><div style={statL}>{t("Seçili strateji")}</div></div>
                <div><div style={{ fontFamily: "var(--rc-font-display)", fontWeight: 600, fontSize: 19, lineHeight: 1.2 }}>{fmtStint(lapsPerStint)}</div><div style={statL}>{t("Stint uzunluğu")}</div></div>
                <div><div style={{ fontFamily: "var(--rc-font-display)", fontWeight: 600, fontSize: 19, lineHeight: 1.2 }}>{st.pitLaneTime} sn</div><div style={statL}>{t("Pit kaybı")}</div></div>
              </div>
            </div>

            {/* Yarış başlangıcı */}
            <div style={card}>
              <div style={{ ...hd, marginBottom: 14 }}>{t("Yarış başlangıcı")}</div>
              <label style={lbl}>{t("Start tarih & saat")}</label>
              <input type="datetime-local" value={msToLocalInput(st.raceStartMs)} onChange={(e) => { const v = new Date(e.target.value).getTime(); if (!isNaN(v)) up({ raceStartMs: v }); }} style={{ width: "100%", boxSizing: "border-box", background: "var(--rc-surface-3)", border: "1px solid var(--rc-border-strong)", borderRadius: 10, color: "var(--rc-text)", padding: "11px 13px", fontFamily: "var(--rc-font-display)", fontSize: 15 }} />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {[[t("Şimdi"), 0], ["+15 dk", 15], ["+1 sa", 60]].map(([lb, mins]) => (
                  <button key={lb} onClick={() => up({ raceStartMs: (mins === 0 ? Date.now() : (st.raceStartMs || Date.now())) + mins * 60000 })} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 11.5 }}>{lb}</button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(55,214,122,.35)", background: "rgba(55,214,122,.07)" }}>
                <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--rc-text-3)" }}>{t("Hesaplanan bitiş")}</span>
                <b style={{ marginLeft: "auto", fontFamily: "var(--rc-font-display)", fontSize: 22, color: "var(--rc-ok)" }}>{driverPlan ? fmtClock(driverPlan.finishMs, driverPlan.startMs) : "—"}</b>
              </div>
            </div>

            {/* Hava durumu */}
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={hd}>{t("Hava durumu")}</span>
                <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--rc-text-3)" }}>{t("Efektif tur")} ×{wxNow.lap.toFixed(2)}</span>
              </div>
              {wxSug && canEdit && (
                <button onClick={() => pickWx(wxSug.id)} title={`🌧 %${wxSug.rain} · 💧 %${wxSug.wetness}`}
                  style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", marginBottom: 10, padding: "8px 11px", borderRadius: 9, cursor: "pointer", fontSize: 11.5, border: `1px solid ${WEATHER[wxSug.id].col}`, background: "var(--rc-surface-2)", color: WEATHER[wxSug.id].col }}>
                  <WetIcon id={wxSug.id} size={15} /> {t("Canlı")}: <b>{t(wxSug.label)}</b> → {t("geçişi ekle")}</button>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 7 }}>
                {Object.entries(WEATHER).map(([id, w]) => {
                  const on = st.weather === id;
                  return (
                    <button key={id} onClick={() => pickWx(id)}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "9px 4px", borderRadius: 10, cursor: "pointer", textAlign: "center", color: on ? w.col : "var(--rc-text-2)", border: `1px solid ${on ? w.col : "var(--rc-border)"}`, background: on ? "rgba(255,255,255,.05)" : "var(--rc-surface-3)" }}>
                      <WetIcon id={id} size={22} />
                      <span style={{ fontSize: 11, marginTop: 4, lineHeight: 1.2 }}>{t(w.lbl)}</span>
                      <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 10, color: "var(--rc-text-3)", marginTop: 2 }}>×{w.lap.toFixed(2)}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--rc-border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{t("Planlı geçiş")}</span>
                {planList.map((e, i) => (
                  <span key={`${e.t}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 99, border: `1px solid ${(WEATHER[e.w] || WEATHER.dry).col}`, color: (WEATHER[e.w] || WEATHER.dry).col, fontSize: 11.5 }}>{fmtHMS(e.t)} · {t((WEATHER[e.w] || WEATHER.dry).lbl)}</span>
                ))}
                <button onClick={() => setWxModal(true)} style={{ padding: "5px 11px", borderRadius: 8, border: "1px dashed var(--rc-border-strong)", background: "transparent", color: "var(--rc-text-3)", cursor: "pointer", fontSize: 11.5 }}>＋ {t("Geçiş ekle")}</button>
              </div>
            </div>

            {/* Canlı yayın */}
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={hd}><Icon name="goz" size={14} /> {t("Canlı yayın")}</span>
                {ytId(st.streamUrl) && <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".09em", padding: "3px 10px", borderRadius: 99, border: "1px solid var(--rc-ok)", color: "var(--rc-ok)" }}>{t("bağlı")}</span>}
              </div>
              <label style={lbl}>{t("YouTube linki")}</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="text" value={st.streamUrl} placeholder="https://youtube.com/watch?v=…" onChange={(e) => up({ streamUrl: e.target.value })} style={{ flex: 1, minWidth: 0, background: "var(--rc-surface-3)", border: "1px solid var(--rc-border-strong)", borderRadius: 10, color: "var(--rc-text)", padding: "11px 13px", fontSize: 12.5, fontFamily: "var(--rc-font-display)" }} />
                <button onClick={() => up({ streamUrl: "" })} style={{ padding: "0 14px", borderRadius: 10, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-3)", cursor: "pointer", fontSize: 13 }}>{t("Temizle")}</button>
              </div>
              {ytId(st.streamUrl) ? (
                <div style={{ position: "relative", marginTop: 12, height: 112, borderRadius: 10, border: "1px solid var(--rc-border)", background: "var(--rc-surface-2)", overflow: "hidden" }}>
                  <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--rc-border-strong)", fontSize: 26 }}><Icon name="oynat" size={26} /></span>
                  <span style={{ position: "absolute", left: 9, bottom: 8, fontSize: 10.5, color: "var(--rc-text-2)", background: "rgba(11,7,8,.75)", padding: "3px 8px", borderRadius: 6 }}>{t("Köşedeki mini oynatıcıda gösteriliyor")}</span>
                </div>
              ) : (
                <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--rc-text-3)", lineHeight: 1.5 }}>{t("Geçerli bir YouTube linki yapıştır; köşede mini oynatıcı açılır.")}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  })();

  /* ================= v2.0 KABUK — paylaşılan sol dikey ray =================
     Hem ana menüde hem yarış ekranlarında görünür (handoff-spec/ekranlar/00-kabuk.md:
     "her ekranda görünen sabit çerçeve"). Stil objeleri fişten birebir; hex → var(--rc-*). */
  const toggleRail = () => setRail((r) => !r);
  const shell = {
    minHeight: "100vh", background: "var(--rc-bg)", color: "var(--rc-text)",
    fontFamily: "var(--rc-font-ui)", fontSize: 13, display: "grid",
    gridTemplateColumns: rail ? "76px 1fr" : "0px 1fr",
    transition: "grid-template-columns .32s cubic-bezier(.4,0,.2,1)",
  };
  const navShell = {
    borderRight: "1px solid var(--rc-border)", background: "#100A0C", display: "flex",
    flexDirection: "column", alignItems: "center", gap: 4, padding: "12px 0",
    position: "sticky", top: 0, height: "100vh", width: 76, overflow: "hidden",
    transform: rail ? "translateX(0)" : "translateX(-100%)", opacity: rail ? 1 : 0,
    pointerEvents: rail ? "auto" : "none",
    transition: "transform .32s cubic-bezier(.4,0,.2,1), opacity .24s ease",
  };
  const railToggle = {
    width: 26, height: 26, borderRadius: 8, marginBottom: 6, cursor: "pointer",
    border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-3)",
    fontSize: 12, alignSelf: "flex-end", marginRight: 10, lineHeight: 1,
  };
  const railOpenBtn = {
    position: "fixed", left: 14, top: 14, zIndex: 90, width: 38, height: 38,
    borderRadius: 10, cursor: "pointer", border: "1px solid var(--rc-border-strong)",
    background: "rgba(21,14,16,.92)", backdropFilter: "blur(6px)", color: "var(--rc-text)",
    fontSize: 15, boxShadow: "0 6px 20px rgba(0,0,0,.45)",
    transform: rail ? "translateX(-140%)" : "translateX(0)", opacity: rail ? 0 : 1,
    pointerEvents: rail ? "none" : "auto",
    transition: "transform .32s cubic-bezier(.4,0,.2,1), opacity .2s ease",
  };
  /* navStyle fişte tanımsız; kabul kriteri: aktif = marka kenarlık + --rc-surface-2. */
  const navBtn = (active) => ({
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 4, width: 60, padding: "8px 0", borderRadius: 12, cursor: "pointer",
    color: active ? "var(--rc-text)" : "var(--rc-text-3)",
    border: active ? "1px solid var(--rc-brand)" : "1px solid transparent",
    background: active ? "var(--rc-surface-2)" : "transparent",
  });
  const railLabel = {
    fontSize: 9.5, letterSpacing: ".04em", textTransform: "uppercase",
    fontFamily: "var(--rc-font-display)", fontWeight: 600,
  };
  const railSep = { width: 40, height: 1, background: "var(--rc-border)" };
  /* activeKey: "menu" (ana menü) ya da aktif sekme; onTab: sekmeye tıklayınca. */
  const renderRail = (activeKey, onTab) => (
    <>
      <button onClick={toggleRail} title={t("Menüyü aç")} style={railOpenBtn}><Icon name="menu" size={18} /></button>
      <nav style={navShell} data-tour="tabs">
        <button onClick={toggleRail} title={t("Menüyü gizle")} style={railToggle}>‹</button>
        <button onClick={leaveRace} style={navBtn(activeKey === "menu")}>
          <img src={`${ASSET}logo.png`} alt="Caspian" style={{ width: 40, height: "auto" }} />
          <span style={railLabel}>{t("Menü")}</span>
        </button>
        <span style={{ ...railSep, margin: "6px 0 8px" }} />
        <button onClick={() => setTeamOpen(true)} data-tour="nav-team" style={navBtn(teamOpen)}>
          <Icon name="takim" size={20} />
          <span style={railLabel}>{t("Takım")}</span>
        </button>
        {[
          ["dash", t("Dash"), <Icon key="i" name="gosterge" size={20} />],
          ["stint", t("Stint"), <Icon key="i" name="stint" size={20} />],
          ["fuel", t("Yakıt"), <Icon key="i" name="yakit" size={20} />],
          ["live", t("Canlı"), <Icon key="i" name="canli" size={20} />],
          ["tyre", t("Lastik"), <Icon key="i" name="lastik" size={20} />],
          ["drivers", t("Pilot"), <Icon key="i" name="kask" size={20} />],
          ["tele", t("Tele"), <Icon key="i" name="telemetri" size={20} />],
          ["setup", t("Setup"), <Icon key="i" name="setup" size={20} />],
        ].map(([k, lbl, ico]) => (
          <button key={k} id={`tab-${k}`} data-tour={`nav-${k}`} onClick={() => onTab(k)} style={navBtn(activeKey === k)}>
            {ico}<span style={railLabel}>{lbl}</span>
          </button>
        ))}
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "100%" }}>
          <span style={railSep} />
          <button onClick={() => setChatOpen(true)} style={navBtn(false)} title={t("Yarış sohbeti")} data-tour="hchat">
            <span style={{ position: "relative", display: "inline-flex" }}>
              <Icon name="sohbet" size={20} />
              {chatUnread > 0 && (
                <b style={{ position: "absolute", top: -5, right: -8, background: "var(--rc-brand-deep)", color: "#fff", borderRadius: 9, fontSize: 9, padding: "0 5px", fontFamily: "var(--rc-font-ui)", lineHeight: 1.5 }}>
                  {chatUnread > 99 ? "99+" : chatUnread}</b>
              )}
            </span>
            <span style={railLabel}>{t("Sohbet")}</span>
          </button>
          <span style={{ fontSize: 9.5, color: "var(--rc-text-3)", fontFamily: "var(--rc-font-display)" }}>{APP_VERSION}</span>
        </div>
      </nav>
    </>
  );

  /* ---------- dil kapısı: EN sözlüğü (lazy) inene dek dile NÖTR splash ----------
     lang="en" iken sözlük hazır olmadan lobiyi t() ile basmak "EN seçili ama
     Türkçe görünüyor" parlamasına yol açıyordu. Sözlük gelene dek çevrilebilir
     metin İÇERMEYEN bir yükleme ekranı göster (yalnız logo + spinner). TR/EN
     düğmesi kaçış yolu: TR sözlük gerektirmez → anında geçer. */
  if (lang === "en" && !langReady) {
    return (
      <div className="rc">
        <div style={{ position: "fixed", inset: 0, zIndex: 2000,
          display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: "var(--rc-bg)",
          backgroundImage: "radial-gradient(120% 95% at 50% -12%,rgba(150,0,24,.24),rgba(11,7,8,0) 62%)",
          fontFamily: "var(--rc-font-ui)", color: "var(--rc-text)", animation: "rcfade .22s ease" }}>
          <span style={{ position: "absolute", top: 22, right: 26 }}>
            <div className="langsw">
              {["tr", "en"].map((l) => (
                <button key={l} className={lang === l ? "on" : ""}
                  onClick={() => switchLang(l)}>{l.toUpperCase()}</button>
              ))}
            </div>
          </span>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            <img src={`${ASSET}logo.png`} alt="Caspian Motorsport"
              style={{ height: 40, opacity: .92 }}
              onError={(e) => { e.currentTarget.style.display = "none"; }} />
            <i style={{ width: 22, height: 22, borderRadius: "50%",
              border: "2px solid var(--rc-border-strong)", borderTopColor: "var(--rc-brand-bright)",
              animation: "rcspin .7s linear infinite" }} />
          </div>
        </div>
      </div>
    );
  }

  /* ---------- giriş kapısı: oturum yoksa uygulama açılmaz ----------
     langReady artık yukarıdaki dil kapısında garanti — buraya gelindiğinde EN
     sözlüğü hazır (ya da dil TR). */
  if (authReady && (authLoading || !langReady || !user)) {
    /* v2.0 giriş ekranı (handoff-spec/ekranlar/15-giris.md + yama-v2.0.2).
       busy: ilk auth/dict yüklemesi VEYA düğmeye basılınca — tek yükleniyor
       göstergesi (dönen spinner + "Bağlanılıyor…"). Prototipteki setTimeout
       yerine gerçek Firebase akışı: doSignIn → signInGoogle. */
    const busy = signingIn || authLoading || !langReady;
    const googleBtn = {
      display: "flex", alignItems: "center", justifyContent: "center", gap: 11,
      width: "100%", padding: "13px 16px", borderRadius: 11, border: "1px solid #E6DDE0",
      background: busy ? "#E3D9DC" : "#F5F1F2", color: "#160D10",
      cursor: busy ? "progress" : "pointer", fontFamily: "var(--rc-font-ui)",
    };
    /* İkincil kutu: erişimi olmayan yeni kullanıcı için "Google ile başvur"
       (aynı Google girişi; sonrasında erişim kapısında talep formuna düşer). */
    const applyBtn = {
      display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      width: "100%", padding: "12px 16px", borderRadius: 11,
      border: "1px solid var(--rc-border-strong)", background: "var(--rc-surface-3)",
      color: "var(--rc-text)", cursor: busy ? "progress" : "pointer",
      fontFamily: "var(--rc-font-ui)",
    };
    const gMark = (
      <svg width="17" height="17" viewBox="0 0 48 48" style={{ flex: "0 0 auto" }} aria-hidden="true">
        <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.8-2 5.1-4.4 6.7v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.4Z" />
        <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.7C7.9 41 15.3 46 24 46Z" />
        <path fill="#FBBC05" d="M11.6 28.1c-.4-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1V14H4.3A22 22 0 0 0 2 24c0 3.6.9 6.9 2.3 9.8l7.3-5.7Z" />
        <path fill="#EA4335" d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.3 30 2 24 2 15.3 2 7.9 7 4.3 14.2l7.3 5.7c1.7-5.2 6.6-9.1 12.4-9.1Z" />
      </svg>
    );
    return (
      <div className="rc">
        {updateModal}
        {teamModal}{createJoinModal}{raceForm}
        <div style={{ position: "fixed", inset: 0, zIndex: 2000, overflow: "auto",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 28px",
          backgroundColor: "var(--rc-bg)",
          backgroundImage: "radial-gradient(120% 95% at 50% -12%,rgba(150,0,24,.24),rgba(11,7,8,0) 62%)",
          fontFamily: "var(--rc-font-ui)", color: "var(--rc-text)", animation: "rcfade .22s ease" }}>

          <span style={{ position: "absolute", top: 22, right: 26 }}>
            <div className="langsw">
              {["tr", "en"].map((l) => (
                <button key={l} className={lang === l ? "on" : ""}
                  onClick={() => switchLang(l)}>{l.toUpperCase()}</button>
              ))}
            </div>
          </span>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center",
            justifyContent: "center", gap: 56, maxWidth: 960, width: "100%" }}>

            <div style={{ flex: "1 1 380px", minWidth: 280, display: "flex",
              flexDirection: "column", gap: 18 }}>
              <img src={`${ASSET}logo.png`} alt="Caspian Motorsport"
                style={{ width: 112, height: "auto", objectFit: "contain" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <h1 style={{ margin: 0, fontFamily: "var(--rc-font-display)", fontWeight: 700,
                  fontSize: "clamp(38px,5vw,54px)", lineHeight: ".98", letterSpacing: ".02em",
                  textTransform: "uppercase" }}>
                  <span style={{ color: "var(--rc-brand-bright)" }}>Race</span> Monitor</h1>
                <p style={{ margin: 0, maxWidth: "34ch", fontSize: 14, lineHeight: 1.65,
                  color: "var(--rc-text-2)", textWrap: "pretty" }}>
                  {t("Caspian Motorsport pit wall aracı. Canlı zamanlama, stint planı, yakıt hesabı ve telemetri tek ekranda.")}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 2 }}>
                {[
                  "Yarış boyunca takımla ortak ekran",
                  "Le Mans Ultimate köprüsüyle canlı veri",
                  "Setup havuzu ve stint geçmişi",
                ].map((x) => (
                  <span key={x} style={{ display: "flex", alignItems: "center", gap: 10,
                    fontSize: 12.5, color: "var(--rc-text-3)" }}>
                    <i style={{ width: 4, height: 14, borderRadius: 2, background: "var(--rc-brand)",
                      flex: "0 0 auto" }} />{t(x)}</span>
                ))}
              </div>
            </div>

            <div style={{ flex: "0 1 372px", minWidth: 288, border: "1px solid var(--rc-border-strong)",
              borderRadius: 16, background: "var(--rc-surface)", boxShadow: "var(--rc-shadow-card)",
              overflow: "hidden" }}>
              <div style={{ padding: "26px 26px 22px", display: "flex", flexDirection: "column", gap: 18 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <h2 style={{ margin: 0, fontFamily: "var(--rc-font-display)", fontWeight: 700,
                    fontSize: 22, letterSpacing: ".06em", textTransform: "uppercase" }}>
                    {t("Giriş yap")}</h2>
                  <span style={{ fontSize: 12.5, color: "var(--rc-text-3)", lineHeight: 1.6 }}>
                    {t("Google hesabınla devam et. Hesabın yoksa ilk girişte oluşturulur.")}</span>
                </div>

                <button onClick={() => doSignIn("in")} disabled={busy} style={googleBtn}>
                  {!(busy && authMode !== "apply") && (
                    <svg width="18" height="18" viewBox="0 0 48 48" style={{ flex: "0 0 auto" }} aria-hidden="true">
                      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.8-2 5.1-4.4 6.7v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.4Z"/>
                      <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.7C7.9 41 15.3 46 24 46Z"/>
                      <path fill="#FBBC05" d="M11.6 28.1c-.4-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1V14H4.3A22 22 0 0 0 2 24c0 3.6.9 6.9 2.3 9.8l7.3-5.7Z"/>
                      <path fill="#EA4335" d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.3 30 2 24 2 15.3 2 7.9 7 4.3 14.2l7.3 5.7c1.7-5.2 6.6-9.1 12.4-9.1Z"/>
                    </svg>
                  )}
                  {busy && authMode !== "apply" && (
                    <i style={{ width: 16, height: 16, borderRadius: "50%",
                      border: "2px solid rgba(22,13,16,.25)", borderTopColor: "#960018",
                      animation: "rcspin .7s linear infinite", flex: "0 0 auto" }} />
                  )}
                  <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700,
                    fontSize: 15, letterSpacing: ".06em", textTransform: "uppercase" }}>
                    {busy && authMode !== "apply" ? t("Bağlanılıyor…") : t("Google ile devam et")}</span>
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--rc-text-4)", fontSize: 11 }}>
                  <span style={{ flex: 1, height: 1, background: "var(--rc-line-soft)" }} />
                  {t("veya")}
                  <span style={{ flex: 1, height: 1, background: "var(--rc-line-soft)" }} />
                </div>

                <div>
                  <button onClick={() => doSignIn("apply")} disabled={busy} style={applyBtn}>
                    {busy && authMode === "apply"
                      ? <i style={{ width: 15, height: 15, borderRadius: "50%", border: "2px solid var(--rc-border-strong)", borderTopColor: "var(--rc-brand-bright)", animation: "rcspin .7s linear infinite", flex: "0 0 auto" }} />
                      : gMark}
                    <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700,
                      fontSize: 14, letterSpacing: ".05em", textTransform: "uppercase" }}>
                      {busy && authMode === "apply" ? t("Bağlanılıyor…") : t("Google ile başvur")}</span>
                  </button>
                  <span style={{ display: "block", marginTop: 7, fontSize: 11, color: "var(--rc-text-3)", lineHeight: 1.55 }}>
                    {t("Erişimin yoksa başvur — yönetici onaylayınca giriş açılır.")}</span>
                </div>

                {authErr && (
                  <div style={{ fontSize: 12, color: "var(--rc-danger)", lineHeight: 1.55,
                    border: "1px solid var(--rc-border-strong)", borderRadius: 8, padding: "8px 11px" }}>
                    {authErr}</div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 2,
                  borderTop: "1px solid var(--rc-line-soft)" }}>
                  {[
                    ["1", "Girişten sonra takım kurabilir ya da davet koduyla katılabilirsin."],
                    ["2", "Yarış verisi için masaüstü köprüsünü kurman gerekir."],
                  ].map(([n, x], i) => (
                    <span key={n} style={{ display: "flex", gap: 9, fontSize: 11.5,
                      color: "var(--rc-text-3)", lineHeight: 1.6, paddingTop: i === 0 ? 14 : 0 }}>
                      <b style={{ color: "var(--rc-text-2)", fontFamily: "var(--rc-font-display)",
                        fontSize: 13, flex: "0 0 auto" }}>{n}</b>{t(x)}</span>
                  ))}
                </div>
              </div>
              <div style={{ padding: "13px 26px", borderTop: "1px solid var(--rc-border)",
                background: "#0F090B", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10.5, color: "var(--rc-text-4)", lineHeight: 1.5 }}>
                  {t("Devam ederek")} <a href="#" style={{ color: "var(--rc-brand-bright)" }}>{t("kullanım koşullarını")}</a> {t("kabul edersin.")}</span>
                <span style={{ marginLeft: "auto", fontFamily: "var(--rc-font-display)",
                  fontSize: 11, color: "var(--rc-text-3)", letterSpacing: ".04em" }}>{APP_VERSION}</span>
              </div>
            </div>

          </div>

          <span style={{ position: "absolute", bottom: 20, left: 0, right: 0, textAlign: "center",
            fontSize: 10.5, color: "var(--rc-text-5)" }}>
            {t("Caspian Motorsport · pit wall aracı — resmi olmayan topluluk projesi")}</span>
        </div>
      </div>
    );
  }

  /* ---------- erişim kapısı: giriş var ama izin yok ---------- */
  if (authReady && user && !access) {
    return (
      <div className="rc">
        {updateModal}
        {teamModal}{createJoinModal}{raceForm}
        <div className="lobby">
          <div className="box" style={{ textAlign: "center" }}>
            <img className="logo" src={`${ASSET}logo.png`} alt="Caspian Motorsport" />
            <h1><b>RACE</b> MONITOR</h1>
            {udoc === null ? (
              <div className="hint" style={{ marginTop: 22 }}>{t("Yükleniyor…")}</div>
            ) : !udoc.requested ? (<>
              {/* henüz kayıt talebi göndermemiş */}
              <div style={{ fontSize: 34, margin: "14px 0 6px" }}><Icon name="duzenle" size={30} /></div>
              <div className="disp" style={{ fontSize: 18, marginBottom: 8 }}>
                {t("Kayıt talebi gönder")}</div>
              <div className="hint" style={{ marginBottom: 12 }}>
                {t("Talebiniz yöneticiye iletilecek. Onaylandığında e-posta ile bilgilendirileceksiniz.")}
              </div>
              <div className="userchip" style={{ margin: "0 auto 12px", display: "inline-flex" }}>
                {user.photoURL && <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />}
                <span className="uname" style={{ maxWidth: 230 }}>{user.email}</span>
              </div>
              <input type="text" placeholder={t("Ad Soyad")}
                value={regName} onChange={(e) => setRegName(e.target.value)}
                style={{ marginBottom: 8, textTransform: "none" }} />
              <input type="text" placeholder={t("Takım / not (opsiyonel)")}
                value={regNote} onChange={(e) => setRegNote(e.target.value)}
                style={{ marginBottom: 12, textTransform: "none" }} />
              <button className="gbtn" style={{ background: "var(--car)", color: "#fff",
                  opacity: regName.trim() ? 1 : .45 }}
                disabled={!regName.trim()}
                onClick={() => requestAccess(user, regNote, regName.trim()).catch(() => {})}>
                {t("Talebi Gönder")}</button>
              <div style={{ marginTop: 12 }}>
                <button className="histbtn" onClick={signOut}>{t("Çıkış yap")}</button>
              </div>
            </>) : (<>
              <div style={{ fontSize: 34, margin: "14px 0 6px" }}><Icon name="kilit" size={30} /></div>
              <div className="disp" style={{ fontSize: 18, marginBottom: 8 }}>
                {t("Erişim izni bekleniyor")}</div>
              <div className="hint" style={{ marginBottom: 16 }}>
                {t("Talebiniz alındı. Onaylandığında e-posta ile bilgilendirileceksiniz.")}
              </div>
              <div className="userchip" style={{ margin: "0 auto 10px", display: "inline-flex" }}>
                {user.photoURL && <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />}
                <span className="uname" style={{ maxWidth: 230 }}>{user.email}</span>
              </div>
              <div className="hint mono" style={{ fontSize: 10, wordBreak: "break-all",
                marginBottom: 14 }}>
                UID: {user.uid}
              </div>
              <div>
                <button className="histbtn" onClick={signOut}>{t("Çıkış yap")}</button>
              </div>
            </>)}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- bağımsız Telemetri ekranı (Ana Menü → Telemetri) ----------
     Race Solo yolundan (entered/pick/setup/race shell) TAMAMEN ayrı üst-düzey görünüm;
     kendi (ikinci) useTelemetry örneğiyle beslenir. Çıkış (🏠 Ana Menü) yalnız teleOnly'yi
     kapatır → lobiye döner; entered/curRace'e dokunmaz. */
  if (teleOnly) {
    return (
      <TelemetryStandalone t={t} lang={lang} switchLang={switchLang} st={teleSt} up={() => {}}
        onSaveDuckSetup={user ? saveTeleSetup : null}
        onExit={() => setTeleOnly(false)} {...teleHook} />
    );
  }

  /* ---------- bağımsız Resmi Yarışlar ekranı (Ana Menü → Resmi Yarışlar) ----------
     Race Solo yolundan TAMAMEN ayrı üst-düzey görünüm; yarış seçmeye/oda-solo açmaya
     gerek yok. Çıkış (🏠 Ana Menü) yalnız scheduleOnly'yi kapatır; entered/curRace'e
     dokunmaz. curRace/entered'den ÖNCE gelir → yarış açıkken bile bağımsız açılır. */
  /* ---------- Takım tam ekranı (rail TAKIM) — modal değil, kabuk içinde ---------- */
  if (teamOpen) {
    return (
      <div className="rc">
        {createJoinModal}{raceForm}{versionModal}{chatModal}
        <div style={shell}>
          {renderRail("menu", (k) => { setTeamOpen(false); setScheduleOnly(false); setTab(k); if (curRace) openRace(curRace); })}
          <div style={{ minWidth: 0 }}>
            <TeamScreen user={user} t={t} lang={lang}
              myTeams={myTeams} curTeam={curTeam} setCurTeam={setCurTeam} teamData={teamData}
              tnEdit={tnEdit} setTnEdit={setTnEdit} canManageTeam={canManageTeam} canEditTeam={canEditTeam}
              curSeason={curSeason} setCurSeason={setCurSeason} seasons={seasons} races={races} st={st}
              myRole={myRole} openRace={(rid) => { setTeamOpen(false); openRace(rid, "stint"); }}
              setRForm={setRForm} setBadge={setBadge} roleLabel={roleLabel}
              onCreateJoin={() => { setTeamOpen(false); setCreateJoinOpen(true); }}
              onExit={() => setTeamOpen(false)} />
          </div>
        </div>
      </div>
    );
  }

  if (scheduleOnly) {
    return (
      <div className="rc">
        {teamModal}{createJoinModal}{raceForm}{versionModal}{chatModal}
        <div style={shell}>
          {renderRail("menu", (k) => { setScheduleOnly(false); setTab(k); if (curRace) openRace(curRace); })}
          <div style={{ minWidth: 0 }}>
            <ScheduleStandalone t={t} lang={lang} switchLang={switchLang}
              races={lmu.races} updatedAt={lmu.updatedAt}
              loading={lmu.loading} onExit={() => setScheduleOnly(false)}
              onPlan={curTeam ? planOfficialRace : undefined} embedded />
          </div>
        </div>
      </div>
    );
  }

  /* ---------- lobi: takım takvimi ---------- */
  if (!curRace && !entered) {
    const now = Date.now();
    const list = Object.entries(races)
      .sort(([, a], [, b]) => (a.startsAt || 0) - (b.startsAt || 0));
    /* Geçmiş eşiği yarışın SÜRESİNE göre (isRacePast): planlı bitiş + 30 dk. Eski sabit
       6h-başlangıçtan kuralı, 4h yarışı bitince 2h daha "Sonraki"de tutuyor, 24h yarışı ise
       sürerken Geçmiş'e düşürüyordu. */
    /* Üç bölüm: Aktif (başladı, planlı bitiş + 30 dk geçmedi) · Yaklaşan (henüz
       başlamadı) · Geçmiş (bitiş + 30 dk geçti = isRacePast). */
    const allActive = list.filter(([, r]) => (r.startsAt || 0) <= now && !isRacePast(r, now));
    const allUp = list.filter(([, r]) => (r.startsAt || 0) > now);
    const allPast = list.filter(([, r]) => isRacePast(r, now)).reverse();
    /* Şampiyonalar karışmasın: sezona göre grupla, istenirse süz. */
    const sidOf = ([, r]) => r.seasonId || "";
    const sName = (sid) => (sid ? (seasons[sid]?.name || t("Sezon")) : t("Takvim dışı"));
    const seasonIds = Array.from(new Set(list.map(sidOf)));      // takvim sırasına göre
    const inFilter = (e) => lobSeason === "all" || sidOf(e) === lobSeason;
    const upF = allUp.filter(inFilter);
    const nextEntry = upF.length ? upF[0] : null;   // §1 sıradaki yarış (hero)
    const q = lobQuery.trim().toLowerCase();
    const matchQ = ([, r]) => !q
      || (r.name || "").toLowerCase().includes(q)
      || trackName(r.trackId).toLowerCase().includes(q);
    const activeF = allActive.filter(inFilter).filter(matchQ); // aktif (başlamış) yarışlar
    const pastAll = allPast.filter(inFilter).filter(matchQ);   // §1.3 ara + süz
    const pastShown = pastAll.slice(0, pastLimit);             // §1.3 sayfalama
    /* Ana menüden yarış sil (owner/editor). Kart butonunun KARDEŞİ olan ayrı bir
       düğme çağırır (iç içe <button> olmasın) → onaydan sonra deleteRace. Firebase
       kuralı da write'ı owner/editor'e sınırlar (ikinci savunma). */
    const askDeleteRace = async (rid, r) => {
      if (!curTeam || !rid) return;
      const label = r?.name || trackName(r?.trackId) || "—";
      if (await confirmDialog({ title: t("Yarışı sil"), message: `${t("Bu yarışı silmek istediğinize emin misiniz?")}\n\n${label}`, confirmText: t("Sil"), danger: true }))
        deleteRace(curTeam, rid).catch(() => setSyncMsg(t("Yarış silinemedi.")));
    };


    return (
      <div className="rc">
        {updateModal}
        {teamModal}{createJoinModal}{raceForm}{versionModal}{chatModal}{tourOverlay}{setupModal}{setupContentModal}{setupCompareModal}{cmpBar}{cmdPalette}{adminModal}{profileModal}
        {(() => {
          /* ================= v2.0 ANA MENÜ (handoff-spec/ekranlar/01-menu.md) =================
             Tam sayfa menü; eski ortalanmış .lobby kutusunun yerine. Tüm handler'lar mevcut
             lobiden yeniden kullanıldı. Genel kontroller (dil/hesap/çıkış/üyeler/info) buraya
             taşındı — yarış üst çubuğundan kaldırılanların v2.0'daki kalıcı evi. */
          const teamName = teamData?.meta?.name || (curTeam && myTeams[curTeam]) || "Caspian Motorsport";
          /* mevcut takımın ÖZEL logosu (yüklenmişse) — yoksa Caspian varsayılanı.
             Üst çubuktaki takım çipi bunu gösterir (v2.2 düzeltmesi). */
          const teamLogo = teamLogoSrc(teamData?.assets) || `${ASSET}logo.png`;
          const roleLabel = (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              {myRole === "owner" ? <><RoleIcon name="owner" size={11} /> {t("Sahip")}</>
                : myRole === "editor" ? <><RoleIcon name="eng" size={11} /> {t("Mühendis")}</>
                : myRole === "viewer" ? <><Icon name="goz" size={11} /> {t("İzleyici")}</> : <>🙋 {t("Üye")}</>}
            </span>);
          const acctInitials = (userName || user?.email || "?").trim().slice(0, 2).toUpperCase();
          const activeCount = activeF.length;
          const upCount = upF.length;
          const pastCount = pastAll.length;
          const calList = menuCal === "active" ? activeF : menuCal === "up" ? upF : pastShown;
          const calEmpty = calList.length === 0;
          /* Varsayılan yarış: kullanıcı yarış seçmeden Dash/Stint/Yakıt/Canlı'ya
             tıklarsa kronolojik olarak AKTİF olan (en son başlamış) yarış; aktif
             yoksa en yakın YAKLAŞAN; o da yoksa en son GEÇMİŞ yarış otomatik açılır. */
          const defaultPick = allActive.length ? allActive[allActive.length - 1]
            : allUp.length ? allUp[0]
            : allPast.length ? allPast[0] : null;
          const defaultRid = defaultPick ? defaultPick[0] : null;
          const editRace = (rid, r) => setRForm({ rid, flow: "data", seasonId: r.seasonId || "", round: r.round || "",
            name: r.name || "", trackId: r.trackId || "", carClass: r.carClass || "", carId: r.carId || "",
            raceTime: r.raceTime || "", startsAt: r.startsAt || 0 });
          /* + Yarış ekle → Yarış Ekle penceresi; flow:"data" → "İlerle →" butonu:
             önce takım takvimine kaydeder (createRace), sonra DATA ekranında açar
             → kullanıcı stint/yakıt verisini girer. Solo mod yok. */
          const newRace = () => setRForm({ flow: "data",
            seasonId: lobSeason !== "all" ? lobSeason : "",
            round: "", name: "", trackId: st.track || "", carClass: st.carClass || "hypercar",
            carId: st.car || "", raceTime: st.raceTime || "6:00:00", startsAt: Date.now() });
          const langBtn = (on) => ({
            padding: "6px 12px", border: "none", cursor: "pointer", fontSize: 12,
            fontFamily: "var(--rc-font-display)", fontWeight: 600, letterSpacing: ".04em",
            background: on ? "var(--rc-brand)" : "transparent", color: on ? "var(--rc-on-brand)" : "var(--rc-text-3)",
          });
          const chip = (on) => ({
            padding: "7px 14px", borderRadius: 99, cursor: "pointer", fontSize: 12.5,
            border: `1px solid ${on ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
            background: on ? "rgba(150,0,24,.22)" : "var(--rc-surface-3)", color: on ? "var(--rc-text)" : "var(--rc-text-2)",
            transition: "background .18s ease, border-color .18s ease, color .18s ease",
          });
          const qaBtn = {
            display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4,
            background: "var(--rc-surface-2)", border: "1px solid var(--rc-border)", borderRadius: 12,
            padding: 14, cursor: "pointer", color: "var(--rc-text)", textAlign: "left",
          };
          return (
        <div style={shell}>
          {renderRail("menu", (k) => { setTab(k); if (curRace) openRace(curRace); else if (defaultRid) openRace(defaultRid); })}
          <div style={{ minWidth: 0 }}>
        <div style={{ padding: "22px 24px 40px", fontFamily: "var(--rc-font-ui)" }}>

          {/* ---- üst çubuk: takım + genel kontroller ---- */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--rc-surface-2)",
              border: "1px solid var(--rc-border-strong)", borderRadius: 99, padding: "5px 16px 5px 6px" }}>
              <img src={teamLogo} alt="" style={{ width: 28, height: 28, objectFit: "contain", borderRadius: 6 }}
                onError={(e) => { if (!e.currentTarget.dataset.fb) { e.currentTarget.dataset.fb = "1"; e.currentTarget.src = `${ASSET}logo.png`; } }} />
              <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 15 }}>{teamName}</span>
            </span>
            {Object.entries(myTeams).filter(([tid]) => tid !== curTeam).slice(0, 3).map(([tid, nm]) => (
              <button key={tid} onClick={() => setCurTeam(tid)}
                style={{ padding: "7px 14px", borderRadius: 99, border: "1px solid var(--rc-border)",
                  background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 12.5 }}>{nm}</button>
            ))}
            <button onClick={() => setCreateJoinOpen(true)}
              style={{ padding: "7px 14px", borderRadius: 99, border: "1px dashed var(--rc-border-strong)",
                background: "transparent", color: "var(--rc-text-3)", cursor: "pointer", fontSize: 12.5 }}>＋ {t("Kur & Katıl")}</button>

            <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", border: "1px solid var(--rc-border)", borderRadius: 8, overflow: "hidden" }}>
                <button onClick={() => switchLang("tr")} style={langBtn(lang !== "en")}>TR</button>
                <button onClick={() => switchLang("en")} style={langBtn(lang === "en")}>EN</button>
              </span>
              <button onClick={() => { setCoachStart(0); setCoachOpen(true); }}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8,
                  border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 12 }}><Icon name="rehber" size={14} /> {t("Rehber")}</button>
              <button onClick={() => setCmdOpen(true)} title={t("Komut paleti · ⌘K")}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 8,
                  border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-3)", cursor: "pointer", fontSize: 12 }}><Icon name="ara" size={14} /> {t("Ara")}
                <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 10, border: "1px solid var(--rc-border)", borderRadius: 5, padding: "1px 5px" }}>⌘K</b></button>
              {isAdmin && (
                <button onClick={() => setAdminOpen(true)} title={t("Kullanıcı yönetimi")}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8,
                    border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 12 }}><Icon name="kalkan" size={14} /> {t("Üyeler")}
                  {Object.values(allUsers).filter((u) => u?.requested && u?.allowed !== true).length > 0 &&
                    <b style={{ background: "var(--rc-brand-deep)", color: "#fff", borderRadius: 99, fontSize: 9.5, padding: "0 5px" }}>
                      {Object.values(allUsers).filter((u) => u?.requested && u?.allowed !== true).length}</b>}
                </button>
              )}
              <span style={{ position: "relative" }}>
                <button onClick={() => { setMenuInfo((v) => !v); setMenuAcct(false); }} title={t("Sürüm ve bilgi")}
                  style={{ width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 13,
                    border: `1px solid ${menuInfo ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
                    background: menuInfo ? "rgba(150,0,24,.22)" : "var(--rc-surface-3)", color: menuInfo ? "var(--rc-text)" : "var(--rc-text-3)" }}><Icon name="bilgi" size={14} /></button>
                {menuInfo && (
                  <span style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 60, width: 292,
                    background: "var(--rc-surface)", border: "1px solid var(--rc-border-strong)", borderRadius: 12,
                    boxShadow: "0 14px 40px rgba(0,0,0,.5)", display: "block", overflow: "hidden" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--rc-border)" }}>
                      <img src={`${ASSET}logo.png`} alt="" style={{ width: 34, height: 34, objectFit: "contain" }} />
                      <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 16, letterSpacing: ".02em" }}>Race Monitor</b>
                        <span style={{ fontSize: 11, color: "var(--rc-text-3)" }}>{t("Sürüm")} {APP_VERSION} · Caspian Motorsport</span>
                      </span>
                    </span>
                    <span style={{ display: "block", padding: "10px 8px" }}>
                      <button onClick={() => { openVersions(); setMenuInfo(false); }}
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "none",
                          border: "none", color: "var(--rc-text)", cursor: "pointer", fontSize: 12.5, borderRadius: 7 }}>{t("Yenilikler · neler değişti")}</button>
                    </span>
                    <span style={{ display: "block", padding: "9px 16px", borderTop: "1px solid var(--rc-border)", fontSize: 10.5, color: "var(--rc-text-3)", lineHeight: 1.5 }}>
                      {t("Takvim kaynağı")} <a href="https://lmugarage.com" target="_blank" rel="noopener" style={{ color: "var(--rc-brand-bright)" }}>lmugarage.com</a> — {t("resmi olmayan topluluk projesi.")}</span>
                  </span>
                )}
              </span>
              {user && (
                <span style={{ position: "relative" }} data-tour="uchip">
                  <button onClick={() => { setMenuAcct((v) => !v); setMenuInfo(false); }}
                    style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "5px 12px 5px 5px", borderRadius: 99,
                      cursor: "pointer", color: "var(--rc-text)",
                      border: `1px solid ${menuAcct ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
                      background: menuAcct ? "rgba(150,0,24,.22)" : "var(--rc-surface-3)" }}>
                    {(myAvatar || user.photoURL)
                      ? <img src={myAvatar || user.photoURL} alt="" referrerPolicy={/^https?:/.test(myAvatar || user.photoURL) ? "no-referrer" : undefined}
                          style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }} />
                      : <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--rc-brand)", color: "var(--rc-on-brand)",
                          display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 11 }}>{acctInitials}</span>}
                    <span style={{ display: "flex", flexDirection: "column", gap: 1, textAlign: "left" }}>
                      <b style={{ fontSize: 12.5, lineHeight: 1.15 }}>{userName || user.displayName || user.email}</b>
                      <span style={{ fontSize: 10, color: "var(--rc-text-3)", lineHeight: 1.15 }}>{roleLabel}</span>
                    </span>
                    <span style={{ color: "var(--rc-text-3)", fontSize: 10 }}>▾</span>
                  </button>
                  {menuAcct && (
                    <span style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 60, width: 210,
                      background: "var(--rc-surface-2)", border: "1px solid var(--rc-border-strong)", borderRadius: 11,
                      padding: "6px 0", boxShadow: "0 14px 40px rgba(0,0,0,.5)", display: "block" }}>
                      <button onClick={() => { setProfName(userName || user.displayName || ""); setAvStage(""); setAvErr(""); setProfOpen(true); setMenuAcct(false); }}
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 14px", background: "none", border: "none", color: "var(--rc-text)", cursor: "pointer", fontSize: 12.5 }}>{t("Profil ve rozetler")}</button>
                      <span style={{ display: "block", height: 1, background: "var(--rc-border)", margin: "4px 0" }} />
                      <button onClick={() => { setMenuAcct(false); signOut(); }}
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 14px", background: "none", border: "none", color: "var(--rc-danger)", cursor: "pointer", fontSize: 12.5 }}>{t("Çıkış yap")}</button>
                    </span>
                  )}
                </span>
              )}
            </span>
          </div>

          {/* Eski sürüm şeridi kaldırıldı — yerine ortada UpdateModal (updateModal). */}

          {/* ---- hero: sıradaki yarış + hızlı eylemler ---- */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "stretch", marginBottom: 26 }} data-tour="races">
            {nextEntry ? (() => {
              const [rid, r] = nextEntry;
              const ms = (r.startsAt || 0) - now;
              const dd = ms > 0 ? Math.floor(ms / 86400000) : 0;
              const hh = ms > 0 ? Math.floor((ms % 86400000) / 3600000) : 0;
              const mm = ms > 0 ? Math.floor((ms % 3600000) / 60000) : 0;
              return (
              <div style={{ flex: "1 1 620px", minWidth: 0, border: "1px solid var(--rc-brand-deep)", borderRadius: 16, overflow: "hidden",
                background: "radial-gradient(120% 150% at 100% 0,rgba(150,0,24,.30),var(--rc-surface-2) 65%)", display: "flex", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 340px", minWidth: 0, padding: "24px 26px", display: "flex", flexDirection: "column", gap: 14 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, textTransform: "uppercase",
                    letterSpacing: ".14em", color: "var(--rc-brand-bright)", fontWeight: 600 }}>{t("Sıradaki Yarış")}{r.round ? ` · R${r.round}` : ""}</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: "clamp(34px,4vw,52px)", lineHeight: .95, letterSpacing: ".01em" }}>{r.name || trackName(r.trackId) || "—"}</span>
                    <span style={{ fontSize: 13, color: "var(--rc-text-2)" }}>{[trackName(r.trackId), r.raceTime, r.carId ? carName(r.carClass, r.carId) : ""].filter(Boolean).join(" · ")}</span>
                  </div>
                  {r.startsAt && ms > 0 && (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 2 }}>
                      {[[dd, t("gün")], [hh, t("saat")], [mm, t("dakika")]].map(([v, l]) => (
                        <div key={l} style={{ background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 10, padding: "9px 14px", minWidth: 78 }}>
                          <div style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 24, lineHeight: 1 }}>{String(v).padStart(2, "0")}</div>
                          <div style={{ color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em" }}>{l}</div>
                        </div>
                      ))}
                      <div style={{ background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 10, padding: "9px 14px" }}>
                        <div style={{ fontFamily: "var(--rc-font-display)", fontSize: 15, lineHeight: 1.5 }}>{new Date(r.startsAt).toLocaleString(lang === "en" ? "en-GB" : "tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                        <div style={{ color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em" }}>{t("yerel saat")}</div>
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
                    <button onClick={() => openRace(rid, "stint")}
                      style={{ padding: "12px 24px", borderRadius: 10, border: "1px solid var(--rc-brand-bright)", background: "var(--rc-brand)",
                        color: "var(--rc-on-brand)", cursor: "pointer", fontFamily: "var(--rc-font-display)", fontSize: 17, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase" }}>{t("Yarışı aç")} →</button>
                    <button onClick={() => setSuOpen(true)}
                      style={{ padding: "12px 20px", borderRadius: 10, border: "1px solid var(--rc-border-strong)", background: "transparent", color: "var(--rc-text)", cursor: "pointer", fontSize: 13 }}>{t("Setuplar")} ({setups.length})</button>
                  </div>
                </div>
                <div style={{ flex: "0 1 260px", minWidth: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, borderLeft: "1px solid rgba(74,47,56,.6)" }}>
                  <div style={{ textAlign: "center" }}>
                    {r.trackId && <img src={`${ASSET}flags/${TRACK_ASSET(r.trackId)}.png${AV}`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }}
                      style={{ width: 44, borderRadius: 4, border: "1px solid var(--rc-border)", marginBottom: 10 }} />}
                    {r.trackId && <img src={`${ASSET}tracks/${TRACK_ASSET(r.trackId)}.png${AV}`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }}
                      style={{ display: "block", width: "100%", maxWidth: 230, height: "auto", filter: "drop-shadow(0 6px 18px rgba(0,0,0,.5))" }} />}
                  </div>
                </div>
              </div>
              );
            })() : (
              <div style={{ flex: "1 1 620px", minWidth: 0, border: "1px solid var(--rc-border-strong)", borderRadius: 16,
                padding: "40px 26px", textAlign: "center", background: "var(--rc-surface-2)" }}>
                <div style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 20 }}>{t("Takvimde yaklaşan yarış yok.")}</div>
                <div style={{ fontSize: 12, color: "var(--rc-text-3)", marginTop: 6 }}>{t("Resmi yarışlar listesinden bir yarış planlayabilirsin.")}</div>
              </div>
            )}

            <div style={{ flex: "1 1 280px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignContent: "stretch" }}>
              <button onClick={() => { setTab("setup"); if (curRace) openRace(curRace); else if (defaultRid) openRace(defaultRid); else setSuOpen(true); }} style={qaBtn}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--rc-brand-bright)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M10.4 2.6h3.2l.35 2.3a7.4 7.4 0 0 1 1.72 1l2.1-.98 1.6 2.77-1.75 1.53a7.4 7.4 0 0 1 0 1.98l1.75 1.53-1.6 2.77-2.1-.98a7.4 7.4 0 0 1-1.72 1l-.35 2.3h-3.2l-.35-2.3a7.4 7.4 0 0 1-1.72-1l-2.1.98-1.6-2.77 1.75-1.53a7.4 7.4 0 0 1 0-1.98L4.23 7.69l1.6-2.77 2.1.98a7.4 7.4 0 0 1 1.72-1l.35-2.3Z" /><circle cx="12" cy="12" r="3" /></svg>
                <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 15 }}>{t("Setup Havuzu")}</span>
                <span style={{ fontSize: 11, color: "var(--rc-text-3)" }}>{setups.length} {t("dosya")}</span>
              </button>
              <button onClick={() => setTeleOnly(true)} style={qaBtn}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--rc-brand-bright)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4v16h16" /><path d="m7 14 3-3 3 2 4-5" /></svg>
                <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 15 }}>{t("Telemetri")}</span>
                <span style={{ fontSize: 11, color: "var(--rc-text-3)" }}>{t(".duckdb yükle · analiz")}</span>
              </button>
              <button onClick={() => setChatOpen(true)} data-tour="chat" style={qaBtn}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--rc-brand-bright)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 4H4a1.5 1.5 0 0 0-1.5 1.5V16A1.5 1.5 0 0 0 4 17.5h3V21l4-3.5h9A1.5 1.5 0 0 0 21.5 16V5.5A1.5 1.5 0 0 0 20 4Z" /></svg>
                <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 15 }}>{t("Sohbet")}
                  {chatUnread > 0 && <span style={{ marginLeft: 7, background: "var(--rc-brand-deep)", color: "#fff", borderRadius: 9, fontSize: 10, padding: "1px 7px", fontFamily: "var(--rc-font-ui)" }}>{chatUnread}</span>}</span>
                <span style={{ fontSize: 11, color: "var(--rc-text-3)" }}>{t("takım kanalları")}</span>
              </button>
              <button onClick={() => setTeamOpen(true)} data-tour="manage" style={qaBtn}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--rc-brand-bright)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="1.4" /><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h2v5" /></svg>
                <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 15 }}>{canEditTeam ? t("Takım & takvim") : t("Görüntüle")}</span>
                <span style={{ fontSize: 11, color: "var(--rc-text-3)" }}>{t("takvim & takım")}</span>
              </button>
              <button onClick={() => setScheduleOnly(true)}
                style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", gap: 12, background: "var(--rc-surface-2)",
                  border: "1px solid var(--rc-border-strong)", borderRadius: 12, padding: 14, cursor: "pointer", color: "var(--rc-text)", textAlign: "left" }}>
                <span style={{ width: 34, height: 34, borderRadius: 9, background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", display: "grid", placeItems: "center", fontSize: 16, flex: "0 0 auto" }}><Icon name="bayrak" size={18} /></span>
                <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                  <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 15 }}>{t("Resmi Yarışlar")}</span>
                  <span style={{ fontSize: 11, color: "var(--rc-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t("resmi yarış takvimi")}</span>
                </span>
              </button>
            </div>
          </div>

          {/* ---- takvim ---- */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <span style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 17, fontWeight: 700 }}>{t("Takvim")}</span>
            <span style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setMenuCal("active")} style={chip(menuCal === "active")}>
                {activeCount > 0 && <i style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "var(--rc-ok)", marginRight: 6, verticalAlign: "middle" }} />}
                {t("Aktif")} ({activeCount})</button>
              <button onClick={() => setMenuCal("up")} style={chip(menuCal === "up")}>{t("Yaklaşan")} ({upCount})</button>
              <button onClick={() => setMenuCal("past")} style={chip(menuCal === "past")}>{t("Geçmiş")} ({pastCount})</button>
            </span>
            {seasonIds.length > 1 && (<>
              <span style={{ width: 1, height: 22, background: "var(--rc-border)" }} />
              <span style={{ display: "flex", gap: 6 }}>
                {[["all", t("Tümü")], ...seasonIds.map((sid) => [sid, sName(sid)])].map(([v, l]) => (
                  <button key={v} onClick={() => setLobSeason(v)} style={chip(lobSeason === v)}>{l}</button>
                ))}
              </span>
            </>)}
            {menuCal === "past" && (
              <input type="text" value={lobQuery} placeholder={t("ara: pist, yarış adı…")}
                onChange={(e) => { setLobQuery(e.target.value); setPastLimit(12); }}
                style={{ marginLeft: "auto", background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 9, color: "var(--rc-text)", fontSize: 12.5, padding: "8px 12px", width: 220 }} />
            )}
            <button onClick={newRace} style={{ marginLeft: menuCal === "past" ? 0 : "auto", padding: "8px 16px", borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text)", cursor: "pointer", fontSize: 12.5 }}>＋ {t("Yarış ekle")}</button>
          </div>

          <div key={menuCal} style={{ border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)", overflow: "hidden", animation: "rcin .28s ease-out" }}>
            {calEmpty ? (
              <div style={{ padding: "40px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 9 }}>
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--rc-border-strong)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
                <div style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 18 }}>{t("Bu sezonda yarış yok")}</div>
                <div style={{ fontSize: 12, color: "var(--rc-text-3)", lineHeight: 1.7, maxWidth: 380 }}>{t("Takvime yarış ekle ya da resmi yarışlar listesinden planla — eklediğin yarışlar takımdaki herkeste görünür.")}</div>
                <span style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 3 }}>
                  <button onClick={() => setScheduleOnly(true)} style={{ padding: "8px 15px", borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 12.5 }}>{t("Resmi Yarışlar")}</button>
                </span>
              </div>
            ) : (
              <div style={{ padding: 6 }}>
                {calList.map(([rid, r]) => (
                  <Fragment key={rid}>
                    {seasonIds.length > 1 && lobSeason === "all" && (
                      <div style={{ padding: "8px 12px 2px", fontSize: 11, color: "var(--rc-text-3)", textTransform: "uppercase", letterSpacing: ".06em" }}>{sName(sidOf([rid, r]))}</div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10 }}>
                      <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 16, color: "var(--rc-text-3)", width: 36, flex: "0 0 auto" }}>{r.round ? `R${r.round}` : "—"}</span>
                      {r.trackId && <img src={`${ASSET}flags/${TRACK_ASSET(r.trackId)}.png${AV}`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }}
                        style={{ width: 28, borderRadius: 3, border: "1px solid var(--rc-border)", flex: "0 0 auto" }} />}
                      {r.trackId && <img src={`${ASSET}tracks/${TRACK_ASSET(r.trackId)}.png${AV}`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }}
                        style={{ width: 56, height: 34, objectFit: "contain", opacity: .8, flex: "0 0 auto" }} />}
                      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                        <b style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 17, letterSpacing: ".01em" }}>{r.name || trackName(r.trackId) || "—"}</b>
                        <span style={{ fontSize: 11.5, color: "var(--rc-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[trackName(r.trackId), r.raceTime, r.carId ? carName(r.carClass, r.carId) : ""].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 13, color: "var(--rc-text-2)", flex: "0 0 auto" }}>
                        {r.startsAt ? new Date(r.startsAt).toLocaleString(lang === "en" ? "en-GB" : "tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                      <button onClick={() => openRace(rid, "stint")} style={{ flex: "0 0 auto", padding: "7px 16px", borderRadius: 8, border: "1px solid var(--rc-brand-bright)", background: "var(--rc-brand)", color: "var(--rc-on-brand)", cursor: "pointer", fontFamily: "var(--rc-font-display)", fontSize: 13, fontWeight: 700, letterSpacing: ".03em", textTransform: "uppercase" }}>{t("Aç")}</button>
                      {canEditTeam && (<>
                        <button onClick={() => editRace(rid, r)} title={t("Düzenle")} style={{ width: 32, height: 32, flex: "0 0 auto", borderRadius: 8, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 12 }}><Icon name="duzenle" size={14} /></button>
                        <button onClick={() => askDeleteRace(rid, r)} title={t("Sil")} style={{ width: 32, height: 32, flex: "0 0 auto", borderRadius: 8, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-3)", cursor: "pointer", fontSize: 12 }}><Icon name="sil" size={14} /></button>
                      </>)}
                    </div>
                  </Fragment>
                ))}
              </div>
            )}
          </div>
          {menuCal === "past" && pastAll.length > pastLimit && (
            <button onClick={() => setPastLimit((n) => n + 12)}
              style={{ margin: "14px auto 0", display: "block", background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", color: "var(--rc-text-2)", borderRadius: 9, padding: "9px 20px", fontSize: 12.5, cursor: "pointer" }}>↓ {t("Daha fazla göster")} ({pastShown.length} / {pastAll.length})</button>
          )}

          {/* ---- indirmeler ---- */}
          {!isTauri && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
              <a href={DESKTOP_RELEASE_URL} target="_blank" rel="noopener noreferrer"
                style={{ flex: "1 1 340px", display: "flex", alignItems: "center", gap: 14, border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)", padding: "16px 18px", textDecoration: "none", color: "var(--rc-text)" }}>
                <span style={{ width: 44, height: 44, flex: "0 0 auto", borderRadius: 11, background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", display: "grid", placeItems: "center", fontSize: 19 }}><Icon name="masaustu" size={19} /></span>
                <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
                  <b style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 16 }}>{t("Masaüstü uygulaması")}</b>
                  <span style={{ fontSize: 11.5, color: "var(--rc-text-3)", lineHeight: 1.5 }}>{t("Tarayıcısız, kendi penceresinde açılır — canlı timing köprüsü dahil. Sonraki sürümler uygulama içinden gelir.")}</span>
                </span>
                <span style={{ flex: "0 0 auto", padding: "9px 16px", borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text)", fontSize: 12.5 }}>{t("İndir")}</span>
              </a>
              <a href={BRIDGE_EXE_URL} target="_blank" rel="noopener noreferrer"
                style={{ flex: "1 1 340px", display: "flex", alignItems: "center", gap: 14, border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)", padding: "16px 18px", textDecoration: "none", color: "var(--rc-text)" }}>
                <span style={{ width: 44, height: 44, flex: "0 0 auto", borderRadius: 11, background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", display: "grid", placeItems: "center", fontSize: 19 }}><Icon name="tuy" size={19} /></span>
                <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
                  <b style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 16 }}>{t("Hafif köprü · .exe")}</b>
                  <span style={{ fontSize: 11.5, color: "var(--rc-text-3)", lineHeight: 1.5 }}>{t("Oyunun çalıştığı PC için: tarayıcı motoru yok, oyunu yormaz. Paylaşımlı belleği okuyup canlı timing'i yayınlar.")}</span>
                </span>
                <span style={{ flex: "0 0 auto", padding: "9px 16px", borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text)", fontSize: 12.5 }}>{t("İndir")}</span>
              </a>
            </div>
          )}

          <div className="lmsg" style={{ marginTop: 14 }}>{syncMsg}</div>
        </div>
          </div>
        </div>
          );
        })()}
      </div>
    );
  }

  /* ---------- setup 1: pist & araç seçimi ---------- */
  if (!pickDone) {
    /* v2.0 Pist & Araç (handoff-spec/ekranlar/13-pist-arac.md) — kabuk içinde. */
    const cls = st.carClass || "hypercar";
    const clsCars = CARS[cls] || [];
    const curTrack = TRACKS.find((tr) => tr.id === st.track) || null;
    const curCar = clsCars.find((c) => c.id === st.car) || null;
    const clsName = (CAR_CLASSES.find(([id]) => id === cls) || [])[1] || cls;
    const tq = pickTrackQ.trim().toLowerCase();
    const tracks = TRACKS.filter((tr) => !tq || tr.name.toLowerCase().includes(tq));
    const stepDot = { width: 22, height: 22, borderRadius: "50%", background: "var(--rc-brand)", color: "var(--rc-on-brand)", display: "grid", placeItems: "center", fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 12, flex: "0 0 auto" };
    const stepTitle = { fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".07em", fontSize: 16, fontWeight: 700 };
    const canGo = !!(st.track && st.car);
    return (
      <div className="rc">
        {updateModal}
        <div style={shell}>
          {renderRail("menu", (k) => { setTab(k); if (curRace) openRace(curRace); })}
          <div style={{ minWidth: 0 }}>
        <div style={{ padding: "18px 20px 108px", fontFamily: "var(--rc-font-ui)" }}>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
            <button onClick={leaveRace} style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 14 }}>←</button>
            <h2 style={{ margin: 0, fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".06em", fontSize: 22, fontWeight: 700 }}>{t("Pist & Araç")}</h2>
            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", padding: "4px 11px", borderRadius: 99, border: "1px solid var(--rc-border-strong)", color: "var(--rc-text-3)" }}>{curRace ? (races[curRace]?.name || curRace) : t("Solo mod · veriler bu cihazda")}</span>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start", marginBottom: 22 }}>
            <div style={{ flex: "1 1 520px", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={stepDot}>1</span><span style={stepTitle}>{t("Pist Seç")}</span>
                <input type="search" value={pickTrackQ} onChange={(e) => setPickTrackQ(e.target.value)} placeholder={t("Pist ara…")}
                  style={{ marginLeft: "auto", background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 9, color: "var(--rc-text)", fontSize: 12.5, padding: "7px 12px", width: 180 }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(168px,1fr))", gap: 9 }}>
                {tracks.map((tr) => {
                  const on = st.track === tr.id;
                  return (
                    <button key={tr.id} onClick={() => up({ track: tr.id, ...(PIT_LANE_TIMES[tr.id] != null ? { pitLaneTime: PIT_LANE_TIMES[tr.id] } : {}) })}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 11, cursor: "pointer", color: "var(--rc-text)", minWidth: 0,
                        border: `1px solid ${on ? "var(--rc-brand-bright)" : "var(--rc-border)"}`, background: on ? "rgba(150,0,24,.22)" : "var(--rc-surface-2)" }}>
                      <img src={`${ASSET}flags/${TRACK_ASSET(tr.id)}.png`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ width: 26, borderRadius: 3, border: "1px solid var(--rc-border)", flex: "0 0 auto" }} />
                      <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, textAlign: "left" }}>
                        <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tr.name}</b>
                        <span style={{ fontSize: 10.5, color: "var(--rc-text-3)" }}>{t("Pit kaybı")} {PIT_LANE_TIMES[tr.id] ?? "—"}s</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ flex: "1 1 300px", minWidth: 280, border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)", padding: 18, textAlign: "center" }}>
              {st.track && <img key={st.track} src={`${ASSET}tracks/${TRACK_ASSET(st.track)}.png${AV}`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }}
                style={{ display: "block", width: "100%", maxWidth: 280, height: "auto", margin: "0 auto", filter: "drop-shadow(0 6px 18px rgba(0,0,0,.5))" }} />}
              <div style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 19, marginTop: 12 }}>{curTrack?.name || t("Pist seçilmedi")}</div>
              {curTrack && <div style={{ color: "var(--rc-text-3)", fontSize: 11.5, marginTop: 3 }}>{t("Pit kaybı")} {PIT_LANE_TIMES[st.track] ?? "—"} sn · {t("seçili pist")}</div>}
            </div>
          </div>

          <div style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={stepDot}>2</span><span style={stepTitle}>{t("Sınıf Seç")}</span>
            </div>
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
              {CAR_CLASSES.map(([id, name]) => {
                const on = cls === id, has = (CARS[id] || []).length;
                return (
                  <button key={id} onClick={() => up({ carClass: id, car: "" })}
                    style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 16px", borderRadius: 11, cursor: "pointer", color: "var(--rc-text)",
                      border: `1px solid ${on ? "var(--rc-brand-bright)" : "var(--rc-border)"}`, background: on ? "rgba(150,0,24,.22)" : "var(--rc-surface-2)", opacity: has ? 1 : .5 }}>
                    <img src={`${ASSET}class/${id}.png`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ height: 22, flex: "0 0 auto" }} />
                    <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 15, letterSpacing: ".03em" }}>{name}</span>
                    <span style={{ fontSize: 10.5, color: "var(--rc-text-3)" }}>{has} {t("araç")}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={stepDot}>3</span><span style={stepTitle}>{t("Araç Seç")}</span>
              <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{clsName} · {clsCars.length} {t("araç")}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 12 }}>
              {clsCars.map((c) => {
                const on = st.car === c.id;
                return (
                  <button key={c.id} onClick={() => up({ carClass: cls, car: c.id })}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 14px 12px", borderRadius: 12, cursor: "pointer", color: "var(--rc-text)",
                      border: `1px solid ${on ? "var(--rc-brand-bright)" : "var(--rc-border)"}`, background: on ? "rgba(150,0,24,.16)" : "var(--rc-surface-2)" }}>
                    <img src={carImageSrc(teamData?.assets, cls, c.id, "side")} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ width: "100%", height: 96, objectFit: "contain", display: "block" }} />
                    <span style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, width: "100%" }}>
                      <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 15, textAlign: "left", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</b>
                      {on && <span style={{ color: "var(--rc-ok)", fontSize: 14, flex: "0 0 auto" }}>✓</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
          </div>
        </div>

        <div style={{ position: "fixed", left: rail ? 76 : 0, right: 0, bottom: 0, zIndex: 30, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "13px 20px", borderTop: "1px solid var(--rc-border-strong)", background: "rgba(18,12,14,.96)", backdropFilter: "blur(8px)", transition: "left .32s cubic-bezier(.4,0,.2,1)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {st.track && <img src={`${ASSET}flags/${TRACK_ASSET(st.track)}.png`} alt="" style={{ width: 22, borderRadius: 2 }} />}
              <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 15 }}>{curTrack?.name || "—"}</b>
                <span style={{ fontSize: 10, color: "var(--rc-text-3)", textTransform: "uppercase", letterSpacing: ".08em" }}>{t("Pist")}</span>
              </span>
            </span>
            <span style={{ width: 1, height: 26, background: "var(--rc-border)" }} />
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <img src={`${ASSET}class/${cls}.png`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ height: 18 }} />
              <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 15 }}>{clsName}</b>
                <span style={{ fontSize: 10, color: "var(--rc-text-3)", textTransform: "uppercase", letterSpacing: ".08em" }}>{t("Sınıf")}</span>
              </span>
            </span>
            <span style={{ width: 1, height: 26, background: "var(--rc-border)" }} />
            <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 15, color: curCar ? "var(--rc-text)" : "var(--rc-text-3)" }}>{curCar?.name || t("Seçilmedi")}</b>
              <span style={{ fontSize: 10, color: "var(--rc-text-3)", textTransform: "uppercase", letterSpacing: ".08em" }}>{t("Araç")}</span>
            </span>
          </span>
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button onClick={() => setPickDone(true)} style={{ background: "none", border: "none", color: "var(--rc-text-3)", cursor: "pointer", fontSize: 12.5, textDecoration: "underline", textUnderlineOffset: 3 }}>{t("Seçim yapmadan geç →")}</button>
            <button disabled={!canGo} onClick={() => { if (canGo) setPickDone(true); }} style={{ padding: "11px 22px", borderRadius: 10, cursor: canGo ? "pointer" : "not-allowed", opacity: canGo ? 1 : .55, fontFamily: "var(--rc-font-display)", fontSize: 16, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", whiteSpace: "nowrap",
              border: `1px solid ${canGo ? "var(--rc-brand-bright)" : "var(--rc-border)"}`, background: canGo ? "var(--rc-brand)" : "var(--rc-surface-3)", color: canGo ? "var(--rc-on-brand)" : "var(--rc-text-3)" }}>✓ {t("Devam et — yarış dataları")}</button>
          </span>
        </div>
      </div>
    );
  }

  /* ---------- setup 2: yarış datalarını gir ---------- */
  if (!setupDone) {
    /* v2.0 Yarış Dataları (handoff-spec/ekranlar/12-yaris-datalari.md) — kabuk içinde.
       Aynı handler'lar (up, WEATHER, strategies, racePlan). Weather log mantığı dataCards ile aynı. */
    const clsD = st.carClass || "hypercar";
    /* st.strategies[k] = STINT BAŞINA TUR (motor: engine.js walkFull nLaps). Pit türetilir. */
    const lapsPerStint = st.strategies[st.chosen] ?? 0;
    const totLaps = racePlan.totalLaps || 0;
    const lapSec = parseLap(st.avgLap) || 0;
    const stStints = racePlan.rows?.length || 0;
    const chosenPits = stStints > 0 ? Math.max(0, stStints - 1)
      : (lapsPerStint > 0 && totLaps > 0 ? Math.max(0, Math.ceil(totLaps / lapsPerStint) - 1) : 0);
    const stintTime = lapSec > 0 && lapsPerStint > 0 ? fmtHMS(lapsPerStint * lapSec) : "—";
    const pickWx = (id) => {
      const el = liveInfo.status === "live" ? Math.max(0, Math.round(liveInfo.elapsed / 1000)) : 0;
      let past = (st.weatherLog || []).filter((e) => e.t < el - 0.5);
      const future = (st.weatherLog || []).filter((e) => e.t > el + 0.5);
      if (el < 1) past = [];
      const log = [...past, { t: el, w: id, src: "live" }, ...future].sort((a, b) => a.t - b.t);
      up({ weather: id, weatherLog: log });
    };
    const lbl = { display: "block", color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 };
    const bigInp = { width: "100%", boxSizing: "border-box", background: "var(--rc-surface-3)", border: "1px solid var(--rc-border-strong)", borderRadius: 10, color: "var(--rc-text)", padding: "12px 14px", fontFamily: "var(--rc-font-display)", fontSize: 22, fontWeight: 600 };
    const midInp = { width: "100%", boxSizing: "border-box", background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 10, color: "var(--rc-text)", padding: "11px 13px", fontFamily: "var(--rc-font-display)", fontSize: 19, fontWeight: 600 };
    const card = { border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)", padding: "16px 18px" };
    const cardHd = { fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 16, fontWeight: 700 };
    const stepBox = { display: "inline-flex", alignItems: "center", border: "1px solid var(--rc-border)", borderRadius: 10, overflow: "hidden" };
    const stepBtn = { width: 38, height: 44, border: "none", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 16 };
    const stepVal = { minWidth: 52, textAlign: "center", fontFamily: "var(--rc-font-display)", fontSize: 19 };
    return (
      <div className="rc">
        {updateModal}
        {wxTransModal}
        <div style={shell}>
          {renderRail("menu", (k) => { setTab(k); if (curRace) openRace(curRace); })}
          <div style={{ minWidth: 0 }}>
        <div style={{ padding: "18px 20px 108px", fontFamily: "var(--rc-font-ui)" }}>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
            <button onClick={() => setPickDone(false)} style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 14 }}>←</button>
            <h2 style={{ margin: 0, fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".06em", fontSize: 22, fontWeight: 700 }}>{t("Yarış Dataları")}</h2>
            {st.track && <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--rc-text-2)" }}>
              <img src={`${ASSET}flags/${TRACK_ASSET(st.track)}.png`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ width: 20, borderRadius: 2 }} />{trackName(st.track)}
              {st.car && <><span style={{ color: "var(--rc-border-strong)" }}>·</span><img src={`${ASSET}class/${clsD}.png`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ height: 16 }} />{carName(clsD, st.car)}</>}
            </span>}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>

              <div style={card}>
                <div style={{ ...cardHd, marginBottom: 14 }}>{t("Yarış")}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                  <div style={{ flex: "1 1 170px", minWidth: 0 }}>
                    <label style={lbl}>{t("Yarış süresi · h:mm:ss")}</label>
                    <input type="text" value={st.raceTime} onChange={(e) => up({ raceTime: e.target.value })} style={bigInp} />
                  </div>
                  <div style={{ flex: "1 1 170px", minWidth: 0 }}>
                    <label style={lbl}>{t("Ortalama tur · m:ss.00")}</label>
                    <input type="text" value={st.avgLap} onChange={(e) => up({ avgLap: e.target.value })} style={bigInp} />
                    {avgSug && canEdit && (
                      <button onClick={() => up({ avgLap: avgSug.txt })} style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 7, padding: "7px 12px", borderRadius: 9, border: "1px solid rgba(55,214,122,.45)", background: "rgba(55,214,122,.10)", color: "var(--rc-ok)", cursor: "pointer", fontSize: 11.5, width: "100%" }}><Icon name="simsek" size={14} /> {t("Canlı AVG5")} <b style={{ fontFamily: "var(--rc-font-display)" }}>{avgSug.txt}</b> — {t("uygula")}</button>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 14, alignItems: "flex-end" }}>
                  <div style={{ flex: "0 0 auto" }}>
                    <label style={lbl}>{t("Ekstra tur")}</label>
                    <span style={stepBox}>
                      <button onClick={() => up({ extraLap: Math.max(0, (st.extraLap || 0) - 1) })} style={stepBtn}>−</button>
                      <b style={stepVal}>{st.extraLap || 0}</b>
                      <button onClick={() => up({ extraLap: (st.extraLap || 0) + 1 })} style={stepBtn}>+</button>
                    </span>
                  </div>
                  <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                    <button onClick={() => up({ multiclass: !st.multiclass })} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", borderRadius: 10, cursor: "pointer", color: "var(--rc-text)", border: `1px solid ${st.multiclass ? "var(--rc-brand-bright)" : "var(--rc-border)"}`, background: st.multiclass ? "rgba(150,0,24,.16)" : "var(--rc-surface-3)" }}>
                      <span style={{ width: 20, height: 20, borderRadius: 6, flex: "0 0 auto", display: "grid", placeItems: "center", fontSize: 11, border: `1px solid ${st.multiclass ? "var(--rc-brand-bright)" : "var(--rc-border-strong)"}`, background: st.multiclass ? "var(--rc-brand)" : "transparent", color: st.multiclass ? "var(--rc-on-brand)" : "transparent" }}>✓</span>
                      <span style={{ display: "flex", flexDirection: "column", gap: 1, textAlign: "left" }}>
                        <b style={{ fontSize: 13 }}>{t("Multiclass yarış")}</b>
                        <span style={{ fontSize: 10.5, color: "var(--rc-text-3)" }}>{t("Lider sınıfa göre bayrak hesabı")}</span>
                      </span>
                    </button>
                  </div>
                </div>
                {st.multiclass && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--rc-border)" }}>
                    <div style={{ flex: "1 1 170px", minWidth: 0 }}>
                      <label style={lbl}>{t("Lider sınıf")}</label>
                      <select value={st.leaderClass} onChange={(e) => up({ leaderClass: e.target.value })} style={{ width: "100%", boxSizing: "border-box", background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 10, color: "var(--rc-text)", padding: "11px 12px", fontSize: 13 }}>
                        {CAR_CLASSES.map(([id, name]) => (<option key={id} value={id}>{name}</option>))}
                      </select>
                    </div>
                    <div style={{ flex: "1 1 170px", minWidth: 0 }}>
                      <label style={lbl}>{t("Lider tur · m:ss.00")}</label>
                      <input type="text" value={st.leaderLap} placeholder={st.avgLap} onChange={(e) => up({ leaderLap: e.target.value })} style={{ ...midInp, fontSize: 17 }} />
                    </div>
                    {racePlan.flagExtra > 0.5 && <div style={{ flex: "1 1 100%", fontSize: 11.5, color: "var(--rc-warn)" }}><Icon name="bayrak" size={12} /> {t("Lider bayrağı")}: +{racePlan.flagExtra.toFixed(0)}s → {t("son tur otomatik eklenir")}</div>}
                  </div>
                )}
              </div>

              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span style={cardHd}>{t("Strateji")}</span>
                  <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{t("Stint başına tur · pit türetilir")}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
                  {["A", "B", "C", "D"].map((k) => {
                    const on = st.chosen === k, laps = st.strategies[k] ?? 0;
                    const pits = laps > 0 && totLaps > 0 ? Math.max(0, Math.ceil(totLaps / laps) - 1) : 0;
                    return (
                      <div key={k} onClick={() => up({ chosen: k })} style={{ padding: "12px 14px", borderRadius: 12, cursor: "pointer", border: `1px solid ${on ? "var(--rc-brand-bright)" : "var(--rc-border)"}`, background: on ? "rgba(150,0,24,.20)" : "var(--rc-surface-2)" }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                          <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{k}</b>
                          <span style={{ fontSize: 11, color: on ? "var(--rc-brand-bright)" : "var(--rc-text-3)" }}>{laps} tur/stint</span>
                        </div>
                        <div style={{ fontFamily: "var(--rc-font-display)", fontSize: 15, marginTop: 8 }}>{lapSec > 0 && laps > 0 ? fmtHMS(laps * lapSec) : "—"}</div>
                        <div style={{ fontSize: 10, color: "var(--rc-text-3)", textTransform: "uppercase", letterSpacing: ".08em", marginTop: 2 }}>{pits} pit · stint {laps} tur</div>
                        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                          <button onClick={(e) => { e.stopPropagation(); up({ strategies: { ...st.strategies, [k]: Math.max(1, laps - 1) } }); }} style={{ width: 30, height: 26, borderRadius: 7, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 13, lineHeight: 1 }}>−</button>
                          <button onClick={(e) => { e.stopPropagation(); up({ strategies: { ...st.strategies, [k]: laps + 1 } }); }} style={{ width: 30, height: 26, borderRadius: 7, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 13, lineHeight: 1 }}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span style={cardHd}>{t("Pit · Süreler")}</span><span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{t("saniye")}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                  <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                    <label style={lbl}>Pit line</label>
                    <NumField value={st.pitLaneTime} onC={(v) => up({ pitLaneTime: v })} step="1" style={midInp} />
                    {st.track && PIT_LANE_TIMES[st.track] != null && <div style={{ fontSize: 10.5, color: "var(--rc-text-3)", marginTop: 5 }}>{t("Pist verisi")}: {PIT_LANE_TIMES[st.track]}s · {trackName(st.track)}</div>}
                  </div>
                  <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                    <label style={lbl}><Icon name="yakit" size={13} /> {fv.hasVE ? t("Yakıt & VE") : t("Yakıt")}</label>
                    <NumField value={st.fuelTime} onC={(v) => up({ fuelTime: v })} step="1" style={midInp} />
                    <div style={{ fontSize: 10.5, color: "var(--rc-text-3)", marginTop: 5 }}>{t("Duraklamada geçen dolum süresi")}</div>
                  </div>
                  <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                    <label style={lbl}><Icon name="lastik" size={13} /> {t("Lastik limiti · adet")}</label>
                    <span style={stepBox}>
                      <button onClick={() => up({ tyreLimit: Math.max(0, (st.tyreLimit || 0) - 1) })} style={stepBtn}>−</button>
                      <b style={stepVal}>{st.tyreLimit || 0}</b>
                      <button onClick={() => up({ tyreLimit: (st.tyreLimit || 0) + 1 })} style={stepBtn}>+</button>
                    </span>
                  </div>
                </div>
              </div>

              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span style={cardHd}><Icon name={fv.hasVE ? "simsek" : "yakit"} size={14} /> {fv.hasVE ? "Virtual Energy" : t("Yakıt")}</span><span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{fv.hasVE ? t("Tüketim ve yakıt karşılığı") : t("Tüketim ve depo")}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                  {fv.hasVE ? (<>
                    <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                      <label style={lbl}>{t("VE tüketim · %/tur")}</label>
                      <NumField value={st.consumption} onC={(v) => up({ consumption: v })} step="0.01" style={midInp} />
                    </div>
                    <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                      <label style={lbl}>{t("Fuel ratio · L / %1")}</label>
                      <NumField value={st.fuelRatio} onC={(v) => up({ fuelRatio: v })} step="0.01" style={midInp} />
                    </div>
                  </>) : (<>
                    <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                      <label style={lbl}>{t("Yakıt tüketim · L/tur")}</label>
                      <NumField value={fuelPerLapL} onC={setFuelPerLapL} step="0.01" style={midInp} />
                    </div>
                    <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                      <label style={lbl}>{t("Depo · L")}</label>
                      <NumField value={fuelTankL} onC={setFuelTankL} step="1" style={midInp} />
                    </div>
                  </>)}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                  <div style={{ flex: "1 1 150px", padding: "11px 14px", borderRadius: 10, border: "1px solid rgba(55,214,122,.35)", background: "rgba(55,214,122,.07)" }}>
                    <div style={{ fontFamily: "var(--rc-font-display)", fontSize: 19, fontWeight: 600, color: "var(--rc-ok)" }}>{fuelCarried.toFixed(1)} L</div>
                    <div style={{ color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", marginTop: 3 }}>{fv.hasVE ? t("%100 = taşınan yakıt") : t("Depo (toplam)")}</div>
                  </div>
                  <div style={{ flex: "1 1 150px", padding: "11px 14px", borderRadius: 10, border: "1px solid var(--rc-border)", background: "var(--rc-surface-2)" }}>
                    <div style={{ fontFamily: "var(--rc-font-display)", fontSize: 19, fontWeight: 600 }}>{st.consumption > 0 ? Math.round(100 / st.consumption) : "—"} tur</div>
                    <div style={{ color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", marginTop: 3 }}>{t("Tam depo menzili")}</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ flex: "1 1 340px", minWidth: 300, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ border: "1px solid var(--rc-border-strong)", borderRadius: 12, background: "radial-gradient(120% 160% at 100% 0,rgba(150,0,24,.22),var(--rc-surface-2) 62%)", padding: "16px 18px" }}>
                <div style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 13, fontWeight: 700, color: "var(--rc-brand-bright)", marginBottom: 12 }}>{t("Plan özeti")}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ flex: "0 0 auto", textAlign: "center" }}>
                    {st.track && <img src={`${ASSET}tracks/${TRACK_ASSET(st.track)}.png`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ display: "block", width: 104, height: 64, objectFit: "contain" }} />}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--rc-text-2)", marginTop: 2 }}>{st.track && <img src={`${ASSET}flags/${TRACK_ASSET(st.track)}.png`} alt="" style={{ width: 15, borderRadius: 2 }} />}{trackName(st.track) || "—"}</span>
                  </div>
                  <span style={{ width: 1, alignSelf: "stretch", background: "var(--rc-border-strong)" }} />
                  <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
                    {st.car && <img src={carImageSrc(teamData?.assets, clsD, st.car, "side")} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ display: "block", width: "100%", maxWidth: 170, height: 64, objectFit: "contain", margin: "0 auto" }} />}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--rc-text-2)", marginTop: 2 }}>{st.car && <img src={`${ASSET}class/${clsD}.png`} alt="" style={{ height: 13 }} />}{st.car ? carName(clsD, st.car) : "—"}</span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingTop: 12, borderTop: "1px solid var(--rc-border-strong)" }}>
                  <div><div style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 24, lineHeight: 1 }}>{totLaps.toFixed(0)}</div><div style={{ color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", marginTop: 2 }}>{t("Toplam tur")}</div></div>
                  <div><div style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 24, lineHeight: 1 }}>{st.chosen} · {lapsPerStint} tur</div><div style={{ color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", marginTop: 2 }}>{t("Seçili strateji")} · {chosenPits} pit</div></div>
                  <div><div style={{ fontFamily: "var(--rc-font-display)", fontWeight: 600, fontSize: 19, lineHeight: 1.2 }}>{stintTime}</div><div style={{ color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", marginTop: 2 }}>{t("Stint uzunluğu")}</div></div>
                  <div><div style={{ fontFamily: "var(--rc-font-display)", fontWeight: 600, fontSize: 19, lineHeight: 1.2 }}>{st.pitLaneTime} sn</div><div style={{ color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", marginTop: 2 }}>{t("Pit kaybı")}</div></div>
                </div>
              </div>

              <div style={card}>
                <div style={{ ...cardHd, marginBottom: 14 }}>{t("Yarış başlangıcı")}</div>
                <label style={lbl}>{t("Start tarih & saat")}</label>
                <input type="datetime-local" value={msToLocalInput(st.raceStartMs)} onChange={(e) => { const v = new Date(e.target.value).getTime(); if (!isNaN(v)) up({ raceStartMs: v }); }} style={{ width: "100%", boxSizing: "border-box", background: "var(--rc-surface-3)", border: "1px solid var(--rc-border-strong)", borderRadius: 10, color: "var(--rc-text)", padding: "11px 13px", fontFamily: "var(--rc-font-display)", fontSize: 15 }} />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {[[t("Şimdi"), 0], ["+15 dk", 15], ["+1 sa", 60]].map(([lb, mins]) => (
                    <button key={lb} onClick={() => up({ raceStartMs: (mins === 0 ? Date.now() : (st.raceStartMs || Date.now())) + mins * 60000 })} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 11.5 }}>{lb}</button>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(55,214,122,.35)", background: "rgba(55,214,122,.07)" }}>
                  <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--rc-text-3)" }}>{t("Hesaplanan bitiş")}</span>
                  <b style={{ marginLeft: "auto", fontFamily: "var(--rc-font-display)", fontSize: 22, color: "var(--rc-ok)" }}>{driverPlan ? fmtClock(driverPlan.finishMs, driverPlan.startMs) : "—"}</b>
                </div>
              </div>

              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={cardHd}>{t("Hava Durumu")}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--rc-text-3)" }}>{t("Efektif tur")} ×{(WEATHER[st.weather] || WEATHER.dry).lap.toFixed(2)}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 7 }}>
                  {Object.entries(WEATHER).map(([id, w]) => {
                    const on = st.weather === id;
                    return (
                      <button key={id} onClick={() => pickWx(id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "9px 4px", borderRadius: 10, cursor: "pointer", color: on ? w.col : "var(--rc-text-2)", border: `1px solid ${on ? w.col : "var(--rc-border)"}`, background: on ? "var(--rc-surface-2)" : "transparent" }}>
                        <WetIcon id={id} size={22} />
                        <span style={{ fontSize: 11, marginTop: 4, lineHeight: 1.2 }}>{t(w.lbl)}</span>
                        <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 10, color: "var(--rc-text-3)", marginTop: 2 }}>×{w.lap.toFixed(2)}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--rc-border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{t("Planlı geçiş")}</span>
                  {(st.weatherLog || []).filter((e) => e.src === "plan").sort((a, b) => a.t - b.t).map((e, i) => (
                    <span key={`${e.t}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 99, border: `1px solid ${(WEATHER[e.w] || WEATHER.dry).col}`, color: (WEATHER[e.w] || WEATHER.dry).col, fontSize: 11.5 }}>{fmtHMS(e.t)} · {t((WEATHER[e.w] || WEATHER.dry).lbl)}</span>
                  ))}
                  <button onClick={() => setWxModal(true)} style={{ padding: "5px 11px", borderRadius: 8, border: "1px dashed var(--rc-border-strong)", background: "transparent", color: "var(--rc-text-3)", cursor: "pointer", fontSize: 11.5 }}>＋ {t("Geçiş ekle")}</button>
                </div>
              </div>

              <div style={card}>
                <div style={{ ...cardHd, marginBottom: 12, fontSize: 16 }}><Icon name="goz" size={16} /> {t("Canlı Yayın")}</div>
                <label style={lbl}>{t("YouTube linki")}</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="text" value={st.streamUrl} placeholder="https://youtube.com/watch?v=…" onChange={(e) => up({ streamUrl: e.target.value })} style={{ flex: 1, minWidth: 0, background: "var(--rc-surface-3)", border: "1px solid var(--rc-border-strong)", borderRadius: 10, color: "var(--rc-text)", padding: "11px 13px", fontSize: 12.5, fontFamily: "var(--rc-font-display)" }} />
                  <button onClick={() => up({ streamUrl: "" })} style={{ padding: "0 14px", borderRadius: 10, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-3)", cursor: "pointer", fontSize: 13 }}>{t("Temizle")}</button>
                </div>
                <div style={{ fontSize: 11, color: "var(--rc-text-3)", marginTop: 8 }}>{ytId(st.streamUrl) ? <>✅ {t("Yayın köşedeki mini oynatıcıda gösteriliyor.")}</> : t("Geçerli bir YouTube linki yapıştır; köşede mini oynatıcı açılır.")}</div>
              </div>
            </div>
          </div>

        </div>
          </div>
        </div>

        <div style={{ position: "fixed", left: rail ? 76 : 0, right: 0, bottom: 0, zIndex: 30, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "13px 20px", borderTop: "1px solid var(--rc-border-strong)", background: "rgba(18,12,14,.96)", backdropFilter: "blur(8px)", transition: "left .32s cubic-bezier(.4,0,.2,1)" }}>
          <span style={{ fontSize: 12, color: "var(--rc-text-3)" }}>{t("Dataları sonradan sol panelden değiştirebilirsin")}</span>
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setPickDone(false)} style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 13 }}>{t("Geri")}</button>
            <button onClick={() => { setTab("stint"); setSetupDone(true); }} style={{ padding: "11px 24px", borderRadius: 10, border: "1px solid var(--rc-brand-bright)", background: "var(--rc-brand)", color: "var(--rc-on-brand)", cursor: "pointer", fontFamily: "var(--rc-font-display)", fontSize: 16, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" }}>{t("Yarışı aç")} →</button>
          </span>
        </div>
      </div>
    );
  }

  /* ================= v2.0 KABUK — sol dikey menü rayı =================
     Kaynak: handoff-spec/ekranlar/00-kabuk.md. Yatay sekme çubuğunun yerine geçen sabit
     sol ray. Değerler fişteki dinamik stil objelerinden birebir; hex → var(--rc-*). */
  /* ---- v2.0 yarış üst çubuğu (handoff-spec/ekranlar/00-yaris-ust-cubugu.md) ---- */
  const isRace = ["live", "dash", "stint", "fuel", "tyre", "drivers"].includes(tab);
  const rcInfo = races[curRace] || {};
  const raceTitle = rcInfo.name || trackName(rcInfo.trackId || st.track) || t("Yarış");
  const raceSub = [rcInfo.round ? `R${rcInfo.round}` : "", trackName(rcInfo.trackId || st.track),
    st.car ? carName(st.carClass, st.car) : ""].filter(Boolean).join(" · ");
  const readOnly = !!curRace && role === "viewer";
  /* YARIŞ·DATA yan paneli yalnız Canlı Timing + Stint (ve Code80) ekranlarında. */
  const showSide = tab === "live" || tab === "stint" || tab === "code80";
  /* Üst bar canlı akışa göre — köprüyü ISTER bu cihaz ister takım arkadaşı çalıştırsın,
     veri Firebase'e düştüğü an (live.ts tazeliği) "canlı" sayılır. Böylece köprüyü
     başka biri açtıysa üst bar onun çektiği veriyi gösterir (connOf ile aynı eşikler). */
  const liveAgeMs = live?.ts ? serverNow() - live.ts : null;
  const feedFresh = liveAgeMs != null && liveAgeMs < 30000;   // veri akıyor (canlı/gecikmeli)
  const feedLiveNow = liveAgeMs != null && liveAgeMs < 6000;  // taze (yeşil)
  const feed = !!(live && live.own && live.own.position != null && feedFresh);
  /* Sınıf-içi sıra: saha pozisyona göre sıralıdır → kendi sınıfımızdaki araçları
     oyuncu aracına dek say (LiveTab saha tablosuyla aynı mantık). Örn. P7 genel,
     GT3'te 1. → üst barda "P7 · GT3 1". Saha yoksa yalnız sınıf etiketi kalır. */
  const ownClassPos = (() => {
    if (!feed || !st.carClass || !Array.isArray(live.field)) return null;
    const target = classId(st.carClass);
    if (!target) return null;
    let n = 0;
    for (const c of live.field) {
      if (classId(c.carClass) !== target) continue;
      n += 1;
      if (c.isPlayer) return n;
    }
    return null;
  })();
  const bPhase = bridge?.phase || "idle";
  const bWriter = bridge?.writerBy || "";
  const bLive = bPhase === "running" || feedLiveNow;
  const bDot = bLive ? "var(--rc-ok)" : feedFresh ? "var(--rc-warn)"
    : bPhase === "error" ? "var(--rc-danger)"
    : bPhase === "starting" || bPhase === "standby" ? "var(--rc-warn)" : "var(--rc-text-4)";
  /* Bayrağa kalan: plan saati canlıysa plandan; değilse akan feed'in seans kalan
     süresinden (başka biri köprüyü açtıysa da dolu görünür). */
  const feedSecLeft = feed && live.session?.timeLeftSec != null ? live.session.timeLeftSec : null;
  const flagBig = liveInfo.status === "live" ? fmtHMS(liveInfo.remaining / 1000)
    : feedSecLeft != null ? fmtHMS(feedSecLeft)
    : liveInfo.status === "pre" ? (liveInfo.toStart < 86400000 ? fmtHMS(liveInfo.toStart / 1000) : "—")
    : "—";
  const raceFrac = liveInfo.status === "live" && liveInfo.raceMs > 0
    ? Math.min(1, Math.max(0, liveInfo.elapsed / liveInfo.raceMs)) : 0;
  const totStints = racePlan.rows.length;
  const pitBig = liveInfo.status === "live" ? fmtHMS(liveInfo.nextPitIn / 1000) : "—";
  const pitLabel = liveInfo.status !== "live" ? t("Sıradaki pit")
    : liveInfo.phase === "pit" ? t("Pit çıkışı") : onLastStint ? t("Bayrağa") : t("Sıradaki pit");
  const pitSub = liveInfo.status === "live"
    ? `S${liveInfo.stintIdx + 1}/${totStints}${liveInfo.driver ? ` · ${liveInfo.driver}` : ""}` : "";
  const staleDot = feed ? { display: "none" }
    : { width: 6, height: 6, borderRadius: "50%", background: "var(--rc-warn)", flex: "0 0 auto", animation: "rcpulse 1.6s ease-in-out infinite" };

  return (
    <div className="rc">
      {updateModal}
      {teamModal}{createJoinModal}{raceForm}{versionModal}{chatModal}{tourOverlay}{streamPlayer}{setupModal}{setupContentModal}{setupCompareModal}{cmpBar}{wxTransModal}
      {denyToast}{cmdPalette}
      {profileModal}
      {adminModal}
      <div style={shell}>
        {renderRail(tab, (k) => setTab(k))}

        <div style={{ minWidth: 0 }}>
      {isRace && (() => {
        const age = live?.ts ? Math.max(0, Math.round((now - live.ts) / 1000)) : null;
        const bVer = bridge?.ver || APP_VERSION.replace(/^v/, "");
        const wasted = feed || bLive ? bridge?.diag?.plugin : null;
        return (
      <header style={{ position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "stretch",
        gap: 0, borderBottom: "1px solid var(--rc-border)", background: "linear-gradient(180deg,#1A1013,var(--rc-surface))" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", minWidth: 250 }}>
          {st.track && <img src={`${ASSET}flags/${st.track}.png`} alt=""
            style={{ width: 34, borderRadius: 3, border: "1px solid var(--rc-border)" }} />}
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 22,
              lineHeight: 1, letterSpacing: ".02em" }}>{raceTitle}</span>
            <span style={{ fontSize: 11, color: "var(--rc-text-3)", whiteSpace: "nowrap" }}>{raceSub}</span>
            {readOnly && (
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
                marginTop: 12, alignSelf: "flex-start", padding: "4px 12px", borderRadius: 8,
                border: "1px solid var(--rc-warn)", background: "rgba(245,178,61,.10)", color: "var(--rc-warn)",
                fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", whiteSpace: "nowrap" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--rc-warn)" strokeWidth="1.9" strokeLinecap="round" style={{ flex: "0 0 auto" }}><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.7" /></svg>
                {t("İzleyici modu")}
              </span>
            )}
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "stretch", borderLeft: "1px solid var(--rc-border)" }}>
          <div style={{ flex: 1.4, display: "flex", flexDirection: "column", justifyContent: "center", gap: 2,
            padding: "10px 22px", borderRight: "1px solid var(--rc-border)" }}>
            <span style={{ color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".12em" }}>{t("Bayrağa kalan")}</span>
            <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontVariantNumeric: "tabular-nums",
              fontSize: "clamp(38px,4.2vw,60px)", lineHeight: .9, color: "var(--rc-text)" }}>{flagBig}</span>
            <div style={{ height: 3, borderRadius: 2, background: "var(--rc-line-soft)", overflow: "hidden", marginTop: 6 }}>
              <i style={{ display: "block", height: "100%", width: `${Math.round(raceFrac * 100)}%`, background: "var(--rc-brand)" }} /></div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 2,
            padding: "10px 22px", borderRight: "1px solid var(--rc-border)", background: "rgba(245,178,61,.07)" }}>
            <span style={{ color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".12em" }}>{pitLabel}</span>
            <span style={{ display: "inline-block", fontFamily: "var(--rc-font-display)", fontWeight: 700,
              fontVariantNumeric: "tabular-nums", fontSize: "clamp(30px,3.2vw,44px)", lineHeight: .95, color: "var(--rc-warn)",
              borderRadius: 10, animation: pitSoon ? "rcalert 2.6s ease-in-out infinite" : "none" }}>{pitBig}</span>
            <span style={{ fontSize: 11, color: "var(--rc-text-2)" }}>{pitSub}</span>
          </div>
          <div style={{ flex: .8, display: "flex", flexDirection: "column", justifyContent: "center", gap: 2,
            padding: "10px 22px", borderRight: "1px solid var(--rc-border)", background: feed ? "transparent" : "rgba(245,178,61,.06)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".12em" }}>{t("Pozisyon")}</span>
              <i style={staleDot} />
            </span>
            <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, lineHeight: .95,
              fontSize: "clamp(30px,3.2vw,44px)", color: feed ? "var(--rc-text)" : "var(--rc-border-strong)" }}>
              {feed ? `P${live.own.position}` : "—"}
              {feed && st.carClass && <span style={{ fontSize: ".45em", color: classAccent(st.carClass) || "var(--rc-cls-gt3)" }}> · {st.carClass.toUpperCase()}{ownClassPos != null ? ` ${ownClassPos}` : ""}</span>}</span>
            <span style={feed ? { display: "none" } : { fontSize: 11, color: "var(--rc-warn)" }}>{t("köprü verisi yok")}</span>
          </div>
          <div style={{ flex: .7, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4,
            padding: "10px 22px", borderRight: "1px solid var(--rc-border)", background: feed ? "transparent" : "rgba(245,178,61,.06)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".12em" }}>{t("Enerji")}</span>
              <i style={staleDot} />
            </span>
            <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontVariantNumeric: "tabular-nums",
              lineHeight: .95, fontSize: "clamp(26px,2.6vw,36px)", color: feed ? "var(--rc-ok)" : "var(--rc-border-strong)" }}>
              {feed ? `${Math.round(live.own.virtualEnergy)}%` : "—"}</span>
            <div style={{ height: 3, borderRadius: 2, background: "var(--rc-line-soft)", overflow: "hidden" }}>
              <i style={{ display: "block", height: "100%", width: feed ? `${Math.max(0, Math.min(100, live.own.virtualEnergy))}%` : "100%",
                background: feed ? "var(--rc-ok)" : "repeating-linear-gradient(90deg,#4A2F38 0 6px,transparent 6px 12px)" }} /></div>
            <span style={feed ? { display: "none" } : { fontSize: 11, color: "var(--rc-warn)" }}>{t("son değer yok")}</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "stretch",
          gap: 7, padding: "10px 18px", borderLeft: "1px solid var(--rc-border)" }}>
          <span style={{ position: "relative", display: "flex" }}>
            <button onClick={() => setBridgePopOpen((v) => !v)} title={t("Köprü durumu ve kaydı")} data-tour="topbar-bridge"
              style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11,
                fontFamily: "var(--rc-font-display)", letterSpacing: ".04em", padding: "5px 11px", borderRadius: 8,
                border: `1px solid ${bLive ? "rgba(55,214,122,.5)" : "var(--rc-border)"}`, background: "transparent",
                textTransform: "uppercase", color: bLive ? "var(--rc-ok)" : "var(--rc-text-3)", whiteSpace: "nowrap", cursor: "pointer" }}>
              <i style={{ width: 8, height: 8, borderRadius: "50%", background: bDot,
                boxShadow: bLive ? "0 0 8px var(--rc-ok)" : "none", animation: bLive ? "rcpulse 1.2s ease-in-out infinite" : "none" }} />
              {bLive ? t("canlı") : feedFresh ? t("gecikmeli") : t("bağlı değil")}{age != null && (bLive || feedFresh) ? ` · ${age}s` : ""} <span style={{ opacity: .6 }}>▾</span>
            </button>
            {bridgePopOpen && (
              <span style={{ position: "absolute", right: 0, top: "calc(100% + 9px)", zIndex: 70, width: 320,
                background: "var(--rc-surface)", border: "1px solid var(--rc-border-strong)", borderRadius: 13,
                boxShadow: "0 16px 44px rgba(0,0,0,.55)", display: "block", overflow: "hidden", textAlign: "left",
                textTransform: "none", letterSpacing: 0, color: "var(--rc-text)", fontFamily: "var(--rc-font-ui)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 9, padding: "13px 16px", borderBottom: "1px solid var(--rc-border)" }}>
                  <span style={{ fontSize: 15 }}><Icon name="kopru" size={15} /></span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 15, letterSpacing: ".03em" }}>{t("Canlı köprü")}</b>
                    <span style={{ fontSize: 10.5, color: "var(--rc-text-3)" }}>{t("otomatik")} · v{bVer}</span>
                  </span>
                  <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10,
                    textTransform: "uppercase", letterSpacing: ".09em", padding: "3px 9px", borderRadius: 99,
                    border: `1px solid ${bDot}`, color: bDot }}>
                    <i style={{ width: 7, height: 7, borderRadius: "50%", background: bDot }} />{bLive ? t("çalışıyor") : t(bPhase)}
                  </span>
                </span>
                <span style={{ display: "block", padding: "12px 16px", borderBottom: "1px solid var(--rc-border)" }}>
                  {[
                    [t("Canlı kaynak"), bWriter || "—", "var(--rc-text)"],
                    [t("Kare hızı"), bridge?.hz ? `${bridge.hz} Hz` : "—", "var(--rc-text)"],
                    [t("Son kare"), age != null ? `${age} sn önce` : "—", age != null && age < 5 ? "var(--rc-ok)" : "var(--rc-text)"],
                    [t("Sahadaki araç"), String(bridge?.diag?.cars ?? (live?.field?.length || "—")), "var(--rc-text)"],
                  ].map(([k, v, col]) => (
                    <span key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "3px 0", fontSize: 11.5 }}>
                      <span style={{ color: "var(--rc-text-3)" }}>{k}</span>
                      <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 11.5, color: col }}>{v}</b>
                    </span>
                  ))}
                </span>
                {wasted?.wastedFps > 0 && wasted.suggest != null && (
                  <span style={{ display: "block", padding: "11px 16px", borderBottom: "1px solid var(--rc-border)" }}>
                    <span style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 11, color: "var(--rc-warn)", lineHeight: 1.55 }}>
                      <span style={{ flex: "0 0 auto" }}><Icon name="simsek" size={13} /></span>
                      <span>{t("Oyun eklentisi saniyede")} ~{wasted.wastedFps} {t("kez bu uygulamanın okumadığı veriyi yazıyor")} — {t("oyunda takılma yapar.")}
                        <b style={{ display: "block", marginTop: 4, fontFamily: "var(--rc-font-display)", fontSize: 10.5, color: "var(--rc-text)" }}>UnsubscribedBuffersMask: {wasted.suggest}</b>
                      </span>
                    </span>
                    <button onClick={() => navigator.clipboard?.writeText(String(wasted.suggest))}
                      style={{ marginTop: 8, padding: "5px 11px", borderRadius: 8, border: "1px solid var(--rc-border)",
                        background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 11 }}>{t("Değeri kopyala")}</button>
                  </span>
                )}
                {canEdit && curTeam && curRace && (
                  <span style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 16px" }}>
                    <button onClick={async () => {
                        if (!(await confirmDialog({ title: t("Tur geçmişini temizle"), message: t("Bu yarışın tüm '+' tur geçmişi silinsin mi? (Yeni turlar yine kaydedilir.)"), confirmText: t("Temizle"), danger: true }))) return;
                        try { await liveHistoryClearAll(curTeam, curRace); } catch { /* yoksay */ }
                      }}
                      style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--rc-border)",
                        background: "var(--rc-surface-3)", color: "var(--rc-text)", cursor: "pointer", fontSize: 11.5 }}><Icon name="sil" size={13} /> {t("Tur geçmişini temizle")}</button>
                  </span>
                )}
              </span>
            )}
            <button onClick={openCoach} title={t("Bu ekranın rehberi")}
              style={{ flex: "0 0 auto", marginLeft: 6, width: 26, height: 26, borderRadius: 8, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontFamily: "var(--rc-font-display)", fontSize: 14, fontWeight: 700, lineHeight: 1 }}>?</button>
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <button onClick={() => setSideOpen((v) => !v)}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "6px 12px",
                borderRadius: 8, border: `1px solid ${sideOpen ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
                background: sideOpen ? "rgba(150,0,24,.24)" : "var(--rc-surface-3)", color: "var(--rc-text)",
                cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}><Icon name="ayar" size={14} /> {t("Yarış datası")}</button>
            <button onClick={() => setPitboard(true)}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "6px 12px",
                borderRadius: 8, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text)",
                cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}><Icon name="pit-tabela" size={14} /> {t("Pit Board")}</button>
          </div>
        </div>
      </header>
        );
      })()}

      {pitboard && (() => {
        const cap = { color: "var(--rc-text-3)", fontSize: "clamp(11px,1.3vw,16px)", textTransform: "uppercase", letterSpacing: ".16em" };
        const centerMsg = (title, sub, col) => (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 24, textAlign: "center" }}>
            <div style={cap}>{title}</div>
            {sub && <div style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: "clamp(48px,10vw,120px)", lineHeight: .9, color: col || "var(--rc-text)", fontVariantNumeric: "tabular-nums" }}>{sub}</div>}
          </div>
        );
        return (
        <div className="rc" role="dialog" aria-modal="true"
          style={{ position: "fixed", inset: 0, zIndex: 1200, background: "var(--rc-bg)", display: "flex", flexDirection: "column", color: "var(--rc-text)" }}>
          {/* başlık */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 24px", borderBottom: "1px solid var(--rc-line-soft)", flexWrap: "wrap" }}>
            <img src={`${ASSET}logo.png`} alt="" style={{ height: 34 }} />
            <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 20, letterSpacing: ".03em" }}>{trackName(st.track) || t("Yarış")}</span>
            {liveInfo.status === "live" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, textTransform: "uppercase", letterSpacing: ".12em", padding: "4px 12px", borderRadius: 99, border: "1px solid var(--rc-ok)", color: "var(--rc-ok)" }}>
                <i style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--rc-ok)", boxShadow: "0 0 8px var(--rc-ok)", animation: "rcpulse 1.2s ease-in-out infinite" }} />{t("canlı")}</span>
            )}
            {liveInfo.driver && <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 15, color: "var(--rc-text-3)" }}>{liveInfo.driver}</span>}
            <button onClick={() => setPitboard(false)} style={{ marginLeft: "auto", width: 42, height: 42, borderRadius: 11, border: "1px solid var(--rc-border)", background: "var(--rc-surface-2)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 19 }}>✕</button>
          </div>

          {liveInfo.status === "pre" && centerMsg(t("Start'a"), startCountdown(liveInfo), "var(--rc-warn)")}
          {liveInfo.status === "done" && centerMsg("🏁", null)}
          {liveInfo.status === "idle" && centerMsg(t("Yarış zamanı ayarlanmadı"), null) }
          {liveInfo.status === "idle" && <div style={{ textAlign: "center", color: "var(--rc-text-3)", fontSize: 14, marginTop: -30, paddingBottom: 30 }}>{t("Pilotlar sekmesinden başlangıç zamanını gir")}</div>}

          {liveInfo.status === "live" && (() => {
            const pitTotal = liveInfo.phaseEnd - liveInfo.stintStartMs;
            const pitFrac = pitTotal > 0
              ? Math.min(1, Math.max(0, (pitTotal - liveInfo.nextPitIn) / pitTotal)) : 0;
            const raceFrac = liveInfo.raceMs > 0
              ? Math.min(1, Math.max(0, liveInfo.elapsed / liveInfo.raceMs)) : 0;
            const nextTyres = upcomingPit ? TY.filter((_, i) => upcomingPit.tyres[i]) : [];
            return (<>
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "clamp(20px,4vw,64px)", padding: "clamp(16px,3vh,40px) 24px" }}>
              {/* sol: sıradaki pit halkası */}
              <div style={{ textAlign: "center" }}>
                <div style={cap}>{liveInfo.phase === "pit" ? t("Pit Çıkışı") : onLastStint ? t("Bayrağa") : t("Sıradaki pit")}</div>
                <div style={{ display: "grid", placeItems: "center", marginTop: 10 }}>
                  <Ring value={pitFrac} size={300} thickness={20} fs={90} glow color="var(--rc-warn)"
                    big={fmtHMS(liveInfo.nextPitIn / 1000)} />
                  <div style={{ color: "var(--rc-text-3)", fontSize: "clamp(11px,1.2vw,15px)", textTransform: "uppercase", letterSpacing: ".14em", marginTop: 6 }}>{t("stint")} {liveInfo.stintIdx + 1} / {racePlan.fullStints}</div>
                </div>
              </div>

              {/* sağ: bayrağa kalan + kartlar */}
              <div style={{ display: "flex", flexDirection: "column", gap: "clamp(14px,2.4vh,28px)", minWidth: "min(420px,90vw)" }}>
                <div>
                  <div style={cap}>{t("Bayrağa kalan")}</div>
                  <div style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: "clamp(52px,7.5vw,104px)", lineHeight: .92, fontVariantNumeric: "tabular-nums" }}>{fmtHMS(liveInfo.remaining / 1000)}</div>
                  <div style={{ height: 8, borderRadius: 4, background: "var(--rc-surface-3)", overflow: "hidden", marginTop: 10 }}>
                    <i style={{ display: "block", height: "100%", width: `${Math.round(raceFrac * 100)}%`, background: "var(--rc-brand)" }} /></div>
                  <div style={{ color: "var(--rc-text-3)", fontSize: "clamp(11px,1.2vw,15px)", marginTop: 6 }}>%{Math.round(raceFrac * 100)} {t("tamamlandı")}</div>
                </div>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {(liveInfo.driver || liveInfo.nextDriver) && (
                    <div style={{ flex: "1 1 190px", border: "1px solid var(--rc-border)", borderRadius: 14, background: "var(--rc-surface)", padding: "14px 18px" }}>
                      <div style={{ color: "var(--rc-text-3)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".14em" }}>{t("Pilot değişimi")}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: "clamp(20px,2.4vw,30px)" }}>
                        {liveInfo.driver || "?"} <span style={{ color: "var(--rc-brand-bright)" }}>→</span> {liveInfo.nextDriver || "?"}</div>
                    </div>
                  )}
                  {upcomingIsLast && (
                    <div style={{ flex: "1 1 150px", border: "1px solid rgba(55,214,122,.35)", borderRadius: 14, background: "rgba(55,214,122,.07)", padding: "14px 18px" }}>
                      <div style={{ color: "var(--rc-text-3)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".14em" }}><Icon name={fv.hasVE ? "simsek" : "yakit"} size={13} /> {fv.hasVE ? t("Son pit VE") : t("Son pit yakıt")}</div>
                      <div style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: "clamp(20px,2.4vw,30px)", color: "var(--rc-ok)", marginTop: 6 }}>{fv.hasVE ? `${planLsf.refuel.toFixed(1)}%` : `${planLsf.refuelL.toFixed(1)} L`}</div>
                    </div>
                  )}
                </div>

                {/* pit işaretlendi bloğu */}
                {liveInfo.lastDev != null && (
                  <div style={{ border: "1px solid var(--rc-ok)", borderRadius: 14, background: "rgba(55,214,122,.08)", padding: "16px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: "clamp(17px,2vw,24px)", color: "var(--rc-ok)" }}><Icon name="onay" size={18} /> P{liveInfo.lastPitIdx + 1} {t("işaretlendi")}</span>
                      <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--rc-text-3)", textTransform: "uppercase", letterSpacing: ".1em" }}>{fmtClock(st.actualPits[liveInfo.lastPitIdx])}</span>
                    </div>
                    <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 10, fontFamily: "var(--rc-font-display)", fontSize: "clamp(13px,1.5vw,16px)" }}>
                      <span style={{ color: "var(--rc-text-3)" }}>{t("Plan")} <b style={{ color: "var(--rc-text)" }}>{fmtClock(liveInfo.plannedPitStart[liveInfo.lastPitIdx])}</b></span>
                      <span style={{ color: "var(--rc-text-3)" }}>{t("Gerçek")} <b style={{ color: "var(--rc-text)" }}>{fmtClock(st.actualPits[liveInfo.lastPitIdx])}</b></span>
                      <span style={{ color: "var(--rc-text-3)" }}>{t("Sapma")} <b style={{ color: Math.abs(liveInfo.lastDev) > 60000 ? "var(--rc-warn)" : "var(--rc-ok)" }}>{fmtDev(liveInfo.lastDev)}</b></span>
                    </div>
                    {canEdit && liveInfo.pitsDone > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(55,214,122,.25)" }} onClick={(e) => e.stopPropagation()}>
                        {(st.actualPits || []).map((v, i) => Number.isFinite(v) ? (
                          <span key={i} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 15, width: 30 }}>P{i + 1}</b>
                            <span style={{ fontSize: 12, color: "var(--rc-text-3)" }}><Icon name="somun" size={14} /> {t("Tamir süresi")}</span>
                            <input type="number" min="0" step="1" value={(st.pitRepairs || [])[i] || ""} placeholder="0"
                              onChange={(e) => setRepair(i, e.target.value)}
                              style={{ width: 74, background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 9, color: "var(--rc-text)", padding: "7px 10px", fontFamily: "var(--rc-font-display)", fontSize: 14, textAlign: "right" }} />
                            <span style={{ fontSize: 12, color: "var(--rc-text-3)" }}>{t("sn")}</span>
                            {(Number((st.pitRepairs || [])[i]) || 0) > 0 && <span style={{ fontSize: 11.5, color: "var(--rc-warn)" }}>+{Number(st.pitRepairs[i])}s {t("plana eklendi")}</span>}
                          </span>
                        ) : null)}
                      </div>
                    )}
                  </div>
                )}

                {pitMismatch && (
                  <div style={{ color: "var(--rc-warn)", fontSize: 13 }}><Icon name="uyari" size={14} /> {t("oyunda")} {pitMismatch.game} {t("pit")}, {t("planda")} {pitMismatch.marked} {t("işaretli")}</div>
                )}

                {/* sıradaki pitte */}
                {upcomingPit && !racePlan.rows[liveInfo.stintIdx]?.isLast && (
                  <div>
                    <div style={{ color: "var(--rc-text-3)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 8 }}>{t("Sıradaki pitte")}</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {upcomingPit.fuel && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 12, border: "1px solid var(--rc-ok)", color: "var(--rc-ok)", background: "rgba(55,214,122,.08)", fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: "clamp(15px,1.8vw,21px)", letterSpacing: ".08em" }}>{fv.hasVE ? <><Bolt size={17} /> VE</> : <><Icon name="yakit" size={17} /> {t("Yakıt")}</>}</span>
                      )}
                      {nextTyres.map((c) => (
                        <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 12, border: "1px solid var(--rc-brand-bright)", color: "var(--rc-brand-bright)", background: "rgba(150,0,24,.12)", fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: "clamp(15px,1.8vw,21px)", letterSpacing: ".08em" }}><Tyre size={17} /> {c}</span>
                      ))}
                      {!upcomingPit.fuel && !nextTyres.length && (
                        <span style={{ display: "inline-flex", alignItems: "center", padding: "9px 18px", borderRadius: 12, border: "1px solid var(--rc-border)", color: "var(--rc-text-3)", fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: "clamp(15px,1.8vw,21px)" }}>{t("Sadece geçiş")}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* alt: canlı senkron çubuğu */}
            {canEdit && (
              <div onClick={(e) => e.stopPropagation()}
                style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "14px 24px", borderTop: "1px solid var(--rc-line-soft)", background: "var(--rc-surface-2)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  <span style={{ color: "var(--rc-text-3)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".12em" }}><Icon name="baglanti" size={13} /> {t("Canlı Senkron")}</span>
                  {[["autoPit", <><Icon name="oto" size={13} /> {t("Oto PIT")}</>, t("Araç pit yoluna girince PIT otomatik işaretlenir (yalnız canlı kaynağı yazan PC tetikler)")],
                    ["autoClock", <><Icon name="kronometre" size={13} /> {t("Oto Saat")}</>, t("Planın geri sayımı oyunun kalan süresinden 5 sn'den fazla kayarsa başlangıç zamanı otomatik hizalanır")]].map(([k, label, tip]) => {
                    const on = liveSyncOpt[k];
                    return (
                      <button key={k} title={tip} onClick={() => setSyncOpt(k, !on)}
                        style={{ padding: "7px 14px", borderRadius: 9, cursor: "pointer", fontSize: 12,
                          border: `1px solid ${on ? "var(--rc-ok)" : "var(--rc-border)"}`,
                          background: on ? "rgba(55,214,122,.12)" : "var(--rc-surface-3)",
                          color: on ? "var(--rc-ok)" : "var(--rc-text-3)" }}>{label}</button>
                    );
                  })}
                </span>
                {drift != null && Math.abs(drift) > 1 && (
                  <span title={t("Plan saati − oyun saati")} style={{ fontSize: 11, padding: "5px 12px", borderRadius: 99, fontFamily: "var(--rc-font-display)",
                    border: `1px solid ${Math.abs(drift) > 5 ? "var(--rc-warn)" : "var(--rc-border)"}`, color: Math.abs(drift) > 5 ? "var(--rc-warn)" : "var(--rc-text-3)" }}><Icon name="kronometre" size={13} /> {drift > 0 ? "+" : ""}{drift}s</span>
                )}
                {lastAuto && Date.now() - lastAuto.at < 120000 && (
                  <span style={{ fontSize: 11, padding: "5px 12px", borderRadius: 99, border: "1px solid var(--rc-ok)", color: "var(--rc-ok)" }}><Icon name="oto" size={13} /> S{lastAuto.stint} {t("otomatik işaretlendi")}</span>
                )}
                <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  {liveInfo.pitsDone > 0 && (<>
                    <button onClick={unmarkPit} style={{ padding: "10px 18px", borderRadius: 11, border: "1px solid var(--rc-warn)", background: "transparent", color: "var(--rc-warn)", cursor: "pointer", fontSize: 13 }}><Icon name="geri-al" size={14} /> {t("Geri al")}</button>
                    <button onClick={resetPits} style={{ padding: "10px 18px", borderRadius: 11, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-3)", cursor: "pointer", fontSize: 13 }}>⟲ {t("Sıfırla")}</button>
                  </>)}
                  {liveInfo.pitsDone < racePlan.rows.length - 1 ? (
                    <button onClick={markPit} disabled={liveInfo.phase === "pit"}
                      title={liveInfo.phase === "pit"
                        ? t("Araç pit yolunda — bu stintin pit'i işaretlendi. Düzeltmek için ↩ Geri Al.")
                        : t("Araç PİT YOLUNA GİRDİĞİ an bas. Pit süresi plandan otomatik eklenir, sonraki stint pit çıkışıyla başlar.")}
                      style={{ padding: "clamp(14px,2vh,20px) clamp(28px,5vw,56px)", borderRadius: 14, fontFamily: "var(--rc-font-display)", fontSize: "clamp(20px,2.6vw,30px)", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase",
                        cursor: liveInfo.phase === "pit" ? "default" : "pointer", opacity: liveInfo.phase === "pit" ? .45 : 1,
                        border: `2px solid ${liveInfo.phase === "pit" ? "var(--rc-border)" : "var(--rc-brand-bright)"}`,
                        background: liveInfo.phase === "pit" ? "var(--rc-surface-3)" : "var(--rc-brand)",
                        color: liveInfo.phase === "pit" ? "var(--rc-text-3)" : "var(--rc-on-brand)" }}>
                      {liveInfo.phase === "pit" ? <><Icon name="yakit" size={20} /> {t("PIT YOLUNDA")}</> : <><Icon name="onay" size={20} /> PIT</>} — S{liveInfo.stintIdx + 1}</button>
                  ) : (
                    <span style={{ color: "var(--rc-ok)", fontFamily: "var(--rc-font-display)", fontSize: "clamp(15px,1.8vw,20px)", fontWeight: 700 }}><Icon name="onay" size={16} /> {t("Tüm pitler yapıldı")}</span>
                  )}
                </span>
              </div>
            )}
          </>);
          })()}
        </div>
        );
      })()}

      {/* YARIŞ·DATA yan paneli yalnız Canlı Timing ve Stint ekranlarında görünür;
          diğer sekmelerde (Dash/Yakıt/Lastik/Pilot/Tele/Setup) gizlenir. */}
      <div className={`grid ${sideOpen && showSide ? "" : "noside"} ${role === "viewer" && curRace ? "viewonly" : ""}`}>
        {showSide && (
          <button className={`sidetoggle ${sideOpen ? "" : "closed"}`}
            onClick={() => setSideOpen(!sideOpen)}
            title={sideOpen ? t("Paneli gizle") : t("Paneli göster")}>
            {sideOpen ? "▶" : "◀"}</button>
        )}
        {/* ================= SOL: DATA ================= */}
        <div className="sidecol">
          <div className="sideinner">{showSide ? dataCards : null}</div>
        </div>

        {/* ================= SAĞ: EKRAN ================= */}
        {/* v2.0: yatay sekme çubuğu kaldırıldı; gezinme sol dikey raya taşındı
            (handoff-spec/ekranlar/00-kabuk.md). Sekme içeriği aşağıda korunuyor. */}
        <div>
          <div id="tabpanel-main" role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={-1}>
          <Suspense fallback={
            <div className="skelwrap" aria-busy="true" aria-label={t("Yükleniyor…")}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skel">
                  <div className="sl w40" /><div className="sl w70" /><div className="sl w55" />
                </div>
              ))}
            </div>}>
          {(tab === "stint" || tab === "code80") && (
            <StintTab tab={tab} mode={mode} t={t} st={st} plan={plan} totalVE={totalVE}
              totalFuelL={totalFuelL} timeline={timeline} liveInfo={liveInfo} pitSoon={pitSoon}
              tyreInfo={tyreInfo} quickTyre={quickTyre} bumpLaps={bumpLaps} clearLaps={clearLaps}
              upStintLap={upStintLap} upStintCons={upStintCons} upTyre={upTyre} upPit={upPit} assignDriver={assignDriver}
              upOvr={upOvr} setRepair={setRepair} />
          )}

          {tab === "dash" && (
            <DashTab t={t} st={st} zoom={zoom} setZoom={setZoom} exportPdf={exportPdf}
              liveInfo={liveInfo} racePlan={racePlan} tyreInfo={tyreInfo} planLsf={planLsf}
              driverPlan={driverPlan} carriedAt={carriedAt} pitSoon={pitSoon} lmuData={lmuData}
              assets={teamData?.assets} />
          )}

          {tab === "setup" && (() => {
            const suCard = { border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)" };
            const suHd = { fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 15, fontWeight: 700 };
            const chip = (on) => ({ padding: "6px 13px", borderRadius: 99, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap",
              border: `1px solid ${on ? "var(--rc-brand-bright)" : "var(--rc-border)"}`, background: on ? "rgba(150,0,24,.22)" : "var(--rc-surface-3)", color: on ? "var(--rc-text)" : "var(--rc-text-2)" });
            const poolTracks = TRACKS.filter((tr) => setups.some((x) => x.track === tr.id));
            // pist bazlı grupla (mevcut süzülmüş suList) — spec'teki grup başlıkları
            const byTrack = {};
            for (const s of suList) (byTrack[s.track || ""] ||= []).push(s);
            const groupIds = Object.keys(byTrack).sort((a, b) => (a === st.track ? -1 : b === st.track ? 1 : (trackName(a) || a).localeCompare(trackName(b) || b)));
            return (
            <div style={{ padding: "2px 0 90px", fontFamily: "var(--rc-font-ui)", animation: "rcin .26s ease-out" }} data-tour="setuptab">
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".06em", fontSize: 22, fontWeight: 700 }}>{t("Setup havuzu")}</h2>
                <span style={{ color: "var(--rc-text-3)", fontSize: 12 }}>{suList.length}/{setups.length} {t("dosya")} · {poolTracks.length} {t("pist")}</span>
                <span style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input type="text" value={suQuery} placeholder={t("Dosya, araç, not ara…")} onChange={(e) => setSuQuery(e.target.value)}
                    style={{ background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 9, color: "var(--rc-text)", fontSize: 13, padding: "8px 12px", width: 220, textTransform: "none" }} />
                  <button onClick={() => setSuUpOpen(true)}
                    style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid var(--rc-brand-bright)", background: "var(--rc-brand)", color: "var(--rc-on-brand)", cursor: "pointer", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}><Icon name="yukle" size={14} /> {t("Setup yükle")}</button>
                </span>
              </div>

              {/* filtre + görünüm + sıralama */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
                <button onClick={() => setSuFTrack("")} style={chip(!suFTrack)}>{t("Tümü")}</button>
                {poolTracks.map((tr) => <button key={tr.id} onClick={() => setSuFTrack(tr.id)} style={chip(suFTrack === tr.id)}>{trackFlag(tr.id)} {tr.name}</button>)}
                <span style={{ width: 1, height: 22, background: "var(--rc-border)" }} />
                {[["", t("Kuru + Wet")], ["dry", <><Icon name="kuru" size={13} /> {t("Kuru")}</>], ["wet", <><Icon name="islak" size={13} /> Wet</>]].map(([v, l]) => <button key={v || "all"} onClick={() => setSuFCond(v)} style={chip(suFCond === v)}>{l}</button>)}
                <button onClick={() => setSuMine((v) => !v)} style={chip(suMine)}><Icon name="kask" size={13} /> {t("Benim")}</button>
                <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                  <span style={{ display: "flex", border: "1px solid var(--rc-border)", borderRadius: 9, overflow: "hidden" }}>
                    <button onClick={() => suView !== "cards" && toggleSuView()} title={t("Kartlar")} style={{ width: 34, height: 30, border: "none", cursor: "pointer", fontSize: 13, background: suView === "cards" ? "rgba(150,0,24,.28)" : "var(--rc-surface-3)", color: suView === "cards" ? "var(--rc-text)" : "var(--rc-text-3)" }}>⊞</button>
                    <button onClick={() => suView === "cards" && toggleSuView()} title={t("Liste")} style={{ width: 34, height: 30, border: "none", borderLeft: "1px solid var(--rc-border)", cursor: "pointer", fontSize: 13, background: suView !== "cards" ? "rgba(150,0,24,.28)" : "var(--rc-surface-3)", color: suView !== "cards" ? "var(--rc-text)" : "var(--rc-text-3)" }}>☰</button>
                  </span>
                  <span style={{ fontSize: 10.5, color: "var(--rc-text-3)", textTransform: "uppercase", letterSpacing: ".09em" }}>{t("Sırala")}</span>
                  {[["lap", t("Tur")], ["date", t("Tarih")], ["uploader", t("Yükleyen")]].map(([k, l]) => (
                    <button key={k} onClick={() => toggleSort(k)} style={chip(suSort.key === k)}>{l}{suSort.key === k ? (suSort.dir === "asc" ? " ▲" : " ▼") : ""}</button>
                  ))}
                </span>
              </div>

              {suDelErr && <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 11, border: "1px solid var(--rc-warn)", background: "rgba(245,178,61,.10)", fontSize: 12.5, color: "var(--rc-warn)" }}><Icon name="uyari" size={14} /> {suDelErr}</div>}

              {!suList.length && (
                <div style={{ border: "1.5px dashed var(--rc-border-strong)", borderRadius: 14, background: "var(--rc-surface-2)", padding: "46px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 11 }}>
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--rc-border-strong)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15.5 4a4.5 4.5 0 0 0-4 6.6L4 18.1 5.9 20l7.5-7.5A4.5 4.5 0 1 0 15.5 4Z" /></svg>
                  <div style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 20 }}>{poolEmptyReason(setups.length, suList.length) === "filtered" ? t("Bu filtreyle setup yok") : t("Henüz setup yok")}</div>
                  <div style={{ fontSize: 12.5, color: "var(--rc-text-3)", lineHeight: 1.7, maxWidth: 420 }}>{poolEmptyReason(setups.length, suList.length) === "filtered" ? t("Filtreleri temizle ya da yeni bir setup yükle — takımdaki herkes görebilir.") : t("Havuza henüz setup eklenmedi. Aşağıdan yüklediğin dosyalar takımda paylaşılır.")}</div>
                  {poolEmptyReason(setups.length, suList.length) === "filtered" && (
                    <button onClick={() => { setSuFTrack(""); setSuFCond(""); setSuFSess(""); setSuQuery(""); setSuMine(false); }} style={{ marginTop: 4, padding: "9px 16px", borderRadius: 10, cursor: "pointer", fontSize: 13, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)" }}>{t("Filtreleri temizle")}</button>
                  )}
                </div>
              )}

              {/* pist gruplu havuz */}
              {suList.length > 0 && groupIds.map((tid) => (
                <div key={tid || "none"} style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid var(--rc-border)" }}>
                    {tid && <img src={`${ASSET}flags/${TRACK_ASSET(tid)}.png`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ width: 24, borderRadius: 3, border: "1px solid var(--rc-border)" }} />}
                    <span style={suHd}>{trackName(tid) || tid || t("Pist yok")}</span>
                    <span style={{ color: "var(--rc-text-3)", fontSize: 12 }}>{byTrack[tid].length} setup</span>
                    {tid && tid === st.track && <span style={{ fontSize: 10.5, padding: "3px 10px", borderRadius: 99, border: "1px solid var(--rc-brand-bright)", color: "var(--rc-brand-bright)" }}>{t("şu anki pist")}</span>}
                  </div>
                  {setupTable(byTrack[tid])}
                </div>
              ))}
              {suHasMore && (
                <div style={{ textAlign: "center", marginTop: 10 }}>
                  <button onClick={loadMoreSetups} style={{ padding: "9px 20px", borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 12.5 }}><Icon name="indir" size={14} /> {t("Daha fazla yükle")}</button>
                </div>
              )}

              {/* Setup yükle — modal */}
              {suUpOpen && (
                <div onClick={() => setSuUpOpen(false)} role="dialog" aria-modal="true"
                  style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,6,10,.78)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "rcfade .18s ease" }}>
                  <div onClick={(e) => e.stopPropagation()}
                    style={{ width: "min(760px,96vw)", maxHeight: "90vh", display: "flex", flexDirection: "column", background: "var(--rc-surface)", border: "1px solid var(--rc-border-strong)", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,.6)", animation: "rcpop .22s cubic-bezier(.2,.9,.3,1.05)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 20px", borderBottom: "1px solid var(--rc-border)" }}>
                      <span style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".07em", fontSize: 18, fontWeight: 700 }}>{t("Setup yükle")}</span>
                      <span style={{ fontSize: 12, color: "var(--rc-text-3)", marginRight: "auto" }}>{t(".svm dosyası · havuz tüm takımlara açık")}</span>
                      <button onClick={() => setSuUpOpen(false)} style={{ width: 31, height: 31, borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>✕</button>
                    </div>
                    <div style={{ padding: "18px 20px", overflowY: "auto" }}>
                      {setupForm(() => setSuUpOpen(false))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            );
          })()}

          {tab === "live" && <LiveTab t={t} live={live} liveFuelObs={liveFuelObs}
            lapCapture={lapCapture}
            bridge={bridge} canEdit={canEditTeam} canBridge={isMember} tid={curTeam} rid={curRace}
            isAdmin={isAdmin}
            ownTopSrc={carImageSrc(teamData?.assets, st.carClass, st.car, "top")} />}

          {tab === "tyre" && (
            <TyreTab t={t} st={st} up={up} tyreInfo={tyreInfo} racePlan={racePlan}
              carriedAt={carriedAt} upTyreCell={upTyreCell} quickTyre={quickTyre}
              qsel={qsel} setQsel={setQsel} QSEL_LBL={QSEL_LBL} clearTyres={clearTyres} />
          )}

          {tab === "drivers" && (
            <DriversTab t={t} st={st} up={up} driverPlan={driverPlan}
              fmtClock={fmtClock} removeDriver={removeDriver} teamDrivers={teamDrivers}
              addPoolDriver={addPoolDriver} assignDriver={assignDriver} teamData={teamData}
              clearAssign={clearAssign} />
          )}

          {tab === "rchat" && raceChan && (
            <div style={{ border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)", overflow: "hidden", display: "flex", flexDirection: "column", animation: "rcin .26s ease-out" }}>
              <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--rc-border)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".06em", fontSize: 17, fontWeight: 700 }}><Icon name="bayrak" size={17} /> {races[curRace]?.name || t("Yarış Sohbeti")}</span>
                <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{t("yarışa özel kanal")}</span>
                <button onClick={toggleChatSound} title={chatSound ? t("Bildirim sesini kapat") : t("Bildirim sesini aç")}
                  style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--rc-text-3)", cursor: "pointer", fontSize: 15 }}>{chatSound ? <Icon name="zil" size={15} /> : <Icon name="zil-kapali" size={15} />}</button>
              </div>
              {chatBody(raceChan, "min(58vh,440px)")}
            </div>
          )}

          {tab === "tele" && (
            <TeleTab t={t} lang={lang} st={st} slot={slot} setSlot={setSlot}
              rawTele={rawTele} setRawTele={setRawTele} doParse={doParse}
              onTeleFile={onTeleFile} parsed={parsed} mapping={mapping}
              setMapping={setMapping} saveMotec={saveMotec} saveSlot={saveSlot}
              loadedSlots={loadedSlots} slotStats={slotStats} up={up}
              apply105Slot={apply105Slot} removeSlot={removeSlot} chartMode={chartMode}
              setChartMode={setChartMode} chartData={chartData} baseSlot={baseSlot}
              toggleLap={toggleLap} cmpMeta={telCmpMeta} cmpA={telCmpA} setCmpA={setTelCmpA}
              cmpB={telCmpB} setCmpB={setTelCmpB} cmpData={telCmpData} cmpBusy={telCmpBusy}
              savedMsg={telSavedMsg} cmpSources={telCmpSources} cmpASrc={telCmpASrc} setCmpASrc={setTelCmpASrc}
              cmpBSrc={telCmpBSrc} setCmpBSrc={setTelCmpBSrc}
              onSaveDuckSetup={user ? saveTeleSetup : null} />
          )}

          {tab === "fuel" && (
            <FuelTab t={t} st={st} up={up} lsf={lsf} autoCd={autoCd}
              setAutoCd={setAutoCd} planLastCd={planLastCd} racePlan={racePlan}
              liveFuelObs={liveFuelObs} applyLiveFuel={applyLiveFuel} canEdit={canEdit} />
          )}
          </Suspense>
          </div>{/* /tabpanel-main */}
        </div>
      </div>{/* /.grid */}
        </div>{/* /kabuk içerik sütunu */}
      </div>{/* /kabuk (shell) */}
    </div>
  );
}
