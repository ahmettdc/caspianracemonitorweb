/* liveBridge yaşam döngüsü testleri (v2.4.1).

   İki kök-neden burada kilitleniyor:

   1) ZOMBİ KÖPRÜ — `startBridge` iki `await` içerir (dinamik import +
      liveSessionIdGet). Bu pencerede `stopBridge` gelirse eskiden `starting`
      hiç sıfırlanmıyor, `stopping` true kalıyordu: askıdaki çağrı devam edip
      sidecar'ı YİNE DE doğuruyor, ama flush her karede `stopping` yüzünden
      erken dönüyordu. Sonuç: oyun PC'sinde paylaşımlı bellek okuyan bir süreç
      çalışıyor, arayüz "çalışıyor" diyor, Firebase'e TEK KARE gitmiyor — ve
      `bridgeRunning()` true olduğu için oto-yeniden deneme onu canlandırmıyor.

   2) SAHİPLİK — eski sürecin `close` olayı ms'ler geç gelir. Kontrol olmadığı
      için YENİ köprünün aboneliklerini iptal edip kirasını bırakıyordu.

   Sidecar kabuğu ve storage taklit edilir; gerçek süreç doğmaz. */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ---- storage taklidi: hiçbir şey Firebase'e gitmez, çağrılar sayılır ---- */
const calls = { released: [], claimed: 0, timingSet: 0 };
vi.mock("./storage", () => {
  const noop = async () => {};
  const unsub = () => {};
  return {
    liveTimingSet: async () => { calls.timingSet += 1; },
    liveLapsAppend: noop, liveLapsClear: noop,
    livePosAppend: noop, livePosClear: noop,
    liveSecAppend: noop, liveSecClear: noop,
    liveDrvAppend: noop, liveDrvClear: noop,
    liveTyreAppend: noop, liveTyreClear: noop,
    liveCondAppend: noop, liveCondClear: noop,
    liveWearAppend: noop, liveWearClear: noop,
    liveSessionIdGet: async () => { await Promise.resolve(); return null; },
    liveHistoryClearAll: noop,
    liveWriterClaim: async () => { calls.claimed += 1; return true; },
    liveWriterRelease: (tid, rid, uid) => { calls.released.push({ tid, rid, uid }); },
    liveWriterSubscribe: () => unsub,
    liveTimingSubscribe: () => unsub,
    serverNow: () => Date.now(),
  };
});

/* ---- sidecar kabuğu taklidi: spawn sayılır, süreç sahte ---- */
const spawned = [];
vi.mock("@tauri-apps/plugin-shell", () => ({
  Command: {
    sidecar: () => {
      const handlers = {};
      const proc = {
        killed: false,
        kill() { this.killed = true; (handlers.close || []).forEach((h) => h({ code: 0 })); },
      };
      const on = (ev, fn) => { (handlers[ev] ||= []).push(fn); };
      return {
        stdout: { on }, stderr: { on }, on,
        spawn: async () => { await Promise.resolve(); spawned.push(proc); return proc; },
        _handlers: handlers, _proc: proc,
      };
    },
  },
}));

const { startBridge, stopBridge, bridgeRunning } = await import("./liveBridge.js");

const OPTS = { tid: "t1", rid: "r1", hz: 2, by: "a@b.c", uid: "u1" };
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

beforeEach(() => {
  spawned.length = 0;
  calls.released.length = 0;
  calls.claimed = 0;
  calls.timingSet = 0;
});

describe("startBridge / stopBridge yarışı", () => {
  it("normal akış: sidecar doğar ve köprü çalışır", async () => {
    await startBridge(OPTS, () => {});
    expect(spawned).toHaveLength(1);
    expect(bridgeRunning()).toBe(true);
    await stopBridge(() => {});
    expect(bridgeRunning()).toBe(false);
  });

  it("REGRESYON: start beklerken stop gelirse ZOMBİ süreç kalmaz", async () => {
    const p = startBridge(OPTS, () => {});   // await'lerde askıda
    await stopBridge(() => {});              // tam o pencerede durdur
    await p;
    await settle();
    // Süreç ya hiç doğmamalı ya da doğduysa hemen öldürülmüş olmalı.
    const alive = spawned.filter((c) => !c.killed);
    expect(alive).toHaveLength(0);
    expect(bridgeRunning()).toBe(false);
  });

  it("REGRESYON: stop sonrası yeniden başlatma SESSİZCE düşmez", async () => {
    const p = startBridge(OPTS, () => {});
    await stopBridge(() => {});
    await p;
    await settle();
    /* Eskiden `starting` true kaldığı için bu çağrı `if (child || starting)`
       ile hiçbir şey yapmadan dönüyordu → köprü bir daha hiç başlamıyordu. */
    await startBridge(OPTS, () => {});
    await settle();
    expect(bridgeRunning()).toBe(true);
    expect(spawned.filter((c) => !c.killed)).toHaveLength(1);
    await stopBridge(() => {});
  });

  it("REGRESYON: eski sürecin close'u YENİ köprünün kirasını bırakmaz", async () => {
    await startBridge(OPTS, () => {});
    const first = spawned[0];
    await stopBridge(() => {});              // kirayı bırakır (1)
    calls.released.length = 0;

    await startBridge({ ...OPTS, rid: "r2" }, () => {});   // yeni oda
    await settle();
    expect(bridgeRunning()).toBe(true);

    // Eski sürecin close'u ŞİMDİ gelir (gerçekte ms'ler gecikir).
    first.kill();
    await settle();

    // Yeni köprü ayakta kalmalı ve kirası bırakılmamış olmalı.
    expect(bridgeRunning()).toBe(true);
    expect(calls.released).toHaveLength(0);
    await stopBridge(() => {});
  });
});
