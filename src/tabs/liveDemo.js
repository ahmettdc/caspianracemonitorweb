/* Arayüz-içi DEMO üreteci — bridge/rf2_source.py MockSource'un JS portu.
   Oyun/köprü yokken canlı timing ekranını temsili çok-sınıflı bir dayanıklılık
   yarışıyla doldurur (görsel geliştirme için). Şema rf2_source.py:10-34 ile birebir.
   Firebase'e DOKUNMAZ — yalnız yerel render için LiveTab kullanır.
   demoFrame(el) → {session, own, field}; el = geçen süre (sn). */

const NAMES = ["A. Demircan", "M. Yılmaz", "E. Kaya", "S. Öztürk", "C. Aydın",
  "B. Şahin", "K. Arslan", "T. Doğan", "R. Koç", "H. Çelik",
  "N. Aksoy", "F. Polat", "L. Ünal", "V. Taş", "D. Ergün"];
const CLASSES = ["Hypercar", "LMGT3"];
const VEH_HY = ["Toyota GR010 Hybrid", "Ferrari 499P", "Porsche 963"];
const VEH_GT = ["BMW M4 GT3", "Mercedes-AMG GT3", "Ferrari 296 GT3",
  "Porsche 911 GT3 R", "McLaren 720S GT3", "Corvette Z06 GT3.R",
  "Lexus RC F GT3", "Ford Mustang GT3", "Aston Martin Vantage GT3",
  "Lamborghini Huracan GT3", "McLaren 720S GT3", "Ferrari 296 GT3"];
const TEAMS = ["Caspian Motorsport", "Iron Lynx", "Team WRT", "Vista AF Corsa",
  "Manthey", "TF Sport", "Akkodis ASP", "Garage 59", "Proton",
  "Heart of Racing", "The Bend", "Iron Dames", "AO Racing", "Ginetta"];
const TRACK_LEN = 4000.0;
const MANUF = ["Mercedes-AMG", "Aston Martin", "BMW", "Ferrari", "Porsche",
  "McLaren", "Corvette", "Lexus", "Ford", "Lamborghini", "Toyota"];

const r3 = (v) => Math.round(v * 1000) / 1000;
const r1 = (v) => Math.round(v * 10) / 10;

/* tur oranı (0..1) → kıvrımlı kapalı devre dünya (x, z) */
function trackXY(frac) {
  const a = 2 * Math.PI * frac;
  return [r1(700 * Math.sin(a) + 250 * Math.sin(2 * a)),
    r1(500 * Math.cos(a) + 180 * Math.cos(3 * a))];
}
function manuf(veh) {
  const low = veh.toLowerCase();
  for (const m of MANUF) if (low.includes(m.split(" ")[0].toLowerCase())) return m;
  return "";
}

/* Seans bayrağı/fazı — her durumu sırayla göster (bant önizlemesi için):
   ~70s Yeşil → 10s Sarı → 10s FCY → 10s Kırmızı (Durduruldu), döngü. */
function sessionFlag(el) {
  const slot = Math.floor(el / 10) % 10;
  if (slot === 7) return { phase: "Yeşil", flag: "Yellow" };
  if (slot === 8) return { phase: "Yeşil", flag: "FCY" };
  if (slot === 9) return { phase: "Durduruldu", flag: "Yellow" };
  return { phase: "Yeşil", flag: "Green" };
}

