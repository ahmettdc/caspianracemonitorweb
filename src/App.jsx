import { useState, useMemo, useEffect, useRef, lazy, Suspense } from "react";
import { firebaseReady, touchUserProfile, watchUserDoc,
  requestAccess, watchAllUsers, setUserAllowed, updateProfile,
  createTeam, joinTeam, watchMyTeams, watchTeam,
  setTeamRole, toggleTeamBadge, leaveTeam, setTeamMemberName,
  sendChat, watchChat, deleteChat, renameTeam, syncMyTeamName,
  addSetup, watchSetups, deleteSetup,
  createSeason, deleteSeason, watchSeasons,
  createRace, updateRace, deleteRace, watchRaces,
  raceStateGet, raceStateSet, raceStateSubscribe } from "./storage";
import { signInGoogle, signOut, watchAuth, authReady } from "./auth";
import { CHANGELOG } from "./changelog";
import {
  parseHMS, fmtHMS, fmtLap, msToLocalInput,
  DEFAULT_STATE, EMPTY_PIT, TYRE_2_SEC, TYRE_4_SEC,
  WEATHER, wxLog, wxAtRel, WX, effLapSec, effCons, tyState,
  computePlan, migrate, lastStintFuel,
} from "./engine";
import { css } from "./styles";
import { EN } from "./i18n";
import { msFromCell, parseMotecLog, parseTelemetryText, guessMapping } from "./parsers";
import {
  SLOT_COLORS, APP_VERSION, REPO_URL, SEEN_VER_KEY, ASSET, AV,
  TRACKS, PIT_LANE_TIMES, TRACK_ASSET, trackFlag,
  CARS, CAR_CLASSES, trackName, carName, carImg,
  PIE_COLORS,
} from "./constants";
import { chatBeep } from "./sound";
import {
  safeParseState, carriedTyre,
  applyUpPit, applyUpTyre, applyUpOvr, applyBumpLaps, applyClearLaps,
  applyQuickTyre, applyUpStintLap, applyUpTyreCell, applyAssignDriver,
  computeTyreInfo, computeDriverPlan, computeSlotStats, computeChartData,
  computeLiveInfo, buildTimeline,
} from "./state";
import {
  TourOverlay, Wheel, Num, Bolt, Tyre, Ring,
  BADGES, teamBadgesOf, hasBadge, ChatPanel, SetupForm, SetupTable,
} from "./components";

/* Sekmeler talep üzerine yüklenir (kod bölme) — ilk bundle küçülür,
   recharts yalnız Telemetri açılınca gelir. */
const DashTab = lazy(() => import("./tabs/DashTab"));
const StintTab = lazy(() => import("./tabs/StintTab"));
const FuelTab = lazy(() => import("./tabs/FuelTab"));
const TyreTab = lazy(() => import("./tabs/TyreTab"));
const DriversTab = lazy(() => import("./tabs/DriversTab"));
const TeleTab = lazy(() => import("./tabs/TeleTab"));

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
/* Sohbet bildirim sesi (chatBeep) → ./sound.js (import edildi). */

/* ============================================================
   REHBER TURU — ekranı karartır, sıradaki öğeyi ışıklandırır.
   steps: [{ sel, title, body, pos? }] — sel bulunamazsa adım atlanır.
   ============================================================ */


/* kullanıcı rozetleri */
/* Rozet listesi: sahiplik ve admin otomatik, diğerleri takım sahibince atanır.
   badges[uid] eski sürümde metin, yenisinde { driver:true, ... } olabilir. */

