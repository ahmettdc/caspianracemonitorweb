import { describe, it, expect } from "vitest";
import { computePlan, DEFAULT_STATE, migrate } from "./engine";
import { num, parseLapSec, fmtLapMs, teamTime, compareTeams, rankTeams,
  stintWarnings, seedFromPlan, suggestedLaps, strategyOptions, trackDefaults,
  EMPTY_TEAM, REQUIRED_FIELDS } from "./stratComp";

/* Excel'deki (Caspian Motorsport Race Control v1.28) iki DOLU satır — modelin
   referans doğrulaması bu ikisiyle yapılır. Dosyadaki değerler birebir. */
const PESCARA = { name: "#4 PESCARA SRT", pits: 7, stints: 8, pitLane: 40,
  fuelFull: 40, fuelLast: 7, tyreTime: 12, tyreCount: 6, avgLap: "2:02.150",
  penalty: 0, damage: 0 };
const CASPIAN = { name: "#75 CASPIAN MOTORSPORT", pits: 6, stints: 7, pitLane: 40,
  fuelFull: 40, fuelLast: 40, tyreTime: 12, tyreCount: 6, avgLap: "2:02.500",
  penalty: 0, damage: 0 };
const LAPS = 174;   // STRATEGY COMP!A4

describe("num — eksik ile sıfırı ayırır", () => {
  it("boş/null/undefined/bozuk → null (0 DEĞİL)", () => {
    expect(num("")).toBe(null);
    expect(num(null)).toBe(null);
    expect(num(undefined)).toBe(null);
    expect(num("abc")).toBe(null);
    expect(num(NaN)).toBe(null);
    expect(num(Infinity)).toBe(null);
  });
  it("sıfır GEÇERLİ bir okumadır", () => {
    expect(num(0)).toBe(0);
    expect(num("0")).toBe(0);
  });
  it("virgüllü ondalık kabul edilir (TR klavye)", () => {
    expect(num("2,9")).toBeCloseTo(2.9, 9);
  });
});

describe("parseLapSec", () => {
  it("mm:ss.mmm → saniye", () => {
    expect(parseLapSec("2:02.150")).toBeCloseTo(122.15, 9);
    expect(parseLapSec("2:02,500")).toBeCloseTo(122.5, 9);
  });
  it("düz saniye de kabul", () => {
    expect(parseLapSec("122.5")).toBeCloseTo(122.5, 9);
    expect(parseLapSec(122.5)).toBeCloseTo(122.5, 9);
  });
  /* REGRESYON: engine.parseLap boş girdide 0 döner. Burada 0 dönmek, boş bir
     takımın "0 saniyelik tur atıyor" sayılmasına ve 174 turda −21.315 sn'lik
     uydurma bir avantaja yol açardı (Excel'in gerçek davranışı). */
  /* REGRESYON: engine.parseLap "2.02.500" (dakika.saniye.salise, MoTeC/Avrupa
     yazımı) biçimini uygulamanın HER YERİNDE kabul ediyor. Burada reddetmek
     satırı "ort. tur eksik" diye işaretliyor, kullanıcı yalnız BİÇİMİN yanlış
     olduğunu göremiyordu. */
  it("MoTeC/Avrupa yazımı 2.02.500 kabul edilir (engine.parseLap ile aynı)", () => {
    expect(parseLapSec("2.02.500")).toBeCloseTo(122.5, 9);
    expect(parseLapSec("3.59.50")).toBeCloseTo(239.5, 9);
    // iki noktalı ama orta grup 60+ → tur süresi değil, düz sayı okuması
    expect(parseLapSec("2.99.5")).toBe(null);
  });
  it("boş/bozuk → null, ASLA 0", () => {
    expect(parseLapSec("")).toBe(null);
    expect(parseLapSec("   ")).toBe(null);
    expect(parseLapSec(null)).toBe(null);
    expect(parseLapSec("abc")).toBe(null);
    expect(parseLapSec("x:y")).toBe(null);
  });
});

