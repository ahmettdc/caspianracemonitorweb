/* ============================================================
   ODA DEPOSU — Firebase Realtime Database
   window.storage (Claude artifact API) yerine geçer.
   Odalar RTDB'de "rooms/KOD" yolunda tutulur.
   Bonus: 3sn polling yerine onValue ile anlık senkronizasyon.
   ============================================================ */
import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, set, update, remove, onValue,
  push, query, limitToLast, runTransaction, serverTimestamp } from "firebase/database";
import { firebaseConfig } from "./firebase-config";
import { LIVE_WRITER_STALE_MS } from "./liveWriter";

export const firebaseReady =
  !!firebaseConfig?.databaseURL && !firebaseConfig.databaseURL.includes("XXXX");

let db = null;
if (firebaseReady) {
  db = getDatabase(initializeApp(firebaseConfig));
}

const roomRef = (code) => ref(db, `rooms/${String(code).toUpperCase()}`);





/* cb(remotePayload) — oda her değiştiğinde anında tetiklenir.
   Dönen fonksiyon aboneliği iptal eder. */


/* ============================================================
   ERİŞİM KONTROLÜ — users/{uid}
   Kullanıcı giriş yapınca profili yazılır (kim başvurdu görünsün),
   erişim izni `allowed: true` alanıyla verilir (Firebase konsolundan).
   ============================================================ */
export async function touchUserProfile(user, extra = {}) {
  if (!db || !user) return;
  /* `allowed` alanına DOKUNULMAZ — yalnızca profil alanları güncellenir
     (güvenlik kuralı da istemcinin allowed yazmasını engeller) */
  await update(ref(db, `users/${user.uid}`), {
    email: user.email || "",
    name: user.displayName || "",
    photo: user.photoURL || "",
    lastSeen: Date.now(),
    ...extra,
  });
}

/* Kayıt talebi: kullanıcı "kayıt ol" akışını tamamlayınca işaretlenir */
export async function requestAccess(user, note = "", fullName = "") {
  if (!db || !user) return;
  await update(ref(db, `users/${user.uid}`), {
    email: user.email || "",
    name: user.displayName || "",
    fullName: String(fullName || user.displayName || "").slice(0, 60),
    photo: user.photoURL || "",
    requested: true,
    requestedAt: Date.now(),
    note: String(note || "").slice(0, 200),
    notified: false,          // onay maili gönderildi mi (Functions kuracak)
  });
}

/* Kullanıcının kendi kaydını izler (talep durumu + izin) */
export function watchUserDoc(uid, cb) {
  if (!db || !uid) { cb(null); return () => {}; }
  let settled = false;
  const timer = setTimeout(() => { if (!settled) cb({}); }, 8000);
  const off = onValue(
    ref(db, `users/${uid}`),
    (snap) => { settled = true; clearTimeout(timer); cb(snap.exists() ? snap.val() : {}); },
    (err) => { settled = true; clearTimeout(timer);
      console.warn("user doc read failed:", err?.message); cb({}); },
  );
  return () => { clearTimeout(timer); off(); };
}

/* cb(allowed:boolean) — izin değişince anında tetiklenir.
   Okuma reddedilirse/başarısız olursa "izin yok" kabul edilir (asılı kalmaz). */
export function watchAccess(uid, cb) {
  if (!db || !uid) { cb(false); return () => {}; }
  let settled = false;
  const done = (v) => { settled = true; cb(v); };
  const timer = setTimeout(() => { if (!settled) cb(false); }, 8000); // ağ takılırsa
  const off = onValue(
    ref(db, `users/${uid}/allowed`),
    (snap) => { clearTimeout(timer); done(snap.val() === true); },
    (err) => { clearTimeout(timer); console.warn("access read failed:", err?.message); done(false); },
  );
  return () => { clearTimeout(timer); off(); };
}

/* ---- ADMIN: kullanıcı listesi ve izin yönetimi ---- */
export function watchAllUsers(cb) {
  if (!db) { cb({}); return () => {}; }
  return onValue(ref(db, "users"),
    (snap) => cb(snap.exists() ? snap.val() : {}),
    (err) => { console.warn("users read failed:", err?.message); cb({}); });
}

export async function setUserAllowed(uid, allowed) {
  if (!db || !uid) return;
  await update(ref(db, `users/${uid}`), { allowed: !!allowed, allowedAt: Date.now() });
}

/* Kullanıcı kendi profilini günceller (ad soyad vb.) */
export async function updateProfile(uid, patch) {
  if (!db || !uid) return;
  await update(ref(db, `users/${uid}`), patch);
}

/* ============================================================
   TAKIMLAR — teams/{tid}
     meta    : { name, ownerUid, joinCode, createdAt }
     members : { uid: "owner" | "editor" | "viewer" }
     rooms   : { code: { label, createdAt, createdBy } }
     secrets : { code: { pin } }   ← yalnız owner/editor okuyabilir (kural)
   users/{uid}/teams/{tid} = takım adı  (kendi takımlarını listelemek için)
   teamCodes/{joinCode} = tid           (katılım kodundan takımı bulmak için)
   ============================================================ */
