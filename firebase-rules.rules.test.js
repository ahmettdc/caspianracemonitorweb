import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, describe, it } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { ref, set, get, update } from "firebase/database";

/* Firebase RTDB güvenlik kuralı testleri (firebase-rules.json).
   Emülatör ister → `npm run test:rules`. Ön koşul verisi (users.allowed +
   takım üyeleri) kurallar KAPALIYKEN kurulur; asıl iddialar kimlikli bağlamlarla.

   Roller: alice=owner, bob=editor, carol=viewer (team1); dave=owner (team2, team1'de
   DEĞİL); mallory=allowed:false; admin=site admini. */
const PROJECT = "caspian-race-control";
let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT,
    database: { rules: readFileSync("firebase-rules.json", "utf8") },
  });
});

afterAll(async () => { if (testEnv) await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearDatabase();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.database();
    await set(ref(db, "users"), {
      alice: { allowed: true }, bob: { allowed: true }, carol: { allowed: true },
      dave: { allowed: true }, mallory: { allowed: false },
      admin: { allowed: true, admin: true },
    });
    await set(ref(db, "teams/team1"), {
      meta: { ownerUid: "alice" },
      members: { alice: "owner", bob: "editor", carol: "viewer" },
    });
    await set(ref(db, "teams/team2"), {
      meta: { ownerUid: "dave" },
      members: { dave: "owner" },
    });
  });
});

const db = (uid) => testEnv.authenticatedContext(uid).database();
const frame = (ts = 1000) => ({ ts, session: { phase: "Yeşil" }, field: [] });

describe("users", () => {
  it("kişi kendi kaydını okur, başkasınınkini okuyamaz", async () => {
    await assertSucceeds(get(ref(db("alice"), "users/alice")));
    await assertFails(get(ref(db("bob"), "users/alice")));
  });
  it("kişi kendi allowed/admin'ini yükseltemez (validate)", async () => {
    await assertFails(set(ref(db("bob"), "users/bob"), { allowed: true, admin: true }));
    await assertFails(set(ref(db("mallory"), "users/mallory"), { allowed: true }));
  });
  it("kişi profil alanlarını (allowed sabit kalarak) güncelleyebilir", async () => {
    await assertSucceeds(update(ref(db("bob"), "users/bob"), { allowed: true, name: "Bob" }));
  });
  it("admin başkasının allowed'ını değiştirebilir", async () => {
    await assertSucceeds(update(ref(db("admin"), "users/mallory"), { allowed: true }));
  });
});

describe("globalSetups", () => {
  it("onaylı kullanıcı kendi uid'iyle yükler; başkasının uid'iyle/onaysız yükleyemez", async () => {
    await assertSucceeds(
      set(ref(db("bob"), "globalSetups/s1"), { uid: "bob", data: "AAA", track: "spa" }));
    // başkasının uid'iyle yazma → validate reddeder
    await assertFails(set(ref(db("bob"), "globalSetups/s2"), { uid: "alice", data: "AAA" }));
    // allowed:false → hiç yazamaz
    await assertFails(set(ref(db("mallory"), "globalSetups/s3"), { uid: "mallory", data: "AAA" }));
  });
  it("silme YALNIZ admin — yükleyen bile silemez", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await set(ref(ctx.database(), "globalSetups/s1"), { uid: "bob", data: "AAA" });
    });
    await assertFails(set(ref(db("bob"), "globalSetups/s1"), null));     // yükleyen → red
    await assertFails(set(ref(db("carol"), "globalSetups/s1"), null));   // başka üye → red
    await assertSucceeds(set(ref(db("admin"), "globalSetups/s1"), null)); // admin → başarılı
  });
  it("v1.4.93 şema bölme: meta data'sız yazılabilir (data artık zorunlu değil)", async () => {
    await assertSucceeds(
      set(ref(db("bob"), "globalSetups/s4"), { uid: "bob", track: "spa", hasBlob: true }));
    // uid hâlâ auth.uid olmalı
    await assertFails(
      set(ref(db("bob"), "globalSetups/s5"), { uid: "alice", track: "spa", hasBlob: true }));
  });
});

