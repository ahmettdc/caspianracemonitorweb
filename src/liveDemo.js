/* Canlı Timing DEMO üreteci — yerel sahte veri (oyun/köprü/Firebase GEREKMEZ).
   LiveTab'in "🎬 Demo" düğmesiyle açılınca arayüzü doldurmak için kullanılır:
   tablo, VE, sektör, marka logoları, trackmap, kendi araç, strateji. Firebase'e
   yazılmaz (yalnız o ekranda). Python bridge/MockSource'un JS karşılığı — şema aynı.
   Pozisyon grafiği + "+" tur popup'ı demo'da boş kalır (onlar Firebase düğümü okur). */

const NAMES = ["A. Demircan", "M. Yılmaz", "E. Kaya", "S. Öztürk", "C. Aydın",
  "B. Şahin", "K. Arslan", "T. Doğan", "R. Koç", "H. Çelik",
  "N. Aksoy", "F. Polat", "L. Ünal", "V. Taş"];
const VEH_HY = ["Toyota GR010 Hybrid", "Ferrari 499P", "Porsche 963"];
const VEH_GT = ["BMW M4 GT3", "Mercedes-AMG GT3", "Ferrari 296 GT3",
  "Porsche 911 GT3 R", "McLaren 720S GT3", "Corvette Z06 GT3.R",
  "Lexus RC F GT3", "Ford Mustang GT3", "Aston Martin Vantage GT3",
  "Lamborghini Huracan GT3", "BMW M4 GT3"];
const TEAMS = ["Caspian Motorsport", "Iron Lynx", "Team WRT", "Vista AF Corsa",
  "Manthey", "TF Sport", "Akkodis ASP", "Garage 59", "Proton",
  "Heart of Racing", "The Bend", "Iron Dames", "AO Racing", "Ginetta"];
const TRACK_LEN = 4000;
const PLAYER = 4;   // oyuncu index'i (kendi araç)

const manufOf = (veh) => {
  for (const m of ["Mercedes-AMG", "Aston Martin", "BMW", "Ferrari", "Porsche",
    "McLaren", "Corvette", "Lexus", "Ford", "Lamborghini", "Toyota"]) {
    if (veh.toLowerCase().includes(m.split(" ")[0].toLowerCase())) return m;
  }
  return "";
};
const trackXY = (frac) => {
  const a = 2 * Math.PI * frac;
  return [700 * Math.sin(a) + 250 * Math.sin(2 * a),
    500 * Math.cos(a) + 180 * Math.cos(3 * a)];
};