/* Hava modeli (WEATHER, wxLog, wxAtRel, WX, effLapSec, effCons), tyState,
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
    try { return localStorage.getItem("crm-lang") || "tr"; } catch { return "tr"; }
  });
  const t = (str) => (lang === "en" ? (EN[str] ?? str) : str);
  const switchLang = (l) => {
    setLang(l);
    try { localStorage.setItem("crm-lang", l); } catch {}
  };
  /* CSS text-transform:uppercase harf kurallarını belge diline göre uygular.
     lang="tr" sabit kalırsa İngilizce'de de i → İ olur (STİNT, PİT...). */
  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "tr";
  }, [lang]);
  const [entered, setEntered] = useState(false); // lobi geçildi mi (solo/oda)
  const [pickDone, setPickDone] = useState(false); // pist/araç seçimi tamamlandı mı
  const [setupDone, setSetupDone] = useState(false); // data giriş adımı tamamlandı mı
  const [userName, setUserName] = useState("");
  const [curRace, setCurRace] = useState("");    // aktif yarış id (takım içinde)
  const [role, setRole] = useState("editor");    // "editor" | "viewer" (takım rolünden)
  const [syncMsg, setSyncMsg] = useState("");
  const [lastSync, setLastSync] = useState(null); // {by, at}
  const sync = useRef({ rev: 0, applying: false, timer: null });
  const stRef = useRef(st);
  stRef.current = st;

  const pushState = async (rid) => {
    try {
      const rev = sync.current.rev + 1;
      await raceStateSet(curTeamRef.current, rid, {
        stateJson: JSON.stringify(stRef.current), rev,
        updatedBy: userName || "isimsiz", updatedAt: Date.now(),
      });
      sync.current.rev = rev; setLastSync({ by: t("sen"), at: Date.now() }); setSyncMsg("");
    } catch (e) { setSyncMsg(t("Yazma hatası — tekrar denenecek")); }
  };

  const schedulePush = () => {
    if (!curRace || role !== "editor" || sync.current.applying) return;
    clearTimeout(sync.current.timer);
    sync.current.timer = setTimeout(() => pushState(curRace), 800);
  };

  // her state değişiminde (kullanıcı kaynaklı) paylaş
  useEffect(() => { schedulePush(); /* eslint-disable-next-line */ }, [st]);

  // odayı anlık dinle (Firebase onValue — polling'e gerek yok)
  useEffect(() => {
    if (!curRace) return;
    const off = raceStateSubscribe(curTeamRef.current, curRace, (remote) => {
      if (remote.rev > sync.current.rev) {
        /* bozuk/yarım uzak veri gelirse rev'i ilerletme, son iyi durumu koru */
        const parsed = safeParseState(remote.stateJson);
        if (!parsed) { console.warn("Bozuk uzak state atlandı (rev", remote.rev, ")"); return; }
        sync.current.applying = true;
        sync.current.rev = remote.rev;
        setSt(migrate(parsed));
        setLastSync({ by: remote.updatedBy, at: remote.updatedAt });
        /* başka bir editör yazdı → kısa görünürlük uyarısı (son yazan kazanır) */
        if (remote.updatedBy && remote.updatedBy !== userName)
          setSyncMsg(t("Uzaktan güncellendi: ") + remote.updatedBy);
        setTimeout(() => { sync.current.applying = false; }, 50);
      }
    });
    return () => off();
  }, [curRace]);

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
      setTeamOpen(false); setSyncMsg("");
      setTimeout(() => { sync.current.applying = false; }, 60);
    } catch (e) { setSyncMsg(t("Bağlantı hatası: ") + e.message); }
  };

  const leaveRace = () => {
    setCurRace(""); setRole("editor"); setLastSync(null); setSyncMsg("");
    setEntered(false); setPickDone(false); setSetupDone(false);
  };

  const up = (patch) => setSt((s) => ({ ...s, ...patch }));
  /* dizileri gerektiği kadar uzatır (14 stint sınırını kaldırır) */
  /* grow + reducer'lar (upPit/upTyre/quickTyre/... ) → ./state.js */

  const upPit = (i, patch) => setSt((s0) => applyUpPit(s0, i, patch));
  const upTyre = (i, t) => setSt((s0) => applyUpTyre(s0, i, t));
  const upOvr = (i, val) => setSt((s0) => applyUpOvr(s0, i, val));
  /* Tur manuel override: computed'dan başlayıp ±adım; time override'ı temizler */
  const bumpLaps = (i, curLaps, delta) => setSt((s0) => applyBumpLaps(s0, i, curLaps, delta));
  const clearLaps = (i) => setSt((s0) => applyClearLaps(s0, i));

  const mode = tab === "code80" ? "code80" : "race";
  const plan = useMemo(() => computePlan(st, mode), [st, mode]);
  const racePlan = useMemo(() => computePlan(st, "race"), [st]);
  const lsf = useMemo(() => lastStintFuel(st.lastStintCountdown, st, computePlan(st, "race").flagExtra), [st]);
  const lsf80 = useMemo(() => lastStintFuel(st.code80LastStint, st), [st]);
  const totalVE = effCons(st) * plan.totalLaps + st.extraLap * effCons(st); // % VE (DATA I2)
  const totalFuelL = totalVE * st.fuelRatio;            // gerçek litre karşılığı
  const fuelCarried = 100 * st.fuelRatio;               // %100 = taşınan yakıt (L)
  const realPerLap = st.consumption * st.fuelRatio;     // gerçek tüketim L/tur
  const TY = ["FL", "FR", "RL", "RR"];

  /* ---------- Faz 3: lastik stratejisi ---------- */
  /* stint bazlı hızlı lastik atama
     FL=0 FR=1 RL=2 RR=3 · fresh: kullanılmamış en küçük numaralar */
  const quickTyre = (rowIdx, action) => setSt((s0) => applyQuickTyre(s0, rowIdx, action));

  /* stinte özel ortalama tur süresi (boş → yarış datasındaki ortalama kullanılır) */
  const upStintLap = (i, v) => setSt((s0) => applyUpStintLap(s0, i, v));

  const upTyreCell = (row, col, val) => setSt((s0) => applyUpTyreCell(s0, row, col, val));
  const clearTyres = () => setSt((s) => ({
    ...s,
    tyreQual: ["1", "2", "3", "4"],
    tyreStints: s.tyreStints.map(() => ["", "", "", ""]),
  }));

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
    setSt((s) => ({ ...s, roster: [...s.roster, n] }));
    setNewDriver("");
  };
  const removeDriver = (n) => setSt((s) => ({
    ...s,
    roster: s.roster.filter((x) => x !== n),
    driverAssign: s.driverAssign.map((a) => (a === n ? "" : a)),
  }));
  const assignDriver = (i, n) => setSt((s0) => applyAssignDriver(s0, i, n));
  const clearAssign = () => setSt((s) => ({
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

  /* ---------- Faz 4: telemetri ---------- */
  const [slot, setSlot] = useState("A");
  const [chartMode, setChartMode] = useState("box"); // "box" | "line"
  const [rawTele, setRawTele] = useState("");
  const [parsed, setParsed] = useState(null);   // {headers, lapRows, ncols} | {error}
  const [mapping, setMapping] = useState(null); // {labelCol,timeCol,fuelCol,wear:[4]}
  const fmtMs = (ms) => fmtLap(ms / 1000);

  const doParse = (text) => {
    const m = parseMotecLog(text);          // önce ham kanal log'u dene
    if (m) { setParsed(m); setMapping(null); return; }
    const p = parseTelemetryText(text);
    setParsed(p);
    if (p && !p.error) setMapping(guessMapping(p));
  };
  const onTeleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { setRawTele(String(rd.result)); doParse(String(rd.result)); };
    rd.readAsText(f);
  };

  /* %105 kuralı: dahil turlar içinde en iyisini bul, %105'ini aşanların tikini kaldır.
     Trafik, sarı bayrak, hata yapılan turlar ortalamayı ve medyanı bozmasın diye. */
  const P105 = 1.05;
  const apply105 = (laps) => {
    const cand = laps.filter((l) => l.use && l.ms > 0);
    if (cand.length < 2) return laps;
    const best = Math.min(...cand.map((l) => l.ms));
    const lim = best * P105;
    return laps.map((l) => (l.use && l.ms > lim ? { ...l, use: false } : l));
  };
  const apply105Slot = (sl) => setSt((s) => {
    const t0 = s.telemetry[sl];
    if (!t0) return s;
    return { ...s, telemetry: { ...s.telemetry, [sl]: { ...t0, laps: apply105(t0.laps) } } };
  });

  /* ham log → mevcut tur modeline çevir (yakıt litre → VE %) */
  const saveMotec = () => {
    if (!parsed?.motec) return;
    const ratio = st.fuelRatio > 0 ? st.fuelRatio : null;
    const laps = parsed.laps.map((l) => ({
      label: `Lap ${l.lap}`,
      ms: Math.round(l.sec * 1000),
      fuel: l.fuelL != null && ratio ? +(l.fuelL / ratio).toFixed(2) : null,
      fuelL: l.fuelL != null ? +l.fuelL.toFixed(2) : null,
      w: l.w.map((x) => (x == null ? null : +x.toFixed(2))),
      avgSpd: l.avgSpd != null ? Math.round(l.avgSpd) : null,
      maxSpd: l.maxSpd != null ? Math.round(l.maxSpd) : null,
      partial: !!l.partial, pit: !!l.pit,
      use: !l.pit,
    }));
    setSt((s) => ({ ...s, telemetry: { ...s.telemetry,
      [slot]: { laps: apply105(laps), name: `Stint ${slot}`, src: parsed.meta } } }));
    setRawTele(""); setParsed(null); setMapping(null);
  };

  const saveSlot = () => {
    if (!parsed || parsed.error || !mapping || mapping.timeCol < 0) return;
    const laps = parsed.lapRows.map((r) => {
      const label = String(r[mapping.labelCol] || "").trim();
      const ms = msFromCell(r[mapping.timeCol]);
      const fuelRaw = mapping.fuelCol >= 0
        ? parseFloat(String(r[mapping.fuelCol] || "").replace(",", ".")) : NaN;
      const w = mapping.wear.map((wi) => wi >= 0
        ? parseFloat(String(r[wi] || "").replace(",", ".")) : NaN);
      const refuel = !isNaN(fuelRaw) && fuelRaw > 0; // pozitif değişim = dolum turu
      const abs = isNaN(fuelRaw) ? null : Math.abs(fuelRaw);
      const lit = mapping.fuelIsLitre && st.fuelRatio > 0;
      return {
        label, ms,
        fuel: abs == null ? null : (lit ? +(abs / st.fuelRatio).toFixed(2) : abs),
        fuelL: lit ? +abs.toFixed(2) : null,
        w: w.map((x) => (isNaN(x) ? null : x)),
        use: ms != null && !/^out/i.test(label) && !refuel,
      };
    }).filter((l) => l.ms != null);
    if (!laps.length) return;
    setSt((s) => ({ ...s, telemetry: { ...s.telemetry,
      [slot]: { laps: apply105(laps), name: `Stint ${slot}` } } }));
    setRawTele(""); setParsed(null); setMapping(null);
  };

  const toggleLap = (sl, li) => setSt((s) => {
    const t = s.telemetry[sl]; if (!t) return s;
    const laps = t.laps.map((l, i) => (i === li ? { ...l, use: !l.use } : l));
    return { ...s, telemetry: { ...s.telemetry, [sl]: { ...t, laps } } };
  });
  const removeSlot = (sl) => setSt((s) => ({
    ...s, telemetry: { ...s.telemetry, [sl]: null } }));

  const slotStats = useMemo(() => computeSlotStats(st), [st.telemetry]);

  const chartData = useMemo(() => computeChartData(st), [st.telemetry]);

  const loadedSlots = ["A", "B", "C", "D"].filter((sl) => st.telemetry[sl]);
  const baseSlot = loadedSlots[0];

  /* ---------- canlı yarış modu ---------- */
  const [now, setNow] = useState(Date.now());
  const [pitboard, setPitboard] = useState(false);
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const liveInfo = useMemo(() => computeLiveInfo(st, racePlan, now),
    [now, st.raceStartMs, st.driverAssign, st.actualPits, st.pitRepairs, st.autoOvr, racePlan]);

  /* --- gerçek pit işaretleme (sadece düzenleyici) --- */
  const canEdit = !curRace || role === "editor";
  const markPit = () => {
    if (liveInfo.status !== "live") return;
    const nowMs = Date.now();
    const i = liveInfo.stintIdx; // şu an sürülen (bitirilmekte olan) stint
    const actualPits = [...(st.actualPits || [])];
    while (actualPits.length <= i) actualPits.push(null);
    actualPits[i] = nowMs;
    const patch = { actualPits };
    /* gerçek stint süresini o stintin override'ına yaz → plan gerçeğe kilitlenir */
    const durSec = Math.round((nowMs - liveInfo.stintStartMs) / 1000);
    if (durSec > 0) {
      const overrides = [...(st.overrides || [])];
      while (overrides.length <= i) overrides.push("");
      overrides[i] = fmtHMS(durSec);
      const autoOvr = [...(st.autoOvr || [])];
      while (autoOvr.length <= i) autoOvr.push(false);
      autoOvr[i] = true;
      patch.overrides = overrides;
      patch.autoOvr = autoOvr;
    }
    up(patch);
  };
  const unmarkPit = () => {
    const ap = [...(st.actualPits || [])];
    let idx = -1;
    for (let i = 0; i < ap.length; i++) if (Number.isFinite(ap[i])) idx = i;
    if (idx < 0) return;
    ap[idx] = null;
    while (ap.length && !Number.isFinite(ap[ap.length - 1])) ap.pop();
    const patch = { actualPits: ap };
    if ((st.autoOvr || [])[idx]) { // sadece otomatik yazılan override silinir
      const overrides = [...(st.overrides || [])]; overrides[idx] = "";
      const autoOvr = [...(st.autoOvr || [])]; autoOvr[idx] = false;
      patch.overrides = overrides; patch.autoOvr = autoOvr;
    }
    up(patch);
  };
  const resetPits = () => {
    if (!confirm(t("Gerçek pit işaretlemelerini sıfırla?"))) return;
    const overrides = (st.overrides || []).map((v, i) => ((st.autoOvr || [])[i] ? "" : v));
    up({ actualPits: [], pitRepairs: [], autoOvr: [], overrides });
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
    const carUrl = st.car ? abs(carImg(st.carClass, st.car)) : "";
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
        (ri) => rows[ri].isLast ? "r-last" : "");
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
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { alert(t("Açılır pencere engellendi — tarayıcıdan izin ver")); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8">
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
    w.document.close();
  };
  const pitSoon = liveInfo.status === "live" && liveInfo.phase === "stint"
    && liveInfo.nextPitIn < 300000;
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
  /* ---- kimlik doğrulama (Google) ---- */
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authErr, setAuthErr] = useState("");
  const [udoc, setUdoc] = useState(null);   // null=yükleniyor, {}=kayıt yok
  const [authMode, setAuthMode] = useState("in"); // "in" giriş | "up" kayıt
  const [regNote, setRegNote] = useState("");
  const [regName, setRegName] = useState("");
  useEffect(() => watchAuth((u) => { setUser(u); setAuthLoading(false); }), []);
  useEffect(() => {
    if (!user) { setUdoc(null); return; }
    setRegName((v) => v || user.displayName || "");
    touchUserProfile(user).catch(() => {});
    return watchUserDoc(user.uid, (d) => setUdoc(d));
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
  const [myTeams, setMyTeams] = useState({});
  const [curTeam, setCurTeam] = useState("");      // seçili takım id
  const [teamData, setTeamData] = useState(null);
  const [tForm, setTForm] = useState({ name: "", join: "" });
  const [seasons, setSeasons] = useState({});
  const [races, setRaces] = useState({});
  const [curSeason, setCurSeason] = useState("");   // "" = tümü
  const [rForm, setRForm] = useState(null);          // yarış ekleme/düzenleme formu
  const [tErr, setTErr] = useState("");
  const [profName, setProfName] = useState("");
  useEffect(() => {
    if (!user || !access) return;
    return watchMyTeams(user.uid, (t) => {
      setMyTeams(t || {});
      setCurTeam((c) => c || Object.keys(t || {})[0] || "");
    });
  }, [user, access]);
  const curTeamRef = useRef("");
  curTeamRef.current = curTeam;
  useEffect(() => {
    if (!curTeam) { setTeamData(null); setSeasons({}); setRaces({}); return; }
    const o1 = watchTeam(curTeam, setTeamData);
    const o2 = watchSeasons(curTeam, (x) => setSeasons(x || {}));
    const o3 = watchRaces(curTeam, (x) => setRaces(x || {}));
    return () => { o1(); o2(); o3(); };
  }, [curTeam]);
  /* ---- sohbet: genel / takım / yarış kanalları ---- */
  /* ---- rehber turu ---- */
  const [tour, setTour] = useState(null);            // "lobby" | "main" | null
  const TOUR_L = "rm_tour_lobby", TOUR_M = "rm_tour_main";
  const seenTour = (k) => { try { return localStorage.getItem(k) === "1"; } catch { return true; } };
  const markTour = (k) => { try { localStorage.setItem(k, "1"); } catch { /* yoksay */ } };

  /* ---- setup deposu ---- */
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
    if (!suFile || !curTeam || suBusy) return;
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

  /* ---- yüzen mini oynatıcı ---- */
  const [streamCorner, setStreamCorner] = useState(() => {
    try { return localStorage.getItem("rm_stream_corner") || "br"; } catch { return "br"; }
  });                                                 // br | bl | tr | tl
  const [streamMin, setStreamMin] = useState(false);  // tek satıra küçült
  const [chatSound, setChatSound] = useState(() => {
    try { return localStorage.getItem("rm_chat_sound") !== "0"; } catch { return true; }
  });
  const toggleChatSound = () => setChatSound((v) => {
    try { localStorage.setItem("rm_chat_sound", v ? "0" : "1"); } catch { /* yoksay */ }
    return !v;
  });
  const prevUnreadRef = useRef(null);

  const [streamW, setStreamW] = useState(() => {
    try { return Math.min(1080, Math.max(240,
      +(localStorage.getItem("rm_stream_w") || 320))); } catch { return 320; }
  });
  const [streamDrag, setStreamDrag] = useState(false);
  const dragRef = useRef(null);   // { startX, startW, dir }

  /* tutamaçtan sürükleyerek boyutlandır — yükseklik 16:9'dan kendiliğinden gelir */
  const startResize = (e) => {
    e.preventDefault();
    const dir = streamCorner === "br" || streamCorner === "tr" ? -1 : 1;
    dragRef.current = { startX: e.clientX, startW: streamW, dir };
    setStreamDrag(true);
    const move = (ev) => {
      const d = dragRef.current; if (!d) return;
      const w = d.startW + (ev.clientX - d.startX) * d.dir;
      setStreamW(Math.min(Math.min(1080, window.innerWidth - 32), Math.max(240, w)));
    };
    const upFn = () => {
      dragRef.current = null;
      setStreamDrag(false);
      setStreamW((w) => {
        try { localStorage.setItem("rm_stream_w", String(Math.round(w))); }
        catch { /* yoksay */ }
        return w;
      });
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", upFn);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", upFn);
  };
  const moveStream = (c) => {
    setStreamCorner(c);
    try { localStorage.setItem("rm_stream_corner", c); } catch { /* yoksay */ }
  };

  const [lobSeason, setLobSeason] = useState("all"); // lobide şampiyona süzgeci
  const [tnEdit, setTnEdit] = useState(null);        // takım adı düzenleme metni
  const [chatOpen, setChatOpen] = useState(false);
  const [chatChan, setChatChan] = useState("team");
  const [chatAll, setChatAll] = useState({});   // { path: [mesajlar] }
  const [chatText, setChatText] = useState("");
  const [chatSeen, setChatSeen] = useState(() => {   // { path: sonGörülenTs }
    try { return JSON.parse(localStorage.getItem("rm_chat_seen_v2") || "{}"); }
    catch { return {}; }
  });
  const chatEndRef = useRef(null);
  const raceEndRef = useRef(null);

  const myRole = teamData?.members?.[user?.uid] || "";
  const canEditTeam = myRole === "owner" || myRole === "editor";
  /* rozet/rol yönetimi: takım sahibi veya site admini */
  const canManageTeam = myRole === "owner" || isAdmin;
  /* not: yetki rozetten türer — 🎧 mühendis editor, 🛞 sürücü/rozetsiz viewer */
  const myBadges = teamBadgesOf(teamData, user?.uid, udoc);

  /* Kendi görünen adımı takım düğümüne yaz — diğer üyeler pilot listesinde görsün */
  useEffect(() => {
    if (!curTeam || !user?.uid || !teamData?.members?.[user.uid]) return;
    const nm = (userName || "").trim();
    if (!nm || teamData?.names?.[user.uid] === nm) return;
    setTeamMemberName(curTeam, user.uid, nm).catch(() => {});
  }, [curTeam, user, userName, teamData]);

  /* Rozet yetkiyi belirler: 🎧 Mühendis → editor (datayı değiştirir),
     🛞 Sürücü / rozetsiz → viewer (sadece görür). Takım sahibi her zaman owner.
     Firebase kuralları rolü baz aldığı için rozet değişince rol de yazılır. */
  /* Kanallar. Yazma yetkisi role bağlı değil — sürücüler de konuşur. */
  /* Pencerede genel + takım; yarış sohbeti kendi sekmesinde (Telemetri'nin sağında) */
  const chatChans = useMemo(() => {
    const out = [{ id: "global", lbl: "Genel", ico: "🌍", path: "globalChat" }];
    if (curTeam) out.push({ id: "team", lbl: "Takım", ico: "🏢",
      path: `teams/${curTeam}/chat` });
    return out;
  }, [curTeam]);

  const raceChan = useMemo(() => (curTeam && curRace
    ? { id: "race", ico: "🏁", lbl: races[curRace]?.name || "",
      path: `teams/${curTeam}/raceChat/${curRace}` }
    : null), [curTeam, curRace, races]);

  const allChans = useMemo(() => (raceChan ? [...chatChans, raceChan] : chatChans),
    [chatChans, raceChan]);

  /* açık olmayan kanalları da dinliyoruz — okunmamış sayacı için */
  useEffect(() => {
    if (!user) { setChatAll({}); return; }
    const offs = allChans.map((c) =>
      watchChat(c.path, (msgs) => setChatAll((a) => ({ ...a, [c.path]: msgs }))));
    return () => offs.forEach((f) => f && f());
  }, [user, allChans]);

  /* seçili kanal kaybolursa (yarıştan çıkınca) geçerli bir kanala düş */
  useEffect(() => {
    if (!chatChans.some((c) => c.id === chatChan)) {
      setChatChan(chatChans[chatChans.length - 1]?.id || "global");
    }
  }, [chatChans, chatChan]);

  const curChan = chatChans.find((c) => c.id === chatChan) || chatChans[0];
  const chatMsgs = (curChan && chatAll[curChan.path]) || [];
  const unreadOf = (c) => ((chatAll[c.path] || [])
    .filter((m) => (m.at || 0) > (chatSeen[c.path] || 0) && m.uid !== user?.uid).length);
  const chatUnread = chatChans.reduce((a, c) => a + unreadOf(c), 0);
  const raceUnread = raceChan ? unreadOf(raceChan) : 0;

  /* yeni mesaj sesi: toplam okunmamış ARTTIĞINDA çal.
     İlk yüklemede çalmaz (önceki değer bilinmeden karşılaştırma yapılmaz);
     kendi mesajların unreadOf'ta zaten sayılmıyor. */
  useEffect(() => {
    const total = chatUnread + raceUnread;
    if (prevUnreadRef.current !== null
        && total > prevUnreadRef.current && chatSound) chatBeep();
    prevUnreadRef.current = total;
  }, [chatUnread, raceUnread, chatSound]);

  /* yarış sekmesi açıkken o kanalı okundu say */
  useEffect(() => {
    if (tab !== "rchat" || !raceChan) return;
    const ms = chatAll[raceChan.path] || [];
    const last = ms.length ? (ms[ms.length - 1].at || 0) : 0;
    if (last && (chatSeen[raceChan.path] || 0) < last) {
      const next = { ...chatSeen, [raceChan.path]: last };
      setChatSeen(next);
      try { localStorage.setItem("rm_chat_seen_v2", JSON.stringify(next)); }
      catch { /* yoksay */ }
    }
    raceEndRef.current?.scrollIntoView({ block: "end" });
  }, [tab, raceChan, chatAll, chatSeen]);

  useEffect(() => {
    if (!chatOpen || !curChan) return;
    const last = chatMsgs.length ? (chatMsgs[chatMsgs.length - 1].at || 0) : Date.now();
    if ((chatSeen[curChan.path] || 0) < last) {
      const next = { ...chatSeen, [curChan.path]: last };
      setChatSeen(next);
      try { localStorage.setItem("rm_chat_seen_v2", JSON.stringify(next)); }
      catch { /* yoksay */ }
    }
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [chatOpen, chatMsgs, curChan, chatSeen]);

  const doSendTo = async (chan) => {
    const v = chatText.trim();
    if (!v || !chan) return;
    setChatText("");
    try { await sendChat(chan.path, user, userName, v); }
    catch (e) { console.warn("mesaj gönderilemedi:", e?.message); }
  };

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
    <SetupForm t={t} onSetupFile={onSetupFile} suFile={suFile} suMeta={suMeta}
      setSuMeta={setSuMeta} seasons={seasons} suErr={suErr} suBusy={suBusy}
      saveSetup={saveSetup} />
  );

  const setupTable = (rows) => (
    <SetupTable rows={rows} t={t} st={st} lang={lang} user={user} isAdmin={isAdmin}
      onDownload={downloadSetup}
      onDelete={(su) => { if (window.confirm(t("Bu setup silinsin mi?") + "\n" + (su.name || "")))
        deleteSetup(su.id).catch(() => {}); }} />
  );

  const setupModal = suOpen && (
    <div className="wxmodal" onClick={() => setSuOpen(false)}>
      <div className="wxmbox" style={{ width: "min(1080px,97vw)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="wxmhead">
          <span>🔧 {t("Setup Havuzu")} · {t("Ortak")} ({suList.length}/{setups.length})</span>
          <button className="lbclose" style={{ marginLeft: "auto", marginRight: 4 }}
            title={t("Setup Ekle")}
            onClick={() => setSuUpOpen((v) => !v)}>{suUpOpen ? "▾" : "＋"}</button>
          <button className="lbclose" onClick={() => setSuOpen(false)}>✕</button>
        </div>
        <div style={{ padding: "12px 16px", maxHeight: "70vh", overflowY: "auto" }}>
          {suUpOpen && (
            <div className="card" style={{ marginBottom: 12 }}>
              <h2>🔧 {t("Setup Yükle")}</h2>
              {setupForm()}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <select value={suFTrack} onChange={(e) => setSuFTrack(e.target.value)}>
              <option value="">{t("Tüm pistler")}</option>
              {TRACKS.filter((tr) => setups.some((x) => x.track === tr.id))
                .map((tr) => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
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
          </div>
          {!suList.length
            ? <div className="hint">{t("Bu süzgeçle setup yok.")}</div>
            : setupTable(suList)}
        </div>
      </div>
    </div>
  );

  const chatModal = chatOpen && user && curChan && (
    <div className="wxmodal" onClick={() => setChatOpen(false)}>
      <div className="wxmbox" style={{ width: "min(560px,94vw)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="wxmhead">
          <span>💬 {t("Sohbet")}</span>
          <button className="lbclose" style={{ marginLeft: "auto", marginRight: 4 }}
            title={chatSound ? t("Bildirim sesini kapat") : t("Bildirim sesini aç")}
            onClick={toggleChatSound}>{chatSound ? "🔔" : "🔕"}</button>
          <button className="lbclose" onClick={() => setChatOpen(false)}>✕</button>
        </div>
        <div className="chattabs">
          {chatChans.map((c) => {
            const u2 = unreadOf(c);
            return (
              <button key={c.id} className={`ctab ${c.id === chatChan ? "on" : ""}`}
                onClick={() => setChatChan(c.id)}>
                {c.ico} {c.id === "team" ? (teamData?.meta?.name || t(c.lbl)) : t(c.lbl)}
                {u2 > 0 && c.id !== chatChan && <b className="cdot">{u2 > 9 ? "9+" : u2}</b>}
              </button>
            );
          })}
        </div>
        {chatBody(curChan)}
      </div>
    </div>
  );

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
      💬 {t("Sohbet")}
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
    markTour(tour === "lobby" ? TOUR_L : TOUR_M);
    setTour(null);
  };

  const tourSteps = tour === "lobby" ? [
    { title: t("Race Monitor'a hoş geldin! 🏁"),
      body: t("Bu araç, LMU endurance yarışlarında pit wall'unuz: stint planı, yakıt, lastik ve canlı takip. 1 dakikada temel akışı gösterelim.") },
    { sel: "[data-tour='races']", title: t("Yarış Takvimi"),
      body: t("Takımının yaklaşan yarışları burada, şampiyonaya göre gruplu. Bir yarışa tıkla — pist, araç ve süre önceden hazır, direkt pit wall açılır.") },
    { sel: "[data-tour='manage']", title: t("Takvimi & Takımı Yönet"),
      body: t("Sezon ve yarış eklemek, üyeleri ve rozetleri yönetmek burada. 🎧 Mühendis rozeti datayı değiştirebilir, sürücüler yalnızca görür.") },
    { sel: "[data-tour='chat']", title: t("Sohbet"),
      body: t("🌍 Genel ve 🏢 Takım kanalları burada. Yarış açıkken ayrıca yarışa özel bir sohbet sekmesi belirir.") },
    { sel: "[data-tour='info']", title: t("Neler değişti"),
      body: t("Uygulama sık güncellenir — yeni sürümde kırmızı nokta belirir, notları buradan okursun. Rehberi de buradan yeniden başlatabilirsin.") },
  ] : [
    { title: t("Pit Wall'a hoş geldin"),
      body: t("Soldaki panel yarışın datası, sağı canlı plan. Kısaca gezelim — her şeyi değiştirdiğin anda takım arkadaşların da görür.") },
    /* --- üst çubuk --- */
    { sel: "[data-tour='hteam']", title: t("Takım düğmesi"),
      body: t("Takvimi ve üyeleri yönetmek her an buradan — yarışın ortasında bile. Rozetler de burada atanır.") },
    { sel: "[data-tour='hchat']", title: t("Sohbet düğmesi"),
      body: t("Genel ve takım kanalları. Okunmamış mesaj varsa üzerinde kırmızı sayı belirir.") },
    { sel: "[data-tour='uchip']", title: t("Profilin ve rozetlerin"),
      body: t("Yanındaki simgeler yetkini gösterir: 👑 Takım Sahibi yönetir, 🎧 Yarış Mühendisi datayı değiştirir, direksiyon (Sürücü) yalnızca izler, 🛡 Admin her şeye erişir. Adına tıklayıp profili düzenlersin; ⏻ çıkış yapar.") },
    { sel: "[data-tour='data']", act: () => setSideOpen(true),
      title: t("Yarış · Data"),
      body: t("Yarış süresi, ortalama tur, tüketim ve A/B/C/D stint stratejileri. Tüm plan bu değerlerden hesaplanır; telemetriden tek tıkla doldurabilirsin.") },
    { sel: "[data-tour='wx']", act: () => setSideOpen(true),
      title: t("Hava Durumu"),
      body: t("Zemin değişince buradan işaretle — plan tur tur karma havayı hesaplar. İleri saatli planlı geçiş de ekleyebilirsin.") },
    { sel: "[data-tour='rstart']", act: () => setSideOpen(true),
      title: t("Yarış Başlangıcı"),
      body: t("Start tarih-saatini gir — geri sayım ve canlı stint takibi buna göre çalışır. Saat her üyeye kendi saat diliminde gösterilir.") },
    { sel: "[data-tour='pittimes']", act: () => setSideOpen(true),
      title: t("Pit · Süreler"),
      body: t("Pit lane geçişi ve tam depo dolum süresi. Dolum, alınan VE yüzdesine ölçeklenir; lastik süreleri LMU sabitleridir (1-2 lastik 5s, 3-4 lastik 12s).") },
    { sel: "[data-tour='ve']", act: () => setSideOpen(true),
      title: t("Virtual Energy"),
      body: t("LMU'da depo daima %100 VE'dir. Ratio, VE'nin kaç litreye denk geldiğini söyler — tüm yakıt hesapları bu orandan litreye çevrilir.") },
    { sel: "[data-tour='stream']", act: () => setSideOpen(true),
      title: t("Canlı Yayın"),
      body: t("YouTube linkini yapıştır — köşede yüzen mini oynatıcı açılır. Sekme değiştirsen de akmaya devam eder; köşesinden tutup boyutlandırabilirsin.") },
    { sel: "[data-tour='tabs']", title: t("Sekmeler"),
      body: t("Şimdi sekmeleri tek tek gezelim — rehber her birini senin için açacak.") },
    /* --- Dashboard --- */
    { sel: "[data-tour='dash-prog']", act: () => setTab("dash"),
      title: t("📊 Dashboard — Stint Programı"),
      body: t("Planın özeti: her stintin bitiş saati, kalan süre ve pilotu. Yarış başlayınca satırlar canlı ilerler.") },
    { sel: "[data-tour='dash-lsf']", act: () => setTab("dash"),
      title: t("Son Stint VE"),
      body: t("Yarış sonuna kalan süreye göre son dolumda alınması gereken VE yüzdesi — extra lap ve bayrak payı dahil. Pit'te mühendisin baktığı tek sayı budur.") },
    /* --- Stint --- */
    { sel: "[data-tour='s1']", act: () => setTab("stint"),
      title: t("📋 Stint — Önce start lastiği"),
      body: t("S1 lastiklerini buradan seç — pit'lerdeki lastik seçimleri buna zincirlenir. Tekli, ikili ve dörtlü hızlı seçenekler hazır.") },
    { sel: "[data-tour='stinttable']", act: () => setTab("stint"),
      title: t("Stint Tablosu"),
      body: t("Her satır bir stint: tur, VE ihtiyacı, pit ayarı, pilot. Ort. Tur sütununa değer yazarsan o stint o tempoyla hesaplanır (hava çarpanı uygulanmaz); Override süreyi kilitler.") },
    /* --- Son Stint Yakıtı --- */
    { sel: "[data-tour='fuelcalc']", act: () => setTab("fuel"),
      title: t("⚡ Son Stint Hesaplayıcı"),
      body: t("Yarış sonu geri sayımını gir (canlıda otomatik) — kalan tur ve gereken VE hesaplanır. Ondalık tur yukarı yuvarlanır, trafik payı için.") },
    /* --- Lastik --- */
    { sel: "[data-tour='setuptab']", act: () => setTab("setup"),
      title: t("🔧 Setup Havuzu"),
      body: t("Takımın setup arşivi: dosyayı pist, koşul, seans ve araç bilgisiyle yükle — herkes süzüp indirebilir. Aktif yarışın pisti vurgulanır.") },
    { sel: "[data-tour='tyrecard']", act: () => setTab("tyre"),
      title: t("Lastik Stratejisi"),
      body: t("Limit sayacı, stint bazlı köşe tablosu ve hızlı atama. Wet lastikler limitten düşmez; siyah kutu eski kuru lastiği geri takar.") },
    /* --- Pilotlar --- */
    { sel: "[data-tour='roster']", act: () => setTab("drivers"),
      title: t("Pilot Kadrosu"),
      body: t("Kadroyu elle yaz ya da takım üyelerinden tek tıkla ekle. Stintlere atadıkça toplam sürüş süresi ve yüzde dağılımı hesaplanır.") },
    /* --- Telemetri --- */
    { sel: "[data-tour='teleimport']", act: () => setTab("tele"),
      title: t("📈 Telemetri"),
      body: t("MoTeC dosyanı bırak — tur raporu da ham kanal log'u da okunur. %105 kuralı yavaş turları otomatik eler, medyan tur tek tıkla DATA'ya yazılır.") },
    { sel: "[data-tour='pitboard']", title: t("Pit Board"),
      body: t("Yarış canlıyken tam ekran pit board: geri sayım, sıradaki pit ve PIT YAPILDI butonu. Gerçek pitler plana işlenir, sapma görünür.") },
    { sel: "[data-tour='pdf']", title: t("PDF çıktısı"),
      body: t("Stint programını takıma dağıtmak için tek tık — başlık sezon ve yarış adından otomatik gelir. Bu kadar! İyi yarışlar. 🏁") },
  ];

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
  const doSignIn = async (mode = "in") => {
    setAuthErr(""); setAuthMode(mode);
    try { await signInGoogle(); }
    catch (e) {
      setAuthErr(e?.message === "POPUP_BLOCKED"
        ? t("Tarayıcı açılır pencereyi engelledi. Bu site için açılır pencerelere izin verip tekrar deneyin.")
        : (e?.message || String(e)));
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
  const verNew = seenVer !== APP_VERSION;
  const infoBtn = (
    <button className="infobtn" data-tour="info" onClick={openVersions}
      title={t("Neler değişti")} aria-label={t("Neler değişti")}>
      i{verNew && <span className="nd" />}
    </button>
  );
  const versionModal = verOpen && (
    <div className="wxmodal" onClick={() => setVerOpen(false)}>
      <div className="wxmbox" style={{ width: "min(560px,94vw)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="wxmhead">
          <span>ℹ {t("Neler değişti")}</span>
          <button className="lbclose" onClick={() => setVerOpen(false)}>✕</button>
        </div>
        <div className="wxmlist" style={{ padding: 0, maxHeight: "62vh" }}>
          {CHANGELOG.map((c) => (
            <div className="clgv" key={c.v}>
              <h4>{c.v}{c.v === APP_VERSION &&
                <span className="cur">{t("ŞU AN")}</span>}</h4>
              <div className="cdate">{c.date}</div>
              <ul>{(lang === "en" ? c.en : c.tr).map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          ))}
        </div>
        <div className="wxmfoot" style={{ justifyContent: "space-between" }}>
          <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <a className="hint" href={`${REPO_URL}/commits/main`}
              target="_blank" rel="noreferrer"
              style={{ color: "var(--muted)" }}>{t("GitHub'da tüm değişiklikler ↗")}</a>
            <button className="hint" style={{ background: "none", border: 0,
              color: "var(--teal)", cursor: "pointer", padding: 0,
              textDecoration: "underline" }}
              onClick={() => { setVerOpen(false); setTour(curRace ? "main" : "lobby"); }}>
              🎓 {t("Rehberi başlat")}</button>
          </span>
          <button className="histbtn" onClick={() => setVerOpen(false)}>{t("Kapat")}</button>
        </div>
      </div>
    </div>
  );

  const [wxHist, setWxHist] = useState(false); // hava geçmişi penceresi
  const [wxPlanW, setWxPlanW] = useState("wet"); // planlı geçiş: hava
  const [wxPlanT, setWxPlanT] = useState("");    // planlı geçiş: yarış saati
  const [zoom, setZoom] = useState(null); // "car" | "track" | null — kart büyütme (lightbox)
  /* LMU referans verisi (Ohne Speed tablosundan gömülü JSON) */
  const [lmuData, setLmuData] = useState(null);
  useEffect(() => {
    fetch(`${ASSET}lmu-data.json`).then((r) => (r.ok ? r.json() : null))
      .then((j) => setLmuData(j)).catch(() => {});
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

  const timeline = buildTimeline(plan);

  /* yarış ekleme / düzenleme penceresi */
  const raceForm = rForm && (
    <div className="wxmodal" onClick={() => setRForm(null)}>
      <div className="wxmbox" style={{ width: "min(560px,95vw)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="wxmhead">
          <span>🏁 {rForm.rid ? t("Yarışı Düzenle") : t("Yarış Ekle")}</span>
          <button className="lbclose" onClick={() => setRForm(null)}>✕</button>
        </div>
        <div style={{ padding: "12px 16px", maxHeight: "62vh", overflow: "auto" }}>
          <div className="row2">
            <div><label>{t("Sezon")}</label>
              <select value={rForm.seasonId || ""}
                onChange={(e) => setRForm({ ...rForm, seasonId: e.target.value || null })}>
                <option value="">{t("Takvim dışı (tekli yarış)")}</option>
                {Object.entries(seasons).map(([sid, se]) => (
                  <option key={sid} value={sid}>{se.name}</option>
                ))}
              </select></div>
            <div><label>{t("Round")}</label>
              <input type="number" value={rForm.round || ""}
                onChange={(e) => setRForm({ ...rForm, round: e.target.value })} /></div>
          </div>
          <label>{t("Yarış adı")}</label>
          <input type="text" value={rForm.name || ""} style={{ textTransform: "none" }}
            placeholder={t("örn. 6 Hours of Spa")}
            onChange={(e) => setRForm({ ...rForm, name: e.target.value })} />
          <div className="row2">
            <div><label>{t("Pist")}</label>
              <select value={rForm.trackId || ""}
                onChange={(e) => setRForm({ ...rForm, trackId: e.target.value })}>
                <option value="">—</option>
                {TRACKS.map((tr) => (
                  <option key={tr.id} value={tr.id}>{tr.name}</option>
                ))}
              </select></div>
            <div><label>{t("Yarış Süresi")}</label>
              <input type="text" value={rForm.raceTime || ""} placeholder="6:00:00"
                onChange={(e) => setRForm({ ...rForm, raceTime: e.target.value })} /></div>
          </div>
          <div className="row2">
            <div><label>{t("Sınıf")}</label>
              <select value={rForm.carClass || ""}
                onChange={(e) => setRForm({ ...rForm, carClass: e.target.value, carId: "" })}>
                {CAR_CLASSES.map(([id, nm]) => (
                  <option key={id} value={id}>{nm}</option>
                ))}
              </select></div>
            <div><label>{t("Araç")}</label>
              <select value={rForm.carId || ""}
                onChange={(e) => setRForm({ ...rForm, carId: e.target.value })}>
                <option value="">—</option>
                {(CARS[rForm.carClass] || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select></div>
          </div>
          <label>{t("Başlangıç (yerel saat)")}</label>
          <input type="datetime-local" value={msToLocalInput(rForm.startsAt || Date.now())}
            onChange={(e) => {
              const v = new Date(e.target.value).getTime();
              if (!isNaN(v)) setRForm({ ...rForm, startsAt: v });
            }} />
        </div>
        <div className="wxmfoot" style={{ gap: 8 }}>
          <button className="histbtn" onClick={() => setRForm(null)}>{t("Vazgeç")}</button>
          <button className="gbtn ubtn" onClick={async () => {
            const payload = {
              seasonId: rForm.seasonId || null,
              round: rForm.round ? Number(rForm.round) : null,
              name: rForm.name || "", trackId: rForm.trackId || "",
              carClass: rForm.carClass || "", carId: rForm.carId || "",
              raceTime: rForm.raceTime || "", startsAt: rForm.startsAt || 0,
            };
            if (rForm.rid) {
              await updateRace(curTeam, rForm.rid, payload).catch(() => {});
            } else {
              /* yarış verisi önceden hazırlanır: pist/araç/süre/başlangıç dolu gelir */
              const init = migrate({
                ...DEFAULT_STATE,
                track: payload.trackId, carClass: payload.carClass, car: payload.carId,
                raceTime: payload.raceTime || DEFAULT_STATE.raceTime,
                raceStartMs: payload.startsAt || Date.now(),
                pitLaneTime: PIT_LANE_TIMES[payload.trackId] ?? DEFAULT_STATE.pitLaneTime,
              });
              await createRace(curTeam, payload, init, user?.uid).catch(() => {});
            }
            setRForm(null);
          }}>{t("Kaydet")}</button>
        </div>
      </div>
    </div>
  );

  /* takım penceresi — hem lobide hem ana arayüzde kullanılır */
  const teamModal = teamOpen && user && (
        <div className="wxmodal" onClick={() => setTeamOpen(false)}>
          <div className="wxmbox" style={{ width: "min(680px,95vw)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="wxmhead">
              <span>🏢 {t("Takımlar")}</span>
              <button className="lbclose" onClick={() => setTeamOpen(false)}>✕</button>
            </div>

            {/* takım seçici */}
            {Object.keys(myTeams).length > 0 && (
              <div className="tmtabs">
                {Object.entries(myTeams).map(([tid, nm]) => (
                  <button key={tid} className={curTeam === tid ? "on" : ""}
                    onClick={() => setCurTeam(tid)}>{nm}</button>
                ))}
              </div>
            )}

            <div className="wxmlist" style={{ padding: "10px 14px" }}>
              {!curTeam && (
                <div className="hint" style={{ marginBottom: 12 }}>
                  {t("Henüz bir takımın yok. Yeni takım kur ya da katılım kodu ile katıl.")}
                </div>
              )}

              {curTeam && teamData && (<>
                {/* takım adı */}
                <div className="tmsec">{t("Takım Adı")}</div>
                {tnEdit === null ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8,
                    marginBottom: 10 }}>
                    <b style={{ fontSize: 15 }}>{teamData?.meta?.name || "—"}</b>
                    {canManageTeam && (
                      <button className="minibtn" style={{ width: "auto", padding: "0 8px" }}
                        onClick={() => setTnEdit(teamData?.meta?.name || "")}>
                        {t("Düzenle")}</button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, marginBottom: 10, maxWidth: 420 }}>
                    <input type="text" value={tnEdit} maxLength={40} autoFocus
                      style={{ textTransform: "none", margin: 0 }}
                      onChange={(e) => setTnEdit(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Escape") setTnEdit(null); }} />
                    <button className="gbtn ubtn" disabled={!tnEdit.trim()}
                      style={{ opacity: tnEdit.trim() ? 1 : .45 }}
                      onClick={async () => {
                        const nm = tnEdit.trim();
                        setTnEdit(null);
                        try {
                          await renameTeam(curTeam, nm);
                          await syncMyTeamName(user.uid, curTeam, nm);
                        } catch (e) { console.warn("ad değiştirilemedi:", e?.message); }
                      }}>{t("Kaydet")}</button>
                    <button className="histbtn"
                      onClick={() => setTnEdit(null)}>{t("Vazgeç")}</button>
                  </div>
                )}
                {tnEdit !== null && (
                  <div className="hint" style={{ marginTop: -6, marginBottom: 10 }}>
                    {t("Yeni ad diğer üyelerde uygulamayı açtıklarında güncellenir.")}</div>
                )}

                {/* sezonlar */}
                <div className="tmsec">{t("Sezonlar")}</div>
                <div className="tmtabs" style={{ padding: "0 0 8px" }}>
                  <button className={curSeason === "" ? "on" : ""}
                    onClick={() => setCurSeason("")}>{t("Tümü")}</button>
                  {Object.entries(seasons).map(([sid, se]) => (
                    <button key={sid} className={curSeason === sid ? "on" : ""}
                      onClick={() => setCurSeason(sid)}>{se.name}</button>
                  ))}
                  {canEditTeam && (
                    <button onClick={async () => {
                      const nm = window.prompt(t("Sezon adı"), `${new Date().getFullYear()} WEC`);
                      if (nm) await createSeason(curTeam, nm, new Date().getFullYear())
                        .catch(() => {});
                    }}>+ {t("Sezon")}</button>
                  )}
                </div>

                {/* yarış takvimi */}
                <div className="tmsec">{t("Yarış Takvimi")}</div>
                {Object.entries(races)
                  .filter(([, r]) => !curSeason || r.seasonId === curSeason)
                  .sort(([, a], [, b]) => (a.startsAt || 0) - (b.startsAt || 0))
                  .map(([rid, r]) => (
                    <div key={rid} className="tmroom">
                      {r.round ? <span className="rcode mono">R{r.round}</span> : null}
                      <span className="rlabel">
                        <b>{r.name || trackName(r.trackId) || "—"}</b>
                        <span className="rmeta">
                          {r.trackId ? trackName(r.trackId) : ""}
                          {r.raceTime ? ` · ${r.raceTime}` : ""}
                          {r.startsAt ? ` · ${new Date(r.startsAt)
                            .toLocaleString(lang === "en" ? "en-GB" : "tr-TR",
                              { day: "2-digit", month: "2-digit", hour: "2-digit",
                                minute: "2-digit" })}` : ""}
                        </span>
                      </span>
                      <button className="gbtn ubtn" onClick={() => openRace(rid)}>
                        {t("Aç")}</button>
                      {canEditTeam && (<>
                        <button className="minibtn" title={t("Düzenle")}
                          onClick={() => setRForm({ rid, ...r })}>✎</button>
                        <button className="minibtn" title={t("Sil")}
                          onClick={() => { if (window.confirm(t("Yarış silinsin mi?")))
                            deleteRace(curTeam, rid).catch(() => {}); }}>✕</button>
                      </>)}
                    </div>
                  ))}
                {Object.keys(races).length === 0 && (
                  <div className="hint">{t("Takvimde yarış yok.")}</div>
                )}
                {canEditTeam && (
                  <button className="gbtn ubtn" style={{ width: "100%", marginTop: 8 }}
                    onClick={() => setRForm({
                      rid: null, seasonId: curSeason || null, round: "", name: "",
                      trackId: st.track || "", carClass: st.carClass || "hypercar",
                      carId: st.car || "", raceTime: st.raceTime || "6:00:00",
                      startsAt: Date.now(),
                    })}>
                    ➕ {t("Yarış Ekle")}
                  </button>
                )}

                {/* üyeler */}
                <div className="tmsec" style={{ marginTop: 16 }}>{t("Takım Üyeleri")}</div>
                {canManageTeam && (
                  <div className="hint" style={{ marginBottom: 6, lineHeight: 1.6 }}>
                    {t("Rozet yetkiyi belirler:")}<br />
                    🎧 {t("Yarış Mühendisi")} — {t("yarış datasını değiştirebilir, üyelere dokunamaz")}<br />
                    <span style={{ verticalAlign: -2 }}><Wheel size={12} /></span> {t("Sürücü")}
                    {" "}— {t("her şeyi görür, hiçbir şeyi değiştiremez")}<br />
                    👑 {t("Takım Sahibi")} — {t("rozetleri ve yetkileri yönetir")}
                  </div>
                )}
                {Object.entries(teamData.members || {}).map(([uid, role]) => {
                  const mbs = teamBadgesOf(teamData, uid, null);
                  return (
                    <div key={uid} className="tmmem">
                      <span className="mbadges">
                        {mbs.length ? mbs.map((b) => (
                          <span key={b.lbl} className="ubadge" title={t(b.lbl)}
                            style={{ color: b.col, background: b.bg, borderColor: b.col }}>
                            {b.ico}</span>
                        )) : <span className="ubadge" style={{ opacity: .25 }}>·</span>}
                      </span>
                      <span className="mrole" title={t("Yetki")}>{t(roleLabel(role))}</span>
                      <span className="muid">
                        {teamData?.names?.[uid]
                          ? <>{teamData.names[uid]}
                            {uid === user.uid && <> {t("(sen)")}</>}</>
                          : <span className="mono">
                            {uid === user.uid ? t("(sen)") : uid.slice(0, 10) + "…"}</span>}
                      </span>
                      {canManageTeam && (
                        <span style={{ marginLeft: "auto", display: "flex", gap: 5,
                          alignItems: "center" }}>
                          {["driver", "engineer"].map((id) => {
                            const on = hasBadge(teamData, uid, id);
                            const b = BADGES[id];
                            return (
                              <button key={id} className={`btgl ${on ? "on" : ""}`}
                                title={`${t(b.lbl)} — ${t(id === "engineer"
                                  ? "datayı değiştirebilir" : "sadece görür")}`}
                                style={on ? { color: b.col, borderColor: b.col,
                                  background: b.bg } : undefined}
                                onClick={() => setBadge(uid, id, !on)}>
                                {b.ico}
                              </button>
                            );
                          })}
                        </span>
                      )}
                    </div>
                  );
                })}
                <div className="hint" style={{ marginTop: 8 }}>
                  {t("Katılım kodu")}: <b className="mono">{teamData?.meta?.joinCode || "—"}</b>
                  {" · "}{t("PIN'leri yalnız düzenleyiciler görür.")}
                </div>
                {myRole !== "owner" && (
                  <div style={{ marginTop: 10 }}>
                    <button className="histbtn" onClick={() => {
                      leaveTeam(curTeam, user.uid).catch(() => {}); setCurTeam("");
                    }}>{t("Takımdan ayrıl")}</button>
                  </div>
                )}
              </>)}
            </div>

            {/* kur / katıl */}
            <div className="tmfoot">
              <input placeholder={t("Yeni takım adı")} value={tForm.name}
                onChange={(e) => setTForm({ ...tForm, name: e.target.value })}
                style={{ textTransform: "none" }} />
              <button className="histbtn" disabled={!tForm.name.trim()}
                onClick={async () => {
                  setTErr("");
                  try {
                    const tid = await createTeam(user, tForm.name.trim(), userName);
                    setCurTeam(tid); setTForm({ ...tForm, name: "" });
                  } catch (e) { setTErr(t("Takım kurulamadı")); }
                }}>{t("Takım Kur")}</button>
              <input placeholder={t("KATILIM KODU")} maxLength={6} value={tForm.join}
                onChange={(e) => setTForm({ ...tForm, join: e.target.value.toUpperCase() })}
                style={{ width: 130 }} />
              <button className="histbtn" disabled={tForm.join.trim().length < 4}
                onClick={async () => {
                  setTErr("");
                  try {
                    const tid = await joinTeam(user, tForm.join, userName);
                    setCurTeam(tid); setTForm({ ...tForm, join: "" });
                  } catch (e) {
                    setTErr(e.message === "NOT_FOUND" ? t("Takım bulunamadı") : t("Katılınamadı"));
                  }
                }}>{t("Katıl")}</button>
            </div>
            {tErr && <div className="hint" style={{ color: "var(--red)", padding: "0 14px 10px" }}>
              {tErr}</div>}
          </div>
        </div>
      );

  /* ---------- ortak data kartları (setup + ana arayüz sol kolon) ---------- */
  const dataCards = (<>
    <div className="card" data-tour="data">
      <h2>{t("Yarış · Data")}</h2>
      <div className="row2">
        <div><label>Race Time (h:mm:ss)</label>
          <input type="text" value={st.raceTime} onChange={(e) => up({ raceTime: e.target.value })} /></div>
        <div><label>Avg Lap (m:ss.00)</label>
          <input type="text" value={st.avgLap} onChange={(e) => up({ avgLap: e.target.value })} /></div>
      </div>
      <div className="row4">
        {["A", "B", "C", "D"].map((k) => (
          <Num key={k} v={st.strategies[k]} step={1}
            onC={(v) => up({ strategies: { ...st.strategies, [k]: v } })} />
        ))}
      </div>
      <label>{t("Seçili Strateji")}</label>
      <div className="strat">
        {["A", "B", "C", "D"].map((k) => (
          <button key={k} className={st.chosen === k ? "on" : ""}
            onClick={() => up({ chosen: k })}>{k} · {st.strategies[k]}</button>
        ))}
      </div>
      <div className="row2">
        <div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={st.multiclass} style={{ width: "auto", margin: 0 }}
              onChange={(e) => up({ multiclass: e.target.checked })} />
            {t("Multiclass Yarış")}
          </label>
          <select value={st.leaderClass} disabled={!st.multiclass}
            style={!st.multiclass ? { opacity: .45 } : undefined}
            onChange={(e) => up({ leaderClass: e.target.value })}>
            {CAR_CLASSES.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
        <div><label>Extra Lap</label>
          <Num v={st.extraLap} step={1} onC={(v) => up({ extraLap: v })} /></div>
      </div>
      {st.multiclass && (
        <div className="row2">
          <div><label>🏁 {t("Lider Tur (m:ss.00)")}</label>
            <input type="text" value={st.leaderLap} placeholder={st.avgLap}
              onChange={(e) => up({ leaderLap: e.target.value })} /></div>
          <div />
        </div>
      )}
      {st.multiclass && racePlan.flagExtra > 0.5 && (
        <div className="hint">🏁 {t("Lider bayrağı")}: +{racePlan.flagExtra.toFixed(0)}s → {t("son tur otomatik eklenir")}</div>
      )}
    </div>

    <div className="card" data-tour="rstart" style={{ marginTop: 12 }}>
      <h2>{t("Yarış Başlangıcı")}</h2>
      <label>{t("Start Tarih & Saat")}</label>
      <input type="datetime-local" value={msToLocalInput(st.raceStartMs)}
        onChange={(e) => { const t = new Date(e.target.value).getTime();
          if (!isNaN(t)) up({ raceStartMs: t }); }} />
      <div style={{ marginTop: 10, background: "var(--panel2)",
        border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span className="hint" style={{ margin: 0 }}>🏁 {t("Hesaplanan Bitiş")}</span>
        <b className="mono" style={{ fontSize: 15, color: "var(--green)" }}>
          {driverPlan ? fmtClock(driverPlan.finishMs, driverPlan.startMs) : "—"}</b>
      </div>
      <div className="hint">{t("Canlı yarış modu, pilot planı ve geri sayım bu zamana göre çalışır.")} 🌍 {t("Saat her üyeye kendi yerel diliminde gösterilir.")}</div>
    </div>

    <div className="card" data-tour="wx" style={{ marginTop: 12 }}>
      <h2>🌦 {t("Hava Durumu")}</h2>
      <div className="hint" style={{ marginTop: 0, marginBottom: 6 }}>
        {t("Şu anki zemin — canlı değişim buradan")}</div>
      <div className="wxsel">
        {Object.entries(WEATHER).map(([id, w]) => (
          <button key={id} className={st.weather === id ? "on" : ""}
            style={st.weather === id ? { borderColor: w.col, color: w.col } : undefined}
            onClick={() => {
              const el = liveInfo.status === "live"
                ? Math.max(0, Math.round(liveInfo.elapsed / 1000)) : 0;
              let past = (st.weatherLog || []).filter((e) => e.t < el - 0.5);
              const future = (st.weatherLog || []).filter((e) => e.t > el + 0.5);
              if (el < 1) past = [];
              const log = [...past, { t: el, w: id, src: "live" }, ...future]
                .sort((a, b) => a.t - b.t);
              const cur = wxAtRel(log, el);
              up({ weather: Object.keys(WEATHER).find((k) => WEATHER[k] === cur) || id,
                weatherLog: log });
            }}>
            {w.ico} {t(w.lbl)}<br /><small>×{w.lap.toFixed(2)}</small>
          </button>
        ))}
      </div>
      {WX(st).lap > 1 && (
        <div className="hint">
          {t("Efektif tur")} ({t("şu an")}): <b className="mono">{st.avgLap}</b> ×{WX(st).lap.toFixed(2)} ={" "}
          <b className="mono" style={{ color: WX(st).col }}>{fmtLap(effLapSec(st))}</b>
          {WX(st).fuel < 1 && <> · ⚡ {t("yakıt")} −{((1 - WX(st).fuel) * 100).toFixed(0)}%</>}
        </div>
      )}
      <div className="hint" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <button className="histbtn" onClick={() => setWxHist(true)}>
          🕒 {t("Geçmiş / Planlı geçişler")}
          {(st.weatherLog || []).length > 0 ? ` (${st.weatherLog.length})` : ""}</button>
      </div>
    </div>

    <div className="card" data-tour="pittimes" style={{ marginTop: 12 }}>
      <h2>{t("Pit · Süreler (s)")}</h2>
      <div className="row2">
        <div><label>Pit Line</label><Num v={st.pitLaneTime} onC={(v) => up({ pitLaneTime: v })} />
          {st.track && PIT_LANE_TIMES[st.track] != null && (
            <div className="hint">{t("Pist verisi")}: {PIT_LANE_TIMES[st.track]}s · {trackName(st.track)}</div>
          )}</div>
        <div><label style={{ display: "flex", alignItems: "center", gap: 5 }}>
          ⛽ Fuel &amp; <Bolt size={13} /> VE</label>
          <Num v={st.fuelTime} onC={(v) => up({ fuelTime: v })} /></div>
      </div>
      <div className="row2">
        <div><label style={{ display: "flex", alignItems: "center", gap: 5 }}><Tyre size={15} /> {t("Lastik Limiti (adet)")}</label>
          <Num v={st.tyreLimit} step={1} onC={(v) => up({ tyreLimit: v })} /></div>
        <div />
      </div>
    </div>

    <div className="card" data-tour="ve" style={{ marginTop: 12 }}>
      <h2>⚡ Virtual Energy · Data</h2>
      <div className="row2">
        <div><label>⚡ {t("VE Tüketim (%/tur)")}</label><Num v={st.consumption} onC={(v) => up({ consumption: v })} /></div>
        <div><label>Fuel Ratio (L / %1)</label><Num v={st.fuelRatio} onC={(v) => up({ fuelRatio: v })} /></div>
      </div>
      <div className="row2">
        <div><label>⛽ {t("%100 = Taşınan Yakıt")}</label>
          <div className="mono" style={{ padding: "6px 0", color: "var(--green)" }}>
            {fuelCarried.toFixed(1)} L</div></div>
      </div>
      <div className="hint">
        {t("Depo daima")} <b>%100 VE</b> {t("kabul edilir. Gerçek yakıt = VE × ratio → gerçek tüketim ≈")}{" "}
        <b className="mono">{realPerLap.toFixed(2)} {t("L/tur")}</b>.{" "}
        {t("Ratio'yu düşürmek daha az yakıt taşımak demektir (örn. 0.84 → %100 = 84.0 L).")}
      </div>
    </div>

    <div className="card" data-tour="stream" style={{ marginTop: 12 }}>
      <h2>📺 {t("Canlı Yayın")}</h2>
      <label>{t("YouTube linki")}</label>
      <input type="text" value={st.streamUrl} placeholder="https://youtube.com/watch?v=..."
        onChange={(e) => up({ streamUrl: e.target.value })} />
      <div className="hint">
        {ytId(st.streamUrl)
          ? <>✅ {t("Yayın köşedeki mini oynatıcıda gösteriliyor.")}</>
          : t("Geçerli bir YouTube linki yapıştırın; köşede mini oynatıcı açılır.")}
      </div>
    </div>
  </>);

  /* ---------- giriş kapısı: oturum yoksa uygulama açılmaz ---------- */
  if (authReady && (authLoading || !user)) {
    return (
      <div className="rc">
        <style>{css}</style>
        {teamModal}{raceForm}
        <div className="lobby">
          <div className="box" style={{ textAlign: "center" }}>
            <img className="logo" src={`${ASSET}logo.png`} alt="Caspian Motorsport" />
            <h1><b>RACE</b> MONITOR</h1>
            <div className="sub">{APP_VERSION}</div>
            {authLoading ? (
              <div className="hint" style={{ marginTop: 22 }}>{t("Yükleniyor…")}</div>
            ) : (<>
              <div className="hint" style={{ margin: "18px 0 14px" }}>
                {t("Devam etmek için giriş yapın veya kayıt olun.")}</div>
              <button className="gbtn" onClick={() => doSignIn("in")}>
                <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.1z"/>
                  <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.7C7.9 41 15.4 46 24 46z"/>
                  <path fill="#FBBC05" d="M11.6 28.1c-.4-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.7H4.3C2.8 17.1 2 20.4 2 24s.8 6.9 2.3 9.8l7.3-5.7z"/>
                  <path fill="#EA4335" d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.2 30 2 24 2 15.4 2 7.9 7 4.3 14.2l7.3 5.7c1.7-5.2 6.6-9.1 12.4-9.1z"/>
                </svg>
                {t("Google ile giriş yap")}
              </button>
              <div style={{ marginTop: 10 }}>
                <button className="histbtn" onClick={() => doSignIn("up")}>
                  {t("Google ile kayıt ol")}</button>
              </div>
              {authErr && <div className="hint" style={{ color: "var(--red)", marginTop: 10 }}>
                {authErr}</div>}
              <div className="hint" style={{ marginTop: 18, fontSize: 11 }}>
                {t("Caspian Motorsport · pit wall aracı")}</div>
            </>)}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- erişim kapısı: giriş var ama izin yok ---------- */
  if (authReady && user && !access) {
    return (
      <div className="rc">
        <style>{css}</style>
        {teamModal}{raceForm}
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

  /* ---------- lobi: takım takvimi ---------- */
  if (!curRace && !entered) {
    const now = Date.now();
    const list = Object.entries(races)
      .sort(([, a], [, b]) => (a.startsAt || 0) - (b.startsAt || 0));
    const allUp = list.filter(([, r]) => (r.startsAt || 0) >= now - 6 * 3600e3);
    const allPast = list.filter(([, r]) => (r.startsAt || 0) < now - 6 * 3600e3).reverse();
    /* Şampiyonalar karışmasın: sezona göre grupla, istenirse süz. */
    const sidOf = ([, r]) => r.seasonId || "";
    const sName = (sid) => (sid ? (seasons[sid]?.name || t("Sezon")) : t("Takvim dışı"));
    const seasonIds = Array.from(new Set(list.map(sidOf)));      // takvim sırasına göre
    const inFilter = (e) => lobSeason === "all" || sidOf(e) === lobSeason;
    const upcoming = allUp.filter(inFilter);
    const past = allPast.filter(inFilter);
    const nextRid = allUp.length ? allUp[0][0] : null;
    const upGroups = Array.from(new Set(upcoming.map(sidOf)))
      .map((sid) => ({ sid, name: sName(sid),
        items: upcoming.filter((e) => sidOf(e) === sid) }));
    const RaceRow = ([rid, r], isNext) => (
      <button key={rid} className={`lrace ${isNext ? "next" : ""}`}
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
    );

    return (
      <div className="rc">
        <style>{css}</style>
        {teamModal}{raceForm}{versionModal}{chatModal}{tourOverlay}{setupModal}
        <div className="lobby">
          <div className="box" style={{ maxWidth: 560 }}>
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
                <button className="bigbtn ghost" onClick={() => setTeamOpen(true)}>
                  🏢 {t("Takım Kur / Katıl")}
                </button>
              ) : (<>
                {Object.keys(myTeams).length > 1 && (
                  <div className="tmtabs" style={{ padding: "0 0 10px" }}>
                    {Object.entries(myTeams).map(([tid, nm]) => (
                      <button key={tid} className={curTeam === tid ? "on" : ""}
                        onClick={() => setCurTeam(tid)}>{nm}</button>
                    ))}
                  </div>
                )}

                <div className="lobbyteams" data-tour="races">
                  {/* hangi takımın takvimine baktığın belli olsun */}
                  <div className="lteam">🏢 {teamData?.meta?.name
                    || myTeams[curTeam] || t("Takım")}</div>
                  <div className="tmsec">🏁 {t("Yaklaşan Yarışlar")}</div>
                  {seasonIds.length > 1 && (
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                      {[["all", t("Tümü")], ...seasonIds.map((sid) => [sid, sName(sid)])]
                        .map(([v, l]) => (
                          <button key={v} className="act" style={{ fontSize: 11,
                            ...(lobSeason === v
                              ? { borderColor: "var(--red)", color: "var(--red)" } : {}) }}
                            onClick={() => setLobSeason(v)}>{l}</button>
                        ))}
                    </div>
                  )}
                  {upcoming.length === 0
                    ? <div className="hint">{t("Takvimde yaklaşan yarış yok.")}</div>
                    : upGroups.map((g) => (
                      <div key={g.sid || "none"}>
                        {seasonIds.length > 1 && (
                          <div className="lseason">{g.name}</div>
                        )}
                        {g.items.map((e) => RaceRow(e, e[0] === nextRid))}
                      </div>
                    ))}

                  {past.length > 0 && (<>
                    <div className="tmsec" style={{ marginTop: 12 }}>
                      {t("Geçmiş")}</div>
                    {past.slice(0, 5).map((e) => (
                      <div key={e[0]}>
                        {seasonIds.length > 1 && lobSeason === "all" && (
                          <div className="lseason">{sName(sidOf(e))}</div>
                        )}
                        {RaceRow(e, false)}
                      </div>
                    ))}
                  </>)}

                  <button className="histbtn" data-tour="manage"
                    style={{ marginTop: 10, width: "100%" }}
                    onClick={() => setTeamOpen(true)}>
                    ⚙ {canEditTeam ? t("Takvimi & Takımı Yönet") : t("Takımı Görüntüle")}</button>
          {setups.length > 0 && (
            <button className="histbtn" onClick={() => setSuOpen(true)}
              style={{ marginTop: 8, width: "100%" }}>
              🔧 {t("Setup Havuzu")} · {setups.length}</button>
          )}
          <button className="histbtn" data-tour="chat" onClick={() => setChatOpen(true)}
            style={{ marginTop: 8, width: "100%" }}>
            💬 {t("Sohbet")}{chatUnread > 0 && <> · {chatUnread}</>}</button>
                </div>
              </>)}

              <div className="lmsg">{syncMsg}</div>
            </>) : (
              <div className="hint" style={{ textAlign: "center", marginBottom: 8 }}>
                {t("Takım senkronizasyonu kapalı — ")}<b>src/firebase-config.js</b>{t(" dosyasını doldur.")}
              </div>
            )}

            <button className="solo" onClick={() => setEntered(true)}>
              {t("Takımsız solo devam et →")}
            </button>
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
        <style>{css}</style>
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
                    <img src={carImg(cls, c.id)} alt="" loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <button className="bigbtn" style={{ marginTop: 20 }}
              disabled={!st.track || !st.car}
              onClick={() => setPickDone(true)}>
              {t("✓ Devam Et — Yarış Dataları")}
            </button>
            <div className="lmsg">
              {(!st.track || !st.car) && t("Devam etmek için pist ve araç seç")}
            </div>
            <button className="solo" onClick={() => setPickDone(true)}>
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
        <style>{css}</style>
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
              onClick={() => setSetupDone(true)}>
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
    <div className="rc">
      <style>{css}</style>
      {teamModal}{raceForm}{versionModal}{chatModal}{tourOverlay}{streamPlayer}{setupModal}
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
                {user.photoURL && <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />}
                <span className="uname" style={{ maxWidth: 260 }}>{user.email}</span>
              </div>
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
              <button className="histbtn" onClick={() => setProfOpen(false)}>{t("Vazgeç")}</button>
              <button className="gbtn ubtn" disabled={!profName.trim()}
                style={{ opacity: profName.trim() ? 1 : .45 }}
                onClick={async () => {
                  const n = profName.trim().slice(0, 60);
                  await updateProfile(user.uid, { fullName: n }).catch(() => {});
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
                    {u?.photo
                      ? <img src={u.photo} alt="" referrerPolicy="no-referrer" />
                      : <span className="uav">?</span>}
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
                    <span className="wxnm" style={{ color: wx.col }}>{wx.ico} {t(wx.lbl)}</span>
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
          title={t("Rehberi başlat")}>🎓</button>
        {infoBtn}
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
              <img className="car" src={carImg(st.carClass, st.car)} alt=""
                onError={(e) => { e.currentTarget.style.display = "none"; }} />
              {carName(st.carClass, st.car)}</>}
          </span>
        )}
        {access && (
          <button className="adminbtn" data-tour="hteam"
            onClick={() => setTeamOpen(true)} title={t("Takımlarım")}>
            🏢 {teamData?.meta?.name || t("Takımlar")}
          </button>
        )}
        {chatBtn}
        {isAdmin && (
          <button className="adminbtn" onClick={() => setAdminOpen(true)}
            title={t("Kullanıcı yönetimi")}>
            👥 {t("Üyeler")}
            {Object.values(allUsers).filter((u) => u?.requested && u?.allowed !== true).length > 0 &&
              <b className="badge">{Object.values(allUsers)
                .filter((u) => u?.requested && u?.allowed !== true).length}</b>}
          </button>
        )}
        {user && (
          <span className="userchip" data-tour="uchip" title={user.email || ""}>
            {user.photoURL && <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />}
            {myBadges.map((b) => (
              <span key={b.lbl} className="ubadge" title={t(b.lbl)}
                style={{ color: b.col, background: b.bg, borderColor: b.col }}>
                {b.ico}</span>
            ))}
            <button className="unamebtn" title={t("Profili düzenle")}
              onClick={() => { setProfName(userName || user.displayName || ""); setProfOpen(true); }}>
              {userName || user.displayName || user.email}</button>
            <button onClick={signOut} title={t("Çıkış yap")}>⏻</button>
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
            <span className="syncinfo" style={{ marginLeft: 0 }}>
              🏢 {teamData.meta.name}</span>
          )}
          <button className="leave" onClick={leaveRace}>{t("Takvime Dön")}</button>
          <span className="syncinfo">
            {lastSync ? `${t("Son güncelleme: ")}${lastSync.by} · ${new Date(lastSync.at).toLocaleTimeString(lang === "en" ? "en-GB" : "tr-TR")}` : t("Senkronize")}
          </span>
        </>)}
        {syncMsg && <span style={{ color: "var(--yellow)" }}>{syncMsg}</span>}
        </>)}
      </div>

      {liveInfo.status === "live" && (() => {
        const pitTotal = liveInfo.phaseEnd - liveInfo.stintStartMs;
        const pitFrac = pitTotal > 0
          ? Math.min(1, Math.max(0, (pitTotal - liveInfo.nextPitIn) / pitTotal)) : 0;
        const raceFrac = liveInfo.raceMs > 0
          ? Math.min(1, Math.max(0, liveInfo.elapsed / liveInfo.raceMs)) : 0;
        return (
          <div className="hudstrip">
            <div className="hcell hhero">
              <span className="lbl">{t("Bayrağa Kalan")}</span>
              <span className="hclock">{fmtHMS(liveInfo.remaining / 1000)}</span>
              <div className="hbar"><i style={{ width: `${raceFrac * 100}%` }} /></div>
              <span className="lbl">%{Math.round(raceFrac * 100)} {t("tamam")}</span>
            </div>
            <div className="hcell">
              <span className="lbl">{t("Şu An")}</span>
              <span className="hstint">S{liveInfo.stintIdx + 1}
                <span style={{ color: "var(--muted)", fontSize: ".6em" }}>/{racePlan.fullStints}</span>
                {liveInfo.phase === "pit" &&
                  <span style={{ color: "var(--yellow)", fontSize: ".5em" }}> · PIT</span>}
              </span>
              {liveInfo.driver && <span className="hdrv">{liveInfo.driver}</span>}
            </div>
            <div className="hcell hgauge">
              <span className="lbl">{liveInfo.phase === "pit" ? t("Pit Çıkışı") : t("Sıradaki Pit")}</span>
              <Ring value={pitFrac} size={78} fs={16} glow
                color={pitSoon ? "var(--yellow)" : "var(--teal)"}
                big={fmtHMS(liveInfo.nextPitIn / 1000)} />
            </div>
            <div className="hcell hgauge">
              <span className="lbl">{t("Tamamlanan")}</span>
              <Ring value={raceFrac} size={78} fs={19} color="var(--car)"
                big={`%${Math.round(raceFrac * 100)}`} />
            </div>
            <button className="act hudpit" data-tour="pitboard"
              onClick={() => setPitboard(true)}>📟 Pit Board</button>
          </div>
        );
      })()}

      {(liveInfo.status === "pre" || liveInfo.status === "done") && (
        <div className="livestrip">
          {liveInfo.status === "pre" && (
            <div><span className="lbl">{t("Start'a")}</span>
              <span className="big mono" style={{ color: "var(--yellow)" }}>
                {fmtHMS(liveInfo.toStart / 1000)}</span></div>
          )}
          {liveInfo.status === "done" && (
            <div><span className="lbl">{t("Durum")}</span>
              <span className="big" style={{ color: "var(--green)" }}>{t("🏁 YARIŞ BİTTİ")}</span></div>
          )}
          <button className="act" style={{ marginLeft: "auto" }}
            data-tour="pitboard" onClick={() => setPitboard(true)}>📟 Pit Board</button>
        </div>
      )}

      {pitboard && (
        <div className="pitboard" onClick={() => setPitboard(false)}>
          <button className="close" onClick={() => setPitboard(false)}>✕</button>
          <img className="plogo" src={`${ASSET}logo.png`} alt="" />
          {liveInfo.status === "pre" && (<>
            <div className="plbl">{t("Start'a")}</div>
            <div className="huge" style={{ color: "var(--yellow)" }}>
              {fmtHMS(liveInfo.toStart / 1000)}</div>
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
                <div className="plbl">{liveInfo.phase === "pit" ? t("Pit Çıkışı") : t("Sıradaki Pit")}</div>
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
                {liveInfo.pitsDone < racePlan.rows.length - 1 ? (
                  <button onClick={markPit}
                    title={t("Araç PİT YOLUNA GİRDİĞİ an bas. Pit süresi plandan otomatik eklenir, sonraki stint pit çıkışıyla başlar.")}
                    style={{ padding: "16px 34px", borderRadius: 12, cursor: "pointer",
                      background: "var(--car)", color: "#FFE9ED", border: "2px solid var(--teal)",
                      fontFamily: "'Rajdhani'", fontSize: 26, fontWeight: 700,
                      letterSpacing: ".06em" }}>
                    {t("✔ PIT")} — S{liveInfo.stintIdx + 1}
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
                            background: "var(--panel2)", color: "var(--text)",
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

      <div className={`grid ${sideOpen ? "" : "noside"} ${role === "viewer" && curRace ? "viewonly" : ""}`}>
        <button className={`sidetoggle ${sideOpen ? "" : "closed"}`}
          onClick={() => setSideOpen(!sideOpen)}
          title={sideOpen ? t("Paneli gizle") : t("Paneli göster")}>
          {sideOpen ? "◀" : "▶"}</button>
        {/* ================= SOL: DATA ================= */}
        <div className="sidecol">
          <div className="sideinner">{dataCards}</div>
        </div>

        {/* ================= SAĞ: SEKMELER ================= */}
        <div>
          <div className="tabs" data-tour="tabs">
            {[["dash", "Dashboard", "\u{1F4CA}"], ["stint", "Stint", "\u{1F4CB}"],
              /* ["code80", "Code 80"], — şimdilik arayüzden gizli, kod korunuyor */
              ["fuel", t("Son Stint Yakıtı"), "\u26A1"],
              ["tyre", t("Lastik"), <Tyre size={12} />],
              ["drivers", t("Pilotlar"), <Wheel size={12} />],
              ["tele", t("Telemetri"), "\u{1F4C8}"],
              ["setup", t("Setup"), "\u{1F527}"],
              ...(raceChan ? [["rchat", t("Yarış Sohbeti"), "\u{1F4AC}"]] : [])]
              .map(([k, l, ico]) => (
              <button key={k} className={`${tab === k ? "on" : ""} ${k === "code80" && tab === k ? "c80t" : ""}`}
                onClick={() => setTab(k)} style={{ position: "relative" }}>
                <span style={{ marginRight: 6 }}>{ico}</span>{l}
                {k === "rchat" && raceUnread > 0 && tab !== "rchat" &&
                  <b className="cdot" style={{ position: "absolute", top: 2, right: 3 }}>
                    {raceUnread > 9 ? "9+" : raceUnread}</b>}
              </button>
            ))}
          </div>

          <Suspense fallback={<div className="hint" style={{ padding: 16 }}>{t("Yükleniyor…")}</div>}>
          {(tab === "stint" || tab === "code80") && (
            <StintTab tab={tab} mode={mode} t={t} st={st} plan={plan} totalVE={totalVE}
              totalFuelL={totalFuelL} timeline={timeline} liveInfo={liveInfo} pitSoon={pitSoon}
              tyreInfo={tyreInfo} quickTyre={quickTyre} bumpLaps={bumpLaps} clearLaps={clearLaps}
              upStintLap={upStintLap} upTyre={upTyre} upPit={upPit} assignDriver={assignDriver}
              upOvr={upOvr} />
          )}

          {tab === "dash" && (
            <DashTab t={t} st={st} zoom={zoom} setZoom={setZoom} exportPdf={exportPdf}
              liveInfo={liveInfo} racePlan={racePlan} tyreInfo={tyreInfo} planLsf={planLsf}
              driverPlan={driverPlan} carriedAt={carriedAt} pitSoon={pitSoon} lmuData={lmuData} />
          )}

          {tab === "setup" && (<>
            <div className="card" data-tour="setuptab">
              <h2>🔧 {t("Setup Yükle")}</h2>
              {setupForm()}
            </div>

            <div className="card" style={{ marginTop: 12 }}>
              <h2>📚 {t("Setup Havuzu")} ({suList.length}/{setups.length})</h2>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
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
                {st.track && setups.some((x) => x.track === st.track) && (
                  <button className="act" style={{ fontSize: 11 }}
                    onClick={() => setSuFTrack(st.track)}>
                    📍 {trackName(st.track)}</button>
                )}
              </div>
              {!suList.length && (
                <div className="hint">{t("Henüz setup yok — ilk dosyayı yukarıdan yükle.")}</div>
              )}
              {suList.length > 0 && setupTable(suList)}
            </div>
          </>)}

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
              clearAssign={clearAssign} />
          )}

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
              toggleLap={toggleLap} />
          )}

          {tab === "fuel" && (
            <FuelTab t={t} st={st} up={up} lsf={lsf} autoCd={autoCd}
              setAutoCd={setAutoCd} planLastCd={planLastCd} racePlan={racePlan} />
          )}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