describe("fmtLapMs", () => {
  it("saniye → m:ss.mmm", () => {
    expect(fmtLapMs(122.15)).toBe("2:02.150");
    expect(fmtLapMs(122.5)).toBe("2:02.500");
    expect(fmtLapMs(59.999)).toBe("0:59.999");
  });
  it("geçersiz → boş", () => {
    expect(fmtLapMs(NaN)).toBe("");
    expect(fmtLapMs(null)).toBe("");
  });
});

describe("teamTime — Excel referansı", () => {
  it("#75 Caspian: sabit kayıp 552 sn (240 pit + 240 yakıt + 72 lastik)", () => {
    const r = teamTime(CASPIAN, LAPS);
    expect(r.ok).toBe(true);
    expect(r.pitLaneSec).toBe(240);      // STRATEGY COMP!I13 = 6 × 40
    expect(r.fuelSec).toBe(240);         // I14 = 40×5 + 40
    expect(r.tyreSec).toBe(72);          // I15 = 6 × 12
    expect(r.staticSec).toBe(552);       // I17
    expect(r.paceSec).toBeCloseTo(21315, 6);
    expect(r.totalSec).toBeCloseTo(21867, 6);
  });
  it("#4 Pescara: sabit kayıp 599 sn (280 pit + 247 yakıt + 72 lastik)", () => {
    const r = teamTime(PESCARA, LAPS);
    expect(r.pitLaneSec).toBe(280);      // B13 = 7 × 40
    expect(r.fuelSec).toBe(247);         // B14 = 40×6 + 7
    expect(r.tyreSec).toBe(72);          // B15
    expect(r.staticSec).toBe(599);
    expect(r.totalSec).toBeCloseTo(21853.1, 6);
  });
  it("ceza ve hasar doğrudan toplama girer", () => {
    const r = teamTime({ ...CASPIAN, penalty: 22, damage: 5 }, LAPS);
    expect(r.staticSec).toBe(552 + 27);
  });
  it("boş ceza/hasar 0 sayılır (yarış öncesi normal durum)", () => {
    const r = teamTime({ ...CASPIAN, penalty: "", damage: "" }, LAPS);
    expect(r.ok).toBe(true);
    expect(r.penaltySec).toBe(0);
    expect(r.staticSec).toBe(552);
  });
  it("duraksız strateji: yakıt terimi 0, negatif süre üretmez", () => {
    const r = teamTime({ ...CASPIAN, pits: 0, tyreCount: 0 }, LAPS);
    expect(r.fuelSec).toBe(0);
    expect(r.pitLaneSec).toBe(0);
    expect(r.staticSec).toBe(0);
  });
});

describe("teamTime — eksik veri hesaplanmaz (CLAUDE.md §1)", () => {
  /* REGRESYON — Excel'in en tehlikeli davranışı: kayıt defterindeki 25 takımın
     23'ü boştu; birini seçince XLOOKUP 0 döndürüyor, ortalama tur 0 sanılıyor
     ve TOTAL RESULT −21.867 sn (≈ −6 saat) çıkıp "avantaj" diye YEŞİLE
     boyanıyordu. Burada hiçbir sayı üretilmez. */
  it("tamamen boş takım → ok:false, tüm süreler null", () => {
    const r = teamTime({ name: "#8 GR SIMTRUST ESPORT" }, LAPS);
    expect(r.ok).toBe(false);
    expect(r.totalSec).toBe(null);
    expect(r.staticSec).toBe(null);
    expect(r.paceSec).toBe(null);
    expect(r.missing).toEqual(REQUIRED_FIELDS);
  });
  it("tek eksik alan da hesabı durdurur ve adıyla bildirilir", () => {
    const r = teamTime({ ...CASPIAN, avgLap: "" }, LAPS);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(["avgLap"]);
  });
  it("toplam tur girilmemişse tempo terimi kurulamaz", () => {
    expect(teamTime(CASPIAN, "").missing).toContain("raceLaps");
    expect(teamTime(CASPIAN, 0).missing).toContain("raceLaps");
  });
  it("negatif adet / sıfır tur süresi veri girişi hatasıdır", () => {
    expect(teamTime({ ...CASPIAN, pits: -1 }, LAPS).ok).toBe(false);
    expect(teamTime({ ...CASPIAN, tyreCount: -2 }, LAPS).ok).toBe(false);
    expect(teamTime({ ...CASPIAN, avgLap: "0:00.000" }, LAPS).ok).toBe(false);
  });
  it("EMPTY_TEAM sayısal alanları '' — 0 değil", () => {
    REQUIRED_FIELDS.forEach((k) => expect(EMPTY_TEAM[k]).toBe(""));
    expect(teamTime(EMPTY_TEAM, LAPS).ok).toBe(false);
  });
});