const rnd = (n, set = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789") =>
  Array.from({ length: n }, () => set[Math.floor(Math.random() * set.length)]).join("");

export async function createTeam(user, name, memberName = "") {
  if (!db || !user) throw new Error("no-db");
  const tid = rnd(8).toLowerCase();
  const joinCode = rnd(6);
  const nm = String(memberName || user.displayName || user.email || "").slice(0, 60);
  await update(ref(db), {
    [`teams/${tid}/meta`]: {
      name: String(name).slice(0, 40), ownerUid: user.uid, joinCode, createdAt: Date.now(),
    },
    [`teams/${tid}/names/${user.uid}`]: nm,
    [`teams/${tid}/members/${user.uid}`]: "owner",
    [`users/${user.uid}/teams/${tid}`]: String(name).slice(0, 40),
    [`teamCodes/${joinCode}`]: tid,
  });
  return tid;
}

export async function joinTeam(user, joinCode, memberName = "") {
  if (!db || !user) throw new Error("no-db");
  const code = String(joinCode).trim().toUpperCase();
  const snap = await get(ref(db, `teamCodes/${code}`));
  if (!snap.exists()) throw new Error("NOT_FOUND");
  const tid = snap.val();
  const nm = String(memberName || user.displayName || user.email || "").slice(0, 60);
  // NOT: takım adını buradan (teams/{tid}/meta) OKUMUYORUZ — meta .read kuralı
  // ZATEN ÜYE olmayı şart koşuyor; katılan henüz üye değil → okuma reddedilir ve
  // tüm katılım "Katılınamadı" ile çökerdi. Etiket geçici olarak tid yazılır;
  // üye olunca watchTeam meta'yı okur ve App effect'i (syncMyTeamName) gerçek adla
  // tazeler. members'ı 'viewer' yazma izni katılana kendi uid'i için zaten var.
  await update(ref(db), {
    [`teams/${tid}/names/${user.uid}`]: nm,
    [`teams/${tid}/members/${user.uid}`]: "viewer",
    [`users/${user.uid}/teams/${tid}`]: tid,
  });
  return tid;
}

export function watchMyTeams(uid, cb) {
  if (!db || !uid) { cb({}); return () => {}; }
  return onValue(ref(db, `users/${uid}/teams`),
    (s) => cb(s.exists() ? s.val() : {}), () => cb({}));
}

/* Takımı parça parça dinler: meta/members/badges/rooms ayrı düğümler.
   (RTDB'de üst düğümü okumak için o seviyede izin gerekir; secrets gizli
   kalsın diye teams/$tid seviyesinde .read yok — bu yüzden çocuklar ayrı.) */
export function watchTeam(tid, cb) {
  if (!db || !tid) { cb(null); return () => {}; }
  const acc = { meta: null, members: null, badges: null, rooms: null, names: null,
    photos: null, assets: null };
  const emit = () => cb({ ...acc });
  const sub = (key) => onValue(ref(db, `teams/${tid}/${key}`),
    (s) => { acc[key] = s.exists() ? s.val() : (key === "meta" ? null : {}); emit(); },
    () => { acc[key] = key === "meta" ? null : {}; emit(); });
  const offs = ["meta", "members", "badges", "rooms", "names", "photos", "assets"].map(sub);
  return () => offs.forEach((o) => o());
}

/* ---- takım görselleri (teams/{tid}/assets, v1.7.0) ----
   assets = { logo: dataURI, cars: { "{cls}_{carId}": { top, side } } }.
   watchTeam zaten "assets" çocuğunu dinler → teamData.assets reaktif gelir.
   path: "logo" | "cars/{key}/{angle}". Yazma kuralı owner/editor (rules). */
export async function saveTeamAsset(tid, path, dataUri) {
  if (!db || !tid || !path || typeof dataUri !== "string" || !dataUri) return;
  await set(ref(db, `teams/${tid}/assets/${path}`), dataUri);
}
export async function clearTeamAsset(tid, path) {
  if (!db || !tid || !path) return;
  await set(ref(db, `teams/${tid}/assets/${path}`), null);
}

/* ---- kullanıcı avatarı (userAvatars/{uid}, v1.7.0) ----
   users/{uid} ALTINA KONMAZ: watchUserDoc tüm düğümü abone eder (her girişte blob
   inerdi) ve watchAllUsers admin için tüm ağacı çeker. Ayrı üst düzey düğüm +
   modül-içi Map cache: aynı uid bir oturumda BİR kez iner; kendi kaydet/kaldır
   işlemi cache'i günceller → UI anında yenilenir. */
const _avatarCache = new Map();          // uid → dataURI | "" (yok)
const _avatarWaiters = new Map();        // uid → Promise (eşzamanlı istek birleştirme)
export async function getUserAvatar(uid) {
  if (!db || !uid) return "";
  if (_avatarCache.has(uid)) return _avatarCache.get(uid);
  if (_avatarWaiters.has(uid)) return _avatarWaiters.get(uid);
  const p = get(ref(db, `userAvatars/${uid}`))
    .then((s) => {
      const v = s.exists() && typeof s.val() === "string" ? s.val() : "";
      _avatarCache.set(uid, v);
      return v;
    })
    .catch(() => "")                      // hata → cache'e yazma, sonra yeniden dener
    .finally(() => _avatarWaiters.delete(uid));
  _avatarWaiters.set(uid, p);
  return p;
}
export async function saveUserAvatar(uid, dataUri) {
  if (!db || !uid || typeof dataUri !== "string" || !dataUri) return;
  await set(ref(db, `userAvatars/${uid}`), dataUri);
  _avatarCache.set(uid, dataUri);
}
export async function clearUserAvatar(uid) {
  if (!db || !uid) return;
  await set(ref(db, `userAvatars/${uid}`), null);
  _avatarCache.set(uid, "");
}

/* Takım adını değiştir — yalnız meta yazılır.
   Diğer üyelerin users/{uid}/teams kopyası kendi istemcilerinde tazelenir
   (kurallar başkasının kullanıcı düğümüne yazmayı engelliyor). */
export async function renameTeam(tid, name) {
  if (!db || !tid) return;
  await set(ref(db, `teams/${tid}/meta/name`), String(name || "").trim().slice(0, 40));
}

/* Üye kendi takım adı kopyasını günceller */
export async function syncMyTeamName(uid, tid, name) {
  if (!db || !uid || !tid || !name) return;
  await set(ref(db, `users/${uid}/teams/${tid}`), String(name).slice(0, 40));
}

/* PIN'ler ayrı düğümde — okuma yetkisi yoksa sessizce boş döner */






/* ---------- setup deposu ----------
   Dosya base64 olarak RTDB'ye gömülür (LMU setup dosyaları küçüktür).
   Ham dosya sınırı ~180KB → base64 ~240KB. */
/* Ortak (global) setup havuzu — tüm onaylı kullanıcılar okur/yükler.
   Kim yükledi bilgisi için team adı da meta içinde saklanır. */
/* Şema bölme (v1.4.93): meta `globalSetups/{id}`, dosya gövdesi (base64)
   `globalSetupData/{id}` = { uid, data }. Liste aboneliği artık blob taşımaz →
   havuz büyüse de ilk yükleme hafif kalır. ESKİ kayıtlar `data`yı meta içinde
   taşımaya devam eder (legacy) — okuyucular önce su.data'ya bakar, yoksa
   getSetupBlob(id) çağırır. Zorunlu migrasyon YOK. */
export async function addSetup(user, meta, b64) {
  if (!db || !user || !b64) return;
  /* id önce üretilir, iki yola aynı id yazılır. Önce blob, sonra meta —
     meta listede göründüğünde gövdesi hazır olsun (ters sıra kısa süreli
     "içerik yok" penceresi açardı). */
  const id = push(ref(db, "globalSetups")).key;
  await set(ref(db, `globalSetupData/${id}`), { uid: user.uid, data: b64 });
  await set(ref(db, `globalSetups/${id}`), {
    ...meta,
    uid: user.uid,
    at: Date.now(),
    hasBlob: true,
  });
}

/* Blob'u talep üzerine çek (İçerik/İndir/Karşılaştır) — tek seferlik get. */
export async function getSetupBlob(id) {
  if (!db || !id) return "";
  const snap = await get(ref(db, `globalSetupData/${id}/data`));
  return snap.val() || "";
}

/* limit: son N kayıt (push anahtarı kronolojik → en yeni N). "Daha fazla yükle"
   limiti artırıp yeniden abone olur; sıralama zaten istemcide (at desc). */
export function watchSetups(cb, limit = 150) {
  if (!db) { cb([]); return () => {}; }
  return onValue(query(ref(db, "globalSetups"), limitToLast(limit)), (snap) => {
    const v = snap.val() || {};
    cb(Object.entries(v)
      .map(([id, x]) => ({ id, ...x }))
      .sort((a, b) => (b.at || 0) - (a.at || 0)));
  }, () => cb([]));
}

/* ---------- lmugarage.com resmi LMU yarış takvimi (salt-okur) ----------
   /lmuSchedule'a yalnız zamanlanmış GitHub Action yazar (admin token; bkz.
   scripts/scrape-lmu-schedule.mjs + .github/workflows/lmu-schedule.yml).
   cb(payload|null) — { updatedAt, source, count, races:[...] }. */
export function watchLmuSchedule(cb) {
  if (!db) { cb(null); return () => {}; }
  return onValue(ref(db, "lmuSchedule"),
    (snap) => cb(snap.exists() ? snap.val() : null),
    () => cb(null));
}

export async function deleteSetup(id) {
  if (!db || !id) return;
  await remove(ref(db, `globalSetups/${id}`));
  /* Blob ayrı silinir; hata yutulur — meta gittiği için satır zaten kaybolur,
     olası öksüz blob görünmezdir ve zarar vermez (admin tek yetkili). */
  await remove(ref(db, `globalSetupData/${id}`)).catch(() => {});
}

/* ---------- sohbet: kanal yolu ile çalışır ----------
   genel   -> globalChat
   takım   -> teams/{tid}/chat
   yarış   -> teams/{tid}/raceChat/{rid}                       */
export async function sendChat(path, user, name, text) {
  if (!db || !path || !user) return;
  const msg = String(text || "").trim().slice(0, 500);
  if (!msg) return;
  await push(ref(db, path), {
    uid: user.uid,
    name: String(name || user.displayName || "").slice(0, 60),
    text: msg,
    at: Date.now(),
  });
}

export function watchChat(path, cb, n = 120) {
  if (!db || !path) { cb([]); return () => {}; }
  const q = query(ref(db, path), limitToLast(n));
  return onValue(q, (snap) => {
    const v = snap.val() || {};
    cb(Object.entries(v)
      .map(([id, m]) => ({ id, ...m }))
      .sort((a, b) => (a.at || 0) - (b.at || 0)));
  }, () => cb([]));
}

export async function deleteChat(path, id) {
  if (!db || !path || !id) return;
  await remove(ref(db, `${path}/${id}`));
}

/* Uye kendi gorunen adini (ve Google foto URL'ini) takim dugumune yazar
   (pilot listesi + avatar icin). photo bos ise foto yolu temizlenir. */
export async function setTeamMemberName(tid, uid, name, photo = "") {
  if (!db || !tid || !uid) return;
  await update(ref(db), {
    [`teams/${tid}/names/${uid}`]: String(name || "").slice(0, 60),
    [`teams/${tid}/photos/${uid}`]: String(photo || "").slice(0, 500) || null,
  });
}

export async function setTeamRole(tid, uid, role) {
  if (!db) return;
  await set(ref(db, `teams/${tid}/members/${uid}`), role);
}

export async function leaveTeam(tid, uid) {
  if (!db) return;
  await remove(ref(db, `teams/${tid}/members/${uid}`));
  await remove(ref(db, `teams/${tid}/names/${uid}`));
  await remove(ref(db, `teams/${tid}/photos/${uid}`));
  await remove(ref(db, `users/${uid}/teams/${tid}`));
}

/* Sahipliği devret (yalnız mevcut sahip) — hedef üye owner olur, eski sahip
   editor'a düşer. TEK atomik update: kurallar yazımdan ÖNCEKİ duruma (fromUid
   hâlâ owner) göre doğrular → üç yol da geçer. */
export async function transferOwnership(tid, fromUid, toUid) {
  if (!db || !tid || !fromUid || !toUid || fromUid === toUid) return;
  await update(ref(db), {
    [`teams/${tid}/meta/ownerUid`]: toUid,
    [`teams/${tid}/members/${toUid}`]: "owner",
    [`teams/${tid}/members/${fromUid}`]: "editor",
  });
}

/* Üyeyi takımdan çıkar (yalnız owner) — takım tarafı düğümleri silinir. Owner
   kuralı members/names/photos/badges'e yazma izni verir. Çıkarılan üyenin
   users/{uid}/teams etiketi kendi cihazında self-heal ile temizlenir (App). */
export async function removeMember(tid, uid) {
  if (!db || !tid || !uid) return;
  await update(ref(db), {
    [`teams/${tid}/members/${uid}`]: null,
    [`teams/${tid}/names/${uid}`]: null,
    [`teams/${tid}/photos/${uid}`]: null,
    [`teams/${tid}/badges/${uid}`]: null,
  });
}

/* Takımı sil (yalnız owner) — tüm takım alt ağacı + katılım kodu + sahibin kendi
   etiketi. TEK atomik update: `teams/{tid}` silme kuralı ve teamCodes silme
   kuralı yazımdan ÖNCEKİ meta.ownerUid'e bakar (bkz. firebase-rules.json).
   Diğer üyelerin users/{uid}/teams etiketleri kendi cihazlarında self-heal ile
   temizlenir (erişim zaten kalktı). */
export async function deleteTeam(tid, ownerUid, joinCode) {
  if (!db || !tid || !ownerUid) return;
  const patch = {
    [`teams/${tid}`]: null,
    [`users/${ownerUid}/teams/${tid}`]: null,
  };
  if (joinCode) patch[`teamCodes/${joinCode}`] = null;
  await update(ref(db), patch);
}

/* Rozet (admin atar): "admin" | "driver" | "engineer" */
export async function setUserBadge(uid, badge) {
  if (!db || !uid) return;
  await update(ref(db, `users/${uid}`), { badge: badge || null });
}

/* Takım rozetleri (yalnız takım sahibi atar) — çoklu: { driver:true, engineer:true } */
export async function toggleTeamBadge(tid, uid, badge, on) {
  if (!db || !tid || !uid || !badge) return;
  const p = `teams/${tid}/badges/${uid}/${badge}`;
  if (on) await set(ref(db, p), true);
  else await remove(ref(db, p));
}

/* ============================================================
   SEZONLAR ve YARIŞLAR (oda kodu/PIN yok — erişim takım üyeliğinden)
     teams/{tid}/seasons/{sid}    : { name, year, createdAt }
     teams/{tid}/races/{rid}      : takvim kaydı
     teams/{tid}/raceState/{rid}  : { rev, stateJson, updatedBy, updatedAt }
   ============================================================ */
export async function createSeason(tid, name, year) {
  if (!db) return null;
  const sid = rnd(8).toLowerCase();
  await set(ref(db, `teams/${tid}/seasons/${sid}`), {
    name: String(name).slice(0, 40), year: Number(year) || new Date().getFullYear(),
    createdAt: Date.now(),
  });
  return sid;
}
export async function deleteSeason(tid, sid) {
  if (!db) return;
  await remove(ref(db, `teams/${tid}/seasons/${sid}`));
}
/* Sezon adı/yılını düzenle — kurallar seasons yazımını owner/editor'a izin veriyor. */
export async function updateSeason(tid, sid, patch) {
  if (!db || !tid || !sid) return;
  const p = {};
  if (patch.name != null) p.name = String(patch.name).slice(0, 40);
  if (patch.year != null) p.year = Number(patch.year) || new Date().getFullYear();
  if (Object.keys(p).length) await update(ref(db, `teams/${tid}/seasons/${sid}`), p);
}
/* Katılım kodu geçerli mi? — teamCodes/{code} okuması kurallarca serbest (katılım
   indexi). Yalnız GEÇERLİLİK döner; takım adı/üye sayısı meta okuması gerektirir
   (yalnız üyeye açık) → sızdırmamak için burada dönmüyoruz. */
export async function teamCodeExists(joinCode) {
  if (!db) return false;
  const code = String(joinCode || "").trim().toUpperCase();
  if (code.length < 6) return false;
  try { const snap = await get(ref(db, `teamCodes/${code}`)); return snap.exists(); }
  catch { return false; }
}
export function watchSeasons(tid, cb) {
  if (!db || !tid) { cb({}); return () => {}; }
  return onValue(ref(db, `teams/${tid}/seasons`),
    (s) => cb(s.exists() ? s.val() : {}), () => cb({}));
}

export async function createRace(tid, race, initialState, uid) {
  if (!db) return null;
  const rid = rnd(10).toLowerCase();
  await update(ref(db), {
    [`teams/${tid}/races/${rid}`]: {
      seasonId: race.seasonId || null,
      round: Number(race.round) || null,
      name: String(race.name || "").slice(0, 50),
      trackId: race.trackId || "", carClass: race.carClass || "", carId: race.carId || "",
      raceTime: race.raceTime || "", startsAt: Number(race.startsAt) || 0,
      createdAt: Date.now(), createdBy: uid || "",
    },
    [`teams/${tid}/raceState/${rid}`]: {
      rev: 1, stateJson: JSON.stringify(initialState),
      updatedBy: "plan", updatedAt: Date.now(),
    },
  });
  return rid;
}
export async function updateRace(tid, rid, patch) {
  if (!db) return;
  await update(ref(db, `teams/${tid}/races/${rid}`), patch);
}
export async function deleteRace(tid, rid) {
  if (!db) return;
  await remove(ref(db, `teams/${tid}/races/${rid}`));
  await remove(ref(db, `teams/${tid}/raceState/${rid}`)).catch(() => {});
}
export function watchRaces(tid, cb) {
  if (!db || !tid) { cb({}); return () => {}; }
  return onValue(ref(db, `teams/${tid}/races`),
    (s) => cb(s.exists() ? s.val() : {}), () => cb({}));
}

/* --- canlı senkron --- */
export async function raceStateGet(tid, rid) {
  if (!db) return null;
  const s = await get(ref(db, `teams/${tid}/raceState/${rid}`));
  return s.exists() ? s.val() : null;
}
export async function raceStateSet(tid, rid, payload) {
  if (!db) return;
  await set(ref(db, `teams/${tid}/raceState/${rid}`), payload);
}
export function raceStateSubscribe(tid, rid, cb) {
  if (!db) return () => {};
  return onValue(ref(db, `teams/${tid}/raceState/${rid}`), (s) => {
    if (s.exists()) cb(s.val());
  });
}

/* ---- canlı timing (LMU köprüsü → teams/{tid}/live/{rid}) ----
   Köprü (.exe) bu düğüme yazar; web salt-okunur dinler. Strateji
   state'inden (raceState) bağımsız kanal. */
export function liveTimingSubscribe(tid, rid, cb) {
  if (!db || !tid || !rid) { cb(null); return () => {}; }
  return onValue(ref(db, `teams/${tid}/live/${rid}`),
    (s) => cb(s.exists() ? s.val() : null),
    (err) => { console.warn("live read failed:", err?.message); cb(null); });
}

/* Test/mock (ve ileride web tarafı) için canlı düğümü yazar. */
export async function liveTimingSet(tid, rid, payload) {
  if (!db || !tid || !rid) return;
  await set(ref(db, `teams/${tid}/live/${rid}`), payload);
}

/* ---- kalıcı tur geçmişi (livelaps) ----
   Canlı kare küçük kalsın diye tur süreleri ayrı bir append-only düğüme yazılır:
   teams/{tid}/livelaps/{rid}/{lapKey}/{n} = sec. Her tur BİR KEZ yazılır (kare değil),
   böylece tüm yarış (300+ tur) kapsanır. Web "+" ile yalnız o aracı talep üzerine okur. */
export async function liveLapsAppend(tid, rid, entries) {
  if (!db || !tid || !rid || !entries) return;
  await update(ref(db, `teams/${tid}/livelaps/${rid}`), entries);
}
/* Yeni seans/yarış → o aracın eski tur geçmişini temizle. */
export async function liveLapsClear(tid, rid, lapKey) {
  if (!db || !tid || !rid || !lapKey) return;
  await set(ref(db, `teams/${tid}/livelaps/${rid}/${lapKey}`), null);
}
/* Bir aracın tüm tur geçmişini dinle (popup açıkken). cb({n: sec}) alır. */
export function liveLapsSubscribe(tid, rid, lapKey, cb) {
  if (!db || !tid || !rid || !lapKey) { cb(null); return () => {}; }
  return onValue(ref(db, `teams/${tid}/livelaps/${rid}/${lapKey}`),
    (s) => cb(s.exists() ? s.val() : null),
    (err) => { console.warn("livelaps read failed:", err?.message); cb(null); });
}

/* ---- kalıcı pozisyon geçmişi (livepos) — pozisyon-tur grafiği ----
   teams/{tid}/livepos/{rid}/{lapKey}/{n} = pozisyon (o tur pit atıldıysa NEGATİF,
   |değer| = pozisyon). livelaps ile aynı desen; tur başına bir kez yazılır. */
export async function livePosAppend(tid, rid, entries) {
  if (!db || !tid || !rid || !entries) return;
  await update(ref(db, `teams/${tid}/livepos/${rid}`), entries);
}
export async function livePosClear(tid, rid, lapKey) {
  if (!db || !tid || !rid || !lapKey) return;
  await set(ref(db, `teams/${tid}/livepos/${rid}/${lapKey}`), null);
}
/* Tüm sahanın pozisyon geçmişini dinle (grafik). cb({lapKey: {n: pos}}) alır. */
export function livePosSubscribe(tid, rid, cb) {
  if (!db || !tid || !rid) { cb(null); return () => {}; }
  return onValue(ref(db, `teams/${tid}/livepos/${rid}`),
    (s) => cb(s.exists() ? s.val() : null),
    (err) => { console.warn("livepos read failed:", err?.message); cb(null); });
}

/* ---- kalıcı sektör geçmişi (livesec) — tur listesi popup'ı için ----
   teams/{tid}/livesec/{rid}/{lapKey}/{n} = "s1,s2,s3" (metin). livelaps deseniyle
   aynı; tur başına bir kez yazılır. Popup, tur toplamının yanında S1/S2/S3 gösterir. */
export async function liveSecAppend(tid, rid, entries) {
  if (!db || !tid || !rid || !entries) return;
  await update(ref(db, `teams/${tid}/livesec/${rid}`), entries);
}
export async function liveSecClear(tid, rid, lapKey) {
  if (!db || !tid || !rid || !lapKey) return;
  await set(ref(db, `teams/${tid}/livesec/${rid}/${lapKey}`), null);
}
/* Bir aracın sektör geçmişini dinle (popup açıkken). cb({n: "s1,s2,s3"}) alır. */
export function liveSecSubscribe(tid, rid, lapKey, cb) {
  if (!db || !tid || !rid || !lapKey) { cb(null); return () => {}; }
  return onValue(ref(db, `teams/${tid}/livesec/${rid}/${lapKey}`),
    (s) => cb(s.exists() ? s.val() : null),
    (err) => { console.warn("livesec read failed:", err?.message); cb(null); });
}

/* ---- kalıcı PİST KOŞULLARI geçmişi (livecond) — tur listesi popup'ı için ----
   teams/{tid}/livecond/{rid}/{lapKey}/{n} = "temp,wet,grip" (asfalt °C, zemin ıslaklığı %,
   yol tutuş %). livesec deseniyle birebir; tur tamamlandığı karede o anki seans koşulları
   yazılır. Popup, her tur satırında koşulları gösterir. */
export async function liveCondAppend(tid, rid, entries) {
  if (!db || !tid || !rid || !entries) return;
  await update(ref(db, `teams/${tid}/livecond/${rid}`), entries);
}
export async function liveCondClear(tid, rid, lapKey) {
  if (!db || !tid || !rid || !lapKey) return;
  await set(ref(db, `teams/${tid}/livecond/${rid}/${lapKey}`), null);
}
export function liveCondSubscribe(tid, rid, lapKey, cb) {
  if (!db || !tid || !rid || !lapKey) { cb(null); return () => {}; }
  return onValue(ref(db, `teams/${tid}/livecond/${rid}/${lapKey}`),
    (s) => cb(s.exists() ? s.val() : null),
    (err) => { console.warn("livecond read failed:", err?.message); cb(null); });
}

/* ---- pilot müsaitliği (avail) — YARIŞ BAŞINA KALICI ----------------------
   teams/{tid}/races/{rid}/avail/{driverId} = [stintNo, …]
   Listede bulunan stint numaraları o pilotun UYGUN OLMADIĞI stintlerdir;
   varsayılan (düğüm yok) = tüm stintlerde uygun.

   Bu, ARAYUZ-YENILEME-PROMPT-v2'deki "yeni veri katmanı yok" kuralının
   BİLİNÇLİ TEK İSTİSNASIDIR. races/{rid} altında durduğu için yazma izni
   mevcut Tier A kuralından gelir (owner/editor yazar, üye okur); yarış
   silinince müsaitlik de silinir (deleteRace races/{rid}'yi kaldırır).
   Tip/boyut doğrulaması firebase-rules.json → races/$rid/avail/$driverId.

   NOT: stint ve pilot ATAMALARI raceState/{rid}.stateJson blob'unun içinde
   durur; races/{rid} altında per-stint düğüm deseni YOKTUR. Ayrı düğüm
   kullanılmasının nedeni budur — müsaitlik, plan blob'undan bağımsız yazılıp
   okunabilsin diye. */
export async function availSet(tid, rid, driverId, stintNos) {
  if (!db || !tid || !rid || !driverId) return;
  const list = Array.isArray(stintNos)
    ? [...new Set(stintNos.filter((n) => Number.isInteger(n) && n >= 0 && n < 200))]
      .sort((a, b) => a - b)
    : [];
  await set(ref(db, `teams/${tid}/races/${rid}/avail/${driverId}`),
    list.length ? list : null);
}
export async function availClear(tid, rid) {
  if (!db || !tid || !rid) return;
  await set(ref(db, `teams/${tid}/races/${rid}/avail`), null);
}
/* cb({driverId: [stintNo…]} | null). İzleyici de okur (Tier A .read = üye). */
export function availSubscribe(tid, rid, cb) {
  if (!db || !tid || !rid) { cb(null); return () => {}; }
  return onValue(ref(db, `teams/${tid}/races/${rid}/avail`),
    (s2) => cb(s2.exists() ? s2.val() : null),
    (err) => { console.warn("avail read failed:", err?.message); cb(null); });
}

/* ---- tur → pilot eşlemesi (livedrv) — endurance driver swap ----
   teams/{tid}/livedrv/{rid}/{lapKey}/{n} = "Pilot Adı". SEYREK: yalnız pilotun
   DEĞİŞTİĞİ tur yazılır (stint boyunca sabit); okuma tarafı ileri doldurur
   (liveLaps.driverAtLap). livelaps/livesec ile aynı desen. */
export async function liveDrvAppend(tid, rid, entries) {
  if (!db || !tid || !rid || !entries) return;
  await update(ref(db, `teams/${tid}/livedrv/${rid}`), entries);
}
export async function liveDrvClear(tid, rid, lapKey) {
  if (!db || !tid || !rid || !lapKey) return;
  await set(ref(db, `teams/${tid}/livedrv/${rid}/${lapKey}`), null);
}
/* Bir aracın tur→pilot kayıtlarını dinle (popup açıkken). cb({n: "ad"}) alır. */
export function liveDrvSubscribe(tid, rid, lapKey, cb) {
  if (!db || !tid || !rid || !lapKey) { cb(null); return () => {}; }
  return onValue(ref(db, `teams/${tid}/livedrv/${rid}/${lapKey}`),
    (s) => cb(s.exists() ? s.val() : null),
    (err) => { console.warn("livedrv read failed:", err?.message); cb(null); });
}

/* ---- tur → pit lastik değişimi (livetyre) — "+" geçmişinde pit işareti ----
   teams/{tid}/livetyre/{rid}/{lapKey}/{n} = "{adet}|{hamur}" (ör. "4|Medium"). SEYREK:
   yalnız pit atılan tur yazılır. livedrv/livesec ile aynı desen. */
export async function liveTyreAppend(tid, rid, entries) {
  if (!db || !tid || !rid || !entries) return;
  await update(ref(db, `teams/${tid}/livetyre/${rid}`), entries);
}
export async function liveTyreClear(tid, rid, lapKey) {
  if (!db || !tid || !rid || !lapKey) return;
  await set(ref(db, `teams/${tid}/livetyre/${rid}/${lapKey}`), null);
}
/* Bir aracın tur→pit lastik değişimi kayıtlarını dinle (popup açıkken). */
export function liveTyreSubscribe(tid, rid, lapKey, cb) {
  if (!db || !tid || !rid || !lapKey) { cb(null); return () => {}; }
  return onValue(ref(db, `teams/${tid}/livetyre/${rid}/${lapKey}`),
    (s) => cb(s.exists() ? s.val() : null),
    (err) => { console.warn("livetyre read failed:", err?.message); cb(null); });
}

/* ---- seans belirteci → canlı-geçmiş temizleme (v1.4.135) ----
   Köprü, canlı karede session.sessionId (kararlı seans belirteci) yayar. Yeni bir
   seans başlayınca (antrenman→yarış, yeni seans) bu belirteç değişir → o yarışın (rid)
   TÜM canlı-geçmiş düğümleri bir kez temizlenir; böylece eski seansın turları "+" tur
   listesi popup'ına sızmaz. Köprü yarış ORTASINDA yeniden başlarsa belirteç aynı kalır
   → geçmiş KORUNUR (yanlış temizleme yok). */
export async function liveSessionIdGet(tid, rid) {
  if (!db || !tid || !rid) return null;
  try {
    const s = await get(ref(db, `teams/${tid}/live/${rid}/session/sessionId`));
    return s.exists() ? s.val() : null;
  } catch (e) {
    console.warn("liveSessionId read failed:", e?.message);
    return null;
  }
}
/* O yarışın (rid) tüm canlı-geçmiş düğümlerini tek yazımda temizle. .write zaten $rid
   seviyesinde (owner/editor) → kural değişmez. */
export async function liveHistoryClearAll(tid, rid) {
  if (!db || !tid || !rid) return;
  await update(ref(db, `teams/${tid}`), {
    [`livelaps/${rid}`]: null,
    [`livepos/${rid}`]: null,
    [`livesec/${rid}`]: null,
    [`livedrv/${rid}`]: null,
    [`livetyre/${rid}`]: null,
    [`livecond/${rid}`]: null,
  });
}

/* ---- paylaşımlı iç-harita şekli (livetrack) ----
   teams/{tid}/livetrack/{trackKey} = packBins(...) metni (bkz. trackShape.js).
   PİST başına saklanır (rid değil) → bir kez oluşan devre şekli o pistin tüm
   yarışlarında ve tüm takımda anında dolu gelir. Owner/editor yazar; herkes okur. */
export async function liveTrackSave(tid, trackKey, packed) {
  if (!db || !tid || !trackKey || typeof packed !== "string" || !packed) return;
  await set(ref(db, `teams/${tid}/livetrack/${trackKey}`), packed);
}
export function liveTrackSubscribe(tid, trackKey, cb) {
  if (!db || !tid || !trackKey) { cb(null); return () => {}; }
  return onValue(ref(db, `teams/${tid}/livetrack/${trackKey}`),
    (s) => cb(s.exists() ? s.val() : null),
    (err) => { console.warn("livetrack read failed:", err?.message); cb(null); });
}

/* ---- paylaşımlı sektör sınırları (livetracksec) ----
   teams/{tid}/livetracksec/{trackKey} = "f12,f20" (bkz. trackSectors.js). Şekil gibi
   PİST başına; owner/editor yazar, herkes okur → ayırıcılar izleyicilerde anında gelir. */
export async function liveTrackSecSave(tid, trackKey, str) {
  if (!db || !tid || !trackKey || typeof str !== "string" || !str) return;
  await set(ref(db, `teams/${tid}/livetracksec/${trackKey}`), str);
}
export function liveTrackSecSubscribe(tid, trackKey, cb) {
  if (!db || !tid || !trackKey) { cb(null); return () => {}; }
  return onValue(ref(db, `teams/${tid}/livetracksec/${trackKey}`),
    (s) => cb(s.exists() ? s.val() : null),
    (err) => { console.warn("livetracksec read failed:", err?.message); cb(null); });
}

/* ---- paylaşımlı pit giriş/çıkış (livetrackpit, v1.4.96) ----
   teams/{tid}/livetrackpit/{trackKey} = "entry,exit" (bkz. trackSectors.js). Sektör
   deseninin aynısı; owner/editor yazar, herkes okur → pit işaretleri anında gelir. */
export async function liveTrackPitSave(tid, trackKey, str) {
  if (!db || !tid || !trackKey || typeof str !== "string" || !str) return;
  await set(ref(db, `teams/${tid}/livetrackpit/${trackKey}`), str);
}
export function liveTrackPitSubscribe(tid, trackKey, cb) {
  if (!db || !tid || !trackKey) { cb(null); return () => {}; }
  return onValue(ref(db, `teams/${tid}/livetrackpit/${trackKey}`),
    (s) => cb(s.exists() ? s.val() : null),
    (err) => { console.warn("livetrackpit read failed:", err?.message); cb(null); });
}

/* ---- tek-yazıcı seçimi (livewriter lease) ----
   Aynı yarışta birden çok masaüstü köprüsü (ör. ayrı PC'lerdeki co-sürücüler) canlı
   düğüme AYNI ANDA yazıp çakışmasın diye tek bir "yazıcı kirası" tutulur:
   teams/{tid}/livewriter/{rid} = { uid, by, driving, ts }. Yalnız kirayı tutan makine
   kareyi yazar. Aktif sürücü (own.driving) kirayı önceliklendirir; kira bayatlarsa
   (oyun kapandı → kare gelmez → tazelenmez) başka makine devralır. ts SERVER saatidir
   (serverTimestamp) → PC saat kayması karşılaştırmayı bozmaz. STALE eşiği + saf
   "yazmalı mı" kararı ./liveWriter.js'te (test edilebilir). */
let _serverOffset = 0;
if (db) {
  onValue(ref(db, ".info/serverTimeOffset"),
    (s) => { _serverOffset = Number(s.val()) || 0; }, () => {});
}
/* Server ile hizalı "şimdi" (ms) — kira bayatlama karşılaştırması için. */
export function serverNow() { return Date.now() + _serverOffset; }

/* Kirayı almayı/tazelemeyi dener. Kural: kira yok / benim / bayat → al; ben sürüyorsam
   ve tutan sürmüyorsa → önceliklendir/al; aksi halde dokunma. Dönüş: kirayı tutuyor
   muyum (bool). */
export async function liveWriterClaim(tid, rid, { uid, by = "", driving = false }) {
  if (!db || !tid || !rid || !uid) return false;
  const r = ref(db, `teams/${tid}/livewriter/${rid}`);
  const now = serverNow();
  try {
    const res = await runTransaction(r, (cur) => {
      const mine = cur && cur.uid === uid;
      const stale = !cur || (typeof cur.ts === "number" && now - cur.ts > LIVE_WRITER_STALE_MS);
      const preempt = !!driving && cur && !cur.driving && cur.uid !== uid;
      if (!cur || mine || stale || preempt) {
        return { uid, by, driving: !!driving, ts: serverTimestamp() };
      }
      return undefined;   // abort — kirayı koru (başkası aktif)
    });
    const v = res.committed ? res.snapshot.val() : null;
    return !!(v && v.uid === uid);
  } catch {
    return false;
  }
}

/* Kirayı bırak (yalnız bizimse). stopBridge'de çağrılır. */
export async function liveWriterRelease(tid, rid, uid) {
  if (!db || !tid || !rid || !uid) return;
  const r = ref(db, `teams/${tid}/livewriter/${rid}`);
  try {
    await runTransaction(r, (cur) => (cur && cur.uid === uid ? null : undefined));
  } catch { /* yoksay */ }
}

/* Kirayı dinle (UI: "kim yayınlıyor" + köprünün beklemede kararı). */
export function liveWriterSubscribe(tid, rid, cb) {
  if (!db || !tid || !rid) { cb(null); return () => {}; }
  return onValue(ref(db, `teams/${tid}/livewriter/${rid}`),
    (s) => cb(s.exists() ? s.val() : null),
    (err) => { console.warn("livewriter read failed:", err?.message); cb(null); });
}
