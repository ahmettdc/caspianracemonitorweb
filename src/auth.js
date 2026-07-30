/* ============================================================
   KİMLİK DOĞRULAMA — Firebase Auth (Google ile giriş)
   Uygulamanın tamamı bu kapının arkasında.
   ============================================================ */
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, getRedirectResult,
  signOut as fbSignOut, onAuthStateChanged,
} from "firebase/auth";
import { firebaseConfig } from "./firebase-config";
import { isTauri } from "./tauriEnv";
import { signInGoogleNative } from "./tauriGoogleAuth";

export const authReady =
  !!firebaseConfig?.apiKey && !String(firebaseConfig.apiKey).includes("XXXX");

let auth = null;
if (authReady) {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
}

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

/* Google ile giriş.
   • Web (tarayıcı): signInWithPopup. (iOS/Safari'de redirect, depolama
     bölümleme nedeniyle "missing initial state" verdiği için kullanılmıyor.)
   • Masaüstü (Tauri/WebView2): popup ve web-redirect akışları gömülü tarayıcıda
     çalışmaz (Google gömülü tarayıcıları da engeller). Bu yüzden giriş, sistem
     tarayıcısında açılıp yerel bir loopback ile geri alınır — bkz.
     tauriGoogleAuth.js. Yetkili alan (Authorized domains) gerektirmez. */
export async function signInGoogle() {
  if (!auth) throw new Error("Firebase Auth yapılandırılmamış");
  if (isTauri) {
    return await signInGoogleNative(auth);
  }
  try {
    const res = await signInWithPopup(auth, provider);
    return res.user;
  } catch (e) {
    const code = e?.code || "";
    if (code.includes("popup-closed") || code.includes("cancelled-popup")) {
      return null;                       // kullanıcı vazgeçti — sessizce geç
    }
    if (code.includes("popup-blocked")) {
      const err = new Error("POPUP_BLOCKED");
      err.code = code;
      throw err;
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