describe("stintWarnings — hesabı durdurmaz, girişi denetler", () => {
  it("stint = pit + 1 kuralı", () => {
    expect(stintWarnings({ pits: 6, stints: 7 })).toEqual([]);
    expect(stintWarnings({ pits: 6, stints: 6 })).toEqual(["stintMismatch"]);
  });
  it("lastik değişimi durak sayısını geçemez", () => {
    expect(stintWarnings({ pits: 6, tyreCount: 6 })).toEqual([]);
    expect(stintWarnings({ pits: 6, tyreCount: 7 })).toEqual(["tyreOverPits"]);
  });
  it("eksik alan uyarı üretmez (bilinmeyen ≠ hatalı)", () => {
    expect(stintWarnings({ pits: 6 })).toEqual([]);
    expect(stintWarnings({})).toEqual([]);
  });
  it("uyarı hesabı durdurmaz", () => {
    const r = teamTime({ ...CASPIAN, stints: 99 }, LAPS);
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual(["stintMismatch"]);
  });
});

describe("compareTeams — Excel'in D12/B16/D16/D17 hücreleri", () => {
  const c = compareTeams(PESCARA, CASPIAN, LAPS);
  it("D12 — tur başı tempo farkı −0.350 sn", () => {
    expect(c.lapDelta).toBeCloseTo(-0.35, 9);
  });
  it("B16 — 174 turda tempo farkı −60.9 sn", () => {
    expect(c.paceDelta).toBeCloseTo(-60.9, 6);
  });
  it("D16 STRATEGY RESULT — sabit kayıp farkı +47.0 sn", () => {
    expect(c.staticDelta).toBeCloseTo(47, 6);
  });
  it("D17 TOTAL RESULT — toplam fark −13.9 sn (Pescara önde)", () => {
    expect(c.totalDelta).toBeCloseTo(-13.9, 6);
    expect(c.leader).toBe("a");
  });
  it("breakEven: farkı kapatmak için tur başı gereken saniye", () => {
    expect(c.breakEvenLap).toBeCloseTo(13.9 / 174, 9);
  });

  /* Excel'in "ÖNEMLİ!" notunun işaret ettiği kaldıraç: son durakta yalnız
     bitirmeye yetecek yakıt alınır. Caspian satırında bu değer hâlâ tam
     servis (40 sn) girilmişti; 7 sn olsaydı sonuç işaret değiştirirdi. */
  it("son pit yakıtı 40→7 olunca üstünlük el değiştirir", () => {
    const c2 = compareTeams(PESCARA, { ...CASPIAN, fuelLast: 7 }, LAPS);
    expect(c2.b.staticSec).toBe(519);
    expect(c2.totalDelta).toBeCloseTo(19.1, 6);
    expect(c2.leader).toBe("b");
  });

  /* REGRESYON — Excel'de sağ panel sessizce "referans"tı (tempo terimi sabit 0
     yazılıydı), bu yüzden takımların yerini değiştirmek sonucu bozardı.
     Mutlak süre kurgusunda simetri garanti. */
  it("takımların yeri değişince sonuç yalnız işaret değiştirir", () => {
    const rev = compareTeams(CASPIAN, PESCARA, LAPS);
    expect(rev.totalDelta).toBeCloseTo(13.9, 6);
    expect(rev.staticDelta).toBeCloseTo(-47, 6);
    expect(rev.leader).toBe("b");   // Pescara hâlâ önde — artık "b" tarafında
    expect(rev.breakEvenLap).toBeCloseTo(c.breakEvenLap, 9);
  });

  it("eşitlik tie döner", () => {
    expect(compareTeams(CASPIAN, { ...CASPIAN }, LAPS).leader).toBe("tie");
  });

  it("taraflardan biri eksikse karşılaştırma yapılmaz", () => {
    const bad = compareTeams(PESCARA, { name: "#13 TEAM SHIBA" }, LAPS);
    expect(bad.ok).toBe(false);
    expect(bad.totalDelta).toBe(null);
    expect(bad.leader).toBe(null);
    expect(bad.a.ok).toBe(true);     // sağlam taraf yine de hesaplanmış döner
    expect(bad.b.ok).toBe(false);
  });
});

