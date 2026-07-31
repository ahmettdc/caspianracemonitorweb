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
  for (let i = 0; i < n; i++) {
    const lapT = 88 + i * 0.35 + Math.sin(el / 30 + i) * 0.4;
    const laps = Math.floor(el / lapT) + 40;                 // biraz ilerlemiş yarış
    const frac = (el % lapT) / lapT;
    const [px, pz] = trackXY(frac);
    const veh = i < 3 ? VEH_HY[i] : VEH_GT[(i - 3) % VEH_GT.length];
    const last = lapT + Math.sin(el / 7 + i) * 0.3;
    rows.push({
      driver: NAMES[i], team: TEAMS[i % TEAMS.length],
      vehicleName: veh, manufacturer: manufOf(veh), number: 10 + i,
      carClass: i < 3 ? "Hypercar" : "LMGT3",
      lapsDone: laps, lastSec: +last.toFixed(3), bestSec: +(lapT - 0.5).toFixed(3),
      lastSectors: [+(last * 0.25).toFixed(3), +(last * 0.44).toFixed(3),
        +(last * 0.31).toFixed(3)],
      inPits: (Math.floor(el / 90) % 13) === i,
      pitStops: Math.floor(laps / 45),
      tyreWear: +Math.max(0.15, 1 - (el % 1500 / 1500) * 0.7).toFixed(3),
      damage: +Math.min(0.4, i * 0.01 + (el % 600) / 6000).toFixed(3),
      virtualEnergy: +Math.max(3, 100 - ((el + i * 40) % 1500 / 1500) * 92).toFixed(1),
      lapDist: +(frac * TRACK_LEN).toFixed(1), posX: +px.toFixed(1), posZ: +pz.toFixed(1),
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
    r.location = r.inPits ? "PIT" : "TRACK";
    r.avg5Sec = +(r.bestSec + 0.4).toFixed(3);
    r.avgSec = +(r.bestSec + 0.7).toFixed(3);
    r.stintSec = Math.floor(el % 1500);
    delete r._prog;
  });
  const me = rows.find((r) => r.isPlayer);
  const stint = el % 1500;
  return {
    ts: Date.now(),
    session: {
      phase: "Yeşil", flag: "Green", sessionType: "Yarış",
      timeLeftSec: Math.max(0, 6 * 3600 - Math.floor(el)),
      trackTemp: +(30 + Math.sin(el / 300) * 4).toFixed(1),
      ambientTemp: +(22 + Math.sin(el / 400) * 2).toFixed(1),
      raining: false, trackLength: TRACK_LEN,
    },
    own: {
      fuel: +Math.max(2, 78 - (stint / 1500) * 70).toFixed(1), fuelCapacity: 78,
      virtualEnergy: me.virtualEnergy, team: me.team,
      manufacturer: "Porsche", number: me.number, vehicleName: "911GT3R",
      position: me.pos, lastLapSec: me.lastSec, bestLapSec: me.bestSec,
      curLapSec: +(stint % me.lastSec).toFixed(1),
      s1: +(me.lastSec * 0.32).toFixed(3), s2: +(me.lastSec * 0.67).toFixed(3),
      lapsDone: me.lapsDone, inPits: me.inPits, pitStops: me.pitStops,
      location: me.location, damage: me.damage, stintSec: Math.floor(stint),
      avg5Sec: me.avg5Sec, avgSec: me.avgSec,
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
