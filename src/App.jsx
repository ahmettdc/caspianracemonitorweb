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
  SLOT_COLORS, APP_VERSION, SEEN_VER_KEY, ASSET, AV,
  TRACKS, PIT_LANE_TIMES, TRACK_ASSET, trackFlag,
  CARS, CAR_CLASSES, trackName, carName, classId, venueToTrackId,
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
import { poolEmptyReason } from "./setupPool";
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
      go("dash");
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

  /* ⚖ alt-sabit karşılaştırma çubuğu — seçim varken görünür; 2 seçilince aç. */
  const cmpA = setups.find((x) => x.id === cmpSel[0]) || null;
  const cmpB = setups.find((x) => x.id === cmpSel[1]) || null;
  const cmpBar = cmpSel.length > 0 && !cmpOpen && (
    <div className="cmpbar">
      <span>⚖ {cmpSel.length}/2</span>
      {[cmpA, cmpB].filter(Boolean).map((s) => (
        <span key={s.id} className="chip mono" style={{ fontSize: 11 }}>{s.name}</span>
      ))}
      <button className="act" disabled={!(cmpA && cmpB)}
        onClick={() => setCmpOpen(true)}>{t("Karşılaştır")}</button>
      <button className="act" onClick={() => setCmpSel([])}>✕ {t("Temizle")}</button>
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
    <SetupContentModal open={!!viewSu} su={viewSu} onClose={() => setViewSu(null)} t={t} />
  );

  const chatSheet = (page = false) => (
    <ChatModal open={(page || chatOpen) && !!user && !!curChan} page={page}
      onClose={page ? back : () => setChatOpen(false)}
      t={t} chatSound={chatSound} toggleChatSound={toggleChatSound}
      chatChans={chatChans} unreadOf={unreadOf} chatChan={chatChan} setChatChan={setChatChan}
      teamData={teamData} curChan={curChan} chatBody={chatBody} />
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
    <button className="adminbtn" data-tour="hchat" onClick={() => setChatOpen(true)}
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
  const cmdActions = [
    { id: "dash", label: t("Dashboard"), keywords: "dash panel", icon: <Icon name="chart" size={15} />, run: () => setTab("dash") },
    { id: "schedule", label: t("Resmi Yarışlar"), keywords: "schedule takvim race yarış lmugarage resmi official", icon: "🏁", run: () => go("official") },
    { id: "stint", label: t("Stint"), keywords: "stint", icon: <Icon name="cap" size={15} />, run: () => setTab("stint") },
    { id: "fuel", label: t("Son Stint Yakıtı"), keywords: "fuel yakıt", icon: <Icon name="zap" size={15} />, run: () => setTab("fuel") },
    { id: "live", label: t("Canlı"), keywords: "live canlı timing", icon: <Icon name="live" size={15} />, run: () => setTab("live") },
    { id: "tyre", label: t("Lastik"), keywords: "tyre lastik", icon: <Icon name="tyre" size={15} />, run: () => setTab("tyre") },
    { id: "drivers", label: t("Pilotlar"), keywords: "drivers pilot", icon: <Wheel size={13} />, run: () => setTab("drivers") },
    { id: "tele", label: t("Telemetri"), keywords: "telemetry telemetri", icon: <Icon name="chart" size={15} />, run: () => setTab("tele") },
    { id: "setup", label: t("Setup"), keywords: "setup", icon: <Icon name="wrench" size={15} />, run: () => setTab("setup") },
    ...(raceChan ? [{ id: "rchat", label: t("Yarış Sohbeti"), keywords: "chat sohbet", icon: <Icon name="chat" size={15} />, run: () => setTab("rchat") }] : []),
    /* v2.0: tema ve yoğunluk komutları paletten de gizlendi (yukarıdaki
       KALDIRILANLAR ile aynı karar). */
    { id: "lang", label: lang === "en" ? "Türkçe" : "English", keywords: "language dil", run: () => switchLang(lang === "en" ? "tr" : "en") },
    ...(user ? [{ id: "chat", label: t("Sohbet"), keywords: "chat sohbet team", icon: <Icon name="chat" size={15} />, run: () => setChatOpen(true) }] : []),
    ...(curRace ? [{ id: "home", label: t("Ana Menü"), keywords: "home ana menü lobby", icon: <Icon name="home" size={15} />, run: leaveRace }] : []),
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
    <RaceEditModal rForm={rForm} setRForm={setRForm} t={t} seasons={seasons} onSave={saveRaceForm} />
  );

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
                    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true"
                      style={{ flex: "0 0 auto" }}>
                      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.1z"/>
                      <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.7C7.9 41 15.4 46 24 46z"/>
                      <path fill="#FBBC05" d="M11.6 28.1c-.4-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.7H4.3C2.8 17.1 2 20.4 2 24s.8 6.9 2.3 9.8l7.3-5.7z"/>
                      <path fill="#EA4335" d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.2 30 2 24 2 15.4 2 7.9 7 4.3 14.2l7.3 5.7c1.7-5.2 6.6-9.1 12.4-9.1z"/>
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
                  {t("Devam ederek")} <a href="#" onClick={(e) => e.preventDefault()}>
                    {t("kullanım koşullarını")}</a> {t("kabul edersin.")}</span>
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

    return (
      <div className="rc">
        <UpdateBanner t={t} />
        {teamModal}{createJoinModal}{raceForm}{versionModal}{chatModal}{tourOverlay}{setupModal}{setupContentModal}{setupCompareModal}{cmpBar}{cmdPalette}
        <div className="lobby">
          <div className="box" style={{ maxWidth: 900 }}>
            <div className="langsw" style={{ display: "flex", justifyContent: "flex-end",
              alignItems: "center", gap: 6, marginBottom: 6 }}>
              <button className="tourbtn" onClick={() => setTour("lobby")}
                title={t("Rehberi başlat")}>🎓 {t("Rehber")}</button>
              {["tr", "en"].map((l) => (
                <button key={l} className={lang === l ? "on" : ""}
                  onClick={() => switchLang(l)}>{l.toUpperCase()}</button>
              ))}
              {infoBtn}
            </div>
            <img className="logo" src={`${ASSET}logo.png`} alt="Caspian Motorsport" />
            <h1><b>RACE</b> MONITOR</h1>
            <div className="sub">{APP_VERSION}</div>

            {firebaseReady ? (<>
              <div className="hint" style={{ marginBottom: 10 }}>
                👤 {userName || t("isimsiz")}</div>

              {Object.keys(myTeams).length === 0 ? (
                <div className="lobbyfoot">
                  <button className="bigbtn ghost" onClick={() => setCreateJoinOpen(true)}>
                    🏢 {t("Kur & Katıl")}
                  </button>
                  <button className="bigbtn ghost" onClick={() => go("official")}>
                    🏁 {t("Resmi Yarışlar")}
                  </button>
                </div>
              ) : (<>
                {/* §1 — takım seçici: yatay kaydırılan kartlar (10+ ölçeklenir) */}
                <div className="mmcap">{t("Takım")}</div>
                <div className="mmteams">
                  {Object.entries(myTeams).map(([tid, nm]) => (
                    <button key={tid} className={`mmtm ${curTeam === tid ? "on" : ""}`}
                      onClick={() => setCurTeam(tid)}>
                      <span className="mmtlg">
                        {tid === curTeam && teamLogoSrc(teamData?.assets)
                          ? <img src={teamLogoSrc(teamData.assets)} alt="" />
                          : "🏁"}
                      </span>
                      <span className="mmtnm">{nm}</span>
                    </button>
                  ))}
                  <button className="mmtm add" onClick={() => setCreateJoinOpen(true)}>
                    <span className="mmtlg">＋</span>
                    <span className="mmtnm">{t("Kur & Katıl")}</span>
                  </button>
                </div>

                {/* §1 — iki kolonlu üst blok: solda sıradaki yarış hero'su
                    (flex 1 1 620px), sağda 2×2 hızlı eylem ızgarası
                    (flex 1 1 280px) + tam genişlik "Resmi Yarışlar" satırı. */}
                <div className="mmtop">
                  <div className="mmherocol">
                      {/* sıradaki yarış — vurgulu hero */}
                      {nextEntry ? (() => {
                        const [rid, r] = nextEntry;
                        return (<>
                          <div className="mmsec">🏁 {t("Sıradaki Yarış")}</div>
                          <div className="mmnextwrap">
                          <button className="mmnext" onClick={() => openRace(rid)}>
                            {/* bayrak + pist görseli — mevcut asset sistemi (flags/ + tracks/,
                                TRACK_ASSET ile). Emoji bayrak bazı OS'lerde "FR" harfine düşüyordu. */}
                            <span className="mmntrk">
                              {r.trackId ? (<>
                                <img className="mmnflag"
                                  src={`${ASSET}flags/${TRACK_ASSET(r.trackId)}.png${AV}`} alt=""
                                  onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                <img className="mmntrkimg"
                                  src={`${ASSET}tracks/${TRACK_ASSET(r.trackId)}.png${AV}`} alt=""
                                  onError={(e) => { e.currentTarget.style.display = "none"; }} />
                              </>) : "🏁"}
                            </span>
                            <span className="mmninfo">
                              <span className="mmnrnd">
                                {sName(sidOf(nextEntry))}{r.round ? ` · R${r.round}` : ""}</span>
                              <span className="mmnttl">{r.name || trackName(r.trackId) || "—"}</span>
                              <span className="mmnmt">
                                {r.trackId ? trackName(r.trackId) : ""}
                                {r.raceTime ? ` · ${r.raceTime}` : ""}
                                {r.carId ? ` · ${carName(r.carClass, r.carId)}` : ""}</span>
                            </span>
                            <span className="mmncd">
                              {r.startsAt ? (
                                <span className="mmncdd">{new Date(r.startsAt)
                                  .toLocaleString(lang === "en" ? "en-GB" : "tr-TR",
                                    { day: "2-digit", month: "short",
                                      hour: "2-digit", minute: "2-digit" })}</span>
                              ) : null}
                              <span className="mmngo">{t("Aç")} →</span>
                            </span>
                          </button>
                          {canEditTeam && (
                            <button className="mmdel" title={t("Yarışı sil")}
                              onClick={() => askDeleteRace(rid, r)}>🗑</button>
                          )}
                          </div>
                        </>);
                      })() : (
                        /* Takvim boş durumu (README §1 + i18n-EN.md §2): kesikli
                           çerçeveli blok — takvim ikonu, başlık, açıklama ve iki
                           eylem. Düz "hint" satırının yerini aldı. */
                        <EmptyState icon="🗓" title={t("Bu sezonda yarış yok")}
                          text={t("Takvime yarış ekle ya da resmi yarışlar listesinden planla — eklediğin yarışlar takımdaki herkeste görünür.")}>
                          {canEditTeam && curTeam && (
                            <button className="rbbtn" onClick={() => setRForm({})}>
                              ＋ {t("Yarış ekle")}</button>
                          )}
                          <button className="rbbtn" onClick={() => go("official")}>
                            {t("Resmi yarışlar")}</button>
                        </EmptyState>
                      )}
                  </div>
                  <div className="mmsidecol">
                  <div className="mmquick q4">
                    <button className="mmqa"
                      onClick={() => go("tele")}>
                      <span className="mmqi">📊</span>
                      <span className="mmql">{t("Telemetri")}</span>
                      <span className="mmqs">{t(".ld yükle · analiz")}</span>
                    </button>
                    <button className="mmqa" onClick={() => setSuOpen(true)}>
                      <span className="mmqi">🔧</span>
                      <span className="mmql">{t("Setup Havuzu")}
                        {setups.length > 0 && <span className="mmbadge">{setups.length}</span>}</span>
                      <span className="mmqs">{t("paylaşımlı setuplar")}</span>
                    </button>
                    <button className="mmqa" data-tour="chat" onClick={() => setChatOpen(true)}>
                      <span className="mmqi">💬</span>
                      <span className="mmql">{t("Sohbet")}
                        {chatUnread > 0 && <span className="mmbadge">{chatUnread}</span>}</span>
                      <span className="mmqs">{t("takım kanalları")}</span>
                    </button>
                    <button className="mmqa" data-tour="manage" onClick={() => setTeamOpen(true)}>
                      <span className="mmqi">⚙</span>
                      <span className="mmql">{canEditTeam ? t("Yönet") : t("Görüntüle")}</span>
                      <span className="mmqs">{t("takvim & takım")}</span>
                    </button>
                  </div>
                  <button className="mmqa mmofficial" onClick={() => go("official")}>
                    <span className="mmqi">🏁</span>
                    <span className="mmql">{t("Resmi Yarışlar")}</span>
                    <span className="mmqs">{t("resmi yarış takvimi")}</span>
                  </button>
                  </div>
                </div>


                {/* sezon süzgeci (çok sezon) — yaklaşanı ve geçmişi süzer */}
                {seasonIds.length > 1 && (
                  <div className="mmchips">
                    {[["all", t("Tümü")], ...seasonIds.map((sid) => [sid, sName(sid)])]
                      .map(([v, l]) => (
                        <button key={v} className={`mmchip ${lobSeason === v ? "on" : ""}`}
                          onClick={() => setLobSeason(v)}>{l}</button>
                      ))}
                  </div>
                )}

                <div className="mmraces" data-tour="races">

                  {/* kalan yaklaşanlar */}
                  {restUp.length > 0 && (<>
                    <div className="mmsec sub">{t("Yaklaşan")} ({restUp.length})</div>
                    <div className="racegrid">
                      {restUp.map((e) => (
                        <Fragment key={e[0]}>
                          {seasonIds.length > 1 && lobSeason === "all" && (
                            <div className="lseason">{sName(sidOf(e))}</div>
                          )}
                          {RaceRow(e, false)}
                        </Fragment>
                      ))}
                    </div>
                  </>)}

                  {/* §1.3 — geçmiş: ara + sayfalama */}
                  {allPast.length > 0 && (<>
                    <div className="mmpasthd">
                      <div className="mmsec">📅 {t("Geçmiş Yarışlar")}</div>
                      <input className="mmsrch" value={lobQuery}
                        placeholder={t("ara: pist, yarış adı…")}
                        onChange={(e) => { setLobQuery(e.target.value); setPastLimit(12); }} />
                    </div>
                    {pastShown.length === 0
                      ? <div className="hint">{t("Aramayla eşleşen geçmiş yarış yok.")}</div>
                      : <div className="racegrid">
                        {pastShown.map((e) => (
                          <Fragment key={e[0]}>
                            {seasonIds.length > 1 && lobSeason === "all" && (
                              <div className="lseason">{sName(sidOf(e))}</div>
                            )}
                            {RaceRow(e, false)}
                          </Fragment>
                        ))}
                      </div>}
                    {pastAll.length > pastLimit && (
                      <button className="mmmore" onClick={() => setPastLimit((n) => n + 12)}>
                        ↓ {t("Daha fazla göster")} ({pastShown.length} / {pastAll.length})</button>
                    )}
                  </>)}
                </div>
              </>)}

              <div className="lmsg">{syncMsg}</div>
            </>) : (
              <div className="hint" style={{ textAlign: "center", marginBottom: 8 }}>
                {t("Takım senkronizasyonu kapalı — ")}<b>src/firebase-config.js</b>{t(" dosyasını doldur.")}
              </div>
            )}

            <div className="lobbyfoot">
            <button className="solo" onClick={() => { setEntered(true); go("pick"); }}>
              {t("Takımsız solo devam et →")}
            </button>

            {!isTauri && (<>
              <div className="divider">{t("masaüstü uygulaması")}</div>
              <a className="bigbtn ghost" href={DESKTOP_RELEASE_URL}
                target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
                  gap: 8, textDecoration: "none" }}>
                🖥 {t("Masaüstü Uygulamasını İndir")}</a>
              <div className="hint" style={{ textAlign: "center", marginTop: 6 }}>
                {t("Tarayıcısız, kendi penceresinde açılır — canlı timing köprüsü dahil (oyunun PC'sinde 'Canlı Köprü Başlat'). Sonraki sürümler uygulama içinden otomatik gelir.")}</div>

              <div className="divider">{t("sürüş PC'si için hafif köprü")}</div>
              <a className="bigbtn ghost" href={BRIDGE_EXE_URL}
                target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
                  gap: 8, textDecoration: "none" }}>
                🪶 {t("Hafif Köprüyü İndir (.exe)")}</a>
              <div className="hint" style={{ textAlign: "center", marginTop: 6 }}>
                {t("Oyunun çalıştığı PC için: tarayıcı motoru yok → oyunu yormaz. Paylaşımlı belleği okuyup canlı timing'i yayınlar; mühendisler web'den izler. (Kendi Google hesabınla giriş — bot gerekmez.)")}</div>
            </>)}

            {isTauri && (<>
              <div className="divider">{t("sürüş PC'si için hafif köprü")}</div>
              <button className="bigbtn ghost"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                onClick={async () => {
                  if (!window.confirm(t("Race Monitor kapanacak ve tarayıcısız Hafif Köprü açılacak (oyunun donmasını önler). Devam edilsin mi?"))) return;
                  try {
                    const { invoke } = await import("@tauri-apps/api/core");
                    await invoke("launch_bridge_and_quit");
                  } catch (e) {
                    window.alert(t("Hafif köprü açılamadı: ") + e);
                  }
                }}>
                🏎 {t("Driver Moduna Geç")}</button>
              <div className="hint" style={{ textAlign: "center", marginTop: 6 }}>
                {t("Oyunun PC'sinde: ağır arayüzü kapatıp yalnız tarayıcısız köprüyü çalıştırır → oyun donmaz. Köprü tepside çalışır; mühendisler canlıyı web'den izler.")}</div>
            </>)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- setup 1: pist & araç seçimi ---------- */
  if (!pickDone) {
    const cls = st.carClass || "hypercar";
    return (
      <div className="rc">
        <UpdateBanner t={t} />
        <div className="lobby" style={{ alignItems: "flex-start", paddingTop: 40 }}>
          <div className="box" style={{ maxWidth: 720 }}>
            <img className="logo" style={{ maxWidth: 190 }} src={`${ASSET}logo.png`} alt="" />
            <h1><b>{t("PİST")}</b> {t("& ARAÇ")}</h1>
            <div className="sub">
              {curRace ? (<>{t("Yarış")}: <b className="roomcode">{races[curRace]?.name || curRace}</b></>)
                : t("Solo mod")}
            </div>

            <div className="picksec">
              <h3>{t("1 · Pist Seç")}</h3>
              <div className="trackgrid">
                {TRACKS.map((t) => (
                  <button key={t.id} className={st.track === t.id ? "on" : ""}
                    onClick={() => up({ track: t.id,
                      ...(PIT_LANE_TIMES[t.id] != null ? { pitLaneTime: PIT_LANE_TIMES[t.id] } : {}) })}>
                    <img src={`${ASSET}flags/${TRACK_ASSET(t.id)}.png`} alt="" />{t.name}
                  </button>
                ))}
              </div>
            </div>

            {st.track && (
              <img key={st.track} src={`${ASSET}tracks/${TRACK_ASSET(st.track)}.png${AV}`} alt=""
                style={{ display: "block", margin: "14px auto 0", maxWidth: "100%",
                  maxHeight: 220, filter: "drop-shadow(0 4px 12px rgba(0,0,0,.5))" }}
                onError={(e) => { e.currentTarget.style.display = "none"; }} />
            )}

            <div className="picksec">
              <h3>{t("2 · Sınıf Seç")}</h3>
              <div className="classtoggle">
                {CAR_CLASSES.map(([id, name]) => (
                  <button key={id} className={cls === id ? "on" : ""}
                    onClick={() => up({ carClass: id, car: "" })}>
                    <img src={`${ASSET}class/${id}.png`} alt=""
                      onError={(e) => { e.currentTarget.style.display = "none"; }} />{name}
                  </button>
                ))}
              </div>
            </div>

            <div className="picksec">
              <h3>{t("3 · Araç Seç")}</h3>
              <div className="cargrid">
                {CARS[cls].map((c) => (
                  <button key={c.id} className={st.car === c.id ? "on" : ""}
                    onClick={() => up({ carClass: cls, car: c.id })}>
                    <img src={carImageSrc(teamData?.assets, cls, c.id, "side")} alt="" loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <button className="bigbtn" style={{ marginTop: 20 }}
              disabled={!st.track || !st.car}
              onClick={() => { setPickDone(true); go("data"); }}>
              {t("✓ Devam Et — Yarış Dataları")}
            </button>
            <div className="lmsg">
              {(!st.track || !st.car) && t("Devam etmek için pist ve araç seç")}
            </div>
            <button className="solo" onClick={() => { setPickDone(true); go("data"); }}>
              {t("Seçim yapmadan geç →")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- setup 2: yarış datalarını gir ---------- */
  if (!setupDone) {
    return (
      <div className="rc">
        <UpdateBanner t={t} />
        <div className="lobby" style={{ alignItems: "flex-start", paddingTop: 40 }}>
          <div className="box" style={{ maxWidth: 560 }}>
            <img className="logo" style={{ maxWidth: 190 }} src={`${ASSET}logo.png`} alt="" />
            <h1><b>{t("YARIŞ")}</b> {t("DATALARI")}</h1>
            <div className="sub">
              {st.track && <><img className="flag" style={{ width: 16, verticalAlign: -2, marginRight: 4 }}
                src={`${ASSET}flags/${st.track}.png`} alt="" />
                {trackName(st.track)}{st.car && <> · {carName(st.carClass, st.car)}</>} — </>}
              {curRace ? (<>
                {t("Yarış")}: <b className="roomcode">{races[curRace]?.name || curRace}</b>
              </>) : t("Solo mod — datalar sadece bu cihazda")}
            </div>

            {dataCards}

            <button className="bigbtn" style={{ marginTop: 18 }}
              onClick={() => { setSetupDone(true); go("dash"); }}>
              {t("✓ Devam Et — Arayüze Geç")}
            </button>
            <div className="hint" style={{ textAlign: "center", marginTop: 8 }}>
              {t("Merak etme, tüm bu değerleri arayüzün sol kolonundan her an değiştirebilirsin.")}
            </div>
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
      {profOpen && user && (
        <div className="wxmodal" onClick={() => setProfOpen(false)}>
          <div className="wxmbox" style={{ width: "min(420px,94vw)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="wxmhead">
              <span>👤 {t("Profil")}</span>
              <button className="lbclose" onClick={() => setProfOpen(false)}>✕</button>
            </div>
            <div style={{ padding: "14px 16px" }}>
              <div className="userchip" style={{ marginBottom: 14 }}>
                {(avStage || myAvatar || user.photoURL) && (
                  <img src={avStage || myAvatar || user.photoURL} alt=""
                    referrerPolicy={/^https?:/.test(avStage || myAvatar || user.photoURL)
                      ? "no-referrer" : undefined} />
                )}
                <span className="uname" style={{ maxWidth: 260 }}>{user.email}</span>
              </div>
              {/* v1.7.0 — avatar yükleme: seç → önizleme → Kaydet yazar; Kaldır siler */}
              <label>{t("Avatar")}</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <input id="avfile" type="file" accept={IMG_ACCEPT_TYPES.join(",")}
                  style={{ display: "none" }}
                  onChange={(e) => { onAvatarFile(e.target.files?.[0]); e.target.value = ""; }} />
                <button className="histbtn" disabled={avBusy}
                  onClick={() => document.getElementById("avfile")?.click()}>
                  {avBusy ? t("Yükleniyor…") : `⬆ ${t("Görsel Seç")}`}</button>
                {(myAvatar || avStage) && (
                  <button className="histbtn" disabled={avBusy}
                    onClick={async () => {
                      setAvStage(""); setAvErr("");
                      await clearUserAvatar(user.uid).catch(() => {});
                      setMyAvatar("");
                    }}>✕ {t("Kaldır")}</button>
                )}
                {avStage && <span className="hint" style={{ margin: 0 }}>
                  {t("Önizleme — Kaydet ile uygulanır")}</span>}
              </div>
              {avErr && <div className="hint warn" style={{ marginBottom: 8 }}>{avErr}</div>}
              {myBadges.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  {myBadges.map((b) => (
                    <span key={b.lbl} className="bchip" style={{ color: b.col,
                      background: b.bg, borderColor: b.col, marginBottom: 0 }}>
                      {b.ico} {t(b.lbl)}
                    </span>
                  ))}
                </div>
              )}
              <label>{t("Ad Soyad")}</label>
              <input type="text" value={profName} style={{ textTransform: "none" }}
                onChange={(e) => setProfName(e.target.value)} />
              <div className="hint" style={{ marginTop: 6 }}>
                {t("Odalarda ve stint programında bu isim görünür.")}</div>
            </div>
            <div className="wxmfoot" style={{ gap: 8 }}>
              <button className="histbtn" onClick={() => {
                setAvStage(""); setAvErr(""); setProfOpen(false);
              }}>{t("Vazgeç")}</button>
              <button className="gbtn ubtn" disabled={!profName.trim()}
                style={{ opacity: profName.trim() ? 1 : .45 }}
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
            </div>
          </div>
        </div>
      )}
      {adminOpen && isAdmin && (
        <div className="wxmodal" onClick={() => setAdminOpen(false)}>
          <div className="wxmbox" style={{ width: "min(620px,95vw)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="wxmhead">
              <span>👥 {t("Üye Yönetimi")}</span>
              <button className="lbclose" onClick={() => setAdminOpen(false)}>✕</button>
            </div>
            <div className="wxmlist">
              {Object.entries(allUsers).length === 0 && (
                <div className="hint" style={{ padding: 12 }}>{t("Kayıt yok.")}</div>
              )}
              {Object.entries(allUsers)
                .sort(([, a], [, b]) => (b?.requestedAt || 0) - (a?.requestedAt || 0))
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
          </div>
        </div>
      )}
      {wxHist && (
        <div className="wxmodal" onClick={() => setWxHist(false)}>
          <div className="wxmbox" onClick={(e) => e.stopPropagation()}>
            <div className="wxmhead">
              <span>🕒 {t("Hava Geçmişi")}</span>
              <button className="lbclose" onClick={() => setWxHist(false)}>✕</button>
            </div>
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
                        const log = st.weatherLog.filter((_, j) => j !== i);
                        up({ weather: log.length ? log[log.length - 1].w : "dry",
                          weatherLog: log });
                      }}>✕</button>
                  </div>
                );
              })}
            </div>
            <div className="wxmplan">
              <div className="wxmptitle">➕ {t("Planlı geçiş ekle")}</div>
              <div className="wxmprow">
                <select value={wxPlanW} onChange={(e) => setWxPlanW(e.target.value)}>
                  {Object.entries(WEATHER).map(([id, w]) => (
                    <option key={id} value={id}>{w.ico} {t(w.lbl)}</option>
                  ))}
                </select>
                <input type="text" placeholder="s:dd:ss" value={wxPlanT}
                  onChange={(e) => setWxPlanT(e.target.value)}
                  title={t("Yarış saati (başlangıçtan itibaren)")} />
                <button className="histbtn" onClick={() => {
                  const tt = parseHMS(wxPlanT);
                  if (tt <= 0) return;
                  const log = [...(st.weatherLog || []).filter((e) => Math.abs(e.t - tt) > 0.5),
                    { t: tt, w: wxPlanW, src: "plan" }].sort((a, b) => a.t - b.t);
                  up({ weather: WX({ weatherLog: log }).lap ? st.weather : st.weather,
                    weatherLog: log });
                  setWxPlanT("");
                }}>{t("Ekle")}</button>
              </div>
              <div className="wxmquick">
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
      )}
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
            onClick={() => setTeamOpen(true)} title={t("Takımlarım")}
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
              ? `S${liveInfo.stintIdx + 1}${liveInfo.driver ? ` · ${liveInfo.driver}` : ""}`
              : null}
            pitAlert={!!pitSoon}
            pos={own?.pos != null ? `P${own.pos}` : null}
            posSub={pitFrac > 0 ? `%${Math.round(pitFrac)} ${t("stint")}` : null}
            energy={own?.virtualEnergy != null ? `%${Math.round(own.virtualEnergy)}` : null}
            energyPct={own?.virtualEnergy ?? 0}
            liveOn={live?.ts ? true : false}
            liveLabel={live?.ts ? t("canlı") : t("bağlı değil")}
            onBridge={() => go("live")}
            onRaceData={() => setRdOpen(true)} dirtyN={rdN}
            onPitBoard={() => setPitboard(true)} />
        );
      })()}


      {pitboard && (
        <div className="pitboard" onClick={() => setPitboard(false)}>
          <button className="close" onClick={() => setPitboard(false)}>✕</button>
          <img className="plogo" src={`${ASSET}logo.png`} alt="" />
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

          {tab === "setup" && (<>
            <div className="card" data-tour="setuptab">
              <h2>🔧 {t("Setup Yükle")}</h2>
              {setupForm()}
            </div>

            <div className="card" style={{ marginTop: 12 }}>
              <h2>📚 {t("Setup Havuzu")} ({suList.length}/{setups.length})</h2>
              {/* araç çubuğu: solda filtreler, sağda aksiyonlar — eşit yükseklik, sarınca da düzenli */}
              <div className="toolbar">
                <div className="tb-group">
                  <select value={suFTrack} onChange={(e) => setSuFTrack(e.target.value)}>
                    <option value="">{t("Tüm pistler")}</option>
                    {TRACKS.filter((tr) => setups.some((x) => x.track === tr.id))
                      .map((tr) =>
                        <option key={tr.id} value={tr.id}>{trackFlag(tr.id)} {tr.name}</option>)}
                  </select>
                  <select value={suFCond} onChange={(e) => setSuFCond(e.target.value)}>
                    <option value="">{t("Kuru + Wet")}</option>
                    <option value="dry">☀️ {t("Kuru")}</option>
                    <option value="wet">🌧 Wet</option>
                  </select>
                  <select value={suFSess} onChange={(e) => setSuFSess(e.target.value)}>
                    <option value="">{t("Yarış + Sıralama")}</option>
                    <option value="R">{t("Yarış")}</option>
                    <option value="Q">{t("Sıralama")}</option>
                  </select>
                  <input type="text" value={suQuery} placeholder={`🔎 ${t("ara")}…`}
                    style={{ textTransform: "none", minWidth: 150 }}
                    onChange={(e) => setSuQuery(e.target.value)} />
                </div>
                <div className="tb-group">
                  {st.track && setups.some((x) => x.track === st.track) && (
                    <button className="act" style={{ fontSize: 11 }}
                      onClick={() => setSuFTrack(st.track)}>
                      📍 {trackName(st.track)}</button>
                  )}
                  <button className="act" style={{ fontSize: 11,
                      ...(suMine ? { borderColor: "var(--green)", color: "var(--green)" } : {}) }}
                    title={t("Yalnız senin yüklediklerin")}
                    onClick={() => setSuMine((v) => !v)}>
                    👤 {t("Benim setuplarım")}</button>
                  <span className="tb-sep" />
                  <button className="act" style={{ fontSize: 11 }}
                    title={suView === "cards" ? t("Tablo") : t("Kartlar")}
                    onClick={toggleSuView}>
                    {suView === "cards" ? <>☰ {t("Tablo")}</> : <>⊞ {t("Kartlar")}</>}</button>
                </div>
              </div>
              {suDelErr && <div className="hint warn">⚠ {suDelErr}</div>}
              {/* Havuz doluyken süzgeç hiçbir şeyi tutmuyorsa "Henüz setup yok" demek
                  yanıltıcıydı (başlıktaki 0/N ile çelişiyordu) → sebebe göre mesaj. */}
              {!suList.length && (
                <div className="hint">
                  {poolEmptyReason(setups.length, suList.length) === "filtered"
                    ? <>{t("Bu süzgeçle setup yok.")}{" "}
                      <button className="act" style={{ fontSize: 11 }}
                        onClick={() => { setSuFTrack(""); setSuFCond(""); setSuFSess("");
                          setSuQuery(""); setSuMine(false); }}>
                        ✕ {t("Süzgeçleri temizle")}</button></>
                    : t("Henüz setup yok — ilk dosyayı yukarıdan yükle.")}
                </div>
              )}
              {suList.length > 0 && setupTable(suList)}
              {suHasMore && (
                <div style={{ textAlign: "center", marginTop: 10 }}>
                  <button className="act" onClick={loadMoreSetups}>
                    ⬇ {t("Daha fazla yükle")}</button>
                </div>
              )}
            </div>
          </>)}

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
