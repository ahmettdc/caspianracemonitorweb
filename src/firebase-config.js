/* ============================================================
   FIREBASE YAPILANDIRMASI
   1. https://console.firebase.google.com → yeni proje oluştur
   2. Build → Realtime Database → Create Database (test mode)
   3. Project Settings → General → "Your apps" → Web app ekle (</>)
   4. Çıkan firebaseConfig objesini aşağıya yapıştır
   Not: databaseURL alanı bazen config'de gelmez — Realtime
   Database sayfasının üstündeki URL'yi elle ekle.
   ============================================================ */
export const firebaseConfig = {
  apiKey: "XXXX",
  authDomain: "XXXX.firebaseapp.com",
  databaseURL: "https://XXXX-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "XXXX",
  storageBucket: "XXXX.appspot.com",
  messagingSenderId: "XXXX",
  appId: "XXXX",
};
