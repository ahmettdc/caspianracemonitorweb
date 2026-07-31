import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  VersionModal, RaceEditModal, ChatModal, SetupModal, TeamModal,
} from "./components.jsx";

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
    expect(html).toContain("wxmodal");
  });

  it("RaceEditModal (ekleme)", () => {
    const rForm = { rid: null, seasonId: null, round: "", name: "", trackId: "",
      carClass: "hypercar", carId: "", raceTime: "6:00:00", startsAt: Date.now() };
    const html = render(
      <RaceEditModal rForm={rForm} setRForm={noop} t={t} seasons={{}} onSave={noop} />);
    expect(html).toContain("wxmodal");
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
        myRole="owner" tForm={{ name: "", join: "" }} setTForm={noop} setTErr={noop}
        tErr="" userName="Ben" openRace={noop} setRForm={noop} setBadge={noop}
        roleLabel={(r) => r} />);
    expect(html).toContain("Takımlar");
    expect(html).toContain("Caspian");
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
