/* ============================================================
   MASAÜSTÜ (Tauri) GOOGLE GİRİŞİ — sistem tarayıcısı + loopback
   ------------------------------------------------------------
   Gömülü WebView2, Firebase'in popup/redirect akışlarını taşıyamıyor
   (Google da gömülü tarayıcılarda OAuth'u engelliyor: disallowed_useragent).
   Bu yüzden giriş, kullanıcının GERÇEK varsayılan tarayıcısında açılır:

     1) Rust tarafında geçici bir loopback sunucu başlatılır (127.0.0.1:PORT).
     2) Google OAuth 2.0 "authorization code + PKCE" akışı sistem tarayıcısında
        açılır; redirect_uri = http://127.0.0.1:PORT.
     3) Kullanıcı onaylayınca tarayıcı loopback'e ?code=… ile döner; Rust bunu
        "oauth://url" olayıyla buraya iletir.
     4) code → Rust komutu (exchange_google_code) ile Google token uç noktasında
        id_token'a çevrilir (client_secret Rust'ta, derleme zamanı env'inden).
     5) id_token ile Firebase'e signInWithCredential — yetkili alan gerektirmez.

   Gerekli: VITE_GOOGLE_OAUTH_CLIENT_ID (Vite env, "Desktop app" OAuth istemcisi).
   ============================================================ */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || "";

function base64url(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randToken(byteLen = 48) {
  const a = new Uint8Array(byteLen);
  crypto.getRandomValues(a);
  return base64url(a.buffer);
}

async function pkceChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(digest);
}

/* Sistem tarayıcısında Google girişini açar, sonucu Firebase kullanıcısı olarak döndürür. */
export async function signInGoogleNative(auth) {
  if (!CLIENT_ID) throw new Error("OAUTH_CLIENT_MISSING");

  const verifier = randToken(48);
  const challenge = await pkceChallenge(verifier);
  const state = randToken(24);

  const port = await invoke("start_oauth_server");
  const redirectUri = `http://127.0.0.1:${port}`;

  return await new Promise((resolve, reject) => {
    let unlisten = () => {};
    let settled = false;
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { unlisten(); } catch { /* yoksay */ }
      invoke("stop_oauth_server", { port }).catch(() => {});
      fn(arg);
    };
    // Kullanıcı tarayıcıda takılırsa sunucuyu sonsuza kadar açık bırakma.
    const timer = setTimeout(() => finish(reject, new Error("OAUTH_TIMEOUT")), 180000);

    listen("oauth://url", async (ev) => {
      try {
        const u = new URL(String(ev.payload));
        if (u.searchParams.get("state") !== state) throw new Error("STATE_MISMATCH");
        const oerr = u.searchParams.get("error");
        if (oerr) throw new Error(oerr);
        const code = u.searchParams.get("code");
        if (!code) throw new Error("NO_CODE");
        const idToken = await invoke("exchange_google_code", {
          code, codeVerifier: verifier, redirectUri, clientId: CLIENT_ID,
        });
        const res = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
        finish(resolve, res.user);
      } catch (e) {
        finish(reject, e);
      }
    }).then((u) => {
      unlisten = u;
      if (settled) u();          // zaten bitti/iptal olduysa hemen bırak
    });

    const authUrl =
      "https://accounts.google.com/o/oauth2/v2/auth?" +
      new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        code_challenge: challenge,
        code_challenge_method: "S256",
        state,
        prompt: "select_account",
        access_type: "online",
      }).toString();

    invoke("open_external_url", { url: authUrl }).catch((e) => finish(reject, e));
  });
}
