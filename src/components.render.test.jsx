import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  VersionModal, RaceEditModal, ChatModal, SetupModal, TeamModal, CreateJoinModal, TourOverlay, ImgSelect,
  SetupContentModal, SetupCompareModal, SetupTable, SetupCards, SessionSetupBox,
} from "./components.jsx";
import { buildTourSteps } from "./tourSteps";

/* Smoke-render testleri — App.jsx'ten çıkarılan modal bileşenlerini SAHTE prop'larla
   render eder ve çökmediğini (eksik prop / tanımsız referans) doğrular. Render bölmenin
   asıl riski buydu: oxlint no-undef uygulamadığından eksik bir prop ancak çalışma
   zamanında patlıyordu. Bu testler o sınıfı statikçe yakalar.
   renderToStaticMarkup: DOM gerekmez; herhangi bir tanımsız referans/çağrı fırlatır. */

const t = (s) => s;                 // i18n kimlik
const noop = () => {};
const render = (el) => renderToStaticMarkup(el);

describe("modal bileşenleri: açık halde çökmeden render olur", () => {
  it("VersionModal", () => {
    const html = render(
      <VersionModal open onClose={noop} t={t} lang="tr" onStartGuide={noop} />);
    expect(html).toContain("Neler değişti");
  });

  it("RaceEditModal (ekleme)", () => {
    const rForm = { rid: null, seasonId: null, round: "", name: "", trackId: "",
      carClass: "hypercar", carId: "", raceTime: "6:00:00", startsAt: Date.now() };
    const html = render(
      <RaceEditModal rForm={rForm} setRForm={noop} t={t} seasons={{}} onSave={noop} />);
    expect(html).toContain("Yarış Ekle");
  });

  it("ChatModal", () => {
    const chans = [{ id: "global", lbl: "Genel", ico: "🌍", path: "globalChat" }];
    const html = render(
      <ChatModal open onClose={noop} t={t} chatSound toggleChatSound={noop}
        chatChans={chans} unreadOf={() => 0} chatChan="global" setChatChan={noop}
        teamData={null} curChan={chans[0]} chatBody={() => null} />);
    expect(html).toContain("chattabs");
  });

  it("SetupModal", () => {
    const html = render(
      <SetupModal open onClose={noop} t={t} suUpOpen={false} setSuUpOpen={noop}
        suList={[]} setups={[]} suFTrack="" setSuFTrack={noop} suFCond="" setSuFCond={noop}
        suFSess="" setSuFSess={noop} setupForm={() => null} setupTable={() => null} />);
    expect(html).toContain("Setup");
  });

  it("TeamModal (owner, üye + rozet + takvim)", () => {
    const teamData = {
      meta: { name: "Caspian", joinCode: "ABC123" },
      members: { u1: "owner", u2: "editor" },
      names: { u1: "Ben", u2: "Coco" },
      badges: { u2: { engineer: true } },
    };
    const html = render(
      <TeamModal open onClose={noop} user={{ uid: "u1" }} t={t} lang="tr"
        myTeams={{ t1: "Caspian" }} curTeam="t1" setCurTeam={noop} teamData={teamData}
        tnEdit={null} setTnEdit={noop} canManageTeam canEditTeam
        curSeason="" setCurSeason={noop} seasons={{ s1: { name: "2026 WEC" } }}
        races={{ r1: { name: "Le Mans", trackId: "lemans", raceTime: "6:00:00",
          round: 1, seasonId: "s1", startsAt: Date.now() } }}
        st={{ track: "lemans", carClass: "hypercar", car: "toyota", raceTime: "6:00:00" }}
        myRole="owner" openRace={noop} setRForm={noop} setBadge={noop}
        roleLabel={(r) => r} onCreateJoin={noop} />);
    expect(html).toContain("Takımlar");
    expect(html).toContain("Caspian");            // Takım Kimliği kartında ad
    expect(html).toContain("Takım Kimliği");      // v1.6 bölüm başlığı
    expect(html).toContain("ABC123");             // Takım Erişimi: join code
    expect(html).toContain("Coco");               // üye satırı
  });

  it("CreateJoinModal (fiş cjOpen — 2 sekmeli kur/katıl, yönetim yok)", () => {
    const html = render(
      <CreateJoinModal open onClose={noop} user={{ uid: "u1" }} t={t}
        userName="Ben" tForm={{ name: "", join: "" }} setTForm={noop}
        setTErr={noop} tErr="" setCurTeam={noop} />);
    expect(html).toContain("Takıma bağlan");      // başlık
    expect(html).toContain("Takım Kur");           // sekme 1
    expect(html).toContain("Takıma Katıl");        // sekme 2
    expect(html).toContain("Kurduğunda ne olur");  // kur sekmesi bilgi paneli
    // yönetim bölümleri BU ekranda görünmemeli
    expect(html).not.toContain("Sezonlar & Takvim");
    expect(html).not.toContain("Üyeler & Yetkiler");
  });

  it("CreateJoinModal kapalı → boş render", () => {
    expect(render(<CreateJoinModal open={false} onClose={noop} user={{ uid: "u1" }}
      t={t} userName="Ben" tForm={{ name: "", join: "" }} setTForm={noop}
      setTErr={noop} tErr="" setCurTeam={noop} />)).toBe("");
  });
});

