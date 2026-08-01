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

describe("teams/live", () => {
  it("owner ve editor yazar; viewer yazamaz", async () => {
    await assertSucceeds(set(ref(db("alice"), "teams/team1/live/race1"), frame()));
    await assertSucceeds(set(ref(db("bob"), "teams/team1/live/race1"), frame()));
    await assertFails(set(ref(db("carol"), "teams/team1/live/race1"), frame()));
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
  it("viewer kira yazamaz", async () => {
    await assertFails(set(ref(db("carol"), "teams/team1/livewriter/race1"), lease("carol")));
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
  it("viewer tur geçmişi yazamaz", async () => {
    await assertFails(set(ref(db("carol"), "teams/team1/livelaps/race1/driver_1/5"), 92.3));
  });

  it("livedrv: editor pilot adı yazar, üye okur (endurance driver swap)", async () => {
    await assertSucceeds(set(ref(db("bob"), "teams/team1/livedrv/race1/c7/31"), "M. Yılmaz"));
    await assertSucceeds(get(ref(db("carol"), "teams/team1/livedrv/race1/c7")));
  });
  it("livedrv: string olmayan / 60+ karakter reddedilir", async () => {
    await assertFails(set(ref(db("bob"), "teams/team1/livedrv/race1/c7/32"), 5));
    await assertFails(set(ref(db("bob"), "teams/team1/livedrv/race1/c7/33"), "x".repeat(60)));
  });
  it("livedrv: viewer/yabancı yazamaz", async () => {
    await assertFails(set(ref(db("carol"), "teams/team1/livedrv/race1/c7/31"), "M. Yılmaz"));
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
  it("livetyre: viewer/yabancı yazamaz", async () => {
    await assertFails(set(ref(db("carol"), "teams/team1/livetyre/race1/c7/25"), "4|Medium"));
    await assertFails(set(ref(db("dave"), "teams/team1/livetyre/race1/c7/25"), "4|Medium"));
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
  it("viewer/yabancı yazamaz", async () => {
    await assertFails(set(ref(db("carol"), "teams/team1/livetrack/Spa"), "0:1.0,2.0"));
    await assertFails(set(ref(db("dave"), "teams/team1/livetrack/Spa"), "0:1.0,2.0"));
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
