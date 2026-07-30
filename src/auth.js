/* ============================================================
   KİMLİK DOĞRULAMA — Firebase Auth (Google ile giriş)
   Uygulamanın tamamı bu kapının arkasında.
   ============================================================ */
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  signOut as fbSignOut, onAuthStateChanged,
} from "firebase/auth";
import { firebaseConfig } from "./firebase-config";
import { isTauri } from "./tauriEnv";

export const authReady =
  !!firebaseConfig?.apiKey && !String(firebaseConfig.apiKey).includes("XXXX");

let auth = null;
if (authReady) {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
}

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

/* Google ile giriş — popup (iOS/Safari'de redirect, depolama bölümleme
   nedeniyle "missing initial state" hatası verdiği için kullanılmıyor).
   Tauri (masaüstü) kabuğunda WebView2 window.open()'ı (popup) varsayılan
   olarak engellediğinden orada redirect akışı kullanılır — sayfa Google'a
   yönlenip aynı pencerede geri döner; sonuç watchAuth/getRedirectResult ile
   yakalanır. Redirect, Firebase projesinin "Authorized domains" listesinde
   tauri.localhost'un ekli olmasını gerektirir (Console → Authentication →
   Settings → Authorized domains). */
export async function signInGoogle() {
  if (!auth) throw new Error("Firebase Auth yapılandırılmamış");
  if (isTauri) {
    try {
      await signInWithRedirect(auth, provider);
      return null; // sayfa yönlendi; sonuç watchAuth üzerinden gelir
    } catch (e) {
      if (e?.code === "auth/unauthorized-domain") {
        const err = new Error("UNAUTHORIZED_DOMAIN");
        err.code = e.code;
        throw err;
      }
      throw e;
    }
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