describe("globalSetupData (v1.4.93 şema bölme — dosya gövdesi)", () => {
  it("onaylı kullanıcı kendi uid'iyle blob yazar; başkasının uid'i/onaysız reddedilir", async () => {
    await assertSucceeds(
      set(ref(db("bob"), "globalSetupData/s1"), { uid: "bob", data: "AAA" }));
    await assertFails(
      set(ref(db("bob"), "globalSetupData/s2"), { uid: "alice", data: "AAA" }));
    await assertFails(
      set(ref(db("mallory"), "globalSetupData/s3"), { uid: "mallory", data: "AAA" }));
  });
  it("takım üyesi olmayan onaylı kullanıcı da okur (havuz global)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await set(ref(ctx.database(), "globalSetupData/s1"), { uid: "bob", data: "AAA" });
    });
    await assertSucceeds(get(ref(db("dave"), "globalSetupData/s1")));   // dave başka takımda
  });
  it("silme YALNIZ admin", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await set(ref(ctx.database(), "globalSetupData/s1"), { uid: "bob", data: "AAA" });
    });
    await assertFails(set(ref(db("bob"), "globalSetupData/s1"), null));      // yükleyen → red
    await assertSucceeds(set(ref(db("admin"), "globalSetupData/s1"), null)); // admin → ok
  });
  it("260000+ karakter data reddedilir (validate)", async () => {
    await assertFails(
      set(ref(db("bob"), "globalSetupData/big"), { uid: "bob", data: "x".repeat(260001) }));
  });
});

describe("teams/live", () => {
  it("her takım üyesi (owner/editor/viewer) yazar; yabancı yazamaz", async () => {
    await assertSucceeds(set(ref(db("alice"), "teams/team1/live/race1"), frame()));
    await assertSucceeds(set(ref(db("bob"), "teams/team1/live/race1"), frame()));
    await assertSucceeds(set(ref(db("carol"), "teams/team1/live/race1"), frame())); // viewer artık yayınlayabilir
    await assertFails(set(ref(db("dave"), "teams/team1/live/race1"), frame()));      // başka takım → yazamaz
  });
  it("ts olmadan yazılamaz (validate)", async () => {
    // not: boş dizi RTDB'de null'a çöker → gerçek (ts'siz) içerik gönder
    await assertFails(set(ref(db("alice"), "teams/team1/live/race1"), { by: "alice", session: { phase: "Yeşil" } }));
  });
  it("takım üyesi okur; başka takımın üyesi OKUYAMAZ (çapraz izolasyon)", async () => {
    await assertSucceeds(get(ref(db("carol"), "teams/team1/live/race1")));
    await assertFails(get(ref(db("dave"), "teams/team1/live/race1")));
  });
  it("dave kendi takımına (team2) yazabilir — izolasyon çift yönlü", async () => {
    await assertSucceeds(set(ref(db("dave"), "teams/team2/live/race1"), frame()));
    await assertFails(set(ref(db("alice"), "teams/team2/live/race1"), frame()));
  });
});

describe("teams/livewriter (tek-yazıcı kirası)", () => {
  const lease = (uid, ts = 1000) => ({ uid, by: uid, driving: true, ts });
  it("owner/editor KENDİ uid'iyle kira alır", async () => {
    await assertSucceeds(set(ref(db("alice"), "teams/team1/livewriter/race1"), lease("alice")));
    await assertSucceeds(set(ref(db("bob"), "teams/team1/livewriter/race1"), lease("bob")));
  });
  it("başkasının uid'iyle kira yazılamaz (kimlik taklidi engeli)", async () => {
    await assertFails(set(ref(db("alice"), "teams/team1/livewriter/race1"), lease("bob")));
  });
  it("viewer KENDİ uid'iyle kira alır (co-sürücü yayın yapabilsin); yabancı alamaz", async () => {
    await assertSucceeds(set(ref(db("carol"), "teams/team1/livewriter/race1"), lease("carol")));
    await assertFails(set(ref(db("dave"), "teams/team1/livewriter/race1"), lease("dave")));
  });
  it("uid veya ts eksik/yanlış tipte → validate reddeder", async () => {
    await assertFails(set(ref(db("alice"), "teams/team1/livewriter/race1"), { ts: 1000 }));
    await assertFails(set(ref(db("alice"), "teams/team1/livewriter/race1"), { uid: "alice" }));
    await assertFails(set(ref(db("alice"), "teams/team1/livewriter/race1"), { uid: "alice", ts: "x" }));
  });
  it("kira serbest bırakılabilir (null)", async () => {
    await set(ref(db("alice"), "teams/team1/livewriter/race1"), lease("alice"));
    await assertSucceeds(set(ref(db("alice"), "teams/team1/livewriter/race1"), null));
  });
});