describe("rankTeams", () => {
  const teams = [CASPIAN, PESCARA, { name: "#13 TEAM SHIBA" }, { name: "" }];
  const r = rankTeams(teams, LAPS);
  it("verisi tam olanlar toplam süreye göre sıralanır", () => {
    expect(r.ranked.map((x) => x.team.name)).toEqual([PESCARA.name, CASPIAN.name]);
    expect(r.ranked[0].gapToLeader).toBe(0);
    expect(r.ranked[1].gapToLeader).toBeCloseTo(13.9, 6);
  });
  it("eksik veri sıralamaya SOKULMAZ, ayrı listede döner", () => {
    expect(r.incomplete.map((x) => x.team.name)).toEqual(["#13 TEAM SHIBA"]);
  });
  it("tamamen boş satır sayılmaz", () => {
    expect(r.ranked.length + r.incomplete.length).toBe(3);
  });
  /* REGRESYON: ad şartı koyulunca ADSIZ ama verisi TAM bir satır ne sıralamaya
     ne de "eksik veri" listesine giriyordu — sessizce kayboluyordu. Sekme onu
     zaten "Satır N" diye adlandırıyor. */
  it("adsız ama verisi TAM satır sıralamaya girer", () => {
    const { name: _drop, ...anon } = PESCARA;
    const rr = rankTeams([CASPIAN, anon], LAPS);
    expect(rr.ranked).toHaveLength(2);
    expect(rr.incomplete).toHaveLength(0);
  });
  it("adsız ve EKSİK satır 'sıralamaya girmeyen' listesinde görünür", () => {
    const rr = rankTeams([CASPIAN, { pits: 6 }], LAPS);
    expect(rr.incomplete).toHaveLength(1);
  });
  it("kaynak dizideki sıra (idx) korunur — düzenleme için gerekli", () => {
    expect(r.ranked.find((x) => x.team.name === CASPIAN.name).idx).toBe(0);
  });
  it("bozuk girdide çökmez", () => {
    expect(rankTeams(null, LAPS)).toEqual({ ranked: [], incomplete: [] });
  });
});

