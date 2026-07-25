/* İngilizce çeviri sözlüğü — anahtar = Türkçe kaynak metin.
   App.jsx: t = (str) => lang === "en" ? (EN[str] ?? str) : str */
export const EN = {
  // lobi
  "Adın": "Your Name", "örn. Ahmet": "e.g. John",
  "🏁 Yeni Oda Kur": "🏁 Create New Room",
  "veya mevcut odaya katıl": "or join an existing room",
  "Oda Kodu": "Room Code", "PIN (düzenleme)": "PIN (edit access)",
  "boş = izleyici": "empty = viewer", "Odaya Katıl": "Join Room",
  "PIN'siz katılan izler, PIN'li katılan düzenler.": "Join without PIN to view, with PIN to edit.",
  "Oda kullanmadan solo devam et →": "Continue solo without a room →",
  // pist & araç
  "1 · Pist Seç": "1 · Select Track", "2 · Sınıf Seç": "2 · Select Class",
  "Pist verisi": "Track data",
  "3 · Araç Seç": "3 · Select Car",
  "✓ Devam Et — Yarış Dataları": "✓ Continue — Race Data",
  "Devam etmek için pist ve araç seç": "Select a track and car to continue",
  "Seçim yapmadan geç →": "Skip selection →", "Solo mod": "Solo mode",
  // data ekranı
  "— kodu takıma şimdiden gönderebilirsin": "— you can share the code with your team now",
  "Solo mod — datalar sadece bu cihazda": "Solo mode — data stays on this device",
  "✓ Devam Et — Arayüze Geç": "✓ Continue — Open Interface",
  "Merak etme, tüm bu değerleri arayüzün sol kolonundan her an değiştirebilirsin.":
    "Don't worry — you can change all of these anytime from the left column.",
  // data kartları
  "Yarış · Data": "Race · Data", "Stint Turları — A / B / C / D": "Stint Laps — A / B / C / D",
  "Seçili Strateji": "Selected Strategy", "Yarış Başlangıcı": "Race Start",
  "Start Tarih & Saat": "Start Date & Time", "Hesaplanan Bitiş": "Calculated Finish",
  "Canlı yarış modu, pilot planı ve geri sayım bu zamana göre çalışır.":
    "Live race mode, driver plan and countdown are based on this time.",
  "Pit · Süreler (s)": "Pit · Times (s)", "lastik": "tyres",
  
  "VE Tüketim (%/tur)": "VE Usage (%/lap)",
  "%100 = Taşınan Yakıt": "100% = Fuel Carried",
  // teambar
  "ADIN": "NAME", "Oda Kur": "Create Room", "ODA KODU": "ROOM CODE",
  "PIN (opsiyonel)": "PIN (optional)", "Katıl": "Join",
  "👁 İZLEYİCİ": "👁 VIEWER", "✎ DÜZENLEYİCİ": "✎ EDITOR",
  "Odadan Ayrıl": "Leave Room", "Senkronize": "In sync",
  "Düzenleme PIN'i: ": "Edit PIN: ",
  " (sadece düzenleyecek kişilere ver)": " (share only with editors)",
  "Son güncelleme: ": "Last update: ", "sen": "you",
  "Yazma hatası — tekrar denenecek": "Write error — will retry",
  "Geçerli bir oda kodu gir": "Enter a valid room code",
  "PIN hatalı — izleyici olarak katılmak için PIN alanını boş bırak":
    "Wrong PIN — leave PIN empty to join as viewer",
  // canlı şerit & pit board
  "Start'a": "To Start", "Kalan Süre": "Time Remaining", "Pit Çıkışı": "Pit Exit",
  "Sıradaki Pit": "Next Pit", "Direksiyonda": "At the Wheel", "Durum": "Status",
  "🏁 YARIŞ BİTTİ": "🏁 RACE FINISHED", "Yarış zamanı ayarlanmadı": "Race time not set",
  "Pilotlar sekmesinden başlangıç zamanını gir": "Set the start time in the Drivers tab",
  "Son Pit VE": "Final Pit VE", "Pilot Değişimi": "Driver Change",
  "Sıradaki pit: ": "Next pit: ",
  // sekmeler
  "Son Stint Yakıtı": "Final Stint Fuel", "Lastik": "Tyres", "Pilotlar": "Drivers",
  "Telemetri": "Telemetry",
  // stint kartı
  "Code 80 Kalan": "Code 80 Remaining", "Yarış Süresi": "Race Time",
  "Strateji": "Strategy", "Stint Sayısı": "Stint Count",
  "Tahmini Toplam Tur": "Est. Total Laps",
  "S1 START LASTİKLERİ": "S1 STARTING TYRES",
  "QUAL İLE BAŞLA": "START ON QUAL", "4 YENİ": "4 NEW",
  "2 YENİ ÖN": "2 NEW FRONT", "2 YENİ ARKA": "2 NEW REAR",
  "2 YENİ SOL": "2 NEW LEFT", "2 YENİ SAĞ": "2 NEW RIGHT", "TEMİZLE": "CLEAR",
  "⚠ Başlangıç lastiği seçilmedi — önce buradan başla, pit seçimleri buna zincirlenir":
    "⚠ No starting tyres selected — start here first, pit choices chain from this",
  "Tur": "Laps", "VE İht.": "VE Req.", "Pit Ayarı": "Pit Setup",
  /* --- rehber turu --- */
  "Rehberi başlat": "Start the guide", "Rehber": "Guide",
  "Takım düğmesi": "Team button",
  "Takvimi ve üyeleri yönetmek her an buradan — yarışın ortasında bile. Rozetler de burada atanır.":
    "Manage the calendar and members any time from here — even mid-race. Badges are assigned here too.",
  "Sohbet düğmesi": "Chat button",
  "Genel ve takım kanalları. Okunmamış mesaj varsa üzerinde kırmızı sayı belirir.":
    "General and team channels. A red counter appears when there are unread messages.",
  "Profilin ve rozetlerin": "Your profile and badges",
  "Yanındaki simgeler yetkini gösterir: 👑 Takım Sahibi yönetir, 🎧 Yarış Mühendisi datayı değiştirir, direksiyon (Sürücü) yalnızca izler, 🛡 Admin her şeye erişir. Adına tıklayıp profili düzenlersin; ⏻ çıkış yapar.":
    "The icons next to your name show your permissions: 👑 Team Owner manages, 🎧 Race Engineer edits data, the steering wheel (Driver) only views, 🛡 Admin has full access. Click your name to edit the profile; ⏻ signs out.",
  "Şimdi sekmeleri tek tek gezelim — rehber her birini senin için açacak.":
    "Now let's walk through the tabs one by one — the guide opens each for you.",
  "📊 Dashboard — Stint Programı": "📊 Dashboard — Stint Schedule",
  "Planın özeti: her stintin bitiş saati, kalan süre ve pilotu. Yarış başlayınca satırlar canlı ilerler.":
    "The plan at a glance: each stint's end time, time left and driver. Rows advance live once the race starts.",
  "Yarış sonuna kalan süreye göre son dolumda alınması gereken VE yüzdesi — extra lap ve bayrak payı dahil. Pit'te mühendisin baktığı tek sayı budur.":
    "The VE percentage to take at the final stop based on the time left — extra lap and flag margin included. The one number the engineer watches in the pits.",
  "📋 Stint — Önce start lastiği": "📋 Stint — Start tyres first",
  "Her satır bir stint: tur, VE ihtiyacı, pit ayarı, pilot. Ort. Tur sütununa değer yazarsan o stint o tempoyla hesaplanır (hava çarpanı uygulanmaz); Override süreyi kilitler.":
    "Each row is a stint: laps, VE need, pit setup, driver. A value in Avg Lap makes that stint use that pace (no weather multiplier); Override locks the duration.",
  "⚡ Son Stint Hesaplayıcı": "⚡ Last Stint Calculator",
  "Yarış sonu geri sayımını gir (canlıda otomatik) — kalan tur ve gereken VE hesaplanır. Ondalık tur yukarı yuvarlanır, trafik payı için.":
    "Enter the countdown to the finish (automatic when live) — remaining laps and required VE are computed. Fractional laps round up as traffic margin.",
  "Lastik Stratejisi": "Tyre Strategy",
  "Limit sayacı, stint bazlı köşe tablosu ve hızlı atama. Wet lastikler limitten düşmez; siyah kutu eski kuru lastiği geri takar.":
    "Limit counter, per-stint corner table and quick assign. Wet tyres don't count against the limit; the black box refits a used dry tyre.",
  "Kadroyu elle yaz ya da takım üyelerinden tek tıkla ekle. Stintlere atadıkça toplam sürüş süresi ve yüzde dağılımı hesaplanır.":
    "Type the roster or add team members in one click. As you assign stints, total drive time and the split are computed.",
  "📈 Telemetri": "📈 Telemetry",
  "MoTeC dosyanı bırak — tur raporu da ham kanal log'u da okunur. %105 kuralı yavaş turları otomatik eler, medyan tur tek tıkla DATA'ya yazılır.":
    "Drop your MoTeC file — lap reports and raw channel logs both work. The 105% rule filters slow laps, and the median lap writes to DATA in one click.",
  "Admin": "Admin", "Hava": "Air", "Pit Board": "Pit Board",
  "Takvim dışı": "Off-calendar",
  "Race Monitor'a hoş geldin! 🏁": "Welcome to Race Monitor! 🏁",
  "Bu araç, LMU endurance yarışlarında pit wall'unuz: stint planı, yakıt, lastik ve canlı takip. 1 dakikada temel akışı gösterelim.":
    "This is your pit wall for LMU endurance racing: stint planning, fuel, tyres and live tracking. Let's cover the basics in a minute.",
  "Yarış Takvimi": "Race Calendar",
  "Takımının yaklaşan yarışları burada, şampiyonaya göre gruplu. Bir yarışa tıkla — pist, araç ve süre önceden hazır, direkt pit wall açılır.":
    "Your team's upcoming races, grouped by championship. Click one — track, car and duration are prepared, the pit wall opens right away.",
  "Sezon ve yarış eklemek, üyeleri ve rozetleri yönetmek burada. 🎧 Mühendis rozeti datayı değiştirebilir, sürücüler yalnızca görür.":
    "Add seasons and races, manage members and badges here. The 🎧 Engineer badge can edit data; drivers only view.",
  "🌍 Genel ve 🏢 Takım kanalları burada. Yarış açıkken ayrıca yarışa özel bir sohbet sekmesi belirir.":
    "🌍 General and 🏢 Team channels live here. With a race open, a race-specific chat tab appears too.",
  "Uygulama sık güncellenir — yeni sürümde kırmızı nokta belirir, notları buradan okursun. Rehberi de buradan yeniden başlatabilirsin.":
    "The app updates often — a red dot appears on new versions, read the notes here. You can restart this guide from here as well.",
  "Pit Wall'a hoş geldin": "Welcome to the Pit Wall",
  "Soldaki panel yarışın datası, sağı canlı plan. Kısaca gezelim — her şeyi değiştirdiğin anda takım arkadaşların da görür.":
    "The left panel holds the race data, the right side is the live plan. Quick walkthrough — anything you change, your teammates see instantly.",
  "Yarış süresi, ortalama tur, tüketim ve A/B/C/D stint stratejileri. Tüm plan bu değerlerden hesaplanır; telemetriden tek tıkla doldurabilirsin.":
    "Race time, average lap, consumption and the A/B/C/D stint strategies. The whole plan derives from these; telemetry can fill them in one click.",
  "Zemin değişince buradan işaretle — plan tur tur karma havayı hesaplar. İleri saatli planlı geçiş de ekleyebilirsin.":
    "Mark surface changes here — the plan walks lap by lap through mixed weather. You can schedule future transitions too.",
  "Sekmeler": "Tabs",
  "📊 Dashboard özet, 📋 Stint plan tablosu, ⚡ son stint yakıtı, lastik ve pilot yönetimi, 📈 telemetri ve 💬 yarış sohbeti.":
    "📊 Dashboard overview, 📋 stint plan table, ⚡ last-stint fuel, tyre and driver management, 📈 telemetry and 💬 race chat.",
  "Önce start lastiği": "Start tyres first",
  "S1 lastiklerini buradan seç — pit'lerdeki lastik seçimleri buna zincirlenir. Tekli, ikili ve dörtlü hızlı seçenekler hazır.":
    "Pick the S1 tyres here — pit tyre choices chain onto them. Single, double and full-set quick options are ready.",
  "Stint Tablosu": "Stint Table",
  "Her satır bir stint: tur, VE ihtiyacı, pit ayarı, pilot. Ort. Tur sütununa değer yazarsan o stint o tempoyla hesaplanır; Override süreyi kilitler.":
    "Each row is a stint: laps, VE need, pit setup, driver. Enter a value in Avg Lap and that stint uses that pace; Override locks the duration.",
  "Yarış canlıyken tam ekran pit board: geri sayım, sıradaki pit ve PIT YAPILDI butonu. Gerçek pitler plana işlenir, sapma görünür.":
    "Full-screen pit board while racing: countdown, next pit and the PIT DONE button. Real pits feed back into the plan, deviation is shown.",
  "PDF çıktısı": "PDF export",
  "Stint programını takıma dağıtmak için tek tık — başlık sezon ve yarış adından otomatik gelir. Bu kadar! İyi yarışlar. 🏁":
    "One click to share the stint schedule — the title comes from the season and race name automatically. That's it! Good racing. 🏁",
  "Ort. Tur": "Avg Lap",
  "Boş: yarış datasındaki ortalama tur kullanılır":
    "Empty: uses the average lap from Race Data",
  "Bu stint girilen tur süresiyle hesaplanıyor — hava çarpanı uygulanmaz":
    "This stint uses the lap time you entered — no weather multiplier applied",
  "Otomatiğe dön": "Back to automatic",
  "Toplam VE": "Total VE", "yakıt": "fuel",
  // dashboard
  "⏱ Yarış": "⏱ Race", "Kalan": "Remaining", "Tahmini Tur": "Est. Laps",
  "📋 Stint Programı": "📋 Stint Schedule", 
  "Kullanılan Lastik": "Tyres Used", "Kalan Lastik": "Tyres Left",
  "Son Stint VE": "Final Stint VE", "Pilot Dağılımı": "Driver Split",
  "Araç": "Car", "Pist": "Track", "Pit lane": "Pit lane",
  "Sıradaki stint lastikleri:": "Next stint tyres:",
  // lastik sekmesi
  "Lastik Stratejisi": "Tyre Strategy", "Lastik Limiti (adet)": "Tyre Limit (count)",
  "— hızlı —": "— quick —", "🆕 4 Yeni": "🆕 4 New",
  "⟳ Öncekiyle Devam": "⟳ Carry Over", "Önler Yeni": "New Fronts",
  "Arkalar Yeni": "New Rears", "Sollar Yeni": "New Lefts", "Sağlar Yeni": "New Rights",
  "✕ Temizle": "✕ Clear", "Tümünü Temizle": "Clear All", "Hızlı Atama": "Quick Assign",
  "Yeni lastik (1 kez)": "New tyre (1 use)", "2 kez (duplicate)": "2 uses (duplicate)",
  "Qual lastiği tekrar": "Qual tyre reused", "3 kez": "3 uses", "4+ kez": "4+ uses",
  "Değişmedi — önceki lastikle devam": "Unchanged — carries previous tyre",
  // pilotlar
  "Yarış Bitişi": "Race Finish", "Pilot Kadrosu": "Driver Roster",
  "Henüz pilot yok — aşağıdan ekle.": "No drivers yet — add below.",
  "Pilot adı": "Driver name", "Ekle": "Add", "Süre": "Duration", "Pilot": "Driver",
  "— seç —": "— select —", "Toplam Süre": "Total Time",
  "Atamaları Temizle": "Clear Assignments",
  "Geçerli bir yarış başlangıç zamanı gir.": "Enter a valid race start time.",
  // telemetri
  "Telemetri İçe Aktar (MoTeC)": "Import Telemetry (MoTeC)",
  "Tur Süresi": "Lap Time", "(başlıksız)": "(untitled)",
  "Tur süresi sütunu seçilmeli": "Select the lap time column",
  "Stint Analizi": "Stint Analysis", "DATA'ya uygula": "Apply to DATA", "Sil": "Delete",
  "Karşılaştırma": "Comparison", "Ort. Fark": "Avg. Gap", "Hızlı Olan": "Faster",
  "Dahil": "Incl.",
  "Tur satırı bulunamadı ('Out Lap', 'Lap 1'...)": "No lap rows found ('Out Lap', 'Lap 1'...)",
  // son stint yakıtı
  "YARIŞ SONU": "RACE END", "CODE 80 SONU": "CODE 80 END",
  "Zemin / Hava": "Track / Weather", "Efektif tur": "Effective lap", "yakıt": "fuel",
  "şu an": "now", "değişim": "changes", "Hava Durumu": "Weather",
  "Yükleniyor…": "Loading…", "Devam etmek için giriş yapın.": "Sign in to continue.",
  "Erişim izni bekleniyor": "Access pending",
  "Üyeler": "Members", "Üye Yönetimi": "Member Management", "Kullanıcı yönetimi": "User management",
  "Kayıt yok.": "No records.", "erişim var": "has access", "beklemede": "pending",
  "talep yok": "no request", "Onayla": "Approve", "İzni Al": "Revoke",
  "Onaylanan kişi sayfayı yenilemeden erişir.": "Approved users get access without refreshing.",
  "Tarayıcı açılır pencereyi engelledi. Bu site için açılır pencerelere izin verip tekrar deneyin.": "Your browser blocked the popup. Allow popups for this site and try again.",
  "Hesabınız kayıtlı ancak bu araç için henüz yetkilendirilmedi. Takım yöneticisiyle iletişime geçin.": "Your account is registered but not yet authorised for this tool. Contact your team manager.",
  "Google ile giriş yap": "Sign in with Google", "Çıkış yap": "Sign out",
  "Caspian Motorsport · pit wall aracı": "Caspian Motorsport · pit wall tool",
  "Planlı geçiş ekle": "Add planned change", "Ekle": "Add",
  "canlı": "live", "planlı": "planned", "Son": "Last",
  "Yarış saati (başlangıçtan itibaren)": "Race time (from start)",
  "Son X dk için geçiş zamanı": "Transition time for last X min",
  "Session Countdown (h:mm:ss)": "Session Countdown (h:mm:ss)",
  "Henüz hava geçişi yok. Aşağıdan planlı geçiş ekleyin veya soldaki butonlarla canlı değiştirin.": "No weather changes yet. Add a planned change below, or switch live with the buttons on the left.",
  "Şu anki zemin — canlı değişim buradan": "Current surface — switch live here",
  "Geçmiş / Planlı geçişler": "History / Planned changes", "Tur −1": "Lap −1", "Tur +1": "Lap +1",
  "Otomatiğe dön": "Back to auto", "Önce süre override'ı temizle": "Clear time override first",
  "Tur override aktif — önce onu temizle": "Lap override active — clear it first", "Hava Geçmişi": "Weather History", "Tümünü Sıfırla": "Reset All", "Sil": "Delete",
  "Dry": "Dry", "Damp": "Damp", "Slightly Wet": "Slightly Wet", "Wet": "Wet",
  "Canlı Yayın": "Live Stream", "YouTube linki": "YouTube link",
  "Köşeye taşı": "Move to corner", "Küçült": "Minimise", "Büyüt": "Expand",
  "Boyutlandırmak için sürükle": "Drag to resize",
  "Setup": "Setup", "Setup Yükle": "Upload Setup", "Setup Havuzu": "Setup Library",
  "Dosya": "File", "Koşul": "Condition", "Seans": "Session", "Kuru": "Dry",
  "Sıralama": "Qualifying", "Şampiyona": "Championship", "LMU Sürümü": "LMU Version",
  "Not": "Note", "Sürüm": "Version", "Yükleyen": "By", "İndir": "Download",
  "Takım": "Team", "Ortak": "Shared", "Bu setup silinsin mi?": "Delete this setup?",
  "Setup Ekle": "Add setup", "Yükle": "Upload",
  "Yüklenen setup tüm takımlara açık ortak havuza gider. Tarih otomatik kaydedilir.":
    "Uploaded setups go to the shared pool visible to all teams. The date is recorded automatically.",
  "Tarih": "Date", "Sınıf": "Class", "Araç": "Car", "Yarış": "Race",
  "Takıma Yükle": "Upload to Team", "Yükleniyor…": "Uploading…",
  "Pist seçilmeli.": "Pick a track.", "Yüklenemedi:": "Upload failed:",
  "Tüm pistler": "All tracks", "Kuru + Wet": "Dry + Wet",
  "Yarış + Sıralama": "Race + Qualifying",
  "örn. ELMS / Official / Online": "e.g. ELMS / Official / Online",
  "örn. düşük kanat, uzun stint dengesi": "e.g. low wing, long-stint balance",
  "Dosya çok büyük (sınır 180 KB) — setup dosyaları normalde birkaç KB'dır.":
    "File too large (180 KB limit) — setup files are normally a few KB.",
  "Yüklenen setup tüm takım üyelerine görünür. Tarih otomatik kaydedilir.":
    "Uploaded setups are visible to the whole team. The date is recorded automatically.",
  "Bu süzgeçle setup yok.": "No setups match this filter.",
  "Henüz setup yok — ilk dosyayı yukarıdan yükle.":
    "No setups yet — upload the first file above.",
  "🔧 Setup Havuzu": "🔧 Setup Library",
  "Takımın setup arşivi: dosyayı pist, koşul, seans ve araç bilgisiyle yükle — herkes süzüp indirebilir. Aktif yarışın pisti vurgulanır.":
    "The team's setup archive: upload with track, condition, session and car info — everyone can filter and download. The active race's track is highlighted.",
  "Bildirim sesini kapat": "Mute notification sound",
  "Bildirim sesini aç": "Unmute notification sound",
  "Start tarih-saatini gir — geri sayım ve canlı stint takibi buna göre çalışır. Saat her üyeye kendi saat diliminde gösterilir.":
    "Enter the start date and time — the countdown and live stint tracking run from it. Everyone sees it in their own timezone.",
  "Pit · Süreler": "Pit · Times",
  "Pit lane geçişi ve tam depo dolum süresi. Dolum, alınan VE yüzdesine ölçeklenir; lastik süreleri LMU sabitleridir (1-2 lastik 5s, 3-4 lastik 12s).":
    "Pit lane transit and full-tank refuel time. Refuelling scales with the VE taken; tyre times are LMU constants (1-2 tyres 5s, 3-4 tyres 12s).",
  "Virtual Energy": "Virtual Energy",
  "LMU'da depo daima %100 VE'dir. Ratio, VE'nin kaç litreye denk geldiğini söyler — tüm yakıt hesapları bu orandan litreye çevrilir.":
    "In LMU the tank is always 100% VE. The ratio tells how many litres that equals — every fuel figure converts through it.",
  "YouTube linkini yapıştır — köşede yüzen mini oynatıcı açılır. Sekme değiştirsen de akmaya devam eder; köşesinden tutup boyutlandırabilirsin.":
    "Paste a YouTube link — a floating mini player opens in the corner. It keeps playing across tabs, and you can drag its grip to resize.",
  "Gizle (yenileyene dek)": "Hide (until refresh)",
  "Yayın köşedeki mini oynatıcıda gösteriliyor.":
    "The stream shows in the corner mini player.",
  "Geçerli bir YouTube linki yapıştırın; köşede mini oynatıcı açılır.":
    "Paste a valid YouTube link; a mini player opens in the corner.",
  "Yayın Dashboard'da gösteriliyor.": "Stream is shown on the Dashboard.",
  "Geçerli bir YouTube linki yapıştırın; Dashboard'da oynatıcı açılır.": "Paste a valid YouTube link; a player opens on the Dashboard.",
  "YouTube'da aç": "Open on YouTube",
  "Kalan Tur": "Laps Left", "Kullanılan kuru lastik no": "Used dry tyre no",
  "wet (limitsiz)": "wet (unlimited)",
  "⚠ %100'ü aşıyor — depo yetmez!": "⚠ Exceeds 100% — tank won't fit!",
  "gerçek yakıt": "real fuel",
  // ipuçları
  "Depo daima": "The tank is always treated as",
  "kabul edilir. Gerçek yakıt = VE × ratio → gerçek tüketim ≈":
    "VE. Real fuel = VE × ratio → real usage ≈",
  "L/tur": "L/lap", "%/tur": "%/lap", "tur + extra": "laps + extra",
  "lap": "lap", "gerçek": "actual",
  "Katılım çubuğunu gizle": "Hide join bar", "Katılım çubuğunu göster": "Show join bar",
  "Büyütmek için tıkla": "Click to enlarge",
  "tur": "laps", "Doldur": "Fill", "Sadece geçiş": "Pass-through only",
  "Paneli gizle": "Hide panel", "Paneli göster": "Show panel",
  "Lider Tur (m:ss.00)": "Leader Lap (m:ss.00)", "Lider bayrağı": "Leader flag",
  "Multiclass Yarış": "Multiclass Race", "Servis": "Service", "geçiş": "pass",
  "🌧 4 Wet": "🌧 4 Wet", "Qual'a Dön": "Back to Qual", "⟳ Devam": "⟳ Carry",
  "🆕 4 Yeni": "🆕 4 New", "Önler": "Fronts", "Arkalar": "Rears", "Sollar": "Lefts",
  "Sağlar": "Rights", "Q Qual": "Q Qual",
  "Yeni kuru": "New dry", "Qual'a dönüş": "Back to Qual",
  "Wet — limitten bağımsız, sınırsız": "Wet — unlimited, not counted in limit",
  "Taşı — tıkla: yeni kuru": "Carry — click: new dry",
  "Yeni kuru — tıkla: Qual'a dön": "New dry — click: back to Qual",
  "Qual lastiği — tıkla: wet": "Qual tyre — click: wet",
  "Wet (sınırsız) — tıkla: eski kuru": "Wet (unlimited) — click: used dry",
  "Eski kuru tekrar — tıkla: taşı": "Refit used dry — click: carry",
  "Eski kuru tekrar": "Refit used dry",
  "Saat her üyeye kendi yerel diliminde gösterilir.": "Times are shown to each member in their own timezone.",
  "son tur otomatik eklenir": "final lap added automatically",
  "Ratio'yu düşürmek daha az yakıt taşımak demektir (örn. 0.84 → %100 = 84.0 L).":
    "Lowering the ratio means carrying less fuel (e.g. 0.84 → 100% = 84.0 L).",
  "Pit süresi = FUEL": "Pit time = FUEL", "lastik ×": "tyres ×",
  "Son stintte pit hesaplanmaz. Override girilirse stint süresi manuel değere kilitlenir.":
    "No pit is calculated for the final stint. If an override is set, the stint time locks to it.",
  "Pit'te seçilen lastikler (FL/FR/RL/RR) Lastik sekmesindeki tabloya otomatik işlenir:":
    "Tyres selected at a pit (FL/FR/RL/RR) are written to the Tyres tab automatically:",
  "seçilen köşeye sonraki stint için yeni lastik atanır, seçim kaldırılırsa önceki lastikle devam edilir.":
    "the selected corner gets a new tyre for the next stint; deselecting carries the previous tyre over.",
  "Şu an: Stint": "Now: Stint", "(PIT'te)": "(in PIT)", "sıradaki pit": "next pit",
  "Her numara TEK bir lastiği temsil eder (set değil) — limit adet bazlıdır. Bir lastik ilk takıldığı köşeye kilitlenir ve diğer köşelerin menülerinden otomatik kalkar. Aynı lastik aynı köşede tekrar kullanılırsa hücre kullanım sayısına göre renklenir. Hızlı Atama ile tek tıkla 4 yeni / öncekiyle devam / kısmi değişim yapabilirsin.":
    "Each number represents ONE tyre (not a set) — the limit is per tyre. A tyre locks to the corner it is first fitted on and disappears from other corners' menus. Reusing a tyre on the same corner colors the cell by usage count. Quick Assign gives one-click 4 new / carry over / partial change.",
  "⚠ Köşe kuralı ihlali — lastik": "⚠ Corner rule violation — tyre",
  "birden fazla": "used on more than one corner.",
  "köşede kullanılmış. Bir lastik ilk takıldığı köşeye kilitlenir; hatalı hücreyi düzelt.":
    "A tyre locks to its first corner; fix the offending cell.",
  "⚠ Köşe ihlali: lastik": "⚠ Corner violation: tyre",
  "Start/Finish zamanları stint planından otomatik zincirlenir (pit süreleri dahil). Yarış bitişini aşan kısım süreye sayılmaz; tamamen yarış dışı kalan stintler soluk görünür.":
    "Start/Finish times chain automatically from the stint plan (pit times included). Time past the race finish doesn't count; fully out-of-race stints appear dimmed.",
  "Out lap ve dolum turları (yakıt Δ pozitif) otomatik hariç tutulur — Dahil kutusuyla elle değiştirebilirsin. Ortalamalar sadece dahil turlardan hesaplanır.":
    "Out laps and refuel laps (positive fuel Δ) are excluded automatically — override with the Incl. checkbox. Averages use included laps only.",
  "tur satırı bulundu. Sütun eşleşmesini kontrol et:": "lap rows found. Check the column mapping:",
  "ort. tur": "avg lap", "tur listesi": "lap list", "kalan tur": "laps left",
  "Aşınma": "Wear",
  "PİST": "TRACK", "& ARAÇ": "& CAR", "YARIŞ": "RACE", "DATALARI": "DATA",
  "Oda: ": "Room: ",
  "Solo mod — takım senkronizasyonu için ": "Solo mode — for team sync, ",
  "Kadrodan çıkar": "Remove from roster",
  "✔ PIT": "✔ PIT",
  "Araç PİT YOLUNA GİRDİĞİ an bas. Pit süresi plandan otomatik eklenir, sonraki stint pit çıkışıyla başlar.":
    "Press the moment the car ENTERS the pit lane. Pit duration is added from the plan; the next stint starts at pit exit.", "↩ Geri Al": "↩ Undo", "⟲ Sıfırla": "⟲ Reset",
  "sonu işaretlenecek": "will be marked", "Plan": "Plan", "Gerçek": "Actual",
  "geç": "late", "erken": "early", "Tüm pitler yapıldı": "All pits done",
  "Gerçek pit işaretlemelerini sıfırla?": "Reset all actual pit marks?",
  "Tamir (s)": "Repair (s)",
  "Stint Programı": "Stint Program", "Pilot Programı": "Driver Schedule",
  "PDF başlığı:": "PDF title:",
  "Pilot Toplamları": "Driver Totals",
  "Açılır pencere engellendi — tarayıcıdan izin ver": "Pop-up blocked — allow it in your browser",
  "📋 PLAN": "📋 PLAN",
  "Stint planından otomatik — sondan önceki stintin Time Left değeri":
    "Auto from the stint plan — Time Left of the second-to-last stint",
  "⚠ Lastik limiti doldu — yeni lastik seçilemez": "⚠ Tyre limit reached — no new tyres available",
  "🔴 CANLI": "🔴 LIVE", "Canlıdan otomatik — yarış saatinden hesaplanıyor":
    "Auto from live — calculated from the race clock",
  "odası bulunamadı — kodu kontrol et": "room not found — check the code",
  "Takım senkronizasyonu kapalı — ": "Team sync is off — ",
  " dosyasını doldur.": " needs to be filled in.",
  /* --- takım / sezon / yarış takvimi --- */
  "Takımlar": "Teams",
  "Takımlarım": "My Teams",
  "Takım Kur": "Create Team",
  "Takım Kur / Katıl": "Create / Join Team",
  "Takımı Görüntüle": "View Team",
  "Takım Üyeleri": "Team Members",
  "Takım bulunamadı": "Team not found",
  "Takım kurulamadı": "Could not create team",
  "Takımdan ayrıl": "Leave team",
  "Takımsız solo devam et →": "Continue solo without a team →",
  "Yeni takım adı": "New team name",
  "Katılım kodu": "Join code",
  "KATILIM KODU": "JOIN CODE",
  "Katılınamadı": "Could not join",
  "Henüz bir takımın yok. Yeni takım kur ya da katılım kodu ile katıl.":
    "You don't have a team yet. Create one or join with a join code.",
  "Takvimi & Takımı Yönet": "Manage Calendar & Team",
  "Takvime Dön": "Back to Calendar",
  "Yarış Takvimi": "Race Calendar",
  "Yaklaşan Yarışlar": "Upcoming Races",
  "Takvimde yarış yok.": "No races on the calendar.",
  "Takvimde yaklaşan yarış yok.": "No upcoming races on the calendar.",
  "Takvim dışı (tekli yarış)": "Off-calendar (one-off race)",
  "Solo mod — takım takvimi için lobiye dön.":
    "Solo mode — go back to the lobby for the team calendar.",
  "Sezon": "Season",
  "Sezonlar": "Seasons",
  "Sezon adı": "Season name",
  "Round": "Round",
  "Yarış": "Race",
  "Yarış Ekle": "Add Race",
  "Yarışı Düzenle": "Edit Race",
  "Yarış adı": "Race name",
  "Yarış silinsin mi?": "Delete this race?",
  "örn. 6 Hours of Spa": "e.g. 6 Hours of Spa",
  "Başlangıç (yerel saat)": "Start (local time)",
  "Sınıf": "Class",
  "Tümü": "All",
  /* --- hesap / profil / yetki --- */
  "Profil": "Profile",
  "Profili düzenle": "Edit profile",
  "Ad Soyad": "Full Name",
  "Takım / not (opsiyonel)": "Team / note (optional)",
  "Odalarda ve stint programında bu isim görünür.":
    "This name is shown in rooms and in the stint schedule.",
  "Devam etmek için giriş yapın veya kayıt olun.": "Sign in or register to continue.",
  "Google ile kayıt ol": "Sign up with Google",
  "Kayıt talebi gönder": "Send sign-up request",
  "Talebi Gönder": "Send Request",
  "Talebiniz alındı. Onaylandığında e-posta ile bilgilendirileceksiniz.":
    "Your request has been received. You'll be notified by email once it is approved.",
  "Talebiniz yöneticiye iletilecek. Onaylandığında e-posta ile bilgilendirileceksiniz.":
    "Your request will be sent to an administrator. You'll be notified by email once it is approved.",
  "Bağlantı hatası: ": "Connection error: ",
  "Düzenleyici yap": "Make editor",
  "İzleyici yap": "Make viewer",
  "PIN'leri yalnız düzenleyiciler görür.": "Only editors can see PINs.",
  "(sen)": "(you)",
  "isimsiz": "unnamed",
  /* --- rozetler --- */
  "Takım Sahibi": "Team Owner",
  "Sürücü": "Driver",
  "Yarış Mühendisi": "Race Engineer",
  /* --- genel --- */
  "Kaydet": "Save",
  "Vazgeç": "Cancel",
  "Düzenle": "Edit",
  "Aç": "Open",
  "Geçmiş": "History",
  "Bağlı": "Connected",
  "👁 İZLEYİCİ": "👁 VIEWER",
  "✎ DÜZENLEYİCİ": "✎ EDITOR",
  "Stint zaman çizelgesi": "Stint timeline",
  "Rozetleri atamak için üye satırındaki rozet düğmelerine bas.":
    "Use the badge buttons on a member row to assign them.",
  "Yakıt sütunu litre (VE % için orana bölünür)":
    "Fuel column is in litres (divided by the ratio for VE %)",
  "Yarış·Data'da yakıt oranı girilmeli": "Set the fuel ratio in Race Data",
  "en iyi": "best", "tur hariç": "laps excluded",
  "En iyi turun %105'ini aşan turların tikini kaldır":
    "Untick laps slower than 105% of the best lap",
  "1 YENİ": "1 NEW", "Tek yeni lastik": "Single new tyre",
  "Tek lastik": "Single tyre", "yeni": "new",
  "Takım Adı": "Team Name",
  "Yeni ad diğer üyelerde uygulamayı açtıklarında güncellenir.":
    "Other members will see the new name next time they open the app.",
  "korumalı": "protected",
  "Sohbet": "Chat", "Takım Sohbeti": "Team Chat",
  "Yarış Sohbeti": "Race Chat",
  "Bu yarışa özel kanal — takımın tamamı yazabilir, sürücüler dahil.":
    "Channel for this race — everyone on the team can post, drivers included.",
  "Genel": "General", "Takım": "Team",
  "Mesaj yaz…": "Write a message…", "Gönder": "Send",
  "Henüz mesaj yok — ilk yazan sen ol.": "No messages yet — be the first.",
  "Yetki": "Permission",
  "Düzenleyebilir": "Can edit", "Sadece görür": "View only",
  "Rozet yetkiyi belirler:": "Badges set permissions:",
  "yarış datasını değiştirebilir, üyelere dokunamaz":
    "can change race data, cannot manage members",
  "her şeyi görür, hiçbir şeyi değiştiremez": "sees everything, changes nothing",
  "rozetleri ve yetkileri yönetir": "manages badges and permissions",
  "datayı değiştirebilir": "can edit data", "sadece görür": "view only",
  "medyan tur": "median lap", "ort.": "avg",
  "Ortalamayı uygula": "Apply the average instead",
  "Sütun eşleşmesini düzenle": "Edit column mapping",
  "Kutu grafiği": "Box plot", "Tur tur": "Per lap",
  "Kutu = turların ortadaki %50'si (Q1–Q3), kalın çizgi medyan. Bıyıklar uç turlara, halkalar aykırı turlara işaret eder.":
    "Box = middle 50% of laps (Q1–Q3), thick line is the median. Whiskers reach the extreme laps, rings mark outliers.",
  "tur çözümlendi": "laps parsed",
  "Tur": "Lap", "Yakıt": "Fuel", "kısmi": "partial",
  "Ort/Max km/h": "Avg/Max km/h",
  "Kısmi tur: log'da sonraki tur yok, süre örneklerden hesaplandı.":
    "Partial lap: no following lap in the log, duration estimated from samples.",
  "VE karşılığı için Yarış·Data'da yakıt oranı girilmeli.":
    "Set the fuel ratio in Race Data to get the VE equivalent.",
  "Dosya tanınmadı — MoTeC tur raporu ya da ham kanal log'u bekleniyor":
    "File not recognised — expecting a MoTeC lap report or a raw channel log",
  "MoTeC tur istatistiklerini yapıştır veya dosya seç (CSV/TSV)":
    "Paste MoTeC lap stats or pick a file — raw channel logs work too (CSV/TSV)",
  "Neler değişti": "What's new",
  "ŞU AN": "CURRENT",
  "GitHub'da tüm değişiklikler ↗": "All changes on GitHub ↗",
  "Kapat": "Close",
  "Kadro": "Roster",
  "Takım": "Team",
  "Takımdan ekle": "Add from team",
  "Hava zaman çizelgesi": "Weather timeline",
};