describe("modal bileşenleri: kapalı halde null döner (render yok)", () => {
  it("hepsi open=false / boş durumda null", () => {
    expect(render(<VersionModal open={false} t={t} onClose={noop} lang="tr" onStartGuide={noop} />)).toBe("");
    expect(render(<RaceEditModal rForm={null} setRForm={noop} t={t} seasons={{}} onSave={noop} />)).toBe("");
    expect(render(<ChatModal open={false} onClose={noop} t={t} chatSound toggleChatSound={noop}
      chatChans={[]} unreadOf={() => 0} chatChan="" setChatChan={noop} teamData={null}
      curChan={null} chatBody={() => null} />)).toBe("");
    expect(render(<SetupModal open={false} onClose={noop} t={t} suUpOpen={false} setSuUpOpen={noop}
      suList={[]} setups={[]} suFTrack="" setSuFTrack={noop} suFCond="" setSuFCond={noop}
      suFSess="" setSuFSess={noop} setupForm={() => null} setupTable={() => null} />)).toBe("");
    expect(render(<TeamModal open={false} onClose={noop} user={null} t={t} />)).toBe("");
  });
});

/* Rehber turu — gerçek adım listesiyle çökmeden render olmalı (v1.4.85 sağlamlaştırma).
   renderToStaticMarkup effect çalıştırmaz; querySelector için minik document stub'ı yeter. */
describe("TourOverlay", () => {
  globalThis.document ??= { querySelector: () => null };
  globalThis.window ??= { innerWidth: 1280, innerHeight: 800 };

  const steps = buildTourSteps("main", {
    t, setTab: noop, setSideOpen: noop, setTourDemo: noop });

  it("ilk adımı, sayacı ve ilerleme çubuğunu basar", () => {
    const html = render(<TourOverlay steps={steps} onClose={noop} lang="tr" />);
    expect(html).toContain("tourcard");
    expect(html).toContain("tourbar");             // yeni ilerleme çubuğu
    expect(html).toContain('role="dialog"');       // erişilebilirlik
    expect(html).toContain("İleri");
    /* Hedefi DOM'da olmayan (act'siz) adımlar elenir; act'li + sel'siz adımlar kalır.
       Stub querySelector null döndüğü için beklenen sayı budur. */
    const kept = steps.filter((s) => !s.sel || s.act).length;
    expect(html).toContain(`1 / ${kept}`);
    expect(kept).toBeGreaterThan(0);
  });

  it("adım kalmayınca (boş liste) render etmez", () => {
    expect(render(<TourOverlay steps={[]} onClose={noop} lang="tr" />)).toBe("");
  });
});

/* ImgSelect — logolu açılır liste (Setup formu Track/Class/Car). Kapalı halde
   render (effect'siz) çökmeden çalışmalı; seçili değerin label+icon'u görünmeli. */