describe("teams/livelaps + livesec (tur geçmişi)", () => {
  it("editor sayı yazar; string reddedilir (validate)", async () => {
    await assertSucceeds(set(ref(db("bob"), "teams/team1/livelaps/race1/driver_1/5"), 92.3));
    await assertFails(set(ref(db("bob"), "teams/team1/livelaps/race1/driver_1/6"), "nope"));
  });
  it("livesec string yazar; uzun string reddedilir", async () => {
    await assertSucceeds(set(ref(db("bob"), "teams/team1/livesec/race1/driver_1/5"), "27.9,48.2,33.1"));
    await assertFails(set(ref(db("bob"), "teams/team1/livesec/race1/driver_1/6"), "x".repeat(50)));
  });
  it("viewer tur geçmişi yazar (yayın yapan co-sürücü); yabancı yazamaz", async () => {
    await assertSucceeds(set(ref(db("carol"), "teams/team1/livelaps/race1/driver_1/5"), 92.3));
    await assertFails(set(ref(db("dave"), "teams/team1/livelaps/race1/driver_1/5"), 92.3));
  });

  it("livedrv: editor pilot adı yazar, üye okur (endurance driver swap)", async () => {
    await assertSucceeds(set(ref(db("bob"), "teams/team1/livedrv/race1/c7/31"), "M. Yılmaz"));
    await assertSucceeds(get(ref(db("carol"), "teams/team1/livedrv/race1/c7")));
  });
  it("livedrv: string olmayan / 60+ karakter reddedilir", async () => {
    await assertFails(set(ref(db("bob"), "teams/team1/livedrv/race1/c7/32"), 5));
    await assertFails(set(ref(db("bob"), "teams/team1/livedrv/race1/c7/33"), "x".repeat(60)));
  });
  it("livedrv: viewer yazar; yabancı yazamaz", async () => {
    await assertSucceeds(set(ref(db("carol"), "teams/team1/livedrv/race1/c7/31"), "M. Yılmaz"));
    await assertFails(set(ref(db("dave"), "teams/team1/livedrv/race1/c7/31"), "M. Yılmaz"));
  });

  it("livetyre: editor pit lastik değişimi yazar, üye okur", async () => {
    await assertSucceeds(set(ref(db("bob"), "teams/team1/livetyre/race1/c7/25"), "4|Medium"));
    await assertSucceeds(get(ref(db("carol"), "teams/team1/livetyre/race1/c7")));
  });
  it("livetyre: string olmayan / 40+ karakter reddedilir", async () => {
    await assertFails(set(ref(db("bob"), "teams/team1/livetyre/race1/c7/26"), 4));
    await assertFails(set(ref(db("bob"), "teams/team1/livetyre/race1/c7/27"), "x".repeat(40)));
  });
  it("livetyre: viewer yazar; yabancı yazamaz", async () => {
    await assertSucceeds(set(ref(db("carol"), "teams/team1/livetyre/race1/c7/25"), "4|Medium"));
    await assertFails(set(ref(db("dave"), "teams/team1/livetyre/race1/c7/25"), "4|Medium"));
  });

  it("livecond: editor pist koşulu yazar, üye okur; string olmayan/40+ reddedilir", async () => {
    await assertSucceeds(set(ref(db("bob"), "teams/team1/livecond/race1/c7/25"), "31,22,73"));
    await assertSucceeds(get(ref(db("carol"), "teams/team1/livecond/race1/c7")));
    await assertFails(set(ref(db("bob"), "teams/team1/livecond/race1/c7/26"), 31));
    await assertFails(set(ref(db("bob"), "teams/team1/livecond/race1/c7/27"), "x".repeat(40)));
  });
  it("livecond: viewer yazar; yabancı yazamaz", async () => {
    await assertSucceeds(set(ref(db("carol"), "teams/team1/livecond/race1/c7/25"), "31,22,73"));
    await assertFails(set(ref(db("dave"), "teams/team1/livecond/race1/c7/25"), "31,22,73"));
  });
});

