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
      const list = t || {};
      setMyTeams(list);
      /* SEÇİLİ TAKIM ARTIK LİSTEDE YOKSA KENDİNİ DÜZELTİR (v2.4.1).
         Eskiden `c || ilk` deniyordu: `c` doluysa ASLA değişmiyordu. Uygulama
         içinden çıkıp (sayfa yenilemeden) başka bir Google hesabıyla girince
         ne curTeam ne myTeams temizleniyor, curTeam aynı kaldığı için ikinci
         effect de yeniden çalışmıyor ve önceki hesabın takımına açılmış
         watchTeam/watchSeasons/watchRaces abonelikleri KAPANMIYORDU (yalnız
         izin reddiyle boşalıyorlardı). Kullanıcı, üyesi olmadığı eski takım
         seçiliyken boş sezon/yarış listesi görüyor ve elle başka takıma
         tıklamadan düzelmiyordu. Aynı düzeltme takımdan çıkarılma durumunu da
         kapatır. */
      setCurTeam((c) => (c && list[c] ? c : Object.keys(list)[0] || ""));
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
