import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense, Fragment } from "react";
import UpdateBanner from "./UpdateBanner";
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
  availSet, availClear, availSubscribe } from "./storage";
import { processImageFile, IMG_ACCEPT_TYPES } from "./imageUpload";
import { carImageSrc, teamLogoSrc } from "./teamAssets";
import { duckSetupToSvm, textToB64 } from "./setupParse";
import { signInGoogle, signOut, authReady } from "./auth";
import {
  parseHMS, fmtHMS, fmtLap, parseLap, msToLocalInput, isRacePast,
  DEFAULT_STATE, EMPTY_PIT, TYRE_2_SEC, TYRE_4_SEC,
  WEATHER, wxLog, wxAtRel, WX, effCons, tyState,
  computePlan, migrate, lastStintFuel,
} from "./engine";
import {
  normalizeScreen, pushScreen, popScreen, hashForScreen, screenFromHash, showsRaceBar,
} from "./nav";
import { Rail, RaceBar, Guide, EmptyState } from "./shell";
import { guideFor } from "./guides";
import { pruneAssignments } from "./avail";
import {
  SLOT_COLORS, APP_VERSION, APP_VERSION_SUMMARY, SEEN_VER_KEY, ASSET, AV, SUPPORT_EMAIL,
  TRACKS, PIT_LANE_TIMES, TRACK_ASSET,
  CARS, CAR_CLASSES, trackName, carName, carImg, brandLogo, classId, classAccent, venueToTrackId,
  PIE_COLORS, DESKTOP_RELEASE_URL, BRIDGE_EXE_URL,
} from "./constants";
import {
  safeParseState, carriedTyre,
  applyUpPit, applyUpTyre, applyUpOvr, applyBumpLaps, applyClearLaps,
  applyQuickTyre, applyUpStintLap, applyUpTyreCell, applyAssignDriver, applyClearTyres,
  computeTyreInfo, computeDriverPlan,
  computeLiveInfo, buildTimeline,
  applyMarkPit, applyUnmarkPit, applyResetPits,
} from "./state";
import { buildTourSteps } from "./tourSteps";
import { lapDeltas } from "./setupPool";
import {
  TourOverlay, Wheel, Num, Bolt, Tyre, Ring, Icon, Btn, Avatar,
  BADGES, teamBadgesOf, hasBadge, ChatPanel, SetupForm, SetupTable, SetupCards,
  VersionModal, RaceEditModal,
  ChatModal, SetupModal, TeamModal, CreateJoinModal, DenyToast, SetupContentModal, SetupCompareModal,
  CommandPalette,
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
  /* ---------- v2.0 EKRAN YÖNLENDİRMESİ — TEK NOKTA ----------
     v1'de gezinme ikiye bölünmüştü: erken-return zinciri (entered/pickDone/
     setupDone/teleOnly/scheduleOnly) + ayrı bir `tab` state'i. Takım · Sohbet ·
     Telemetri · Setup havuzu modal kabuğundan çıkıp tam sayfa olunca tek bir
     yönlendirme şart oldu.

     `screen` tek kaynak; `go()` history'ye de yazar → tarayıcı geri tuşu ve
     masaüstü (Tauri) AYNI davranır: açık ekranı kapatmak yerine öncekine dönülür.
     Tauri file:// altında pathname değiştirilemediği için hash kullanılır.
     `tab`/`setTab` geri-uyum alias'ı — mevcut çağrı yerleri bozulmaz. */
  const [screen, setScreen] = useState(() =>
    screenFromHash(typeof window === "undefined" ? "" : window.location.hash, "home"));
  const navStack = useRef([screen]);
  const go = useCallback((next) => {
    const s = normalizeScreen(next, "home");
    if (navStack.current[navStack.current.length - 1] === s) return;
    navStack.current = pushScreen(navStack.current, s);
    try { window.history.pushState({ screen: s }, "", hashForScreen(s)); } catch { /* file:// */ }
    setScreen(s);
  }, []);
  const back = useCallback(() => {
    if (navStack.current.length > 1) { try { window.history.back(); return; } catch { /* ignore */ } }
    go("home");
  }, [go]);
  useEffect(() => {
    try { window.history.replaceState({ screen }, "", hashForScreen(screen)); } catch { /* file:// */ }
    const onPop = (e) => {
      const s = normalizeScreen(
        e.state?.screen ?? screenFromHash(window.location.hash), "home");
      navStack.current = popScreen(navStack.current).stack;
      setScreen(s);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    /* yalnız mount — screen'i bağımlılığa koymak her geçişte replaceState eder. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const tab = screen;
  const setTab = go;

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
    import("./i18n").then((m) => { EN_CACHE = m.EN; if (on) setDict(m.EN); });
    return () => { on = false; };
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
  /* Sol ray açık/kapalı — tıklamayla kayarak gizlenir (README "Interactions"). */
  const [railOpen, setRailOpen] = useState(() => {
    try { return localStorage.getItem("crm-rail") !== "0"; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem("crm-rail", railOpen ? "1" : "0"); } catch { /* özel mod */ }
  }, [railOpen]);
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
  /* Bağımsız üst-düzey ekranlar artık ayrı bayrak değil, `screen`den türer —
     böylece geri tuşu ve URL bunlarda da çalışır. */
  const teleOnly = screen === "tele" && !entered;   // Race Solo'dan AYRI telemetri
  const scheduleOnly = screen === "official";        // yarıştan AYRI resmi takvim
  const [pickDone, setPickDone] = useState(false); // pist/araç seçimi tamamlandı mı
  const [setupDone, setSetupDone] = useState(false); // data giriş adımı tamamlandı mı
  const [trackQ, setTrackQ] = useState(""); // pist & araç ekranı: pist arama süzgeci
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
  const openRace = async (rid) => {
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
      go("stint");   // yarış açılınca doğrudan Stint planına gir (Dash değil)
      setTeamOpen(false); setSyncMsg("");
      setTimeout(() => { sync.current.applying = false; }, 60);
    } catch (e) { setSyncMsg(t("Bağlantı hatası: ") + e.message); }
  };

  const leaveRace = () => {
    setCurRace(""); setRole("editor"); setLastSync(null); setSyncMsg("");
    setEntered(false); setPickDone(false); setSetupDone(false);
    go("home");
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
  const TY = ["FL", "FR", "RL", "RR"];

  /* ---------- Faz 3: lastik stratejisi ---------- */
  /* stint bazlı hızlı lastik atama
     FL=0 FR=1 RL=2 RR=3 · fresh: kullanılmamış en küçük numaralar */
  const quickTyre = (rowIdx, action) => edit((s0) => applyQuickTyre(s0, rowIdx, action));

  /* stinte özel ortalama tur süresi (boş → yarış datasındaki ortalama kullanılır) */
  const upStintLap = (i, v) => edit((s0) => applyUpStintLap(s0, i, v));

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
  const [newDriver, setNewDriver] = useState("");
  const addDriver = () => {
    const n = newDriver.trim();
    if (!n || st.roster.includes(n)) return;
    if (blocked()) { showDeny(); return; }
    setSt((s) => ({ ...s, roster: [...s.roster, n] }));
    setNewDriver("");
  };
  const removeDriver = (n) => edit((s) => ({
    ...s,
    roster: s.roster.filter((x) => x !== n),
    driverAssign: s.driverAssign.map((a) => (a === n ? "" : a)),
  }));
  const assignDriver = (i, n) => edit((s0) => applyAssignDriver(s0, i, n));
  const clearAssign = () => edit((s) => ({
    ...s, driverAssign: s.driverAssign.map(() => ""),
  }));

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
  const [teleSt, setTeleSt] = useState(() => ({ ...DEFAULT_STATE }));
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
  const resetPits = () => {
    if (!confirm(t("Gerçek pit işaretlemelerini sıfırla?"))) return;
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
  /* Rapor belgesini KURAR (yazdırmaz) — böylece aynı HTML hem gizli iframe ile
     doğrudan yazdırılabilir hem de A4 önizleme penceresinde gösterilebilir
     (README §16: önizleme + araç çubuğu). autoPrint=false önizleme içindir. */
  const buildReportDoc = (kind, { autoPrint = true } = {}) => {
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
        if (pit.fuel) parts.push(`<span class="svc f">⚡VE</span>`);
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
      if (!driverPlan) { alert(t("Pilotlar sekmesinden başlangıç zamanını gir")); return; }
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
 <div class="bcard"><div class="bt">⚡ ${esc(t("Son Stint VE"))}</div>
  <div class="bv" style="color:#0d7a43">${planLsf.refuel.toFixed(1)}%</div>
  <div class="bv"><span>+${st.extraLap} lap · ≈ ${planLsf.refuelL.toFixed(1)} L</span></div></div>
 ${donutCard}
 ${trackUrl ? `<div class="trackcard"><img src="${trackUrl}" alt="">
  <div class="tcap">${esc(trackName(st.track))}</div></div>` : ""}
</div>`;
    return `<!doctype html><html><head><meta charset="utf-8">
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
${autoPrint ? `<script>window.onload=function(){window.print()}<\/script>` : ""}
</body></html>`;
  };

  /* Doğrudan yazdırma yolu (KORUNDU): yeni pencere yerine GİZLİ iframe —
     WebView2 (masaüstü) popup'ları engelliyor, window.open null dönüyordu.
     iframe'e yazınca içindeki window.onload→print() iframe'i yazdırır. */
  const exportPdf = (kind) => {
    document.getElementById("pdfframe")?.remove();
    const ifr = document.createElement("iframe");
    ifr.id = "pdfframe";
    ifr.setAttribute("aria-hidden", "true");
    ifr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(ifr);
    const doc = ifr.contentWindow.document;
    doc.open();
    doc.write(buildReportDoc(kind));
    doc.close();
  };

  /* A4 önizleme penceresi (README §16) — Dashboard'daki 🖨 PDF bunu açar.
     Yazdır/PDF indir, önizlemedeki iframe'i yazdırır (tarayıcı diyaloğundan
     "PDF olarak kaydet" seçilir; ayrı bir PDF kütüphanesi eklenmedi). */
  const [pdfDoc, setPdfDoc] = useState(null);
  const openPdfPreview = (kind) =>
    setPdfDoc({ kind, html: buildReportDoc(kind, { autoPrint: false }) });
  const printPreview = () => {
    const f = document.getElementById("pdfpreviewframe");
    try { f?.contentWindow?.focus(); f?.contentWindow?.print(); } catch { /* yoksay */ }
  };
  const pdfPreview = pdfDoc && (
    <div className="wxmodal pdfwrap" onClick={() => setPdfDoc(null)}>
      <div className="pdfbox" onClick={(e) => e.stopPropagation()}>
        <div className="pdftoolbar">
          <span className="ttl disp">🖨 {t("Yarış raporu")}</span>
          <span className="spacer" />
          <button className="rbbtn" onClick={printPreview}>{t("Yazdır")}</button>
          <button className="rbbtn apply" onClick={printPreview}>
            {t("PDF olarak indir")}</button>
          <button className="lbclose" onClick={() => setPdfDoc(null)}>✕</button>
        </div>
        <div className="pdfscroll">
          <iframe id="pdfpreviewframe" className="pdfpage" title={t("Yarış raporu")}
            srcDoc={pdfDoc.html} />
        </div>
      </div>
    </div>
  );
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
  const [barOpen, setBarOpen] = useState(true); // oda katılım çubuğu aç/kapa
  const [sideOpen, setSideOpen] = useState(true); // sol data sidebar aç/kapa
  /* ---- kimlik doğrulama (Google) → useAuth hook'u ---- */
  const { user, authLoading, udoc } = useAuth();
  const [authErr, setAuthErr] = useState("");
  const [authMode, setAuthMode] = useState("in"); // "in" giriş | "up" kayıt
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
  const [adminQ, setAdminQ] = useState("");        // üye yönetimi: arama
  const [adminFilter, setAdminFilter] = useState("all"); // all | pending | allowed
  const [profOpen, setProfOpen] = useState(false);
  /* ---- takımlar ---- */
  const [teamOpen, setTeamOpen] = useState(false);
  const [createJoinOpen, setCreateJoinOpen] = useState(false); // v1.6 — sade Kur & Katıl ekranı (yönetimden ayrı)
  /* ---- takım/sezon/yarış abonelikleri → useTeams hook'u ---- */
  const { myTeams, curTeam, setCurTeam, teamData, seasons, races } = useTeams({ user, access });

  /* ---------- PİLOT MÜSAİTLİĞİ (v2.0) ----------
     teams/{tid}/races/{rid}/avail/{driverId} = [uygun OLMAYAN stintNo…]
     "Yeni veri katmanı yok" kuralının bilinçli tek istisnası. Yarışsız (solo)
     modda yalnız yerel tutulur — yazacak yarış düğümü yok. */
  const [avail, setAvailState] = useState(null);
  useEffect(() => {
    if (!curTeam || !curRace) { setAvailState(null); return undefined; }
    return availSubscribe(curTeam, curRace, setAvailState);
  }, [curTeam, curRace]);

  /* Uygunluk değişince: (a) yalnız DEĞİŞEN pilotu Firebase'e yaz, (b) artık
     geçersiz kalan atamaları temizle (README §8: "mevcut atama otomatik kalkar"). */
  const setAvail = (next) => {
    if (blocked()) { showDeny(); return; }
    const prev = avail || {};
    setAvailState(next);
    if (curTeam && curRace) {
      const keys = new Set([...Object.keys(prev), ...Object.keys(next || {})]);
      keys.forEach((k) => {
        const a = JSON.stringify(prev[k] ?? null);
        const b = JSON.stringify((next || {})[k] ?? null);
        if (a !== b) availSet(curTeam, curRace, k, (next || {})[k] || []).catch(() => {});
      });
    }
    setSt((s0) => {
      const pruned = pruneAssignments(next, s0.driverAssign);
      return pruned === s0.driverAssign ? s0 : { ...s0, driverAssign: pruned };
    });
  };
  const resetAvail = () => {
    if (blocked()) { showDeny(); return; }
    setAvailState(null);
    if (curTeam && curRace) availClear(curTeam, curRace).catch(() => {});
  };

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
  /* ---- rehber turu ---- */
  const [tour, setTour] = useState(null);            // "lobby" | "main" | "live" | null
  /* rehber Canlı adımlarındayken demoyu açar (LiveTab'e prop) — tur kapanınca sıfırlanır */
  const [tourDemo, setTourDemo] = useState(false);
  const TOUR_L = "rm_tour_lobby", TOUR_M = "rm_tour_main";
  const seenTour = (k) => { try { return localStorage.getItem(k) === "1"; } catch { return true; } };
  const markTour = (k) => { try { localStorage.setItem(k, "1"); } catch { /* yoksay */ } };

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
    try { return localStorage.getItem("rm_setup_view") || "cards"; }
    catch { return "cards"; }
  });
  const toggleSuView = () => setSuView((v) => {
    const next = v === "cards" ? "table" : "cards";
    try { localStorage.setItem("rm_setup_view", next); } catch { /* özel mod */ }
    return next;
  });
  /* ⬆ Setup yükle → satır-içi yükleme paneli aç/kapa (fiş: openSu). */
  const [poolUp, setPoolUp] = useState(false);
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
  /* Ana menüde de resmi takvimi yükle → "Resmi yarışlar" fişi gerçek sıradaki
     yarışı + geri sayımı gösterir (kullanıcı onayı). Yarışa girilince kapanır. */
  const lmu = useLmuSchedule({ user, udoc, active: scheduleOnly || (!curRace && !entered) });
  /* Resmi Yarışlar → ön ayar (v1.7.3): bir resmi yarışın 📋 butonu, o yarışın
     pist/sınıf/süre/başlangıcıyla "Yarış Ekle" formunu doldurur ve takvimi kapatır
     → kullanıcı (belirli aracı seçip) Kaydet der → takım yarışı + strateji state
     oluşur (saveRaceForm/createRace). Takım yoksa buton hiç görünmez (curTeam gate). */
  const planOfficialRace = (r) => {
    if (!curTeam) return;
    setRForm(officialRaceToForm(r, {
      seasonId: curSeason || null,
      fallbackRaceTime: DEFAULT_STATE.raceTime,
      classId,
    }));
    back();
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
  const [lobCal, setLobCal] = useState("up");        // menü takvim segmenti: Yaklaşan/Geçmiş
  const [homeInfo, setHomeInfo] = useState(false);   // menü top bar: ℹ bilgi açılırı
  const [homeAcct, setHomeAcct] = useState(false);   // menü top bar: hesap açılırı
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
    unreadOf, chatUnread, raceUnread } = useChat({
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
      canManage={canManageTeam}
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
  const setupForm = () => (
    <SetupForm t={t} onSetupFile={onSetupFile} onSetupDrop={onSetupDrop}
      suFile={suFile} suMeta={suMeta}
      setSuMeta={setSuMeta} seasons={seasons} suErr={suErr} suMsg={suMsg} suBusy={suBusy}
      saveSetup={saveSetup} />
  );

  /* Silme hatası eskiden yutuluyordu (.catch(()=>{})) → kural reddi/ağ hatasında
     satır ekranda kalıyor, kullanıcı sebebini göremiyordu. Tablo + kart ortak. */
  const onDeleteSetup = (su) => {
    if (!window.confirm(t("Bu setup silinsin mi?") + "\n" + (su.name || ""))) return;
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

  /* ⚖ alt-sabit karşılaştırma tepsisi (fiş 09: trayStyle/trayText) — seçim varken
     görünür; 2 seçilince ⚖ Karşılaştır aktif. Konum sabit olduğundan kabuk
     seviyesinde durması davranışı korur (tüm ekranlarda çalışır). */
  const cmpA = setups.find((x) => x.id === cmpSel[0]) || null;
  const cmpB = setups.find((x) => x.id === cmpSel[1]) || null;
  const cmpReady = !!(cmpA && cmpB);
  const cmpBar = cmpSel.length > 0 && !cmpOpen && (
    <div style={{ position: "fixed", left: "50%", bottom: 20, transform: "translateX(-50%)",
      zIndex: 40, display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
      borderRadius: 12, background: "var(--rc-surface-2)", border: "1px solid var(--rc-brand-bright)",
      boxShadow: "0 8px 30px rgba(0,0,0,.45)" }}>
      <span style={{ fontSize: 12, color: "var(--rc-text-2)" }}>
        {cmpSel.length} {t("setup seçili")}
        {cmpSel.length === 1 ? " · " + t("bir tane daha seç") : ""}</span>
      <button disabled={!cmpReady} onClick={() => setCmpOpen(true)}
        style={{ padding: "7px 16px", borderRadius: 9, border: "1px solid var(--rc-brand-bright)",
          background: "var(--rc-brand)", color: "var(--rc-on-brand)",
          cursor: cmpReady ? "pointer" : "default", fontSize: 13, fontWeight: 600,
          opacity: cmpReady ? 1 : 0.5 }}>⚖ {t("Karşılaştır")}</button>
      <button onClick={() => setCmpSel([])}
        style={{ padding: "7px 12px", borderRadius: 9, border: "1px solid var(--rc-border)",
          background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer",
          fontSize: 13 }}>{t("Temizle")}</button>
    </div>
  );

  /* ── Setup havuzu ekranı (fiş 09-setup-havuzu.md) — birebir markup. Kabuk +
     süzgeç çipleri + görünüm/sıralama + pist bazlı gruplar (liste & kart) + boş
     durum. Satır/kart sunumu burada satır-içi; SetupTable/SetupCards (lobi
     penceresi + render testleri) el değmeden korunur. Veri/handler'lar aynı
     (useSetups + cmp seçimi). */
  const setupScreen = () => {
    const disp = "var(--rc-font-display)";
    const hideImg = (e) => { e.currentTarget.style.display = "none"; };
    const hasFile = (su) => !!(su?.data || su?.hasBlob);
    const stop = (e) => e.stopPropagation();
    const poolCards = suView === "cards";
    const gridCols = "26px minmax(120px,1.2fr) 96px 1fr 92px 88px 168px";
    const colLbl = { color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase",
      letterSpacing: ".09em" };
    const actBtn = { padding: "4px 10px", borderRadius: 7, border: "1px solid var(--rc-border)",
      background: "var(--rc-surface-3)", color: "var(--rc-text)", cursor: "pointer", fontSize: 11 };
    const upBtn = { border: "1px solid var(--rc-brand-bright)", background: "var(--rc-brand)",
      color: "var(--rc-on-brand)", cursor: "pointer", fontWeight: 600 };
    const chipStyle = (active) => ({ padding: "6px 12px", borderRadius: 99, cursor: "pointer",
      fontSize: 11.5, border: `1px solid ${active ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
      background: active ? "rgba(150,0,24,.22)" : "var(--rc-surface-3)",
      color: active ? "var(--rc-text)" : "var(--rc-text-3)" });
    const verChip = { fontSize: 10, padding: "1px 6px", borderRadius: 6, flex: "0 0 auto",
      border: "1px solid var(--rc-border)", color: "var(--rc-text-3)",
      fontFamily: "var(--rc-font-mono)", whiteSpace: "nowrap" };
    const cmpChip = { display: "inline-flex", alignItems: "center", fontSize: 11, padding: "3px 8px",
      borderRadius: 99, border: "1px solid var(--rc-brand-bright)", color: "var(--rc-brand-bright)",
      whiteSpace: "nowrap" };
    const condChip = { display: "inline-flex", alignItems: "center", fontSize: 11, padding: "3px 9px",
      borderRadius: 99, border: "1px solid var(--rc-border)", color: "var(--rc-text-2)",
      whiteSpace: "nowrap" };
    /* Görünüm segmenti (fiş: viewCardsBtn/viewListBtn). */
    const viewCardsBtn = { width: 34, height: 30, border: "none", cursor: "pointer", fontSize: 13,
      background: poolCards ? "rgba(150,0,24,.28)" : "var(--rc-surface-3)",
      color: poolCards ? "var(--rc-text)" : "var(--rc-text-3)" };
    const viewListBtn = { width: 34, height: 30, border: "none", cursor: "pointer", fontSize: 13,
      borderLeft: "1px solid var(--rc-border)",
      background: poolCards ? "var(--rc-surface-3)" : "rgba(150,0,24,.28)",
      color: poolCards ? "var(--rc-text-3)" : "var(--rc-text)" };
    const setPoolView = (mode) => setSuView((v) => {
      if (v === mode) return v;
      try { localStorage.setItem("rm_setup_view", mode); } catch { /* özel mod */ }
      return mode;
    });

    /* Süzgeç çipleri — mevcut süzgeç state'ine (cond/sess/mine) bağlı; fişteki
       tekil poolFilter yerine çok boyutlu süzgeç korunur. */
    /* Fiş (09-setup-havuzu.png) çip sırası: Tüm pistler · Şu anki pist · Kuru ·
       Wet · Yarış · Benim setuplarım. "Şu anki pist" yalnız yüklü yarışın pisti
       varken görünür (o piste süzer). */
    const filterChips = [
      { label: t("Tüm pistler"), active: !suFCond && !suFSess && !suMine && !suFTrack,
        pick: () => { setSuFCond(""); setSuFSess(""); setSuMine(false); setSuFTrack(""); } },
      ...(st.track ? [{ label: t("Şu anki pist"), active: suFTrack === st.track,
        pick: () => setSuFTrack((v) => (v === st.track ? "" : st.track)) }] : []),
      { label: `☀️ ${t("Kuru")}`, active: suFCond === "dry",
        pick: () => setSuFCond((v) => (v === "dry" ? "" : "dry")) },
      { label: `🌧 ${t("Wet")}`, active: suFCond === "wet",
        pick: () => setSuFCond((v) => (v === "wet" ? "" : "wet")) },
      { label: t("Yarış"), active: suFSess === "R",
        pick: () => setSuFSess((v) => (v === "R" ? "" : "R")) },
      { label: `👤 ${t("Benim setuplarım")}`, active: suMine,
        pick: () => setSuMine((v) => !v) },
    ];
    /* Sıralama çipleri (fiş: sortChips) — mevcut toggleSort'a bağlı. "by"
       (Yükleyen) veri katmanında yok → tarih sırasına düşer (bkz. rapor). */
    const sortDefs = [
      { id: "lap", label: t("Tur") },
      { id: "date", label: t("Tarih") },
      { id: "by", label: t("Yükleyen") },
    ];

    const deltas = lapDeltas(suList);
    const groupMap = new Map();
    for (const s of suList) {
      const k = s.track || "";
      if (!groupMap.has(k)) groupMap.set(k, []);
      groupMap.get(k).push(s);
    }
    const groups = [...groupMap.entries()];
    const poolEmpty = suList.length === 0;
    const trackCount = new Set(suList.map((s) => s.track).filter(Boolean)).size;

    const fmtDate = (at) => new Date(at || 0).toLocaleDateString(
      lang === "en" ? "en-GB" : "tr-TR", { day: "2-digit", month: "2-digit", year: "2-digit" });
    const lapText = (su) => {
      if (!su.lap) return "—";
      const sec = parseLap(su.lap);
      return sec > 0 ? fmtLap(sec) : su.lap;
    };
    const lapColor = (su) => (!su.lap ? "var(--rc-text-3)"
      : deltas.get(su.id)?.fastest ? "var(--rc-ok)" : "var(--rc-text)");
    const condLabel = (su) => `${su.cond === "wet" ? "🌧" : "☀️"} ${su.sess === "Q" ? "Q" : "R"}`;
    const metaLine = (su) => [su.champ, su.note].filter(Boolean).join(" · ");

    const listRow = (su) => {
      const file = hasFile(su);
      const selected = cmpSel.includes(su.id);
      const here = su.track === st.track;
      return (
        <div key={su.id} onClick={file ? () => cmpToggle(su) : undefined}
          style={{ display: "grid", gridTemplateColumns: gridCols, gap: 10, alignItems: "center",
            padding: "8px 12px", borderBottom: "1px solid var(--rc-border)",
            cursor: file ? "pointer" : "default",
            background: selected ? "rgba(150,0,24,.22)" : here ? "rgba(150,0,24,.08)" : "transparent" }}>
          {/* Favori (★) kalıcılığı backend'de yok → grid hizası için boş hücre. */}
          <span />
          <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
              <b style={{ fontFamily: disp, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden",
                textOverflow: "ellipsis" }}>{su.name}</b>
              {su.ver && <span style={verChip}>{su.ver}</span>}
            </span>
            {metaLine(su) && <span style={{ fontSize: 10.5, color: "var(--rc-text-3)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{metaLine(su)}</span>}
          </span>
          <span style={{ display: "flex", justifyContent: "flex-start" }}>
            <span style={condChip}>{condLabel(su)}</span></span>
          <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
            {su.car && brandLogo(carName(su.cls, su.car)) && (
              <img src={brandLogo(carName(su.cls, su.car))} alt="" onError={hideImg}
                style={{ height: 17, width: 17, objectFit: "contain", flex: "0 0 auto" }} />)}
            {su.cls && <img src={`${ASSET}class/${su.cls}.png`} alt="" onError={hideImg}
              style={{ height: 14, flex: "0 0 auto" }} />}
            <span style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden",
              textOverflow: "ellipsis" }}>{carName(su.cls, su.car) || "—"}</span>
          </span>
          <b style={{ fontFamily: disp, fontSize: 17, fontWeight: 700, textAlign: "right",
            color: lapColor(su) }}>{lapText(su)}</b>
          <span style={{ fontSize: 11, color: "var(--rc-text-3)", whiteSpace: "nowrap",
            overflow: "hidden", textOverflow: "ellipsis" }}>{su.uname || "—"} · {fmtDate(su.at)}</span>
          <span style={{ display: "flex", gap: 6, justifyContent: "flex-end", width: 168 }}>
            {selected && <span style={cmpChip}>⚖</span>}
            {file && <button onClick={(e) => { stop(e); setViewSu(su); }} style={actBtn}>
              {t("İçerik")}</button>}
            <button onClick={(e) => { stop(e); downloadSetup(su); }} style={actBtn}>{t("İndir")}</button>
            {isAdmin && <button onClick={(e) => { stop(e); onDeleteSetup(su); }}
              style={{ ...actBtn, color: "var(--rc-danger)" }} title={t("Sil")}>✕</button>}
          </span>
        </div>
      );
    };

    const card = (su) => {
      const file = hasFile(su);
      const selected = cmpSel.includes(su.id);
      const carPng = carImg(su.cls, su.car);
      return (
        <div key={su.id} onClick={file ? () => cmpToggle(su) : undefined}
          style={{ position: "relative", overflow: "hidden", borderRadius: 14,
            border: `1px solid ${selected ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
            background: "var(--rc-surface-2)", padding: "16px 18px",
            cursor: file ? "pointer" : "default" }}>
          {su.track && <img src={`${ASSET}tracks/${TRACK_ASSET(su.track)}.png`} alt="" onError={hideImg}
            style={{ position: "absolute", right: -10, top: -10, width: 150, opacity: 0.06,
              pointerEvents: "none", filter: "grayscale(1)" }} />}
          {carPng && <img src={carPng} alt="" onError={hideImg}
            style={{ position: "absolute", right: 8, bottom: 8, height: 44, opacity: 0.16,
              pointerEvents: "none" }} />}
          <div style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
              <span style={{ fontFamily: disp, fontWeight: 700, fontSize: 36, lineHeight: 0.95,
                color: lapColor(su), fontVariantNumeric: "tabular-nums" }}>{lapText(su)}</span>
              {metaLine(su) && <span style={{ fontSize: 11, color: "var(--rc-text-3)" }}>
                {metaLine(su)}</span>}
            </div>
            <span style={condChip}>{condLabel(su)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, minWidth: 0 }}>
            {su.car && brandLogo(carName(su.cls, su.car)) && (
              <img src={brandLogo(carName(su.cls, su.car))} alt="" onError={hideImg}
                style={{ height: 20, width: 20, objectFit: "contain" }} />)}
            {su.cls && <img src={`${ASSET}class/${su.cls}.png`} alt="" onError={hideImg}
              style={{ height: 16 }} />}
            <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis",
              whiteSpace: "nowrap" }}>{carName(su.cls, su.car) || "—"}</span>
          </div>
          <div style={{ fontFamily: disp, fontSize: 11, color: "var(--rc-text-2)", marginTop: 8,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{su.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, paddingTop: 10,
            borderTop: "1px solid var(--rc-border)" }}>
            <span style={{ fontSize: 11, color: "var(--rc-text-3)" }}>
              {su.uname || "—"} · {fmtDate(su.at)}</span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
              {/* Favori (★) kalıcılığı backend'de yok → buton gizlendi. */}
              {su.ver && <span style={verChip}>{su.ver}</span>}
              {selected && <span style={cmpChip}>⚖ {t("seçili")}</span>}
              {file && <button onClick={(e) => { stop(e); setViewSu(su); }} style={actBtn}>
                {t("İçerik")}</button>}
              <button onClick={(e) => { stop(e); downloadSetup(su); }} style={actBtn}>{t("İndir")}</button>
              {isAdmin && <button onClick={(e) => { stop(e); onDeleteSetup(su); }}
                style={{ ...actBtn, color: "var(--rc-danger)" }} title={t("Sil")}>✕</button>}
            </span>
          </div>
        </div>
      );
    };

    return (
      <div data-tour="setuptab" style={{ padding: "16px 20px 90px", animation: "rcin .26s ease-out" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
          marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontFamily: disp, textTransform: "uppercase", letterSpacing: ".06em",
            fontSize: 22, fontWeight: 700 }}>{t("Setup havuzu")}</h2>
          <span style={{ color: "var(--rc-text-3)", fontSize: 12 }}>
            {suList.length} {t("dosya")} · {trackCount} {t("pist")}</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input type="text" value={suQuery} placeholder={t("Dosya, araç, not ara…")}
              onChange={(e) => setSuQuery(e.target.value)}
              style={{ background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)",
                borderRadius: 9, color: "var(--rc-text)", fontSize: 13, padding: "8px 12px",
                width: 220 }} />
            <button onClick={() => setPoolUp((v) => !v)}
              style={{ ...upBtn, padding: "8px 14px", borderRadius: 9, fontSize: 13 }}>
              ⬆ {t("Setup yükle")}</button>
          </span>
        </div>

        {poolUp && (
          <div style={{ border: "1px solid var(--rc-border)", borderRadius: 12,
            background: "var(--rc-surface)", padding: "14px 16px", marginBottom: 18 }}>
            {setupForm()}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
          marginBottom: 18 }}>
          {filterChips.map((c) => (
            <button key={c.label} onClick={c.pick} style={chipStyle(c.active)}>{c.label}</button>
          ))}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, marginLeft: "auto" }}>
            <span style={{ display: "inline-flex", border: "1px solid var(--rc-border)",
              borderRadius: 9, overflow: "hidden", marginRight: 5 }}>
              <button onClick={() => setPoolView("cards")} style={viewCardsBtn}
                title={t("Kart görünümü")}>⊞</button>
              <button onClick={() => setPoolView("table")} style={viewListBtn}
                title={t("Liste görünümü")}>☰</button>
            </span>
            <span style={{ fontSize: 10.5, color: "var(--rc-text-3)", textTransform: "uppercase",
              letterSpacing: ".09em" }}>{t("Sırala")}</span>
            {sortDefs.map((s) => {
              const active = suSort.key === s.id;
              const arrow = active ? (suSort.dir === "asc" ? " ▲" : " ▼") : "";
              return (
                <button key={s.id} onClick={() => toggleSort(s.id)} style={chipStyle(active)}>
                  {s.label}{arrow}</button>
              );
            })}
          </span>
        </div>

        {suDelErr && (
          <div style={{ marginBottom: 14, fontSize: 12, color: "var(--rc-danger)" }}>⚠ {suDelErr}</div>
        )}

        {poolEmpty && (
          <div style={{ border: "1.5px dashed var(--rc-border-strong)", borderRadius: 14,
            background: "var(--rc-surface-2)", padding: "46px 24px", textAlign: "center",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 11 }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none"
              stroke="var(--rc-border-strong)" strokeWidth="1.6" strokeLinecap="round"
              strokeLinejoin="round">
              <path d="M15.5 4a4.5 4.5 0 0 0-4 6.6L4 18.1 5.9 20l7.5-7.5A4.5 4.5 0 1 0 15.5 4Z" />
            </svg>
            <div style={{ fontFamily: disp, fontWeight: 700, fontSize: 20 }}>
              {suFCond === "wet" ? t("Yağmur setupu yok") : t("Senin yüklediğin setup yok")}</div>
            <div style={{ fontSize: 12.5, color: "var(--rc-text-3)", lineHeight: 1.7, maxWidth: 420 }}>
              {suFCond === "wet"
                ? t("Bu filtreyle eşleşen setup bulunamadı. Islak zemin için bir setup yükle — takımdaki herkes görebilir.")
                : t("Havuza henüz setup eklemedin. Yüklediğin dosyalar takımdaki herkese açık olur.")}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center",
              marginTop: 4 }}>
              <button onClick={() => setPoolUp(true)}
                style={{ ...upBtn, padding: "9px 18px", borderRadius: 10, fontSize: 13 }}>
                ⬆ {t("İlk setupu yükle")}</button>
              <button onClick={() => { setSuFTrack(""); setSuFCond(""); setSuFSess("");
                setSuQuery(""); setSuMine(false); }}
                style={{ padding: "9px 16px", borderRadius: 10, cursor: "pointer", fontSize: 13,
                  border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)",
                  color: "var(--rc-text-2)" }}>{t("Filtreleri temizle")}</button>
            </div>
          </div>
        )}

        {groups.map(([track, items]) => (
          <div key={track || "—"} style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10,
              paddingBottom: 8, borderBottom: "1px solid var(--rc-border)" }}>
              {track && <img src={`${ASSET}flags/${TRACK_ASSET(track)}.png`} alt="" onError={hideImg}
                style={{ width: 24, borderRadius: 3, border: "1px solid var(--rc-border)" }} />}
              <span style={{ fontFamily: disp, textTransform: "uppercase", letterSpacing: ".06em",
                fontSize: 16, fontWeight: 700 }}>{trackName(track) || track || "—"}</span>
              <span style={{ color: "var(--rc-text-3)", fontSize: 12 }}>
                {items.length} {t("setup")}</span>
              {track && track === st.track && (
                <span style={{ marginLeft: "auto", padding: "2px 9px", borderRadius: 99, fontSize: 10,
                  textTransform: "uppercase", letterSpacing: ".08em",
                  border: "1px solid var(--rc-brand-bright)", color: "var(--rc-brand-bright)" }}>
                  {t("şu anki pist")}</span>
              )}
            </div>

            <div style={poolCards ? { display: "none" }
              : { border: "1px solid var(--rc-border)", borderRadius: 12,
                background: "var(--rc-surface)", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 10,
                alignItems: "center", padding: "8px 12px", borderBottom: "1px solid var(--rc-border)",
                background: "var(--rc-surface-2)" }}>
                <span />
                <span style={colLbl}>{t("Dosya")}</span>
                <span style={{ ...colLbl, textAlign: "left" }}>{t("Koşul")}</span>
                <span style={colLbl}>{t("Araç")}</span>
                <span style={{ ...colLbl, textAlign: "right" }}>{t("Tur")}</span>
                <span style={colLbl}>{t("Yükleyen")}</span>
                <span style={{ ...colLbl, textAlign: "right" }}>{t("İşlem")}</span>
              </div>
              {items.map(listRow)}
            </div>

            <div style={poolCards
              ? { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }
              : { display: "none" }}>
              {items.map(card)}
            </div>
          </div>
        ))}

        {suHasMore && (
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <button onClick={loadMoreSetups}
              style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid var(--rc-border)",
                background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer",
                fontSize: 13 }}>⬇ {t("Daha fazla yükle")}</button>
          </div>
        )}
      </div>
    );
  };

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
      onDownload={downloadSetup} onAddCompare={cmpToggle} />
  );

  const chatSheet = (page = false) => (
    <ChatModal open={(page || chatOpen) && !!user && !!curChan} page={page}
      onClose={page ? back : () => setChatOpen(false)}
      t={t} lang={lang} chatSound={chatSound} toggleChatSound={toggleChatSound}
      chatChans={chatChans} unreadOf={unreadOf} chatChan={chatChan} setChatChan={setChatChan}
      teamData={teamData} curChan={curChan} chatBody={chatBody} chatAll={chatAll} />
  );
  const chatModal = chatSheet(false);

  /* Mini oynatıcı: sekmeden bağımsız, köşede sabit. iframe hep aynı ağaçta kalır,
     küçültünce yalnız gizlenir — yayın kesilmez. */
  const streamPlayer = curRace && ytId(st.streamUrl) && (
    <div className={`floatstream ${streamCorner} ${streamMin ? "min" : ""}`}
      style={streamMin ? undefined : { width: streamW }}>
      <div className="fshead">
        <span className="fsgrip" title={t("Boyutlandırmak için sürükle")}
          onPointerDown={startResize}>⤡</span>
        <span className="fstitle">📺 {t("Canlı Yayın")}</span>
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

  const chatBtn = user && (
    <button className="adminbtn" data-tour="hchat" onClick={() => go("chat")}
      title={t("Takım Sohbeti")}>
      <Icon name="chat" size={14} /> {t("Sohbet")}
      {chatUnread > 0 && <b className="badge">{chatUnread > 99 ? "99+" : chatUnread}</b>}
    </button>
  );

  /* Takım adı değişince kendi users/{uid}/teams kopyamı tazele — lobideki
     takım sekmeleri bu kopyayı okuyor, yoksa eski ad takılı kalır. */
  useEffect(() => {
    const nm = teamData?.meta?.name;
    if (!curTeam || !user?.uid || !nm) return;
    if (myTeams[curTeam] === nm) return;
    syncMyTeamName(user.uid, curTeam, nm).catch(() => {});
  }, [curTeam, user, teamData, myTeams]);

  /* ilk girişte lobi turu, ilk yarış açılışında ana tur kendiliğinden başlar */
  useEffect(() => {
    if (!user || !udoc?.allowed) return;
    if (!curRace && !entered && !seenTour(TOUR_L)) {
      const t0 = setTimeout(() => setTour("lobby"), 700);
      return () => clearTimeout(t0);
    }
    return undefined;
  }, [user, udoc, curRace, entered]);
  useEffect(() => {
    if (!curRace || !seenTour(TOUR_L) || seenTour(TOUR_M)) return undefined;
    const t0 = setTimeout(() => setTour("main"), 900);
    return () => clearTimeout(t0);
  }, [curRace]);

  const closeTour = () => {
    /* "live" bölümü elle başlatılır (Canlı sekmesindeki 🎓) → otomatik-başlatma
       damgasını bozmasın; yalnız lobi/ana tur damgalanır. */
    if (tour === "lobby") markTour(TOUR_L);
    else if (tour === "main") markTour(TOUR_M);
    setTourDemo(false);          // rehberin açtığı demoyu kapat
    setTour(null);
  };

  /* Yarış datası paneli açık/taslak durumu — tourSteps useMemo'su setRdOpen'ı
     okuduğu için ORADAN ÖNCE tanımlanmalı (aksi halde ilk render'da, tur açıkken
     TDZ: "Cannot access 'setRdOpen' before initialization"). Panelin türetilen
     değerleri ve JSX'i aşağıda (st/up/blocked tanımlandıktan sonra). */
  const [rdOpen, setRdOpen] = useState(false);
  const [rdDraft, setRdDraft] = useState(null);

  /* Adım listesi ./tourSteps.js'te (saf + test edilebilir). "live" bölümü demoyu
     açar → Canlı ekranı veri olmadan da dolu görünür, adımların hedefi oluşur. */
  const tourSteps = useMemo(
    () => (tour ? /* v2.0: data adımları sağdan kayan panelde → setSideOpen yerine setRdOpen. */
      buildTourSteps(tour, { t, setTab, setSideOpen: setRdOpen, setTourDemo }) : []),
    [tour, lang]);   // eslint-disable-line react-hooks/exhaustive-deps

  const tourOverlay = tour && (
    <TourOverlay steps={tourSteps} onClose={closeTour} lang={lang} />
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
  /* yama 2.0.2: giriş düğmesinin yükleniyor durumu — Google popup açıkken dönen
     gösterge + "Bağlanılıyor…". Başarıda kullanıcı state'i dolar → kapı kapanır. */
  const [signingIn, setSigningIn] = useState(false);
  const doSignIn = async (mode = "in") => {
    if (signingIn) return;
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
    } finally { setSigningIn(false); }
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
  const verNew = seenVer !== APP_VERSION;
  const infoBtn = (
    <button className="infobtn" data-tour="info" onClick={openVersions}
      title={t("Neler değişti")} aria-label={t("Neler değişti")}>
      i{verNew && <span className="nd" />}
    </button>
  );
  const versionModal = (
    <VersionModal open={verOpen} onClose={() => setVerOpen(false)} t={t} lang={lang}
      onStartGuide={() => { setVerOpen(false); setTour(curRace ? "main" : "lobby"); }} />
  );
  /* Yetki reddi kutucuğu — viewer bir yarışta düzenleme deneyince belirir (edit() muhafızı).
     key={deny} her tıkta remount → animasyon yeniden oynar; ~2.6 sn sonra kendini kapatır. */
  const denyToast = deny > 0 && (
    <DenyToast key={deny}
      text={t("Bu işlem için yetkiniz yok — düzenleme Yarış Mühendisi/Takım Sahibine açık")}
      onDone={() => setDeny(0)} />
  );
  /* Komut paleti aksiyonları — sekmeler + hızlı ayarlar. */
  /* Komut paleti aksiyonları — fiş cmdOpen (cmdGroups): kategori başlıklı gruplar.
     `group` alanı CommandPalette'te başlık olarak çizilir; dizi sırası grup
     kümelenmesini korur (Ekranlar → Genel). */
  const gScreen = t("Ekranlar");
  const gGeneral = t("Genel");
  const cmdActions = [
    { id: "dash", group: gScreen, label: t("Dashboard"), keywords: "dash panel", icon: <Icon name="chart" size={15} />, run: () => setTab("dash") },
    { id: "stint", group: gScreen, label: t("Stint"), keywords: "stint", icon: <Icon name="cap" size={15} />, run: () => setTab("stint") },
    { id: "fuel", group: gScreen, label: t("Son Stint Yakıtı"), keywords: "fuel yakıt", icon: <Icon name="zap" size={15} />, run: () => setTab("fuel") },
    { id: "live", group: gScreen, label: t("Canlı"), keywords: "live canlı timing", icon: <Icon name="live" size={15} />, run: () => setTab("live") },
    { id: "tyre", group: gScreen, label: t("Lastik"), keywords: "tyre lastik", icon: <Icon name="tyre" size={15} />, run: () => setTab("tyre") },
    { id: "drivers", group: gScreen, label: t("Pilotlar"), keywords: "drivers pilot", icon: <Wheel size={13} />, run: () => setTab("drivers") },
    { id: "tele", group: gScreen, label: t("Telemetri"), keywords: "telemetry telemetri", icon: <Icon name="chart" size={15} />, run: () => setTab("tele") },
    { id: "setup", group: gScreen, label: t("Setup"), keywords: "setup", icon: <Icon name="wrench" size={15} />, run: () => setTab("setup") },
    ...(raceChan ? [{ id: "rchat", group: gScreen, label: t("Yarış Sohbeti"), keywords: "chat sohbet", icon: <Icon name="chat" size={15} />, run: () => setTab("rchat") }] : []),
    /* v2.0: tema ve yoğunluk komutları paletten de gizlendi (yukarıdaki
       KALDIRILANLAR ile aynı karar). */
    { id: "schedule", group: gGeneral, label: t("Resmi Yarışlar"), keywords: "schedule takvim race yarış lmugarage resmi official", icon: "🏁", run: () => go("official") },
    ...(user ? [{ id: "chat", group: gGeneral, label: t("Sohbet"), keywords: "chat sohbet team", icon: <Icon name="chat" size={15} />, run: () => go("chat") }] : []),
    ...(curRace ? [{ id: "home", group: gGeneral, label: t("Ana Menü"), keywords: "home ana menü lobby", icon: <Icon name="home" size={15} />, run: leaveRace }] : []),
    { id: "lang", group: gGeneral, label: lang === "en" ? "Türkçe" : "English", keywords: "language dil", run: () => switchLang(lang === "en" ? "tr" : "en") },
  ];
  const cmdPalette = (
    <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} actions={cmdActions} t={t} />
  );

  const [wxHist, setWxHist] = useState(false); // hava geçmişi penceresi
  const [wxPlanW, setWxPlanW] = useState("wet"); // planlı geçiş: hava
  const [wxPlanT, setWxPlanT] = useState("");    // planlı geçiş: yarış saati
  const [zoom, setZoom] = useState(null); // "car" | "track" | null — kart büyütme (lightbox)
  /* LMU referans verisi (Ohne Speed tablosundan gömülü JSON) — 47 KB; giriş/izin
     ekranlarında gerekmez → yalnız erişim onaylanınca çekilir. */
  const [lmuData, setLmuData] = useState(null);
  useEffect(() => {
    if (!access && authReady) return;   // authReady=false (yapılandırmasız dev) → kapı yok, hemen çek
    fetch(`${ASSET}lmu-data.json`).then((r) => (r.ok ? r.json() : null))
      .then((j) => setLmuData(j)).catch(() => {});
  }, [access]);
  /* Davet linki (?join=KOD) — açılışta kodu ön-doldur + Kur&Katıl'ı aç; URL'i
     temizle ki yenilemede tekrar tetiklenmesin. */
  useEffect(() => {
    try {
      const code = new URLSearchParams(window.location.search).get("join");
      if (!code) return;
      setTForm((f) => ({ ...f, join: code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) }));
      setCreateJoinOpen(true);
      window.history.replaceState({}, "",
        window.location.origin + window.location.pathname + window.location.hash);
    } catch { /* yoksay */ }
  }, []);
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
      await createRace(curTeam, payload, init, user?.uid).catch(() => {});
    }
    setRForm(null);
  };
  const raceForm = (
    <RaceEditModal rForm={rForm} setRForm={setRForm} t={t} seasons={seasons} onSave={saveRaceForm}
      lmuData={lmuData} />
  );

  /* Profil ve rozetler — fiş acctModalOpen (profil sekmesi). Hem ana menüden hem
     yarış içinden AYNI pencere → değişkene çıkarıldı (eskiden yalnız yarış-içi
     ağaçta render ediliyordu, menüden açılmıyordu). Bildirim ayarları sekmesi
     ayrı iş (#13); şimdilik yalnız profil. Ad/avatar kaydetme akışı korundu. */
  const profileModal = profOpen && user && (() => {
    const disp = "var(--rc-font-display)";
    const avSrc = avStage || myAvatar || user.photoURL || "";
    const noref = /^https?:/.test(avSrc) ? "no-referrer" : undefined;
    const profInitials = (profName || user.displayName || user.email || "?")
      .split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
    const lbl = { display: "block", color: "var(--rc-text-3)", fontSize: 10,
      textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 };
    const closeProf = () => { setAvStage(""); setAvErr(""); setProfOpen(false); };
    return (
      <div onClick={closeProf} style={{ position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(10,6,10,.74)", backdropFilter: "blur(5px)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: 24, animation: "rcfade .18s ease" }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: "min(780px,96vw)", maxHeight: "86vh",
          background: "var(--rc-surface)", border: "1px solid var(--rc-border-strong)", borderRadius: 16,
          overflow: "hidden", display: "flex", flexDirection: "column",
          boxShadow: "0 24px 70px rgba(0,0,0,.6)", animation: "rcpop .24s cubic-bezier(.2,.9,.3,1.1)" }}>

          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 20px",
            borderBottom: "1px solid var(--rc-border)" }}>
            <span style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--rc-brand)",
              color: "var(--rc-on-brand)", display: "inline-flex", alignItems: "center",
              justifyContent: "center", fontFamily: disp, fontWeight: 700, fontSize: 20, flex: "0 0 auto",
              overflow: "hidden" }}>
              {avSrc ? <img src={avSrc} alt="" referrerPolicy={noref}
                style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : profInitials}
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
              <b style={{ fontFamily: disp, fontSize: 22, letterSpacing: ".02em" }}>
                {profName || user.displayName || t("Kullanıcı")}</b>
              <span style={{ fontSize: 11.5, color: "var(--rc-text-3)", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.email}{teamData?.meta?.name ? ` · ${teamData.meta.name}` : ""}</span>
            </span>
            <button onClick={closeProf} style={{ marginLeft: "auto", width: 32, height: 32, borderRadius: 9,
              border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)",
              color: "var(--rc-text-2)", cursor: "pointer", fontSize: 15, lineHeight: 1 }}>✕</button>
          </div>

          <div style={{ overflowY: "auto", padding: "18px 20px 22px", display: "flex", flexWrap: "wrap",
            gap: 18 }}>
            <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column",
              gap: 14 }}>
              <div>
                <label style={lbl}>{t("Görünen ad")}</label>
                <input type="text" value={profName} onChange={(e) => setProfName(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", background: "var(--rc-surface-3)",
                    border: "1px solid var(--rc-border-strong)", borderRadius: 10, color: "var(--rc-text)",
                    padding: "11px 14px", fontFamily: disp, fontSize: 18, fontWeight: 700,
                    textTransform: "none" }} />
                <div style={{ color: "var(--rc-text-3)", fontSize: 11, marginTop: 5 }}>
                  {t("Odalarda ve stint programında bu isim görünür.")}</div>
              </div>
              <div>
                <label style={lbl}>{t("Profil görseli")}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 70, height: 70, flex: "0 0 auto",
                    border: "1.5px dashed var(--rc-border-strong)", borderRadius: "50%",
                    background: "var(--rc-surface-2)", display: "grid", placeItems: "center",
                    fontFamily: disp, fontWeight: 700, fontSize: 20, color: "var(--rc-text-3)",
                    overflow: "hidden" }}>
                    {avSrc ? <img src={avSrc} alt="" referrerPolicy={noref}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : profInitials}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    <input id="avfile" type="file" accept={IMG_ACCEPT_TYPES.join(",")}
                      style={{ display: "none" }}
                      onChange={(e) => { onAvatarFile(e.target.files?.[0]); e.target.value = ""; }} />
                    <span style={{ display: "flex", gap: 7 }}>
                      <button disabled={avBusy} onClick={() => document.getElementById("avfile")?.click()}
                        style={{ padding: "6px 13px", borderRadius: 8, border: "1px solid var(--rc-border)",
                          background: "var(--rc-surface-3)", color: "var(--rc-text)", cursor: "pointer",
                          fontSize: 12 }}>{avBusy ? t("Yükleniyor…") : t("Yükle")}</button>
                      {(myAvatar || avStage) && (
                        <button disabled={avBusy} onClick={async () => {
                          setAvStage(""); setAvErr("");
                          await clearUserAvatar(user.uid).catch(() => {});
                          setMyAvatar("");
                        }} style={{ padding: "6px 13px", borderRadius: 8,
                          border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)",
                          color: "var(--rc-text-3)", cursor: "pointer", fontSize: 12 }}>{t("Kaldır")}</button>
                      )}
                    </span>
                    <span style={{ fontSize: 10.5, color: "var(--rc-text-3)" }}>
                      {avStage ? t("Önizleme — Kaydet ile uygulanır")
                        : t("Boşsa baş harflerin kullanılır")}</span>
                    {avErr && <span style={{ fontSize: 11, color: "var(--rc-danger)" }}>{avErr}</span>}
                  </div>
                </div>
              </div>
              <div>
                <label style={lbl}>{t("Bu takımdaki rolün")}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  {myBadges.length > 0 ? myBadges.map((b) => (
                    <span key={b.lbl} style={{ display: "inline-flex", alignItems: "center", gap: 7,
                      padding: "7px 14px", borderRadius: 99, border: `1px solid ${b.col}`, color: b.col,
                      fontSize: 12.5 }}>{b.ico} {t(b.lbl)}</span>
                  )) : (
                    <span style={{ fontSize: 12, color: "var(--rc-text-3)" }}>{t(roleLabel(role))}</span>
                  )}
                  <span style={{ fontSize: 11, color: "var(--rc-text-3)" }}>
                    {t("Rolleri takım ekranından yönetirsin")}</span>
                </div>
              </div>
            </div>

            <div style={{ flex: "1 1 280px", minWidth: 260, display: "flex", flexDirection: "column",
              gap: 12 }}>
              <div style={{ border: "1px solid var(--rc-border)", borderRadius: 12,
                background: "var(--rc-surface-2)", padding: 16 }}>
                <div style={{ fontFamily: disp, textTransform: "uppercase", letterSpacing: ".08em",
                  fontSize: 13, fontWeight: 700, color: "var(--rc-brand-bright)", marginBottom: 12 }}>
                  {t("Rozetler")}</div>
                {myBadges.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
                    {myBadges.map((b) => (
                      <span key={b.lbl} style={{ display: "inline-flex", alignItems: "center", gap: 8,
                        padding: "8px 12px", borderRadius: 10, border: `1px solid ${b.col}`,
                        background: b.bg, color: b.col }}>
                        <span style={{ fontSize: 17, lineHeight: 1 }}>{b.ico}</span>
                        <b style={{ fontSize: 12, whiteSpace: "nowrap" }}>{t(b.lbl)}</b>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--rc-text-3)", lineHeight: 1.6 }}>
                    {t("Henüz rozetin yok — takım ekranından rozet alabilirsin.")}</div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px",
            borderTop: "1px solid var(--rc-border)", background: "var(--rc-surface-2)" }}>
            <span style={{ color: "var(--rc-text-3)", fontSize: 11.5 }}>
              {t("Değişiklikler Kaydet ile uygulanır")}</span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button onClick={closeProf} style={{ padding: "10px 18px", borderRadius: 10,
                border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)",
                color: "var(--rc-text-2)", cursor: "pointer", fontSize: 13 }}>{t("Vazgeç")}</button>
              <button disabled={!profName.trim()} style={{ padding: "10px 24px", borderRadius: 10,
                border: "1px solid var(--rc-brand-bright)", background: "var(--rc-brand)",
                color: "var(--rc-on-brand)", cursor: profName.trim() ? "pointer" : "not-allowed",
                opacity: profName.trim() ? 1 : .45, fontFamily: disp, fontSize: 16, fontWeight: 700,
                letterSpacing: ".04em", textTransform: "uppercase" }}
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

  /* takım penceresi → TeamModal (sunum); depo fn'leri bileşende, navigasyon/
     rozet/rol yardımcıları (openRace/setRForm/setBadge/roleLabel) App'ten prop. */
  /* v2.0: aynı bileşen hem pencere (lobi/başlık düğmesi) hem TAM SAYFA (sol ray)
     olarak çizilir. Tam sayfada kapatma = GERİ (önceki ekrana dönülür). */
  const teamSheet = (page = false) => (
    <TeamModal open={page || teamOpen} page={page}
      onClose={page ? back : () => setTeamOpen(false)} user={user} t={t} lang={lang}
      myTeams={myTeams} curTeam={curTeam} setCurTeam={setCurTeam} teamData={teamData}
      tnEdit={tnEdit} setTnEdit={setTnEdit} canManageTeam={canManageTeam} canEditTeam={canEditTeam}
      curSeason={curSeason} setCurSeason={setCurSeason} seasons={seasons} races={races} st={st}
      myRole={myRole} openRace={openRace} setRForm={setRForm} setBadge={setBadge}
      roleLabel={roleLabel}
      onCreateJoin={() => { setTeamOpen(false); setCreateJoinOpen(true); }} />
  );
  const teamModal = teamSheet(false);

  /* Create & Join — takım kur / katıl (yönetimden AYRI, sade ekran; v1.6) */
  const createJoinModal = (
    <CreateJoinModal open={createJoinOpen} onClose={() => setCreateJoinOpen(false)}
      user={user} t={t} userName={userName}
      tForm={tForm} setTForm={setTForm} setTErr={setTErr} tErr={tErr} setCurTeam={setCurTeam} />
  );

  /* ---------- ortak data kartları (setup + ana arayüz sol kolon) ---------- */
  /* Yarış datası kartları — SAHNELE + UYGULA için parametreli.
   `dst` okunacak state (yarış datası panelinde taslak birleşimi), `dup` yazma
   fonksiyonu. Kurulum adımında dataCardsWith(dst, up) ile ANINDA KAYDETME yolu
   korunur; yarış datası panelinde dataCardsWith(rdSt, rdSet) ile değişiklikler
   yerel taslakta birikir ve yalnız "Uygula" ile state'e/Firebase'e geçer
   (ARAYUZ-YENILEME-PROMPT-v2: "Mevcut anında kaydetme yolu BU EKRAN için devre
   dışı bırakılır; diğer ekranlarda dokunulmaz"). */
  const dataCardsWith = (dst, dup) => (<>
    <div className="card" data-tour="data">
      <h2>{t("Yarış · Data")}</h2>
      <div className="row2">
        <div><label>Race Time (h:mm:ss)</label>
          <input type="text" value={dst.raceTime} onChange={(e) => dup({ raceTime: e.target.value })} /></div>
        <div><label>Avg Lap (m:ss.00)</label>
          <input type="text" value={dst.avgLap} onChange={(e) => dup({ avgLap: e.target.value })} />
          {avgSug && canEdit && (
            <button className="act" style={{ marginTop: 4, fontSize: 11, padding: "3px 8px" }}
              title={t("Canlı son 5 turun ortalaması — tıkla, plana uygula")}
              onClick={() => dup({ avgLap: avgSug.txt })}>
              ⚡ {t("Canlı AVG5")}: <b className="mono">{avgSug.txt}</b> — {t("uygula")}</button>
          )}</div>
      </div>
      <div className="row4">
        {["A", "B", "C", "D"].map((k) => (
          <Num key={k} v={dst.strategies[k]} step={1}
            onC={(v) => dup({ strategies: { ...dst.strategies, [k]: v } })} />
        ))}
      </div>
      <label>{t("Seçili Strateji")}</label>
      <div className="strat">
        {["A", "B", "C", "D"].map((k) => (
          <button key={k} className={dst.chosen === k ? "on" : ""}
            onClick={() => dup({ chosen: k })}>{k} · {dst.strategies[k]}</button>
        ))}
      </div>
      <div className="row2">
        <div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={dst.multiclass} style={{ width: "auto", margin: 0 }}
              onChange={(e) => dup({ multiclass: e.target.checked })} />
            {t("Multiclass Yarış")}
          </label>
          <select value={dst.leaderClass} disabled={!dst.multiclass}
            style={!dst.multiclass ? { opacity: .45 } : undefined}
            onChange={(e) => dup({ leaderClass: e.target.value })}>
            {CAR_CLASSES.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
        <div><label>Extra Lap</label>
          <Num v={dst.extraLap} step={1} onC={(v) => dup({ extraLap: v })} /></div>
      </div>
      {dst.multiclass && (
        <div className="row2">
          <div><label>🏁 {t("Lider Tur (m:ss.00)")}</label>
            <input type="text" value={dst.leaderLap} placeholder={dst.avgLap}
              onChange={(e) => dup({ leaderLap: e.target.value })} /></div>
          <div />
        </div>
      )}
      {dst.multiclass && racePlan.flagExtra > 0.5 && (
        <div className="hint">🏁 {t("Lider bayrağı")}: +{racePlan.flagExtra.toFixed(0)}s → {t("son tur otomatik eklenir")}</div>
      )}
    </div>

    <div className="card" data-tour="rstart" style={{ marginTop: 12 }}>
      <h2>{t("Yarış Başlangıcı")}</h2>
      <label>{t("Start Tarih & Saat")}</label>
      <input type="datetime-local" value={msToLocalInput(dst.raceStartMs)}
        onChange={(e) => { const t = new Date(e.target.value).getTime();
          if (!isNaN(t)) dup({ raceStartMs: t }); }} />
      <div style={{ marginTop: 10, background: "var(--panel2)",
        border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span className="hint" style={{ margin: 0 }}>🏁 {t("Hesaplanan Bitiş")}</span>
        <b className="mono" style={{ fontSize: 15, color: "var(--green)" }}>
          {driverPlan ? fmtClock(driverPlan.finishMs, driverPlan.startMs) : "—"}</b>
      </div>
    </div>

    <div className="card" data-tour="wx" style={{ marginTop: 12 }}>
      <h2>🌦 {t("Hava Durumu")}</h2>
      {/* canlı yağmur/ıslaklık plandaki havadan sapınca tek tıklık öneri (otomatik yazmaz) */}
      {wxSug && canEdit && (
        <button className="act" style={{ marginBottom: 8, fontSize: 12,
          borderColor: WEATHER[wxSug.id].col, color: WEATHER[wxSug.id].col }}
          title={`🌧 %${wxSug.rain} · 💧 %${wxSug.wetness}`}
          onClick={() => {
            const el = liveInfo.status === "live"
              ? Math.max(0, Math.round(liveInfo.elapsed / 1000)) : 0;
            let past = (dst.weatherLog || []).filter((e) => e.t < el - 0.5);
            const future = (dst.weatherLog || []).filter((e) => e.t > el + 0.5);
            if (el < 1) past = [];
            const log = [...past, { t: el, w: wxSug.id, src: "live" }, ...future]
              .sort((a, b) => a.t - b.t);
            dup({ weather: wxSug.id, weatherLog: log });
          }}>
          <WetIcon id={wxSug.id} size={15} /> {t("Canlı")}: 🌧 {t(wxSug.rainLbl)} ·{" "}
          <b>{t(wxSug.label)}</b> → {t("geçişi ekle")}
        </button>
      )}
      <div className="wxsel">
        {Object.entries(WEATHER).map(([id, w]) => (
          <button key={id} className={dst.weather === id ? "on" : ""}
            style={dst.weather === id ? { borderColor: w.col, color: w.col } : undefined}
            onClick={() => {
              const el = liveInfo.status === "live"
                ? Math.max(0, Math.round(liveInfo.elapsed / 1000)) : 0;
              let past = (dst.weatherLog || []).filter((e) => e.t < el - 0.5);
              const future = (dst.weatherLog || []).filter((e) => e.t > el + 0.5);
              if (el < 1) past = [];
              const log = [...past, { t: el, w: id, src: "live" }, ...future]
                .sort((a, b) => a.t - b.t);
              const cur = wxAtRel(log, el);
              dup({ weather: Object.keys(WEATHER).find((k) => WEATHER[k] === cur) || id,
                weatherLog: log });
            }}>
            <WetIcon id={id} size={20} /> {t(w.lbl)}<br /><small>×{w.lap.toFixed(2)}</small>
          </button>
        ))}
      </div>
      {(() => {
        /* "Efektif tur (şu an)": vurgulu hava düğmesiyle AYNI kaynağı kullan (şimdiki
           hava = dst.weather). WX(dst) log'un EN İLERİ kaydını verir → ileride planlı bir
           ıslak geçiş varsa gelecekteki çarpanı gösterirdi (etiket "şu an" ile çelişir). */
        const wxNow = WEATHER[dst.weather] || WEATHER.dry;
        return wxNow.lap > 1 && (
          <div className="hint">
            {t("Efektif tur")} ({t("şu an")}): <b className="mono">{dst.avgLap}</b> ×{wxNow.lap.toFixed(2)} ={" "}
            <b className="mono" style={{ color: wxNow.col }}>{fmtLap(parseLap(dst.avgLap) * wxNow.lap)}</b>
            {wxNow.fuel < 1 && <> · ⚡ {t("yakıt")} −{((1 - wxNow.fuel) * 100).toFixed(0)}%</>}
          </div>
        );
      })()}
      <div className="hint" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <button className="histbtn" onClick={() => setWxHist(true)}>
          🕒 {t("Geçmiş / Planlı geçişler")}
          {(dst.weatherLog || []).length > 0 ? ` (${dst.weatherLog.length})` : ""}</button>
      </div>
    </div>

    <div className="card" data-tour="pittimes" style={{ marginTop: 12 }}>
      <h2>{t("Pit · Süreler (s)")}</h2>
      <div className="row2">
        <div><label>Pit Line</label><Num v={dst.pitLaneTime} onC={(v) => dup({ pitLaneTime: v })} />
          {dst.track && PIT_LANE_TIMES[dst.track] != null && (
            <div className="hint">{t("Pist verisi")}: {PIT_LANE_TIMES[dst.track]}s · {trackName(dst.track)}</div>
          )}</div>
        <div><label style={{ display: "flex", alignItems: "center", gap: 5 }}>
          ⛽ Fuel &amp; <Bolt size={13} /> VE</label>
          <Num v={dst.fuelTime} onC={(v) => dup({ fuelTime: v })} /></div>
      </div>
      <div className="row2">
        <div><label style={{ display: "flex", alignItems: "center", gap: 5 }}><Tyre size={15} /> {t("Lastik Limiti (adet)")}</label>
          <Num v={dst.tyreLimit} step={1} onC={(v) => dup({ tyreLimit: v })} /></div>
        <div />
      </div>
    </div>

    <div className="card" data-tour="ve" style={{ marginTop: 12 }}>
      <h2>⚡ Virtual Energy · Data</h2>
      <div className="row2">
        <div><label>⚡ {t("VE Tüketim (%/tur)")}</label><Num v={dst.consumption} onC={(v) => dup({ consumption: v })} /></div>
        <div><label>Fuel Ratio (L / %1)</label><Num v={dst.fuelRatio} onC={(v) => dup({ fuelRatio: v })} /></div>
      </div>
      <div className="row2">
        <div><label>⛽ {t("%100 = Taşınan Yakıt")}</label>
          <div className="mono" style={{ padding: "6px 0", color: "var(--green)" }}>
            {fuelCarried.toFixed(1)} L</div></div>
      </div>
    </div>

    <div className="card" data-tour="stream" style={{ marginTop: 12 }}>
      <h2>📺 {t("Canlı Yayın")}</h2>
      <label>{t("YouTube linki")}</label>
      <input type="text" value={dst.streamUrl} placeholder="https://youtube.com/watch?v=..."
        onChange={(e) => dup({ streamUrl: e.target.value })} />
      <div className="hint">
        {ytId(dst.streamUrl)
          ? <>✅ {t("Yayın köşedeki mini oynatıcıda gösteriliyor.")}</>
          : t("Geçerli bir YouTube linki yapıştırın; köşede mini oynatıcı açılır.")}
      </div>
    </div>
  </>);
  const dataCards = dataCardsWith(st, up);

  /* ---------- YARIŞ DATASI PANELİ — SAHNELE + UYGULA (v2.0) ----------
     Alan değişiklikleri YEREL TASLAKTA tutulur, Firebase'e yazılmaz. "Uygula"ya
     basılmadan hiçbir şey kaydedilmez; panel kapatılırken bekleyen değişiklik
     varsa onay sorulur. Mevcut anında kaydetme yolu YALNIZ bu ekran için devre
     dışı — kurulum adımı dataCardsWith(st, up) ile eskisi gibi çalışır. */
  const rdN = rdDraft ? Object.keys(rdDraft).length : 0;
  const rdSt = rdDraft ? { ...st, ...rdDraft } : st;
  const rdSet = (patch) => {
    if (blocked()) { showDeny(); return; }
    setRdDraft((d) => ({ ...(d || {}), ...patch }));
  };
  const rdApply = () => { if (rdDraft) up(rdDraft); setRdDraft(null); };
  const rdDiscard = () => setRdDraft(null);
  const rdClose = () => {
    if (rdN > 0 && !window.confirm(
      t("Kaydedilmemiş değişiklikler var — kapatılsın mı?"))) return;
    setRdDraft(null); setRdOpen(false);
  };
  /* Sağdan kayan panel. Gövde izleyici modunda pasifleşir (README §18). */
  const raceDataPanel = (
    <>
      {rdOpen && <div className="rdscrim" onClick={rdClose} />}
      <aside className={`rdpanel${rdOpen ? " open" : ""}`}
        aria-hidden={!rdOpen} aria-label={t("Yarış datası")}>
        <div className="rdhead">
          <span className="ttl disp">⚙ {t("Yarış datası")}</span>
          <button className="lbclose" onClick={rdClose} aria-label={t("Kapat")}>✕</button>
        </div>
        <div className={`rdbody${curRace && role !== "editor" ? " ro-off" : ""}`}>
          {dataCardsWith(rdSt, rdSet)}
          <div className="rdaffect">
            <b>{t("Bu değişiklik neyi etkiler")}</b>
            <span>📋 {t("Stint planı süreleri ve pit pencereleri")}</span>
            <span>⛽ {t("Son stint yakıtı hesabı")}</span>
            <span>🛞 {t("Lastik limiti uyarıları")}</span>
          </div>
        </div>
        <div className="rdfoot">
          <span className={rdN ? "dirty" : "clean"}>
            {rdN ? `${rdN} ${t("alan değişti")}` : t("Değişiklik yok")}</span>
          <span className="spacer" />
          <button className="rbbtn" onClick={rdDiscard} disabled={!rdN}>
            {t("Geri al")}</button>
          <button className="rbbtn apply" onClick={rdApply} disabled={!rdN}>
            {t("Uygula")}</button>
        </div>
      </aside>
    </>
  );

  /* ---------- giriş kapısı: oturum yoksa uygulama açılmaz ----------
     langReady: EN sözlüğü lazy geldiğinden, EN kullanıcı sözlük inene dek
     (auth beklemesiyle aynı görsel) yükleme durumunda tutulur — Türkçe metin
     parlaması olmaz. Chunk aynı origin'den geldiği için bu bekleme pratikte
     auth'tan önce biter. */
  if (authReady && (authLoading || !langReady || !user)) {
    /* Yükleme (auth/sözlük bekleniyor) → sade bekleme ekranı; giriş verisi
       parlamasın diye yeni tasarım yalnız GİRİŞ GEREKTİĞİNDE gösterilir. */
    if (authLoading || !langReady) {
      return (
        <div className="rc">
          <UpdateBanner t={t} />
          <div className="lobby">
            <div className="box" style={{ textAlign: "center" }}>
              <img className="logo" src={`${ASSET}logo.png`} alt="Caspian Motorsport" />
              <h1><b>RACE</b> MONITOR</h1>
              <div className="sub">{APP_VERSION}</div>
              <div className="hint" style={{ marginTop: 22 }}>{t("Yükleniyor…")}</div>
            </div>
          </div>
        </div>
      );
    }
    /* v2.0 giriş ekranı (yama 2.0.2) — iki kolon; kabuğun tamamını kaplar.
       Eski çift düğme (giriş + kayıt) tek "Google ile devam et"e indirildi:
       Google akışında ikisi aynı işlem. */
    return (
      <div className="rc">
        <UpdateBanner t={t} />
        {teamModal}{createJoinModal}{raceForm}
        <div className="auth">
          <span className="authlang">
            {["tr", "en"].map((l) => (
              <button key={l} className={lang === l ? "on" : ""}
                onClick={() => switchLang(l)}>{l.toUpperCase()}</button>
            ))}
          </span>

          <div className="authgrid">
            {/* sol: marka bloğu */}
            <div className="authbrand">
              <img src={`${ASSET}logo.png`} alt="Caspian Motorsport" />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <h1 className="authttl disp"><b>{t("Race")}</b> {t("Monitor")}</h1>
                <p className="authlede">
                  {t("Caspian Motorsport pit wall aracı. Canlı zamanlama, stint planı, yakıt hesabı ve telemetri tek ekranda.")}</p>
              </div>
              <div className="authpts">
                <span><i />{t("Yarış boyunca takımla ortak ekran")}</span>
                <span><i />{t("Le Mans Ultimate köprüsüyle canlı veri")}</span>
                <span><i />{t("Setup havuzu ve stint geçmişi")}</span>
              </div>
            </div>

            {/* sağ: giriş kartı */}
            <div className="authcard">
              <div className="body">
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <h2>{t("Giriş yap")}</h2>
                  <span className="lede">
                    {t("Google hesabınla devam et. Hesabın yoksa ilk girişte oluşturulur.")}</span>
                </div>

                <button className="gbtn2" onClick={() => doSignIn("in")}
                  aria-busy={signingIn} disabled={signingIn}>
                  {signingIn ? <i className="gspin" /> : (
                    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"
                      style={{ flex: "0 0 auto" }}>
                      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.8-2 5.1-4.4 6.7v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.4Z"/>
                      <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.7C7.9 41 15.3 46 24 46Z"/>
                      <path fill="#FBBC05" d="M11.6 28.1c-.4-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.7H4.3A22 22 0 0 0 2 24c0 3.6.9 6.9 2.3 9.8l7.3-5.7Z"/>
                      <path fill="#EA4335" d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.3 30 2 24 2 15.3 2 7.9 7 4.3 14.2l7.3 5.7c1.7-5.2 6.6-9.1 12.4-9.1Z"/>
                    </svg>
                  )}
                  <span>{signingIn ? t("Bağlanılıyor…") : t("Google ile devam et")}</span>
                </button>

                {/* Hata durumu tasarımda yoktu (YAMA.md); kart içinde kırmızı satır. */}
                {authErr && <div className="autherr">{authErr}</div>}

                <div className="authsteps">
                  <span><b>1</b>{t("Girişten sonra takım kurabilir ya da davet koduyla katılabilirsin.")}</span>
                  <span><b>2</b>{t("Yarış verisi için masaüstü köprüsünü kurman gerekir.")}</span>
                </div>
              </div>
              <div className="authfoot">
                <span className="terms">
                  {t("Devam ederek")}{" "}
                  <a href="#" onClick={(e) => e.preventDefault()}>
                    {t("kullanım koşullarını")}</a>{t(" kabul edersin.")}</span>
                <span className="ver">{APP_VERSION}</span>
              </div>
            </div>
          </div>

          <span className="authcap">
            {t("Caspian Motorsport · pit wall aracı — resmi olmayan topluluk projesi")}</span>
        </div>
      </div>
    );
  }

  /* ---------- erişim kapısı: giriş var ama izin yok ---------- */
  if (authReady && user && !access) {
    return (
      <div className="rc">
        <UpdateBanner t={t} />
        {teamModal}{createJoinModal}{raceForm}
        <div className="lobby">
          <div className="box" style={{ textAlign: "center" }}>
            <img className="logo" src={`${ASSET}logo.png`} alt="Caspian Motorsport" />
            <h1><b>RACE</b> MONITOR</h1>
            {udoc === null ? (
              <div className="hint" style={{ marginTop: 22 }}>{t("Yükleniyor…")}</div>
            ) : !udoc.requested ? (<>
              {/* henüz kayıt talebi göndermemiş */}
              <div style={{ fontSize: 34, margin: "14px 0 6px" }}>📝</div>
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
              <div style={{ fontSize: 34, margin: "14px 0 6px" }}>🔒</div>
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
        onExit={back} {...teleHook} />
    );
  }

  /* ---------- bağımsız Resmi Yarışlar ekranı (Ana Menü → Resmi Yarışlar) ----------
     Race Solo yolundan TAMAMEN ayrı üst-düzey görünüm; yarış seçmeye/oda-solo açmaya
     gerek yok. Çıkış (🏠 Ana Menü) yalnız scheduleOnly'yi kapatır; entered/curRace'e
     dokunmaz. curRace/entered'den ÖNCE gelir → yarış açıkken bile bağımsız açılır. */
  if (scheduleOnly) {
    return (
      <ScheduleStandalone t={t} lang={lang} switchLang={switchLang}
        races={lmu.races} updatedAt={lmu.updatedAt}
        loading={lmu.loading} onExit={back}
        onPlan={curTeam ? planOfficialRace : undefined} />
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
    const allUp = list.filter(([, r]) => !isRacePast(r, now));
    const allPast = list.filter(([, r]) => isRacePast(r, now)).reverse();
    /* Şampiyonalar karışmasın: sezona göre grupla, istenirse süz. */
    const sidOf = ([, r]) => r.seasonId || "";
    const sName = (sid) => (sid ? (seasons[sid]?.name || t("Sezon")) : t("Takvim dışı"));
    const seasonIds = Array.from(new Set(list.map(sidOf)));      // takvim sırasına göre
    const inFilter = (e) => lobSeason === "all" || sidOf(e) === lobSeason;
    const upF = allUp.filter(inFilter);
    const nextEntry = upF.length ? upF[0] : null;   // §1 sıradaki yarış (hero)
    const restUp = upF.slice(1);                     // kalan yaklaşanlar
    const q = lobQuery.trim().toLowerCase();
    const matchQ = ([, r]) => !q
      || (r.name || "").toLowerCase().includes(q)
      || trackName(r.trackId).toLowerCase().includes(q);
    const pastAll = allPast.filter(inFilter).filter(matchQ);   // §1.3 ara + süz
    const pastShown = pastAll.slice(0, pastLimit);             // §1.3 sayfalama
    /* Ana menüden yarış sil (owner/editor). Kart butonunun KARDEŞİ olan ayrı bir
       düğme çağırır (iç içe <button> olmasın) → onaydan sonra deleteRace. Firebase
       kuralı da write'ı owner/editor'e sınırlar (ikinci savunma). */
    const askDeleteRace = (rid, r) => {
      if (!curTeam || !rid) return;
      const label = r?.name || trackName(r?.trackId) || "—";
      if (window.confirm(`${t("Bu yarışı silmek istediğinize emin misiniz?")}\n\n${label}`))
        deleteRace(curTeam, rid).catch(() => setSyncMsg(t("Yarış silinemedi.")));
    };

    const RaceRow = ([rid, r], isNext) => (
      <div key={rid} className="lracewrap">
        <button className={`lrace ${isNext ? "next" : ""}`}
          onClick={() => openRace(rid)}>
          {r.trackId && (
            <img className="lrtrack" src={`${ASSET}tracks/${TRACK_ASSET(r.trackId)}.png${AV}`}
              alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          )}
          <span className="lrinfo">
            <b>{r.round ? `R${r.round} · ` : ""}{r.name || trackName(r.trackId) || "—"}</b>
            <span className="lrmeta">
              {r.trackId ? trackName(r.trackId) : ""}
              {r.raceTime ? ` · ${r.raceTime}` : ""}
              {r.carId ? ` · ${carName(r.carClass, r.carId)}` : ""}
            </span>
            {r.startsAt ? (
              <span className="lrdate">{new Date(r.startsAt)
                .toLocaleString(lang === "en" ? "en-GB" : "tr-TR",
                  { weekday: "short", day: "2-digit", month: "short",
                    hour: "2-digit", minute: "2-digit" })}</span>
            ) : null}
          </span>
          <span className="rgo">→</span>
        </button>
        {canEditTeam && (
          <button className="lrdel" title={t("Yarışı sil")}
            onClick={() => askDeleteRace(rid, r)}>🗑</button>
        )}
      </div>
    );

    /* Menü ekranı — handoff-spec/ekranlar/01-menu.md (birebir). Sol ray + tam
       genişlik içerik; ortalanmış dar kutu YOK. */
    const teamName = teamData?.meta?.name || t("Takım");
    const seasonTag = (curSeason && seasons[curSeason]?.name) || "";
    const memberCount = teamData?.members ? Object.keys(teamData.members).length : 0;
    const raceCount = Object.keys(races).length;
    /* fiş 01-menu: Setup havuzu fişi "N dosya · M pist" gösterir. */
    const suTrackCount = new Set(setups.map((s) => s.track).filter(Boolean)).size;
    /* fiş 01-menu: "Resmi yarışlar" fişi sıradaki resmi yarışı + geri sayımı gösterir. */
    const nextOfficial = lmu.upcoming?.[0] || null;
    const nextOfficialTrack = nextOfficial
      ? (trackName(nextOfficial.trackId) || nextOfficial.trackRaw || "") : "";
    const nextOfficialCd = (() => {
      if (!nextOfficial) return "";
      const ms = (nextOfficial.startMs || 0) - now;
      if (ms <= 0) return t("canlı");
      const m = Math.floor(ms / 60000);
      if (m < 60) return `${m} ${t("dk")}`;
      const h = Math.floor(m / 60);
      if (h < 24) return `${h} ${t("sa")}`;
      return `${Math.floor(h / 24)} ${t("gün")}`;
    })();
    const initials = (userName || user?.displayName || user?.email || "?")
      .split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
    const otherTeams = Object.entries(myTeams).filter(([tid]) => tid !== curTeam);
    /* Ray'de yarış ekranları bir yarış açık olmasını ister; menüde sıradaki
       yarışı açar. Yarış-dışı ekranlar kendi eylemine gider. */
    const homeGo = (id) => {
      if (id === "team") return go("team");
      if (id === "chat") return go("chat");
      if (id === "setup") return setSuOpen(true);
      if (id === "tele") return go("tele");
      if (nextEntry) return openRace(nextEntry[0]);
      return undefined;
    };
    /* Geri sayım — sıradaki yarışın başlangıcına. */
    const heroR = nextEntry ? nextEntry[1] : null;
    const cdMs = heroR?.startsAt ? Math.max(0, heroR.startsAt - now) : 0;
    const cdD = Math.floor(cdMs / 86400000);
    const cdH = Math.floor((cdMs % 86400000) / 3600000);
    const cdM = Math.floor((cdMs % 3600000) / 60000);
    const pad2 = (n) => String(n).padStart(2, "0");
    const heroLocal = heroR?.startsAt
      ? (() => {
          const d = new Date(heroR.startsAt); const loc = lang === "en" ? "en-GB" : "tr-TR";
          return `${d.toLocaleDateString(loc, { day: "2-digit", month: "short" })} · ${
            d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" })}`;
        })()
      : "";
    /* Takvim segmenti: Yaklaşan / Geçmiş. Arama iki segmentte de çalışır. */
    const upSearched = upF.filter(matchQ);
    const calList = lobCal === "up" ? upSearched : pastShown;
    const calEmpty = calList.length === 0;
    const seasonChips = [["all", t("Tümü")], ...seasonIds.filter(Boolean).map((sid) => [sid, sName(sid)])];
    const CalRow = ([rid, r]) => {
      const isNext = nextEntry && nextEntry[0] === rid;
      const past = isRacePast(r, now);
      return (
        <div key={rid} className={`hmrow${isNext ? " next" : ""}`}>
          <span className="rnd">{r.round ? `R${r.round}` : "—"}</span>
          {r.trackId
            ? <img className="flag" src={`${ASSET}flags/${TRACK_ASSET(r.trackId)}.png${AV}`} alt=""
                onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
            : <span className="flag" />}
          {r.trackId
            ? <img className="trk" src={`${ASSET}tracks/${TRACK_ASSET(r.trackId)}.png${AV}`} alt=""
                onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
            : <span className="trk" />}
          <span className="info">
            <b>{r.name || trackName(r.trackId) || "—"}</b>
            <span>{[r.trackId ? trackName(r.trackId) : "", r.raceTime,
              r.carId ? carName(r.carClass, r.carId) : ""].filter(Boolean).join(" · ")}</span>
          </span>
          <span className="date">{r.startsAt
            ? new Date(r.startsAt).toLocaleString(lang === "en" ? "en-GB" : "tr-TR",
                { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
            : "—"}</span>
          <span className="state">{isNext ? t("sıradaki") : past ? t("bitti") : t("planlı")}</span>
          <button className="open" onClick={() => openRace(rid)}>{t("Aç")}</button>
          {canEditTeam && (
            <button className="icon" title={t("Düzenle")}
              onClick={() => setRForm({ rid, ...r })}>✎</button>
          )}
          {canEditTeam && (
            <button className="icon del mut" title={t("Sil")}
              onClick={() => askDeleteRace(rid, r)}>🗑</button>
          )}
        </div>
      );
    };

    return (
      <div className="rc v2">
        {teamModal}{createJoinModal}{raceForm}{versionModal}{chatModal}{tourOverlay}{setupModal}{setupContentModal}{setupCompareModal}{cmpBar}{cmdPalette}{profileModal}
        <Rail t={t} screen={screen} go={homeGo} onHome={() => go("home")}
          open={railOpen} onToggle={() => setRailOpen((v) => !v)}
          version={APP_VERSION} chatScreen="chat" unread={chatUnread}
          onChat={() => go("chat")} />
        <div className="v2main">
        <UpdateBanner t={t} />
        {/* v2.0: Takım/Sohbet ana menüden de TAM SAYFA (modal değil) — sol raydan
            gezinir; Ana Menü'ye ray 🏠 ile dönülür. Yarış-içi kabuktaki
            .v2grid > .v2screen yerleşimiyle birebir. */}
        {(screen === "team" || screen === "chat") ? (
        <div className="grid noside v2grid">
          <div className="v2screen">
            {(() => { const g = guideFor(screen, t); return g
              ? <Guide title={g.title} text={g.text} /> : null; })()}
            <div id="tabpanel-main" role="region" aria-label={t("Ana içerik")} tabIndex={-1}>
              {screen === "team" ? teamSheet(true) : chatSheet(true)}
            </div>
          </div>
        </div>
        ) : (
        <div className="hm">

          {/* ── üst şerit: takım kimliği + kontroller ── */}
          <div className="hmbar">
            <span className="hmteam">
              <img src={curTeam ? (teamLogoSrc(teamData?.assets) || `${ASSET}logo.png`) : `${ASSET}logo.png`}
                alt="" onError={(e) => { e.currentTarget.src = `${ASSET}logo.png`; }} />
              <b>{teamName}</b>
              {seasonTag && <span>{seasonTag}</span>}
            </span>
            {otherTeams.map(([tid, nm]) => (
              <button key={tid} className="hmteam2" onClick={() => setCurTeam(tid)}>{nm}</button>
            ))}
            <button className="hmcj" onClick={() => setCreateJoinOpen(true)}>＋ {t("Kur & Katıl")}</button>

            <span className="hmctl">
              <span className="hmlang">
                {["tr", "en"].map((l) => (
                  <button key={l} className={lang === l ? "on" : ""}
                    onClick={() => switchLang(l)}>{l.toUpperCase()}</button>
                ))}
              </span>
              <button className="hmbtn" onClick={() => setTour("lobby")}>🎓 {t("Rehber")}</button>
              <button className="hmbtn mut" title={t("Komut paleti · Ctrl/Cmd+K")}
                onClick={() => setCmdOpen(true)}>🔎 {t("Ara")} <b>⌘K</b></button>
              {isAdmin && (
                <button className="hmbtn" title={t("Üye yönetimi")}
                  onClick={() => setAdminOpen(true)}>🛡 {t("Üyeler")}</button>
              )}
              <span className="hmpop-wrap">
                <button className={`hminfo${homeInfo ? " on" : ""}`} title={t("Sürüm ve bilgi")}
                  onClick={() => { setHomeInfo((v) => !v); setHomeAcct(false); }}>ℹ</button>
                {homeInfo && (
                  <span className="hminfopop">
                    <span className="hd">
                      <img src={`${ASSET}logo.png`} alt="" />
                      <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <b>Race Monitor</b>
                        <span>{t("Sürüm")} {APP_VERSION} · Caspian Motorsport</span>
                      </span>
                    </span>
                    <span className="st">
                      <span className="r"><span>{t("Köprü")}</span>
                        <b style={{ color: live?.ts ? "var(--rc-ok)" : undefined }}>
                          {live?.ts ? t("bağlı") : t("bağlı değil")}</b></span>
                      <span className="r"><span>{t("Takvim verisi")}</span>
                        <b>{lmu?.updatedAt
                          ? new Date(lmu.updatedAt).toLocaleTimeString(lang === "en" ? "en-GB" : "tr-TR",
                              { hour: "2-digit", minute: "2-digit" }) : "—"}</b></span>
                      <span className="r"><span>{t("Oyun")}</span><b>Le Mans Ultimate</b></span>
                    </span>
                    <span className="act">
                      <button onClick={() => { setHomeInfo(false); openVersions(); }}>
                        {t("Yenilikler · neler değişti")}</button>
                      <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
                        `Race Monitor — ${t("Hata bildir")} (${APP_VERSION})`)}&body=${encodeURIComponent(
                        `\n\n———\n${t("Sürüm")}: ${APP_VERSION}`)}`}
                        onClick={() => setHomeInfo(false)}>{t("Hata bildir")}</a>
                    </span>
                    <span className="ft">{t("Takvim kaynağı")}{" "}
                      <a href="https://lmugarage.com" target="_blank" rel="noopener noreferrer">lmugarage.com</a>{" "}
                      — {t("resmi olmayan topluluk projesi.")}</span>
                  </span>
                )}
              </span>
              <span className="hmpop-wrap">
                <button className={`hmacct${homeAcct ? " on" : ""}`}
                  onClick={() => { setHomeAcct((v) => !v); setHomeInfo(false); }}>
                  <span className="av">{user?.photoURL
                    ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : initials}</span>
                  <span className="nm">
                    <b>{userName || user?.displayName || t("Kullanıcı")}</b>
                    <span>{roleLabel(role)}</span>
                  </span>
                  <span className="ca">▾</span>
                </button>
                {homeAcct && (
                  <span className="hmacctpop">
                    <button onClick={() => { setHomeAcct(false); setProfOpen(true); }}>
                      {t("Profil ve rozetler")}</button>
                    <span className="sep" />
                    <button className="danger" onClick={() => { setHomeAcct(false); signOut(); }}>
                      {t("Çıkış yap")}</button>
                  </span>
                )}
              </span>
            </span>
          </div>

          {/* ── sürüm banner ── */}
          {verNew && (
            <div className="hmver">
              <span className="i">⬆</span>
              <span className="t">{t("Sürüm")} <b>{APP_VERSION}</b> {t("hazır")} — {t(APP_VERSION_SUMMARY)}</span>
              <span className="btns">
                <button onClick={openVersions}>{t("Neler değişti")}</button>
                <button className="go" onClick={() => window.location.reload()}>{t("Güncelle")}</button>
                <button className="later" onClick={() => { try { localStorage.setItem(SEEN_VER_KEY, APP_VERSION); } catch {} setSeenVer(APP_VERSION); }}>
                  {t("Sonra")}</button>
              </span>
            </div>
          )}

          {/* ── hero + kısayollar ── */}
          <div className="hmhero-row">
            {heroR ? (
              <div className="hmhero">
                <div className="body">
                  <span className="eyebrow">{t("Sıradaki yarış")}{heroR.round ? ` · R${heroR.round}` : ""}</span>
                  <div className="ttl">
                    <b>{heroR.name || trackName(heroR.trackId) || "—"}</b>
                    <span>{[heroR.trackId ? trackName(heroR.trackId) : "", heroR.raceTime,
                      heroR.carId ? carName(heroR.carClass, heroR.carId) : ""].filter(Boolean).join(" · ")}</span>
                  </div>
                  <div className="hmcd">
                    <div className="box"><div className="n">{pad2(cdD)}</div><div className="l">{t("gün")}</div></div>
                    <div className="box"><div className="n">{pad2(cdH)}</div><div className="l">{t("saat")}</div></div>
                    <div className="box"><div className="n">{pad2(cdM)}</div><div className="l">{t("dakika")}</div></div>
                    <div className="box wide"><div className="n sm">{heroLocal || "—"}</div>
                      <div className="l">{t("yerel saat")}</div></div>
                  </div>
                  <div className="acts">
                    <button className="open" onClick={() => openRace(nextEntry[0])}>{t("Yarışı aç")} →</button>
                    <button className="setup" onClick={() => setSuOpen(true)}>
                      {trackName(heroR.trackId)
                        ? `${trackName(heroR.trackId)} ${t("setupları")}`
                        : t("Setuplar")}{" "}
                      ({heroR.trackId
                        ? setups.filter((s) => s.track === heroR.trackId).length
                        : setups.length})</button>
                  </div>
                </div>
                <div className="vis">
                  <div className="in">
                    {heroR.trackId && (
                      <img className="flag" src={`${ASSET}flags/${TRACK_ASSET(heroR.trackId)}.png${AV}`} alt=""
                        onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    )}
                    {heroR.trackId && (
                      <img className="trk" src={`${ASSET}tracks/${TRACK_ASSET(heroR.trackId)}.png${AV}`} alt=""
                        onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="hmhero">
                <div className="body">
                  <span className="eyebrow">{t("Sıradaki yarış")}</span>
                  <div className="ttl"><b>{t("Yarış yok")}</b>
                    <span>{t("Takvime yarış ekle ya da resmi yarışlardan planla.")}</span></div>
                  <div className="acts">
                    <button className="setup" onClick={() => setRForm({})}>＋ {t("Yarış ekle")}</button>
                    <button className="setup" onClick={() => go("official")}>{t("Resmi yarışlar")}</button>
                  </div>
                </div>
              </div>
            )}

            <div className="hmqa">
              <button className="tile" onClick={() => setSuOpen(true)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--rc-brand-bright)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15.5 4a4.5 4.5 0 0 0-4 6.6L4 18.1 5.9 20l7.5-7.5A4.5 4.5 0 1 0 15.5 4Z" /></svg>
                <b>{t("Setup havuzu")}</b><span>{setups.length} {t("dosya")}
                  {suTrackCount ? ` · ${suTrackCount} ${t("pist")}` : ""}</span>
              </button>
              <button className="tile" onClick={() => go("tele")}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--rc-brand-bright)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4v16h16" /><path d="m7 14 3-3 3 2 4-5" /></svg>
                <b>{t("Telemetri")}</b><span>{t(".ld yükle · analiz")}</span>
              </button>
              <button className="tile" data-tour="chat" onClick={() => go("chat")}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--rc-brand-bright)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 4H4a1.5 1.5 0 0 0-1.5 1.5V16A1.5 1.5 0 0 0 4 17.5h3V21l4-3.5h9A1.5 1.5 0 0 0 21.5 16V5.5A1.5 1.5 0 0 0 20 4Z" /></svg>
                <b>{t("Sohbet")}{chatUnread > 0 && <span className="cnt">{chatUnread}</span>}</b>
                <span>{t("takım kanalları")}</span>
              </button>
              <button className="tile" data-tour="manage" onClick={() => go("team")}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--rc-brand-bright)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="1.4" /><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h2v5" /></svg>
                <b>{t("Takım & takvim")}</b>
                <span>{memberCount} {t("üye")} · {raceCount} {t("yarış")}</span>
              </button>
              <button className="tile official" onClick={() => go("official")}>
                <span className="ic">🏁</span>
                <span className="tx"><b>{t("Resmi yarışlar")}</b>
                  <span>{nextOfficial
                    ? `${t("Sıradaki")}: ${nextOfficial.name}${
                        nextOfficialTrack ? ` · ${nextOfficialTrack}` : ""}`
                    : t("lmugarage günlük/haftalık")}</span></span>
                {nextOfficialCd && <span className="cd">{nextOfficialCd}</span>}
              </button>
            </div>
          </div>

          {/* ── takvim ── */}
          <div className="hmcalhd" data-tour="races">
            <span className="cap">{t("Takvim")}</span>
            <span className="seg">
              <button className={`hmchip${lobCal === "up" ? " on" : ""}`}
                onClick={() => setLobCal("up")}>{t("Yaklaşan")} ({allUp.filter(inFilter).length})</button>
              <button className={`hmchip${lobCal === "past" ? " on" : ""}`}
                onClick={() => setLobCal("past")}>{t("Geçmiş")} ({allPast.filter(inFilter).length})</button>
            </span>
            {seasonChips.length > 1 && <span className="vsep" />}
            {seasonChips.length > 1 && (
              <span className="seasons">
                {seasonChips.map(([v, l]) => (
                  <button key={v} className={`hmchip${lobSeason === v ? " on" : ""}`}
                    onClick={() => setLobSeason(v)}>{l}</button>
                ))}
              </span>
            )}
            <input type="text" placeholder={t("ara: pist, yarış adı…")} value={lobQuery}
              onChange={(e) => { setLobQuery(e.target.value); setPastLimit(12); }} />
            {canEditTeam && curTeam && (
              <button className="add" onClick={() => setRForm({})}>＋ {t("Yarış ekle")}</button>
            )}
          </div>

          <div className="hmcal">
            {calEmpty ? (
              <div className="empty">
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--rc-border-strong)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
                <div className="t">{t("Bu sezonda yarış yok")}</div>
                <div className="d">{t("Takvime yarış ekle ya da resmi yarışlar listesinden planla — eklediğin yarışlar takımdaki herkeste görünür.")}</div>
                <span className="b">
                  {canEditTeam && curTeam && (
                    <button className="hmrow-cta" style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid var(--rc-brand-bright)", background: "var(--rc-brand)", color: "var(--rc-on-brand)", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}
                      onClick={() => setRForm({})}>＋ {t("Yarış ekle")}</button>
                  )}
                  <button style={{ padding: "8px 15px", borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 12.5 }}
                    onClick={() => go("official")}>{t("Resmi yarışlar")}</button>
                </span>
              </div>
            ) : calList.map((e) => CalRow(e))}
          </div>
          {lobCal === "past" && pastAll.length > pastShown.length && (
            <button className="hmmore" onClick={() => setPastLimit((n) => n + 12)}>
              ↓ {t("Daha fazla göster")}</button>
          )}

          {/* ── solo + indirmeler ── */}
          <div className="hmsolo">
            <span className="tx">
              <b>{t("Takım olmadan devam et")}</b>
              <span>{t("Yarışlarını yerel olarak kur, stint planla ve canlı timing kullan. Setup havuzu ve sohbet takım gerektirir; sonradan katılabilirsin.")}</span>
            </span>
            <button className="go" onClick={() => { setEntered(true); go("pick"); }}>
              {t("Solo devam et")} →</button>
          </div>

          <div className="hmdl">
            <div className="card">
              <span className="ic">🖥</span>
              <span className="tx"><b>{t("Masaüstü uygulaması")}</b>
                <span>{t("Tarayıcısız, kendi penceresinde açılır — canlı timing köprüsü dahil. Sonraki sürümler uygulama içinden gelir.")}</span></span>
              <a href={DESKTOP_RELEASE_URL} target="_blank" rel="noopener noreferrer">{t("İndir")}</a>
            </div>
            <div className="card">
              <span className="ic">🪶</span>
              <span className="tx"><b>{t("Hafif köprü · .exe")}</b>
                <span>{t("Oyunun çalıştığı PC için: tarayıcı motoru yok, oyunu yormaz. Paylaşımlı belleği okuyup canlı timing'i yayınlar.")}</span></span>
              <a href={BRIDGE_EXE_URL} target="_blank" rel="noopener noreferrer">{t("İndir")}</a>
            </div>
          </div>

        </div>
        )}
        </div>{/* /v2main */}
      </div>
    );
  }

  /* ---------- setup 1: pist & araç seçimi ---------- */  /* ---------- setup 1: pist & araç seçimi ---------- */
  if (!pickDone) {
    const cls = st.carClass || "hypercar";
    const clsCars = CARS[cls] || [];
    const curCar = clsCars.find((c) => c.id === st.car);
    const clsName = CAR_CLASSES.find(([id]) => id === cls)?.[1] || "";
    const disp = "var(--rc-font-display)";
    const trkPit = (id) => (PIT_LANE_TIMES[id] != null ? PIT_LANE_TIMES[id] : "—");
    const shownTracks = TRACKS.filter((tk) =>
      !trackQ.trim() || tk.name.toLowerCase().includes(trackQ.trim().toLowerCase()));
    const numBadge = { width: 22, height: 22, borderRadius: "50%", background: "var(--rc-brand)",
      color: "var(--rc-on-brand)", display: "grid", placeItems: "center", fontFamily: disp,
      fontWeight: 700, fontSize: 12, flex: "0 0 auto" };
    const secLbl = { fontFamily: disp, textTransform: "uppercase", letterSpacing: ".07em",
      fontSize: 16, fontWeight: 700 };
    const goData = () => { setPickDone(true); go("data"); };
    return (
      <div className="rc v2">
        <UpdateBanner t={t} />
        <div style={{ padding: "18px 20px 108px" }}>
          {/* --- başlık --- */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
            <button onClick={leaveRace} aria-label={t("Ana menü")}
              style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--rc-border)",
                background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 14 }}>←</button>
            <h2 style={{ margin: 0, fontFamily: disp, textTransform: "uppercase", letterSpacing: ".06em",
              fontSize: 22, fontWeight: 700 }}>{t("Pist & araç")}</h2>
            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em",
              padding: "4px 11px", borderRadius: 99, border: "1px solid var(--rc-border-strong)",
              color: "var(--rc-text-3)" }}>
              {curRace ? (races[curRace]?.name || curRace) : t("Solo mod · veriler bu cihazda")}</span>
          </div>

          {/* --- 1 · Pist seç + önizleme --- */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start", marginBottom: 22 }}>
            <div style={{ flex: "1 1 520px", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={numBadge}>1</span>
                <span style={secLbl}>{t("Pist seç")}</span>
                <input type="search" placeholder={t("Pist ara…")} value={trackQ}
                  onChange={(e) => setTrackQ(e.target.value)}
                  style={{ marginLeft: "auto", background: "var(--rc-surface-3)",
                    border: "1px solid var(--rc-border)", borderRadius: 9, color: "var(--rc-text)",
                    fontSize: 12.5, padding: "7px 12px", width: 180 }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(168px,1fr))", gap: 9 }}>
                {shownTracks.map((tk) => {
                  const sel = st.track === tk.id;
                  return (
                    <button key={tk.id}
                      onClick={() => up({ track: tk.id,
                        ...(PIT_LANE_TIMES[tk.id] != null ? { pitLaneTime: PIT_LANE_TIMES[tk.id] } : {}) })}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                        borderRadius: 11, cursor: "pointer", color: "var(--rc-text)", minWidth: 0,
                        border: `1px solid ${sel ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
                        background: sel ? "rgba(150,0,24,.22)" : "var(--rc-surface-2)" }}>
                      <img src={`${ASSET}flags/${TRACK_ASSET(tk.id)}.png`} alt=""
                        style={{ width: 26, borderRadius: 3, border: "1px solid var(--rc-border)", flex: "0 0 auto" }}
                        onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                      <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, textAlign: "left" }}>
                        <b style={{ fontFamily: disp, fontSize: 15, whiteSpace: "nowrap",
                          overflow: "hidden", textOverflow: "ellipsis" }}>{tk.name}</b>
                        <span style={{ fontSize: 10.5, color: "var(--rc-text-3)" }}>
                          {t("Pit kaybı")} {trkPit(tk.id)}s</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ flex: "1 1 300px", minWidth: 280, border: "1px solid var(--rc-border)",
              borderRadius: 12, background: "var(--rc-surface)", padding: 18, textAlign: "center" }}>
              {st.track ? (
                <>
                  <img key={st.track} src={`${ASSET}tracks/${TRACK_ASSET(st.track)}.png${AV}`} alt=""
                    style={{ display: "block", width: "100%", maxWidth: 280, height: "auto", margin: "0 auto",
                      filter: "drop-shadow(0 6px 18px rgba(0,0,0,.5))" }}
                    onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  <div style={{ fontFamily: disp, fontWeight: 700, fontSize: 19, marginTop: 12 }}>
                    {trackName(st.track)}</div>
                  <div style={{ color: "var(--rc-text-3)", fontSize: 11.5, marginTop: 3 }}>
                    {t("Pit kaybı")} {trkPit(st.track)} {t("sn · seçili pist")}</div>
                </>
              ) : (
                <div style={{ color: "var(--rc-text-3)", fontSize: 12.5, padding: "40px 0" }}>
                  {t("Önizleme için bir pist seç")}</div>
              )}
            </div>
          </div>

          {/* --- 2 · Sınıf seç --- */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={numBadge}>2</span>
              <span style={secLbl}>{t("Sınıf seç")}</span>
            </div>
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
              {CAR_CLASSES.map(([id, name]) => {
                const sel = cls === id;
                const hasCars = (CARS[id] || []).length;
                return (
                  <button key={id}
                    onClick={() => up({ carClass: id, car: (CARS[id] || [])[0]?.id || "" })}
                    style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 16px",
                      borderRadius: 11, cursor: "pointer", color: "var(--rc-text)",
                      border: `1px solid ${sel ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
                      background: sel ? "rgba(150,0,24,.22)" : "var(--rc-surface-2)", opacity: hasCars ? 1 : 0.5 }}>
                    <img src={`${ASSET}class/${id}.png`} alt="" style={{ height: 22, flex: "0 0 auto" }}
                      onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    <span style={{ fontFamily: disp, fontWeight: 700, fontSize: 15, letterSpacing: ".03em" }}>{name}</span>
                    <span style={{ fontSize: 10.5, color: "var(--rc-text-3)" }}>{hasCars} {t("araç")}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* --- 3 · Araç seç --- */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={numBadge}>3</span>
              <span style={secLbl}>{t("Araç seç")}</span>
              <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{clsName} · {clsCars.length} {t("araç")}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 12 }}>
              {clsCars.map((c) => {
                const sel = st.car === c.id;
                return (
                  <button key={c.id} onClick={() => up({ carClass: cls, car: c.id })}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center",
                      padding: "14px 14px 12px", borderRadius: 12, cursor: "pointer", color: "var(--rc-text)",
                      border: `1px solid ${sel ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
                      background: sel ? "rgba(150,0,24,.16)" : "var(--rc-surface-2)" }}>
                    <img src={carImageSrc(teamData?.assets, cls, c.id, "side")} alt="" loading="lazy"
                      style={{ width: "100%", height: 96, objectFit: "contain", display: "block" }}
                      onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                    <span style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, width: "100%" }}>
                      <b style={{ fontFamily: disp, fontSize: 15, textAlign: "left", flex: 1, minWidth: 0,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</b>
                      {sel && <span style={{ color: "var(--rc-ok)", fontSize: 14, flex: "0 0 auto" }}>✓</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* --- sabit alt özet çubuğu --- */}
          <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30, display: "flex",
            alignItems: "center", gap: 16, flexWrap: "wrap", padding: "13px 20px",
            borderTop: "1px solid var(--rc-border-strong)", background: "rgba(18,12,14,.96)",
            backdropFilter: "blur(8px)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", minWidth: 0 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {st.track && <img src={`${ASSET}flags/${TRACK_ASSET(st.track)}.png`} alt=""
                  style={{ width: 22, borderRadius: 2 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <b style={{ fontFamily: disp, fontSize: 15 }}>{st.track ? trackName(st.track) : t("Seçilmedi")}</b>
                  <span style={{ fontSize: 10, color: "var(--rc-text-3)", textTransform: "uppercase", letterSpacing: ".08em" }}>{t("Pist")}</span>
                </span>
              </span>
              <span style={{ width: 1, height: 26, background: "var(--rc-border)" }} />
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <img src={`${ASSET}class/${cls}.png`} alt="" style={{ height: 18 }}
                  onError={(e) => { e.currentTarget.style.display = "none"; }} />
                <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <b style={{ fontFamily: disp, fontSize: 15 }}>{clsName}</b>
                  <span style={{ fontSize: 10, color: "var(--rc-text-3)", textTransform: "uppercase", letterSpacing: ".08em" }}>{t("Sınıf")}</span>
                </span>
              </span>
              <span style={{ width: 1, height: 26, background: "var(--rc-border)" }} />
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <b style={{ fontFamily: disp, fontSize: 15, color: curCar ? "var(--rc-text)" : "var(--rc-text-3)" }}>
                    {curCar ? curCar.name : t("Seçilmedi")}</b>
                  <span style={{ fontSize: 10, color: "var(--rc-text-3)", textTransform: "uppercase", letterSpacing: ".08em" }}>{t("Araç")}</span>
                </span>
              </span>
            </span>
            <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button onClick={goData}
                style={{ background: "none", border: "none", color: "var(--rc-text-3)", cursor: "pointer",
                  fontSize: 12.5, textDecoration: "underline", textUnderlineOffset: 3 }}>
                {t("Seçim yapmadan geç →")}</button>
              <button onClick={goData} disabled={!st.car}
                style={{ padding: "11px 22px", borderRadius: 10, cursor: st.car ? "pointer" : "not-allowed",
                  fontFamily: disp, fontSize: 16, fontWeight: 700, letterSpacing: ".04em",
                  textTransform: "uppercase", whiteSpace: "nowrap",
                  border: `1px solid ${st.car ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
                  background: st.car ? "var(--rc-brand)" : "var(--rc-surface-3)",
                  color: st.car ? "var(--rc-on-brand)" : "var(--rc-text-3)" }}>
                {t("✓ Devam et — yarış dataları")}</button>
            </span>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- setup 2: yarış datalarını gir (12-yaris-datalari.md · birebir) ---------- */
  if (!setupDone) {
    const disp = "var(--rc-font-display)";
    const cls = st.carClass || "hypercar";
    const curCar = (CARS[cls] || []).find((c) => c.id === st.car);
    const wxNow = WEATHER[st.weather] || WEATHER.dry;
    /* strateji değeri = stint uzunluğu (tur/stint). Pit sayısı buradan TÜRETİLİR
       (model pit sayısı saklamaz) → toplam tur / stint tur − 1. */
    const stopsOf = (L) => Math.max(0, Math.ceil((racePlan.totalLaps || 0) / (Number(L) || 1)) - 1);
    const stintDur = (L) => fmtHMS(Math.max(0, Number(L) || 0) * parseLap(st.avgLap));
    const chosenLaps = st.strategies[st.chosen] || 0;
    const chosenStops = stopsOf(chosenLaps);
    const pitPer = (Number(st.pitLaneTime) || 0) + (Number(st.fuelTime) || 0);
    const pitRaceSec = pitPer * chosenStops;
    const pitRace = `${Math.floor(pitRaceSec / 60)}:${String(Math.round(pitRaceSec % 60)).padStart(2, "0")}`;
    const tankRange = st.consumption ? Math.round(100 / Number(st.consumption)) : 0;
    const streamOn = !!ytId(st.streamUrl);
    const wxFuture = (st.weatherLog || []).filter((e) => e.t > 0.5);
    /* hava seçimi: kurulum ekranında yarış canlı değil → el=0; yine de dataCardsWith
       ile BİREBİR aynı handler (weather + weatherLog) korunur. */
    const pickWx = (id) => {
      const el = liveInfo.status === "live"
        ? Math.max(0, Math.round(liveInfo.elapsed / 1000)) : 0;
      let past = (st.weatherLog || []).filter((e) => e.t < el - 0.5);
      const future = (st.weatherLog || []).filter((e) => e.t > el + 0.5);
      if (el < 1) past = [];
      const log = [...past, { t: el, w: id, src: "live" }, ...future].sort((a, b) => a.t - b.t);
      const cur = wxAtRel(log, el);
      up({ weather: Object.keys(WEATHER).find((k) => WEATHER[k] === cur) || id, weatherLog: log });
    };
    const goPick = () => setPickDone(false);
    const goLive = () => { setSetupDone(true); go("dash"); };

    const card = { border: "1px solid var(--rc-border)", borderRadius: 12,
      background: "var(--rc-surface)", padding: "16px 18px" };
    const cardTtl = { fontFamily: disp, textTransform: "uppercase", letterSpacing: ".08em",
      fontSize: 16, fontWeight: 700 };
    const lbl = { display: "block", color: "var(--rc-text-3)", fontSize: 10,
      textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 };
    const subttl = { fontSize: 11.5, color: "var(--rc-text-3)" };
    const stBtn = { width: 38, height: 44, border: "none", background: "var(--rc-surface-3)",
      color: "var(--rc-text-2)", cursor: "pointer", fontSize: 16 };
    const stepper = (val, onDec, onInc) => (
      <span style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--rc-border)",
        borderRadius: 10, overflow: "hidden" }}>
        <button onClick={onDec} style={stBtn}>−</button>
        <b style={{ minWidth: 52, textAlign: "center", fontFamily: disp, fontSize: 19 }}>{val}</b>
        <button onClick={onInc} style={stBtn}>+</button>
      </span>
    );
    const mcBtn = { display: "flex", alignItems: "center", gap: 10, width: "100%",
      padding: "10px 13px", borderRadius: 10, cursor: "pointer", color: "var(--rc-text)",
      border: `1px solid ${st.multiclass ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
      background: st.multiclass ? "rgba(150,0,24,.18)" : "var(--rc-surface-3)" };
    const mcBox = { width: 20, height: 20, borderRadius: 6, flex: "0 0 auto", display: "grid",
      placeItems: "center", fontSize: 11,
      border: `1px solid ${st.multiclass ? "var(--rc-brand-bright)" : "var(--rc-border-strong)"}`,
      background: st.multiclass ? "var(--rc-brand)" : "transparent",
      color: st.multiclass ? "var(--rc-on-brand)" : "transparent" };
    const streamChip = streamOn
      ? { fontSize: 10, textTransform: "uppercase", letterSpacing: ".09em", padding: "3px 10px",
          borderRadius: 99, border: "1px solid var(--rc-ok)", color: "var(--rc-ok)" }
      : { display: "none" };
    const streamPrev = streamOn
      ? { position: "relative", display: "block", marginTop: 12, height: 112, borderRadius: 10,
          border: "1px solid var(--rc-border)", background: "var(--rc-surface-2)", overflow: "hidden" }
      : { display: "none" };
    const streamHint = streamOn
      ? { display: "none" }
      : { display: "block", marginTop: 10, fontSize: 11.5, color: "var(--rc-text-3)", lineHeight: 1.5 };

    return (
      <div className="rc v2">
        <UpdateBanner t={t} />
        <div style={{ padding: "18px 20px 108px" }}>
          {/* --- başlık --- */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
            <button onClick={goPick} aria-label={t("Geri")}
              style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--rc-border)",
                background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 14 }}>←</button>
            <h2 style={{ margin: 0, fontFamily: disp, textTransform: "uppercase", letterSpacing: ".06em",
              fontSize: 22, fontWeight: 700 }}>{t("Yarış dataları")}</h2>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--rc-text-2)" }}>
              {st.track && <img src={`${ASSET}flags/${TRACK_ASSET(st.track)}.png`} alt=""
                style={{ width: 20, borderRadius: 2 }}
                onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />}
              {trackName(st.track) || t("Seçilmedi")}
              <span style={{ color: "var(--rc-border-strong)" }}>·</span>
              <img src={`${ASSET}class/${cls}.png`} alt="" style={{ height: 16 }}
                onError={(e) => { e.currentTarget.style.display = "none"; }} />
              {curCar ? curCar.name : t("Seçilmedi")}
            </span>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>

            {/* ===== SOL KOLON ===== */}
            <div style={{ flex: "1 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Yarış */}
              <div style={card}>
                <div style={{ ...cardTtl, marginBottom: 14 }}>{t("Yarış")}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                  <div style={{ flex: "1 1 170px", minWidth: 0 }}>
                    <label style={lbl}>{t("Yarış süresi · h:mm:ss")}</label>
                    <input type="text" value={st.raceTime}
                      onChange={(e) => up({ raceTime: e.target.value })}
                      style={{ width: "100%", boxSizing: "border-box", background: "var(--rc-surface-3)",
                        border: "1px solid var(--rc-border-strong)", borderRadius: 10, color: "var(--rc-text)",
                        padding: "12px 14px", fontFamily: disp, fontSize: 22, fontWeight: 600 }} />
                  </div>
                  <div style={{ flex: "1 1 170px", minWidth: 0 }}>
                    <label style={lbl}>{t("Ortalama tur · m:ss.00")}</label>
                    <input type="text" value={st.avgLap}
                      onChange={(e) => up({ avgLap: e.target.value })}
                      style={{ width: "100%", boxSizing: "border-box", background: "var(--rc-surface-3)",
                        border: "1px solid var(--rc-border-strong)", borderRadius: 10, color: "var(--rc-text)",
                        padding: "12px 14px", fontFamily: disp, fontSize: 22, fontWeight: 600 }} />
                    {avgSug && canEdit && (
                      <button onClick={() => up({ avgLap: avgSug.txt })}
                        style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 7,
                          padding: "7px 12px", borderRadius: 9, border: "1px solid rgba(55,214,122,.45)",
                          background: "rgba(55,214,122,.10)", color: "var(--rc-ok)", cursor: "pointer",
                          fontSize: 11.5, width: "100%" }}>
                        ⚡ {t("Canlı AVG5")} <b style={{ fontFamily: disp }}>{avgSug.txt}</b> — {t("uygula")}</button>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 14, alignItems: "flex-end" }}>
                  <div style={{ flex: "0 0 auto" }}>
                    <label style={lbl}>{t("Ekstra tur")}</label>
                    {stepper(st.extraLap,
                      () => up({ extraLap: Math.max(0, (st.extraLap || 0) - 1) }),
                      () => up({ extraLap: (st.extraLap || 0) + 1 }))}
                  </div>
                  <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                    <button onClick={() => up({ multiclass: !st.multiclass })} style={mcBtn}>
                      <span style={mcBox}>✓</span>
                      <span style={{ display: "flex", flexDirection: "column", gap: 1, textAlign: "left" }}>
                        <b style={{ fontSize: 13 }}>{t("Multiclass yarış")}</b>
                        <span style={{ fontSize: 10.5, color: "var(--rc-text-3)" }}>{t("Lider sınıfa göre bayrak hesabı")}</span>
                      </span>
                    </button>
                  </div>
                </div>
                {st.multiclass && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 14,
                    paddingTop: 14, borderTop: "1px solid var(--rc-border)" }}>
                    <div style={{ flex: "1 1 170px", minWidth: 0 }}>
                      <label style={lbl}>{t("Lider sınıf")}</label>
                      <select value={st.leaderClass} onChange={(e) => up({ leaderClass: e.target.value })}
                        style={{ width: "100%", boxSizing: "border-box", background: "var(--rc-surface-3)",
                          border: "1px solid var(--rc-border)", borderRadius: 10, color: "var(--rc-text)",
                          padding: "11px 12px", fontSize: 13 }}>
                        {CAR_CLASSES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: "1 1 170px", minWidth: 0 }}>
                      <label style={lbl}>{t("Lider tur · m:ss.00")}</label>
                      <input type="text" value={st.leaderLap} placeholder={st.avgLap}
                        onChange={(e) => up({ leaderLap: e.target.value })}
                        style={{ width: "100%", boxSizing: "border-box", background: "var(--rc-surface-3)",
                          border: "1px solid var(--rc-border)", borderRadius: 10, color: "var(--rc-text)",
                          padding: "11px 12px", fontFamily: disp, fontSize: 17 }} />
                    </div>
                    {racePlan.flagExtra > 0.5 && (
                      <div style={{ flex: "1 1 100%", fontSize: 11.5, color: "var(--rc-warn)" }}>
                        🏁 {t("Lider bayrağı")}: +{racePlan.flagExtra.toFixed(0)}s → {t("son tur otomatik eklenir")}</div>
                    )}
                  </div>
                )}
              </div>

              {/* Strateji */}
              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span style={cardTtl}>{t("Strateji")}</span>
                  <span style={subttl}>{t("Pit sayısına göre stint uzunluğu")}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
                  {["A", "B", "C", "D"].map((k) => {
                    const L = st.strategies[k] || 0;
                    const on = k === st.chosen;
                    return (
                      <div key={k} onClick={() => up({ chosen: k })}
                        style={{ display: "flex", flexDirection: "column", alignItems: "flex-start",
                          padding: "13px 14px", borderRadius: 11, cursor: "pointer", color: "var(--rc-text)",
                          border: `1px solid ${on ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
                          background: on ? "rgba(150,0,24,.22)" : "var(--rc-surface-2)" }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                          <b style={{ fontFamily: disp, fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{k}</b>
                          <span style={{ fontSize: 11.5, color: on ? "var(--rc-text)" : "var(--rc-text-3)" }}>
                            {stopsOf(L)} {t("pit")}</span>
                        </div>
                        <div style={{ fontFamily: disp, fontSize: 15, marginTop: 8 }}>{stintDur(L)}</div>
                        <div style={{ fontSize: 10, color: "var(--rc-text-3)", textTransform: "uppercase",
                          letterSpacing: ".08em", marginTop: 2 }}>{t("stint")} · {L} {t("tur")}</div>
                        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                          <button onClick={(e) => { e.stopPropagation();
                            up({ strategies: { ...st.strategies, [k]: Math.max(0, L - 1) } }); }}
                            style={{ width: 30, height: 26, borderRadius: 7, border: "1px solid var(--rc-border)",
                              background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer",
                              fontSize: 13, lineHeight: 1 }}>−</button>
                          <button onClick={(e) => { e.stopPropagation();
                            up({ strategies: { ...st.strategies, [k]: L + 1 } }); }}
                            style={{ width: 30, height: 26, borderRadius: 7, border: "1px solid var(--rc-border)",
                              background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer",
                              fontSize: 13, lineHeight: 1 }}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pit · süreler */}
              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span style={cardTtl}>{t("Pit · süreler")}</span>
                  <span style={subttl}>{t("saniye")}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                  <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                    <label style={lbl}>{t("Pit line")}</label>
                    <input type="text" value={st.pitLaneTime}
                      onChange={(e) => up({ pitLaneTime: parseFloat(e.target.value) || 0 })}
                      style={{ width: "100%", boxSizing: "border-box", background: "var(--rc-surface-3)",
                        border: "1px solid var(--rc-border-strong)", borderRadius: 10, color: "var(--rc-text)",
                        padding: "11px 13px", fontFamily: disp, fontSize: 19, fontWeight: 600 }} />
                    {st.track && PIT_LANE_TIMES[st.track] != null && (
                      <div style={{ fontSize: 10.5, color: "var(--rc-text-3)", marginTop: 5 }}>
                        {t("Pist verisi")}: {PIT_LANE_TIMES[st.track]}s · {trackName(st.track)}</div>
                    )}
                  </div>
                  <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                    <label style={lbl}>⛽ {t("Yakıt & VE")}</label>
                    <input type="text" value={st.fuelTime}
                      onChange={(e) => up({ fuelTime: parseFloat(e.target.value) || 0 })}
                      style={{ width: "100%", boxSizing: "border-box", background: "var(--rc-surface-3)",
                        border: "1px solid var(--rc-border)", borderRadius: 10, color: "var(--rc-text)",
                        padding: "11px 13px", fontFamily: disp, fontSize: 19, fontWeight: 600 }} />
                    <div style={{ fontSize: 10.5, color: "var(--rc-text-3)", marginTop: 5 }}>
                      {t("Duraklamada geçen dolum süresi")}</div>
                  </div>
                  <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                    <label style={lbl}>🛞 {t("Lastik limiti · adet")}</label>
                    {stepper(st.tyreLimit,
                      () => up({ tyreLimit: Math.max(0, (st.tyreLimit || 0) - 1) }),
                      () => up({ tyreLimit: (st.tyreLimit || 0) + 1 }))}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, padding: "11px 14px",
                  borderRadius: 10, border: "1px solid var(--rc-border)", background: "var(--rc-surface-2)", flexWrap: "wrap" }}>
                  <span style={subttl}>{t("Toplam pit kaybı")}</span>
                  <b style={{ fontFamily: disp, fontSize: 17 }}>{pitPer} {t("sn")}</b>
                  <span style={{ color: "var(--rc-border-strong)" }}>·</span>
                  <span style={subttl}>{chosenStops} {t("pit")} {t("ile yarış boyunca")}</span>
                  <b style={{ fontFamily: disp, fontSize: 17, color: "var(--rc-warn)" }}>{pitRace}</b>
                </div>
              </div>

              {/* Virtual Energy */}
              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span style={cardTtl}>⚡ Virtual Energy</span>
                  <span style={subttl}>{t("Tüketim ve yakıt karşılığı")}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                  <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                    <label style={lbl}>{t("VE tüketim · %/tur")}</label>
                    <input type="text" value={st.consumption}
                      onChange={(e) => up({ consumption: parseFloat(e.target.value) || 0 })}
                      style={{ width: "100%", boxSizing: "border-box", background: "var(--rc-surface-3)",
                        border: "1px solid var(--rc-border-strong)", borderRadius: 10, color: "var(--rc-text)",
                        padding: "11px 13px", fontFamily: disp, fontSize: 19, fontWeight: 600 }} />
                  </div>
                  <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                    <label style={lbl}>{t("Fuel ratio · L / %1")}</label>
                    <input type="text" value={st.fuelRatio}
                      onChange={(e) => up({ fuelRatio: parseFloat(e.target.value) || 0 })}
                      style={{ width: "100%", boxSizing: "border-box", background: "var(--rc-surface-3)",
                        border: "1px solid var(--rc-border)", borderRadius: 10, color: "var(--rc-text)",
                        padding: "11px 13px", fontFamily: disp, fontSize: 19, fontWeight: 600 }} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                  <div style={{ flex: "1 1 150px", padding: "11px 14px", borderRadius: 10,
                    border: "1px solid rgba(55,214,122,.35)", background: "rgba(55,214,122,.07)" }}>
                    <div style={{ fontFamily: disp, fontSize: 19, fontWeight: 600, color: "var(--rc-ok)" }}>
                      {fuelCarried.toFixed(1)} L</div>
                    <div style={{ color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase",
                      letterSpacing: ".08em", marginTop: 3 }}>{t("%100 = taşınan yakıt")}</div>
                  </div>
                  <div style={{ flex: "1 1 150px", padding: "11px 14px", borderRadius: 10,
                    border: "1px solid var(--rc-border)", background: "var(--rc-surface-2)" }}>
                    <div style={{ fontFamily: disp, fontSize: 19, fontWeight: 600 }}>{tankRange} {t("tur")}</div>
                    <div style={{ color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase",
                      letterSpacing: ".08em", marginTop: 3 }}>{t("Tam depo menzili")}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ===== SAĞ KOLON ===== */}
            <div style={{ flex: "1 1 340px", minWidth: 300, display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Plan özeti */}
              <div style={{ border: "1px solid var(--rc-border-strong)", borderRadius: 12,
                background: "radial-gradient(120% 160% at 100% 0,rgba(150,0,24,.22),var(--rc-surface-2) 62%)",
                padding: "16px 18px" }}>
                <div style={{ fontFamily: disp, textTransform: "uppercase", letterSpacing: ".08em",
                  fontSize: 13, fontWeight: 700, color: "var(--rc-brand-bright)", marginBottom: 12 }}>{t("Plan özeti")}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ flex: "0 0 auto", textAlign: "center" }}>
                    {st.track && <img src={`${ASSET}tracks/${TRACK_ASSET(st.track)}.png${AV}`} alt=""
                      style={{ display: "block", width: 104, height: 64, objectFit: "contain" }}
                      onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5,
                      color: "var(--rc-text-2)", marginTop: 2 }}>
                      {st.track && <img src={`${ASSET}flags/${TRACK_ASSET(st.track)}.png`} alt=""
                        style={{ width: 15, borderRadius: 2 }}
                        onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />}
                      {trackName(st.track) || t("Seçilmedi")}</span>
                  </div>
                  <span style={{ width: 1, alignSelf: "stretch", background: "var(--rc-border-strong)" }} />
                  <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
                    {st.car && <img src={carImageSrc(teamData?.assets, cls, st.car, "side")} alt=""
                      style={{ display: "block", width: "100%", maxWidth: 170, height: 64,
                        objectFit: "contain", margin: "0 auto" }}
                      onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5,
                      color: "var(--rc-text-2)", marginTop: 2 }}>
                      <img src={`${ASSET}class/${cls}.png`} alt="" style={{ height: 13 }}
                        onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      {curCar ? curCar.name : t("Seçilmedi")}</span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingTop: 12,
                  borderTop: "1px solid var(--rc-border-strong)" }}>
                  <div>
                    <div style={{ fontFamily: disp, fontWeight: 700, fontSize: 24, lineHeight: 1 }}>
                      {(racePlan.totalLaps || 0).toFixed(0)}</div>
                    <div style={{ color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase",
                      letterSpacing: ".08em", marginTop: 2 }}>{t("Toplam tur")}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: disp, fontWeight: 700, fontSize: 24, lineHeight: 1 }}>
                      {st.chosen} · {chosenStops} {t("pit")}</div>
                    <div style={{ color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase",
                      letterSpacing: ".08em", marginTop: 2 }}>{t("Seçili strateji")}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: disp, fontWeight: 600, fontSize: 19, lineHeight: 1.2 }}>
                      {stintDur(chosenLaps)}</div>
                    <div style={{ color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase",
                      letterSpacing: ".08em", marginTop: 2 }}>{t("Stint uzunluğu")}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: disp, fontWeight: 600, fontSize: 19, lineHeight: 1.2 }}>
                      {st.pitLaneTime} {t("sn")}</div>
                    <div style={{ color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase",
                      letterSpacing: ".08em", marginTop: 2 }}>{t("Pit kaybı")}</div>
                  </div>
                </div>
              </div>

              {/* Yarış başlangıcı */}
              <div style={card}>
                <div style={{ ...cardTtl, marginBottom: 14 }}>{t("Yarış başlangıcı")}</div>
                <label style={lbl}>{t("Start tarih & saat")}</label>
                <input type="datetime-local" value={msToLocalInput(st.raceStartMs)}
                  onChange={(e) => { const ms = new Date(e.target.value).getTime();
                    if (!isNaN(ms)) up({ raceStartMs: ms }); }}
                  style={{ width: "100%", boxSizing: "border-box", background: "var(--rc-surface-3)",
                    border: "1px solid var(--rc-border-strong)", borderRadius: 10, color: "var(--rc-text)",
                    padding: "11px 13px", fontFamily: disp, fontSize: 15 }} />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  <button onClick={() => up({ raceStartMs: Date.now() })}
                    style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--rc-border)",
                      background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 11.5 }}>
                    {t("Şimdi")}</button>
                  <button onClick={() => up({ raceStartMs: (st.raceStartMs || Date.now()) + 15 * 60000 })}
                    style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--rc-border)",
                      background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 11.5 }}>
                    {t("+15 dk")}</button>
                  <button onClick={() => up({ raceStartMs: (st.raceStartMs || Date.now()) + 3600000 })}
                    style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--rc-border)",
                      background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 11.5 }}>
                    {t("+1 sa")}</button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, padding: "12px 14px",
                  borderRadius: 10, border: "1px solid rgba(55,214,122,.35)", background: "rgba(55,214,122,.07)" }}>
                  <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em",
                    color: "var(--rc-text-3)" }}>{t("Hesaplanan bitiş")}</span>
                  <b style={{ marginLeft: "auto", fontFamily: disp, fontSize: 22, color: "var(--rc-ok)" }}>
                    {driverPlan ? fmtClock(driverPlan.finishMs, driverPlan.startMs) : "—"}</b>
                </div>
              </div>

              {/* Hava durumu */}
              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={cardTtl}>{t("Hava durumu")}</span>
                  <span style={{ marginLeft: "auto", ...subttl }}>{t("Efektif tur")} ×{wxNow.lap.toFixed(2)}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 7 }}>
                  {Object.entries(WEATHER).map(([id, w]) => {
                    const on = id === st.weather;
                    return (
                      <button key={id} onClick={() => pickWx(id)}
                        style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "9px 4px",
                          borderRadius: 10, cursor: "pointer", textAlign: "center",
                          border: `1px solid ${on ? w.col : "var(--rc-border)"}`,
                          background: on ? "rgba(255,255,255,.05)" : "var(--rc-surface-3)",
                          color: on ? w.col : "var(--rc-text-2)" }}>
                        <WetIcon id={id} size={24} />
                        <span style={{ fontSize: 11, marginTop: 4, lineHeight: 1.2 }}>{t(w.lbl)}</span>
                        <span style={{ fontFamily: disp, fontSize: 10, color: "var(--rc-text-3)", marginTop: 2 }}>
                          ×{w.lap.toFixed(2)}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--rc-border)",
                  display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={subttl}>{t("Planlı geçiş")}</span>
                  {wxFuture.map((e, i) => (
                    <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
                      borderRadius: 99, border: "1px solid var(--rc-info)", color: "var(--rc-info)", fontSize: 11.5 }}>
                      {fmtHMS(e.t)} · {t(WEATHER[e.w]?.lbl || "Dry")}</span>
                  ))}
                  <button onClick={() => setWxHist(true)}
                    style={{ padding: "5px 11px", borderRadius: 8, border: "1px dashed var(--rc-border-strong)",
                      background: "transparent", color: "var(--rc-text-3)", cursor: "pointer", fontSize: 11.5 }}>
                    ＋ {t("Geçiş ekle")}</button>
                </div>
              </div>

              {/* Canlı yayın */}
              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={cardTtl}>📺 {t("Canlı yayın")}</span>
                  <span style={streamChip}>{t("bağlı")}</span>
                </div>
                <label style={lbl}>{t("YouTube linki")}</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="text" value={st.streamUrl} placeholder="https://youtube.com/watch?v=…"
                    onChange={(e) => up({ streamUrl: e.target.value })}
                    style={{ flex: 1, minWidth: 0, background: "var(--rc-surface-3)",
                      border: "1px solid var(--rc-border-strong)", borderRadius: 10, color: "var(--rc-text)",
                      padding: "11px 13px", fontSize: 12.5, fontFamily: disp }} />
                  <button onClick={() => up({ streamUrl: "" })}
                    style={{ padding: "0 14px", borderRadius: 10, border: "1px solid var(--rc-border)",
                      background: "var(--rc-surface-3)", color: "var(--rc-text-3)", cursor: "pointer", fontSize: 13 }}>
                    {t("Temizle")}</button>
                </div>
                <div style={streamPrev}>
                  <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center",
                    color: "var(--rc-border-strong)", fontSize: 26 }}>▶</span>
                  <span style={{ position: "absolute", left: 9, bottom: 8, fontSize: 10.5, color: "var(--rc-text-2)",
                    background: "rgba(11,7,8,.75)", padding: "3px 8px", borderRadius: 6 }}>
                    {t("Köşedeki mini oynatıcıda gösteriliyor")}</span>
                </div>
                <div style={streamHint}>{t("Geçerli bir YouTube linki yapıştır; köşede mini oynatıcı açılır.")}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                  <button style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--rc-border)",
                    background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 11.5 }}>
                    ◤ {t("Sol üst")}</button>
                  <button style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--rc-brand-bright)",
                    background: "rgba(150,0,24,.22)", color: "var(--rc-text)", cursor: "pointer", fontSize: 11.5 }}>
                    ◢ {t("Sağ alt")}</button>
                  <button style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--rc-border)",
                    background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 11.5 }}>
                    {t("Boyut: orta")}</button>
                </div>
              </div>
            </div>
          </div>

          {/* --- sabit alt çubuk --- */}
          <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30, display: "flex",
            alignItems: "center", gap: 16, flexWrap: "wrap", padding: "13px 20px",
            borderTop: "1px solid var(--rc-border-strong)", background: "rgba(18,12,14,.96)",
            backdropFilter: "blur(8px)" }}>
            <span style={{ fontSize: 12, color: "var(--rc-text-3)" }}>
              {t("Dataları sonradan sol panelden değiştirebilirsin")}</span>
            <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={goPick}
                style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid var(--rc-border)",
                  background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 13 }}>
                {t("Geri")}</button>
              <button onClick={goLive}
                style={{ padding: "11px 24px", borderRadius: 10, border: "1px solid var(--rc-brand-bright)",
                  background: "var(--rc-brand)", color: "var(--rc-on-brand)", cursor: "pointer",
                  fontFamily: disp, fontSize: 16, fontWeight: 700, letterSpacing: ".04em",
                  textTransform: "uppercase" }}>
                {t("Yarışı aç →")}</button>
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rc v2">
      {/* v2.0 kabuk: 76px sol ray tüm yarış ekranlarında sabit; sekme çubuğunun
          yerini aldı. Ray tıklamayla kayarak gizlenir (‹ / açma tırnağı). */}
      <Rail t={t} screen={screen} go={go} onHome={leaveRace}
        open={railOpen} onToggle={() => setRailOpen((v) => !v)}
        version={APP_VERSION} chatScreen="chat" unread={raceUnread} />
      <div className="v2main">
      <UpdateBanner t={t} />
      {teamModal}{createJoinModal}{raceForm}{versionModal}{chatModal}{tourOverlay}{streamPlayer}{setupModal}{setupContentModal}{setupCompareModal}{cmpBar}
      {denyToast}{cmdPalette}{raceDataPanel}{pdfPreview}
      {profileModal}
      {adminOpen && isAdmin && (
        <div className="wxmodal" onClick={() => setAdminOpen(false)}>
          <div className="wxmbox" style={{ width: "min(620px,95vw)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="wxmhead">
              <span>🛡 {t("Üye Yönetimi")}</span>
              <span className="hint" style={{ margin: 0, fontSize: 11.5 }}>
                {t("Site geneli erişim onayı")}</span>
              <button className="lbclose" onClick={() => setAdminOpen(false)}>✕</button>
            </div>
            {(() => {
              const entries = Object.entries(allUsers);
              const cntAll = entries.length;
              const cntPending = entries.filter(([, u]) => u?.requested && !u?.allowed
                && u?.admin !== true).length;
              const cntAllowed = entries.filter(([, u]) => u?.allowed || u?.admin === true).length;
              const q = adminQ.trim().toLowerCase();
              const rows = entries
                .filter(([uid, u]) => {
                  if (adminFilter === "pending"
                    && !(u?.requested && !u?.allowed && u?.admin !== true)) return false;
                  if (adminFilter === "allowed" && !(u?.allowed || u?.admin === true)) return false;
                  if (!q) return true;
                  return `${u?.name || ""} ${u?.email || uid}`.toLowerCase().includes(q);
                })
                .sort(([, a], [, b]) => (b?.requestedAt || 0) - (a?.requestedAt || 0));
              const chip = (id, label, n) => (
                <button className={`hmchip${adminFilter === id ? " on" : ""}`}
                  style={{ whiteSpace: "nowrap" }}
                  onClick={() => setAdminFilter(id)}>{label} {n}</button>
              );
              return (<>
            <div className="admfilter">
              <input type="search" value={adminQ} onChange={(e) => setAdminQ(e.target.value)}
                placeholder={t("E-posta veya ad ara…")} />
              <span className="chips">
                {chip("all", t("Tümü"), cntAll)}
                {chip("pending", t("Beklemede"), cntPending)}
                {chip("allowed", t("Erişim var"), cntAllowed)}
              </span>
            </div>
            <div className="wxmlist">
              {cntAll === 0 && (
                <div className="hint" style={{ padding: 12 }}>{t("Kayıt yok.")}</div>
              )}
              {cntAll > 0 && rows.length === 0 && (
                <div className="hint" style={{ padding: 12 }}>{t("Eşleşen üye yok.")}</div>
              )}
              {rows
                .map(([uid, u]) => (
                  <div key={uid} className="urow">
                    <Avatar uid={uid} name={u?.name || u?.email} photo={u?.photo} size={32} />
                    <span className="uinfo">
                      <b>{u?.name || "—"}</b>
                      <span className="umail">{u?.email || uid}</span>
                      {u?.note && <span className="unote">“{u.note}”</span>}
                    </span>
                    <span className={`ustat ${u?.allowed ? "ok" : u?.requested ? "wait" : ""}`}>
                      {u?.admin === true
                        ? <>🛡 {t("Admin")}</>
                        : u?.allowed ? t("erişim var") : u?.requested ? t("beklemede") : t("talep yok")}
                    </span>
                    {/* adminler birbirinin iznine dokunamaz — kurallar da engelliyor */}
                    {uid !== user.uid && u?.admin !== true && (
                      <button className={u?.allowed ? "histbtn" : "gbtn ubtn"}
                        onClick={() => setUserAllowed(uid, !u?.allowed).catch(() => {})}>
                        {u?.allowed ? t("İzni Al") : t("Onayla")}
                      </button>
                    )}
                    {uid !== user.uid && u?.admin === true && (
                      <span className="hint" style={{ fontSize: 10.5 }}>
                        {t("korumalı")}</span>
                    )}
                  </div>
                ))}
            </div>
            <div className="wxmfoot">
              <span className="hint" style={{ marginRight: "auto", fontSize: 11 }}>
                {t("Onaylanan kişi sayfayı yenilemeden erişir.")}</span>
            </div>
              </>);
            })()}
          </div>
        </div>
      )}
      {wxHist && (() => {
        /* Hava geçişi penceresi — fiş wxOpen (Yeni Tasarım.dc.html:1512): zaman
           çizelgesi barı + "Bu andan sonraki hava" 5-buton ızgarası + "Plana etkisi"
           özeti + "Şu an/Stint başı" hızlı butonları. Mevcut geçmiş/planlı-ekleme
           mantığı (st.weatherLog + up) KORUNUR; değerler gerçek plandan türetilir.
           FLAG: fişteki "toplam −N tur / stint süresi" etkisi tam plan yeniden
           simülasyonu ister → yalnız GERÇEK olan tur-başı etki (çarpan/delta/yakıt)
           gösteriliyor; toplam-tur etkisi uydurulmadı. */
        const raceSec = racePlan.raceSec || parseHMS(st.raceTime) || 0;
        const log = (st.weatherLog || []).slice().sort((a, b) => a.t - b.t);
        const elapsedNow = liveInfo.status === "live"
          ? Math.max(0, Math.round(liveInfo.elapsed / 1000)) : 0;
        const wxColAt = (mid) => {
          const cur = wxAtRel(log, mid);
          return (WEATHER[Object.keys(WEATHER).find((k) => WEATHER[k] === cur)] || WEATHER.dry).col;
        };
        const bounds = Array.from(new Set([0,
          ...log.map((e) => e.t).filter((x) => x > 0 && x < raceSec), raceSec]))
          .sort((a, b) => a - b);
        const segs = [];
        for (let i = 0; i < bounds.length - 1; i++) {
          const a = bounds[i]; const b = bounds[i + 1];
          segs.push({ flex: Math.max(0.0001, b - a), col: wxColAt((a + b) / 2) });
        }
        const base = parseLap(st.avgLap);
        const selW = WEATHER[wxPlanW] || WEATHER.dry;
        const effLap = base * selW.lap;
        const dLap = effLap - base;
        const dFuelPct = (1 - selW.fuel) * 100;
        const stintStart = liveInfo.status === "live"
          ? (liveInfo.stintIdx === 0 ? 0 : (racePlan.rows[liveInfo.stintIdx - 1]?.endSec || 0)) : 0;
        return (
        <div className="wxmodal" onClick={() => setWxHist(false)}>
          <div className="wxmbox" style={{ width: "min(680px,95vw)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="wxmhead">
              <span>🌦 {t("Hava geçişi ekle")}</span>
              <span className="hint" style={{ margin: 0, fontSize: 11.5 }}>
                {t("Yarış saatinde havanın değiştiği an")}</span>
              <button className="lbclose" onClick={() => setWxHist(false)}>✕</button>
            </div>

            {raceSec > 0 && (
              <div className="wxtl">
                <div className="wxtl-bar">
                  {segs.map((s, i) => (
                    <i key={i} style={{ flex: s.flex, background: s.col, opacity: .5 }} />
                  ))}
                  {log.filter((e) => e.t > 0 && e.t < raceSec).map((e, i) => (
                    <span key={i} className="wxtl-mk"
                      style={{ left: `${(e.t / raceSec) * 100}%`,
                        background: (WEATHER[e.w] || WEATHER.dry).col }} />
                  ))}
                  {liveInfo.status === "live" && elapsedNow > 0 && elapsedNow < raceSec && (
                    <span className="wxtl-now" style={{ left: `${(elapsedNow / raceSec) * 100}%` }} />
                  )}
                </div>
                <div className="wxtl-ax"><span>0:00</span><span>{fmtHMS(raceSec)}</span></div>
              </div>
            )}

            <div className="wxmlist">
              {!(st.weatherLog || []).length && (
                <div className="hint" style={{ padding: "10px 6px" }}>
                  {t("Henüz hava geçişi yok. Aşağıdan planlı geçiş ekleyin veya soldaki butonlarla canlı değiştirin.")}
                </div>
              )}
              {(st.weatherLog || []).map((e, i) => {
                const wx = WEATHER[e.w] || WEATHER.dry;
                const isFuture = liveInfo.status === "live"
                  && e.t > liveInfo.elapsed / 1000 + 1;
                return (
                  <div key={i} className="wxrow">
                    <span className="wxdot" style={{ background: wx.col }} />
                    <span className="wxnm" style={{ color: wx.col, display: "inline-flex",
                      alignItems: "center", gap: 5 }}>
                      <WetIcon id={WEATHER[e.w] ? e.w : "dry"} size={15} /> {t(wx.lbl)}</span>
                    <span className={`wxsrc ${e.src === "plan" ? "plan" : "live"}`}>
                      {e.src === "plan" ? t("planlı") : t("canlı")}
                      {isFuture ? " ⏳" : ""}</span>
                    <span className="wxat mono">@{fmtHMS(e.t)}</span>
                    <button className="minibtn" title={t("Sil")}
                      onClick={() => {
                        const logD = st.weatherLog.filter((_, j) => j !== i);
                        up({ weather: logD.length ? logD[logD.length - 1].w : "dry",
                          weatherLog: logD });
                      }}>✕</button>
                  </div>
                );
              })}
            </div>
            <div className="wxmplan">
              <div className="wxmptitle">➕ {t("Bu andan sonraki hava")}</div>
              <div className="wxpick5">
                {Object.entries(WEATHER).map(([id, w]) => (
                  <button key={id} className={`wxp5${wxPlanW === id ? " on" : ""}`}
                    style={wxPlanW === id ? { borderColor: w.col, color: w.col } : undefined}
                    onClick={() => setWxPlanW(id)}>
                    <WetIcon id={id} size={20} />
                    <span>{t(w.lbl)}</span>
                    <small>×{w.lap.toFixed(2)}</small>
                  </button>
                ))}
              </div>
              <div className="wxeffect">
                <span className="k">{t("Plana etkisi")}</span>
                <b style={{ color: dLap > 0.05 ? "var(--rc-warn)" : "var(--rc-ok)" }}>
                  {t("tur")} {dLap >= 0 ? "+" : ""}{dLap.toFixed(1)} {t("sn")}</b>
                <span className="sep">·</span>
                <b>×{selW.lap.toFixed(2)} → {fmtLap(effLap)}</b>
                {dFuelPct > 0.5 && (<>
                  <span className="sep">·</span>
                  <b>⚡ {t("yakıt")} −{dFuelPct.toFixed(0)}%</b></>)}
              </div>
              <div className="wxmprow">
                <input type="text" placeholder="s:dd:ss" value={wxPlanT}
                  onChange={(e) => setWxPlanT(e.target.value)}
                  title={t("Yarış saati (başlangıçtan itibaren)")} />
                <button className="histbtn" onClick={() => {
                  const tt = parseHMS(wxPlanT);
                  if (tt <= 0) return;
                  const logN = [...(st.weatherLog || []).filter((e) => Math.abs(e.t - tt) > 0.5),
                    { t: tt, w: wxPlanW, src: "plan" }].sort((a, b) => a.t - b.t);
                  up({ weatherLog: logN });
                  setWxPlanT("");
                }}>{t("Geçişi ekle")}</button>
              </div>
              <div className="wxmquick">
                <button className="minibtn" style={{ width: "auto", padding: "0 8px" }}
                  title={t("Yarış saati (başlangıçtan itibaren)")}
                  onClick={() => setWxPlanT(fmtHMS(elapsedNow))}>{t("Şu an")}</button>
                <button className="minibtn" style={{ width: "auto", padding: "0 8px" }}
                  title={t("Yarış saati (başlangıçtan itibaren)")}
                  onClick={() => setWxPlanT(fmtHMS(stintStart))}>{t("Stint başı")}</button>
                {[["30 dk", 30], ["60 dk", 60], ["90 dk", 90]].map(([lbl, mn]) => (
                  <button key={mn} className="minibtn" style={{ width: "auto", padding: "0 8px" }}
                    title={t("Son X dk için geçiş zamanı")}
                    onClick={() => {
                      const tt = Math.max(0, parseHMS(st.raceTime) - mn * 60);
                      setWxPlanT(fmtHMS(tt));
                    }}>{t("Son")} {lbl}</button>
                ))}
              </div>
            </div>
            <div className="wxmfoot">
              <button className="histbtn" onClick={() => {
                up({ weather: "dry", weatherLog: [] }); setWxHist(false);
              }}>{t("Tümünü Sıfırla")}</button>
            </div>
          </div>
        </div>
        );
      })()}
      <header>
        <img className="hlogo" src={`${ASSET}logo.png`} alt="Caspian Motorsport" />
        <h1 className="disp" style={{ fontSize: 20 }}>RACE MONITOR</h1>
        <span className="ver">{APP_VERSION}</span>
        <button className="tourbtn" onClick={() => setTour("main")}
          title={t("Rehberi başlat")} aria-label={t("Rehberi başlat")}>
          <Icon name="cap" size={15} /></button>
        {infoBtn}
        {/* Ana Menü: yarıştayken her zaman görünür (teambar katlansa da) → takvim/lobiye dön */}
        {curRace && (
          <Btn variant="subtle" size="sm" data-tour="home" onClick={leaveRace}
            title={t("Ana menüye dön")} iconLeft={<Icon name="home" size={14} />}>
            {t("Ana Menü")}
          </Btn>
        )}
        {/* v2.0 KALDIRILANLAR (ARAYUZ-YENILEME-PROMPT-v2):
            · Açık tema kapsam dışı → ☀/🌙 anahtarı GİZLENDİ (toggleTheme ve
              tema token'ları SİLİNMEDİ; açık palet sonraki turda üretilecek).
            · Global yoğunluk anahtarı KALKTI → yoğunluk yalnız Canlı Timing'de
              ("Pit duvarı ↔ Mühendis"); toggleDensity orada kullanılır. */}
        <span className="langsw">
          {["tr", "en"].map((l) => (
            <button key={l} className={lang === l ? "on" : ""}
              onClick={() => switchLang(l)}>{l.toUpperCase()}</button>
          ))}
        </span>
        {(st.track || st.car) && (
          <span className="hdsel">
            {st.track && <><img className="flag" src={`${ASSET}flags/${st.track}.png`} alt="" />
              {trackName(st.track)}</>}
            {st.car && <>
              <img className="car" src={carImageSrc(teamData?.assets, st.carClass, st.car, "side")}
                alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
              {carName(st.carClass, st.car)}</>}
          </span>
        )}
        {access && (
          <Btn variant="subtle" size="sm" data-tour="hteam"
            onClick={() => go("team")} title={t("Takımlarım")}
            iconLeft={teamLogoSrc(teamData?.assets)
              ? <img className="hdteamlogo" src={teamLogoSrc(teamData.assets)} alt="" />
              : <Icon name="building" size={14} />}>
            {teamData?.meta?.name || t("Takımlar")}
          </Btn>
        )}
        {chatBtn}
        {isAdmin && (
          <button className="adminbtn" onClick={() => setAdminOpen(true)}
            title={t("Kullanıcı yönetimi")}>
            <Icon name="users" size={14} /> {t("Üyeler")}
            {Object.values(allUsers).filter((u) => u?.requested && u?.allowed !== true).length > 0 &&
              <b className="badge">{Object.values(allUsers)
                .filter((u) => u?.requested && u?.allowed !== true).length}</b>}
          </button>
        )}
        {user && (
          <span className="userchip" data-tour="uchip" title={user.email || ""}>
            {(myAvatar || user.photoURL) && (
              <img src={myAvatar || user.photoURL} alt=""
                referrerPolicy={/^https?:/.test(myAvatar || user.photoURL)
                  ? "no-referrer" : undefined} />
            )}
            {myBadges.map((b) => (
              <span key={b.lbl} className="ubadge" title={t(b.lbl)}
                style={{ color: b.col, background: b.bg, borderColor: b.col }}>
                {b.ico}</span>
            ))}
            <button className="unamebtn" title={t("Profili düzenle")}
              onClick={() => { setProfName(userName || user.displayName || "");
                setAvStage(""); setAvErr(""); setProfOpen(true); }}>
              {userName || user.displayName || user.email}</button>
            <button onClick={signOut} title={t("Çıkış yap")} aria-label={t("Çıkış yap")}>
              <Icon name="power" size={15} /></button>
          </span>
        )}
      </header>

      <div className={`teambar ${barOpen ? "" : "collapsed"}`}>
        <span className={`dot ${curRace ? "on" : "off"}`} title={curRace ? t("Bağlı") : t("Solo mod")} />
        {!barOpen && !curRace && <span className="syncinfo" style={{ marginLeft: 0 }}>
          {t("Solo mod")}</span>}
        <button className="bartoggle"
          onClick={() => setBarOpen(!barOpen)}
          title={barOpen ? t("Katılım çubuğunu gizle") : t("Katılım çubuğunu göster")}>
          {barOpen ? "▲" : "▼"}</button>
        {barOpen && (<>
        {!curRace ? (
          <span className="syncinfo" style={{ marginLeft: 0 }}>
            {t("Solo mod — takım takvimi için lobiye dön.")}
          </span>
        ) : (<>
          <span>{t("YARIŞ")}: <span className="roomcode">
            {races[curRace]?.name || trackName(races[curRace]?.trackId) || curRace}</span></span>
          {/* rol rozeti yok — yetki takım rozetlerinden (🛞 sürücü / 🎧 mühendis) belli */}
          {teamData?.meta?.name && (
            <span className="syncinfo" style={{ marginLeft: 0, display: "inline-flex",
              alignItems: "center", gap: 5 }}>
              {teamLogoSrc(teamData?.assets)
                ? <img className="hdteamlogo" src={teamLogoSrc(teamData.assets)} alt="" />
                : "🏢"} {teamData.meta.name}</span>
          )}
          <button className="leave" onClick={leaveRace}>{t("Takvime Dön")}</button>
          <span className="syncinfo">
            {lastSync ? `${t("Son güncelleme: ")}${lastSync.by} · ${new Date(lastSync.at).toLocaleTimeString(lang === "en" ? "en-GB" : "tr-TR")}` : t("Senkronize")}
          </span>
        </>)}
        {syncMsg && <span style={{ color: "var(--yellow)" }}>{syncMsg}</span>}
        </>)}
      </div>

      {/* v2.0 BİRLEŞİK STICKY YARIŞ ÇUBUĞU (README §2) — v1'deki .hudstrip ve
          .livestrip şeritlerinin yerini aldı. Aynı bilgiler tek çubukta:
          bayrak + yarış adı (+ izleyici rozeti) · bayrağa kalan · sıradaki pit ·
          pozisyon · enerji · sağ blok (canlı durum + Yarış datası + Pit Board). */}
      {showsRaceBar(screen) && (() => {
        const raceFrac = liveInfo.raceMs > 0
          ? Math.min(100, Math.max(0, (liveInfo.elapsed / liveInfo.raceMs) * 100)) : 0;
        const pitTotal = liveInfo.phaseEnd - liveInfo.stintStartMs;
        const pitFrac = pitTotal > 0
          ? Math.min(100, Math.max(0, ((pitTotal - liveInfo.nextPitIn) / pitTotal) * 100)) : 0;
        const isLive = liveInfo.status === "live";
        const own = live?.own || null;
        const r = races[curRace];
        /* Sınıf-içi pozisyon (fiş üst çubuk "· GT3 P2"): saha pozisyona göre sıralı
           gelir → oyuncunun sınıfındaki araçları oyuncuya kadar say. */
        const field = Array.isArray(live?.field) ? live.field : [];
        const pcar = field.find((c) => c.isPlayer);
        let posCls = null, posClsColor;
        if (isLive && pcar?.carClass && classId(pcar.carClass)) {
          const cid = classId(pcar.carClass);
          let rank = 0;
          for (const c of field) {
            if (classId(c.carClass) === cid) { rank += 1; if (c === pcar) break; }
          }
          posCls = `${String(pcar.carClass).toUpperCase()} P${rank}`;
          posClsColor = classAccent(pcar.carClass) || undefined;
        }
        return (
          <RaceBar t={t}
            flagSrc={st.track ? `${ASSET}flags/${st.track}.png` : ""}
            name={r?.name || trackName(st.track) || t("Solo")}
            meta={[r?.round ? `R${r.round}` : "", trackName(st.track),
              carName(st.carClass, st.car)].filter(Boolean).join(" · ")}
            viewer={!!curRace && role !== "editor"}
            remain={isLive ? fmtHMS(liveInfo.remaining / 1000)
              : liveInfo.status === "pre" ? startCountdown(liveInfo)
              : liveInfo.status === "done" ? t("🏁") : fmtHMS(racePlan.raceSec)}
            remainLabel={isLive ? undefined
              : liveInfo.status === "pre" ? t("Start'a")
              : liveInfo.status === "done" ? t("Durum") : t("Yarış Süresi")}
            remainPct={isLive ? raceFrac : 0}
            nextPit={isLive ? fmtHMS(liveInfo.nextPitIn / 1000) : null}
            nextPitSub={isLive
              ? `S${liveInfo.stintIdx + 1}/${racePlan.fullStints}${liveInfo.driver ? ` · ${liveInfo.driver}` : ""}`
              : null}
            pitAlert={!!pitSoon}
            pos={own?.pos != null ? `P${own.pos}` : null}
            posCls={posCls} posClsColor={posClsColor}
            posSub={pitFrac > 0 ? `%${Math.round(pitFrac)} ${t("stint")}` : null}
            energy={own?.virtualEnergy != null ? `${Math.round(own.virtualEnergy)}%` : null}
            energyPct={own?.virtualEnergy ?? 0}
            liveOn={live?.ts ? true : false}
            liveLabel={live?.ts ? t("canlı") : t("bağlı değil")}
            bridge={live?.ts ? {
              cars: live.cars != null ? live.cars : null,
              laps: live.laps != null ? live.laps : null,
              lastFrame: `${Math.max(0, (now - live.ts) / 1000).toFixed(1)} sn ${t("önce")}`,
              fresh: (now - live.ts) < 5000,
            } : null}
            onBridge={() => go("live")}
            onRaceData={() => setRdOpen(true)} dirtyN={rdN}
            onPitBoard={() => setPitboard(true)} />
        );
      })()}


      {pitboard && (
        <div className="pitboard" onClick={() => setPitboard(false)}>
          <button className="close" onClick={() => setPitboard(false)}>✕</button>
          <img className="plogo" src={`${ASSET}logo.png`} alt="" />
          {/* fiş: üst kimlik çubuğu — yarış adı + canlı bayrak durumu + #no · pilot */}
          {(() => {
            const pbName = races[curRace]?.name || trackName(st.track) || t("Solo");
            const pcar = Array.isArray(live?.field) ? live.field.find((c) => c.isPlayer) : null;
            const pbNo = pcar?.number != null ? `#${pcar.number}` : null;
            const pbDrv = liveInfo.driver || pcar?.driver || "";
            const flag = live?.session?.flag;
            const flagCol = !flag || flag === "Green" ? "var(--rc-ok)"
              : (flag === "Yellow" || flag === "FCY") ? "var(--rc-flag-yellow)"
              : "var(--rc-brand-bright)";
            const flagLbl = !flag || flag === "Green" ? t("yeşil bayrak")
              : flag === "Yellow" ? t("sarı bayrak")
              : flag === "FCY" ? "FCY"
              : flag === "Red" ? t("kırmızı bayrak") : t(flag);
            return (
              <div onClick={(e) => e.stopPropagation()}
                style={{ position: "absolute", top: 16, left: 24, right: 76, display: "flex",
                  alignItems: "center", gap: 14, flexWrap: "wrap", textAlign: "left" }}>
                <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700,
                  fontSize: "clamp(18px,2.4vw,26px)", letterSpacing: ".03em",
                  color: "var(--rc-text)" }}>{pbName}</span>
                {liveInfo.status === "live" && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11,
                    textTransform: "uppercase", letterSpacing: ".12em", padding: "4px 12px",
                    borderRadius: 99, border: `1px solid ${flagCol}`, color: flagCol }}>
                    <i style={{ width: 8, height: 8, borderRadius: "50%", background: flagCol,
                      boxShadow: `0 0 8px ${flagCol}`,
                      animation: "rcpulse 1.2s ease-in-out infinite" }} />{flagLbl}
                  </span>
                )}
                {(pbNo || pbDrv) && (
                  <span style={{ fontFamily: "var(--rc-font-display)",
                    fontSize: "clamp(13px,1.6vw,18px)", color: "var(--rc-text-3)" }}>
                    {[pbNo, pbDrv].filter(Boolean).join(" · ")}</span>
                )}
              </div>
            );
          })()}
          {liveInfo.status === "pre" && (<>
            <div className="plbl">{t("Start'a")}</div>
            <div className="huge" style={{ color: "var(--yellow)" }}>
              {startCountdown(liveInfo)}</div>
          </>)}
          {liveInfo.status === "done" && <div className="huge">🏁</div>}
          {liveInfo.status === "idle" && (<>
            <div className="plbl">{t("Yarış zamanı ayarlanmadı")}</div>
            <div className="mid">{t("Pilotlar sekmesinden başlangıç zamanını gir")}</div>
          </>)}
          {liveInfo.status === "live" && (() => {
            const pitTotal = liveInfo.phaseEnd - liveInfo.stintStartMs;
            const pitFrac = pitTotal > 0
              ? Math.min(1, Math.max(0, (pitTotal - liveInfo.nextPitIn) / pitTotal)) : 0;
            const raceFrac = liveInfo.raceMs > 0
              ? Math.min(1, Math.max(0, liveInfo.elapsed / liveInfo.raceMs)) : 0;
            return (<>
            <div>
              <div className="plbl">{t("Kalan Süre")}</div>
              <div className="huge">{fmtHMS(liveInfo.remaining / 1000)}</div>
            </div>
            <div className="pbrow">
              <div className="pbcard pbgauge">
                <div className="plbl">{liveInfo.phase === "pit" ? t("Pit Çıkışı") : onLastStint ? t("Bayrağa") : t("Sıradaki Pit")}</div>
                <Ring value={pitFrac} size={150} thickness={12} fs={30} glow
                  color={pitSoon ? "var(--yellow)" : "var(--teal)"}
                  big={fmtHMS(liveInfo.nextPitIn / 1000)} />
              </div>
              <div className="pbcard">
                <div className="plbl">Stint</div>
                <div className="mid">{liveInfo.stintIdx + 1} / {racePlan.fullStints}</div>
              </div>
              <div className="pbcard pbgauge">
                <div className="plbl">{t("Tamamlanan")}</div>
                <Ring value={raceFrac} size={150} thickness={12} fs={40} color="var(--car)"
                  big={`%${Math.round(raceFrac * 100)}`} />
              </div>
              {upcomingIsLast && (
                <div className="pbcard">
                  <div className="plbl" style={{ display: "flex", alignItems: "center",
                    justifyContent: "center", gap: 4 }}><Bolt size={14} /> {t("Son Pit VE")}</div>
                  <div className="mid" style={{ color: "var(--green)" }}>
                    {planLsf.refuel.toFixed(1)}%</div>
                </div>
              )}
            </div>
            {(liveInfo.driver || liveInfo.nextDriver) && (
              <div className="pbcard">
                <div className="plbl">{t("Pilot Değişimi")}</div>
                <div className="mid">
                  {liveInfo.driver || "?"} <span style={{ color: "var(--teal)" }}>→</span>{" "}
                  {liveInfo.nextDriver || "?"}
                </div>
              </div>
            )}
            {upcomingPit && !racePlan.rows[liveInfo.stintIdx]?.isLast && (
              <div className="chips">
                <span className="plbl">{t("Sıradaki pit: ")}</span>
                {upcomingPit.fuel && <span className="chip2 fuel"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Bolt size={17} /> VE</span>}
                {TY.filter((_, i) => upcomingPit.tyres[i]).map((c) => (
                  <span key={c} className="chip2 tyre"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Tyre size={17} /> {c}</span>
                ))}
                {!upcomingPit.fuel && !upcomingPit.tyres.some(Boolean) && (
                  <span className="chip2 none">{t("Sadece geçiş")}</span>
                )}
              </div>
            )}

            {/* --- gerçek pit işaretleme: sadece düzenleyici --- */}
            {canEdit && (
              <div onClick={(e) => e.stopPropagation()}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                {/* stint ↔ canlı senkron anahtarları (cihaz tercihi) + durum çipleri */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                  justifyContent: "center" }}>
                  <span className="plbl" style={{ margin: 0 }}>🔗 {t("Canlı Senkron")}</span>
                  <button className={`act${liveSyncOpt.autoPit ? " on" : ""}`}
                    style={{ fontSize: 11, padding: "3px 10px",
                      ...(liveSyncOpt.autoPit && { borderColor: "var(--green)", color: "var(--green)" }) }}
                    title={t("Araç pit yoluna girince PIT otomatik işaretlenir (yalnız canlı kaynağı yazan PC tetikler)")}
                    onClick={() => setSyncOpt("autoPit", !liveSyncOpt.autoPit)}>
                    🤖 {t("Oto PIT")}</button>
                  <button className={`act${liveSyncOpt.autoClock ? " on" : ""}`}
                    style={{ fontSize: 11, padding: "3px 10px",
                      ...(liveSyncOpt.autoClock && { borderColor: "var(--green)", color: "var(--green)" }) }}
                    title={t("Planın geri sayımı oyunun kalan süresinden 5 sn'den fazla kayarsa başlangıç zamanı otomatik hizalanır")}
                    onClick={() => setSyncOpt("autoClock", !liveSyncOpt.autoClock)}>
                    ⏱ {t("Oto Saat")}</button>
                  {drift != null && Math.abs(drift) > 1 && (
                    <span className="chip" style={{ fontSize: 10,
                      color: Math.abs(drift) > 5 ? "var(--yellow)" : "var(--dim)",
                      borderColor: Math.abs(drift) > 5 ? "var(--yellow)" : "var(--line)" }}
                      title={t("Plan saati − oyun saati")}>
                      ⏱ {drift > 0 ? "+" : ""}{drift}s</span>
                  )}
                  {lastAuto && Date.now() - lastAuto.at < 120000 && (
                    <span className="chip" style={{ fontSize: 10, color: "var(--green)",
                      borderColor: "var(--green)" }}>
                      🤖 S{lastAuto.stint} {t("otomatik işaretlendi")}</span>
                  )}
                </div>
                {pitMismatch && (
                  <div className="plbl" style={{ textTransform: "none", color: "var(--yellow)" }}>
                    ⚠ {t("oyunda")} {pitMismatch.game} {t("pit")}, {t("planda")}{" "}
                    {pitMismatch.marked} {t("işaretli")}
                  </div>
                )}
                {liveInfo.pitsDone < racePlan.rows.length - 1 ? (
                  /* pit fazında PASİF: buton aynı stinti gösterdiği için ikinci basış
                     pit yolunda geçen saniyeleri stint süresine ekliyordu */
                  <button onClick={markPit} disabled={liveInfo.phase === "pit"}
                    title={liveInfo.phase === "pit"
                      ? t("Araç pit yolunda — bu stintin pit'i işaretlendi. Düzeltmek için ↩ Geri Al.")
                      : t("Araç PİT YOLUNA GİRDİĞİ an bas. Pit süresi plandan otomatik eklenir, sonraki stint pit çıkışıyla başlar.")}
                    style={{ padding: "16px 34px", borderRadius: 12,
                      cursor: liveInfo.phase === "pit" ? "default" : "pointer",
                      opacity: liveInfo.phase === "pit" ? 0.45 : 1,
                      background: "var(--car)", color: "#FFE9ED", border: "2px solid var(--teal)",
                      fontFamily: "var(--font-disp)", fontSize: 26, fontWeight: 700,
                      letterSpacing: ".06em" }}>
                    {liveInfo.phase === "pit" ? t("⛽ PIT YOLUNDA") : t("✔ PIT")} — S{liveInfo.stintIdx + 1}
                  </button>
                ) : (
                  <div className="plbl" style={{ color: "var(--green)" }}>
                    ✔ {t("Tüm pitler yapıldı")}</div>
                )}
                {liveInfo.lastDev != null && (
                  <div className="plbl" style={{ textTransform: "none" }}>
                    P{liveInfo.lastPitIdx + 1}: {t("Plan")}{" "}
                    <span className="mono">{fmtClock(liveInfo.plannedPitStart[liveInfo.lastPitIdx])}</span>
                    {" · "}{t("Gerçek")}{" "}
                    <span className="mono">{fmtClock(st.actualPits[liveInfo.lastPitIdx])}</span>
                    {" → "}
                    <b style={{ color: Math.abs(liveInfo.lastDev) > 60000
                      ? "var(--yellow)" : "var(--green)" }}>
                      {fmtDev(liveInfo.lastDev)}</b>
                  </div>
                )}
                {liveInfo.pitsDone > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4,
                    alignItems: "center" }}>
                    {(st.actualPits || []).map((v, i) => Number.isFinite(v) ? (
                      <div key={i} className="plbl"
                        style={{ display: "flex", alignItems: "center", gap: 6,
                          textTransform: "none" }}>
                        P{i + 1} 🔧 {t("Tamir (s)")}
                        <input type="number" min="0" step="1"
                          value={(st.pitRepairs || [])[i] || ""}
                          placeholder="0"
                          onChange={(e) => setRepair(i, e.target.value)}
                          style={{ width: 64, padding: "3px 6px", borderRadius: 6,
                            background: "var(--panel2)", color: "var(--txt)",
                            border: "1px solid var(--line)", fontSize: 13,
                            textAlign: "right" }} />
                        {(Number((st.pitRepairs || [])[i]) || 0) > 0 && (
                          <span style={{ color: "var(--yellow)", fontSize: 12 }}>
                            +{Number(st.pitRepairs[i])}s</span>
                        )}
                      </div>
                    ) : null)}
                  </div>
                )}
                {liveInfo.pitsDone > 0 && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={unmarkPit}
                      style={{ padding: "4px 12px", borderRadius: 6, cursor: "pointer",
                        background: "var(--panel2)", color: "var(--dim)",
                        border: "1px solid var(--line)", fontSize: 12 }}>
                      {t("↩ Geri Al")}</button>
                    <button onClick={resetPits}
                      style={{ padding: "4px 12px", borderRadius: 6, cursor: "pointer",
                        background: "var(--panel2)", color: "var(--dim)",
                        border: "1px solid var(--line)", fontSize: 12 }}>
                      {t("⟲ Sıfırla")}</button>
                  </div>
                )}
              </div>
            )}
          </>);
          })()}
        </div>
      )}

      {/* v2.0: SOL DATA KOLONU KALKTI — yarış datası artık sağdan kayan panelde
          (SAHNELE + UYGULA). Ekranlar tam genişlikte; kabukta yalnız 76px sol ray
          var. `.grid` sınıfı viewonly pasifleştirmesi için korundu. */}
      <div className={`grid noside v2grid ${role === "viewer" && curRace ? "viewonly" : ""}`}>
        <div className="v2screen">
          {/* Rehber kutuları (README §17) — her ekranın üstünde tek satır ipucu.
              İkon ve kapatma düğmesi yok; metinler src/guides.js'te ekran
              kimliğine göre. Statik ipuçları HEP AÇIK, opsiyonel interaktif tur
              (tourSteps.js) ayrı durur. */}
          {(() => { const g = guideFor(screen, t); return g
            ? <Guide title={g.title} text={g.text} /> : null; })()}
          {/* v2.0: sekme çubuğu KALKTI — gezinme 76px sol raydan (shell.jsx Rail).
              tabpanel ARIA kimliği ray düğmesine bağlanır. */}
          <div id="tabpanel-main" role="region" aria-label={t("Ana içerik")} tabIndex={-1}>
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
              upStintLap={upStintLap} upTyre={upTyre} upPit={upPit} assignDriver={assignDriver}
              upOvr={upOvr} setRepair={setRepair} driverPlan={driverPlan}
              markPit={markPit} unmarkPit={unmarkPit} drift={drift}
              liveSyncOpt={liveSyncOpt} canEdit={canEdit} />
          )}

          {tab === "dash" && (
            <DashTab t={t} st={st} zoom={zoom} setZoom={setZoom} exportPdf={openPdfPreview}
              liveInfo={liveInfo} racePlan={racePlan} tyreInfo={tyreInfo} planLsf={planLsf}
              driverPlan={driverPlan} carriedAt={carriedAt} pitSoon={pitSoon} lmuData={lmuData}
              assets={teamData?.assets} />
          )}

          {tab === "setup" && setupScreen()}

          {tab === "live" && <LiveTab t={t} live={live} liveFuelObs={liveFuelObs}
            lapCapture={lapCapture}
            bridge={bridge} canEdit={canEditTeam} canBridge={isMember} tid={curTeam} rid={curRace}
            tourDemo={tourDemo} onGuide={() => setTour("live")} isAdmin={isAdmin}
            ownTopSrc={carImageSrc(teamData?.assets, st.carClass, st.car, "top")} />}

          {tab === "tyre" && (
            <TyreTab t={t} st={st} up={up} tyreInfo={tyreInfo} racePlan={racePlan}
              carriedAt={carriedAt} upTyreCell={upTyreCell} quickTyre={quickTyre}
              qsel={qsel} setQsel={setQsel} QSEL_LBL={QSEL_LBL} clearTyres={clearTyres} />
          )}

          {tab === "drivers" && (
            <DriversTab t={t} st={st} up={up} driverPlan={driverPlan}
              fmtClock={fmtClock} removeDriver={removeDriver} newDriver={newDriver}
              setNewDriver={setNewDriver} addDriver={addDriver} teamDrivers={teamDrivers}
              setSt={setSt} assignDriver={assignDriver} teamData={teamData}
              clearAssign={clearAssign} avail={avail} setAvail={setAvail}
              resetAvail={resetAvail} canEdit={canEdit} />
          )}

          {/* v2.0 TAM SAYFA (modal kabuğu kalktı) — sol raydan erişilir. */}
          {screen === "team" && teamSheet(true)}
          {screen === "chat" && chatSheet(true)}

          {tab === "rchat" && raceChan && (
            <div className="card">
              <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                🏁 {races[curRace]?.name || t("Yarış Sohbeti")}
                <button className="lbclose" style={{ marginLeft: "auto" }}
                  title={chatSound ? t("Bildirim sesini kapat") : t("Bildirim sesini aç")}
                  onClick={toggleChatSound}>{chatSound ? "🔔" : "🔕"}</button>
              </h2>
              <div className="hint" style={{ marginBottom: 6 }}>
                {t("Bu yarışa özel kanal — takımın tamamı yazabilir, sürücüler dahil.")}</div>
              <div style={{ border: "1px solid var(--line)", borderRadius: 10,
                overflow: "hidden" }}>
                {chatBody(raceChan, "min(58vh,440px)")}
              </div>
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
      </div>
      </div>{/* /v2main */}
    </div>
  );
}