describe("teams/livetrack (paylaşımlı iç-harita şekli)", () => {
  it("editor pist şeklini (string) yazar; takım üyesi okur", async () => {
    await assertSucceeds(set(ref(db("bob"), "teams/team1/livetrack/Spa"), "0:1.0,2.0;1:3.0,4.0"));
    await assertSucceeds(get(ref(db("carol"), "teams/team1/livetrack/Spa")));
  });
  it("string olmayan / çok uzun değer reddedilir (validate)", async () => {
    await assertFails(set(ref(db("bob"), "teams/team1/livetrack/Spa"), 123));
    await assertFails(set(ref(db("bob"), "teams/team1/livetrack/Spa"), "x".repeat(9001)));
  });
  it("viewer yazar; yabancı yazamaz", async () => {
    await assertSucceeds(set(ref(db("carol"), "teams/team1/livetrack/Spa"), "0:1.0,2.0"));
    await assertFails(set(ref(db("dave"), "teams/team1/livetrack/Spa"), "0:1.0,2.0"));
  });
});

describe("teams/livetracksec (paylaşımlı sektör sınırları)", () => {
  it("editor sektör sınırlarını (string) yazar; takım üyesi okur", async () => {
    await assertSucceeds(set(ref(db("bob"), "teams/team1/livetracksec/Spa"), "0.3312,0.7231"));
    await assertSucceeds(get(ref(db("carol"), "teams/team1/livetracksec/Spa")));
  });
  it("string olmayan / 40+ karakter reddedilir", async () => {
    await assertFails(set(ref(db("bob"), "teams/team1/livetracksec/Spa"), 0.33));
    await assertFails(set(ref(db("bob"), "teams/team1/livetracksec/Spa"), "x".repeat(40)));
  });
  it("viewer yazar; yabancı yazamaz", async () => {
    await assertSucceeds(set(ref(db("carol"), "teams/team1/livetracksec/Spa"), "0.33,0.72"));
    await assertFails(set(ref(db("dave"), "teams/team1/livetracksec/Spa"), "0.33,0.72"));
  });
});

describe("teams/livetrackpit (paylaşımlı pit giriş/çıkış — v1.4.96)", () => {
  it("editor pit sınırlarını (string) yazar; takım üyesi okur", async () => {
    await assertSucceeds(set(ref(db("bob"), "teams/team1/livetrackpit/Spa"), "0.9210,0.0450"));
    await assertSucceeds(get(ref(db("carol"), "teams/team1/livetrackpit/Spa")));
  });
  it("string olmayan / 40+ karakter reddedilir", async () => {
    await assertFails(set(ref(db("bob"), "teams/team1/livetrackpit/Spa"), 0.92));
    await assertFails(set(ref(db("bob"), "teams/team1/livetrackpit/Spa"), "x".repeat(40)));
  });
  it("viewer yazar; yabancı yazamaz", async () => {
    await assertSucceeds(set(ref(db("carol"), "teams/team1/livetrackpit/Spa"), "0.9,0.04"));
    await assertFails(set(ref(db("dave"), "teams/team1/livetrackpit/Spa"), "0.9,0.04"));
  });
});

describe("teams/chat + raceState + badges", () => {
  it("üye kendi uid'iyle mesaj yazar; başkasının uid'iyle yazamaz", async () => {
    await assertSucceeds(set(ref(db("carol"), "teams/team1/chat/m1"), { uid: "carol", text: "selam" }));
    await assertFails(set(ref(db("carol"), "teams/team1/chat/m2"), { uid: "bob", text: "sahte" }));
  });
  it("500 karakterden uzun mesaj reddedilir", async () => {
    await assertFails(set(ref(db("carol"), "teams/team1/chat/m3"), { uid: "carol", text: "x".repeat(501) }));
  });
  it("üye olmayan (dave) team1 sohbetine yazamaz", async () => {
    await assertFails(set(ref(db("dave"), "teams/team1/chat/m4"), { uid: "dave", text: "yabancı" }));
  });
  it("raceState: editor yazar, viewer yazamaz", async () => {
    await assertSucceeds(set(ref(db("bob"), "teams/team1/raceState"), { rev: 1, stateJson: "{}" }));
    await assertFails(set(ref(db("carol"), "teams/team1/raceState"), { rev: 1, stateJson: "{}" }));
  });
  it("badges: yalnız owner yazar (editor bile yazamaz)", async () => {
    await assertSucceeds(set(ref(db("alice"), "teams/team1/badges/bob"), { engineer: true }));
    await assertFails(set(ref(db("bob"), "teams/team1/badges/bob"), { engineer: true }));
  });
});
