/* Rehber turu adımları — App.jsx'ten çıkarıldı (saf + test edilebilir).

   Bölümler:
     lobby → ilk girişte (takım/takvim ekranı)
     core  → yarış ekranının klasik bölümü (üst çubuk, data paneli, sekmeler)
     live  → Canlı Timing bölümü (v1.4.85'te eklendi)
     main  → core + live (yarış ekranında otomatik başlayan tam tur)

   Adım şekli: { sel?, title, body, act? }
     sel  — vurgulanacak öğenin CSS seçicisi ([data-tour='...']); yoksa balon ortada
     act  — adım açılmadan önce çalışır (sekme aç, paneli aç, demoyu aç…)
   Metinler t() ile geçer (anahtar = Türkçe kaynak; EN karşılığı src/i18n.js'te). */

/* ---------- lobi (takım / yarış takvimi) ---------- */
export function lobbySteps(t) {
  return [
    { title: t("Race Monitor'a hoş geldin! 🏁"),
      body: t("Bu araç, LMU endurance yarışlarında pit wall'unuz: stint planı, yakıt, lastik ve canlı takip. 1 dakikada temel akışı gösterelim.") },
    { sel: "[data-tour='races']", title: t("Yarış Takvimi"),
      body: t("Takımının yaklaşan yarışları burada, şampiyonaya göre gruplu. Bir yarışa tıkla — pist, araç ve süre önceden hazır, direkt pit wall açılır.") },
    { sel: "[data-tour='manage']", title: t("Takvimi & Takımı Yönet"),
      body: t("Sezon ve yarış eklemek, üyeleri ve rozetleri yönetmek burada. 🎧 Mühendis rozeti datayı değiştirebilir, sürücüler yalnızca görür.") },
    { sel: "[data-tour='chat']", title: t("Sohbet"),
      body: t("🌍 Genel ve 🏢 Takım kanalları burada. Yarış açıkken ayrıca yarışa özel bir sohbet sekmesi belirir.") },
    { sel: "[data-tour='info']", title: t("Neler değişti"),
      body: t("Uygulama sık güncellenir — yeni sürümde kırmızı nokta belirir, notları buradan okursun. Rehberi de buradan yeniden başlatabilirsin.") },
  ];
}