describe("ImgSelect", () => {
  const opts = [
    { value: "spa", label: "Spa", icon: "/assets/flags/spa.png" },
    { value: "monza", label: "Monza", icon: "/assets/flags/monza.png" },
  ];
  it("seçili değerin label + icon'unu basar (kapalı)", () => {
    const html = render(
      <ImgSelect value="spa" options={opts} onChange={noop} t={t} placeholder="—" />);
    expect(html).toContain("imgsel-btn");
    expect(html).toContain("Spa");
    expect(html).toContain("/assets/flags/spa.png");
    expect(html).not.toContain("imgsel-pop");   // varsayılan kapalı
  });
  it("değer yokken placeholder basar", () => {
    const html = render(
      <ImgSelect value="" options={opts} onChange={noop} t={t} placeholder="Seç" />);
    expect(html).toContain("imgsel-ph");
    expect(html).toContain("Seç");
  });
  it("disabled halde çökmeden render olur", () => {
    const html = render(
      <ImgSelect value="" options={[]} onChange={noop} t={t} disabled placeholder="—" />);
    expect(html).toContain("imgsel-btn off");
  });
});

/* SetupTable + SetupCards — v1.4.91 görünüm: aynı satırlar iki sunumda da çökmeden
   basılmalı (⚡/delta, birleşik hücreler, eylemler). */
describe("SetupTable / SetupCards", () => {
  const rows = [
    { id: "a", at: 1700000000000, track: "spa", cls: "gt3", car: "bmw", cond: "dry",
      sess: "R", lap: "2:18.500", name: "spa_low.svm", champ: "ELMS", ver: "1.2",
      note: "düşük kanat", uname: "Ahmet", team: "Caspian", uid: "u1", data: "eA==" },
    { id: "b", at: 1700100000000, track: "spa", cls: "gt3", car: "porsche", cond: "wet",
      sess: "Q", lap: "2:19.100", name: "spa_wet.svm", uname: "Savaş", uid: "u2" },
    { id: "c", at: 1700200000000, track: "monza", cls: "hypercar", car: "toyota",
      cond: "dry", sess: "R", lap: "", name: "monza.svm", uname: "Can", uid: "u3" },
  ];
  const st = { track: "spa" };

  it("tablo: 9 sütun, ⚡ en hızlı + delta, birleşik hücreler", () => {
    const html = render(
      <SetupTable rows={rows} t={t} st={st} lang="tr" isAdmin
        onDownload={noop} onDelete={noop} onView={noop}
        sort={{ key: "date", dir: "desc" }} onSort={noop} />);
    expect(html).toContain("fastlap");          // ⚡ en hızlı (a)
    expect(html).toContain("lapdelta");         // +0.6s (b)
    expect(html).toContain("ELMS · 1.2");       // şampiyona·sürüm dosya altında
    expect(html).toContain("Caspian");          // takım yükleyen altında
    expect(html).toContain("▼");                // aktif sıralama oku
  });

  it("kartlar: sucards grid + aynı içerik + eylemler", () => {
    const html = render(
      <SetupCards rows={rows} t={t} st={st} lang="tr" isAdmin
        onDownload={noop} onDelete={noop} onView={noop} />);
    expect(html).toContain("sucards");
    expect(html).toContain("sucard here");      // aktif pist vurgusu (spa)
    expect(html).toContain("fastlap");
    expect(html).toContain("spa_low.svm");
    expect(html).toContain("✕");                // admin silme
  });

  it("boş satır listesi çökmeden render olur", () => {
    expect(render(<SetupCards rows={[]} t={t} st={st} lang="tr" isAdmin={false}
      onDownload={noop} onDelete={noop} />)).toContain("sucards");
    expect(render(<SetupTable rows={[]} t={t} st={st} lang="tr" isAdmin={false}
      onDownload={noop} onDelete={noop} />)).toContain("table");
  });
});

