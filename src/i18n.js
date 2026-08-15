/* İngilizce çeviri sözlüğü — anahtar = Türkçe kaynak metin.
   App.jsx: t = (str) => lang === "en" ? (EN[str] ?? str) : str */
export const EN = {
  // LMU Garage takvim entegrasyonu (Ana Menü → Resmi Yarışlar) — "Canlı"/"Yaklaşan"/"Şampiyona"/"Tümü"/"Sınıf" zaten var
  "Resmi Yarışlar": "Official Races",
  "Toplam": "Total", "Durum": "Status", "Pist": "Track",
  "Sıradaki Resmi Yarış": "Next Official Race",
  "Yarış, pist veya seri ara…": "Search race, track or series…",
  "Filtreleri Temizle": "Clear Filters",
  "Tamamlanan": "Completed", "Tamamlandı": "Completed",
  "Filtrelere uyan yarış yok.": "No races match your filters.",
  "Bugün": "Today", "Yarın": "Tomorrow", "Dün": "Yesterday",
  "gün": "days", "gün önce": "days ago", "g": "d",
  "resmi yarış takvimi": "official race schedule",
  "Yarışlar": "Races",
  "Resmi Yarış Takvimi": "Official Race Schedule",
  "Güncellendi": "Updated",
  "Le Mans Ultimate resmi günlük/haftalık yarış takvimi. Canlı ve yaklaşan yarışlar aşağıda.":
    "Official daily/weekly Le Mans Ultimate race schedule. Live and upcoming races below.",
  "Takvim yükleniyor…": "Loading schedule…",
  "Takvim henüz yüklenmedi — birkaç dakika içinde güncellenir.":
    "Schedule not loaded yet — it refreshes within a few minutes.",
  "Şu An Canlı": "Live Now",
  "Kaynak": "Source",
  "resmi olmayan topluluk projesi.": "unofficial community project.",
  "başlıyor": "starting",
  "Güvenlik derecesi şartı": "Safety rating requirement",
  "lmugarage'da aç": "Open on lmugarage",
  "Bu yarışa planla": "Plan this race",
  "Planla": "Plan",
  "Resmi seans başı": "Official session start",
  "Sıralama süresi": "Qualifying length",
  "dk formasyon": "min formation",
  "Yarış başı": "Race start",
  "Lastik seti": "Tyre sets",
  "Günlük": "Daily",
  "Haftalık": "Weekly",
  "Özel": "Special",
  // REST takılma teşhisi (v1.4.101)
  "REST'i kapat (takılma testi)": "Turn off REST (stutter test)",
  "REST kapalı (test) — aç": "REST off (test) — turn on",
  "Takılma REST'ten mi? Kapat, birkaç tur sür; tepside bile takılma biterse sebep REST'tir.":
    "Is the stutter from REST? Turn it off, drive a few laps; if the stutter stops even in the tray, REST is the cause.",
  "REST kapalı: VE/gerçek takım adı/numara/yetkili bayrak gelmez; oyunun sunucusuna istek atılmaz.":
    "REST off: no Virtual Energy / real team name / number / authoritative flags; no requests to the game's server.",
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
  "Bayrağa": "To Flag", "⛽ PIT YOLUNDA": "⛽ IN PIT LANE",
  "Araç pit yolunda — bu stintin pit'i işaretlendi. Düzeltmek için ↩ Geri Al.":
    "Car is in the pit lane — this stint's pit is already marked. Use ↩ Undo to correct it.",
  // sekmeler
  "Son Stint Yakıtı": "Final Stint Fuel", "Lastik": "Tyres", "Pilotlar": "Drivers",
  "Telemetri": "Telemetry", "Ana sekmeler": "Main tabs",
  "Yoğunluğu değiştir": "Toggle density", "Yoğunluk: Rahat": "Density: Comfortable",
  "Yoğunluk: Kompakt": "Density: Compact",
  "Temayı değiştir": "Toggle theme", "Koyu temaya geç": "Switch to dark",
  "Açık temaya geç": "Switch to light",
  "Komut paleti": "Command palette", "Komut ara": "Search commands",
  "Sonuç yok": "No results", "gezin": "navigate", "seç": "select", "kapat": "close",
  // stint kartı
  "Code 80 Kalan": "Code 80 Remaining", "Yarış Süresi": "Race Time",
  "Strateji": "Strategy", "Stint Sayısı": "Stint Count",
  "Tahmini Toplam Tur": "Est. Total Laps",
  "⚠ Plan hesaplanamıyor — süre, \"Avg Lap\" ve seçili stratejinin tur sayısı dolu olmalı.":
    "⚠ Plan cannot be computed — duration, \"Avg Lap\" and the selected strategy's lap count must all be filled in.",
  "⚠ Plan tamamlanamadı": "⚠ Plan incomplete", "planlanmadı": "unplanned",
  "stint sınırı": "stint limit",
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
  "Sürüş dağılımı": "Time share", "Stint programı": "Stint schedule",
  "toplam": "total", "stint": "stint", "Takımdan": "From team",
  /* §1 Ana Menü dashboard (v1.5.0) */
  "Görüntüle": "View", "takvim & takım": "calendar & team",
  ".ld yükle · analiz": "load .ld · analyze", "paylaşımlı setuplar": "shared setups",
  "takım kanalları": "team channels", "Sıradaki Yarış": "Next Race",
  "Geçmiş Yarışlar": "Past Races", "Yaklaşan": "Upcoming",
  "ara: pist, yarış adı…": "search: track, race name…",
  "Aramayla eşleşen geçmiş yarış yok.": "No past race matches your search.",
  "Daha fazla göster": "Show more",
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
  /* v1.6 — Create & Join ayrı ekran + Team Management yeniden düzenleme */
  "Kur & Katıl": "Create & Join",
  "Yeni bir takım kur ya da katılım koduyla mevcut bir takıma katıl.":
    "Create a new team or join an existing one with a code.",
  "Yönet": "Manage",
  "Takım Kimliği": "Team Identity",
  "Sezonlar & Takvim": "Seasons & Calendar",
  "Üyeler & Yetkiler": "Members & Permissions",
  "Takım Erişimi": "Team Access",
  "Bu kodu paylaş — üyeler katılırken girer.": "Share this code — members enter it to join.",
  "Rozet yetkiyi belirler.": "Badges set permissions.",
  "Takım seç": "Select team",
  "Takımlar": "Teams",
  "Takımlarım": "My Teams",
  "Takım Kur": "Create Team",
  "Takıma Katıl": "Join Team",
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
  "Ana Menü": "Main Menu", "Ana menüye dön": "Back to main menu",
  "Yarış Takvimi": "Race Calendar",
  "Yaklaşan Yarışlar": "Upcoming Races",
  "Takvimde yarış yok.": "No races on the calendar.",
  "Takvimde yaklaşan yarış yok.": "No upcoming races on the calendar.",
  "Takvim dışı (tekli yarış)": "Off-calendar (one-off race)",
  "Solo mod — takım takvimi için lobiye dön.":
    "Solo mode — go back to the lobby for the team calendar.",
  "Sezon": "Season",
  "Yönetim": "Manage",
  "Sezonlar": "Seasons",
  "Sezon adı": "Season name",
  "Round": "Round",
  "Yarış": "Race",
  "Yarış Ekle": "Add Race",
  "Yarışı Düzenle": "Edit Race",
  "Yarış adı": "Race name",
  "Yarış silinsin mi?": "Delete this race?",
  "Bu yarışı silmek istediğinize emin misiniz?": "Are you sure you want to delete this race?",
  "Yarışı sil": "Delete race",
  "Yarış silinemedi.": "Could not delete the race.",
  "örn. 6 Hours of Spa": "e.g. 6 Hours of Spa",
  "Başlangıç (yerel saat)": "Start (local time)",
  "Sınıf": "Class",
  "Tümü": "All",
  /* --- setup başlangıç paketi (v1.4.90) --- */
  "ya da .svm dosyasını buraya sürükle": "or drag the .svm file here",
  "Araç dosyadan algılandı": "Car detected from file",
  "ara": "search",

  /* --- setup görünüm (v1.4.91) --- */
  "Benim setuplarım": "My setups",
  "Yalnız senin yüklediklerin": "Only setups you uploaded",
  "Kartlar": "Cards",
  "Tablo": "Table",

  /* --- setup karşılaştırma (v1.4.92) --- */
  "Setup Karşılaştır": "Compare Setups",
  "Karşılaştır": "Compare",
  "Karşılaştırmak için seç (en çok 2)": "Select to compare (max 2)",
  "Farklı pist ya da sınıf — kıyası dikkatli oku.":
    "Different track or class — read the comparison with care.",
  "Yalnız farkları göster": "Show differences only",
  "İki setup'ın tüm anlamlı değerleri aynı.":
    "All meaningful values of the two setups are identical.",
  "Gösterilecek satır yok.": "Nothing to show.",

  /* --- setup altyapı (v1.4.93) --- */
  "Daha fazla yükle": "Load more",
  "Dosya yükleniyor…": "Loading file…",
  "Dosya alınamadı — bağlantıyı kontrol et.": "Could not fetch the file — check your connection.",
  "Bu dosya zaten havuzda": "This file is already in the pool",
  "Yine de yüklensin mi?": "Upload anyway?",

  /* --- setup tur zamanı (v1.4.89) --- */
  "Tur Zamanı": "Lap Time",
  "En hızlı": "Fastest",

  /* --- setup içeriği (v1.4.88) --- */
  "İçerik": "Contents",
  "Setup İçeriği": "Setup Contents",
  "İçerik okunamadı — bu bir LMU setup dosyası değil ya da bozuk.":
    "Could not read the contents — this is not an LMU setup file, or it's corrupted.",
  /* setup içeriği kategori düzeni (§9) */
  "Anlamlı alanlar": "Key fields", "Tümünü göster": "Show all",
  "ara: kanat, basınç…": "search: wing, pressure…", "Setup alanı ara": "Search setup field",
  "Eşleşen alan yok.": "No matching field.",
  "Aero": "Aero", "Hizalama": "Alignment", "Diferansiyel": "Differential",
  "Elektronik": "Electronics", "Motor & Yakıt": "Engine & Fuel", "Diğer": "Other",
  /* setup .svm bölüm başlıkları */
  "Gövde/Aero": "Body/Aero", "Süspansiyon": "Suspension",
  "Kontroller": "Controls", "Motor": "Engine", "Aktarma": "Drivetrain",
  "Ön Sol": "Front Left", "Ön Sağ": "Front Right", "Arka Sol": "Rear Left",
  "Arka Sağ": "Rear Right", "Temel": "Basic", "Sol Çamurluk": "Left Fender",
  "Sağ Çamurluk": "Right Fender",
  /* setup .svm alan / özet adları */
  "Ön Kanat": "Front Wing", "Arka Kanat": "Rear Wing",
  "Ön Yükseklik": "Front Ride Height", "Arka Yükseklik": "Rear Ride Height",
  "Ön Basınç": "Front Pressure", "Arka Basınç": "Rear Pressure",
  "Ön Kamber": "Front Camber", "Arka Kamber": "Rear Camber",
  "Ön ARB": "Front ARB", "Arka ARB": "Rear ARB",
  "Fren Dengesi": "Brake Bias", "Fren Basıncı": "Brake Pressure",
  "Karışım": "Mixture",
  "Sanal Enerji (VE)": "Virtual Energy (VE)", "Su Radyatörü": "Water Radiator",
  "Yağ Radyatörü": "Oil Radiator", "Fren Kanalı (Ön)": "Brake Duct (Front)",
  "Fren Kanalı (Arka)": "Brake Duct (Rear)", "Ön Denge Çubuğu": "Front Anti-Roll Bar",
  "Arka Denge Çubuğu": "Rear Anti-Roll Bar", "Ön Toe": "Front Toe", "Arka Toe": "Rear Toe",
  "Direksiyon Kilidi": "Steering Lock", "Fren Göçü": "Brake Migration",
  "TC Haritası": "TC Map", "TC Güç Kesme": "TC Power Cut", "TC Kayma Açısı": "TC Slip Angle",
  "ABS Haritası": "ABS Map", "Devir Limiti": "Rev Limit", "Motor Karışımı": "Engine Mixture",
  "Kamber": "Camber", "Lastik Basıncı": "Tyre Pressure", "Yay": "Spring", "Yükseklik": "Ride Height",
  "Yavaş Sıkışma": "Slow Bump", "Hızlı Sıkışma": "Fast Bump",
  "Yavaş Yaylanma": "Slow Rebound", "Hızlı Yaylanma": "Fast Rebound",
  "Lastik Hamuru": "Tyre Compound",

  /* --- setup havuzu (v1.4.86) --- */
  "Dosya okunamadı — tekrar deneyin.": "Could not read the file — please try again.",
  "Setup yüklendi": "Setup uploaded",
  "Süzgeçleri temizle": "Clear filters",
  "Silinemedi:": "Could not delete:",

  /* --- rehber turu (v1.4.85): yeni + güncellenen adımlar --- */
  "🏠 Ana Menü": "🏠 Main Menu",
  "Yarıştan takvime dönmek için — takım şeridi katlı olsa bile bu düğme hep görünür. Planın kaydedilir, istediğin an geri girersin.":
    "Takes you from the race back to the calendar — this button stays visible even when the team bar is collapsed. Your plan is saved; you can jump back in any time.",
  "Yetkin yoksa ne olur?": "What if you don't have edit rights?",
  "Yalnız izleme yetkin varsa düzenleme alanları soluk görünür; yine de bir şeyi değiştirmeye kalkarsan ekranın altında 🔒 'yetkiniz yok' kutucuğu çıkar. Düzenleme için Takım Sahibinden 🎧 Yarış Mühendisi rozeti iste.":
    "If you only have view access the editing controls look dimmed; if you still try to change something, a 🔒 'no permission' box appears at the bottom of the screen. Ask the Team Owner for the 🎧 Race Engineer badge to get editing rights.",
  "Zemin değişince buradan işaretle — plan tur tur karma havayı hesaplar. İleri saatli planlı geçiş de ekleyebilirsin. Canlı veri varken oyunun havasından öneri çipi çıkar, tek tıkla uygulanır.":
    "Mark it here when the track condition changes — the plan computes mixed weather lap by lap. You can also schedule a future transition. With live data connected, a suggestion chip appears from the game's weather and applies in one click.",
  "Start tarih-saatini gir — geri sayım ve canlı stint takibi buna göre çalışır. Saat her üyeye kendi saat diliminde gösterilir. Canlı bağlıyken oyunun kalan süresine göre kendini hizalar.":
    "Enter the start date-time — countdowns and live stint tracking run off it. Each member sees the clock in their own time zone. When live is connected it aligns itself to the game's remaining time.",
  "Takımın setup arşivi: dosyayı pist, koşul, seans ve araç bilgisiyle yükle — herkes süzüp indirebilir. Yükleme herkese açıktır; silme yalnız adminde. Aktif yarışın pisti vurgulanır.":
    "Your team's setup archive: upload a file tagged with track, condition, session and car — anyone can filter and download it. Uploading is open to everyone; only admins can delete. The active race's track is highlighted.",
  "Yarış canlıyken tam ekran pit board: geri sayım, sıradaki pit ve PIT YAPILDI butonu. Gerçek pitler plana işlenir, sapma görünür. Canlı bağlıyken pit'e girdiğin an kendiliğinden işaretlenir (🤖).":
    "A full-screen pit board while the race is live: countdown, next pit and the PIT DONE button. Real pit stops are written into the plan so you see the deviation. With live connected it marks itself the moment you enter the pits (🤖).",
  "Stint programını takıma dağıtmak için tek tık — başlık sezon ve yarış adından otomatik gelir.":
    "One click to hand the stint schedule to the team — the title comes automatically from the season and race name.",
  "📡 Canlı Timing — ve 🎬 Demo": "📡 Live Timing — and 🎬 Demo",
  "Oyundan gelen gerçek zamanlı yarış verisi: saha tablosu, pist haritası ve kendi aracın. Rehber şu an Demo'yu açtı — oyun ya da köprü olmadan ekranın nasıl göründüğünü görüyorsun. Demo sahte 14 araç akıtır ve hiçbir şeyi kaydetmez; kapatınca gerçek veriye döner.":
    "Real-time race data from the game: the field table, the track map and your own car. The guide just switched Demo on — this is how the screen looks without the game or the bridge. Demo streams 14 fake cars and saves nothing; turn it off to go back to real data.",
  "Veri nereden gelir?": "Where does the data come from?",
  "Gerçek veri, oyunun çalıştığı PC'deki Masaüstü Uygulamasından gelir: orada 'Canlı Köprü Başlat'a basılır, veri tüm takıma akar. Buradaki rozet tazeliği gösterir — canlı, gecikmeli ya da çevrimdışı. Veri 30 sn durursa ekran tek kutuya iner ki kimse eski tabloyu canlı sanmasın.":
    "Real data comes from the Desktop App on the PC running the game: you press 'Start Live Bridge' there and the data flows to the whole team. This badge shows freshness — live, delayed or offline. If the data stops for 30 s the screen collapses to a single box so nobody mistakes a stale table for a live one.",
  "Seans şeridi": "Session strip",
  "Seans tipi, bayrak/faz, kalan süre, pist ve ortam sıcaklığı, yağmur ile zemin ıslaklığı (oyunun kendi kelimeleriyle) ve 🛞 tutuş tahmini. Bayrak sarıya dönerse hangi sektörlerin sarı olduğu da yazar.":
    "Session type, flag/phase, time remaining, track and ambient temperature, rain and track wetness (in the game's own wording) plus the 🛞 grip estimate. If the flag turns yellow it also shows which sectors are yellow.",
  "Yakıt ve VE halkaları, dört köşe lastik (aşınma, iç sıcaklık, basınç), anlık gaz/fren/vites/hız, S1/S2/S3 sektörlerin ve AVG5/AVG/stint süresi. Yakıt tüketimi turlar geçtikçe öğrenilir — 'Son Stint Yakıtı' sekmesinde tek tıkla plana uygulanır.":
    "Fuel and VE rings, all four tyre corners (wear, inner temperature, pressure), live throttle/brake/gear/speed, your S1/S2/S3 sectors and AVG5/AVG/stint time. Fuel consumption is learned as laps go by — apply it to the plan in one click from the 'Last Stint Fuel' tab.",
  "Pist Haritası + 🎯 Strateji": "Track Map + 🎯 Strategy",
  "Araçlar sınıf renginde, içlerinde sınıf-içi sıraları yazılı akar. Pist şekli turlar döndükçe oluşur ve takımca kaydedilir — sonraki girişte hazır gelir. Üstteki strateji şeridi önündeki/arkandaki aracı ve temiz hava penceresini söyler. ⛶ Büyüt ile harita tam ekran açılır.":
    "Cars move in their class colour with their in-class position written inside. The track shape builds up as laps are run and is saved for the whole team — next time it is there instantly. The strategy strip on top tells you the car ahead/behind and your clear-air window. ⛶ Expand opens the map full screen.",
  "Saha tablosu": "Field table",
  "Her araç için sınıf-içi pozisyon, lidere Gap ve öndekine Aralık, tur-altı durumu, son/en iyi tur, lastik (hamur ikonu + en kötü aşınma) ve VE. 'Kendi sınıfım' ile yalnız kendi sınıfını süzersin; Pilot başlığına tıklayınca sütun takım adına döner.":
    "For every car: in-class position, Gap to the leader and Interval to the car ahead, laps-down status, last/best lap, tyres (compound icon + worst wear) and VE. 'My class' filters down to your own class; clicking the Driver header switches the column to team names.",
  "Tur geçmişi — satırdaki +": "Lap history — the + on a row",
  "Bir aracın o ana kadarki tüm turları: süre, S1/S2/S3 sektörleri, o turu kimin sürdüğü (pilot değişimi vurgulanır), o turdaki pist koşulları (asfalt sıcaklığı · tutuş · ıslaklık) ve pit'te alınan lastikler. Yarış boyunca kalıcı birikir.":
    "Every lap a car has run so far: the time, S1/S2/S3 sectors, who was driving it (driver changes are highlighted), the track conditions at that lap (track temp · grip · wetness) and the tyres taken in the pits. It accumulates and persists through the race.",
  "Pozisyon grafiği": "Position chart",
  "Tur tur sıralama değişimi — kimin nerede kazandığı/kaybettiği tek bakışta. Pit turları işaretlidir, böylece sıra düşüşünün pitten mi yoksa tempodan mı olduğu ayırt edilir.":
    "Lap-by-lap order changes — who gained and lost where, at a glance. Pit laps are marked, so you can tell whether a drop came from a stop or from pace.",
  "Tüm Canlı sekmesini tam ekran pit duvarı paneline çevirir — masadan uzaktan okunur. Bu kadar! Demo'yu kapatmayı unutma. İyi yarışlar. 🏁":
    "Turns the whole Live tab into a full-screen pit-wall board — readable from across the desk. That's it! Don't forget to switch Demo off. Have a good race. 🏁",
  "Canlı Timing rehberi": "Live Timing guide",

  /* --- hesap / profil / yetki --- */
  "Bu işlem için yetkiniz yok — düzenleme Yarış Mühendisi/Takım Sahibine açık":
    "You don't have permission for this action — editing is limited to the Race Engineer/Team Owner",
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
  ".ld çözümleniyor…": "Parsing .ld…",
  "Tur Karşılaştırma": "Lap Comparison",
  "İzler hazırlanıyor…": "Preparing traces…",
  "İz verisi çıkarılamadı — bu dosyada hız/mesafe kanalı olmayabilir.":
    "Couldn't extract trace data — this file may lack a speed/distance channel.",
  "X ekseni": "X axis",
  "tur kesri %": "lap fraction %",
  "mesafe (m)": "distance (m)",
  "kırmızı A, mavi B": "red A, blue B",
  "delta > 0 = B daha yavaş": "delta > 0 = B slower",
  "Zaman-Delta (B−A)": "Time-Delta (B−A)",
  "Direksiyon": "Steering",
  "Sektör": "Sector",
  "Sektörler tur-kesri üçlüsüdür (mesafe/3); gerçek S/F beacon'ı değil.":
    "Sectors are lap-fraction thirds (distance/3), not the real S/F beacon.",
  "A hızlı": "A faster",
  "B hızlı": "B faster",
  "G-kuvveti tahmini (şekil yaklaşık)": "estimated from G-force (approx. shape)",
  "konum kanalından": "from position channel",
  "ize gel → nokta": "hover a trace → point",
  "tekerlek: yakınlaştır · sürükle: gez · çift-tık: sıfırla": "wheel: zoom · drag: pan · double-click: reset",
  "tekerlek: yakınlaştır · daireyi sürükle: konum · boş alanı sürükle: gez · çift-tık: sıfırla": "wheel: zoom · drag the dot: position · drag empty space: pan · double-click: reset",
  "tekerlek: yakınlaştır": "wheel: zoom",
  "Yakınlaştırmayı sıfırla": "Reset zoom",
  "Telemetriyi oynat": "Play telemetry",
  "Oynatma hızı": "Playback speed",
  "Yüklü dosya": "Loaded file",
  "farklı pist — kıyas dikkatli": "different track — compare with care",
  "Telemetri Raporu": "Telemetry Report",
  "ize gel / oynat / daireyi sürükle → o noktadaki A/B değerleri": "hover / play / drag the dot → A/B values at that point",
  "Viraj Analizi": "Corner Analysis",
  "Viraj": "Corner",
  "Mesafe": "Distance",
  "apex": "apex",
  "fren": "brake",
  "apex = viraj ortası (en düşük hız); fren = fren-başından apex'e mesafe. Sezgisel tespit (gerçek beacon değil).": "apex = mid-corner (lowest speed); brake = distance from brake-on to apex. Heuristic detection (not a real beacon).",
  "Viraj tespit edilemedi — hız/fren kanalı gerekli.": "No corners detected — speed/brake channel required.",
  "Grafikleri PDF rapor olarak çıkart (tam tur için önce ⟳ sıfırla)": "Export charts as a PDF report (reset ⟳ first for the full lap)",
  "Pist haritası çizilemedi — bu dosyada konum ya da yanal-G kanalı yok.":
    "Couldn't draw the track map — this file has no position or lateral-G channel.",
  "kaydedildi": "saved",
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
  "MoTeC tur istatistiklerini yapıştır veya dosya seç (CSV/TSV) — .ld ve .duckdb doğrudan çalışır":
    "Paste MoTeC lap stats or pick a file (CSV/TSV) — .ld and .duckdb work directly",
  "DuckDB çözümleniyor (ilk açılışta motor indirilir)…":
    "Parsing DuckDB (engine downloads on first open)…",
  /* §8b — Seans Setup kutusu (telemetriye gömülü kurulum) */
  "Bu Seansın Setup'ı": "This Session's Setup", "YENİ": "NEW", "ayar": "settings",
  "Özet": "Summary", "Detay": "Detail", "Havuza Kaydet": "Save to Pool",
  "Havuza kaydedildi": "Saved to pool", "Kaydediliyor…": "Saving…",
  "Telemetriden": "From telemetry", "Kaydedilemedi": "Could not save",
  "Kaydetmek için giriş yapmalısın.": "Sign in to save.",
  "Setup okunamadı.": "Could not read the setup.",
  "DuckDB: geçerli tur bulunamadı": "DuckDB: no valid laps found",
  "DuckDB dosyası okunamadı": "Could not read the DuckDB file",
  "Neler değişti": "What's new",
  "ŞU AN": "CURRENT",
  "GitHub'da tüm değişiklikler ↗": "All changes on GitHub ↗",
  "Kapat": "Close",
  "Kadro": "Roster",
  "Takım": "Team",
  "Takımdan ekle": "Add from team",
  "Hava zaman çizelgesi": "Weather timeline",
  /* --- canlı timing --- */
  "Canlı Timing": "Live Timing",
  "Canlı Köprü": "Live Bridge",
  /* v1.6 — "+" tur geçmişini elle temizle */
  "Tur geçmişini temizle": "Clear lap history",
  "Bu yarışın '+' tur geçmişini (eski koşulardan kalan turlar/pilotlar) sıfırla":
    "Reset this race's '+' lap history (laps/drivers left over from earlier runs)",
  "Bu yarışın tüm '+' tur geçmişi silinsin mi? (Yeni turlar yine kaydedilir.)":
    "Clear all of this race's '+' lap history? (New laps will still be recorded.)",
  "temizlendi": "cleared",
  "Masaüstü Uygulamasını İndir": "Download Desktop App",
  "sürüş PC'si için hafif köprü": "lightweight bridge for the driving PC",
  "Hafif Köprüyü İndir (.exe)": "Download Lightweight Bridge (.exe)",
  "Oyunun çalıştığı PC için: tarayıcı motoru yok → oyunu yormaz. Paylaşımlı belleği okuyup canlı timing'i yayınlar; mühendisler web'den izler. (Kendi Google hesabınla giriş — bot gerekmez.)":
    "For the PC running the game: no browser engine → no game stutter. Reads shared memory and publishes live timing; engineers watch from the web. (Sign in with your own Google account — no bot needed.)",
  "Driver Moduna Geç": "Switch to Driver Mode",
  "Race Monitor kapanacak ve tarayıcısız Hafif Köprü açılacak (oyunun donmasını önler). Devam edilsin mi?":
    "Race Monitor will close and the browserless Lightweight Bridge will open (prevents game stutter). Continue?",
  "Hafif köprü açılamadı: ": "Could not open lightweight bridge: ",
  "Oyunun PC'sinde: ağır arayüzü kapatıp yalnız tarayıcısız köprüyü çalıştırır → oyun donmaz. Köprü tepside çalışır; mühendisler canlıyı web'den izler.":
    "On the game PC: closes the heavy UI and runs only the browserless bridge → no game stutter. The bridge runs in the tray; engineers watch live from the web.",
  "Oyunun çalıştığı PC için: tarayıcı motoru yok → oyunu yormaz.":
    "For the PC running the game: no browser engine → no game stutter.",
  "Kendi Araç": "Own Car",
  "Saha": "Field",
  "Pist Haritası": "Track Map",
  "Pozisyon Grafiği": "Position Chart",
  "Sanal Enerji": "Virtual Energy",
  "Pist Sıcaklığı": "Track Temp",
  "Mevcut Tur": "Current Lap",
  "Son Tur": "Last Lap",
  "En İyi": "Best",
  "Turlar": "Laps",
  "Tur zamanları": "Lap times",
  "Pozisyon": "Position",
  "Konum": "Location",
  "Lider": "Leader",
  "Aralık": "Interval",
  "Öndeki araca fark": "Gap to car ahead",
  "En yakın araca zaman farkı": "Time gap to the nearest car",
  "Arkadaki aracın farkı": "Gap to the car behind",
  "Kendi sınıfım": "My class",
  "Tüm saha": "Whole field",
  "Bayrak / Faz": "Flag / Phase",
  "Hasar": "Damage",
  "Hasar tamir süresi (s) — plana eklenir": "Damage repair time (s) — added to the plan",
  "Stint": "Stint",
  "Pit": "Pit",
  "Pit çıkışı": "Pit exit",
  "PIT KAYBI": "PIT LOSS",
  "Pilot / Takım değiştir": "Toggle driver / team",
  "Temiz hava": "Clean air",
  "Trafik": "Traffic",
  "Yağmur": "Rain",
  "Ortam": "Ambient", "Zemin ıslaklığı": "Track wetness",
  // Tutuş (rubber) tahmini — TinyPedal modeli (v1.4.74)
  "Tutuş": "Grip (est.)",
  // standings zenginleştirme (v1.4.139)
  "VE/tur": "VE/lap",
  "Ceza": "Pen.",
  "Pit giriş": "Pit in",
  "Son turun S1·S2·S3 sektör süreleri": "Last lap S1·S2·S3 sector times",
  "Tur başına VE tüketimi": "Virtual Energy used per lap",
  "Bekleyen ceza": "Outstanding penalties",
  // tur geçmişi pist koşulları (v1.4.83)
  "Asfalt sıcaklığı": "Track temp", "Yol tutuş": "Grip",
  "Turlardan modellenmiş tahmin (gerçek okuma değil)":
    "Modeled estimate from laps (not a real reading)",
  // lastik hamuru sütunu (v1.4.66) + ön/arka crossover (v1.4.67)
  "Hamur": "Compound", "telemetri bayat": "telemetry stale",
  "Ön": "Front", "Arka": "Rear",
  // kendi araç sürüş panosu (v1.4.71)
  "Hız": "Speed", "Vites": "Gear", "Gaz": "Throttle", "Fren": "Brake",
  // pit lastik değişimi tur geçmişinde (v1.4.68)
  "Pit (yalnız yakıt/servis)": "Pit (fuel/service only)",
  // rakip lastikleri: köşe köşe aşınma + pit'te kaç lastik değişti (v1.4.65)
  "ÖnSol": "FL", "ÖnSağ": "FR", "ArkaSol": "RL", "ArkaSağ": "RR",
  "ÖN": "FRONT", "ARKA": "REAR", "SAĞ": "RIGHT", "SOL": "LEFT",
  "Bileşim": "Compound", "Son pitte": "At the last stop", "lastik değişti": "tyres changed",
  "Son pitte lastik değişmedi (yalnız yakıt/servis)":
    "No tyres changed at the last stop (fuel/service only)",
  "Bu aracın telemetrisi": "This car's telemetry is",
  "sn geride — değer bayat olabilir": "s behind — the value may be stale",
  // hava kalibrasyonu (v1.4.64)
  "Hava Kalibrasyonu": "Weather Calibration",
  "Dışa aktar": "Export", "Temizle": "Clear", "damga": "stamps",
  "Oyundaki zemin durumu yazısı değiştiğinde aynı kelimeye bas — o anın yüzdesi kaydedilir. Birkaç damga sonra dışa aktarıp gönder, eşikleri ölçüme göre düzeltelim.":
    "When the game's track condition wording changes, press the matching word — the current percentage is recorded. After a few stamps, export and send it so we can correct the thresholds from real measurements.",
  // canlı timing bağlantı koptu (v1.4.62)
  "çevrimdışı": "offline", "Canlı veri akışı durdu": "Live data feed stopped",
  "son veri": "last data", "önce": "ago", "sn": "s", "dk": "min",
  "Oyun ya da köprü kapanmış olabilir.": "The game or the bridge may have closed.",
  // stint ↔ canlı senkron (v1.4.61)
  "Canlı Senkron": "Live Sync", "Oto PIT": "Auto PIT", "Oto Saat": "Auto Clock",
  "otomatik işaretlendi": "auto-marked",
  "oyunda": "in game", "planda": "in plan", "işaretli": "marked", "pit": "pit stops",
  "Canlı": "Live", "geçişi ekle": "add transition",
  "Canlı AVG5": "Live AVG5", "uygula": "apply",
  "Araç pit yoluna girince PIT otomatik işaretlenir (yalnız canlı kaynağı yazan PC tetikler)":
    "PIT is marked automatically when the car enters the pit lane (only the PC writing the live feed triggers it)",
  "Planın geri sayımı oyunun kalan süresinden 5 sn'den fazla kayarsa başlangıç zamanı otomatik hizalanır":
    "If the plan's countdown drifts more than 5s from the game's remaining time, the start time is realigned automatically",
  "Plan saati − oyun saati": "Plan clock − game clock",
  "Canlı son 5 turun ortalaması — tıkla, plana uygula":
    "Average of the last 5 live laps — click to apply to the plan",
  ",": ",",
  "Önünde": "Ahead",
  "Arkanda": "Behind",
  "en yakın": "nearest",
  "içinde": "within",
  "araç": "cars",
  "otomatik": "auto",
  "pist": "track",
  "Demo": "Demo",
  "Demo kapat": "Demo off",
  "⛶ Büyük Pano": "⛶ Big Board",
  "✕ Küçült": "✕ Shrink",
  "Henüz araç verisi yok.": "No car data yet.",
  "Henüz tamamlanmış tur yok.": "No completed laps yet.",
  "Tur geçmişi yükleniyor…": "Loading lap history…",
  "iç harita oluşturuluyor…": "building inner map…",
  "Canlı pist haritası": "Live track map",
  "Haritayı büyük pencerede aç": "Open the map in a large window",
  "Canlı timing tablosu": "Live timing table",
  "Yarış başlayınca bu ekran (ve tüm takım) canlı dolar.":
    "This screen (and the whole team) fills live once the race starts.",
  "±3 sn içinde kaç araç var": "How many cars are within ±3 s",
  "Şimdi pit'e girersen (pit kaybı kadar geriye) tahmini sıra":
    "Estimated position if you pit now (dropped back by the pit loss)",
  "Gap: lidere · Aralık: öndeki araca · Pn: sınıf-içi sıra (sarı = sınıf lideri) · mor: seansın en hızlı turu · satır sonundaki + ile o aracın tur zamanları. Veriler köprü ile canlı gelir; tüm takım aynı anda görür.":
    "Gap: to the leader · Interval: to the car ahead · Pn: in-class position (yellow = class leader) · purple: session's fastest lap · the + at the end of a row shows that car's lap times. Data comes live via the bridge; the whole team sees it at once.",
  "Dış halka: pist üzerindeki konum (S/F tepede) · iç şekil: gerçek devre. Renk = sınıf; beyaz halka = sen, beyaz kenar = pit.":
    "Outer ring: position on track (S/F at the top) · inner shape: the real circuit. Color = class; white ring = you, white edge = pit.",
  "Y ekseni ters (P1 üstte) · renk = sınıf · kalın #960018 = sen · 'P' = pit turu. Köprü çalışırken tur-tur birikir; tüm takım aynı grafiği görür.":
    "Y axis inverted (P1 on top) · color = class · bold #960018 = you · 'P' = pit lap. It builds lap by lap while the bridge runs; the whole team sees the same chart.",
  "Gap'lerden hesaplanır (yaklaşık); pit çıkışı = şu anki lidere farkın + pit kaybı. Pit kaybını pistine göre gir.":
    "Estimated from the gaps (approximate); pit exit = your gap to the current leader + the pit loss. Enter the pit loss for your track.",
  "Lastik: kalan diş % (renkli kutu, yeşil→sarı→kırmızı) · sıcaklık · basınç. Köprüden salt-okunur gelir.":
    "Tyres: tread remaining % (colored box, green→yellow→red) · temperature · pressure. Read-only from the bridge.",
  "Canlı timing, oyunun çalıştığı PC'deki Masaüstü Uygulaması ile gelir:":
    "Live timing comes from the Desktop App on the PC running the game:",
  "Masaüstü Uygulamasını oyunun PC'sine kur, giriş yap, yarışı aç, 'Canlı' sekmesinden 'Canlı Köprü Başlat'a bas.":
    "Install the Desktop App on the game's PC, sign in, open the race, and press 'Start Live Bridge' from the 'Live' tab.",
  "rFactor2 paylaşımlı bellek eklentisi LMU'da kurulu olmalı (zaten ekte).":
    "The rFactor2 shared-memory plugin must be installed in LMU (already included).",
  "Bu bilgisayarda oyun (LMU) açıkken köprü kendiliğinden bağlanır ve canlı timing'i takımla paylaşır. Elle başlatmaya gerek yok; oyun kapalıyken bekler, açılınca otomatik başlar.":
    "While the game (LMU) is running on this computer the bridge connects on its own and shares live timing with the team. No manual start needed; it waits while the game is closed and starts automatically when it opens.",
  "Köprü otomatik çalışır; veri yazmak için takımda owner/editor olman gerekir (yalnız görüntüleyicisin).":
    "The bridge runs automatically; to write data you must be an owner/editor on the team (you are a viewer only).",
  "Köprü henüz veri göndermedi. Yukarıdan 'Canlı Köprü Başlat'a bas (oyun açıkken). Yarış başlayınca bu ekran canlı dolar.":
    "The bridge hasn't sent data yet. Press 'Start Live Bridge' above (with the game open). This screen fills live once the race starts.",
  /* seans fazı (köprü _PHASE) */
  "Garaj": "Garage", "Isınma": "Warmup", "Grid": "Grid", "Formasyon": "Formation",
  "Geri Sayım": "Countdown", "Yeşil": "Green", "FCY": "FCY", "Durduruldu": "Stopped",
  "Bitti": "Finished",
  /* seans tipi */
  "Test": "Testing", "Antrenman": "Practice",
  /* bağlantı durumu */
  "gecikmeli": "delayed", "bağlı değil": "not connected", "bağlantı koptu": "disconnected",
  /* tek-yazıcı seçimi (livewriter) */
  "Beklemede": "Standby", "yayınlıyor": "is broadcasting",
  "aktif sürücü canlıyı yazıyor": "the active driver is writing live data",
  "Canlı kaynak": "Live source",

  /* eklenti buffer performans uyarısı (v1.4.97) */
  "Oyun eklentisi saniyede": "The game plugin writes",
  "kez bu uygulamanın okumadığı veriyi yazıyor": "times per second of data this app never reads",
  "bu, oyunda takılmaya yol açar.": "which causes in-game stutter.",
  "Oyunu kapatıp değiştir, sonra aç. Diğer araçların bu veriye ihtiyaç duyabilir — en güvenli değerle başla.":
    "Close the game, change it, then start again. Your other tools may need this data — start with the safest value.",
  "kopyala": "copy", "kopyalandı": "copied",

  /* pist haritası pit/pano (v1.4.96) */
  "Sen": "You",
  "Pit giriş/çıkış": "Pit in/out",

  /* köprü durum/teşhis mesajları (v1.4.94) */
  "Oyun/seans bekleniyor…": "Waiting for game/session…",
  "Eklenti verisi yok — rFactor2SharedMemoryMapPlugin64.dll kurulu ya da etkin değil. CustomPluginVariables.JSON içinde ' Enabled': 1 olmalı.":
    "No plugin data — rFactor2SharedMemoryMapPlugin64.dll is not installed or not enabled. CustomPluginVariables.JSON must contain ' Enabled': 1.",
  "Oyun açık, seans bekleniyor — pist/garaja girince veri başlar.":
    "Game is open, waiting for a session — data starts once you enter track/garage.",
  "Seansta araç görünmüyor…": "No cars visible in the session…",
  "Köprü başlatılıyor…": "Starting bridge…",
  "Köprü çalışıyor": "Bridge running",
  "Gönderiliyor": "Sending",
  "Rolün izleyici — köprü bu rolde yayın yapamaz. Yayınlayacak üyenin takımda 🎧 Mühendis (editor) ya da Sahip olması gerekir.":
    "Your role is viewer — the bridge cannot broadcast with this role. The member who broadcasts needs the 🎧 Engineer (editor) or Owner role in the team.",

  /* görsel asset sistemi (v1.7.0) — avatar + takım logosu + araç TOP/SIDE */
  "Avatar": "Avatar",
  "Görsel Seç": "Choose Image",
  "Kaldır": "Remove",
  "Değiştir": "Replace",
  "Görsel yok": "No image",
  "Takım Logosu": "Team Logo",
  "Araç Görselleri": "Car Images",
  "Yandan": "Side",
  "Üstten": "Top",
  "Önizleme — Kaydet ile uygulanır": "Preview — applied on Save",
  "Avatar kaydedilemedi — tekrar deneyin.": "Avatar could not be saved — try again.",
  "Sınıf ve araç seç — yüklenen SIDE/TOP görseller o araç için tüm takım ekranlarında kullanılır. Yüklenmeyen araçlar varsayılan görselle kalır.":
    "Pick a class and car — uploaded SIDE/TOP images are used for that car across all team screens. Cars without uploads keep the default image.",
  "Görsel yüklemek için önce araç seç.": "Select a car first to upload images.",
  "Geçersiz görsel dosyası.": "Invalid image file.",
  "Görsel çok büyük — en fazla 10 MB olabilir.": "Image too large — 10 MB max.",
  "Desteklenmeyen dosya türü — PNG, JPEG ya da WebP yükleyin.":
    "Unsupported file type — upload a PNG, JPEG or WebP.",
  "Geçersiz görsel dosyası — içerik PNG/JPEG/WebP değil.":
    "Invalid image file — content is not PNG/JPEG/WebP.",
  "Görsel işlenemedi — dosya bozuk olabilir.":
    "Image could not be processed — the file may be corrupt.",
  "Görsel sıkıştırılamadı — daha küçük/az detaylı bir görsel deneyin.":
    "Image could not be compressed — try a smaller or simpler image.",
};