export function demoFrame(el, cars = 14) {
  const n = Math.min(cars, NAMES.length);
  const rows = [];
  for (let i = 0; i < n; i++) {
    const base = 88.0 + i * 0.35 + ((i * 0.37) % 1);      // sabit tempo (deterministik)
    const lapT = base + Math.sin(el / 30 + i) * 0.4;
    const laps = Math.floor(el / lapT);
    const frac = (el % lapT) / lapT;
    const [px, pz] = trackXY(frac);
    const veh = i < 3 ? VEH_HY[i] : VEH_GT[(i - 3) % VEH_GT.length];
    const wear = r3(Math.max(0.15, 1 - ((el % 1500) / 1500) * 0.7 - i * 0.01));
    rows.push({
      pos: 0, driver: NAMES[i], team: TEAMS[i % TEAMS.length],
      vehicleName: veh, manufacturer: manuf(veh), number: 10 + i,
      carClass: i < 3 ? CLASSES[0] : CLASSES[1],
      lapsDone: laps, lastSec: r3(lapT), bestSec: r3(base),
      avg5Sec: r3(lapT + 0.3), avgSec: r3(lapT + 0.6), stintSec: Math.floor(el % 1500),
      _dist: laps * TRACK_LEN + frac * TRACK_LEN,   // toplam yarış mesafesi (sıralama/gap)
      inPits: (Math.floor(el / 90) % 11) === i, isPlayer: i === 4,
      pitStops: Math.floor(laps / 45),
      tyreWear: wear,
      damage: r3(Math.min(0.4, i * 0.01 + (el % 600) / 6000)),
      lapDist: r1(frac * TRACK_LEN), posX: px, posZ: pz,
      virtualEnergy: r1(Math.max(3.0, 100 - (((el + i * 40) % 1500) / 1500) * 92)),
    });
  }
  rows.sort((a, b) => b._dist - a._dist);
  const leadDist = rows[0]._dist;
  let prevDist = leadDist;
  rows.forEach((r, p) => {
    r.pos = p + 1;
    const speed = TRACK_LEN / r.lastSec;                 // m/s (araç pace)
    r.gapSec = p === 0 ? 0.0 : r1((leadDist - r._dist) / speed);
    r.intervalSec = p === 0 ? 0.0 : r1((prevDist - r._dist) / speed);
    r.location = r.inPits ? "PIT" : "TRACK";
    prevDist = r._dist;   // sil'meden önce yakala (bir sonraki satırın aralığı için)
    delete r._dist;
  });
  const me = rows.find((r) => r.isPlayer);
  const stint = el % 1500;
  const comp = ["Medium", "Hard", "Soft"][Math.floor(el / 1500) % 3];
  const tyre = () => ({
    wear: r3(Math.max(0.2, 1 - (stint / 1500) * 0.7)),
    tempC: Math.round(82 + Math.sin(el / 12) * 8 + 4),
    pressKpa: Math.round(165 + Math.sin(el / 20) * 4 + 4),
  });
  const sf = sessionFlag(el);
  return {
    session: {
      phase: sf.phase, flag: sf.flag,
      timeLeftSec: Math.max(0, Math.floor(6 * 3600 - el)), totalLaps: 0,
      trackTemp: r1(30 + Math.sin(el / 300) * 4),
      ambientTemp: r1(22 + Math.sin(el / 400) * 2),
      raining: (Math.floor(el / 200) % 5) === 4,
      trackLength: TRACK_LEN, sessionType: "Antrenman",
    },
    own: {
      fuel: r1(Math.max(2, 78 - (stint / 1500) * 70)), fuelCapacity: 78.0,
      virtualEnergy: me.virtualEnergy, team: me.team, vehicleName: me.vehicleName,
      manufacturer: me.manufacturer, number: me.number, position: me.pos,
      lastLapSec: me.lastSec, bestLapSec: me.bestSec,
      curLapSec: r1(stint % me.lastSec), s1: r3(me.lastSec * 0.32), s2: r3(me.lastSec * 0.35),
      lapsDone: me.lapsDone, inPits: me.inPits, pitStops: me.pitStops,
      location: me.location, damage: me.damage,
      avg5Sec: me.avg5Sec, avgSec: me.avgSec, stintSec: me.stintSec,
      tyreCompound: { front: comp, rear: comp },
      tyres: { fl: tyre(), fr: tyre(), rl: tyre(), rr: tyre() },
    },
    field: rows,
  };
}
