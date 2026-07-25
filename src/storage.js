/* ============================================================
   ODA DEPOSU — Firebase Realtime Database
   window.storage (Claude artifact API) yerine geçer.
   Odalar RTDB'de "rooms/KOD" yolunda tutulur.
   Bonus: 3sn polling yerine onValue ile anlık senkronizasyon.
   ============================================================ */
import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, set, update, remove, onValue,
  push, query, limitToLast } from "firebase/database";
import { firebaseConfig } from "./firebase-config";

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
  const meta = await get(ref(db, `teams/${tid}/meta`));
  const nm = String(memberName || user.displayName || user.email || "").slice(0, 60);
  await update(ref(db), {
    [`teams/${tid}/names/${user.uid}`]: nm,
    [`teams/${tid}/members/${user.uid}`]: "viewer",
    [`users/${user.uid}/teams/${tid}`]: meta.exists() ? meta.val().name : tid,
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
  const acc = { meta: null, members: null, badges: null, rooms: null, names: null };
  const emit = () => cb({ ...acc });
  const sub = (key) => onValue(ref(db, `teams/${tid}/${key}`),
    (s) => { acc[key] = s.exists() ? s.val() : (key === "meta" ? null : {}); emit(); },
    () => { acc[key] = key === "meta" ? null : {}; emit(); });
  const offs = ["meta", "members", "badges", "rooms", "names"].map(sub);
  return () => offs.forEach((o) => o());
}

/* PIN'ler ayrı düğümde — okuma yetkisi yoksa sessizce boş döner */






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

/* Uye kendi gorunen adini takim dugumune yazar (pilot listesi icin) */
export async function setTeamMemberName(tid, uid, name) {
  if (!db || !tid || !uid) return;
  await set(ref(db, `teams/${tid}/names/${uid}`), String(name || "").slice(0, 60));
}

export async function setTeamRole(tid, uid, role) {
  if (!db) return;
  await set(ref(db, `teams/${tid}/members/${uid}`), role);
}

export async function leaveTeam(tid, uid) {
  if (!db) return;
  await remove(ref(db, `teams/${tid}/members/${uid}`));
  await remove(ref(db, `teams/${tid}/names/${uid}`));
  await remove(ref(db, `users/${uid}/teams/${tid}`));
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