describe("seedFromPlan — planın GERÇEK toplamlarını yeniden üretir", () => {
  /* engine.computePlan'ın döndürdüğü satır şekli: stintSec · pitSec · tyreCount
     · repairSec · isLast. Değerler elle kuruldu ki beklenen sayı görünsün. */
  const st = { pitLaneTime: 20 };
  const plan = { invalid: false, totalLaps: 100, lapSec: 999 /* KASITLI yanlış */,
    rows: [
      // 3 durak + son stint. pitSec = 20 (yol) + yakıt + lastik + tamir
      { stintSec: 3000, lapsInStint: 25, pitSec: 20 + 40 + 12 + 0, tyreCount: 4, repairSec: 0 },
      { stintSec: 3000, lapsInStint: 25, pitSec: 20 + 40 + 5 + 0, tyreCount: 2, repairSec: 0 },
      { stintSec: 3000, lapsInStint: 25, pitSec: 20 + 10 + 0 + 6, tyreCount: 0, repairSec: 6 },
      { stintSec: 3000, lapsInStint: 25, pitSec: 0, tyreCount: 0, repairSec: 0, isLast: true },
    ] };
  const seed = seedFromPlan(st, plan, 5, 12);

  it("pit/stint sayısı: son stintin arkasında pit yoktur", () => {
    expect(seed.pits).toBe(3);
    expect(seed.stints).toBe(4);
  });

  /* REGRESYON — plan.lapSec yalnız yarış SONU havasının çarpanını taşır
     (engine: baseLap × endWx.lap). Kuru→ıslak bir planda bunu tüm yarışa
     uygulamak tempoyu şişiriyordu: ölçülen sapma 6 saatlik dry→xwet planda
     +1.606 sn (≈ 27 dk). Ortalama tur artık planın gerçek stint süresinden
     türetiliyor (v2.4.1'den beri SON stint hariç — aşağıdaki gerçek-plan
     bloğuna bak; bu fikstürde satırlar birebir tutarlı olduğu için iki
     türetme de aynı sayıyı verir). */
  it("ortalama tur planın GERÇEK stint toplamından gelir, lapSec'ten DEĞİL", () => {
    expect(seed.avgLap).toBe("2:00.000");        // 12000 sn / 100 tur
    expect(parseLapSec(seed.avgLap) * 100).toBeCloseTo(12000, 6);
  });

  /* REGRESYON — computePlan 1-2 lastikte TYRE_2_SEC (5), 3-4'te TYRE_4_SEC (12)
     kullanır; hepsine 12 yazmak 2 lastikli planda 84 sn yerine 35 sn'lik gerçek
     süreyi şişiriyordu. Lastik değişmeyen durak sayıma girmez. */
  it("lastik: kademe (5/12) ve DEĞİŞEN durak sayısı plandan", () => {
    expect(seed.tyreCount).toBe(2);              // 3. durakta lastik yok
    expect(seed.tyreTime).toBeCloseTo(8.5, 6);   // (12 + 5) / 2 ortalama
    expect(teamTime({ ...seed, avgLap: "2:00.000" }, 100).tyreSec).toBeCloseTo(17, 6);
  });

  /* REGRESYON — computePlan yakıtı durak başına ÖLÇEKLER ve pits[i].fuel
     kapalıysa hiç eklemez; her durağa tam servis yazmak şişiriyordu. */
  it("yakıt pit süresinden geri çıkarılır (tam servis + son pit ayrı)", () => {
    expect(seed.fuelLast).toBeCloseTo(10, 6);    // son durağın gerçek yakıtı
    expect(seed.fuelFull).toBeCloseTo(40, 6);    // (40 + 40) / 2
    expect(teamTime({ ...seed, avgLap: "2:00.000" }, 100).fuelSec).toBeCloseTo(90, 6);
  });

  it("plan tamir süresi HASAR alanına yazılır", () => {
    expect(seed.damage).toBeCloseTo(6, 6);
  });

  /* Sözleşmenin bütünü: tohumlanan satır planın kendi yarış süresini üretir. */
  it("satırın toplamı = planın stint + pit toplamı (birebir)", () => {
    const res = teamTime(seed, 100);
    const planTotal = plan.rows.reduce((a, r) => a + r.stintSec + r.pitSec, 0);
    expect(res.ok).toBe(true);
    expect(res.totalSec).toBeCloseTo(planTotal, 6);
  });

  it("geçersiz/boş plan → null (uydurma satır yok)", () => {
    expect(seedFromPlan(st, { ...plan, invalid: true }, 5, 12)).toBe(null);
    expect(seedFromPlan(st, { ...plan, rows: [] }, 5, 12)).toBe(null);
    expect(seedFromPlan(st, { ...plan, totalLaps: 0 }, 5, 12)).toBe(null);
    expect(seedFromPlan(st, null, 5, 12)).toBe(null);
  });

  it("pit yolu süresi bilinmiyorsa yakıt AYRIŞTIRILAMAZ — alan boş kalır", () => {
    const r = seedFromPlan({}, plan, 5, 12);
    expect(r.pitLane).toBe("");
    expect(r.fuelFull).toBe("");
    expect(r.fuelLast).toBe("");
    expect(teamTime(r, 100).ok).toBe(false);
  });

  it("bozuk girdide çökmez", () => {
    expect(seedFromPlan(null, plan, 5, 12).pits).toBe(3);
  });
});