/* SetupContentModal — su.data (base64 .svm) çözülüp özet + değerler basmalı. */
describe("SetupContentModal", () => {
  globalThis.window ??= {};
  const svm = "[REARWING]\nRWSetting=2//8.3 deg\n[GENERAL]\nVirtualEnergySetting=100//100%";
  const b64 = Buffer.from(svm, "utf-8").toString("base64");
  const su = { name: "s.svm", cls: "gt3", car: "bmw", track: "spa", data: b64 };

  it("açık halde arka kanat değerini basar", () => {
    const html = render(<SetupContentModal open su={su} onClose={noop} t={t} />);
    expect(html).toContain("wxmodal");
    expect(html).toContain("Arka Kanat");
    expect(html).toContain("8.3 deg");
  });
  it("open=false → null", () => {
    expect(render(<SetupContentModal open={false} su={su} onClose={noop} t={t} />)).toBe("");
  });
  it("bozuk/olmayan içerik → uyarı, çökme yok", () => {
    const bad = { name: "x", data: Buffer.from("selam", "utf-8").toString("base64") };
    const html = render(<SetupContentModal open su={bad} onClose={noop} t={t} />);
    expect(html).toContain("okunamadı");
  });
});

/* SetupCompareModal — iki gerçek .svm içeriği ile fark tablosu basmalı (v1.4.92). */
describe("SetupCompareModal", () => {
  globalThis.window ??= {};
  /* SteerLock özet haritasında YOK → "yalnız farklar" gizleme assert'i özet
     çiplerine takılmadan diff tablosunu sınar. */
  const svmA = "[REARWING]\nRWSetting=2//8.3 deg\n[CONTROLS]\nSteerLockSetting=5//540 deg";
  const svmB = "[REARWING]\nRWSetting=1//6.9 deg\n[CONTROLS]\nSteerLockSetting=5//540 deg";
  const mk = (name, svm, extra = {}) => ({
    id: name, name, cls: "gt3", car: "porsche", track: "spa",
    data: Buffer.from(svm, "utf-8").toString("base64"), ...extra });
  const a = mk("a.svm", svmA, { lap: "1:58.2" });
  const b = mk("b.svm", svmB, { lap: "1:59.0" });

  it("farklı değer vurgulu (diffhl) + tur zamanları başlıkta", () => {
    const html = render(<SetupCompareModal open a={a} b={b} onClose={noop} t={t} />);
    expect(html).toContain("diffhl");
    expect(html).toContain("8.3 deg");
    expect(html).toContain("6.9 deg");
    expect(html).toContain("1:58.2");
    expect(html).toContain("↔");
    /* aynı değerler varsayılan "yalnız farklar" görünümünde gizli */
    expect(html).not.toContain("540 deg");
  });

  it("farklı pist → uyarı çipi; open=false → null", () => {
    const c = mk("c.svm", svmB, { track: "monza" });
    const html = render(<SetupCompareModal open a={a} b={c} onClose={noop} t={t} />);
    expect(html).toContain("Farklı pist");
    expect(render(<SetupCompareModal open={false} a={a} b={b} onClose={noop} t={t} />)).toBe("");
  });

  it("bozuk içerik → uyarı, çökme yok", () => {
    const bad = mk("x.svm", "selam");
    const html = render(<SetupCompareModal open a={a} b={bad} onClose={noop} t={t} />);
    expect(html).toContain("okunamadı");
  });
});

describe("SessionSetupBox (.duckdb gömülü setup)", () => {
  const setup = JSON.stringify({
    VM_REAR_WING: { stringValue: "6.3 deg" },
    VM_BRAKE_BALANCE: { stringValue: "50.0:50.0" },
    "WM_PRESSURE-W_FL": { stringValue: "136 kPa" },
    "WM_PRESSURE-W_RL": { stringValue: "135 kPa" },
  });
  const meta = { driver: "AD", session: "Practice", venue: "Circuit de la Sarthe", carClass: "GT3" };
  it("özet + Havuza Kaydet ile çökmeden render olur", () => {
    const html = render(<SessionSetupBox setup={setup} meta={meta} t={t} onSave={noop} />);
    expect(html).toContain("6.3 deg");
    expect(html).toContain("Havuza Kaydet");
  });
  it("setup yoksa / bozuksa null", () => {
    expect(render(<SessionSetupBox setup={null} meta={{}} t={t} />)).toBe("");
    expect(render(<SessionSetupBox setup={"{bozuk"} meta={{}} t={t} />)).toBe("");
  });
  it("onSave yoksa kaydet butonu görünmez", () => {
    const html = render(<SessionSetupBox setup={setup} meta={meta} t={t} />);
    expect(html).not.toContain("Havuza Kaydet");
  });
});
