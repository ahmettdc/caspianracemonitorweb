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
import { newFuelObs, fuelObserve } from "./fuelObs";

export function useLive({ curRace, curTeamRef, stRef }) {
  const [live, setLive] = useState(null);
  const [liveFuelObs, setLiveFuelObs] = useState(null);
  const fuelObsRef = useRef(newFuelObs());

  // canlı timing düğümünü dinle (LMU köprüsü yazar; salt-okunur)
  useEffect(() => {
    if (!curRace) { setLive(null); return undefined; }
    fuelObsRef.current = newFuelObs();   // yarış değişti → öğreniciyi sıfırla
    setLiveFuelObs(null);
    const off = liveTimingSubscribe(curTeamRef.current, curRace, setLive);
    return () => off();
  }, [curRace]);

  /* canlı yakıt öğrenici: kendi araç yakıtından litre/tur + depo → model önerisi
     (opt-in). Mantık saf modülde (fuelObs.js) — tüketim TUR SINIRINDA mandallanan
     yakıttan ölçülür; eskiden kare kare ölçülüp filtreye takıldığı için hiç örnek
     toplanamıyordu. */
  useEffect(() => {
    const own = live?.own;
    if (!own || typeof own.fuel !== "number") return;
    const obs = fuelObserve(fuelObsRef.current, own, stRef.current?.fuelRatio);
    setLiveFuelObs(obs);
  }, [live, stRef]);

  return { live, liveFuelObs };
}