/* ---------- yarış ekranı: klasik bölüm ---------- */
export function coreSteps(t, { setTab, setSideOpen }) {
  /* v2.0: yarış datası artık sol kolonda DEĞİL, sağdan kayan panelde. `side`
     bu yüzden paneli açar; App.jsx setSideOpen olarak setRdOpen geçirir.
     (Ad geriye dönük uyum için korundu — tourSteps saf modül kalsın diye.) */
  const side = () => setSideOpen(true);
  return [
    { title: t("Pit Wall'a hoş geldin"),
      body: t("Soldaki ray ekranlar arasında gezinir, üstteki çubuk yarışın canlı özetidir. Kısaca gezelim — her şeyi değiştirdiğin anda takım arkadaşların da görür.") },
    /* --- üst çubuk --- */
    { sel: "[data-tour='hteam']", title: t("Takım düğmesi"),
      body: t("Takvimi ve üyeleri yönetmek her an buradan — yarışın ortasında bile. Rozetler de burada atanır.") },
    { sel: "[data-tour='hchat']", title: t("Sohbet düğmesi"),
      body: t("Genel ve takım kanalları. Okunmamış mesaj varsa üzerinde kırmızı sayı belirir.") },
    { sel: "[data-tour='home']", title: t("🏠 Ana Menü"),
      body: t("Yarıştan takvime dönmek için — takım şeridi katlı olsa bile bu düğme hep görünür. Planın kaydedilir, istediğin an geri girersin.") },
    { sel: "[data-tour='uchip']", title: t("Profilin ve rozetlerin"),
      body: t("Yanındaki simgeler yetkini gösterir: 👑 Takım Sahibi yönetir, 🎧 Yarış Mühendisi datayı değiştirir, direksiyon (Sürücü) yalnızca izler, 🛡 Admin her şeye erişir. Adına tıklayıp profili düzenlersin; ⏻ çıkış yapar.") },
    { title: t("Yetkin yoksa ne olur?"),
      body: t("Yalnız izleme yetkin varsa düzenleme alanları soluk görünür; yine de bir şeyi değiştirmeye kalkarsan ekranın altında 🔒 'yetkiniz yok' kutucuğu çıkar. Düzenleme için Takım Sahibinden 🎧 Yarış Mühendisi rozeti iste.") },
    /* --- sol panel: data --- */
    { sel: "[data-tour='data']", act: side, title: t("Yarış · Data"),
      body: t("Yarış süresi, ortalama tur, tüketim ve A/B/C/D stint stratejileri. Tüm plan bu değerlerden hesaplanır; telemetriden tek tıkla doldurabilirsin.") },
    { sel: "[data-tour='wx']", act: side, title: t("Hava Durumu"),
      body: t("Zemin değişince buradan işaretle — plan tur tur karma havayı hesaplar. İleri saatli planlı geçiş de ekleyebilirsin. Canlı veri varken oyunun havasından öneri çipi çıkar, tek tıkla uygulanır.") },
    { sel: "[data-tour='rstart']", act: side, title: t("Yarış Başlangıcı"),
      body: t("Start tarih-saatini gir — geri sayım ve canlı stint takibi buna göre çalışır. Saat her üyeye kendi saat diliminde gösterilir. Canlı bağlıyken oyunun kalan süresine göre kendini hizalar.") },
    { sel: "[data-tour='pittimes']", act: side, title: t("Pit · Süreler"),
      body: t("Pit lane geçişi ve tam depo dolum süresi. Dolum, alınan VE yüzdesine ölçeklenir; lastik süreleri LMU sabitleridir (1-2 lastik 5s, 3-4 lastik 12s).") },
    { sel: "[data-tour='ve']", act: side, title: t("Virtual Energy"),
      body: t("LMU'da depo daima %100 VE'dir. Ratio, VE'nin kaç litreye denk geldiğini söyler — tüm yakıt hesapları bu orandan litreye çevrilir.") },
    { sel: "[data-tour='stream']", act: side, title: t("Canlı Yayın"),
      body: t("YouTube linkini yapıştır — köşede yüzen mini oynatıcı açılır. Sekme değiştirsen de akmaya devam eder; köşesinden tutup boyutlandırabilirsin.") },
    { sel: "[data-tour='tabs']", title: t("Sol ray"),
      body: t("Ekranlar arasında soldaki raydan geçersin. Şimdi hepsini tek tek gezelim — rehber her birini senin için açacak.") },
    /* --- Dashboard --- */
    { sel: "[data-tour='dash-prog']", act: () => setTab("dash"),
      title: t("📊 Dashboard — Stint Programı"),
      body: t("Planın özeti: her stintin bitiş saati, kalan süre ve pilotu. Yarış başlayınca satırlar canlı ilerler.") },
    { sel: "[data-tour='dash-lsf']", act: () => setTab("dash"),
      title: t("Son Stint VE"),
      body: t("Yarış sonuna kalan süreye göre son dolumda alınması gereken VE yüzdesi — extra lap ve bayrak payı dahil. Pit'te mühendisin baktığı tek sayı budur.") },
    /* --- Stint --- */
    { sel: "[data-tour='s1']", act: () => setTab("stint"),
      title: t("📋 Stint — Önce start lastiği"),
      body: t("S1 lastiklerini buradan seç — pit'lerdeki lastik seçimleri buna zincirlenir. Tekli, ikili ve dörtlü hızlı seçenekler hazır.") },
    { sel: "[data-tour='stinttable']", act: () => setTab("stint"),
      title: t("Stint Tablosu"),
      body: t("Her satır bir stint: tur, VE ihtiyacı, pit ayarı, pilot. Ort. Tur sütununa değer yazarsan o stint o tempoyla hesaplanır (hava çarpanı uygulanmaz); Override süreyi kilitler.") },
    /* --- Son Stint Yakıtı --- */
    { sel: "[data-tour='fuelcalc']", act: () => setTab("fuel"),
      title: t("⚡ Son Stint Hesaplayıcı"),
      body: t("Yarış sonu geri sayımını gir (canlıda otomatik) — kalan tur ve gereken VE hesaplanır. Ondalık tur yukarı yuvarlanır, trafik payı için.") },
    /* --- Setup --- */
    { sel: "[data-tour='setuptab']", act: () => setTab("setup"),
      title: t("🔧 Setup Havuzu"),
      body: t("Takımın setup arşivi: dosyayı pist, koşul, seans ve araç bilgisiyle yükle — herkes süzüp indirebilir. Yükleme herkese açıktır; silme yalnız adminde. Aktif yarışın pisti vurgulanır.") },
    /* --- Lastik --- */
    { sel: "[data-tour='tyrecard']", act: () => setTab("tyre"),
      title: t("Lastik Stratejisi"),
      body: t("Limit sayacı, stint bazlı köşe tablosu ve hızlı atama. Wet lastikler limitten düşmez; siyah kutu eski kuru lastiği geri takar.") },
    /* --- Pilotlar --- */
    { sel: "[data-tour='roster']", act: () => setTab("drivers"),
      title: t("Pilot Kadrosu"),
      body: t("Kadroyu elle yaz ya da takım üyelerinden tek tıkla ekle. Stintlere atadıkça toplam sürüş süresi ve yüzde dağılımı hesaplanır.") },
    /* --- Telemetri --- */
    { sel: "[data-tour='teleimport']", act: () => setTab("tele"),
      title: t("📈 Telemetri"),
      body: t("MoTeC dosyanı bırak — tur raporu da ham kanal log'u da okunur. %105 kuralı yavaş turları otomatik eler, medyan tur tek tıkla DATA'ya yazılır.") },
    /* --- Pit board / PDF --- */
    { sel: "[data-tour='pitboard']", title: t("Pit Board"),
      body: t("Yarış canlıyken tam ekran pit board: geri sayım, sıradaki pit ve PIT YAPILDI butonu. Gerçek pitler plana işlenir, sapma görünür. Canlı bağlıyken pit'e girdiğin an kendiliğinden işaretlenir (🤖).") },
    { sel: "[data-tour='pdf']", title: t("PDF çıktısı"),
      body: t("Stint programını takıma dağıtmak için tek tık — başlık sezon ve yarış adından otomatik gelir.") },
  ];
}

