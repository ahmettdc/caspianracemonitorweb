import { describe, it, expect } from "vitest";
import {
  SETUP_MAX_BYTES, SETUP_LIMITS, fileTooBig, filterSetups,
  poolEmptyReason, trimSetupMeta, staleTrackFilter, fastestSetupIds,
  searchSetups, sortSetups, lapDeltas, b64Sha256Hex,
} from "./setupPool";

const pool = [
  { id: "a", track: "spa", cond: "dry", sess: "R" },
  { id: "b", track: "spa", cond: "wet", sess: "Q" },
  { id: "c", track: "monza", cond: "dry", sess: "Q" },
];

describe("fileTooBig", () => {
  it("sınırın altı/üstü", () => {
    expect(fileTooBig(SETUP_MAX_BYTES - 1)).toBe(false);
    expect(fileTooBig(SETUP_MAX_BYTES)).toBe(false);      // tam sınır kabul
    expect(fileTooBig(SETUP_MAX_BYTES + 1)).toBe(true);
  });
  it("tipik setup dosyası (birkaç KB) geçer, 1 MB geçmez", () => {
    expect(fileTooBig(8 * 1024)).toBe(false);
    expect(fileTooBig(1024 * 1024)).toBe(true);
  });
});

describe("filterSetups", () => {
  it("süzgeç yoksa hepsi", () => {
    expect(filterSetups(pool, {})).toHaveLength(3);
    expect(filterSetups(pool)).toHaveLength(3);
  });
  it("tek süzgeç", () => {
    expect(filterSetups(pool, { track: "spa" }).map((x) => x.id)).toEqual(["a", "b"]);
    expect(filterSetups(pool, { cond: "wet" }).map((x) => x.id)).toEqual(["b"]);
    expect(filterSetups(pool, { sess: "Q" }).map((x) => x.id)).toEqual(["b", "c"]);
  });
  it("kombinasyon (AND)", () => {
    expect(filterSetups(pool, { track: "spa", sess: "Q" }).map((x) => x.id)).toEqual(["b"]);
    expect(filterSetups(pool, { track: "monza", cond: "wet" })).toHaveLength(0);
  });
  it("bozuk girdi patlamaz", () => {
    expect(filterSetups(null, { track: "spa" })).toEqual([]);
    expect(filterSetups(undefined)).toEqual([]);
  });
});

describe("poolEmptyReason", () => {
  it("havuz gerçekten boş → none", () => {
    expect(poolEmptyReason(0, 0)).toBe("none");
  });
  it("havuz dolu ama süzgeç eledi → filtered (REGRESYON: eskiden 'henüz setup yok' deniyordu)", () => {
    expect(poolEmptyReason(50, 0)).toBe("filtered");
    expect(poolEmptyReason(1, 0)).toBe("filtered");
  });
  it("liste doluysa mesaj yok", () => {
    expect(poolEmptyReason(50, 3)).toBeNull();
    expect(poolEmptyReason(1, 1)).toBeNull();
  });
});

describe("trimSetupMeta", () => {
  it("champ/ver/note sözleşme uzunluklarına kırpılır", () => {
    const out = trimSetupMeta({
      track: "spa",
      champ: "x".repeat(80), ver: "v".repeat(40), note: "n".repeat(300),
    });
    expect(out.champ).toHaveLength(SETUP_LIMITS.champ);
    expect(out.ver).toHaveLength(SETUP_LIMITS.ver);
    expect(out.note).toHaveLength(SETUP_LIMITS.note);
  });
  it("baştaki/sondaki boşluk temizlenir, diğer alanlar korunur", () => {
    const out = trimSetupMeta({ track: "spa", cls: "gt3", car: "bmw",
      champ: "  ELMS  ", ver: " V1.2 ", note: "  düşük kanat " });
    expect(out.champ).toBe("ELMS");
    expect(out.ver).toBe("V1.2");
    expect(out.note).toBe("düşük kanat");
    expect(out.track).toBe("spa");
    expect(out.cls).toBe("gt3");
    expect(out.car).toBe("bmw");
  });
  it("eksik alanlar boş dizeye düşer (undefined yazılmaz)", () => {
    const out = trimSetupMeta({ track: "spa" });
    expect(out.champ).toBe("");
    expect(out.ver).toBe("");
    expect(out.note).toBe("");
    expect(out.lap).toBe("");
  });
  it("lap alanı da kırpılır/trim'lenir", () => {
    expect(trimSetupMeta({ lap: "  1:58.234  " }).lap).toBe("1:58.234");
    expect(trimSetupMeta({ lap: "x".repeat(30) }).lap).toHaveLength(SETUP_LIMITS.lap);
  });
});

