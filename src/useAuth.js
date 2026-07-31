/* ============================================================
   useAuth — kimlik doğrulama + kullanıcı belgesi aboneliği
   ------------------------------------------------------------
   App.jsx'ten çıkarıldı (Tanrı-bileşen borcunu azaltan güvenli dilim).
   Davranış birebir korunur.

   - watchAuth → oturum kullanıcısı (`user`) + ilk yükleme bitti (`authLoading`).
   - Giriş yapınca profil dokunuşu (touchUserProfile) + kullanıcı belgesi aboneliği
     (watchUserDoc → `udoc`; null=yükleniyor, {}=kayıt yok).

   Dönüş: { user, authLoading, udoc }. Türetilenler (access/isAdmin) App'te udoc'tan
   hesaplanır; regName ön-doldurma ve userName senkronu App'te kalır. */
import { useState, useEffect } from "react";
import { watchAuth } from "./auth";
import { touchUserProfile, watchUserDoc } from "./storage";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [udoc, setUdoc] = useState(null);   // null=yükleniyor, {}=kayıt yok

  useEffect(() => watchAuth((u) => { setUser(u); setAuthLoading(false); }), []);

  useEffect(() => {
    if (!user) { setUdoc(null); return undefined; }
    touchUserProfile(user).catch(() => {});
    return watchUserDoc(user.uid, (d) => setUdoc(d));
  }, [user]);

  return { user, authLoading, udoc };
}