describe("suggestedLaps", () => {
  it("plandan toplam tur önerir", () => {
    expect(suggestedLaps({ totalLaps: 173.6, invalid: false })).toBe(174);
  });
  it("geçersiz/eksik planda öneri YOK", () => {
    expect(suggestedLaps({ totalLaps: 174, invalid: true })).toBe(null);
    expect(suggestedLaps({ totalLaps: 0, invalid: false })).toBe(null);
    expect(suggestedLaps(null)).toBe(null);
  });
});

describe("strategyOptions — plan varyantları (A/B/C/D)", () => {
  const base = { strategies: { A: 8, B: 9, C: 10, D: 11 },
    raceTime: "2:24:00", avgLap: "2:02.500" };
  it("varyantları sırayla ve tur sayısıyla verir", () => {
    expect(strategyOptions(base).map((o) => `${o.key}:${o.laps}`))
      .toEqual(["A:8", "B:9", "C:10", "D:11"]);
    expect(strategyOptions(base).every((o) => o.ready)).toBe(true);
  });
  it("stint turu 0/boş olan varyant hazır DEĞİL", () => {
    const o = strategyOptions({ ...base, strategies: { A: 0, B: 9 } });
    expect(o.find((x) => x.key === "A").ready).toBe(false);
    expect(o.find((x) => x.key === "B").ready).toBe(true);
  });
  it("ortalama tur ya da yarış süresi geçersizse HİÇBİR varyant hazır değil", () => {
    expect(strategyOptions({ ...base, avgLap: "" }).some((o) => o.ready)).toBe(false);
    expect(strategyOptions({ ...base, raceTime: "" }).some((o) => o.ready)).toBe(false);
    // MIN_LAP_SEC altı "tur süresi" yazım hatasıdır (engine kuralı)
    expect(strategyOptions({ ...base, avgLap: "2.21" }).some((o) => o.ready)).toBe(false);
  });
  it("tur sayısı yazılmamış anahtar hiç listelenmez", () => {
    expect(strategyOptions({ ...base, strategies: { A: 8, B: "" } }).map((o) => o.key))
      .toEqual(["A"]);
  });
  it("bozuk girdide çökmez", () => {
    expect(strategyOptions(null)).toEqual([]);
    expect(strategyOptions({ strategies: "çöp" })).toEqual([]);
  });
});

