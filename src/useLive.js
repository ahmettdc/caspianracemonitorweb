/* ============================================================
   useLive — canlı timing aboneliği + canlı yakıt öğrenici
   ------------------------------------------------------------
   App.jsx'ten çıkarıldı (Tanrı-bileşen borcunu azaltan güvenli dilim).
   Davranış birebir korunur.

   - Canlı düğüm (teams/{tid}/live/{rid}) aboneliği → `live` (LMU köprüsü yazar,
     burada salt-okunur). Yarış değişince (curRace) yeniden abone olur; takım
     (curTeamRef) ref'ten okunur ki takım değişse de gereksiz re-abone olmasın.
   - Yakıt öğrenici: kendi araç yakıtından litre/tur + depo → model önerisi
     (`liveFuelObs`, opt-in; App'teki applyLiveFuel bunu uygular). stRef'ten mevcut
     fuelRatio okunur.

   Dönüş: { live, liveFuelObs }. */
import { useState, useEffect, useRef } from "react";
import { liveTimingSubscribe } from "./storage";

export function useLive({ curRace, curTeamRef, stRef }) {
  const [live, setLive] = useState(null);
  const [liveFuelObs, setLiveFuelObs] = useState(null);
  const fuelObsRef = useRef({ prevLap: null, prevFuel: null, buf: [] });

  // canlı timing düğümünü dinle (LMU köprüsü yazar; salt-okunur)
  useEffect(() => {
    if (!curRace) { setLive(null); return undefined; }
    fuelObsRef.current = { prevLap: null, prevFuel: null, buf: [] }; // yarış değişti → öğreniciyi sıfırla
    setLiveFuelObs(null);
    const off = liveTimingSubscribe(curTeamRef.current, curRace, setLive);
    return () => off();
  }, [curRace]);

  // canlı yakıt öğrenici: kendi araç yakıtından litre/tur + depo → model önerisi (opt-in)
  useEffect(() => {
    const own = live?.own;
    if (!own || typeof own.fuel !== "number") return;
    const r = fuelObsRef.current;
    const lap = typeof own.lapsDone === "number" ? own.lapsDone : null;
    if (r.prevLap != null && lap != null && lap > r.prevLap && r.prevFuel != null) {
      const perLap = (r.prevFuel - own.fuel) / (lap - r.prevLap);
      if (perLap > 0.2 && perLap < 30) {           // pit/refuel artışı ve anomaliyi ele
        r.buf.push(perLap);
        if (r.buf.length > 6) r.buf.shift();
      }
    }
    if (lap != null) r.prevLap = lap;
    r.prevFuel = own.fuel;

    const cap = own.fuelCapacity > 0 ? own.fuelCapacity : null;
    const buf = r.buf;
    if (!buf.length && !cap) { setLiveFuelObs(null); return; }
    const sorted = [...buf].sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null;
    const obsRatio = cap ? +(cap / 100).toFixed(3) : null;
    const ratioForCons = obsRatio || stRef.current.fuelRatio || 0.86;
    const obsCons = median != null ? +(median / ratioForCons).toFixed(2) : null;
    setLiveFuelObs({
      litersPerLap: median != null ? +median.toFixed(2) : null,
      samples: buf.length, fuelCap: cap, obsRatio, obsCons,
    });
  }, [live, stRef]);

  return { live, liveFuelObs };
}
