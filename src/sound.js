/* ---------- sohbet bildirim sesi ----------
   Yarış telsizi tarzı çift bip, WebAudio ile sentez — dosya yok, telif yok.
   Tarayıcı kuralı gereği ilk kullanıcı etkileşiminden önce çalmaz. */
let _ac = null;
let _sndFile;   // undefined: denenmedi | Audio: var | null: yok
/* Önce assets/sounds/chat.mp3 denenir (kullanıcı kendi sesini koyabilir),
   dosya yoksa MSN tarzı sentez tona düşülür. */
export function chatBeep() {
  if (_sndFile !== null) {
    if (_sndFile === undefined) {
      _sndFile = new Audio(import.meta.env.BASE_URL + "assets/sounds/chat.mp3");
      _sndFile.volume = 0.6;
      _sndFile.addEventListener("error", () => { _sndFile = null; chatBeepSynth(); });
    }
    _sndFile.currentTime = 0;
    const pr = _sndFile.play();
    if (pr) pr.catch(() => { if (_sndFile && _sndFile.error) { _sndFile = null; chatBeepSynth(); } });
    return;
  }
  chatBeepSynth();
}
/* MSN tarzı "yeni mesaj" tınısı: aşağı inen iki yumuşak nota (B5 → E5),
   marimba hissi için temel + hafif 3. harmonik, uzun sönüm. */
function chatBeepSynth() {
  try {
    _ac = _ac || new (window.AudioContext || window.webkitAudioContext)();
    if (_ac.state === "suspended") _ac.resume();
    const t0 = _ac.currentTime;
    const note = (dt, hz, dur, vol) => {
      [[1, vol], [3, vol * 0.18]].forEach(([mult, v]) => {
        const o = _ac.createOscillator();
        const g = _ac.createGain();
        o.type = "sine"; o.frequency.value = hz * mult;
        g.gain.setValueAtTime(0.0001, t0 + dt);
        g.gain.exponentialRampToValueAtTime(v, t0 + dt + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + dur);
        o.connect(g).connect(_ac.destination);
        o.start(t0 + dt); o.stop(t0 + dt + dur + 0.02);
      });
    };
    note(0,    987.8, 0.16, 0.16);   // B5 — kısa giriş
    note(0.13, 659.3, 0.42, 0.20);   // E5 — pes, uzun sönümlü gövde
  } catch { /* ses yoksa sessiz geç */ }
}
