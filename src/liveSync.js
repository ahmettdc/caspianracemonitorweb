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
  /* YALNIZ gerçek yeşil FAZI'nda hizala. flag "Green" YETMEZ: köprü _flag_of yalnız
     FCY'yi ayırdığından Grid/Formasyon/GERİ SAYIM fazlarında da flag="Green" gelir;
     o sırada timeLeftSec yarış süresi değil geri sayım/formasyon süresidir (ör. 1:30)
     → hizalama yarışı "bitmiş" sanıp raceStartMs'i geçmişe atıyordu (kullanıcı bug'ı).
     Yeşil FAZI (mGamePhase 5 = ışıklar sönmüş, yarış saati işliyor) yetkili sinyaldir. */
  if (session.phase !== "Yeşil") return null;
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

/* Bu kare, PLANA YAZMAYI (oto-PIT / oto-saat) tetikleyecek kadar TAZE mi?

   NEDEN (v2.4.1): useLiveSync karenin YAŞINA hiç bakmıyordu. LiveTab'de
   "bağlantı koptu" koruması (connOf, 30 sn) var ama bu hook'ta yoktu. B
   yarışının live düğümünde köprünün GÜNLER ÖNCE bıraktığı son kare duruyorsa
   (araç garajda/pitte, sessionType "Yarış", by = benim e-postam) o kare tek
   başına sahte bir markPit() bastırabiliyor ve bayat timeLeftSec ile
   raceStartMs'i kaydırabiliyordu — tüm stint pencereleri kayardı.

   Eşik LiveTab'in "bağlantı koptu" eşiğiyle aynı (30 sn): yazan istemcinin
   kendi kareleri 2 Hz geldiği için bu sınır fazlasıyla geniş. */
export const LIVE_WRITE_MAX_AGE_MS = 30000;

export function isFrameFresh(ts, now, maxAgeMs = LIVE_WRITE_MAX_AGE_MS) {
  /* `Number(null) === 0` TUZAĞI (CLAUDE.md §1): null/"" sayıya çevrilince 0 olur
     ve 0 sonlu bir sayıdır. Eksik `now` böylece "1970" sayılıp her kareyi bayat,
     eksik `ts` ise sıfır yaşlı gösterebilirdi. Önce VARLIK denetlenir. */
  if (ts == null || now == null || ts === "" || now === "") return false;
  const t = Number(ts), n = Number(now);
  if (!Number.isFinite(t) || !Number.isFinite(n) || t <= 0 || n <= 0) return false;
  /* Gelecekten gelen kare (saat farkı) bayat değildir; negatif yaş kabul. */
  return n - t <= maxAgeMs;
}
