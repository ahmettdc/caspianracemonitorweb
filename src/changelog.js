/* ============================================================
   SÜRÜM NOTLARI — uygulama içi "ℹ Neler değişti" penceresi
   En yeni sürüm en üstte olacak şekilde ekle.
   APP_VERSION (App.jsx) buradaki ilk kaydın "v" alanıyla aynı olmalı.
   ============================================================ */
export const CHANGELOG = [
  {
    v: "v1.4.107",
    date: "2026-08-07",
    tr: [
      "🛞 Wet (ıslak) hamur düzeltmesi: bir stintte wet takıldıktan sonra bir sonraki pitte köşe döngüsüyle wet TEKRAR seçilemiyordu. Artık wet sınırsız hakkımıza uygun şekilde ard arda pitlerde de seçilebilir; pit lastik değişimi doğru sayılır.",
      "🎬 Canlı Timing 'Demo' düğmesi artık yalnız adminlere görünür (normal kullanıcılardan kaldırıldı).",
      "Web-only: sayfa yenilemesi yeterli, masaüstü güncellemesi gerekmez.",
    ],
    en: [
      "🛞 Wet tyre fix: after fitting wet in one stint, the corner-cycle would not let you select wet AGAIN at the next pit. Wet (which is unlimited) can now be selected across consecutive pits; the pit tyre change is counted correctly.",
      "🎬 Live Timing 'Demo' button is now visible to admins only (removed for regular users).",
      "Web-only: a page refresh is enough, no desktop update needed.",
    ],
  },
  {
    v: "v1.4.106",
    date: "2026-08-07",
    tr: [
      "🌦 Hava tur çarpanları güncellendi: Damp ×1.03 · Slightly Wet ×1.08 · Wet ×1.10 · Extremely Wet ×1.15 (önceki 1.07/1.09/1.13/1.20). Islak zeminde efektif tur ve stint planı bu yeni çarpanlarla hesaplanır. Yakıt çarpanları değişmedi.",
      "Web-only: sayfa yenilemesi yeterli, masaüstü güncellemesi gerekmez.",
    ],
    en: [
      "🌦 Weather lap multipliers updated: Damp ×1.03 · Slightly Wet ×1.08 · Wet ×1.10 · Extremely Wet ×1.15 (were 1.07/1.09/1.13/1.20). Effective lap and stint plan in wet conditions now use these new multipliers. Fuel multipliers are unchanged.",
      "Web-only: a page refresh is enough, no desktop update needed.",
    ],
  },
  {
    v: "v1.4.105",
    date: "2026-08-07",
    tr: [
      "🌦 \"Efektif tur (şu an)\" DÜZELTİLDİ: Hava kartında seçili kademe (ör. Damp ×1.07) ile \"Efektif tur (şu an)\" satırının çarpanı bazen uyuşmuyordu — ileriye planlanmış bir ıslak geçiş (ör. Wet ×1.13) varken satır gelecekteki çarpanı gösteriyordu. Artık \"şu an\" satırı, vurgulu (seçili) hava kademesinin çarpanını kullanır; ikisi her zaman tutarlı.",
      "Not: strateji planı ve son-stint yakıt hesabı zaten tur-tur gerçek/bitiş havasını kullanıyordu; onlar değişmedi — bu yalnızca gösterim düzeltmesi.",
      "Web-only: sayfa yenilemesi yeterli, masaüstü güncellemesi gerekmez.",
    ],
    en: [
      "🌦 \"Effective lap (now)\" FIX: On the weather card, the selected condition (e.g. Damp ×1.07) sometimes didn't match the multiplier in the \"Effective lap (now)\" line — when a wet transition was planned ahead (e.g. Wet ×1.13), the line showed the future multiplier. The \"now\" line now uses the highlighted (selected) weather's multiplier; the two are always consistent.",
      "Note: the strategy plan and last-stint fuel calc already used the real/ending weather per lap; those are unchanged — this is a display-only fix.",
      "Web-only: a page refresh is enough, no desktop update needed.",
    ],
  },
  {
    v: "v1.4.104",
    date: "2026-08-07",
    tr: [
      "🐞 %105 KURALI DÜZELTİLDİ: Telemetri yüklerken yarım kalmış bir tur (ör. 00:17 — seansın son kesik turu) yanlışlıkla \"en hızlı tur\" sayılıp %105 kuralı tüm gerçek turların tikini kaldırıyordu. Artık kısmi turlar varsayılan olarak tiksiz gelir ve hiçbir yerde \"en hızlı\" tur olarak seçilmez; %105 gerçek en hızlı tura göre uygulanır.",
      "Ek güvenlik: anormal derecede kısa bir tur (medyanın yarısından kısa) da \"en iyi\" tur adayı sayılmaz. Kısmi turu istersen tur listesinden elle tikleyebilirsin (\"kısmi\" etiketiyle görünür).",
      "Web-only: sayfa yenilemesi yeterli, masaüstü güncellemesi gerekmez.",
    ],
    en: [
      "🐞 105% RULE FIX: When importing telemetry, a half-finished lap (e.g. 00:17 — the session's cut final lap) was wrongly treated as the \"fastest lap\", so the 105% rule unchecked every real lap. Partial laps now default to unchecked and are never picked as the \"fastest\" lap anywhere; the 105% cut is applied against the real fastest lap.",
      "Extra safety: an abnormally short lap (under half the median) is also never chosen as the \"best\" lap. You can still tick a partial lap by hand from the lap list (it shows a \"partial\" tag).",
      "Web-only: a page refresh is enough, no desktop update needed.",
    ],
  },
  {
    v: "v1.4.103",
    date: "2026-08-07",
    tr: [
      "🚀 BÜYÜK .ld DOSYALARI (100MB+): Artık uzun endurance seanslarının dev .ld dosyaları da sorunsuz açılıyor. Sistem dosyanın tamamını belleğe almıyor; önce yalnız başlık + kanal listesini, sonra da sadece gereken kanalların (tur no, yakıt, hız, lastik aşınma…) bayt bloklarını diskten çekiyor. Böylece kullanılan bellek dosya boyutundan bağımsız — 100MB da 1GB da olsa arayüz donmuyor.",
      "Yükleme sırasında kısa bir \"⏳ .ld çözümleniyor…\" göstergesi çıkar; çözümleme bittiğinde tur tablosu gelir. Küçük .ld'ler yine anında açılır.",
      "Web-only: sayfa yenilemesi yeterli, masaüstü güncellemesi gerekmez.",
    ],
    en: [
      "🚀 LARGE .ld FILES (100MB+): Huge .ld files from long endurance sessions now open smoothly. The system no longer loads the whole file into memory — it reads only the header + channel list first, then pulls just the byte blocks of the channels it needs (lap number, fuel, speed, tyre wear…) straight from disk. Memory used is now independent of file size, so the UI no longer freezes whether the file is 100MB or 1GB.",
      "A brief \"⏳ Parsing .ld…\" indicator shows while loading; the lap table appears when it's done. Small .ld files still open instantly.",
      "Web-only: a page refresh is enough, no desktop update needed.",
    ],
  },
  {
    v: "v1.4.102",
    date: "2026-08-07",
    tr: [
      "📈 MoTeC .ld DOSYASINI DOĞRUDAN YÜKLE: Artık Telemetri sekmesinde .ld dosyasını doğrudan seçebilirsin — MoTeC i2'de açıp CSV'ye export etme adımı gerekmiyor. Sistem .ld'nin içindeki kanalları (tur no, seans süresi, yakıt, lastik aşınma, hız) tarayıcıda çözüp her zamanki tur-başına özeti (süre, yakıt/tur, aşınma/tur, ort/max hız) çıkarır ve Stint A/B/C/D'ye kaydeder.",
      "Dosya girişi artık .ld kabul ediyor; CSV/TSV yapıştırma ve dosya yükleme aynen çalışıyor. Tur süresi mümkünse dosyadaki resmi tur zamanından, yoksa seans süresinden hesaplanır. Yalnız gereken kanallar okunur → büyük .ld'ler (birkaç MB) hızlı açılır.",
      "Web-only: sayfa yenilemesi yeterli, masaüstü güncellemesi gerekmez. Depoya yine sadece küçük tur özeti kaydedilir (ham yüksek-frekans örnekler değil).",
    ],
    en: [
      "📈 UPLOAD MoTeC .ld DIRECTLY: In the Telemetry tab you can now pick a .ld file directly — no need to open it in MoTeC i2 and export to CSV first. The system decodes the .ld's channels (lap number, session time, fuel, tyre wear, speed) in the browser and produces the usual per-lap summary (lap time, fuel/lap, wear/lap, avg/max speed), saving it to Stint A/B/C/D.",
      "The file picker now accepts .ld; pasting CSV/TSV and file upload still work as before. Lap time uses the file's official lap time when present, otherwise the session-elapsed span. Only the needed channels are read → large .ld files (a few MB) open quickly.",
      "Web-only: a page refresh is enough, no desktop update needed. Only the small per-lap summary is stored (not the raw high-frequency samples).",
    ],
  },
  {
    v: "v1.4.101",
    date: "2026-08-07",
    tr: [
      "🧪 TAKILMA TEŞHİSİ — 'REST'i kapat' anahtarı: v1.4.99 (tepside render durdurma) sonrası takılma azaldı ama tepsiye atınca dahi sürüyorsa, kalan sebep render değil, köprünün oyunun kendi yerel sunucusundan (localhost:6397) sürekli veri çekmesidir (saniyede ~3 istek/bağlantı). Canlı Köprü kartına eklenen anahtar bunu tamamen kapatır: sidecar oyunun sunucusuna hiç istek atmaz.",
      "Nasıl test edilir: sürüş PC'sinde Canlı sekmesi → 🛰 Canlı Köprü → 'REST'i kapat' → birkaç tur sür. Tepside bile takılma BİTİYORSA sebep REST'tir (bir sonraki adımda REST'i keep-alive + seyrek yoklama ile optimize ederiz). Bitmiyorsa sebep başka (CPU/GPU) ve oraya bakarız — boşuna büyük değişiklik yapmadan.",
      "REST kapalıyken kaybedilen: Virtual Energy %, gerçek takım adları/numaralar, yetkili sarı-bayrak sektörleri. Pozisyon/tur/sektör/lastik/yakıt paylaşımlı bellekten gelmeye devam eder. Anahtar cihaz tercihidir (yalnız o PC'de). Köprü değiştiği için sürüş PC'si yeni masaüstü sürümünü kurmalı.",
    ],
    en: [
      "🧪 STUTTER DIAGNOSTIC — 'Turn off REST' switch: after v1.4.99 (pausing render in the tray) the stutter dropped, but if it persists even when minimized to tray, the remaining cause isn't rendering — it's the bridge continuously pulling data from the game's own local server (localhost:6397, ~3 requests/connections per second). A new switch on the Live Bridge card turns this off entirely: the sidecar makes no requests to the game's server.",
      "How to test: on the driving PC, Live tab → 🛰 Live Bridge → 'Turn off REST' → drive a few laps. If the stutter STOPS even in the tray, REST is the cause (next step: optimize REST with keep-alive + sparser polling). If it doesn't, the cause is elsewhere (CPU/GPU) and we look there — without a needless big change.",
      "With REST off you lose: Virtual Energy %, real team names/numbers, authoritative yellow-flag sectors. Position/lap/sector/tire/fuel keep coming from shared memory. The switch is a device preference (that PC only). The bridge changed, so the driving PC needs the new desktop build.",
    ],
  },
  {
    v: "v1.4.100",
    date: "2026-08-07",
    tr: [
      "🔧 TAKIMA KATILMA DÜZELTİLDİ: onaylı bir kullanıcı katılım koduyla bir takıma katılmaya çalışınca 'Katılınamadı' hatası alıyordu. Sebep: katılım sırasında takım adı, yalnız ÜYELERİN okuyabildiği bir alandan okunmaya çalışılıyordu — katılan henüz üye olmadığından okuma reddediliyor ve tüm katılım çöküyordu. Artık bu okuma kaldırıldı; katılım anında gerçekleşiyor ve takım adı üye olunca kendiliğinden yerine geliyor.",
      "Not: Katılma yine de hesabının onaylı (allowed) olmasını gerektirir — onaysız bir hesap katılamaz; bu durumda önce yöneticinin hesabı onaylaması gerekir. Yalnız web tarafı düzeltildi, sayfa yenilemesi yeterli; masaüstü yeniden derleme gerekmez.",
    ],
    en: [
      "🔧 TEAM JOIN FIXED: an approved user entering a join code got a 'Could not join' error. Cause: joining tried to read the team name from a field only MEMBERS can read — since a joiner isn't a member yet, the read was denied and the whole join failed. That read is now removed; joining happens immediately and the team name fills in on its own once you're a member.",
      "Note: joining still requires your account to be approved (allowed) — an unapproved account can't join; an admin must approve it first. Web-only fix, a page refresh is enough; no desktop rebuild needed.",
    ],
  },
  {
    v: "v1.4.99",
    date: "2026-08-02",
    tr: [
      "🅿 SÜRÜŞ MODU (oyunda takılmanın 3. adımı): masaüstü uygulaması artık sürüş sırasında görünmez olduğunda (tepsiye küçültülünce ya da tam ekran oyunun arkasına düştüğünde) ağır Canlı ekranı — 55 satırlık tablo, animasyonlu pist haritası, grafikler — çizmeyi DURDURUR. Böylece sürücünün göremediği bir arayüz oyunla GPU/CPU için boşuna yarışmaz.",
      "📡 Veri KESİLMEZ: köprü render'dan bağımsız çalıştığı için render dursa da veri tam hızda (~2 Hz) Firebase'e akmaya devam eder — mühendis başka bir PC'den canlıyı akıcı görmeye devam eder. Sürücü pencereyi öne getirince arayüz anında geri gelir.",
      "Yanlış-durdurma koruması: ikinci monitörde canlıyı izleyen mühendisin penceresi köprü canlı veri yazmadıkça karartılmaz. İzleyici (web) hiç etkilenmez. Kabuk (Rust) + arayüz değiştiği için sürüş PC'lerinin yeni masaüstü sürümünü kurması gerekir. (Dürüst kısıt: tam ekran EXCLUSIVE oyunda WebView2 görünürlük olayları gecikebilir.)",
    ],
    en: [
      "🅿 DRIVING MODE (in-game stutter, step 3): while driving, when the desktop app is not visible (minimized to tray, or behind the full-screen game) it now STOPS drawing the heavy Live screen — the 55-row table, animated track map, charts. An interface the driver can't see no longer competes with the game for GPU/CPU.",
      "📡 Data keeps flowing: the bridge runs independently of rendering, so even with the render paused, data streams to Firebase at full rate (~2 Hz) — the engineer on another PC keeps seeing the live view smoothly. The interface returns instantly when the driver brings the window to front.",
      "False-pause guard: an engineer watching live on a second monitor is not blanked unless the bridge is actively writing live game data. Viewers (web) are never affected. The shell (Rust) + UI changed, so driving PCs need the new desktop build. (Honest limit: with a full-screen EXCLUSIVE game, WebView2 visibility events may lag.)",
    ],
  },
  {
    v: "v1.4.98",
    date: "2026-08-02",
    tr: [
      "🐢 OYUNDA TAKILMA (2. adım): masaüstü uygulaması artık Windows'ta DÜŞÜK ÖNCELİKLE (BELOW_NORMAL) çalışıyor — sürüş PC'sinde oyun her zaman öncelikli, uygulama yalnız boşta kalan işlemci gücünü kullanır, oyunun kare üretimini asla önlemez. Bu ayar hem arayüzü (WebView2) hem köprüyü kapsar (çocuk süreçler önceliği miras alır).",
      "Neden: v1.4.97 buffer ayarından sonra takılma azaldı ama bitmemişti; testte uygulamayı kapatınca takılmanın tamamen geçtiği görüldü — yani kaynak bizim uygulamamızın işlemci çekişmesiydi. Düşük öncelik bunu giderir. Çekişme yalnız oyun açıkken olur; izleyici PC'lerde arayüz yine tam hızlı.",
      "Köprü/kabuk değiştiği için sürüş PC'lerinin yeni masaüstü sürümünü kurması gerekir. (Dürüst not: takılma GPU kaynaklıysa sıradaki adım, uygulama tepsiye küçültülünce ağır canlı ekranı büsbütün duraklatmak olacak.)",
    ],
    en: [
      "🐢 IN-GAME STUTTER (step 2): the desktop app now runs at LOW PRIORITY (BELOW_NORMAL) on Windows — on the driving PC the game always comes first, the app only uses spare CPU and never preempts the game's frame rendering. This covers both the UI (WebView2) and the bridge (child processes inherit the priority).",
      "Why: after the v1.4.97 buffer setting the stutter dropped but didn't stop; a test showed closing the app removed it entirely — so the cause was our app's CPU contention. Low priority fixes that. Contention only happens while the game runs; on viewer PCs the UI stays full speed.",
      "The bridge/shell changed, so driving PCs need the new desktop build. (Honest note: if the stutter is GPU-bound, the next step will be pausing the heavy live screen entirely when the app is minimized to tray.)",
    ],
  },
  {
    v: "v1.4.97",
    date: "2026-08-02",
    tr: [
      "⚡ OYUNDA DONMA/TAKILMA: sebebi bulundu ve uygulama artık söylüyor. Ölçtük — paylaşımlı belleği OKUMAK ucuz (kare başına ~0,3 MB); asıl yük oyunun İÇİNDE: paylaşımlı bellek eklentisi, bu uygulamanın hiç okumadığı buffer'ları da yazıyor — ForceFeedback ve Graphics saniyede 400'er kez, PitInfo 100 kez. Biz yalnız Telemetry (50) + Scoring (5) okuyoruz.",
      "🔧 Canlı Köprü kartında artık ⚡ uyarısı çıkıyor: kaç gereksiz yazım olduğunu gösteriyor ve CustomPluginVariables.JSON için doğru 'UnsubscribedBuffersMask' değerini kopyalanabilir şekilde veriyor. En güvenli 48 (FFB+Grafik) ile başla; sorun çıkmazsa 240, tek araç sen kullanıyorsan 252.",
      "🩺 Yeni teşhis komutu: caspian-bridge.exe --check-plugin → kurulum yolu, eklentinin açık olup olmadığı, mevcut maske, boşa yazılan buffer'lar ve önerilen kademeler. Uygulama oyun ayarını ASLA kendisi yazmaz (CrewChief/SimHub/TinyPedal gibi araçların hangi veriye ihtiyaç duyduğunu bilemeyiz) — okur ve önerir.",
      "📖 Köprü README'sine buffer tablosu + adım adım ayar rehberi eklendi. Köprü değiştiği için sürüş PC'lerinin yeni masaüstü sürümünü kurması gerekir.",
    ],
    en: [
      "⚡ IN-GAME STUTTER: root cause found, and the app now tells you. We measured it — READING shared memory is cheap (~0.3 MB per frame); the real cost is inside the game: the shared-memory plugin also writes buffers this app never reads — ForceFeedback and Graphics at 400 times per second each, PitInfo 100. We only read Telemetry (50) + Scoring (5).",
      "🔧 The Live Bridge card now shows a ⚡ warning: how many wasted writes are happening, plus the correct 'UnsubscribedBuffersMask' value for CustomPluginVariables.JSON with a copy button. Start with the safest 48 (FFB+Graphics); move to 240 if nothing breaks, 252 if this is your only tool.",
      "🩺 New diagnostic: caspian-bridge.exe --check-plugin → install path, whether the plugin is enabled, current mask, wasted buffers and suggested steps. The app NEVER writes the game config itself (we cannot know which data CrewChief/SimHub/TinyPedal need) — it reads and advises.",
      "📖 Bridge README got a buffer table and a step-by-step guide. The bridge changed, so driving PCs need the new desktop build.",
    ],
  },
  {
    v: "v1.4.96",
    date: "2026-08-02",
    tr: [
      "🅿 Pist Haritasında artık PİT giriş ve çıkış noktaları işaretleniyor: araçlar bir tur pite girip çıktıkça harita halkasında yeşil (giriş) ve mavi (çıkış) 'P' işaretleri belirir; takımca paylaşılır (izleyiciler de anında görür).",
      "➤ Araçların hangi yöne gittiğini gösteren küçük bir yön oku eklendi (S/F'nin hemen ötesinde) — haritaya ilk bakan bile turun yönünü anlar.",
      "⛶ Büyük Pano (⛶ Büyüt) gerçek bir pit duvarı panosu oldu: artık strateji şeridini de gösteriyor, üstte hava/bayrak/sıcaklık durum paneli, altta sınıf renkleri + işaret açıklaması (lejant) var.",
      "Hepsi mevcut canlı veriden — köprü değişmez, ek kurulum yok. (Dürüst not: pit işaretleri bir gözlem turu ister; ilk pite kadar görünmez.)",
    ],
    en: [
      "🅿 The Track Map now marks PIT entry and exit: as cars enter and leave the pits over a lap, green (entry) and blue (exit) 'P' markers appear on the map ring; shared across the team (viewers see them instantly).",
      "➤ A small direction arrow (just past S/F) shows which way the cars travel — even a first-time viewer gets the lap direction.",
      "⛶ The Big Board (⛶ Expand) became a real pit-wall board: it now also shows the strategy strip, a weather/flag/temperature status panel on top, and a legend (class colors + marker key) at the bottom.",
      "All from existing live data — no bridge change, no extra setup. (Honest note: pit markers need one observation lap; they don't show until the first pit stop.)",
    ],
  },
  {
    v: "v1.4.95",
    date: "2026-08-02",
    tr: [
      "🗺 Pist Haritası artık YARIŞ DURUMUNU da gösteriyor: sarı bayrakta ilgili sektör harita halkasında sarıya boyanır, FCY'de (tam pist sarısı) yol amber olur, yağmurda/ıslak zeminde yol mavi tona döner. Haritaya bakınca nerede tehlike/ıslaklık olduğu bir bakışta belli.",
      "🌦 Harita köşesinde küçük durum rozeti: bayrak (⚑ FCY / Yellow S2…), zemin ıslaklığı ikonu + kademesi (Damp/Wet…), pist ve ortam sıcaklığı. Hepsi canlı veriden — köprü değişmez, ek kurulum yok.",
    ],
    en: [
      "🗺 The Track Map now shows RACE STATE too: under a local yellow the affected sector turns yellow on the map ring, under FCY (full-course yellow) the road goes amber, and in the wet the road shifts to a blue tint. One glance tells you where the danger or the wet is.",
      "🌦 A small status badge in the map corner: flag (⚑ FCY / Yellow S2…), track-wetness icon + level (Damp/Wet…), and track/ambient temperature. All from live data — no bridge change, no extra setup.",
    ],
  },
  {
    v: "v1.4.94",
    date: "2026-08-02",
    tr: [
      "🩺 Canlı Köprü artık NEDEN veri gelmediğini söylüyor. Eskiden tek bir 'Oyun/seans bekleniyor' mesajı üç farklı durumu gizliyordu — en sinsisi: paylaşımlı bellek eklentisi (rFactor2SharedMemoryMapPlugin64.dll) kurulu/etkin değilken bile köprü 'çalışıyor' görünüp sonsuza dek bekliyordu. Şimdi kart açıkça ayırıyor: '⛔ Eklenti verisi yok — DLL kurulu ya da etkin değil (CustomPluginVariables.JSON'da Enabled: 1 olmalı)' · 'Oyun açık, seans bekleniyor — pist/garaja girince veri başlar' · 'Seansta araç görünmüyor'.",
      "🔒 İzleyici (viewer) rolüyle açılan masaüstünde köprü kartı artık sessiz kalmıyor — 'köprü bu rolde yayın yapamaz; Mühendis (editor) rolü gerekir' diye açıklıyor.",
      "🛰 Durum noktasının üzerine gelince eklenti sürümü de görünür (eklenti ✓ v3.x…); takılı bekleme durumunda kaybolan teşhis tooltip'i düzeltildi. Köprü değiştiği için sürüş PC'lerinin yeni masaüstü sürümünü kurması gerekir.",
    ],
    en: [
      "🩺 The Live Bridge now tells you WHY no data is coming. A single 'Waiting for game/session' message used to hide three different states — the sneakiest: with the shared-memory plugin (rFactor2SharedMemoryMapPlugin64.dll) missing or disabled, the bridge still looked 'running' and waited forever. The card now distinguishes: '⛔ No plugin data — DLL not installed/enabled (CustomPluginVariables.JSON needs Enabled: 1)' · 'Game open, waiting for a session — data starts on track/garage' · 'No cars in session'.",
      "🔒 On a desktop opened with a viewer role the bridge card is no longer silent — it explains 'the bridge cannot broadcast with this role; Engineer (editor) role required'.",
      "🛰 Hovering the status dot now also shows the plugin version (plugin ✓ v3.x…); the diagnostic tooltip that vanished exactly in the stuck-waiting state is fixed. The bridge changed, so driving PCs need the new desktop build.",
    ],
  },
  {
    v: "v1.4.93",
    date: "2026-08-02",
    tr: [
      "⚡ Setup havuzu artık çok daha hafif açılıyor: setup dosyalarının içeriği (base64) listeyle birlikte inmiyor, yalnız İçerik/İndir/Karşılaştır dediğinde talep üzerine çekiliyor. Havuz büyüse de sekme hızlı açılır; internet tüketimi düşer.",
      "📄 Havuz son 150 kaydı gösteriyor; alttaki 'Daha fazla yükle' ile daha eskiler açılır (sıralama/arama/süzgeçler yine tüm indirilen pencerede çalışır).",
      "♻️ Aynı setup dosyasını ikinci kez yüklerken uyarı çıkıyor ('Bu dosya zaten havuzda: … Yine de yüklensin mi?') — mükerrer yüklemeler azalır. (Dürüst kısıt: yalnız o an inmiş liste penceresi kontrol edilir; çok eski kayıtlar yakalanmayabilir.)",
      "Eski setuplar olduğu gibi çalışmaya devam eder — hiçbir kayıt taşınmaz, dosyaları kaybolmaz.",
    ],
    en: [
      "⚡ The setup pool opens much lighter now: setup file contents (base64) no longer download with the list — they're fetched on demand only when you hit Content/Download/Compare. The tab opens fast even as the pool grows, and uses less data.",
      "📄 The pool shows the latest 150 records; 'Load more' at the bottom reveals older ones (sort/search/filters still work across everything loaded).",
      "♻️ Uploading the same setup file twice now warns you ('This file is already in the pool: … Upload anyway?') — fewer duplicates. (Honest limit: only the currently loaded window is checked; very old records may not be caught.)",
      "Existing setups keep working as-is — no records are migrated, no files are lost.",
    ],
  },
  {
    v: "v1.4.92",
    date: "2026-08-02",
    tr: [
      "⚖ SETUP KARŞILAŞTIRMA geldi: havuzda iki setup'ı ⚖ düğmesiyle seç (tablo satırında ya da kartta) — alttaki çubuktan 'Karşılaştır' de, iki dosyanın TÜM değerleri yan yana açılır. Farklı değerler vurgulu; 'Yalnız farkları göster' anahtarı varsayılan açık (arka kanat 8.3° ↔ 6.9° gibi farklar bir bakışta).",
      "⏱ Karşılaştırma başlığında iki setup'ın tur zamanları yan yana (1:58.2 ↔ 1:59.0) + iki özet çip şeridi; yalnız birinde olan alanlar da fark olarak listelenir. Farklı pist/sınıf seçersen engellenmez, başlıkta uyarı çıkar.",
    ],
    en: [
      "⚖ SETUP COMPARISON is here: pick two setups in the pool with the ⚖ button (on a table row or a card) — hit 'Compare' in the bottom bar and ALL values of both files open side by side. Different values are highlighted; the 'differences only' switch is on by default (spot rear wing 8.3° ↔ 6.9° at a glance).",
      "⏱ The comparison header shows both lap times side by side (1:58.2 ↔ 1:59.0) plus two summary chip strips; fields present in only one file are listed as differences too. Picking different track/class isn't blocked — you get a warning chip.",
    ],
  },
  {
    v: "v1.4.91",
    date: "2026-08-02",
    tr: [
      "🃏 Setup havuzuna KART GÖRÜNÜMÜ geldi: ⊞ düğmesiyle tablo ↔ kart arasında geçiş yap (tercih cihazında hatırlanır). Kartlarda pist görseli, bayrak, sınıf + marka logosu, büyük tur zamanı ve tüm eylemler var.",
      "📊 Tablo sadeleşti (13 → 9 sütun): Koşul+Seans tek hücrede, şampiyona/sürüm/not dosya adının altında, takım yükleyenin altında — daha az yatay kaydırma, aynı bilgi.",
      "🖱 Satıra ya da karta tıklamak artık doğrudan İÇERİK penceresini açıyor (indirme/silme düğmeleri ayrı çalışmaya devam ediyor).",
      "⚡ En hızlı setup vurgusuna ek olarak diğer setuplarda en hızlıya fark görünüyor (ör. '+0.6s') — aynı pist+sınıf içinde kıyas bir bakışta.",
      "👤 'Benim setuplarım' süzgeci: tek tıkla yalnız kendi yüklediklerini gör.",
    ],
    en: [
      "🃏 The setup pool got a CARD VIEW: toggle table ↔ cards with the ⊞ button (preference remembered on your device). Cards show the track image, flag, class + brand logo, a big lap time and all actions.",
      "📊 The table got simpler (13 → 9 columns): condition+session in one cell, championship/version/note under the file name, team under the uploader — less horizontal scrolling, same info.",
      "🖱 Clicking a row or card now opens the CONTENT window directly (download/delete buttons still work separately).",
      "⚡ Besides the fastest-setup highlight, other setups now show their gap to the fastest (e.g. '+0.6s') — instant comparison within the same track+class.",
      "👤 'My setups' filter: one click to see only what you uploaded.",
    ],
  },
  {
    v: "v1.4.90",
    date: "2026-08-02",
    tr: [
      "🪄 Setup yükleme artık çok daha hızlı: .svm dosyasını forma SÜRÜKLEYİP BIRAKABİLİRSİN ve sınıf + araç dosyanın içinden KENDİLİĞİNDEN algılanıyor (dosyadaki VehicleClassSetting satırından). Elle yaptığın seçimler asla ezilmez — yalnız boş alanlar dolar.",
      "📍 Yarış açıkken Setup formu pist/sınıf/araç alanlarını aktif yarıştan önceden dolduruyor — çoğu zaman sadece dosyayı bırakıp Yükle'ye basmak yetiyor.",
      "🔎 Setup havuzuna arama kutusu eklendi (dosya adı, not, şampiyona, yükleyen, takım) ve 'Tarih' ile 'Tur' sütun başlıkları tıklanarak sıralanabiliyor — Tur'a tıkla, en hızlı setup en üstte.",
    ],
    en: [
      "🪄 Uploading a setup is much faster now: you can DRAG & DROP the .svm file onto the form, and the class + car are AUTO-DETECTED from inside the file (its VehicleClassSetting line). Your manual choices are never overwritten — only empty fields get filled.",
      "📍 With a race open, the Setup form pre-fills track/class/car from the active race — most of the time you just drop the file and press Upload.",
      "🔎 The setup pool got a search box (file name, note, championship, uploader, team) and the 'Date' and 'Lap' column headers are click-to-sort — click Lap to see the fastest setup on top.",
    ],
  },
  {
    v: "v1.4.89",
    date: "2026-08-02",
    tr: [
      "⏱ Setup yüklerken artık opsiyonel bir 'Tur Zamanı' (best-lap) girebilirsin (ör. 1:58.234). Setup havuzu tablosunda yeni 'Tur' sütunu bu zamanı gösteriyor; aynı pist ve sınıftaki EN HIZLI setup ⚡ ile yeşil vurgulanıyor — hangi setup'ın hızlı olduğu bir bakışta belli oluyor. Zorunlu değil; boş bırakılabilir.",
    ],
    en: [
      "⏱ You can now enter an optional 'Lap Time' (best lap) when uploading a setup (e.g. 1:58.234). The setup pool table has a new 'Lap' column for it, and the FASTEST setup for the same track and class is highlighted in green with a ⚡ — so you can tell at a glance which setup is quick. Optional; can be left blank.",
    ],
  },
  {
    v: "v1.4.88",
    date: "2026-08-02",
    tr: [
      "🔍 Artık setup dosyalarının İÇİNİ görebiliyoruz. Setup havuzundaki her satırda '🔍 İçerik' düğmesi var — açınca dosyadaki gerçek ayarlar listeleniyor: arka kanat (ör. 8.3 deg), ön/arka yükseklik, lastik basıncı, denge çubukları, fren dengesi, TC/ABS, kamber, yay, diff, VE ve daha fazlası. Üstte hızlı bir özet şeridi, altında bölüm bölüm tüm değerler. İndirmeye gerek yok, dosyayı açmadan içini görürsün.",
      "ℹ Değerler dosyanın kendi etiketlerinden okunuyor (LMU .svm metin formatı); LMU setup'ı olmayan/bozuk bir dosyada net uyarı verir.",
    ],
    en: [
      "🔍 You can now see INSIDE setup files. Every row in the setup pool has a '🔍 Contents' button — it lists the real settings from the file: rear wing (e.g. 8.3 deg), front/rear ride height, tyre pressures, anti-roll bars, brake bias, TC/ABS, camber, springs, diff, VE and more. A quick summary strip on top, all values grouped by section below. No download needed — you see the contents without opening the file.",
      "ℹ Values are read from the file's own labels (LMU .svm text format); a non-LMU or corrupted file shows a clear warning.",
    ],
  },
  {
    v: "v1.4.87",
    date: "2026-08-02",
    tr: [
      "🖼 Setup formundaki Pist / Sınıf / Araç seçimleri artık logolu açılır listeler. Eskiden bunlar normal açılır listelerdi ve HTML gereği içlerine görsel konulamıyordu (logo yoktu). Artık listeyi açınca her satırda ilgili logo görünür: pist bayrağı, sınıf rozeti ve araç için MARKA logosu.",
      "🗺 Pist seçilince formda o pistin görseli de gösteriliyor (önceden görsel yoktu).",
      "🏷 Setup havuzu tablosunda araç adının yanına marka logosu eklendi.",
    ],
    en: [
      "🖼 The Track / Class / Car pickers in the setup form are now logo dropdowns. These used to be plain dropdowns, and HTML doesn't allow images inside them (so there were no logos). Now each row in the open list shows its logo: track flag, class badge, and the brand logo for cars.",
      "🗺 Selecting a track now also shows that track's image in the form (there was no image before).",
      "🏷 The brand logo was added next to the car name in the setup pool table.",
    ],
  },
  {
    v: "v1.4.86",
    date: "2026-08-02",
    tr: [
      "🐞 Setup bölümü hata taraması — 9 düzeltme. En önemlisi: geçerli bir dosya seçip ardından 180 KB'tan büyük bir dosya seçtiğinizde 'çok büyük' uyarısı çıkıyor ama sahnede ESKİ dosya kalıyordu; Yükle'ye basınca yanlış (eski) dosya yükleniyordu. Artık reddedilen dosyada seçim temizleniyor.",
      "⚡ Setup havuzu artık yalnız Setup sekmesi ya da lobi penceresi açıkken indiriliyor. Önceden herkes, Setup'a hiç girmese bile, girişte tüm havuzu (setup dosyalarının tamamı dahil) indiriyordu.",
      "💬 Sessiz hatalar giderildi: dosya okunamazsa uyarı çıkıyor, yükleme başarılıysa '✓ Setup yüklendi' yazıyor, silme başarısız olursa sebebi görünüyor.",
      "🔎 Süzgeç hiçbir setup'ı tutmadığında artık 'Henüz setup yok' yerine 'Bu süzgeçle setup yok' + '✕ Süzgeçleri temizle' çıkıyor. Seçili pistin son setup'ı silinince süzgeç kendini sıfırlıyor (eskiden liste sebepsiz boş kalıyordu).",
      "🛡 Şampiyona (40) ve LMU sürümü (16) alanlarına karakter sınırı eklendi — eskiden uzun yazılan metin kaydederken sessizce kısalıyordu. Ayrıca sınıf ikonu yüklenemediğinde sekmenin çökmesine yol açabilen bir DOM hatası giderildi.",
    ],
    en: [
      "🐞 Setup section bug sweep — 9 fixes. The most important: if you picked a valid file and then picked one larger than 180 KB, the 'too big' warning appeared but the OLD file stayed staged; pressing Upload uploaded the wrong (old) file. The selection is now cleared when a file is rejected.",
      "⚡ The setup pool is now downloaded only while the Setup tab or the lobby window is open. Previously everyone downloaded the whole pool (including every setup file) at sign-in, even without ever opening Setup.",
      "💬 Silent failures fixed: a warning now appears if the file can't be read, a '✓ Setup uploaded' message confirms a successful upload, and a failed delete shows the reason.",
      "🔎 When the filters match nothing you now get 'No setups match this filter' + '✕ Clear filters' instead of 'No setups yet'. If the last setup for the selected track is deleted, the filter resets itself (the list used to go blank with no explanation).",
      "🛡 Character limits added to Championship (40) and LMU version (16) — long text used to be silently truncated on save. Also fixed a DOM error that could crash the tab when a class icon failed to load.",
    ],
  },
  {
    v: "v1.4.85",
    date: "2026-08-02",
    tr: [
      "🎓 Rehber turu komple elden geçirildi. En büyük eksik kapandı: Canlı Timing artık rehberde — 9 adımda köprü/veri kaynağı, seans şeridi, Kendi Araç, pist haritası + strateji, saha tablosu, tur geçmişi (+), pozisyon grafiği ve Büyük Pano anlatılıyor. Rehber bu adımlarda 🎬 Demo'yu kendisi açıyor: oyun ya da köprü olmadan ekranı dolu görüp öğreniyorsun, tur bitince demo kapanıyor.",
      "🎓 Canlı sekmesine kendi 🎓 düğmesi eklendi — sadece Canlı Timing bölümünü (9 adım) baştan izleyebilirsin.",
      "📖 Yeni özellikler rehbere işlendi: 🏠 Ana Menü, yetki kutucuğu ve rol modeli, canlı↔stint senkronu (oto-PIT, saat hizalama, hava/AVG önerileri), setup yükleme/silme kuralları.",
      "🔧 Rehber mekaniği sağlamlaştırıldı: adım sayacı (n/N) artık sekme değişince zıplamıyor, balonun dışına tıklamak turu kazara kapatmıyor (Geç/Esc/Bitti ile çıkılır), son adımda Enter turu bitiriyor, ilerleme çubuğu eklendi, klavye odağı ve ekran okuyucu desteği geldi, hareket azaltma tercihine uyuluyor.",
    ],
    en: [
      "🎓 The guided tour was completely reworked. The biggest gap is closed: Live Timing is now in the guide — 9 steps covering the bridge/data source, session strip, Own Car, track map + strategy, field table, lap history (+), position chart and Big Board. The guide switches 🎬 Demo on for these steps, so you learn on a full screen without the game or the bridge; demo turns off when the tour ends.",
      "🎓 The Live tab got its own 🎓 button — replay just the Live Timing section (9 steps) any time.",
      "📖 Recent features added to the guide: 🏠 Main Menu, the permission box and role model, live↔stint sync (auto-PIT, clock alignment, weather/AVG suggestions), and the setup upload/delete rules.",
      "🔧 Tour mechanics hardened: the step counter (n/N) no longer jumps when tabs change, clicking outside the bubble no longer ends the tour by accident (use Skip/Esc/Done), Enter finishes on the last step, a progress bar was added, keyboard focus and screen-reader support landed, and the reduced-motion preference is respected.",
    ],
  },
  {
    v: "v1.4.84",
    date: "2026-08-02",
    tr: [
      "🔒 Yetkisi olmayan (yalnız izleyici) bir üye yarışta düzenleme yapmaya çalışınca artık ekranın altında 'Bu işlem için yetkiniz yok' kutucuğu beliriyor. Önceden düzenle düğmeleri sessizce tepki vermiyordu; şimdi net bir uyarı çıkıyor. (Düzenleme yalnız Yarış Mühendisi/Takım Sahibine açık.) Ek fayda: izleyiciler artık salt-okunur eylemleri de (tur geçmişi '+', harita '⛶ Büyüt') kullanabiliyor.",
    ],
    en: [
      "🔒 When a member without edit rights (viewer only) tries to change something in a race, a 'You don't have permission for this action' box now appears at the bottom of the screen. Previously the edit buttons silently did nothing; now there's a clear notice. (Editing is limited to the Race Engineer/Team Owner.) Bonus: viewers can now also use read-only actions (lap-history '+', map '⛶ Expand').",
    ],
  },
  {
    v: "v1.4.83",
    date: "2026-08-01",
    tr: [
      "🌡 Tur geçmişi penceresinde (satırdaki '+') artık her tur satırında o turdaki pist koşulları da yazıyor: asfalt sıcaklığı (🛣), yol tutuş (🛞 %) ve zemin ıslaklığı (damla ikonu + kademe). Koşullar, tur tamamlandığı anda kaydedilir (kalıcı) — köprü çalışırken biriken turlar için görünür. (Yazım için sürüş PC'sinde masaüstü uygulaması güncellenmeli; bu sürümden önceki turlarda koşul kaydı yoktur.)",
    ],
    en: [
      "🌡 In the lap-history popup (the '+' on a row) each lap now also shows the track conditions at that lap: track temp (🛣), grip (🛞 %) and track wetness (droplet icon + stage). Conditions are captured when the lap completes (persistent) — visible for laps accumulated while the bridge runs. (Writing needs the desktop app updated on the driving PC; laps before this version have no condition record.)",
    ],
  },
  {
    v: "v1.4.82",
    date: "2026-08-01",
    tr: [
      "🧹 Canlı Timing saha tablosundan 'Konum' sütunu kaldırıldı — pit durumu zaten 'Pit' sütununda (sarı PIT çipi + pit sayısı) görünüyordu, tekrar oluyordu.",
    ],
    en: [
      "🧹 Removed the 'Location' column from the Live Timing field table — pit status was already shown in the 'Pit' column (yellow PIT chip + stop count), so it was redundant.",
    ],
  },
  {
    v: "v1.4.81",
    date: "2026-08-01",
    tr: [
      "🎨 Canlı 'Zemin ıslaklığı' göstergesinde ikon artık büyük (hero), kelime ise daha küçük etiket boyutunda — önceden ikon çok küçük, yazı çok büyüktü.",
    ],
    en: [
      "🎨 In the live 'Track wetness' readout the icon is now large (hero) and the word is a smaller label — previously the icon was tiny and the text oversized.",
    ],
  },
  {
    v: "v1.4.80",
    date: "2026-08-01",
    tr: [
      "🏠 Başlığa 'Ana Menü' butonu eklendi: yarış ekranındayken her zaman görünür (katılım çubuğu kapalı olsa da) ve tek tıkla takımın yarış takvimine/lobiye döndürür. Mevcut 'Takvime Dön' de yerinde kalıyor.",
    ],
    en: [
      "🏠 Added a 'Main Menu' button to the header: while on the race screen it's always visible (even if the participation bar is collapsed) and returns you to the team's race calendar/lobby in one click. The existing 'Back to Calendar' button stays too.",
    ],
  },
  {
    v: "v1.4.79",
    date: "2026-08-01",
    tr: [
      "📡 Canlı Timing sekmesi artık tüm kullanıcılara açık (önceden yalnız site adminlerinde görünen test aşamasındaydı). Takım üyesi olan herkes yarışın canlı timing'ini görebilir; veri, takımın canlı düğümünden okunur (izin kuralları aynı).",
    ],
    en: [
      "📡 The Live Timing tab is now open to all users (it was in a test phase, previously visible only to site admins). Any team member can view the race's live timing; data is read from the team's live node (permission rules unchanged).",
    ],
  },
  {
    v: "v1.4.78",
    date: "2026-08-01",
    tr: [
      "🎨 Zemin ıslaklığı (track wetness) için özel ikon sistemi eklendi (Dry · Damp · Slightly Wet · Wet · Extremely Wet). Emoji yerine tek renkli mavi damla ikonları; ıslaklık arttıkça damla/birikinti/dalga sayısı artar. Hava planlayıcı butonları, canlı 'Zemin ıslaklığı' göstergesi, canlı öneri çipi, hava geçmişi, stint hava çubuğu ve dashboard'da ortak kullanılır (inline SVG — her boyutta net).",
    ],
    en: [
      "🎨 Added a dedicated track-wetness icon set (Dry · Damp · Slightly Wet · Wet · Extremely Wet). Single-hue blue droplet icons replace the emojis; more droplets/puddle/waves as it gets wetter. Used consistently across the weather planner buttons, the live 'Track wetness' readout, the live suggestion chip, weather history, the stint weather bar, and the dashboard (inline SVG — crisp at any size).",
    ],
  },
  {
    v: "v1.4.77",
    date: "2026-08-01",
    tr: [
      "🛠 Düzeltme: onaylı kullanıcılar bir takıma girmeden/yarış seçmeden setup yükleyemiyordu — 'Yükle' düğmesi sessizce hiçbir şey yapmıyordu. Artık takım şartı kaldırıldı: onaylı her kullanıcı (takımı olmasa da) ortak havuza setup yükleyebilir (pist seçmesi yeterli).",
      "🔒 Güvenlik: bir setup'ı artık yalnızca site admini silebilir (önceden yükleyen de silebiliyordu). Silme düğmesi yalnız adminde görünür ve sunucu kuralı da admin dışı silmeyi reddeder.",
    ],
    en: [
      "🛠 Fix: approved users couldn't upload a setup without first joining a team / selecting a race — the 'Upload' button silently did nothing. The team requirement is removed: any approved user (even without a team) can upload to the shared setup pool (just pick a track).",
      "🔒 Security: a setup can now be deleted only by a site admin (previously the uploader could too). The delete button shows only for admins, and the server rule also rejects non-admin deletes.",
    ],
  },
  {
    v: "v1.4.76",
    date: "2026-08-01",
    tr: [
      "🛠 Düzeltme: zemin ıslaklığı (track wetness) kademe eşikleri oyundan ölçülen gerçek aralıklara çekildi: Dry %0-4 · Damp %5-11 · Slightly Wet %12-39 · Wet %40-99 · Extremely Wet %100. Önceki eşikler tahminidi ve örn. ~%85 ıslaklığı yanlışlıkla 'Extremely Wet' gösteriyordu (artık 'Wet'; Extremely Wet yalnız tam %100'de). Bu, Hava kartındaki canlı öneri çipine, Canlı seans 'Zemin ıslaklığı' göstergesine ve plana tek noktadan uygulanır. (Yağış/rain kademeleri değişmedi.)",
    ],
    en: [
      "🛠 Fix: track-wetness stage thresholds now match the real ranges measured from the game: Dry 0-4% · Damp 5-11% · Slightly Wet 12-39% · Wet 40-99% · Extremely Wet 100%. The old thresholds were estimates and e.g. classified ~85% wetness as 'Extremely Wet' (now 'Wet'; Extremely Wet only at exactly 100%). This applies in one place to the Weather card's live suggestion chip, the Live session 'Track wetness' readout, and the plan. (Rainfall stages are unchanged.)",
    ],
  },
  {
    v: "v1.4.75",
    date: "2026-08-01",
    tr: [
      "🛠 Düzeltme: çok oyunculu (online) yarışta saha tablosunun Lastik sütununda her araç yanlışlıkla '%100' aşınma gösteriyordu (single-player'da doğru çalışıyordu). Sebep: oyun online rakip araçların lastik aşınmasını simüle/yayın etmiyor → değer '1.0 (yeni)' donuyor. Artık en az bir tur atmış bir araçta dört lastik de tam 1.0 ise bu 'veri yok' sayılıp sahte %100 gösterilmiyor (yalnız bileşim ikonu kalır); kendi aracın ve single-player aşınması eskisi gibi gerçek değerle görünür. (Bu düzeltme için sürüş PC'sinde masaüstü uygulaması güncellenmeli.)",
    ],
    en: [
      "🛠 Fix: in multiplayer (online) races the Field table's Tyres column wrongly showed '100%' wear for every car (it worked correctly in single-player). Cause: the game does not simulate/broadcast opponents' tyre wear online, so the value freezes at '1.0 (new)'. Now, if a car that has completed at least one lap reads exactly 1.0 on all four tyres, that's treated as 'no data' and the fake 100% is hidden (only the compound icon remains); your own car and single-player wear still show real values. (This fix needs the desktop app updated on the driving PC.)",
    ],
  },
  {
    v: "v1.4.74",
    date: "2026-08-01",
    tr: [
      "✨ Akıcı gaz/fren: Kendi Araç panosundaki gaz/fren (ve RPM) çubukları donarak/adım adım ilerliyordu; artık kareler arasında akıcı geçiyor.",
      "🛠 Düzeltme: oyun yeşilken Bayrak kartı ara sıra tüm sektörleri sarı ('full yellow') gösterip sallanıyordu. Bayrak artık öncelikle LMU'nun yetkili REST verisinden okunuyor (yeşil → yeşil); veri gelmezse yalnız tam pist sarısı (FCY) güvenle gösterilir, sahte lokal sarı üretilmez. (Bu düzeltme için sürüş PC'sinde masaüstü uygulamasının güncellenmesi gerekir.)",
      "🛞 Yeni 'Tutuş' göstergesi: TinyPedal'daki gibi pistin kauçuk kaplama (tutuş) yüzdesi — sahadaki turlardan modellenmiş bir TAHMİN (gerçek okuma değil); Canlı seans şeridinde görünür.",
    ],
    en: [
      "✨ Smooth throttle/brake: the throttle/brake (and RPM) bars in the Own Car dash used to advance in a frozen/stepping way; they now glide smoothly between frames.",
      "🛠 Fix: while the game was green, the Flag card sometimes showed every sector yellow ('full yellow') and flickered. The flag is now read primarily from LMU's authoritative REST data (green → green); if that's unavailable, only full-course yellow (FCY) is shown safely — no fake local yellows. (This fix needs the desktop app updated on the driving PC.)",
      "🛞 New 'Grip' indicator: like TinyPedal, an estimated track rubber (grip) percentage — a MODELED estimate from field laps (not a real reading); shown in the Live session strip.",
    ],
  },
  {
    v: "v1.4.73",
    date: "2026-08-01",
    tr: [
      "🛠 Düzeltme: Canlı Timing'de biz tur atmayıp geriye düştükçe sayfa kendiliğinden aşağı kayıyordu (oyuncu satırına otomatik kaydırma). Bu davranış kaldırıldı — sayfa artık yerinde duruyor; kendi satırın zaten vurgulu.",
    ],
    en: [
      "🛠 Fix: in Live Timing the page kept auto-scrolling down as we dropped positions without setting a lap time (auto-scroll to the player row). That behaviour was removed — the page now stays put; your own row is still highlighted.",
    ],
  },
  {
    v: "v1.4.72",
    date: "2026-08-01",
    tr: [
      "🗺 Pist haritasında yol artık ince çizgi değil, araç dairesi kalınlığında bir ŞERİT — hem iç hem dış haritada. Araçlar yolun içine oturuyor, daha okunur. S/F ve sektör çizgileri şeridi kesiyor.",
    ],
    en: [
      "🗺 On the track map the road is no longer a thin line but a BAND as thick as a car dot — on both the inner and outer map. Cars now sit inside the road, easier to read. The S/F and sector lines cross the band.",
    ],
  },
  {
    v: "v1.4.71",
    date: "2026-08-01",
    tr: [
      "🏎 Kendi Araç kartına canlı sürüş panosu eklendi: anlık HIZ (km/h), VİTES, ve GAZ (yeşil) / FREN (kırmızı) çubukları — artı ince bir RPM göstergesi. Oyundaki telemetriyle senkron akar; izleyiciler de görür.",
      "ℹ️ Gaz/fren HAM pedal girdisidir (sürücünün gerçek bastığı). Köprü değiştiği için sürüş PC'sindeki masaüstü uygulamasının güncellenmesi gerekir.",
    ],
    en: [
      "🏎 A live driving dash was added to the Own Car card: instant SPEED (km/h), GEAR, and THROTTLE (green) / BRAKE (red) bars — plus a slim RPM meter. It flows in sync with the game telemetry; viewers see it too.",
      "ℹ️ Throttle/brake are the RAW pedal input (what the driver actually presses). The bridge changed, so the desktop app on the driving PC must be updated.",
    ],
  },
  {
    v: "v1.4.70",
    date: "2026-08-01",
    tr: [
      "🎯 Strateji şeridi (Önünde/Arkanda/Temiz hava/Trafik/Pit çıkışı + Pit kaybı) artık ayrı kutu değil — Pist Haritası kutusunun en üstünde. Böylece harita ve strateji tek yerde.",
    ],
    en: [
      "🎯 The strategy strip (Ahead/Behind/Clean air/Traffic/Pit exit + Pit loss) is no longer a separate box — it sits at the top of the Track Map box. Map and strategy now live in one place.",
    ],
  },
  {
    v: "v1.4.69",
    date: "2026-08-01",
    tr: [
      "🗺 Pist haritasında artık S/F'nin yanında sektör ayırıcıları da var: biten sektörü gösteren 'S1' ve 'S2' çizgileri — hem dış halkada (radyal tik) hem iç şekilde (pisti kesen çizgi). Bir aracın hangi sektörde olduğu tek bakışta okunur.",
      "ℹ️ Sınırlar oyunun sektör verisinden (aracın sektör değiştiği tur mesafesinden) gözlemlenir; araçlar bir tur dönünce belirir ve takımca paylaşılır (izleyicilerde anında gelir). Not: köprü değiştiği için sürüş PC'sindeki masaüstü uygulamasının güncellenmesi gerekir.",
    ],
    en: [
      "🗺 The track map now shows sector dividers alongside S/F: 'S1' and 'S2' lines marking the end of each sector — on both the outer ring (radial tick) and the inner shape (a line across the track). You can read at a glance which sector a car is in.",
      "ℹ️ The boundaries are observed from the game's sector data (the lap distance where a car changes sector); they appear after cars complete a lap and are shared team-wide (instant for viewers). Note: the bridge changed, so the desktop app on the driving PC must be updated.",
    ],
  },
  {
    v: "v1.4.68",
    date: "2026-08-01",
    tr: [
      "🛞 Saha tablosunda Lastik ve Hamur sütunları TEK sütunda birleşti: artık hamur ikonu + aşınma yüzdesi (ör. 🟡M %40). Karışık kullanımda ön/arka iki ikon. Renkli aşınma noktası kaldırıldı — daha sade.",
      "🔧 Pit lastik değişimi (kaç lastik + hangi hamur) artık tablodaki 🛠 rozetinde değil, bir aracın satırındaki '+' ile açılan TUR GEÇMİŞİNDE görünüyor: pit atılan turda 'N× hamur ikonu' (ör. 25. tur → 4× Medium). Böylece hangi turda ne aldığı kalıcı kayıt.",
      "ℹ️ Not: pit lastik kaydı köprüden yazıldığı için sürüş PC'sindeki masaüstü uygulamasının güncellenmesi gerekir; kayıt o andan sonraki pitler için başlar. Telemetrisi olmayan rakipte işaret çıkmayabilir.",
    ],
    en: [
      "🛞 The field table's Tyre and Compound columns merged into ONE: now the compound icon + wear percentage (e.g. 🟡M 40%). Two icons for a front/rear split. The coloured wear dot was removed — cleaner.",
      "🔧 Pit tyre changes (how many tyres + which compound) no longer sit in the table's 🛠 badge; they now appear in the LAP HISTORY opened via a car's '+': at the pit lap, 'N× compound icon' (e.g. lap 25 → 4× Medium). A permanent record of what was fitted when.",
      "ℹ️ Note: the pit tyre record is written by the bridge, so the desktop app on the driving PC must be updated; recording starts from pit stops after that. A rival without telemetry may show no marker.",
    ],
  },
  {
    v: "v1.4.67",
    date: "2026-08-01",
    tr: [
      "🛞 Hamur sütunu artık ÖN ve ARKA farklı hamur takan araçlarda iki ikon gösteriyor (ör. ön Medium · arka Soft). Aynıysa tek ikon. Tooltip'te 'Ön: … · Arka: …' yazıyor.",
      "ℹ️ Not: oyun rakip araçlar için hamuru yalnızca ön/arka olarak veriyor — paylaşımlı bellekte tekerlek başına (sol/sağ) hamur verisi yok, o yüzden sol/sağ ayrımı rakiplerde gösterilemiyor.",
    ],
    en: [
      "🛞 The Compound column now shows two icons for cars running different FRONT and REAR compounds (e.g. front Medium · rear Soft). If they're the same, one icon. The tooltip reads 'Front: … · Rear: …'.",
      "ℹ️ Note: the game only exposes compound as front/rear for rival cars — there's no per-wheel (left/right) compound in shared memory, so a left/right split can't be shown for rivals.",
    ],
  },
  {
    v: "v1.4.66",
    date: "2026-08-01",
    tr: [
      "🛞 Saha tablosuna 'Hamur' sütunu eklendi: her aracın taktığı lastik hamuru oyundaki ikonuyla görünüyor — Soft (beyaz S), Medium (sarı M), Hard (kırmızı H), Wet (mavi W). Yağmur gelince kimin ıslak lastiğe geçtiğini tek bakışta görürsün.",
      "ℹ️ Hamur adı köprüden zaten geliyordu (v1.4.65, telemetriden); artık ayrı sütunda ikonlu. Oyun tanımadığımız bir ad verirse ham kısaltma gösterilir (uydurma yok). Rakip telemetrisi bayatsa ikon soluklaşır.",
    ],
    en: [
      "🛞 A 'Compound' column was added to the field table: each car's fitted tyre compound shows with the game's own icon — Soft (white S), Medium (yellow M), Hard (red H), Wet (blue W). See at a glance who switched to wets when rain arrives.",
      "ℹ️ The compound name already came from the bridge (v1.4.65, from telemetry); now it has its own icon column. If the game reports a name we don't recognise, the raw short text is shown (nothing invented). If a rival's telemetry is stale, the icon dims.",
    ],
  },
  {
    v: "v1.4.65",
    date: "2026-08-01",
    tr: [
      "🛠 Saha tablosunda rakiplerin pit'te KAÇ lastik değiştirdiği görünüyor: Lastik sütununun yanında '🛠2 ÖN', '🛠4' ya da '🛠0' rozeti. İki lastiklik kısa duraklar artık gözden kaçmıyor; rozet bir sonraki pite kadar kalır.",
      "🛞 Lastik yüzdesinin üstüne gelince dört köşe ayrı ayrı görünüyor (ÖnSol · ÖnSağ · ArkaSol · ArkaSağ) — sütundaki tek sayı EN KÖTÜ lastiği gösteriyor, artık hangisi olduğu belli.",
      "🌧 Rakibin lastik bileşimi de okunuyor. Pit'te bileşim değişirse rozet '🛠4→Wet' gibi vurgular — yağmur başlarken kimin ıslak lastiğe geçtiğini anında görürsün.",
      "⚠️ Rakip telemetrisi güncellenmiyorsa (online yarışta olabiliyor) lastik noktası soluklaşır ve ipucunda uyarı çıkar — donmuş bir değer gerçekmiş gibi gösterilmez.",
    ],
    en: [
      "🛠 The field table now shows how many tyres rivals changed at their stop: a '🛠2 FRONT', '🛠4' or '🛠0' badge next to the Tyre column. Short two-tyre stops no longer slip past; the badge stays until their next stop.",
      "🛞 Hover the tyre percentage to see all four corners separately (FL · FR · RL · RR) — the single number in the column is the WORST tyre, and now you can tell which one that is.",
      "🌧 Rival tyre compound is read too. If the compound changes at a stop the badge highlights it as '🛠4→Wet' — so you see instantly who switched to wets as rain arrives.",
      "⚠️ If a rival's telemetry isn't updating (which happens online), the tyre dot dims and the tooltip warns you — a frozen value is never presented as fact.",
    ],
  },
  {
    v: "v1.4.64",
    date: "2026-08-01",
    tr: [
      "🌦 Yeni: Canlı sekmesinde 'Hava Kalibrasyonu' paneli (yalnız düzenleyiciler, kapalı gelir). Oyundaki zemin durumu yazısı değiştiğinde aynı kelimeye basarsın, o anın ıslaklık/yağış yüzdesi kaydedilir; birkaç damga sonra 'Dışa aktar' ile JSON alırsın. Kayıtlar cihazında kalır, odaya gönderilmez.",
      "🔎 Köprüye '--dump-wx' teşhis modu: oyunun KENDİ gökyüzü sözlüğünü (Clear/Light Rain/… ) yerel API'sinden basar, altında saniyede bir canlı ıslaklık ve yağış yüzdesini gösterir.",
      "ℹ️ Neden: v1.4.63'teki kademe eşikleri tahmindi. Araştırmada oyunun ıslaklığı hiçbir yerde kelime olarak vermediği kesinleşti (paylaşımlı bellekte ve REST'in tamamında yalnız sayı) — bu yüzden eşikleri ölçümle doğrulayacak araçlar eklendi. Kademe tabloları bu sürümde DEĞİŞMEDİ; ölçüm sonrası düzeltilecek.",
    ],
    en: [
      "🌦 New: a 'Weather Calibration' panel on the Live tab (editors only, collapsed by default). When the game's track condition wording changes you press the matching word, and the current wetness/rain percentage is recorded; after a few stamps, 'Export' gives you a JSON. Records stay on your device and are not sent to the room.",
      "🔎 New bridge diagnostic mode '--dump-wx': prints the game's OWN sky vocabulary (Clear/Light Rain/…) from its local API, then the live wetness and rain percentages once per second.",
      "ℹ️ Why: the level thresholds in v1.4.63 were estimates. Research confirmed the game never exposes wetness as a word (only numbers, both in shared memory and across the whole REST API) — so these tools were added to verify the thresholds by measurement. The level tables are UNCHANGED in this release; they'll be corrected once measurements come in.",
    ],
  },
  {
    v: "v1.4.63",
    date: "2026-08-01",
    tr: [
      "🌧 Canlı seans şeridinde yağış ve zemin ıslaklığı artık yüzde değil, oyundaki KELİMELERLE yazıyor: yağış No Rain · Drizzle · Light Rain · Rain · Heavy Rain; zemin Dry · Damp · Slightly Wet · Wet · Extremely Wet. Ham yüzde kayıp değil — kutunun üstüne gelince görünüyor.",
      "🌊 Hava planına 5. kademe eklendi: Extremely Wet (tur ve yakıt çarpanlarıyla). Hava seçicide artık beş düğme var; canlı öneri çipi de bu kademeyi önerebiliyor ve yağışı kelimeyle gösteriyor.",
      "ℹ️ Kademe adı ZEMİN ıslaklığından türetilir (lastik kararını pistin durumu belirler; yağmur dinse de pist ıslak kalır). Yağış yalnız bilgi olarak gösterilir. Eşikler tek yerde durur — gerçek yarışta oyunun kelimeleriyle kayarsa tek dokunuşla ayarlanır.",
    ],
    en: [
      "🌧 In the live session bar, rainfall and track wetness now read as the game's WORDS instead of a percentage: rain as No Rain · Drizzle · Light Rain · Rain · Heavy Rain; ground as Dry · Damp · Slightly Wet · Wet · Extremely Wet. The raw percentage isn't lost — hover the card to see it.",
      "🌊 A 5th weather step was added to the plan: Extremely Wet (with its own lap and fuel multipliers). The weather picker now has five buttons, and the live suggestion chip can propose that step and names the rainfall in words.",
      "ℹ️ The step name is derived from GROUND wetness (the track's state drives the tyre call; rain can stop while the track stays wet). Rainfall is shown as information only. Thresholds live in one place — if they drift from the game's wording in a real race, they're a one-line adjustment.",
    ],
  },
  {
    v: "v1.4.62",
    date: "2026-08-01",
    tr: [
      "📡 Canlı veri akışı durunca (oyun/köprü kapanınca) Canlı Timing ekranı artık eski veriyle dolu kalmıyor — 'çevrimdışı' etiketiyle tek kutuya iniyor. Böylece kimse ekranı canlı/açık sanmıyor. Veri dönünce tam ekran geri gelir; kısa (30 sn altı) kesintilerde tablo korunur.",
    ],
    en: [
      "📡 When the live data feed stops (game/bridge closed), the Live Timing screen no longer stays full of stale data — it collapses to a single box marked 'offline'. So nobody mistakes it for live. The full screen returns when data resumes; brief (<30s) hiccups keep the table.",
    ],
  },
  {
    v: "v1.4.61",
    date: "2026-08-01",
    tr: [
      "🔗 Stint planı canlı timing'e senkronlandı — elle yapılan işlerin gerçeği artık köprüden geliyor:",
      "🤖 Oto PIT: araç pit yoluna girince ✔ PIT kendiliğinden işaretleniyor (plan gerçeğe kilitlenir; buton yedek olarak duruyor, ↩ Geri Al çalışıyor). Yalnız canlı kaynağı yazan PC tetikler — çift yazma olmaz. Aç/kapa: pit panosundaki 🤖 Oto PIT anahtarı",
      "⏱ Oto Saat: planın geri sayımı oyunun kalan süresinden 5 sn'den fazla kayarsa yarış başlangıç zamanı kendiliğinden hizalanıyor — geri sayımlar, sıradaki pit ve pilot programı oyunla birebir gider. Kayma her cihazda çip olarak görünür",
      "🌧 Hava önerisi: oyunda yağmur/ıslaklık plandaki havadan sapınca hava kartında tek tıklık öneri çıkıyor ('Canlı: %38 → Slightly Wet geçişi ekle') — planı onayın olmadan değiştirmez",
      "⚡ Canlı AVG5 önerisi: son 5 turun canlı ortalaması plandaki Avg Lap'ten saparsa Yarış·Data kartında tek tıkla uygulanabilir öneri görünür",
      "⚠ Pit tutarsızlık uyarısı: oyundaki pit sayısı ile planda işaretli pit sayısı ayrışırsa pit panosunda uyarı",
    ],
    en: [
      "🔗 The stint plan is now synced to live timing — manual chores are fed by the bridge's real data:",
      "🤖 Auto PIT: when the car enters the pit lane, ✔ PIT is marked automatically (plan locks to reality; the button remains as backup, ↩ Undo works). Only the PC writing the live feed triggers it — no double writes. Toggle: 🤖 Auto PIT on the pit board",
      "⏱ Auto Clock: if the plan's countdown drifts more than 5s from the game's remaining time, the race start time realigns itself — countdowns, next pit and the driver schedule track the game exactly. The drift shows as a chip on every device",
      "🌧 Weather suggestion: when in-game rain/wetness diverges from the plan's weather, a one-click suggestion appears on the weather card ('Live: 38% → add Slightly Wet transition') — it never changes the plan without your approval",
      "⚡ Live AVG5 suggestion: when the live 5-lap average drifts from the plan's Avg Lap, a one-click apply chip appears in the Race·Data card",
      "⚠ Pit mismatch warning: if the game's pit-stop count and the plan's marked pits diverge, the pit board warns you",
    ],
  },
  {
    v: "v1.4.60",
    date: "2026-08-01",
    tr: [
      "🛞 Geri alındı: taşınan (aynı) lastiği hücreden seçmek YİNE pit'te lastik işlemi sayılıyor — oyunda eski lastiği pitte geri takmak gerçekten süre kaybettiriyor (v1.4.59 bunu yanlışlıkla 'değişim değil' saymıştı). Değişim istemiyorsan hücreyi boş bırak (⟳ taşıma).",
      "🛞 v1.4.59'un gerçek düzeltmeleri korunuyor: sonraki pit'lerin bayat kalması ve 'Tümünü Temizle'nin pit seçimlerini bırakması düzeltilmiş durumda.",
    ],
    en: [
      "🛞 Reverted: explicitly selecting the carried (same) tyre in a cell once again counts as a pit tyre action — refitting the old tyre in the pit really does cost time in the game (v1.4.59 wrongly treated it as 'no change'). If you don't want a change, leave the cell empty (⟳ carry).",
      "🛞 The real fixes from v1.4.59 remain: stale later-pit flags and 'Clear All' leaving pit selections behind are still fixed.",
    ],
  },
  {
    v: "v1.4.59",
    date: "2026-08-01",
    tr: [
      "🛞 Lastik planı düzeltmeleri: taşınan (zaten araçtaki) lastiği menüden yeniden seçmek pit'te 'lastik değişimi' sayılıp plana 5-12 sn ekliyordu — artık fiziksel değişim olmayan seçimler pit süresine yansımıyor",
      "🛞 Aradaki bir stint hücresi silinince SONRAKİ pit'lerin lastik bayrakları güncellenmiyordu (taşıma zinciri değişir) — pit bayrakları artık tablodan taşıma-farkındalıklı türetiliyor",
      "🛞 Lastik sekmesindeki 'Tümünü Temizle' pit'lerdeki lastik seçimlerini bırakıyordu — tablo boşken plan lastik süresi eklemeye devam ediyordu; artık birlikte sıfırlanıyor",
      "🛞 Stint tablosundaki köşe tıklama döngüsü fiziksel karşılığı olmayan durumları atlıyor (ör. Qual lastiği zaten araçtayken 'Qual'a dön')",
      "🧹 Kartların altındaki açıklama metinleri kaldırıldı — arayüz sadeleşti (uyarılar ve canlı durum mesajları duruyor)",
    ],
    en: [
      "🛞 Tyre plan fixes: re-selecting the carried (already fitted) tyre counted as a 'tyre change' in the pit, adding 5-12s to the plan — selections that aren't a physical change no longer affect pit time",
      "🛞 Clearing an intermediate stint cell didn't refresh LATER pits' tyre flags (the carry chain changes) — pit flags are now derived carry-aware from the table",
      "🛞 'Clear All' in the Tyres tab left pit tyre selections behind — the plan kept charging tyre time with an empty table; they now reset together",
      "🛞 The corner click-cycle in the stint table now skips states with no physical meaning (e.g. 'back to Qual' while the Qual tyre is already on the car)",
      "🧹 Removed the explanatory text under each card — cleaner UI (warnings and live status messages remain)",
    ],
  },
  {
    v: "v1.4.58",
    date: "2026-08-01",
    tr: [
      "👤 Tur geçmişinde PİLOT sütunu: saha tablosundaki '+' ile açılan tur listesinde artık her turun yanında o turu kimin attığı yazıyor — 8 saatlik yarışta 3 pilot dönerken hangi turun kimin olduğu belli oluyor",
      "🔁 Pilot değişimi vurgulanıyor: direksiyonun el değiştirdiği tur ince bir çizgi ve renkli pilot adıyla işaretleniyor — stint sınırları tek bakışta görünüyor",
    ],
    en: [
      "👤 DRIVER column in the lap history: the lap list opened with '+' in the field table now shows who drove each lap — in an 8-hour race with 3 drivers rotating, you can tell whose lap is whose",
      "🔁 Driver changes are highlighted: the lap where the car changed hands is marked with a rule and a colored driver name — stint boundaries are visible at a glance",
    ],
  },
  {
    v: "v1.4.57",
    date: "2026-07-31",
    tr: [
      "🟡 Sarı bayraklar düzeltildi: oyunda sarı bayrak varken uygulama Green gösteriyordu — LOKAL sektör sarıları (kaza/spin) hiç okunmuyordu, yalnız tam pist sarısı (FCY) izleniyordu. Artık bayrak kartı 'Yellow S2' gibi hangi sektörde sarı olduğunu da söylüyor; Green yeşil, Yellow/FCY sarı renkte",
      "🚩 İki ek bayrak hatası: oyunun 'geçersiz' işareti (255) yanlışlıkla sarı sayılabiliyordu; tam pist sarısı durumları (pit kapalı/açık vb.) 'Yellow' yerine doğru şekilde 'FCY' olarak sınıflanıyor",
    ],
    en: [
      "🟡 Yellow flags fixed: the app showed Green while a yellow flag was out in the game — LOCAL sector yellows (crash/spin) were never read, only the full-course yellow (FCY) state. The flag card now also tells you which sector is yellow ('Yellow S2'); Green renders green, Yellow/FCY yellow",
      "🚩 Two more flag bugs: the game's 'invalid' marker (255) could be miscounted as yellow; full-course-yellow states (pits closed/open etc.) are now correctly classified as 'FCY' instead of 'Yellow'",
    ],
  },
  {
    v: "v1.4.56",
    date: "2026-07-31",
    tr: [
      "🗺 Pist haritası artık akıcı: araç noktaları kareler arasında kayarak ilerliyor (yarım saniyede bir zıplama yok); sollamada nokta animasyonu da kesilmiyor",
      "📊 AVG5/AVG yanıp sönmesi düzeltildi: oyunun paylaşımlı belleği tam yazım anında okununca 'yırtık' kare gelebiliyor, tur sayısı bir anlığına düşük görünüyor ve ortalama geçmişi sıfırlanıyordu — artık veriler sürüm-kontrollü tutarlı kopyayla okunuyor ve tek karelik düşüşler yok sayılıyor",
      "🌡 Kendi Araç lastik sıcaklığı artık İÇ (karkas) sıcaklık — pit duvarı için anlamlı olan bu; eskiden anlık/oynak yüzey sıcaklığı gösteriliyordu",
      "⏱ Kendi Araç kartına S3 eklendi (S1 / S2 / S3); ayrıca S2 artık gerçek sektör süresi (eskiden S1+S2 toplamı gösteriliyordu)",
    ],
    en: [
      "🗺 The track map is now fluid: car dots glide between frames (no more half-second jumps), and overtakes no longer break the dot animation",
      "📊 Fixed AVG5/AVG flickering: reading the game's shared memory mid-write could produce a 'torn' frame where the lap count briefly looked lower, resetting the average history — data is now read via a version-checked consistent copy and single-frame dips are ignored",
      "🌡 Own Car tyre temperature is now the INNER (carcass) temperature — the one that matters on the pit wall; previously the volatile surface temperature was shown",
      "⏱ Added S3 to the Own Car card (S1 / S2 / S3); S2 is now the real sector time (previously the cumulative S1+S2 was shown)",
    ],
  },
  {
    v: "v1.4.55",
    date: "2026-07-31",
    tr: [
      "🗺 Pist haritasının iç şekli artık takımca kaydediliyor: bir kez oluşan devre şekli o pist için Firebase'de saklanıyor → sayfayı yenilediğinde, sekme değiştirdiğinde ya da başka bir takım arkadaşın (hiç sürmese bile) haritayı açtığında şekil SIFIRDAN çizilmiyor, anında dolu geliyor. (Şekli takımca yazan yalnız owner/editor'dür; herkes okur.)",
      "🌧 Session bölümüne oyunun gerçek yağmur şiddeti (%) ve zemin ıslaklığı (%) eklendi — artık yalnız 'Kuru/Yağmur' değil, canlı yüzdeler görünüyor.",
      "🏁 Seans adı (Antrenman / Sıralama / Yarış) session göstergelerine taşındı — hangi seansta olduğun tek bakışta belli.",
    ],
    en: [
      "🗺 The track map's inner shape is now saved for the whole team: once the circuit shape is built it's stored in Firebase for that track → on a page refresh, tab switch, or when a teammate (even one who never drove) opens the map, it no longer redraws from scratch — it appears instantly. (Only owner/editor writes the shared shape; everyone reads it.)",
      "🌧 The session panel now shows the game's real rain intensity (%) and track wetness (%) — not just 'Dry/Rain' but live percentages.",
      "🏁 The session name (Practice / Qualifying / Race) moved into the session indicators — one glance tells you which session you're in.",
    ],
  },
  {
    v: "v1.4.54",
    date: "2026-07-31",
    tr: [
      "🗺 Pist haritası artık istenince büyük pencerede açılıyor: kart başlığındaki '⛶ Büyüt' düğmesiyle harita ekranı kaplayan ayrı bir pencerede, çok daha büyük gösteriliyor — kalabalık sahada araç noktaları ve sınıf-içi pozisyon numaraları rahatça okunuyor. Harita canlı akmaya devam eder; ✕ / boşluğa tık / Esc ile kapanır",
    ],
    en: [
      "🗺 The track map can now be opened in a large window on demand: the '⛶ Expand' button in the card header shows the map much bigger in a separate overlay — car dots and in-class position numbers stay readable even in a crowded field. The map keeps updating live; close with ✕ / click outside / Esc",
    ],
  },
  {
    v: "v1.4.53",
    date: "2026-07-31",
    tr: [
      "🧮 Stint planı: 'Avg Lap' ya da strateji tur sayısı alanı boşaltıldığında tablo 64 sahte stint satırına şişiyordu (üstelik odadaki herkeste). Artık plan üretilmiyor ve nedenini söyleyen bir uyarı çıkıyor",
      "🏁 Tur sayısını '+' ile yarışa sığmayacak kadar artırınca stint bayrağın ötesine taşıyordu (End Stint yarış süresinden büyük, Time Left eksi, zaman çizelgesi ve pilot şeridi hizasını kaybediyordu) — artık süre override'ıyla aynı şekilde bayrakta bitiyor",
      "⛽ PIT tuşuna araç pit yolundayken ikinci kez basmak, pit yolunda geçen saniyeleri stint süresine ekleyip kaydı bozuyordu — tuş artık pit boyunca pasif ('PIT YOLUNDA'); düzeltmek için ↩ Geri Al",
      "⏱ Gerçek pitler plandan erken işaretlendiğinde yarışın sonunda 'stint süresi' tüm yarışı gösteriyordu — artık son pit çıkışından sayıyor",
      "🚩 Son stintte pit olmadığı hâlde 'Sıradaki Pit' yazıp son 5 dakikada sarı pit alarmı veriyordu — artık 'Bayrağa' yazıyor, yanlış alarm yok",
      "⚡ 'Toplam VE' göstergesi karma havada (ör. yarışın sonuna doğru yağmur) tablodaki stint toplamıyla tutmuyordu — 2:24'lük bir yarışta ~18 L'ye varan sapma; artık satırların gerçek toplamı",
      "⚠️ Plan 64 stint sınırına takılırsa (çok uzun yarış + çok kısa stint) sessizce yarım kalıyordu — artık ne kadarının planlanmadığını söylüyor",
      "🖨 Pilot Programı PDF'inde son satır vurgusu çalışmıyordu",
    ],
    en: [
      "🧮 Stint plan: clearing the 'Avg Lap' or strategy lap-count field inflated the table to 64 phantom stint rows (for everyone in the room). The plan is no longer computed and a warning explains why",
      "🏁 Bumping a stint's lap count past what fits in the race pushed the stint beyond the flag (End Stint greater than race time, negative Time Left, timeline and driver lane losing alignment) — it now ends at the flag, exactly like a time override",
      "⛽ Pressing PIT a second time while the car was in the pit lane added the pit-lane seconds to the stint duration and corrupted the record — the button is now disabled during the pit ('IN PIT LANE'); use ↩ Undo to correct",
      "⏱ When real pits were marked earlier than planned, the 'stint time' showed the whole race near the end — it now counts from the last pit exit",
      "🚩 The final stint has no pit, yet it said 'Next Pit' and raised a yellow pit alarm in the last 5 minutes — it now says 'To Flag', with no false alarm",
      "⚡ The 'Total VE' figure disagreed with the stint table in mixed weather (e.g. rain late in the race) — up to ~18 L off in a 2:24 race; it is now the real sum of the rows",
      "⚠️ If the plan hit the 64-stint ceiling (very long race + very short stints) it was silently left half-done — it now reports how much went unplanned",
      "🖨 The last-row highlight in the Driver Programme PDF never worked",
    ],
  },
  {
    v: "v1.4.52",
    date: "2026-07-31",
    tr: [
      "🔑 Pilot değişimi artık aracın canlı geçmişini silmiyor: canlı timing aracı sürücü ADIYLA takip ettiği için, endurance'ta direksiyon değişince aynı araç yeni bir kayıt gibi başlıyordu — '+' tur listesi yarışın başını kaybediyor, pozisyon grafiğinde araç her değişimde yeni bir çizgi oluyor, ortalamalar sıfırlanıyordu. Artık araç kimliğiyle takip ediliyor; geçmiş kesintisiz. (Aynı isimli iki araç sorunu da çözüldü)",
      "⚡ Virtual Energy daha dayanıklı: LMU değeri yüzde olarak gönderirse ya da beklenmedik bir aralıkta verirse VE sütunu sessizce boşalabiliyordu — artık yedek okuma devreye giriyor",
      "📈 Pozisyon grafiği temizlendi: yarışta artık bulunmayan araçların eski kayıtları renksiz/etiketsiz çizgi olarak çiziliyordu",
    ],
    en: [
      "🔑 Driver changes no longer wipe a car's live history: live timing tracked cars by driver NAME, so in endurance racing a driver swap made the same car start over as a new entry — the '+' lap list lost the start of the race, the position chart drew a new line per stint, and averages reset. Cars are now tracked by car identity, so history is continuous. (Two cars sharing a driver name is fixed too)",
      "⚡ Virtual Energy is more robust: if LMU reports the value as a percentage or in an unexpected range, the VE column could silently go empty — a fallback read now kicks in",
      "📈 Position chart cleaned up: stale records from cars no longer in the race were drawn as unlabeled, colorless lines",
    ],
  },
  {
    v: "v1.4.51",
    date: "2026-07-31",
    tr: [
      "⛽ 'Canlıdan Öğren' artık gerçekten çalışıyor: canlı yakıt öğrenici tüketimi yanlışlıkla tur yerine yarım saniyelik aralıklarla ölçtüğü için hiçbir zaman örnek toplayamıyordu — litre/tur ve VE %/tur boş kalıyor, Kendi Araç'taki '~N tur kaldı' tahmini hiç görünmüyordu. Artık tur tur öğreniyor",
      "🐛 Strateji rozetlerinde '1:60.0' gibi hatalı süreler düzeltildi (süre biçimleyici tek merkeze alındı)",
      "🗺 Pist haritası düzeltildi: seans başında garajda/pit yolunda duran araçların konumu devre şekline kalıcı olarak işleniyordu (harita çarpık çıkıyordu). Artık şekil yalnız pistteki araçlardan oluşuyor",
      "🔌 Bağlantı rozeti artık sunucu saatine göre: yayınlayan ve izleyen bilgisayarların saatleri farklıysa veri akarken bile 'bağlantı koptu' yazabiliyordu",
      "🐛 Aralık sütunu 2. sıradaki araçta boş kalıyordu — düzeltildi",
    ],
    en: [
      "⛽ 'Learn from live' actually works now: the live fuel learner measured consumption over half-second frames instead of over a lap, so it never collected a single sample — litres/lap and VE %/lap stayed empty and the '~N laps left' estimate on Own Car never appeared. It now learns lap by lap",
      "🐛 Fixed malformed durations like '1:60.0' on the strategy chips (duration formatting is now in one place)",
      "🗺 Fixed the track map: cars sitting in the garage/pit lane at session start were permanently baked into the circuit outline (making the map skewed). The shape is now built only from cars out on track",
      "🔌 The connection badge now uses server time: if the broadcasting and viewing PCs had different clocks it could show 'disconnected' while data was flowing fine",
      "🐛 The Interval column stayed empty for the car in 2nd place — fixed",
    ],
  },
  {
    v: "v1.4.50",
    date: "2026-07-31",
    tr: [
      "🐛 Canlı timing'de yanlış '+1 Tur' düzeltildi: lider start/finish çizgisini geçtiği anda, aynı turda olan araçlar Gap sütununda tur-altı gibi görünüyordu. Artık oyunun kendi tur-altı verisi kullanılıyor (Aralık sütununda da)",
      "🐛 Tur geçmişi numaraları düzeltildi: bir tur geçersiz sayılırsa (ya da köprü bir kare kaçırırsa) sonraki tüm turlar bir kaydırılarak kaydediliyordu — '+' listesindeki, pozisyon grafiğindeki ve sektörlerdeki tur numaraları yanlış oluyordu. Artık gerçek tur numaraları köprüden geliyor",
      "🐛 Gap/Aralık gösteriminde '+1:60.0' gibi hatalı değerler düzeltildi",
      "⚡ Canlı kare küçüldü: kendi araç bilgisinde gereksiz yere her saniye gönderilen tur listesi kaldırıldı",
    ],
    en: [
      "🐛 Fixed wrong '+1 Lap' in live timing: the moment the leader crossed the start/finish line, cars on the same lap appeared lapped in the Gap column. The game's own laps-behind data is now used (in the Interval column too)",
      "🐛 Fixed lap-history numbering: if a lap was counted invalid (or the bridge missed a frame), every following lap was stored shifted by one — lap numbers in the '+' list, the position chart and the sectors were wrong. Real lap numbers now come from the bridge",
      "🐛 Fixed malformed values like '+1:60.0' in the Gap/Interval display",
      "⚡ Smaller live frame: the lap list that was needlessly sent every second inside own-car data was removed",
    ],
  },
  {
    v: "v1.4.49",
    date: "2026-07-31",
    tr: [
      "🐛 Tur süresi gösterimi düzeltildi: saniyesi 60'a yuvarlanan turlar (ör. 119.996 sn) yanlışlıkla '1:60.00' görünüyordu, artık doğru şekilde '2:00.00' oluyor. Ayrıca negatif değerler (delta) doğru biçimleniyor",
    ],
    en: [
      "🐛 Fixed lap-time display: laps whose seconds rounded up to 60 (e.g. 119.996 s) wrongly showed as '1:60.00'; now correctly '2:00.00'. Negative values (deltas) are also formatted correctly",
    ],
  },
  {
    v: "v1.4.48",
    date: "2026-07-31",
    tr: [
      "🧪 Test altyapısı: App.jsx'ten çıkarılan 5 modal bileşeni (sürüm/yarış/sohbet/setup/takım) için smoke-render testleri eklendi — sahte prop'larla render edilip çökmedikleri (eksik prop / tanımsız referans) otomatik doğrulanıyor. Kullanıcı arayüzü değişmedi",
    ],
    en: [
      "🧪 Test infrastructure: added smoke-render tests for the 5 modal components extracted from App.jsx (version/race/chat/setup/team) — they're rendered with mock props and verified not to crash (missing prop / undefined reference). No UI change",
    ],
  },
  {
    v: "v1.4.47",
    date: "2026-07-31",
    tr: [
      "🧹 İç yeniden düzenleme (davranış aynı): App.jsx render bölme tamamlandı — setup havuzu penceresi (SetupModal) ve takım penceresi (TeamModal, en büyük) ayrı sunum bileşenlerine taşındı. Tüm modallar artık components.jsx'te. Kullanıcı arayüzü değişmedi",
    ],
    en: [
      "🧹 Internal refactor (same behavior): App.jsx render split complete — the setup library window (SetupModal) and the team window (TeamModal, the largest) moved into their own presentational components. All modals now live in components.jsx. No UI change",
    ],
  },
  {
    v: "v1.4.46",
    date: "2026-07-31",
    tr: [
      "🧹 İç yeniden düzenleme (davranış aynı): App.jsx render bölme 3. tur — sohbet penceresi (ChatModal) ayrı bir sunum bileşenine taşındı. Kullanıcı arayüzü değişmedi",
    ],
    en: [
      "🧹 Internal refactor (same behavior): App.jsx render split round 3 — the chat window (ChatModal) moved into its own presentational component. No UI change",
    ],
  },
  {
    v: "v1.4.45",
    date: "2026-07-31",
    tr: [
      "🧹 İç yeniden düzenleme (davranış aynı): App.jsx render bölme 2. tur — yarış ekleme/düzenleme penceresi (RaceEditModal) ayrı bir sunum bileşenine taşındı; kaydetme iş mantığı App'te kaldı. Kullanıcı arayüzü değişmedi",
    ],
    en: [
      "🧹 Internal refactor (same behavior): App.jsx render split round 2 — the add/edit race window (RaceEditModal) moved into its own presentational component; save logic stays in App. No UI change",
    ],
  },
  {
    v: "v1.4.44",
    date: "2026-07-31",
    tr: [
      "🧹 İç yeniden düzenleme (davranış aynı): App.jsx render bölme başladı — sürüm notları penceresi (VersionModal) ayrı bir sunum bileşenine taşındı. Kullanıcı arayüzü değişmedi",
    ],
    en: [
      "🧹 Internal refactor (same behavior): App.jsx render split started — the version-notes window (VersionModal) moved into its own presentational component. No UI change",
    ],
  },
  {
    v: "v1.4.43",
    date: "2026-07-31",
    tr: [
      "🧹 İç yeniden düzenleme (davranış aynı): App.jsx bölme 6. tur — telemetri (MoTeC içe aktarma, %105 kuralı, stint analizi, kutu/çizgi grafik) useTelemetry hook dosyasına çıkarıldı; kullanılmayan ölü kod temizlendi. Kullanıcı arayüzü değişmedi",
    ],
    en: [
      "🧹 Internal refactor (same behavior): App.jsx split round 6 — telemetry (MoTeC import, 105% rule, stint analysis, box/line chart) moved into the useTelemetry hook file; dead code removed. No UI change",
    ],
  },
  {
    v: "v1.4.42",
    date: "2026-07-31",
    tr: [
      "🧹 İç yeniden düzenleme (davranış aynı): App.jsx bölme 5. tur — işbirlikçi yarış-durumu senkronizasyonu (debounce yazma + canlı dinleme, son yazan kazanır) useRaceSync hook dosyasına çıkarıldı. Kullanıcı arayüzü ve senkron davranışı değişmedi",
    ],
    en: [
      "🧹 Internal refactor (same behavior): App.jsx split round 5 — collaborative race-state sync (debounced write + live listen, last-writer-wins) moved into the useRaceSync hook file. No UI or sync behavior change",
    ],
  },
  {
    v: "v1.4.41",
    date: "2026-07-31",
    tr: [
      "🧹 İç yeniden düzenleme (davranış aynı): App.jsx bölme 4. tur — setup deposu (liste, yükleme, indirme, süzgeç) useSetups hook dosyasına çıkarıldı. Kullanıcı arayüzü değişmedi",
    ],
    en: [
      "🧹 Internal refactor (same behavior): App.jsx split round 4 — the setup library (list, upload, download, filter) moved into the useSetups hook file. No UI change",
    ],
  },
  {
    v: "v1.4.40",
    date: "2026-07-31",
    tr: [
      "🧹 İç yeniden düzenleme (davranış aynı hedefleniyor): App.jsx bölme 3. tur — sohbet mantığı (kanallar, okunmamış sayacı, bildirim sesi, okundu takibi) useChat hook dosyasına çıkarıldı. Kullanıcı arayüzü değişmedi",
    ],
    en: [
      "🧹 Internal refactor (behavior intended identical): App.jsx split round 3 — chat logic (channels, unread counter, notification sound, read tracking) moved into the useChat hook file. No UI change",
    ],
  },
  {
    v: "v1.4.39",
    date: "2026-07-31",
    tr: [
      "🧹 İç yeniden düzenleme (davranış aynı): App.jsx bölme 2. tur — takım/sezon/yarış abonelikleri (useTeams) kendi hook dosyasına çıkarıldı. Kullanıcı arayüzü değişmedi",
    ],
    en: [
      "🧹 Internal refactor (same behavior): App.jsx split round 2 — team/season/race subscriptions (useTeams) moved into their own hook file. No UI change",
    ],
  },
  {
    v: "v1.4.38",
    date: "2026-07-31",
    tr: [
      "🧹 İç yeniden düzenleme (davranış aynı): App.jsx büyük dosyası kademeli olarak parçalara ayrılıyor — bu turda canlı timing aboneliği + yakıt öğrenici (useLive), yüzen mini oynatıcı (useMiniPlayer) ve kimlik doğrulama (useAuth) kendi hook dosyalarına çıkarıldı. Kullanıcı arayüzü değişmedi",
    ],
    en: [
      "🧹 Internal refactor (same behavior): the large App.jsx is being split up incrementally — this round the live-timing subscription + fuel learner (useLive), the floating mini player (useMiniPlayer) and authentication (useAuth) moved into their own hook files. No UI change",
    ],
  },
  {
    v: "v1.4.37",
    date: "2026-07-31",
    tr: [
      "🔧 Canlı köprü güvenilirlik iyileştirmeleri (arayüz değişmez): köprü artık paylaşımlı bellek / LMU REST / araç sayısı / VE durumunu teşhis ediyor — arayüzde gösterilmez, sorun olursa köprü durum noktasının üstüne gelince (hover) ve tarayıcı konsolunda görünür",
      "🧪 Tek-yazıcı seçimi (aktif sürücü) mantığı ayrı bir modüle alınıp birim testleriyle korundu; canlı köprü yaşam döngüsü ayrı bir hook'a taşındı (iç iyileştirme, davranış aynı)",
    ],
    en: [
      "🔧 Live bridge reliability improvements (no UI change): the bridge now diagnoses shared memory / LMU REST / car count / VE status — hidden from the UI, surfaced on hovering the bridge status dot and in the browser console if something's wrong",
      "🧪 The single-writer (active-driver) election logic was moved to its own module and locked down with unit tests; the live bridge lifecycle moved into a dedicated hook (internal cleanup, same behavior)",
    ],
  },
  {
    v: "v1.4.36",
    date: "2026-07-31",
    tr: [
      "🛰 Canlı Timing artık aynı yarışta birden çok masaüstü köprüsünü (ör. ayrı PC'lerdeki co-sürücüler) tek kaynağa indiriyor: arabayı o an gerçekten süren PC canlıyı yazar, izleyen/bekleyen PC'ler 'Beklemede' durumuna geçer — veri artık iki köprü arasında çakışmaz",
      "🔄 Sürücü devri kesintisiz: A arabayı B'ye devredip oyunu kapattığında canlı kaynağı otomatik B'ye geçer (aktif sürücü öncelikli; kaynak birkaç saniyede el değiştirir). Canlı Köprü kartında 'Canlı kaynak' / 'Beklemede' göstergesi eklendi",
    ],
    en: [
      "🛰 Live Timing now funnels multiple desktop bridges in the same race (e.g. co-drivers on separate PCs) to a single source: the PC actually driving the car writes live, while watching/waiting PCs go to 'Standby' — data no longer clashes between two bridges",
      "🔄 Seamless driver handover: when A hands the car to B and closes the game, the live source automatically moves to B (active driver takes priority; the source changes hands within a few seconds). Added a 'Live source' / 'Standby' indicator on the Live Bridge card",
    ],
  },
  {
    v: "v1.4.35",
    date: "2026-07-31",
    tr: [
      "🌐 Canlı Timing sekmesinin İngilizce çevirisi tamamlandı: başlıklar, tablo sütunları (Saha, Konum, Aralık…), Kendi Araç, Pist Haritası, Pozisyon Grafiği, Strateji ve tüm ipuçları/tooltip'ler artık İngilizce. Seans fazı (Yeşil→Green, FCY…), seans tipi (Yarış→Race, Antrenman→Practice…) ve bağlantı durumu (gecikmeli→delayed…) etiketleri de çevrildi",
    ],
    en: [
      "🌐 Completed the English translation of the Live Timing tab: headers, table columns (Field, Location, Interval…), Own Car, Track Map, Position Chart, Strategy and all hints/tooltips are now in English. Session phase (Yeşil→Green, FCY…), session type (Yarış→Race, Antrenman→Practice…) and connection status (gecikmeli→delayed…) labels are translated too",
    ],
  },
  {
    v: "v1.4.34",
    date: "2026-07-31",
    tr: [
      "🎬 Canlı sekmesine 'Demo' düğmesi geri geldi: açınca arayüz sahte veriyle dolar (tablo, VE, sektör, logolar, trackmap, kendi araç, strateji) — oyun/köprü gerekmez, Firebase'e yazmaz (takım görmez). UI düzenlemek için; düğmeyle kapatınca gerçek veriye döner",
    ],
    en: [
      "🎬 The 'Demo' button is back on the Live tab: turn it on to fill the UI with fake data (table, VE, sectors, logos, track map, own car, strategy) — no game/bridge needed, doesn't write to Firebase (team won't see it). For editing the UI; toggle off to return to real data",
    ],
  },
  {
    v: "v1.4.33",
    date: "2026-07-31",
    tr: [
      "🏎 Kendi Araç kartında lastik verileri artık aracın üstten görselinin (cartop) etrafında 4 köşede gösteriliyor: sıcaklık · basınç · aşınma (renkli kutu). Gövdeye hasar tonu uygulanmıyor — araç görseli net görünür",
    ],
    en: [
      "🏎 Own Car card now shows tyre data at the four corners around the top-down car image: temperature · pressure · wear (colored box). No damage tint on the body — the car image shows cleanly",
    ],
  },
  {
    v: "v1.4.32",
    date: "2026-07-31",
    tr: [
      "🛣 Pist sıcaklığının yanına yol ikonu eklendi (hava sıcaklığındaki güneş gibi)",
    ],
    en: [
      "🛣 Added a road icon next to the track temperature (like the sun next to air temp)",
    ],
  },
  {
    v: "v1.4.31",
    date: "2026-07-30",
    tr: [
      "⏱ Tur listesi penceresinde (satır sonu '+') artık her tur için S1 / S2 / S3 sektör süreleri de gösteriliyor — köprü çalışırken tur-tur birikir",
    ],
    en: [
      "⏱ The lap-list window (row-end '+') now shows S1 / S2 / S3 sector times for each lap too — accumulated lap by lap while the bridge runs",
    ],
  },
  {
    v: "v1.4.30",
    date: "2026-07-30",
    tr: [
      "🔋 Kendi Araç kartında artık iki halka: VE (Sanal Enerji) büyük ve yeşil (yakıttan önemli), Yakıt sarı. 'NRG' adı her yerde 'VE' oldu",
    ],
    en: [
      "🔋 The Own Car card now has two rings: VE (Virtual Energy) large and green (more important than fuel), Fuel yellow. 'NRG' renamed to 'VE' everywhere",
    ],
  },
  {
    v: "v1.4.29",
    date: "2026-07-30",
    tr: [
      "🔋 Virtual Energy (NRG) artık dolu geliyor: köprü LMU canlı standings API'sinden (veFraction) her aracın VE'sini çekiyor",
      "🏁 Kendi aracının takım adı (ör. 'EYT TEAM GT3 #34') ve numarası da düzeltildi — custom livery katalogda olmadığı için eksikti; artık canlı standings'ten geliyor. Kendi araç marka logosu (911 → Porsche) da eklendi",
    ],
    en: [
      "🔋 Virtual Energy (NRG) now populates: the bridge reads each car's VE (veFraction) from LMU's live standings API",
      "🏁 Your own car's team name (e.g. 'EYT TEAM GT3 #34') and number are fixed too — they were missing because a custom livery isn't in the catalog; now they come from live standings. Own-car brand logo (911 → Porsche) added as well",
    ],
  },
  {
    v: "v1.4.28",
    date: "2026-07-30",
    tr: [
      "🏁 Takım adları düzeltildi: artık 'grup 13' yerine gerçek takım adı gösteriliyor. Marka logoları ve araç numarası (#34) da eklendi — hepsi LMU araç kataloğundan (getAllVehicles) çekilip canlı araçlarla eşleniyor",
      "ℹ️ Not: Virtual Energy (NRG) bu katalogda yok; canlı VE için ayrı bir çalışma sürüyor",
    ],
    en: [
      "🏁 Fixed team names: real team name now shows instead of 'group 13'. Brand logos and car number (#34) added too — all pulled from the LMU car catalog (getAllVehicles) and matched to live cars",
      "ℹ️ Note: Virtual Energy (NRG) isn't in this catalog; live VE is a separate work in progress",
    ],
  },
  {
    v: "v1.4.27",
    date: "2026-07-30",
    tr: [
      "🏭 Canlı Timing saha tablosunda araçların marka logoları (pilot adının yanında) — LMU araç modelinden türetilir",
      "👥 Pilot ↔ Takım geçişi: tablo başlığındaki 'Pilot' yazısına tıkla, sütun takım adına döner (LMU pit grubundan)",
      "🏁 Seans tipi başlıkta gösteriliyor (Antrenman / Sıralama / Yarış / Isınma)",
      "↔️ Pist Haritası ve Kendi Araç kartı artık yan yana (geniş ekranda); dar ekranda alt alta",
    ],
    en: [
      "🏭 Brand logos for cars in the Live Timing field table (next to the driver name) — derived from the LMU car model",
      "👥 Driver ↔ Team toggle: click 'Driver' in the table header to switch the column to team name (from the LMU pit group)",
      "🏁 Session type shown in the header (Practice / Qualifying / Race / Warmup)",
      "↔️ Track Map and Own Car card are now side by side (on wide screens); stacked on narrow screens",
    ],
  },
  {
    v: "v1.4.26",
    date: "2026-07-30",
    tr: [
      "🔋 Virtual Energy (NRG) eklendi: paylaşımlı bellekte olmadığı için köprü LMU'nun kendi yerel API'sinden (localhost:6397) çekiyor. Kendi Araç kartında ve saha tablosunda NRG % görünür (yüksek yeşil → düşük kırmızı). LMU'da API/eklentiler açık olmalı; kapalıysa '—' gösterir",
    ],
    en: [
      "🔋 Added Virtual Energy (NRG): since it isn't in shared memory, the bridge reads it from LMU's own local API (localhost:6397). NRG % shows on the Own Car card and the field table (green high → red low). LMU's API/plugins must be enabled; if off, it shows '—'",
    ],
  },
  {
    v: "v1.4.25",
    date: "2026-07-30",
    tr: [
      "⚡ Canlı köprü artık OTOMATİK: masaüstünde oyun açıkken kendiliğinden bağlanır, koparsa ~4 sn'de bir yeniden dener (oyun sonradan açılırsa da bağlanır). Elle 'Başlat/Durdur' ve 'Mock veri' butonu kaldırıldı — köprü kartı yalnız durumu gösterir",
      "🔇 Oyun/seans kapalıyken artık boş kare yazılmıyor (Firebase kotası korunur)",
    ],
    en: [
      "⚡ The live bridge is now AUTOMATIC: on desktop it connects by itself when the game is open and retries every ~4s if it drops (also connects if the game opens later). The manual 'Start/Stop' and 'Mock data' controls are removed — the bridge card only shows status",
      "🔇 No more empty frames written while the game/session is closed (saves Firebase usage)",
    ],
  },
  {
    v: "v1.4.24",
    date: "2026-07-30",
    tr: [
      "🗺 Pist Haritası daireleri büyütüldü ve içine sınıf-içi pozisyon numarası yazıldı — kim sınıfında kaçıncı bir bakışta okunur (renk = sınıf, beyaz halka = sen)",
    ],
    en: [
      "🗺 Track Map dots are bigger and now show the in-class position number inside — read each car's class position at a glance (color = class, white ring = you)",
    ],
  },
  {
    v: "v1.4.23",
    date: "2026-07-30",
    tr: [
      "🎯 Canlı Timing'e Strateji rozetleri eklendi (kendi araç için): Önünde/Arkanda (araç kodu + fark), Temiz hava (en yakın araca zaman), Trafik (±3s içinde kaç araç) ve Pit çıkışı tahmini (şimdi pit'e girersen ~hangi sıra). Pistine göre 'pit kaybı' (saniye) girilir, hatırlanır. Ek veri gerekmez, gap'lerden hesaplanır",
    ],
    en: [
      "🎯 Added Strategy chips to Live Timing (for your own car): Ahead/Behind (car code + gap), Clean air (time to nearest car), Traffic (how many cars within ±3s) and a Pit-exit estimate (what position you'd rejoin if you pit now). Enter your track's 'pit loss' (seconds), remembered. No extra data — computed from the gaps",
    ],
  },
  {
    v: "v1.4.22",
    date: "2026-07-30",
    tr: [
      "📈 Canlı Timing'e Pozisyon Grafiği eklendi: her aracın tur-tur pozisyonu çizgi grafiğinde (Y ekseni ters, P1 üstte), renk = sınıf, kalın #960018 = sen, 'P' = pit turu. Köprü çalışırken tur-tur birikir ve kalıcıdır (tüm takım aynı grafiği görür, geç açan da geçmişi görür)",
    ],
    en: [
      "📈 Added a Position Chart to Live Timing: each car's position lap by lap as a line chart (Y axis reversed, P1 on top), color = class, thick #960018 = you, 'P' = pit lap. It accumulates lap by lap while the bridge runs and is persistent (the whole team sees the same chart, latecomers see the history)",
    ],
  },
  {
    v: "v1.4.21",
    date: "2026-07-30",
    tr: [
      "🗺 Canlı Timing'e Pist Haritası eklendi: dış halka araçları pist üzerindeki konuma göre gösterir (S/F tepede), iç şekil gerçek devreyi çizer (araçların dünya konumlarından birkaç saniyede oluşur). Renk = sınıf, beyaz halka = sen, beyaz kenar = pit",
      "🔧 Köprü artık araç konumlarını (pist mesafesi + dünya koordinatları) ve pist uzunluğunu da gönderiyor",
    ],
    en: [
      "🗺 Added a Track Map to Live Timing: the outer ring shows cars by their position on track (S/F at top), the inner shape draws the real circuit (built from cars' world positions in a few seconds). Color = class, white ring = you, white edge = pit",
      "🔧 The bridge now also sends car positions (track distance + world coordinates) and track length",
    ],
  },
  {
    v: "v1.4.20",
    date: "2026-07-30",
    tr: [
      "🌡 Kendi Araç kartında lastik ısısı '-273°' ve basınç '0 KPA' hatası düzeltildi — oyun değeri doldurmadığında (garajda/pitte) artık '—' gösteriliyor; araç piste çıkınca gerçek ısı/basınç geliyor",
      "🎯 Kendi Araç yakıt/lastik/bileşim verisi artık oyuncunun aracıyla mID üzerinden kesin eşleşiyor (önceden nadiren lider aracın verisine düşebiliyordu)",
    ],
    en: [
      "🌡 Fixed tyre temperature showing '-273°' and pressure '0 KPA' on the Own Car card — when the game doesn't provide a value (in garage/pit) it now shows '—'; real temperature/pressure appears once the car is on track",
      "🎯 Own Car fuel/tyre/compound data is now matched to your own car precisely via mID (previously it could rarely fall back to the leader's car data)",
    ],
  },
  {
    v: "v1.4.19",
    date: "2026-07-30",
    tr: [
      "🐛 İngilizce dilde 'Neler değişti' penceresini açınca uygulamanın çökmesi düzeltildi — son sürümlerin İngilizce çevirisi eksikti; artık eksikse Türkçe metne düşüyor (çökme yok) ve tüm v1.4.x notlarının İngilizcesi de eklendi",
    ],
    en: [
      "🐛 Fixed the app crashing when opening the 'What's new' window in English — recent versions were missing their English translation; it now falls back to Turkish text if a translation is missing (no crash), and English was added for all v1.4.x notes",
    ],
  },
  {
    v: "v1.4.18",
    date: "2026-07-30",
    tr: [
      "🐛 Masaüstü köprü gerçek oyun modunda 'No module named pyRfactor2SharedMemory' hatası düzeltildi — paylaşımlı bellek okuyucu artık uygulamaya gömülü geliyor (eskiden derlemede güvenilmez şekilde kuruluyordu). Oyun açıkken Başlat artık gerçek veriyi okur",
    ],
    en: [
      "🐛 Fixed the desktop bridge crashing in real-game mode with 'No module named pyRfactor2SharedMemory' — the shared-memory reader is now bundled into the app (it used to be installed unreliably at build time). Start now reads real data with the game open",
    ],
  },
  {
    v: "v1.4.17",
    date: "2026-07-30",
    tr: [
      "🔒 Canlı Timing sekmesi şimdilik yalnız site adminlerine görünür (test aşaması) — tamamlanınca tüm takım üyelerine açılacak",
    ],
    en: [
      "🔒 The Live Timing tab is temporarily visible to site admins only (testing phase) — it will open to all team members once it's ready",
    ],
  },
  {
    v: "v1.4.16",
    date: "2026-07-30",
    tr: [
      "📈 Tur zaman listesi (satır sonu '+') artık tüm yarışı kapsıyor — 50 tur sınırı kalktı. Tur geçmişi canlı kareden ayrılıp kalıcı bir düğüme her tur bir kez yazılıyor; '+' açılınca yalnız o aracın tüm turları yükleniyor (300+ tur sorunsuz). Canlı kare küçük kaldığı için Firebase kotası da korunuyor",
    ],
    en: [
      "📈 The lap-time list (row-end '+') now covers the whole race — the 50-lap limit is gone. Lap history is split off the live frame into a persistent node, written once per lap; opening '+' loads only that car's full history (300+ laps is fine). The live frame stays small, so Firebase usage is preserved",
    ],
  },
  {
    v: "v1.4.15",
    date: "2026-07-30",
    tr: [
      "➕ Canlı Timing saha tablosunda her aracın satır sonuna '+' butonu — tıklayınca o aracın o ana kadar attığı tüm turların zaman listesi küçük bir pencerede açılır (en yeni üstte; en hızlı tur mor, out/pit turu soluk sarı, best'e göre fark)",
      "ℹ️ Not: liste köprü çalışmaya başladığından itibaren tamamlanan turları içerir (oyunun paylaşımlı belleği geçmiş turların tamamını vermez); köprü yeniden başlarsa liste sıfırlanır",
    ],
    en: [
      "➕ A '+' button at the end of every car's row in the Live Timing field table — click it to open that car's full lap-time list in a small window (newest on top; fastest lap purple, out/pit laps dim yellow, delta to best)",
      "ℹ️ Note: the list contains laps completed since the bridge started (the game's shared memory doesn't provide the full lap history retroactively); it resets if the bridge restarts",
    ],
  },
  {
    v: "v1.4.14",
    date: "2026-07-30",
    tr: [
      "⏱ Canlı Timing'e AVG 5 (son 5 turun ortalaması), AVG (genel tur ortalaması) ve Stint (mevcut stint süresi) eklendi — hem saha tablosunda hem Kendi Araç kartında",
      "🧮 Bu üç değer köprüde (oyunun PC'sinde) tur-tur biriktirilerek hesaplanır → tüm takım için tutarlı; web geç açılsa/yenilense de doğru gelir. Out-lap ve pit turları ortalamadan elenir; stint süresi pit çıkışında sıfırlanır",
    ],
    en: [
      "⏱ Added AVG 5 (average of the last 5 laps), AVG (overall lap average) and Stint (current stint duration) to Live Timing — in both the field table and the Own Car card",
      "🧮 These three are accumulated lap by lap in the bridge (on the game PC) → consistent for the whole team; correct even if the web opens late or reloads. Out-laps and pit laps are excluded from the averages; the stint timer resets on pit exit",
    ],
  },
  {
    v: "v1.4.13",
    date: "2026-07-30",
    tr: [
      "📋 Canlı Timing saha tablosuna yeni sütunlar: Δ (son−en iyi), Konum (TRACK/PIT/GARAGE), her araç için Lastik aşınması (renkli nokta + %) ve Hasar (%). Aralık artık oyunun kendi 'öndeki araca fark' değerini kullanıyor (mTimeBehindNext)",
      "🏎 Kendi Araç kartına Hasar (%) eklendi",
      "ℹ️ Not: DR/SR rating ve sanal enerji (NRG) oyunun paylaşımlı belleğinde yok, çekilemez",
    ],
    en: [
      "📋 New columns in the Live Timing field table: Δ (last−best), Location (TRACK/PIT/GARAGE), per-car Tyre wear (colored dot + %) and Damage (%). Interval now uses the game's own 'gap to car ahead' value (mTimeBehindNext)",
      "🏎 Added Damage (%) to the Own Car card",
      "ℹ️ Note: DR/SR rating and virtual energy (NRG) are not in the game's shared memory and can't be read",
    ],
  },
  {
    v: "v1.4.12",
    date: "2026-07-30",
    tr: [
      "🛞 Canlı Timing'e eksik veriler eklendi: kendi aracın lastik bileşimi (soft/medium/hard) ve pit durak sayısı; saha tablosunda her araç için pit durak sayısı ve pozisyon değişim okları (▲ yükseldi / ▼ düştü)",
      "🖥️ 'Büyük Pano' (tam ekran) modu — timing'i uzaktan okunur büyük yazıyla göster; pit duvarında takımın izlemesi için",
    ],
    en: [
      "🛞 Added missing data to Live Timing: your car's tyre compound (soft/medium/hard) and pit-stop count; per-car pit-stop count and position-change arrows (▲ gained / ▼ dropped) in the field table",
      "🖥️ 'Big Board' (fullscreen) mode — show the timing in large, readable type for the team to watch from the pit wall",
    ],
  },
  {
    v: "v1.4.11",
    date: "2026-07-30",
    tr: [
      "📊 Canlı Timing zenginleştirildi: sınıf-içi pozisyon (Pn, sarı = sınıf lideri), 'Kendi sınıfım' filtresi, öndeki araca 'Aralık' sütunu, tur-altı araçlar için '+n Tur', seansın en hızlı turu tek araçta mor vurgu ve satır sol kenarında sınıf renk şeridi",
      "🏎 Kendi Araç kartına: mevcut tur canlı sayacı + S1/S2 sektörleri, PIT rozeti ve mevcut yakıtla ~kaç tur kaldığı tahmini (canlıdan öğrenilen tüketimle)",
    ],
    en: [
      "📊 Live Timing enriched: in-class position (Pn, yellow = class leader), a 'My class' filter, an 'Interval' column to the car ahead, '+n Laps' for lapped cars, the session's fastest lap highlighted purple on a single car, and a class color stripe on the left edge of each row",
      "🏎 Own Car card: a live current-lap timer + S1/S2 sectors, a PIT badge, and an estimate of how many laps the current fuel lasts (using consumption learned live)",
    ],
  },
  {
    v: "v1.4.10",
    date: "2026-07-30",
    tr: [
      "🏷 Canlı Timing sınıf sütununda artık uygulamanın kendi renkli rozet vektörleri (HY / P2 / P3 / GTE / GT3) kullanılıyor — pist/araç seçim ekranıyla birebir aynı görsel dil",
    ],
    en: [
      "🏷 The class column in Live Timing now uses the app's own colored badge vectors (HY / P2 / P3 / GTE / GT3) — the exact same visual language as the track/car picker",
    ],
  },
  {
    v: "v1.4.9",
    date: "2026-07-30",
    tr: [
      "🎨 Canlı Timing tablosunda sınıf (SINIF) çipleri artık kategoriye göre renkli: Hypercar kırmızı, LMP2 mavi, LMP3 mor, GTE amber, LMGT3/GT3 yeşil — sahayı sınıflara göre tek bakışta ayırt edersin",
    ],
    en: [
      "🎨 Class (SINIF) chips in the Live Timing table are now colored by category: Hypercar red, LMP2 blue, LMP3 purple, GTE amber, LMGT3/GT3 green — tell the field apart by class at a glance",
    ],
  },
  {
    v: "v1.4.8",
    date: "2026-07-30",
    tr: [
      "🈶 Masaüstünde 'Canlı Köprü' UTF-8 hatası düzeltildi (invalid utf-8 sequence) — köprü çıktısı Windows Türkçe kodlaması yüzünden bozuluyordu, artık UTF-8'e zorlanıyor. Mock test ve gerçek canlı köprü sorunsuz başlıyor",
    ],
    en: [
      "🈶 Fixed the 'Live Bridge' UTF-8 error on desktop (invalid utf-8 sequence) — the bridge output was being corrupted by the Windows Turkish encoding; it's now forced to UTF-8. Mock testing and the real live bridge start cleanly",
    ],
  },
  {
    v: "v1.4.7",
    date: "2026-07-30",
    tr: [
      "🛠 Masaüstünde 'Canlı Köprü Başlat' hatası düzeltildi (Command plugin:shell|spawn not allowed by ACL) — köprü izni eksikti, eklendi. Artık mock test ve gerçek canlı köprü başlıyor",
    ],
    en: [
      "🛠 Fixed the 'Start Live Bridge' error on desktop (Command plugin:shell|spawn not allowed by ACL) — a missing bridge permission was added. Mock testing and the real live bridge now start",
    ],
  },
  {
    v: "v1.4.6",
    date: "2026-07-30",
    tr: [
      "🧹 Ayrı 'Canlı Timing Köprüsü (.exe)' indirme butonu kaldırıldı — canlı timing artık Masaüstü Uygulamasının içinde. Canlı sekmesi ve lobi, oyunun PC'sine Masaüstü Uygulamasını kurup 'Canlı Köprü Başlat' demeye yönlendiriyor (config.ini / bot hesabı gerekmez)",
    ],
    en: [
      "🧹 Removed the separate 'Live Timing Bridge (.exe)' download button — live timing is now built into the Desktop App. The Live tab and lobby point you to install the Desktop App on the game PC and press 'Start Live Bridge' (no config.ini / bot account needed)",
    ],
  },
  {
    v: "v1.4.5",
    date: "2026-07-30",
    tr: [
      "🖥️ Masaüstü uygulaması artık kapatınca tamamen kapanmıyor: pencereyi (X) kapatınca Windows sistem tepsisine (saatin yanı) küçülüp arka planda çalışmaya devam ediyor — yanlışlıkla kapatıp canlı köprünün veri akışını kesme riski yok. Tepsi ikonuna tıklayınca geri gelir; gerçekten kapatmak için ikona sağ tık → 'Çıkış'. Ayrıca menüde 'Windows açılışında başlat' seçeneği (isteğe bağlı, varsayılan kapalı)",
    ],
    en: [
      "🖥️ The desktop app no longer quits when you close it: closing the window (X) minimizes it to the Windows system tray (by the clock) and it keeps running in the background — no risk of accidentally cutting the live bridge's data stream. Click the tray icon to bring it back; to really quit, right-click the icon → 'Exit'. There's also a 'Start on Windows login' option in the menu (optional, off by default)",
    ],
  },
  {
    v: "v1.4.4",
    date: "2026-07-30",
    tr: [
      "🛰 Canlı köprü artık masaüstü uygulamasının içinde: oyunun olduğu PC'de uygulamayı aç, giriş yap, yarışı aç, 'Canlı' sekmesinden tek tuşla 'Canlı Köprü Başlat'. Ayrı .exe indirmeye, bot hesabına ve izin listesine (bridgeBots) GEREK YOK — veri senin oturumunla yazılır. Takımın geri kalanı web/masaüstünden canlı timing'i anında görür",
    ],
    en: [
      "🛰 The live bridge is now inside the desktop app: on the game PC open the app, sign in, open the race, and press 'Start Live Bridge' from the 'Live' tab. No separate .exe download, bot account or allow-list (bridgeBots) needed — data is written under your own session. The rest of the team sees live timing instantly from web/desktop",
    ],
  },
  {
    v: "v1.4.3",
    date: "2026-07-30",
    tr: [
      "🖥️ Masaüstü uygulaması Google girişi tamamen yenilendi: giriş artık uygulamanın içinde değil, senin VARSAYILAN sistem tarayıcında açılıyor; onayladıktan sonra otomatik olarak uygulamaya dönüyor (güvenli loopback + PKCE). Gömülü tarayıcı popup/redirect'i engellediği için giriş başa dönüyordu, bu sorun giderildi",
    ],
    en: [
      "🖥️ Google sign-in on the desktop app was reworked: sign-in now opens in your DEFAULT system browser rather than inside the app, and returns to the app automatically after you approve (secure loopback + PKCE). The embedded browser was blocking the popup/redirect and bouncing sign-in back to the start — now fixed",
    ],
  },
  {
    v: "v1.4.1",
    date: "2026-07-30",
    tr: [
      "🖥️ Masaüstü uygulaması: Google ile giriş artık açılır pencere (popup) yerine yönlendirme (redirect) ile yapılıyor — WebView2 popup'ı engellediği için giriş açılmıyordu, düzeltildi",
    ],
    en: [
      "🖥️ Desktop app: Google sign-in now uses a redirect instead of a popup — WebView2 was blocking the popup so sign-in wouldn't open; fixed",
    ],
  },
  {
    v: "v1.4",
    date: "2026-07-25",
    tr: [
      "🎓 İnteraktif rehber: ilk girişte kendiliğinden açılır, sekmeleri senin için açıp her bölümü tek tek anlatır (lobi 5, pit wall 20 adım). Lobide ve header'da Rehber düğmesi",
      "💬 Sohbete bildirim sesi — klasik MSN mesaj tınısı; 🔔/🔕 ile aç-kapa, tercih hatırlanır",
      "📺 Canlı yayın köşede yüzen mini oynatıcıya taşındı: dört köşeye taşınır, tutamaçla 240–1080px boyutlandırılır, küçültünce ses akmaya devam eder, sekme değişse de kesilmez",
      "📋 Stint tablosuna stint başına 'Ort. Tur' sütunu — değer girilirse o stint o tempoyla hesaplanır, hava çarpanı süreye uygulanmaz (yakıtta korunur)",
      "🛞 Tek lastik seçenekleri (FL/FR/RL/RR) — S1 start şeridinde ve pit hızlı atama menüsünde",
      "📈 Telemetride %105 kuralı: en iyi turun %105'ini aşan turlar otomatik hariç tutulur; kartta sınır ve hariç sayısı görünür, %105 düğmesiyle yeniden uygulanır",
      "Lobide yarışlar şampiyonaya göre gruplu, sezon süzgeci ve takım başlığı eklendi",
      "Takım adı sonradan değiştirilebilir (Takımı Yönet → Takım Adı); üyelerde otomatik güncellenir",
      "Rehber üst çubuğu da tanıtır: takım/sohbet düğmeleri ve rozetlerin yetki anlamları",
      "EN dilinde büyük İ sorunu giderildi (STİNT → STINT) — belge dili arayüz diline bağlandı",
      "Sekmelere ikonlar; üst çubuktan rol rozetleri kaldırıldı (yetki profil rozetlerinden belli)",
      "Adminler birbirinin erişim iznini kaldıramaz; admin satırları 'korumalı' işaretli",
    ],
    en: [
      "🎓 Interactive guide: opens on first visit, switches tabs for you and explains every section (5 lobby + 20 pit-wall steps). Guide button in the lobby and header",
      "💬 Chat notification sound — the classic MSN message tone; toggle with 🔔/🔕, preference remembered",
      "📺 Live stream moved to a floating mini player: dockable to any corner, resizable 240–1080px via the grip, keeps playing when minimised or when you switch tabs",
      "📋 Per-stint 'Avg Lap' column in the stint table — enter a value and that stint uses that pace; no weather multiplier on time (kept for fuel)",
      "🛞 Single-tyre options (FL/FR/RL/RR) on the S1 start strip and the pit quick-assign menu",
      "📈 105% rule in telemetry: laps slower than 105% of the best are auto-excluded; the card shows the limit and count, re-apply with the %105 button",
      "Lobby races grouped by championship, with a season filter and a team header",
      "Team names can be renamed (Manage Team → Team Name); members update automatically",
      "The guide also covers the top bar: team/chat buttons and what each badge permits",
      "Fixed the Turkish capital-İ leak in English (STİNT → STINT) — document language now follows the UI language",
      "Icons on every tab; role chips removed from the top bar (badges on your profile show permissions)",
      "Admins can no longer revoke each other's access; admin rows are marked protected",
    ],
  },
  {
    v: "v1.3",
    date: "2026-07-25",
    tr: [
      "Takım sohbeti: 🌍 Genel ve 🏢 Takım kanalları üst çubuktaki 💬 düğmesinde, 🏁 Yarış Sohbeti kendi sekmesinde — her yarışın arşivi ayrı",
      "Okunmamış mesaj sayacı kanal bazında; sekmede ve düğmede rozet olarak görünür",
      "Rozetler artık yetkiyi belirliyor: 🎧 Yarış Mühendisi datayı değiştirir, 🛞 Sürücü yalnızca görür, 👑 Takım Sahibi yetkileri yönetir",
      "Sürücü rozeti direksiyon simgesi, mühendis rozeti kulaklık oldu",
      "Admin de rozet atayabiliyor; üyeler UID yerine isimleriyle listeleniyor",
      "Adminler birbirinin erişim iznini kaldıramaz",
      "Telemetri ham MoTeC kanal log'unu ve Channel Report'u okuyor — tırnaklı CSV, saniye cinsinden tur süresi, litre→VE dönüşümü",
      "Kutu grafiği (box plot): çeyrekler, medyan, bıyıklar ve aykırı turlar; tur tur çizgi grafiğine geçiş düğmesi",
      "Medyan birincil istatistik oldu — tek yavaş tur planı bozmuyor, DATA'ya medyan uygulanıyor",
      "Lobide yarışlar şampiyonaya göre gruplanıyor, sezon süzgeci ve takım başlığı eklendi",
      "Takım adı sonradan değiştirilebiliyor",
      "Sekmelerin hepsinde ikon; üst çubuktaki rol rozetleri kaldırıldı",
    ],
    en: [
      "Team chat: 🌍 General and 🏢 Team channels behind the 💬 button, 🏁 Race Chat in its own tab — each race keeps its own history",
      "Unread counters per channel, shown as badges on the tab and the button",
      "Badges now set permissions: 🎧 Race Engineer edits data, 🛞 Driver only views, 👑 Team Owner manages permissions",
      "Driver badge is now a steering wheel, engineer badge a headset",
      "Admins can assign badges too; members are listed by name instead of UID",
      "Admins can no longer revoke each other's access",
      "Telemetry reads raw MoTeC channel logs and Channel Reports — quoted CSV, lap times in seconds, litres converted to VE",
      "Box plot: quartiles, median, whiskers and outliers, with a toggle back to the per-lap line chart",
      "Median is now the primary statistic — one slow lap no longer skews the plan, and Apply to DATA uses it",
      "Races in the lobby are grouped by championship, with a season filter and a team header",
      "Team names can be changed after creation",
      "Icons on every tab; role chips removed from the top bar",
    ],
  },
  {
    v: "v1.2",
    date: "2026-07-25",
    tr: [
      "Pilot atama menüsüne takım üyeleri eklendi — kadro ve takım ayrı gruplarda, takımdan seçilen isim otomatik kadroya girer",
      "Pilot kadrosunun altına “Takımdan ekle” hızlı butonları",
      "PDF başlığı artık sorulmuyor: sezon · round · yarış adı otomatik yazılıyor, belge tipi alt satıra taşındı",
      "İngilizce dilde Türkçe kalan 64 metin çevrildi (takım, sezon, takvim, profil ve kayıt ekranları)",
      "Rol rozeti, pit etiketleri ve zaman çizelgesi açıklamaları da dile duyarlı hale geldi",
      "Yarış açılırken oluşan çökme giderildi (eski oda değişkenlerinden kalan referanslar)",
    ],
    en: [
      "Team members now appear in the driver assignment menu — roster and team in separate groups, picking a team member adds them to the roster automatically",
      "“Add from team” quick buttons under the driver roster",
      "PDF no longer asks for a title: season · round · race name is filled in automatically, document type moved to the sub-line",
      "64 strings that stayed Turkish in English mode are now translated (team, season, calendar, profile and sign-up screens)",
      "Role badges, pit labels and timeline descriptions are language-aware too",
      "Fixed the crash when opening a race (leftover references from the old room system)",
    ],
  },
  {
    v: "v1.1",
    date: "2026-07-24",
    tr: [
      "Takım sistemi: takım kur veya katılım koduyla katıl, üye rolleri (sahip / düzenleyici / izleyici)",
      "Oda kodu ve PIN kaldırıldı — erişim artık takım üyeliğinden geliyor",
      "Sezonlar ve yarış takvimi: yarışı önceden pist, araç, süre ve başlangıç saatiyle hazırla",
      "Lobi yaklaşan yarışları listeliyor, tek tıkla açılıyor — pist/araç seçimi tekrar sorulmuyor",
      "Rozetler: 👑 Takım Sahibi, 🏎 Sürücü, 🎧 Yarış Mühendisi — bir üyeye birden fazla rozet atanabilir",
      "Kayıtta Ad Soyad soruluyor; isim profilden değiştirilebiliyor ve stint programında görünüyor",
    ],
    en: [
      "Team system: create a team or join with a code, with member roles (owner / editor / viewer)",
      "Room codes and PINs removed — access now comes from team membership",
      "Seasons and a race calendar: set up a race in advance with track, car, duration and start time",
      "The lobby lists upcoming races and opens them in one click — no more re-picking track and car",
      "Badges: 👑 Team Owner, 🏎 Driver, 🎧 Race Engineer — a member can hold several at once",
      "Full name is asked at sign-up, can be changed from the profile, and shows in the stint schedule",
    ],
  },
  {
    v: "v1.0",
    date: "2026-07-23",
    tr: [
      "İlk kararlı sürüm — Le Mans Ultimate endurance yarışları için pit wall aracı",
      "Virtual Energy modeli: depo daima %100 VE, gerçek yakıt orandan türetilir",
      "Son Stint Hesaplayıcı ve multiclass lider bitiş modeli (bayrak liderde)",
      "Hava durumu: Dry / Damp / Slightly Wet / Wet, kronolojik log ve planlı geçişler",
      "Beş durumlu lastik yönetimi, lastik limiti takibi, wet lastikler limit dışı",
      "Canlı pit board, pit işaretleme ve plan-gerçek sapma göstergesi",
      "LMU referans verisi (Ohne Speed): 21 pist krokisi, araç görselleri, otomatik tempo",
      "PDF çıktısı: stint tablosu, servis çipleri, pilot dağılımı ve pist krokisi",
      "Google ile giriş + admin onaylı erişim listesi",
    ],
    en: [
      "First stable release — a pit wall tool for Le Mans Ultimate endurance racing",
      "Virtual Energy model: the tank is always 100% VE, real fuel is derived from a ratio",
      "Last Stint Calculator and the multiclass leader-flag finish model",
      "Weather: Dry / Damp / Slightly Wet / Wet, with a chronological log and planned transitions",
      "Five-state tyre management, tyre limit tracking, wet tyres exempt from the limit",
      "Live pit board, pit marking and a plan-vs-actual delta indicator",
      "LMU reference data (Ohne Speed): 21 track maps, car artwork, automatic pace fill",
      "PDF output: stint table, service chips, driver distribution and track map",
      "Google sign-in with an admin-approved access list",
    ],
  },
];
