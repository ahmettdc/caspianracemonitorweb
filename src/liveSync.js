/* ============================================================
   STİNT ↔ CANLI TIMING SENKRONU — saf karar mantığı (React/Firebase bağımsız)
   ------------------------------------------------------------
   Stint bölümü canlı timing'den önce tasarlandı: pit işaretleme, yarış saati,
   hava ve ortalama tur ELLE giriliyordu. Köprü artık bunların gerçeğini taşıyor;
   buradaki fonksiyonlar "otomatik ne yapılmalı / ne önerilmeli" kararını verir.
   useLiveSync bağlar, liveSync.test.js doğrudan test eder.

   Çok-istemci güvenliği çağıran taraftadır: durum YAZAN otomasyonlar yalnız canlı
   kareyi yazan istemcide tetiklenir (live.by === user.email) — lease zaten tek
   yazıcı garanti eder; öneriler her editor'da gösterilebilir.
   ============================================================ */
import { parseHMS, parseLap, fmtLap, WEATHER, WX, wetnessLevel, rainLevel } from "./engine";

/* Araç PİT YOLUNA bu karede mi girdi? (✔ PIT butonunun elle yaptığı anın kendisi.)
   lapsDone > 0 şartı: seans başındaki garaj/grid konumu pit sanılmasın. */
export function detectPitEntry(prevOwn, own) {
  if (!own || !prevOwn) return false;
  if (!(own.lapsDone > 0)) return false;
  const inPit = (o) => !!o.inPits || o.location === "PIT";
  return inPit(own) && !inPit(prevOwn);
}

/* Plan saati ile OYUN saati arasındaki kayma (sn, + = plan geride kalmış yani
   planın "kalan"ı oyundan büyük). Yalnız YARIŞ seansında + yeşil bayrakta anlamlı;
   değilse null. Oyun `timeLeftSec`i otorite kabul edilir. */
export function clockDriftSec(st, session, now) {
  if (!session || session.sessionType !== "Yarış") return null;
  if (session.flag !== "Green" && session.phase !== "Yeşil") return null;
  if (!(session.timeLeftSec > 0)) return null;
  const raceSec = parseHMS(st.raceTime);
  const startMs = st.raceStartMs;
  if (!(raceSec > 0) || !Number.isFinite(startMs)) return null;
  const planLeft = (startMs + raceSec * 1000 - now) / 1000;
  if (planLeft <= 0) return null;                  // plana göre yarış bitti — dokunma
  return Math.round(planLeft - session.timeLeftSec);
}

/* Oyun saatine hizalı yeni raceStartMs: start = now − (geçen süre) */
export function alignedStartMs(st, session, now) {
  const raceSec = parseHMS(st.raceTime);
  return now - (raceSec - session.timeLeftSec) * 1000;
}

/* Canlı zemin ıslaklığından WEATHER kademesi türet; plandaki mevcut havadan
   FARKLIYSA öneri döner, aynıysa null. (Yazma yok — öneri çipi içindir.)
   Kademe ESASI ıslaklıktır: lastik kararını zeminin durumu belirler (yağmur diner
   ama pist ıslak kalır). Yağış yalnız çipte bilgi olarak gösterilir. Eşikler
   engine.wetnessLevel'da — canlı satır, plan ve öneri hep aynı ölçeği kullanır. */
export function weatherSuggestion(session, st) {
  if (!session) return null;
  const rain = Number(session.rain);
  const wet = Number(session.wetness);
  if (!Number.isFinite(rain) && !Number.isFinite(wet)) return null;
  const r = Number.isFinite(rain) ? rain : 0;
  const w = Number.isFinite(wet) ? wet : 0;
  const id = wetnessLevel(w);
  if (WEATHER[id] === WX(st)) return null;         // plan zaten bu kademede
  return { id, label: WEATHER[id].lbl, rain: Math.round(r), wetness: Math.round(w),
    rainLbl: rainLevel(r)?.lbl || "" };
}

/* Canlı AVG5 plandaki "Avg Lap"ten %1'den fazla sapıyorsa öneri (tek tık uygula). */
export function avgLapSuggestion(own, st) {
  const sec = own?.avg5Sec;
  if (!(sec > 0)) return null;
  const cur = parseLap(st.avgLap);
  if (cur > 0 && Math.abs(sec - cur) / cur <= 0.01) return null;
  return { sec, txt: fmtLap(sec) };
}