describe("fastestSetupIds", () => {
  it("aynı pist+sınıfta en düşük tur zamanının id'sini döndürür", () => {
    const rows = [
      { id: "a", track: "spa", cls: "gt3", lap: "2:20.000" },
      { id: "b", track: "spa", cls: "gt3", lap: "2:18.500" },  // en hızlı
      { id: "c", track: "spa", cls: "gt3", lap: "2:19.100" },
    ];
    const f = fastestSetupIds(rows);
    expect(f.has("b")).toBe(true);
    expect(f.has("a")).toBe(false);
    expect(f.has("c")).toBe(false);
  });
  it("farklı pist/sınıf ayrı gruplanır (her grubun kendi en hızlısı)", () => {
    const rows = [
      { id: "spa-gt3", track: "spa", cls: "gt3", lap: "2:18.0" },
      { id: "monza-gt3", track: "monza", cls: "gt3", lap: "1:48.0" },
      { id: "spa-hy", track: "spa", cls: "hypercar", lap: "2:02.0" },
    ];
    const f = fastestSetupIds(rows);
    expect(f.has("spa-gt3")).toBe(true);
    expect(f.has("monza-gt3")).toBe(true);
    expect(f.has("spa-hy")).toBe(true);   // hepsi kendi grubunun tek/en hızlısı
  });
  it("beraberlikte hepsi işaretlenir", () => {
    const rows = [
      { id: "a", track: "spa", cls: "gt3", lap: "2:18.000" },
      { id: "b", track: "spa", cls: "gt3", lap: "2:18.00" },
    ];
    const f = fastestSetupIds(rows);
    expect(f.has("a")).toBe(true);
    expect(f.has("b")).toBe(true);
  });
  it("parse edilemeyen/boş lap atlanır; hiç lap yoksa boş küme", () => {
    const rows = [
      { id: "a", track: "spa", cls: "gt3", lap: "" },
      { id: "b", track: "spa", cls: "gt3" },
      { id: "c", track: "spa", cls: "gt3", lap: "hızlı!" },
    ];
    expect(fastestSetupIds(rows).size).toBe(0);
    expect(fastestSetupIds([]).size).toBe(0);
    expect(fastestSetupIds(null).size).toBe(0);
  });
});

describe("lapDeltas", () => {
  it("grubun en hızlısı fastest, diğerlerinde en hızlıya fark (delta)", () => {
    const rows = [
      { id: "a", track: "spa", cls: "gt3", lap: "2:20.000" },
      { id: "b", track: "spa", cls: "gt3", lap: "2:18.500" },  // en hızlı
      { id: "c", track: "spa", cls: "gt3", lap: "2:19.100" },
    ];
    const d = lapDeltas(rows);
    expect(d.get("b").fastest).toBe(true);
    expect(d.get("b").delta).toBe(0);
    expect(d.get("a").fastest).toBe(false);
    expect(d.get("a").delta).toBeCloseTo(1.5, 3);
    expect(d.get("c").delta).toBeCloseTo(0.6, 3);
  });
  it("tek kayıtlı grupta fastest=true, delta=0", () => {
    const d = lapDeltas([{ id: "x", track: "spa", cls: "gt3", lap: "2:18.0" }]);
    expect(d.get("x")).toEqual({ fastest: true, delta: 0 });
  });
  it("farklı pist/sınıf ayrı gruplanır (delta kendi grubuna göre)", () => {
    const rows = [
      { id: "s1", track: "spa", cls: "gt3", lap: "2:18.0" },
      { id: "s2", track: "spa", cls: "gt3", lap: "2:19.0" },
      { id: "m1", track: "monza", cls: "gt3", lap: "1:48.0" },
    ];
    const d = lapDeltas(rows);
    expect(d.get("s2").delta).toBeCloseTo(1.0, 3);
    expect(d.get("m1").fastest).toBe(true);   // kendi grubunun tek aracı
  });
  it("geçersiz/boş lap map'e girmez; bozuk girdi patlamaz", () => {
    const d = lapDeltas([
      { id: "a", track: "spa", cls: "gt3", lap: "2:18.0" },
      { id: "b", track: "spa", cls: "gt3", lap: "" },
      { id: "c", track: "spa", cls: "gt3", lap: "hızlı!" },
    ]);
    expect(d.has("a")).toBe(true);
    expect(d.has("b")).toBe(false);
    expect(d.has("c")).toBe(false);
    expect(lapDeltas(null).size).toBe(0);
    expect(lapDeltas([]).size).toBe(0);
  });
  it("fastestSetupIds lapDeltas ile tutarlı (tek kaynak)", () => {
    const rows = [
      { id: "a", track: "spa", cls: "gt3", lap: "2:20.0" },
      { id: "b", track: "spa", cls: "gt3", lap: "2:18.5" },
    ];
    const d = lapDeltas(rows);
    const f = fastestSetupIds(rows);
    for (const [id, v] of d) expect(f.has(id)).toBe(v.fastest);
  });
});

