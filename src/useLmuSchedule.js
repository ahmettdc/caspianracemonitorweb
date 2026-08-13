/* ============================================================
   useLmuSchedule — lmugarage.com resmi LMU yarış takvimi aboneliği
   ------------------------------------------------------------
   RTDB /lmuSchedule düğümünü izler (yazan: GitHub Action). useSetups deseniyle
   aynı: yalnız görünürken (active) abone olur → gereksiz indirme yok. Türetilmiş
   canlı/yaklaşan listeleri başlangıç zamanına göre sıralı döndürür.
   ============================================================ */
import { useState, useEffect } from "react";
import { watchLmuSchedule } from "./storage";

export function useLmuSchedule({ user, udoc, active = true }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !udoc?.allowed || !active) {
      setData(null); setLoading(false); return undefined;
    }
    setLoading(true);
    return watchLmuSchedule((p) => { setData(p); setLoading(false); });
  }, [user, udoc, active]);

  const races = Array.isArray(data?.races) ? data.races : [];
  const sorted = [...races].sort((a, b) => (a.startMs || 0) - (b.startMs || 0));

  return {
    data,
    races: sorted,
    live: sorted.filter((r) => r.live),
    upcoming: sorted.filter((r) => !r.live),
    updatedAt: data?.updatedAt || null,
    loading,
  };
}
