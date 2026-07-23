/* ============================================================
   KİMLİK DOĞRULAMA — Firebase Auth (Google ile giriş)
   Uygulamanın tamamı bu kapının arkasında.
   ============================================================ */
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, signOut as fbSignOut, onAuthStateChanged,
} from "firebase/auth";
import { firebaseConfig } from "./firebase-config";

export const authReady =
  !!firebaseConfig?.apiKey && !String(firebaseConfig.apiKey).includes("XXXX");

let auth = null;
if (authReady) {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
}

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

/* Google ile giriş — popup engellenirse redirect'e düşer */
export async function signInGoogle() {
  if (!auth) throw new Error("Firebase Auth yapılandırılmamış");
  try {
    const res = await signInWithPopup(auth, provider);
    return res.user;
  } catch (e) {
    const code = e?.code || "";
    if (code.includes("popup-blocked") || code.includes("popup-closed")
        || code.includes("cancelled-popup")) {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw e;
  }
}

export async function signOut() {
  if (auth) await fbSignOut(auth);
}

/* cb(user|null) — oturum değişince tetiklenir; dönen fonksiyon aboneliği bırakır */
export function watchAuth(cb) {
  if (!auth) { cb(null); return () => {}; }
  getRedirectResult(auth).catch(() => {});   // redirect dönüşünü yut
  return onAuthStateChanged(auth, (u) => cb(u || null));
}

export function currentUser() {
  return auth?.currentUser || null;
}