/* ---------- Canlı Timing bölümü ----------
   Canlı sekmesi veri yokken tek kutuya düşer (LiveTab erken-return) → rehber
   adımlarında hedefler DOM'da olmazdı. Bu yüzden her adım DEMO'yu açar
   (setTourDemo(true)): 14 sahte araçla tüm ekran dolu render olur, spot ışığı
   doğru kutuyu çerçeveler. Tur kapanınca App demoyu kapatır. */
export function liveSteps(t, { setTab, setTourDemo }) {
  const live = () => { setTab("live"); setTourDemo(true); };
  return [
    { sel: "[data-tour='livedemo']", act: live,
      title: t("📡 Canlı Timing — ve 🎬 Demo"),
      body: t("Oyundan gelen gerçek zamanlı yarış verisi: saha tablosu, pist haritası ve kendi aracın. Rehber şu an Demo'yu açtı — oyun ya da köprü olmadan ekranın nasıl göründüğünü görüyorsun. Demo sahte 14 araç akıtır ve hiçbir şeyi kaydetmez; kapatınca gerçek veriye döner.") },
    { sel: "[data-tour='liveconn']", act: live,
      title: t("Veri nereden gelir?"),
      body: t("Gerçek veri, oyunun çalıştığı PC'deki Masaüstü Uygulamasından gelir: orada 'Canlı Köprü Başlat'a basılır, veri tüm takıma akar. Buradaki rozet tazeliği gösterir — canlı, gecikmeli ya da çevrimdışı. Veri 30 sn durursa ekran tek kutuya iner ki kimse eski tabloyu canlı sanmasın.") },
    { sel: "[data-tour='livesession']", act: live,
      title: t("Seans şeridi"),
      body: t("Seans tipi, bayrak/faz, kalan süre, pist ve ortam sıcaklığı, yağmur ile zemin ıslaklığı (oyunun kendi kelimeleriyle) ve 🛞 tutuş tahmini. Bayrak sarıya dönerse hangi sektörlerin sarı olduğu da yazar.") },
    { sel: "[data-tour='ownlive']", act: live,
      title: t("Kendi Araç"),
      body: t("Yakıt ve VE halkaları, dört köşe lastik (aşınma, iç sıcaklık, basınç), anlık gaz/fren/vites/hız, S1/S2/S3 sektörlerin ve AVG5/AVG/stint süresi. Yakıt tüketimi turlar geçtikçe öğrenilir — 'Son Stint Yakıtı' sekmesinde tek tıkla plana uygulanır.") },
    { sel: "[data-tour='livemap']", act: live,
      title: t("Pist Haritası + 🎯 Strateji"),
      body: t("Araçlar sınıf renginde, içlerinde sınıf-içi sıraları yazılı akar. Pist şekli turlar döndükçe oluşur ve takımca kaydedilir — sonraki girişte hazır gelir. Üstteki strateji şeridi önündeki/arkandaki aracı ve temiz hava penceresini söyler. ⛶ Büyüt ile harita tam ekran açılır.") },
    { sel: "[data-tour='livefield']", act: live,
      title: t("Saha tablosu"),
      body: t("Her araç için sınıf-içi pozisyon, lidere Gap ve öndekine Aralık, tur-altı durumu, son/en iyi tur, lastik (hamur ikonu + en kötü aşınma) ve VE. Sütun başlıklarına tıkla: Pilot↔Takım, Sınıf (yalnız kendi sınıfını süz), Son↔En İyi, AVG5↔AVG kendi içinde değişir.") },
    { sel: "[data-tour='livelapsbtn']", act: live,
      title: t("Tur geçmişi — satırdaki +"),
      body: t("Bir aracın o ana kadarki tüm turları: süre, S1/S2/S3 sektörleri, o turu kimin sürdüğü (pilot değişimi vurgulanır), o turdaki pist koşulları (asfalt sıcaklığı · tutuş · ıslaklık) ve pit'te alınan lastikler. Yarış boyunca kalıcı birikir.") },
    { sel: "[data-tour='livepos']", act: live,
      title: t("Pozisyon grafiği"),
      body: t("Tur tur sıralama değişimi — kimin nerede kazandığı/kaybettiği tek bakışta. Pit turları işaretlidir, böylece sıra düşüşünün pitten mi yoksa tempodan mı olduğu ayırt edilir.") },
    { sel: "[data-tour='livebig']", act: live,
      title: t("⛶ Büyük Pano"),
      body: t("Tüm Canlı sekmesini tam ekran pit duvarı paneline çevirir — masadan uzaktan okunur. Bu kadar! Demo'yu kapatmayı unutma. İyi yarışlar. 🏁") },
  ];
}

/* Bölüm adına göre adım dizisi. "main" = core + live (otomatik başlayan tam tur). */
export function buildTourSteps(section, ctx) {
  const { t } = ctx;
  if (section === "lobby") return lobbySteps(t);
  if (section === "live") return liveSteps(t, ctx);
  if (section === "core") return coreSteps(t, ctx);
  return [...coreSteps(t, ctx), ...liveSteps(t, ctx)];
}