describe("trackDefaults — pistten otomatik doldurma", () => {
  const PLT = { lemans: 31, spa: 21 };
  const LMU = { data: {
    lemans: { hypercar: { avgLap: "3:28.50" }, gt3: { avgLap: "3:55.10" } },
    spa: { gt3: { avgLap: "2:20.00" } },
  } };

  it("pit yolu ve ortalama tur GERÇEK kaynaklardan gelir", () => {
    expect(trackDefaults("lemans", "hypercar", LMU, PLT))
      .toEqual({ pitLane: 31, avgLap: "3:28.50" });
  });
  it("pit yolu sınıftan bağımsız (sınıf boşken de gelir)", () => {
    expect(trackDefaults("spa", "", LMU, PLT)).toEqual({ pitLane: 21, avgLap: null });
  });
  it("her alan BAĞIMSIZ null — pit yolu yoksa ort. tur yine gelir", () => {
    // monza PIT_LANE_TIMES'ta var ama LMU'da yok kurgusu:
    expect(trackDefaults("monza", "gt3", LMU, { monza: 28 }))
      .toEqual({ pitLane: 28, avgLap: null });
  });
  it("pist/sınıf LMU'da yoksa ort. tur null — uydurma yok", () => {
    expect(trackDefaults("lemans", "lmp2", LMU, PLT).avgLap).toBe(null);
    expect(trackDefaults("bilinmeyen", "gt3", LMU, PLT))
      .toEqual({ pitLane: null, avgLap: null });
  });
  it("bozuk avgLap metni (çözülemeyen) null döner", () => {
    const bad = { data: { x: { gt3: { avgLap: "çöp" } } } };
    expect(trackDefaults("x", "gt3", bad, {}).avgLap).toBe(null);
  });
  it("bozuk girdide çökmez", () => {
    expect(trackDefaults(null, null, null, null)).toEqual({ pitLane: null, avgLap: null });
    expect(trackDefaults("lemans", "gt3", {}, PLT)).toEqual({ pitLane: 31, avgLap: null });
  });
});

/* REGRESYON (v2.4.1) — BAYRAK TURU TUZAĞI.
   engine `walkByTime` son stintte bayrak turunu tur sayısına ekler
   (`addBayrak` → `L += 1`) ama o turun SÜRESİ `stintSec`'e girmez
   (`stintSec = startLeft`, bayrağa kalan süre). Dolayısıyla
   `Σ stintSec / totalLaps` bölümünün payı bir turluk süre EKSİK, paydası bir
   tur FAZLA → tohumlanan satırın "Ort. tur"u sistematik olarak HIZLI çıkıyordu.
   Toplam süre sözleşmesi korunduğu için hata ekranda görünmüyordu, ama
   kullanıcının elle girdiği rakip satırıyla karşılaştırma SAHTE avantaj
   üretiyordu. Ölçülen (v2.4.0): girilen 2:02.500 → yazılan 2:00.457,
   24 saatlik planda 3:29.000 → 3:25.907.
   Bu blok fikstür değil GERÇEK `computePlan` kullanır — tuzak yalnız orada
   doğuyor, elle kurulmuş satırlarda değil. */
describe("seedFromPlan — gerçek computePlan: ort. tur girdiyi birebir verir", () => {
  const cases = [
    ["6:00:00", "2:02.500", "D"],
    ["24:00:00", "3:29.000", "B"],
    ["2:24:00", "3:59.500", "C"],
    ["0:30:00", "2:00.000", "A"],
  ];
  for (const [raceLen, avgLap, strategy] of cases) {
    it(`${raceLen} · ${strategy} · ${avgLap}`, () => {
      const st = migrate({ ...DEFAULT_STATE, raceLen, avgLap, consumption: 8.97, strategy });
      const plan = computePlan(st);
      const seed = seedFromPlan(st, plan, 5, 12);
      expect(seed).not.toBe(null);
      /* Kuru planda (hava çarpanı 1) tohumlanan ort. tur girilen turun TA
         KENDİSİ olmalı — 1 ms tolerans yalnız fmtLapMs yuvarlaması için. */
      expect(parseLapSec(seed.avgLap)).toBeCloseTo(parseLapSec(avgLap), 2);
    });
  }

  it("son stint hariç türetme bayrak turunu paydaya sokmaz", () => {
    const st = migrate({ ...DEFAULT_STATE, raceLen: "6:00:00", avgLap: "2:02.500",
      consumption: 8.97, strategy: "D" });
    const plan = computePlan(st);
    const naive = plan.rows.reduce((a, r) => a + r.stintSec, 0) / plan.totalLaps;
    /* Naif bölüm HÂLÂ hızlı olmalı — yoksa bu test hatayı yakalamıyor demektir. */
    expect(naive).toBeLessThan(parseLapSec("2:02.500") - 0.05);
    expect(parseLapSec(seedFromPlan(st, plan, 5, 12).avgLap)).toBeGreaterThan(naive);
  });
});