describe("staleTrackFilter", () => {
  it("seçili pist havuzda yoksa true (hayalet süzgeç)", () => {
    expect(staleTrackFilter(pool, "lemans")).toBe(true);
  });
  it("seçili pist havuzda varsa false", () => {
    expect(staleTrackFilter(pool, "spa")).toBe(false);
    expect(staleTrackFilter(pool, "monza")).toBe(false);
  });
  it("süzgeç boşsa asla bayat değil", () => {
    expect(staleTrackFilter(pool, "")).toBe(false);
    expect(staleTrackFilter([], "")).toBe(false);
  });
  it("bozuk girdi patlamaz", () => {
    expect(staleTrackFilter(null, "spa")).toBe(true);
  });
});

describe("searchSetups", () => {
  const rows = [
    { id: "a", name: "spa_low_wing.svm", note: "düşük kanat", champ: "ELMS", uname: "Ahmet", team: "Caspian" },
    { id: "b", name: "monza.svm", note: "", champ: "Official", uname: "Savaş", team: "Caspian" },
  ];
  it("boş sorgu hepsi", () => {
    expect(searchSetups(rows, "")).toHaveLength(2);
    expect(searchSetups(rows, null)).toHaveLength(2);
  });
  it("dosya adı / not / şampiyona / yükleyen / takım üzerinde arar (küçük-harf)", () => {
    expect(searchSetups(rows, "WING").map((r) => r.id)).toEqual(["a"]);
    expect(searchSetups(rows, "kanat").map((r) => r.id)).toEqual(["a"]);
    expect(searchSetups(rows, "official").map((r) => r.id)).toEqual(["b"]);
    expect(searchSetups(rows, "savaş").map((r) => r.id)).toEqual(["b"]);
    expect(searchSetups(rows, "caspian")).toHaveLength(2);
    expect(searchSetups(rows, "yok-böyle")).toHaveLength(0);
  });
  it("bozuk girdi patlamaz", () => {
    expect(searchSetups(null, "x")).toEqual([]);
  });
});

describe("sortSetups", () => {
  const rows = [
    { id: "eski", at: 100, lap: "2:20.0" },
    { id: "yeni", at: 300, lap: "" },
    { id: "orta", at: 200, lap: "2:18.5" },
  ];
  it("date desc (varsayılan) — en yeni üstte", () => {
    expect(sortSetups(rows).map((r) => r.id)).toEqual(["yeni", "orta", "eski"]);
    expect(sortSetups(rows, "date", "asc").map((r) => r.id)).toEqual(["eski", "orta", "yeni"]);
  });
  it("lap asc — en hızlı üstte, boş/geçersiz lap HER YÖNDE sonda", () => {
    expect(sortSetups(rows, "lap", "asc").map((r) => r.id)).toEqual(["orta", "eski", "yeni"]);
    expect(sortSetups(rows, "lap", "desc").map((r) => r.id)).toEqual(["eski", "orta", "yeni"]);
  });
  it("girdi dizisi mutate edilmez", () => {
    const before = rows.map((r) => r.id);
    sortSetups(rows, "lap", "asc");
    expect(rows.map((r) => r.id)).toEqual(before);
  });
});

describe("b64Sha256Hex", () => {
  const b64 = (s) => Buffer.from(s, "utf-8").toString("base64");
  it("aynı içerik aynı hash, farklı içerik farklı hash", async () => {
    const h1 = await b64Sha256Hex(b64("[REARWING]\nRWSetting=2//8.3 deg"));
    const h2 = await b64Sha256Hex(b64("[REARWING]\nRWSetting=2//8.3 deg"));
    const h3 = await b64Sha256Hex(b64("[REARWING]\nRWSetting=1//6.9 deg"));
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);   // SHA-256 hex
  });
  it("boş/bozuk girdi → boş dize (dedupe sessiz düşer)", async () => {
    expect(await b64Sha256Hex("")).toBe("");
    expect(await b64Sha256Hex(null)).toBe("");
  });
});
