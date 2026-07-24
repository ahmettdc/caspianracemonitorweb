/* ============================================================
   ODA DEPOSU — Firebase Realtime Database
   window.storage (Claude artifact API) yerine geçer.
   Odalar RTDB'de "rooms/KOD" yolunda tutulur.
   Bonus: 3sn polling yerine onValue ile anlık senkronizasyon.
   ============================================================ */
import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, set, update, onValue } from "firebase/database";
import { firebaseConfig } from "./firebase-config";

export const firebaseReady =
  !!firebaseConfig?.databaseURL && !firebaseConfig.databaseURL.includes("XXXX");

let db = null;
if (firebaseReady) {
  db = getDatabase(initializeApp(firebaseConfig));
}

const roomRef = (code) => ref(db, `rooms/${String(code).toUpperCase()}`);

export async function roomSet(code, payload) {
  if (!db) throw new Error("Firebase yapılandırılmamış");
  await set(roomRef(code), payload);
  return true;
}

export async function roomGet(code) {
  if (!db) throw new Error("Firebase yapılandırılmamış");
  const snap = await get(roomRef(code));
  return snap.exists() ? snap.val() : null;
}

/* cb(remotePayload) — oda her değiştiğinde anında tetiklenir.
   Dönen fonksiyon aboneliği iptal eder. */
export function roomSubscribe(code, cb) {
  if (!db) return () => {};
  return onValue(roomRef(code), (snap) => {
    if (snap.exists()) cb(snap.val());
  });
}

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
