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
export async function touchUserProfile(user) {
  if (!db || !user) return;
  /* `allowed` alanına DOKUNULMAZ — yalnızca profil alanları güncellenir
     (güvenlik kuralı da istemcinin allowed yazmasını engeller) */
  await update(ref(db, `users/${user.uid}`), {
    email: user.email || "",
    name: user.displayName || "",
    photo: user.photoURL || "",
    lastSeen: Date.now(),
  });
}

/* cb(allowed:boolean) — izin değişince anında tetiklenir */
export function watchAccess(uid, cb) {
  if (!db || !uid) { cb(false); return () => {}; }
  return onValue(ref(db, `users/${uid}/allowed`), (snap) => cb(snap.val() === true));
}
