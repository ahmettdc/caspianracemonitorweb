/* ============================================================
   useTeams — takım/sezon/yarış abonelikleri
   ------------------------------------------------------------
   App.jsx'ten çıkarıldı (Tanrı-bileşen borcunu azaltan güvenli dilim).
   Davranış birebir korunur.

   - watchMyTeams → kullanıcının takımları (`myTeams`); seçili takım yoksa ilkini seç.
   - Seçili takım (`curTeam`) değişince watchTeam/watchSeasons/watchRaces →
     `teamData` / `seasons` / `races`. Takım yokken hepsi boşalır.

   Dönüş: { myTeams, curTeam, setCurTeam, teamData, seasons, races }.
   Takım formları (tForm/rForm/tErr/curSeason) render'a bağlı olduğundan App'te kalır. */
import { useState, useEffect } from "react";
import { watchMyTeams, watchTeam, watchSeasons, watchRaces } from "./storage";

export function useTeams({ user, access }) {
  const [myTeams, setMyTeams] = useState({});
  const [curTeam, setCurTeam] = useState("");      // seçili takım id
  const [teamData, setTeamData] = useState(null);
  const [seasons, setSeasons] = useState({});
  const [races, setRaces] = useState({});

  useEffect(() => {
    if (!user || !access) return undefined;
    return watchMyTeams(user.uid, (t) => {
      setMyTeams(t || {});
      setCurTeam((c) => c || Object.keys(t || {})[0] || "");
    });
  }, [user, access]);

  useEffect(() => {
    if (!curTeam) { setTeamData(null); setSeasons({}); setRaces({}); return undefined; }
    const o1 = watchTeam(curTeam, setTeamData);
    const o2 = watchSeasons(curTeam, (x) => setSeasons(x || {}));
    const o3 = watchRaces(curTeam, (x) => setRaces(x || {}));
    return () => { o1(); o2(); o3(); };
  }, [curTeam]);

  return { myTeams, curTeam, setCurTeam, teamData, seasons, races };
}