/* elapsedSec: demo açıldığından beri geçen saniye → animasyon (pozisyon, VE, stint). */
export function demoLive(el) {
  const n = NAMES.length;
  const rows = [];
  /* Demo lastikleri: köşe köşe aşınma + bileşim + son pit'te ne değiştiği.
     Tek numaralı araçlar yalnız ÖN lastik değiştirmiş sayılır → "🛠 2" rozeti
     demoda da görünür (gerçek tespit köprüde yapılır, burası yalnız gösterim). */
  const demoTyres = (t, i) => {
    const sincePit = ((Math.floor(t / 90) - i + 130) % 13) * 90 + (t % 90);
    const fr = +Math.max(0.2, 1 - sincePit / 1400).toFixed(3);
    const rr = i % 2 === 0 ? fr : +Math.max(0.2, 1 - (t % 2600) / 2600).toFixed(3);
    const t4 = [fr, +Math.max(0.2, fr - 0.01).toFixed(3), rr,
      +Math.max(0.2, rr - 0.02).toFixed(3)];
    // farklı hamur örnekleri: bazı araçlar Soft/Hard, biri ön/arka crossover
    const comp = i === 3 && t > 600 ? "Wet"
      : i === 1 ? "Soft" : i === 2 ? "Hard"
        : i === 5 ? "Medium/Soft"         // ön Medium · arka Soft (crossover → iki ikon)
          : "Medium";
    return {
      tyres4: t4, tyreWear: Math.min(...t4), tyreComp: comp, teleLag: 0,
      tyreChange: i % 2 === 0
        ? { n: 4, corners: ["fl", "fr", "rl", "rr"], comp: null }
        : { n: 2, corners: ["fl", "fr"], comp: i === 3 ? "Wet" : null },
    };
  };
  for (let i = 0; i < n; i++) {
    const lapT = 88 + i * 0.35 + Math.sin(el / 30 + i) * 0.4;
    const laps = Math.floor(el / lapT) + 40;                 // biraz ilerlemiş yarış
    const frac = (el % lapT) / lapT;
    const [px, pz] = trackXY(frac);
    const veh = i < 3 ? VEH_HY[i] : VEH_GT[(i - 3) % VEH_GT.length];
    const last = lapT + Math.sin(el / 7 + i) * 0.3;
    rows.push({
      lapKey: `demo${i}`,   // "+" tur geçmişi butonu demoda da görünsün
      driver: NAMES[i], team: TEAMS[i % TEAMS.length],
      vehicleName: veh, manufacturer: manufOf(veh), number: 10 + i,
      carClass: i < 3 ? "Hypercar" : "LMGT3",
      lapsDone: laps, lastSec: +last.toFixed(3), bestSec: +(lapT - 0.5).toFixed(3),
      lastSectors: [+(last * 0.25).toFixed(3), +(last * 0.44).toFixed(3),
        +(last * 0.31).toFixed(3)],
      /* Kişisel en iyi sektörler (v2.3.0) — mor/yeşil renklendirme demoda da
         çalışsın diye en iyi turdan türetilir; anlık sektörlerdeki dalgalanma
         zaman zaman bunun altına iner → renk canlı canlı yanıp söner. */
      bestSectors: [+((lapT - 0.5) * 0.25).toFixed(3), +((lapT - 0.5) * 0.44).toFixed(3),
        +((lapT - 0.5) * 0.31).toFixed(3)],
      inPits: (Math.floor(el / 90) % 13) === i,
      pitStops: Math.floor(laps / 45),
      // penalties = ANLIK bekleyen ceza (servis edilince 0'a düşer),
      // penaltiesTotal = seans kümülatifi (köprüde yükselen kenar sayımı)
      penalties: (i === 2 || i === 6) && (Math.floor(el / 120) % 3) === 0 ? 1 : 0,
      penaltiesTotal: (i === 2 || i === 6) ? Math.floor(el / 360) + 1 : 0,
      ...demoTyres(el, i),
      damage: +Math.min(0.4, i * 0.01 + (el % 600) / 6000).toFixed(3),
      virtualEnergy: +Math.max(3, 100 - ((el + i * 40) % 1500 / 1500) * 92).toFixed(1),
      lapDist: +(frac * TRACK_LEN).toFixed(1), posX: +px.toFixed(1), posZ: +pz.toFixed(1),
      sector: frac < 0.40 ? 1 : frac < 0.73 ? 2 : 0,   // 0=S3,1=S1,2=S2 (eşit değil)
      /* relative ZAMAN yolu (v2.3.0). Demoda tur içi zamanı frac'tan DÜZ türetmek
         zaman yolunu mesafe yolunun kopyası yapardı ve fark hiç görünmezdi —
         gerçek pistte hız sabit değil. Hafif bir hız profili uygulanır (orta
         sektör yavaş), böylece demo iki yöntemin ayrıştığını gerçekten gösterir. */
      timeIntoLap: +(lapT * (frac + 0.06 * Math.sin(frac * Math.PI * 2))).toFixed(3),
      estLapTime: +lapT.toFixed(3),
      // ANLIK sektörler: bu turda geçilen S1/S2 (S1 çizgisi ~%40, S2 ~%73 sonrası)
      curSectors: (() => {
        const s1 = +(lapT * 0.25 + Math.sin(el + i) * 0.3).toFixed(1);
        const s2 = +(lapT * 0.44 + Math.cos(el + i) * 0.3).toFixed(1);
        return frac < 0.40 ? [null, null] : frac < 0.73 ? [s1, null] : [s1, s2];
      })(),
      isPlayer: i === PLAYER,
      _prog: laps * 1e6 + (el % lapT),
    });
  }
  rows.sort((a, b) => b._prog - a._prog);
  const lead = rows[0]._prog;
  rows.forEach((r, p) => {
    r.pos = p + 1;
    r.gapSec = p === 0 ? 0 : +((lead - r._prog) / 1e6 * r.lastSec).toFixed(1);
    r.intervalSec = p === 0 ? 0 : +(r.gapSec - rows[p - 1].gapSec).toFixed(1);
    /* tur-altı: yalnız fark bir TAM turu aşınca (oyunun mLapsBehind* karşılığı) */
    r.lapsBehind = p === 0 ? 0 : Math.floor(r.gapSec / Math.max(1, r.lastSec));
    r.lapsBehindNext = p === 0 ? 0
      : Math.floor(Math.max(0, r.intervalSec) / Math.max(1, r.lastSec));
    r.location = r.inPits ? "PIT" : "TRACK";
    r.avg5Sec = +(r.bestSec + 0.4).toFixed(3);
    r.avgSec = +(r.bestSec + 0.7).toFixed(3);
    r.stintSec = Math.floor(el % 1500);
    r.vePerLap = +(1.8 + (p % 4) * 0.25).toFixed(1);   // demo tur-başı VE tüketimi
    delete r._prog;
  });
  const me = rows.find((r) => r.isPlayer);
  const stint = el % 1500;
  return {
    ts: Date.now(),
    session: {
      phase: "Yeşil", sessionType: "Yarış",
      // döngü: çoğunlukla Green, ara sıra lokal sarı (S2) / FCY — bayrak KPI testi
      flag: Math.floor(el / 60) % 8 === 3 ? "Yellow"
        : Math.floor(el / 60) % 8 === 6 ? "FCY" : "Green",
      yellowSectors: Math.floor(el / 60) % 8 === 3 ? [2] : [],
      timeLeftSec: Math.max(0, 6 * 3600 - Math.floor(el)),
      trackTemp: +(30 + Math.sin(el / 300) * 4).toFixed(1),
      ambientTemp: +(22 + Math.sin(el / 400) * 2).toFixed(1),
      raining: false,
      rain: Math.max(0, Math.round(20 * Math.sin(el / 90))),
      wetness: Math.max(0, Math.min(100, Math.round(30 + 25 * Math.sin(el / 120)))),
      trackName: "Demo Circuit", trackLength: TRACK_LEN,
    },
    own: {
      fuel: +Math.max(2, 78 - (stint / 1500) * 70).toFixed(1), fuelCapacity: 78,
      virtualEnergy: me.virtualEnergy, team: me.team,
      manufacturer: "Porsche", number: me.number, vehicleName: "911GT3R",
      /* v2.3.0: gerçek köprü artık own'a driver/carClass da kopyalıyor
         (Aggregator, oyuncunun field satırından) — demo da onu yansıtmalı,
         yoksa "Kendi Araç" kartı demoda gerçek davranışı göstermez. */
      driver: me.driver, carClass: me.carClass,
      position: me.pos, lastLapSec: me.lastSec, bestLapSec: me.bestSec,
      curLapSec: +(stint % me.lastSec).toFixed(1),
      s1: +(me.lastSec * 0.32).toFixed(3), s2: +(me.lastSec * 0.35).toFixed(3),
      s3: +(me.lastSec * 0.33).toFixed(3),
      lapsDone: me.lapsDone, inPits: me.inPits, pitStops: me.pitStops,
      location: me.location, damage: me.damage, stintSec: Math.floor(stint),
      avg5Sec: me.avg5Sec, avgSec: me.avgSec,
      // sürüş panosu (animasyonlu): gaz/fren dönüşümlü, hız/rpm sinüs
      throttle: +Math.max(0, Math.sin(el * 1.3) * 0.5 + 0.5).toFixed(3),
      brake: +Math.max(0, -Math.sin(el * 1.3) * 0.6).toFixed(3),
      gear: 1 + Math.floor((el % 12) / 2),
      speedKph: Math.round(180 + Math.sin(el / 6) * 90),
      rpm: Math.round(6000 + Math.sin(el * 1.3) * 2500), rpmMax: 9000,
      tyreCompound: { front: "Medium", rear: "Medium" },
      tyres: Object.fromEntries(["fl", "fr", "rl", "rr"].map((c, j) => [c, {
        wear: +Math.max(0.2, 1 - (stint / 1500) * 0.7 - j * 0.03).toFixed(3),
        tempC: Math.round(82 + Math.sin(el / 10 + j) * 8),
        pressKpa: Math.round(168 + Math.sin(el / 13 + j) * 4),
      }])),
    },
    field: rows,
  };
}
