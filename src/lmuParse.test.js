import { describe, it, expect } from "vitest";
import {
  parseRacingToday, mapTrackId, parseLenSec, slugFromHref, normLabel,
} from "./lmuParse";

/* lmugarage.com /racing-today fragmanından alınmış gerçek yapıya dayalı fixture
   (iki satır: canlı günlük GTE @ Le Mans/Sarthe, yaklaşan haftalık @ Spa). */
const FIXTURE = `
<div class="run tnum" data-rows>
  <a class="run-row live" href="/daily/series/beginner/lmgte-fixed">
    <span class="rr-when">
      <time class="rr-time" datetime="2026-08-13T06:30:00+00:00" data-localtime="time">06:30</time>
      <span class="rr-status"><span class="dot dot-live" aria-hidden="true"></span>Race live</span>
    </span>
    <span class="rr-sr"><span class="rating" data-rank="Bronze"><span class="k">SR</span><span class="v">B0</span></span>
</span>
    <span class="rr-main">
      <span class="rr-name">LMGTE Fixed<span class="rr-event-type"> (Daily)</span></span>
      <span class="rr-track">
        Circuit de la Sarthe                </span>
    </span>
    <span class="rr-meta"><span class="chips"><span class="badge badge-class" data-class="GTE">GTE</span></span>
</span>
    <span class="rr-len"><span class="lab">Race length</span><span class="val">20m</span></span>
  </a>
  <a class="run-row next" href="/weekly/13000000010">
    <span class="rr-when">
      <time class="rr-time" datetime="2026-08-13T08:00:00+00:00" data-localtime="time">08:00</time>
      <span class="rr-status">Upcoming</span>
    </span>
    <span class="rr-sr"><span class="rating" data-rank="Silver"><span class="k">SR</span><span class="v">S2</span></span>
</span>
    <span class="rr-main">
      <span class="rr-name">2.4h Spa<span class="rr-event-type"> (Weekly)</span></span>
      <span class="rr-track">
        Spa-Francorchamps                </span>
    </span>
    <span class="rr-meta"><span class="chips"><span class="badge badge-class" data-class="LMP2">LMP2</span><span class="badge badge-class" data-class="LMP3">LMP3</span><span class="badge badge-class" data-class="GT3">GT3</span></span>
</span>
    <span class="rr-len"><span class="lab">Race length</span><span class="val">2h24m</span></span>
  </a>
</div>`;

describe("mapTrackId", () => {
  it("düzensiz etiketleri TRACKS id'sine eşler", () => {
    expect(mapTrackId("Circuit de la Sarthe")).toBe("lemans");
    expect(mapTrackId("Circuit Paul Ricard | 1A V2")).toBe("paulricard");
    expect(mapTrackId("Spa-Francorchamps")).toBe("spa");
    expect(mapTrackId("Portimão")).toBe("portimao");
    expect(mapTrackId("Bilinmeyen Pist")).toBe("");
  });
});

describe("parseLenSec", () => {
  it("süre etiketini saniyeye çevirir", () => {
    expect(parseLenSec("20m")).toBe(1200);
    expect(parseLenSec("2h24m")).toBe(8640);
    expect(parseLenSec("1h")).toBe(3600);
    expect(parseLenSec("")).toBe(null);
  });
});

describe("slugFromHref", () => {
  it("kararlı id parçası üretir", () => {
    expect(slugFromHref("/weekly/13000000010")).toBe("weekly-13000000010");
    expect(slugFromHref("/daily/series/beginner/lmgte-fixed"))
      .toBe("daily-series-beginner-lmgte-fixed");
  });
});

describe("normLabel", () => {
  it("aksan ve boşlukları sadeleştirir", () => {
    expect(normLabel("  Portimão  ")).toBe("portimao");
  });
});

describe("parseRacingToday", () => {
  const out = parseRacingToday(FIXTURE);
  it("tüm satırları çıkarır", () => {
    expect(out.source).toBe("lmugarage.com");
    expect(out.races).toHaveLength(2);
  });
  it("canlı günlük yarışı doğru ayrıştırır", () => {
    const r = out.races[0];
    expect(r).toMatchObject({
      kind: "daily", name: "LMGTE Fixed", live: true,
      sr: "B0", srRank: "Bronze", trackId: "lemans",
      trackRaw: "Circuit de la Sarthe", classes: ["GTE"],
      lenSec: 1200, lenLabel: "20m",
      url: "https://lmugarage.com/daily/series/beginner/lmgte-fixed",
    });
    expect(r.startIso).toBe("2026-08-13T06:30:00+00:00");
    expect(r.startMs).toBe(Date.parse("2026-08-13T06:30:00+00:00"));
    expect(r.id).toBe("daily-series-beginner-lmgte-fixed");
  });
  it("yaklaşan haftalık yarışı ve çoklu sınıfı doğru ayrıştırır", () => {
    const r = out.races[1];
    expect(r).toMatchObject({
      kind: "weekly", name: "2.4h Spa", live: false,
      sr: "S2", srRank: "Silver", trackId: "spa",
      classes: ["LMP2", "LMP3", "GT3"], lenSec: 8640,
    });
  });
});
