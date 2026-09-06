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
import {
  liveTimingSubscribe, liveLapsAppend, liveSecAppend, liveCondAppend,
  liveHistoryClearAll, liveLapsClear, liveSecClear, liveCondClear,
} from "./storage";
import { newFuelObs, fuelObserve } from "./fuelObs";
import { newLapObs, lapObserve, hasWrites } from "./lapObs";

export function useLive({ curRace, curTeamRef, stRef, canEditRef }) {
  const [live, setLive] = useState(null);
  const [liveFuelObs, setLiveFuelObs] = useState(null);
  const [lapCapture, setLapCapture] = useState(null);
  const fuelObsRef = useRef(newFuelObs());
  const lapObsRef = useRef(newLapObs());

  // canlı timing düğümünü dinle (LMU köprüsü yazar; salt-okunur)
  useEffect(() => {
    if (!curRace) { setLive(null); return undefined; }
    /* Yarış DEĞİŞTİ → eski odanın son karesini hemen bırak. Eskiden yalnız
       `!curRace` iken null'lanıyordu; A'dan B'ye geçince B'nin ilk karesi
       gelene kadar A'nın karesi duruyordu ve useLiveSync bunu B'nin ilk
       karesiyle karşılaştırıp sahte bir pit girişi görebiliyordu
       (detectPitEntry(A_own, B_own)). */
    setLive(null);
    fuelObsRef.current = newFuelObs();   // yarış değişti → öğreniciyi sıfırla
    lapObsRef.current = newLapObs();     // tur gözlemcisini de sıfırla
    setLiveFuelObs(null);
    setLapCapture(null);
    const off = liveTimingSubscribe(curTeamRef.current, curRace, setLive);
    return () => off();
  }, [curRace]);

  /* Tur geçmişi OKUYUCU-tarafı hasat (v1.8.12): canlı kareden lapsDone artışını gözle,
     turu livelaps'e yaz. Köprü sürümünden BAĞIMSIZ (köprü harvest'i idempotent yedek).
     Yazım YALNIZ editörde (canEditRef) — Firebase kuralı editör-dışını zaten reddeder,
     gereksiz konsol gürültüsü olmasın. Gözlem HER karede çalışır (durum sıcak kalsın;
     gösterge için sayaç). */
  useEffect(() => {
    if (!live || !live.ts) return;
    const tid = curTeamRef.current, rid = curRace;
    const { writes, clears, captured, cars } = lapObserve(lapObsRef.current, live);
    const editor = !!canEditRef?.current;
    setLapCapture((prev) => {
      // "kaydediliyor" yalnız gerçekten yazan editörde (izleyici yazmıyor → yanıltmasın)
      const next = { writing: editor && captured > 0, laps: captured, cars };
      return (prev && prev.laps === next.laps && prev.cars === next.cars
        && prev.writing === next.writing) ? prev : next;
    });
    if (!editor || !tid || !rid) return;   // yalnız editör yazar
    // önce temizlik (RTDB sıra: köprü de clear'ı ayrı yazımda yapıyor)
    if (clears.all) { liveHistoryClearAll(tid, rid).catch(() => {}); }
    else for (const k of clears.keys) {
      liveLapsClear(tid, rid, k).catch(() => {});
      liveSecClear(tid, rid, k).catch(() => {});
      liveCondClear(tid, rid, k).catch(() => {});
    }
    // sonra yazım (düğüm başına tek multi-path update; çoğu karede boş → hiç yazılmaz)
    if (hasWrites(writes.livelaps)) liveLapsAppend(tid, rid, writes.livelaps).catch(() => {});
    if (hasWrites(writes.livesec)) liveSecAppend(tid, rid, writes.livesec).catch(() => {});
    if (hasWrites(writes.livecond)) liveCondAppend(tid, rid, writes.livecond).catch(() => {});
  }, [live, curRace, curTeamRef, canEditRef]);

  /* canlı yakıt öğrenici: kendi araç yakıtından litre/tur + depo → model önerisi
     (opt-in). Mantık saf modülde (fuelObs.js) — tüketim TUR SINIRINDA mandallanan
     yakıttan ölçülür; eskiden kare kare ölçülüp filtreye takıldığı için hiç örnek
     toplanamıyordu. */
  useEffect(() => {
    const own = live?.own;
    if (!own || typeof own.fuel !== "number") return;
    const obs = fuelObserve(fuelObsRef.current, own, stRef.current?.fuelRatio);
    /* Eşitlik guard'ı (v1.8.0): öneri çoğu karede değişmez — 5 skaler alan
       aynıysa önceki referans korunur, App'e frame-başı ekstra render binmez. */
    setLiveFuelObs((prev) => {
      if (prev === obs) return prev;
      if (!prev || !obs) return obs;
      return (prev.litersPerLap === obs.litersPerLap && prev.samples === obs.samples
        && prev.fuelCap === obs.fuelCap && prev.obsRatio === obs.obsRatio
        && prev.obsCons === obs.obsCons) ? prev : obs;
    });
  }, [live, stRef]);

  return { live, liveFuelObs, lapCapture };
}
