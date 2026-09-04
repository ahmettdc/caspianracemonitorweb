/* ============================================================
   SÜRÜM NOTLARI — uygulama içi "ℹ Neler değişti" penceresi
   En yeni sürüm en üstte olacak şekilde ekle.
   APP_VERSION (App.jsx) buradaki ilk kaydın "v" alanıyla aynı olmalı.
   ============================================================ */
export const CHANGELOG = [
  {
    v: "v2.4.1",
    date: "2026-09-04",
    tr: [
      "🐞 Hata düzeltme sürümü — bu kayıt düzeltmeler indikçe doldurulur.",
    ],
    en: [
      "🐞 Bug-fix release — this entry is filled in as fixes land.",
    ],
  },
  {
    v: "v2.4.0",
    date: "2026-09-01",
    tr: [
      "🐞 KOD İNCELEMESİNDE BULUNAN 7 HATA DÜZELTİLDİ (hepsi bu sürümün kendi kodunda). En ciddisi: \"Planımdan ekle\" satırı, planın yarış SONU hava çarpanını tüm yarışa uyguluyordu — kuru→ıslak bir planda tahmini bitiş 27 dakika şişiyordu. Artık ortalama tur planın gerçek stint toplamından geliyor. Aynı şekilde yakıt her durağa tam servis yazıyordu (oysa plan durak başına ölçekler ve yakıt alınmayan durağı atlar) ve lastik hep 12 sn sayılıyordu (plan 1-2 lastikte 5 sn kullanır) — 2 lastikli planda 84 sn yerine gerçek 35 sn. Tohumlanan satır artık planın süresini birebir yeniden üretiyor. Ayrıca: tek satırlık defterde satır KENDİSİYLE karşılaştırılıp \"İki strateji eşit\" yazıyordu, artık uyarı çıkıyor · düzenleme penceresindeki \"plandan doldur\" girdiğiniz ceza ve balastı siliyordu, artık koruyor · \"2.02.500\" (MoTeC yazımı) tur süresi reddediliyordu, artık kabul ediliyor · adsız ama verisi tam satır ne sıralamaya ne de \"eksik veri\" listesine giriyordu.",
      "🎨 STRATEJİ KARŞILAŞTIRMA EKRANI TASARIM FİŞİNE GÖRE YENİDEN KURULDU. Artık üstte iki büyük \"hero\" kartı var: her plan kendi aracının görseli, numarası, sınıf rozeti ve TAHMİNİ BİTİŞ süresiyle karşı karşıya duruyor; ortadaki karar kartı kazananı adıyla, farkı büyük punto ile ve kazanan tarafa doğru büyüyen bir çubukla veriyor. Altına \"sabit kayıp dağılımı\" çubuğu eklendi: pit yolu / yakıt / lastik / ceza / hasar renkli dilimler halinde ve İKİ PLAN ORTAK ÖLÇEKTE çiziliyor, yani sürenin nereye gittiği bir bakışta görülüyor. Kayıt defteri artık salt-okunur bir tablo; satıra tıklayınca düzenleme penceresi açılıyor (takım adı, araç no, sınıf, araç seçimi ve 11 sayısal alan tek yerde). Sıralama listesi araç görselleriyle geldi. Toplam yarış turu artık −/+ sayacıyla ayarlanıyor.",
      "🏁 STRATEJİ KARŞILAŞTIRMA'ya PİST + SINIF seçici eklendi. Pist ve sınıfı seçince pit yolu süresi ve ortalama tur ÖNERİSİ çıkıyor; \"Boş satır\" eklerken bu iki alan hazır geliyor, üstüne elle yazabiliyorsunuz. İkisi de gerçek kaynaktan: pit yolu LMU Endurance Planner verisinden (PIT_LANE_TIMES), ortalama tur uygulamanın zaten günlük güncellediği \"Ohne Speed\" tempo tablosundan (lmu-data.json, pist × sınıf). Pist seçilmezse mevcut yarışın pistine/sınıfına düşer. Bir alanın verisi yoksa \"veri yok\" yazıyor ve o alan boş bırakılıyor — uydurma sayı konmuyor.",
      "🅰️🅱️ \"A PLANI MI B PLANI MI HIZLI\" — aynı ekran kendi planlarınızı da karşılaştırıyor. \"Planımdan ekle\"nin yanında dört strateji varyantınız düğme olarak duruyor (A · 8, B · 9, C · 10, D · 11 — stint başına tur). Bastığınız varyantın GERÇEK planı hesaplanıp satır olarak ekleniyor: pit sayısı, pit yolu, tam servis ve son durak yakıt süreleri, lastik değişen durak sayısı. İki varyantı ekleyip karşılaştırınca \"Plan D · 11 tur 5:35.1 sn önde\" gibi doğrudan bir cevap alıyorsunuz. Plan yalnız düğmeye BASILINCA hesaplanıyor — dört varyantı sürekli hesaplamak oyun PC'sinde de ödenecek bir maliyet olurdu.",
      "⚠️ MODELLENMEYEN ŞEY YAZILI: iki satırın ortalama turu birebir aynıysa sonuç kutusunda uyarı çıkıyor — \"fark yalnız pit/yakıt/lastikten geliyor; uzun stintin yakıt yükü ve lastik yaşı yüzünden turu yavaşlatması bu modelde YOK\". İki planı da uygulamadan doldurunca ortalama tur aynı gelir (plan motoru tek bir efektif tur süresi kullanıyor), yani uyarı olmasa araç \"az durak hep kazanır\" derdi. Gerçek tempo farkını biliyorsanız ortalama turu satır başına elle girebiliyorsunuz.",
      "🆚 YENİ EKRAN — STRATEJİ KARŞILAŞTIRMA (sol menüde \"Strateji\"). Yarış ÖNCESİ, hangi stratejinin kazandığına karar vermek için. Takımın Excel'indeki (Race Control v1.28) \"TEAMS STRATEGY\" + \"STRATEGY COMP\" sayfalarının işini yapıyor: iki takımın pit sayısı, pit yolu süresi, yakıt (tam servis ve son durak ayrı), lastik süresi/adedi, ceza ve hasar kalemleri toplanıp tur farkının tüm yarışa yayılmış etkisiyle birleşiyor; sonuçta tek bir cümle çıkıyor — \"#4 PESCARA SRT 13.9 sn önde\". Ayrıca deftere girilmiş TÜM takımların tahmini bitiş sırası ve geride kalanın farkı kapatmak için tur başına bulması gereken saniye gösteriliyor. Bu ekran yarış sırasında kullanılmaz; canlı veriye, köprüye ve oyun PC'sine hiç dokunmuyor.",
      "🧮 \"PLANIMDAN EKLE\" — kendi satırınızı elle doldurmuyorsunuz. Stint planınızdaki gerçek pit sayısı, pit yolu süresi, tam servis yakıt süresi, lastik değişen durak sayısı ve havaya göre düzeltilmiş ortalama tur kendiliğinden geliyor. En önemlisi SON DURAK YAKIT SÜRESİ: son durakta yalnız bitirmeye yetecek yakıt alınır, plan bunu zaten hesaplıyor ve buraya o değer yazılıyor. Excel'de tam da bu kalem elle girildiği için tam servis (40 sn) kalmıştı; dosyadaki karşılaştırmada bu tek hücre sonucu 13.9 sn geriden 19.1 sn öne çeviriyordu.",
      "🚫 EKSİK VERİ ARTIK SIFIR SAYILMIYOR. Excel'de takım seçicisi boş bir satıra denk gelince ortalama tur 0 okunuyor ve 174 turluk yarışta \"−21.867 sn\" gibi (≈ 6 saat) tamamen uydurma bir sonuç çıkıyordu — üstelik negatif olduğu için AVANTAJ rengiyle yeşile boyanıyordu. Yeni ekranda eksik alanı olan takım hesaplanmıyor: hangi alanların boş olduğu adıyla yazılıyor ve hiçbir sayı gösterilmiyor. Boş bırakılan ceza ve hasar ise 0 sn sayılıyor (yarış öncesi normal durum) — bu da ekranda yazılı.",
      "🎨 KAZANAN ADIYLA YAZILIYOR, renge bırakılmıyor. Excel'in koşullu biçimi \"negatif → yeşil\" idi ve tüm farklar sol panel eksi sağ panel yönündeydi; kendi takımınız sağda durduğu için \"rakip 13.9 sn önde\" YEŞİL, \"biz 47 sn öndeyiz\" KIRMIZI görünüyordu. Artık sonuç cümlesi hangi takımın kaç saniye önde olduğunu doğrudan yazıyor.",
      "✅ Kayıt defterinde satır başına tutarlılık denetimi: stint sayısı pit sayısı + 1 değilse ya da lastik değişimi durak sayısını geçiyorsa satırda uyarı işareti çıkıyor (hesabı durdurmuyor, yalnız veri girişi hatasını gösteriyor). Excel'de STINT NUMBERS sütunu hiçbir formüle girmiyordu. Balast sütunu bilgi amaçlı duruyor ve hesaba GİRMİYOR — oyun kg → sn/tur karşılığını vermediği için modellenmiş bir sayı uydurulmadı.",
    ],
    en: [
      "🐞 SEVEN BUGS FOUND IN CODE REVIEW WERE FIXED (all in this version's own code). The worst: an \"Add from my plan\" row applied the plan's END-of-race weather factor to the whole race — on a dry→wet plan the projected finish was inflated by 27 minutes. The average lap now comes from the plan's real stint total. Likewise fuel charged a full service at every stop (the plan scales per stop and skips stops that take no fuel) and tyres always counted 12 s (the plan uses 5 s for 1-2 tyres) — 35 s of real time instead of 84 s on a two-tyre plan. A seeded row now reproduces the plan's time exactly. Also: a one-row register compared the row WITH ITSELF and printed \"the two strategies are equal\", now it warns instead · \"fill from plan\" in the edit window wiped the penalty and ballast you had typed, now it keeps them · lap times in MoTeC notation (\"2.02.500\") were rejected, now accepted · a row with no name but complete data appeared in neither the ranking nor the \"missing data\" list.",
      "🎨 THE STRATEGY COMPARISON SCREEN WAS REBUILT TO THE DESIGN HANDOFF. Two large hero cards now sit head-to-head: each plan shows its car render, number, class badge and PROJECTED FINISH time; the verdict card between them names the winner, shows the gap in large type and a bar that grows toward the winning side. Below it a \"fixed-loss breakdown\" bar was added: pit lane / fuel / tyres / penalty / damage as coloured segments drawn on a SHARED SCALE across both plans, so you see at a glance where the time goes. The register is now a read-only table; clicking a row opens an edit window (team name, car number, class, car pick and all 11 numeric fields in one place). The ranking list gained car renders. Total race laps is now set with a −/+ stepper.",
      "🏁 The STRATEGY COMPARISON screen gained a TRACK + CLASS picker. Pick a track and class and it suggests the pit lane time and average lap; adding a \"Blank row\" pre-fills those two fields, which you can then override by hand. Both come from real sources: pit lane from the LMU Endurance Planner data (PIT_LANE_TIMES), average lap from the \"Ohne Speed\" pace table the app already refreshes daily (lmu-data.json, per track × class). With no track picked it falls back to the current race's track/class. If a field has no data it reads \"no data\" and is left blank — no number is invented.",
      "🅰️🅱️ \"IS PLAN A OR PLAN B FASTER\" — the same screen compares your own plans too. Next to \"Add from my plan\" your four strategy variants sit as buttons (A · 8, B · 9, C · 10, D · 11 — laps per stint). Pressing one computes that variant's REAL plan and adds it as a row: pit count, pit lane, full-service and last-stop fuel times, number of tyre-change stops. Add two variants and you get a direct answer such as \"Plan D · 11 laps is 5:35.1 s ahead\". A plan is computed only WHEN THE BUTTON IS PRESSED — computing all four continuously would be a cost paid on the game PC as well.",
      "⚠️ WHAT IS NOT MODELLED IS STATED: when two rows have exactly the same average lap, the result box shows a warning — \"the difference comes only from pit/fuel/tyres; this model does NOT include a longer stint being slower from fuel load and tyre age\". Filling both plans from the app gives the same average lap (the plan engine uses a single effective lap time), so without the warning the tool would say \"fewer stops always wins\". If you know the real pace difference you can enter the average lap per row by hand.",
      "🆚 NEW SCREEN — STRATEGY COMPARISON (\"Strategy\" in the left rail). For deciding BEFORE the race which strategy wins. It does the job of the team's Excel sheets (Race Control v1.28) \"TEAMS STRATEGY\" + \"STRATEGY COMP\": two teams' pit count, pit lane time, fuel (full service and last stop kept separate), tyre time and count, penalty and damage are summed and combined with the lap-time delta spread across the whole race; the result is a single sentence — \"#4 PESCARA SRT is 13.9 s ahead\". It also shows the projected finishing order of EVERY team in the register and the per-lap seconds the trailing team needs to find. This screen is not used during the race; it never touches live data, the bridge, or the game PC.",
      "🧮 \"ADD FROM MY PLAN\" — you do not fill in your own row by hand. The real pit count, pit lane time, full-service fuel time, number of tyre-change stops and the weather-corrected average lap all come from your stint plan. Most importantly the LAST-STOP FUEL TIME: the final stop only takes on enough fuel to finish, the plan already computes this, and that value is what lands here. In Excel this exact figure was typed by hand and had been left at full service (40 s); in that file this one cell turned the comparison from 13.9 s behind into 19.1 s ahead.",
      "🚫 MISSING DATA IS NO LONGER TREATED AS ZERO. In Excel, picking a team whose row was empty read the average lap as 0 and produced a completely fabricated result such as \"−21,867 s\" (≈ 6 hours) over a 174-lap race — and, being negative, it was painted green as an ADVANTAGE. In the new screen a team with any missing field is not calculated: the blank fields are listed by name and no number is shown. Blank penalty and damage do count as 0 s (the normal pre-race case) — and the screen says so.",
      "🎨 THE WINNER IS NAMED, not left to colour. Excel's conditional format was \"negative → green\" and every delta ran left panel minus right panel; because your own team sat on the right, \"the rival is 13.9 s ahead\" showed GREEN while \"we are 47 s ahead\" showed RED. The result sentence now states directly which team is ahead and by how much.",
      "✅ Per-row consistency checks in the register: if the stint count is not pit count + 1, or tyre changes exceed pit stops, a warning mark appears on that row (it does not stop the calculation, it just flags the data-entry slip). In Excel the STINT NUMBERS column fed no formula at all. The ballast column is informational and does NOT enter the calculation — the game exposes no kg → s/lap conversion, so no modelled number was invented.",
    ],
  },
  {
    v: "v2.3.1",
    date: "2026-09-01",
    tr: [
      "🪖 DRIVERMODE butonu eklendi (yalnız Windows uygulamasında, üst barda Rehber'in solunda). Tıklayınca Race Monitor tamamen kapanıyor ve kuruluma gömülü tarayıcısız hafif köprü (CaspianLiveBridge) kendiliğinden açılıyor. Neden gerekliydi: sürüş PC'sinde masaüstü arayüzü Chromium/WebView2 taşıdığı için oyunla GPU ve çekirdek çekişiyor — bu, sahada ölçülmüş donma sebeplerinden biri. Köprü bağımsız bir süreç olarak başlatılıyor, yani Race Monitor kapandıktan sonra da veri akışı sürüyor; köprü penceresindeki \"Race Engineer'a Dön\" ile geri dönülüyor. Buton uygulamayı kapattığı için önce onay soruyor — yarış ortasında kazara tıklamak mühendisin ekranını kapatmasın. Köprü açılamazsa (ör. eski kurulum) butonun yanında sebebi yazıyor; sessizce hiçbir şey olmuyor durumu yok.",
      "🛞 LASTİK STRATEJİSİ EKRANI baştan tasarlandı. Eski ekranda beş KPI kartı ve 26 sete kadar büyüyen bir \"set envanteri\" çip şeridi vardı; şerit ölçeklenmiyordu ve asıl iş yapılan plan tablosu aşağıya itiliyordu. Artık üstte tek bir şerit var: kuru set limiti · numaralı SET BÜTÇESİ (her kutu bir set, kullanım rengiyle boyalı, sığmazsa sarıyor) · köşe başına aşınma · plandaki toplam lastik değişim süresi. Bir bakışta \"kaç set kaldı, hangisi kaç kez koştu, plan pitte kaç saniye tutuyor\" okunuyor.",
      "📉 AŞINMA artık TUR BAŞINA ve KÖŞE BAŞINA. Önceden tek bir \"stint başına %30\" vardı ve dört köşeye aynı uygulanıyordu — oysa sağ virajı bol bir pistte ön-sol tek başına biter. Artık FL/FR/RL/RR ayrı ayrı ayarlanıyor (adım %0.1/tur), her hücrenin altındaki DİŞ BARI o köşenin kendi oranıyla hesaplanıyor. \"ölçülen\" butonu canlı telemetriden dört köşeyi tek tıkla yazıyor; \"eşitle\" dördünü ortalamaya çekiyor. Eski tek-sayı ayarınız otomatik olarak köşe oranlarına çevriliyor, elle bir şey yapmanız gerekmiyor.",
      "💥 PATLAK İŞARETİ eklendi. Yarışta bir lastik patladığında hücreye tıklayıp \"Bu stintte patladı\" diyorsunuz; hücre kesikli kırmızı çerçeveye giriyor, diş barı taranmış \"PATLADI\" oluyor, set bütçesinde o kutu taranıyor ve başlıkta \"N patlak\" rozeti çıkıyor — yani patlayan set plan boyunca bir daha kullanılamaz olarak görünüyor. Ve gerçekten kullanılamıyor: patladığı stintten SONRAKİ hiçbir hücrede seçilemiyor (seçicide kilitli çıkıyor, hızlı atamadaki 'Qual’a dön' de onu geri getiremiyor). Patladığı stint ve öncesi geçerli kalıyor — lastik o sırada gerçekten araçtaydı. Not: patlak şu an pit süresine bir şey EKLEMİYOR (plansız durak modellenmedi), yalnız işaretleniyor. Ayrıca \"PATLAK\" artık YALNIZ sizin işaretlediğiniz hücrede yazıyor: planda dişi bitmiş bir set eskiden de \"PATLAK\" diyordu ve hiç dokunmadığınız taşıma hücreleri patlak görünüyordu — o durum artık dürüstçe \"%0\" okunuyor.",
      "🖱 Hücreye tıklayınca artık açılır kutu yerine \"LASTİK SEÇ\" PENCERESİ geliyor: önceki setle devam · wet · patlak işareti · kuru set ızgarası (köşe kilidini ihlal edenler kilit simgesiyle seçilemez halde) · hücreyi boşalt. Hangi setin hangi köşeye kilitli olduğu ve kaç kez koştuğu her kutunun üstünde yazıyor, yani seçim yaparken tahmin etmiyorsunuz. Lastik defteri de karttan çıkıp bir butona ve küçük pencereye taşındı — sayfa kısaldı, defter isteyince açılıyor.",
      "🔧 \"Pitte ne oluyor\" sütunu netleşti: köşe başına dört nokta (taşı · yeni kuru · Qual'a dön · wet · eski kuru tekrar) + o duruşun süresi + \"4 lastik · yeni\" gibi tek satır özet. Üç lastik değişen satırda \"4. teker aynı sürede\" uyarısı çıkıyor, çünkü pit süresi 3 ile 4 arasında değişmiyor.",
    ],
    en: [
      "🪖 A DRIVERMODE button was added (Windows app only, in the top bar to the left of Guide). Clicking it closes Race Monitor completely and starts the browserless lightweight bridge (CaspianLiveBridge) that ships inside the install. Why it was needed: on the driving PC the desktop UI carries Chromium/WebView2 and competes with the game for GPU and cores — one of the freeze causes measured in the field. The bridge starts as an independent process, so data keeps flowing after Race Monitor is gone; the bridge window's \"Back to Race Engineer\" brings you back. Because the button closes the app it asks for confirmation first, so a stray click mid-race does not take the engineer's screen away. If the bridge cannot start (an older install, say), the reason is shown next to the button; there is no silent no-op.",
      "🛞 The TYRE STRATEGY screen was redesigned. The old screen had five KPI cards and a \"set inventory\" chip strip that grew to 26 sets; the strip did not scale and it pushed the plan table — where the actual work happens — down the page. There is now a single top strip: dry set limit · a numbered SET BUDGET (one box per set, painted in its usage colour, wrapping when it does not fit) · wear per corner · the plan's total tyre-change time. At a glance you read \"how many sets are left, which one has run how many times, how many seconds the plan costs in the pits\".",
      "📉 WEAR is now PER LAP and PER CORNER. There used to be a single \"30% per stint\" applied to all four corners — yet at a right-hander-heavy track the front-left goes off on its own. FL/FR/RL/RR are now set separately (0.1%/lap steps), and the TREAD BAR under each cell is computed with that corner's own rate. The \"measured\" button writes all four corners from live telemetry in one click; \"level\" pulls all four to the average. Your old single-number setting is converted to per-corner rates automatically — there is nothing to redo by hand.",
      "💥 A BLOWOUT MARK was added. When a tyre blows during the race you click the cell and choose \"it blew out in this stint\": the cell gets a dashed red border, the tread bar becomes a hatched \"BLEW OUT\", that box is hatched in the set budget, and an \"N blowouts\" chip appears in the header — so the blown set reads as unusable for the rest of the plan. And it really is unusable: it cannot be picked in any cell AFTER the stint it blew out in (the picker shows it locked, and the 'back to Qual' quick action cannot bring it back either). The stint it blew out in, and everything before it, stays valid — the tyre really was on the car then. Note: a blowout currently ADDS NO time to the pit stop (an unplanned stop is not modelled); it is only marked. Also, \"BLEW OUT\" now appears ONLY on cells you marked: a set whose tread ran out in the plan used to say \"BLEW OUT\" too, so carried cells you never touched looked blown — that case now honestly reads \"%0\".",
      "🖱 Clicking a cell now opens a \"PICK A TYRE\" window instead of a dropdown: carry the previous set · wet · blowout mark · a dry-set grid (sets that would break the corner lock are shown locked and cannot be picked) · clear the cell. Each box states which corner the set is locked to and how many times it has run, so you are not guessing while you pick. The tyre log also moved out of its card into a button and a small window — the page got shorter and the log opens on demand.",
      "🔧 The \"what happens in the pit\" column is clearer: four dots per corner (carry · new dry · back to Qual · wet · old dry again) plus that stop's time and a one-line summary such as \"4 tyres · new\". A row that changes three tyres warns \"the 4th costs the same\", because pit time does not differ between 3 and 4.",
    ],
  },
  {
    v: "v2.3.0",
    date: "2026-08-31",
    tr: [
      "🟣 Canlı Timing'de SEKTÖR SÜRELERİ artık renkli. Şimdiye kadar S1·S2·S3 düz gri yazılıyordu: sayılar vardı ama hangisinin iyi olduğu görünmüyordu. Artık her sektör kendi rengini alıyor — MOR: o sektörün sınıf rekoru, YEŞİL: sürücünün kişisel en iyisi. Renk anlamı satır flash'ıyla (mor/yeşil yanıp sönme) birebir aynı, yani ekranda tek bir 'mor' anlamı var. Bu, klasik timing tower'ların en çok kullanılan sinyaliydi ve bizde eksikti.",
      "🔎 Saha tablosuna SIRALAMA ve ARAMA geldi. Şimdiye kadar sıra tamamen yarış pozisyonuydu; 'en çok hasar alan kim', 'kim kaç kez pite girdi', 'AVG5'i en iyi olan' gibi sorular tabloyu gözle tarayarak cevaplanıyordu. Artık her sütun başlığındaki küçük ok ile sıralanabiliyor (ikinci tık yönü çevirir, üçüncü tık yarış sırasına döner) ve pilot/takım/araç no/araç/sınıf üzerinden arama yapılabiliyor. Aksansız yazsanız da bulur (\"sahin\" → \"Şahin\"). Verisi olmayan satırlar hangi yöne sıralarsanız sıralayın her zaman sona gider.",
      "🎯 RELATIVE görünümü eklendi. Sıralama tablosu yarış sırasını gösterir, ama pit duvarının asıl sorusu 'şu an etrafımda kim var' olur — tur-altı bir araç sıralamada 15 satır aşağıdadır ama pistte tam önünüzde olabilir. Yeni 'Relative' düğmesi pist konumuna göre etrafınızdaki araçları (±3) gösteriyor; Gap sütunu yerine pistte önünüzde (−) / arkanızda (+) kaç saniye olduğu yazıyor. Fark, oyunun KENDİ tur-içi zaman alanından okunuyor (TinyPedal'ın kullandığı yöntemin aynısı) — mesafeden hesaplamak sabit hız varsayardı ve yavaş virajlarda yanıltırdı. Trafik, mavi bayrak ve undercut penceresi kararları buradan okunur. (Köprünüz eskiyse fark yaklaşık hesaplanır; köprüyü güncelleyince kendiliğinden düzelir.)",
      "🛞 LASTİK sütunu artık DÖRT KÖŞEYİ birden gösteriyor. Önceden yalnız 'en kötü' tek bir yüzde vardı — 'hangi lastik bitti' sorusu cevapsızdı. Artık ÖnSol/ÖnSağ/ArkaSol/ArkaSağ ayrı ayrı, renkli 2×2 ızgarada. (Dört köşe verisi zaten geliyordu, sadece gösterilmiyordu.)",
      "🔧 PİT sütununa SON DURAKTA DEĞİŞEN LASTİK rozeti eklendi: '4', '2 ÖN' ya da yakıt-only durakta '0'. Kendi aracınızda tam çalışır. ÖNEMLİ SINIR: tespit lastik aşınmasına dayanıyor ve oyun online yarışta rakiplerin aşınmasını yayınlamıyor — bu yüzden rozet online'da rakiplerde çoğunlukla ÇIKMAZ (yalnız slick→wet gibi bileşim değişimini yakalayabilir). Offline/AI yarışlarda herkes için çalışır. Veri yoksa rozet hiç çizilmiyor, tahmin üretilmiyor.",
      "🏎 ÇÖZÜLDÜ: 'Kendi Araç' kartı her zaman jenerik 'Kendi Araç' yazıyor ve sınıf rengi hiç görünmüyordu. Sebep: köprü kendi araç bilgisini oyunun TELEMETRİ tarafından kuruyor, pilot adı ve sınıf ise yalnız SIRALAMA tarafında bulunuyor — bu iki alan hiçbir zaman karta ulaşmıyordu. Artık kendi satırınızdan alınıyor; takım, marka ve araç no da aynı şekilde düzeldi.",
      "🏁 YARIŞI BIRAKAN araçlar artık belli oluyor. Şimdiye kadar DNF/DSQ olan bir araç tabloda hâlâ yarışıyormuş gibi duruyordu (verisi donuyor ama satır normal görünüyordu) — 'kim hâlâ sahada' sorusunu gözle çıkarmak gerekiyordu. Artık DNF/DSQ çipi var ve satır soluklaşıyor.",
      "🔧 PİT sütunu artık AŞAMA gösteriyor: ÇAĞRI · GİRİŞ · DURDU · ÇIKIŞ. En değerlisi ÇAĞRI — bu, rakip pit talebi verdiği ama HENÜZ PİSTTE olduğu an demektir; undercut'a karşı önden pozisyon almanızı sağlar, o yüzden ayrı renkte. (Köprünüz eskiyse eski düz 'PIT' çipi görünmeye devam eder; köprüyü güncelleyince aşamalar gelir.)",
      "📏 Lastik planındaki her hücre artık DİŞ durumunu yazıyor: 'Yeni–%70' (o stint yeni lastik) ya da '%70–%40' (kullanılmış). Diş bitiyorsa 'PATLAK' uyarısı çıkıyor. Böylece 'yeni lastiği hangi stint kullanıyor' sorusu tabloda doğrudan okunuyor. Ayrıca yeni DEĞİŞİM sütunu her stintin pit süresi maliyetini gösteriyor (+4.5s tek taraf / +12s dört lastik) ve toplamı KPI'da. Stint başına aşınma yüzdesini elle ayarlayabilirsiniz — ama canlı telemetriden ÖLÇÜLEN değer öneri olarak çıkıyor, tek tıkla uyguluyorsunuz.",
      "🛞 Lastik sekmesine LASTİK DEFTERİ eklendi: yarış boyunca yapılan GERÇEK lastik değişimleri kendiliğinden buraya düşüyor — elle hiçbir şey girmiyorsunuz. Her satır bir lastik dönemi: hangi turlar arası, başında ne takıldı (YENİ tam set / 2 aks), hangi hamur, kaç tur koştu. 'Yeni lastiği hangi stint kullandı' sorusu artık doğrudan okunuyor. Yakıt-only duraklar yeni dönem açmaz ama sayılır. Not: oyun lastik set kimliği vermiyor ve hamuru yalnız ön/arka veriyor; defter bunları uydurmuyor, ekranda da yazıyor. Ayrıca PLAN ↔ GERÇEK karşılaştırması: planladığınız değişimlerle gerçekleşenler yan yana çiziliyor ('4→2' gibi), sapma varsa başlıkta sayısı yazıyor. Plan için ayrı bir tablo doldurmuyorsunuz — mevcut tablodan türetiliyor.",
      "🚀 Yeni VMAX sütunu: her aracın seansta gördüğü en yüksek hız. 'Kim düzlükte hızlı' sorusunun cevabı — kanat/sürükleme ve savunma/atak kararları için. Sütun başlığından sıralanabiliyor, tooltip'te aracın o anki hızı da var. Dürüstlük notu: slipstream'de atılan hız da bu sayıya dahildir, yani tow'da görülen değer aracın kendi düz hızı olmayabilir.",
      "🎛 'Poz · Sınıf' başlığına basınca açılan 'kendi sınıfım' süzgeci artık PİST HARİTASINI da süzüyor. Önceden tablo kendi sınıfınıza iniyordu ama harita tüm sahayı göstermeye devam ediyordu; iki panel aynı ekranda farklı şey anlatıyordu. Süzgeç açıkken harita başlığında hangi sınıfın gösterildiği ve kaç aracın gizlendiği yazıyor. Not: harita şekli yine tüm araçlardan oluşturuluyor, süzgeç yalnız görünen araçları etkiliyor.",
      "🖥 ÇÖZÜLDÜ: Pist haritasını ⧉ ile ayrı pencerede açınca araçlar akıcı kaymak yerine donarak/zıplayarak ilerliyordu (⛶ Expand'de sorun yoktu). Sebep: ayrı pencere haritayı sürekli kopyalayarak tazeleniyordu; kopyalama araç noktalarını her seferinde sıfırdan kurduğu için yumuşak geçiş animasyonu hiç çalışamıyordu, üstelik kopyalama ritmi veri akışıyla uyuşmuyordu. Artık pencere doğrudan canlı çiziliyor — Expand ile birebir aynı akıcılıkta. Ayrıca ayrı pencerede bazı renklerin yanlış çıkması ve pencereyi tekrar tekrar açınca oluşan sızıntı da düzeldi.",
      "🎯 Haritada PİT ÇIKIŞ TAHMİNİ. Pit talebi verdiğiniz anda harita üzerinde kırmızı çemberler beliriyor: 15 · 25 · 35 · 45 · 55 · 65 saniye. Her çember 'durağın bu kadar sürerse ŞU ANDA burada olan aracın yanına çıkarsın' demek — yanındaki araç noktasına bakarak 'kaç saniyelik durak beni kimin önüne/arkasına koyar' sorusunu doğrudan okuyorsunuz. Undercut kararının tam olarak ihtiyaç duyduğu bilgi. (Pit giriş/çıkışı henüz gözlenmemişse ya da harita yeterince dolmamışsa çizilmez — tahmin uydurulmuyor.)",
      "🗺 Pist haritası daha keskin. Devre şekli iki kat çözünürlükle çiziliyor (5 km'lik pistte ~21 m yerine ~10 m adım) — virajlar artık düzleşmiyor. Ayrıca haritayı eskiden 'o noktaya ilk gelen araç' belirliyordu ve bir daha güncellenmiyordu; tuhaf bir çizgi atan araç tüm seans boyunca iz bırakabiliyordu. Artık kendi aracınızın çizgisi haritayı düzeltiyor.",
      "🔢 Tur-tipi yarışlarda başlıkta TUR SAYACI ('42/68') gösteriliyor. Bu bilgi köprüden zaten geliyordu ama hiçbir yerde kullanılmıyordu. Süre-tipi yarışta gösterilmez.",
    ],
    en: [
      "🟣 SECTOR TIMES in Live Timing are now colour-coded. Until now S1·S2·S3 were plain grey: the numbers were there but you could not see which one was good. Each sector now gets its own colour — PURPLE: class record for that sector, GREEN: the driver's personal best. The colour meaning matches the row flash exactly, so there is only one meaning of 'purple' on screen. This was the most-used signal on a classic timing tower and we were missing it.",
      "🔎 SORTING and SEARCH came to the field table. Until now the order was purely race position, so questions like 'who has the most damage', 'who has pitted how many times' or 'who has the best AVG5' meant scanning the table by eye. Every column header now has a small arrow to sort by (a second click flips the direction, a third returns to race order), and you can search by driver, team, car number, car or class. Accent-insensitive (\"sahin\" finds \"Şahin\"). Rows with no data always sort to the bottom, whichever direction you pick.",
      "🎯 A RELATIVE view was added. The standings table shows race order, but the pit wall's real question is 'who is around me right now' — a lapped car sits 15 rows down in the standings yet may be directly in front of you on track. The new 'Relative' button shows the cars around you by track position (±3); instead of Gap, the column shows how many seconds ahead (−) or behind (+) they are on track. The gap is read from the game's OWN time-into-lap field (the same method TinyPedal uses) — deriving it from distance would assume constant speed and mislead in slow corners. Traffic, blue-flag and undercut-window calls are read from here. (With an older bridge the gap is approximated; updating the bridge fixes it automatically.)",
      "🛞 The TYRE column now shows ALL FOUR CORNERS. Previously only a single 'worst' percentage was displayed — 'which tyre is done' had no answer. FL/FR/RL/RR are now shown separately in a colour-coded 2×2 grid. (The four-corner data was already arriving, it just was not being displayed.)",
      "🔧 The PIT column gained a LAST-STOP TYRE CHANGE badge: '4', '2 FRONT', or '0' for a fuel-only stop. It works fully for your own car. IMPORTANT LIMIT: detection relies on tyre wear, and the game does not broadcast opponents' wear in online races — so the badge will usually NOT appear for rivals online (it can only catch a compound change such as slick→wet). In offline/AI races it works for everyone. When the data is missing no badge is drawn; nothing is guessed.",
      "🏎 FIXED: the 'My Car' card always read the generic 'My Car' and never showed a class colour. Cause: the bridge builds your own-car data from the game's TELEMETRY side, while driver name and class only exist on the SCORING side — those two fields never reached the card. They are now taken from your own row; team, brand and car number were fixed the same way.",
      "🏁 Cars that have RETIRED are now visible as such. Until now a DNF/DSQ car still looked like it was racing (its data freezes but the row looked normal) — you had to work out 'who is still running' by eye. There is now a DNF/DSQ chip and the row dims.",
      "🔧 The PIT column now shows the pit PHASE: CALL · IN · STOP · OUT. The valuable one is CALL — it means a rival has requested a stop but is STILL ON TRACK, which lets you get ahead of an undercut, so it is shown in a distinct colour. (With an older bridge you keep seeing the plain 'PIT' chip; updating the bridge brings the phases.)",
      "📏 Every cell in the tyre plan now shows TREAD: 'New–70%' (this stint gets fresh rubber) or '70%–40%' (used). If the tread runs out it warns 'BLOWOUT'. So 'which stint is on new tyres' is read straight off the table. A new CHANGE column shows what each stint's tyre change costs in pit time (+4.5s one side / +12s all four), with the total in the KPI row. You can set wear-per-stint by hand — but the value MEASURED from live telemetry is offered as a suggestion you apply with one click.",
      "🛞 A TYRE LOG was added to the Tyres tab: the REAL tyre changes made during the race land here on their own — you type nothing. Each row is a tyre period: which laps, what went on at the start (NEW full set / 2 axle), which compound, how many laps it ran. 'Which stint got the new tyres' is now read directly. Fuel-only stops do not open a new period but are counted. Note: the game exposes no tyre set ID and gives compound per axle only; the log does not invent either, and says so on screen. There is also a PLAN vs ACTUAL comparison: what you planned and what actually happened are shown side by side ('4→2'), with the number of deviations in the header. You do not fill in a separate plan — it is derived from the existing table.",
      "🚀 New VMAX column: the highest speed each car has reached this session. It answers 'who is quick in a straight line' — the input for wing/drag calls and for deciding whether you can attack or defend. Sortable from the header, and the tooltip also shows the car's current speed. In fairness: speeds set in a slipstream are included, so a number seen in a tow may not be the car's own straight-line pace.",
      "🎛 The 'my class only' filter (the 'Pos · Class' header) now filters the TRACK MAP as well. Previously the table narrowed to your class while the map kept showing the whole field, so the two panels told different stories. While the filter is on, the map header shows which class is displayed and how many cars are hidden. Note: the map outline is still built from every car — the filter only affects which cars are shown.",
      "🖥 FIXED: Opening the track map in a separate window (⧉) made the cars jump and stutter instead of gliding (⛶ Expand was fine). Cause: the separate window was refreshed by repeatedly copying the map, and copying rebuilt every car dot from scratch so the smooth transition could never run — on top of that the copy rhythm did not line up with the data rate. The window is now drawn live, exactly as smooth as Expand. Some colours being wrong in that window, and a leak from reopening it repeatedly, are fixed too.",
      "🎯 PIT-OUT PREDICTION on the map. The moment you request a pit stop, red circles appear on the map at 15 · 25 · 35 · 45 · 55 · 65 seconds. Each circle means 'if your stop takes this long, you will rejoin alongside the car that is HERE right now' — so by looking at the car dot next to it you read straight off which stop length puts you ahead of or behind whom. Exactly what an undercut call needs. (Nothing is drawn until pit entry/exit have been observed and the map is sufficiently filled — the prediction is never invented.)",
      "🗺 The track map is sharper. The circuit outline is drawn at twice the resolution (~10 m steps instead of ~21 m on a 5 km track), so corners no longer flatten out. Previously whichever car reached a point first defined the map there and it was never updated, so a car taking an odd line could leave a mark for the whole session. Your own car's line now corrects the map.",
      "🔢 In lap-type races the header now shows a LAP COUNTER ('42/68'). This data already came from the bridge but was never used anywhere. It is hidden in timed races.",
    ],
  },
  {
    v: "v2.2.4",
    date: "2026-08-30",
    tr: [
      "🗺 ÇÖZÜLDÜ: Telemetride gaz/fren grafikleri kaydediliyordu ama PİST HARİTASI kaydolmuyordu — yarışı kapatıp açınca grafikler geliyor, harita boş çıkıyordu. Sebep: LMU telemetrisindeki harita gerçek GPS'ten (enlem/boylam) geliyor ve bu koordinatlar çok küçük ondalıklı sayılar (örn. 47.9500). Kaydederken koordinatlar tam sayıya yuvarlanıyor (47.9500 → 48), böylece turun bütün noktaları tek bir noktaya çöküp harita yok oluyordu; grafik kanalları (hız/gaz/fren) büyük sayılar olduğu için etkilenmiyordu. Artık harita koordinatları turun kendi ölçeğine göre saklanıyor — harita da grafikler gibi kalıcı geliyor ve takım arkadaşları görebiliyor.",
      "📁 Setup havuzunda dosya adları standartlaştı. Önceden setup'lar yükleyenin ham dosya adıyla duruyordu (\"setup_1.svm\", \"Spa deneme (2).svm\") — havuz okunaksızdı, arama işe yaramıyordu, indirilen dosya tanınmıyordu. Artık ad formdaki bilgilerden üretiliyor: pist_sınıf-araç_seans-koşul_sürüm.svm (örn. spa_gt3-ferrari_r-dry_v3.svm). Araç adları sınıflar arasında tekrar ettiği için (Ferrari hem Hypercar hem GT3) sınıf da ada giriyor. Bu YALNIZ yeni yüklemelerde değil, havuzdaki TÜM kayıtlarda geçerli — adlar her görüntülemede bilgilerden üretiliyor, indirdiğin dosya da bu adla iniyor. Ayrıca telemetriden havuza kaydedilen setup'lar adsız kalıyordu (indirince uzantısız \"setup\" oluyordu); o da düzeldi.",
      "🔄 ÇÖZÜLDÜ: Yeni sürüm yayınlandıktan sonra uygulama bir SÜRE ESKİ HALİYLE açılmaya devam ediyordu — \"güncelledim ama değişmedi\" durumu. İki sebep üst üste biniyordu: (1) ana sayfa dosyası tarayıcıda 1 saat önbelleklendiği için, (2) çevrimdışı desteği veren service worker gezinmede bu önbellekten okuyup eski sayfayı, o da eski dosyaları çağırıyordu. Artık gezinme her seferinde sunucuya gidiyor ve sunucu ana sayfayı önbelleklenmez olarak işaretliyor; yeni sürüm ilk açılışta geliyor. (Bu düzeltmeyi görmek için SON BİR KEZ sayfayı zorla yenilemen gerekebilir: Ctrl+Shift+R / Cmd+Shift+R.)",
      "🎨 Telemetri ekranı tasarım fişine hizalandı: Stint kartlarında artık marka logosu ve araç görseli var; Seans kutusuna 'Bu seansın setup'ı' butonu eklendi — tıklayınca Setup havuzundaki 'İçerik' penceresinin birebir aynısı açılıyor (sayfayı uzatan eski 'Bu Seansın Setup'ı' bölümü kaldırıldı); Setup kategorilerinde kalan emojiler (💡 Elektronik, 🛢 Motor) çizgi ikonlarla değişti ve yanlış eşlenmiş Süspansiyon/Diferansiyel ikonları düzeltildi. Ayrıca telemetri grafikleri (ızgara, eksen, tooltip) uygulamanın kendi renk paletine geçti — daha önce başka bir uygulamadan gelmiş gibi duran mavi-gri bir palet kullanıyorlardı.",
      "⚠ ÇÖZÜLDÜ: Canlı Timing'deki 'Incident' sütunu yanlıştı. Üç ayrı hata vardı: (1) Sütun 'Incident' diyordu ama gösterdiği veri oyunun BEKLEYEN CEZA sayacıydı — incident (temas/track-cut) değil. (2) Bu sayaç, sürücü cezasını çekince sıfıra düştüğü için ekran temizleniyor, yarış boyunca kaç ceza alındığı görünmüyordu. (3) Tamsayı olan ceza sayısı '1.0x' gibi ondalıklı bir çarpan biçiminde yazılıyordu. Artık sütun doğru adıyla 'Ceza' ve yarış boyunca KÜMÜLATİF ceza sayısını gösteriyor; bekleyen (henüz çekilmemiş) ceza varsa kırmızı ve '•' işaretli. Sayım TinyPedal'ın kullandığı yöntemle yapılıyor ve REST kapalıyken de çalışıyor. Not: gerçek 'incident' sayısı (temas + pist sınırı ihlali) kullandığımız veri yolunda oyun tarafından hiç sunulmuyor — TinyPedal da bu yolda 0 gösterir — bu yüzden ceza ile karıştırmamak için sütun dürüstçe yeniden adlandırıldı.",
      "🚩 ÇÖZÜLDÜ: Canlı Timing'de SARI BAYRAK hiç görünmüyordu — oyunda sarı sallanırken uygulama yeşil gösteriyordu. Sebep zincirleme: lokal sarının tek kaynağı sayılan LMU REST bağlantısı, oyunu dondurduğu için varsayılan olarak KAPALI; REST kapalıyken devreye giren yedek yol ise yalnızca tam pist sarısını (FCY) tanıyordu — yani 'sarı bayrak' gösteren tek bir kod yolu bile kalmamıştı. Üstelik bayrak bilgisi LMU'nun REST'inde zaten hiç yok; tek gerçek kaynak paylaşımlı bellek. Artık sarı bayrak doğrudan paylaşımlı bellekten okunuyor (TinyPedal'ın yıllardır sahada kullandığı yöntemle birebir) ve REST kapalıyken de çalışıyor. Hangi sektörde sarı olduğu da gösteriliyor.",
      "📊 Stint analizine üç yeni metrik eklendi: TUTARLILIK (tur sürelerinin std sapması — ±0.28 sn gibi; düşükse temponuz istikrarlı), TEMPO EĞİLİMİ (stint boyunca turların açılıp mı kapandığı — +0.08 sn/tur ise lastik düşüşü baskın, − ise yakıt hafiflemesi baskın) ve TEORİK EN İYİ TUR (stintteki en iyi S1+S2+S3 sektörlerinin toplamı; gerçek en iyi turunuzla arasındaki fark 'masada kalan' süredir). Sektörler artık .duckdb'deki gerçek sektör beacon'larından okunuyor.",
    ],
    en: [
      "🗺 FIXED: In telemetry the throttle/brake charts were saved but the TRACK MAP was not — reopen the race and the charts came back while the map stayed empty. Cause: the LMU telemetry map comes from real GPS (latitude/longitude), coordinates that are tiny decimals (e.g. 47.9500). On save these were rounded to whole numbers (47.9500 → 48), collapsing every point of the lap into one — the map vanished; the chart channels (speed/throttle/brake) are large numbers so they were unaffected. Map coordinates are now stored scaled to the lap's own range, so the map persists just like the charts and teammates can see it.",
      "📁 Setup pool filenames are now standardised. Setups used to keep whatever the uploader\'s file was called (\"setup_1.svm\", \"Spa test (2).svm\") — the pool was unreadable, search did not work and downloaded files were unidentifiable. Names are now built from the form: track_class-car_session-condition_version.svm (e.g. spa_gt3-ferrari_r-dry_v3.svm). The class is part of the name because car names repeat across classes (Ferrari is both a Hypercar and a GT3). This applies to EVERY setup in the pool, not just new uploads — names are derived from the metadata each time they are shown, and downloads use the same name. Setups saved to the pool from telemetry also had no name at all (downloading gave an extensionless \"setup\"); that is fixed too.",
      "🔄 FIXED: After a new version shipped, the app kept opening in its OLD state for a while — the \"I updated but nothing changed\" problem. Two causes stacked: (1) the main page file was cached in the browser for an hour, and (2) the service worker that provides offline support read navigations from that cache, serving the old page, which in turn pulled the old files. Navigations now always go to the server, and the server marks the main page as non-cacheable, so a new version arrives on the first load. (You may need one final forced refresh to pick this fix up: Ctrl+Shift+R / Cmd+Shift+R.)",
      "🎨 The Telemetry screen now matches the design spec: stint cards show the brand logo and car image; the Session panel gained a \"This session's setup\" button that opens the exact same window as \"Contents\" in the Setup pool (the old inline \"This Session's Setup\" section, which made the page long, is gone); the leftover emoji in setup categories (💡 Electronics, 🛢 Engine) became line icons, and the mis-mapped Suspension/Differential icons were corrected. The telemetry charts (grid, axes, tooltip) also moved onto the app's own colour palette — they had been using a blue-grey palette that looked like it came from a different app.",
      "⚠ FIXED: The 'Incident' column in Live Timing was wrong in three ways. (1) It was labelled 'Incident' but showed the game's OUTSTANDING PENALTY counter — not incidents (contact / track limits). (2) That counter drops back to zero once the driver serves the penalty, so the display cleared itself and you could never see how many penalties had been taken over the race. (3) An integer penalty count was rendered as a decimal multiplier like '1.0x'. The column is now honestly named 'Pen.' and shows the CUMULATIVE penalty count for the session; if a penalty is still outstanding it turns red with a '•' marker. Counting uses the same method as TinyPedal and works with REST switched off. Note: a true incident count (contacts + track-limit cuts) is not exposed by the game on the data path we use — TinyPedal reports 0 there too — so the column was renamed rather than left implying data we cannot get.",
      "🚩 FIXED: The YELLOW FLAG never appeared in Live Timing — the game waved yellow while the app stayed green. A chain of causes: the only source treated as authoritative for local yellows was the LMU REST connection, which is disabled by default because it froze the game; and the fallback that runs instead only recognised full-course yellow (FCY), so not a single code path could ever report a plain 'Yellow'. On top of that, LMU's REST API carries no flag data at all — shared memory is the only real source. Yellow flags are now read straight from shared memory (matching the method TinyPedal has used in the field for years) and work with REST switched off. The sector the yellow is in is shown too.",
      "📊 Three new metrics in stint analysis: CONSISTENCY (std deviation of lap times, e.g. ±0.28 s — low means a steady pace), PACE TREND (whether laps opened up or tightened over the stint — +0.08 s/lap means tyre drop-off dominates, − means fuel lightening dominates), and THEORETICAL BEST LAP (sum of your best S1+S2+S3 sectors in the stint; the gap to your real best is time left on the table). Sectors now come from the real sector beacons in the .duckdb file.",
    ],
  },
  {
    v: "v2.2.3",
    date: "2026-08-29",
    tr: [
      "✅ ÇÖZÜLDÜ: Sohbet penceresinde sol taraftaki kanal listesi (Genel, Takım…) ve üstteki başlık çubuğu görünmüyordu. Sebep, iki sürümdür sanıldığı gibi ekran kartı değilmiş: pencerenin içeriği kutudan uzun kalıyor, sohbet açılırken otomatik olarak en alta kaydırılınca da pencerenin TAMAMI birlikte kayıyor ve başlıklar ile kanal listesi yukarıda kırpılıyordu. Artık kaydırma yalnızca mesaj listesinde oluyor; kanallar, başlık ve kapatma düğmesi her zaman yerinde.",
      "🔤 Kanal isimleri koyu zeminde siyah çiziliyordu (okunamıyordu); artık tema rengiyle net görünüyor. Aynı hatanın başka ekranlarda çıkmaması için buton ve form alanları uygulama genelinde temanın metin rengini kullanıyor.",
      "📱 Dar ekranlarda sohbet penceresi bozulmuyor: mesaj sütunu alt satıra düşmüyor, kanal paneli yer daraldıkça küçülüyor.",
      "🔍 Sohbet penceresi açılırken kendini denetliyor; bir şey görünmezse tarayıcı konsoluna uyarı basıyor. Adresin sonuna ?debug=chat eklenirse ölçümü ekranda gösteren bir teşhis paneli açılıyor (tablet/telefonda konsol gerekmeden).",
      "🧮 ÖNEMLİ (plan tablosu): Bir stintin OVERRIDE hücresine süre yerine düz sayı yazılınca (örn. tur sayısı sanıp \"31\") uygulama bunu 31 SANİYE okuyup o stinti 1 tura düşürüyordu; taşan turlar plana fazladan bir satır ekliyor ve tüm stint numaraları kayıyordu (7. stintteyken uygulama 8 diyordu). Artık saat:dakika:saniye biçiminde OLMAYAN her giriş yok sayılıyor, hücre kırmızı çerçeveleniyor ve doğru biçim (0:53:15 ya da 53:15) açıklanıyor. Gerçek pit işaretlemesinden gelen otomatik süreler bu biçimde yazıldığı için etkilenmiyor.",
      "🔒 Gerçek pit işaretlenmiş bir stintte tur sayısını elle değiştirip sonra süre yazdığınızda, o değer hâlâ \"otomatik\" sayıldığı için pit sıfırlamalarında siliniyordu. Artık elle girdiğiniz değer korunuyor.",
      "📈 Telemetri: pist haritası ve gaz/fren grafikleri artık KALICI. Bir stint kaydettiğinizde o stintteki turların izi buluta (takımınıza) yazılıyor; yarışı kapatıp açınca harita ve grafikler geri geliyor, takım arkadaşlarınız da görebiliyor. Önceden bu veri yalnız yüklediğiniz dosya bellekteyken duruyordu, program kapanınca gidiyordu.",
    ],
    en: [
      "✅ FIXED: The chat window's left channel list (General, Team…) and the top header bar were invisible. The cause was not the graphics card, as the previous two releases assumed: the window's content stayed taller than its frame, so when the chat auto-scrolled to the newest message, the WHOLE window scrolled with it and clipped the headers and channel list out of view. Scrolling now happens only inside the message list; channels, header and close button always stay put.",
      "🔤 Channel names were painted black on the dark panel (unreadable); they now use the theme's text color. To stop the same class of bug elsewhere, buttons and form fields inherit the theme's text color app-wide.",
      "📱 The chat window no longer breaks on narrow screens: the message column stays beside the channel list instead of dropping below it, and the channel panel shrinks as space gets tight.",
      "🔍 The chat window self-checks when it opens and warns in the browser console if anything is invisible. Add ?debug=chat to the address for an on-screen diagnostic panel (no console needed on tablets/phones).",
      "🧮 IMPORTANT (plan table): Typing a plain number into a stint's OVERRIDE cell (e.g. \"31\", meaning laps) was read as 31 SECONDS, collapsing that stint to 1 lap; the spilled laps added an extra row and shifted every stint number (the app said stint 8 while you were on 7). Anything not written as hours:minutes:seconds is now ignored, the cell is outlined in red, and the correct format (0:53:15 or 53:15) is explained. Automatic durations from marking a real pit use that format, so they are unaffected.",
      "🔒 On a stint with a real pit marked, changing the lap count by hand and then typing a duration left that value flagged as \"automatic\", so pit resets wiped it. Values you type by hand are now preserved.",
      "📈 Telemetry: the track map and throttle/brake charts are now PERSISTENT. When you save a stint, the traces of that stint's laps are written to the cloud (your team); reopen the race and the map and charts come back, and teammates can see them too. Previously this data existed only while the file you loaded was in memory and vanished when the app closed.",
    ],
  },
  {
    v: "v2.2.2",
    date: "2026-08-28",
    tr: [
      "🛠 ÖNEMLİ: Yarış sırasında sağ panelden yaptığınız race data düzenlemeleri (tur süresi, tüketim) yarışı yeniden açınca LMU referans temposuna geri dönüyordu. Neden: pist/araç seçimine bağlı 'LMU temposunu varsayılan yaz' özelliği, kayıtlı bir yarışı açmayı da 'yeni seçim' sanıp değerlerinizi eziyordu. Artık kayıtlı değerleriniz korunuyor; LMU varsayılanı yalnız kurulumda pist/araç seçerken yazılır.",
      "🔧 Sohbet penceresi sol 'KANALLAR' paneli bazı ekran kartlarında hâlâ boş kalabiliyordu. Geriye kalan tetikleyici, pencerenin transform tabanlı açılış animasyonuymuş — artık yalnızca yumuşak bir görünürlük geçişi kullanılıyor ve sol panele ayrı bir katman verildi. Panel her açılışta dolu geliyor.",
      "🧹 Canlı Timing üstündeki eski kırmızı 'Canlı Köprü' durum kutusu kaldırıldı — köprü zaten otomatik çalıştığı için bu kutu gereksizdi.",
    ],
    en: [
      "🛠 IMPORTANT: Race-data edits made from the right panel during a race (lap time, consumption) reverted to the LMU reference pace when reopening the race. Cause: the 'apply LMU pace as default' behavior (on track/car selection) treated opening a saved race as a new selection and overwrote your values. Your saved values are now preserved; the LMU default is only written when picking track/car during setup.",
      "🔧 The chat window's left 'CHANNELS' panel could still come up blank on some graphics cards. The remaining trigger was the window's transform-based open animation — it now uses a plain fade and the left panel gets its own layer, so it renders filled every time.",
      "🧹 Removed the old red 'Live Bridge' status box above Live Timing — the bridge runs automatically now, so the box was redundant.",
    ],
  },
  {
    v: "v2.2.1",
    date: "2026-08-28",
    tr: [
      "🔧 Üst bardaki 'bağlı değil' çipinde bağlantı kopmuşken yanında görünen süre bilgisi kaldırıldı — artık sadece 'bağlı değil' yazıyor.",
      "🔧 Sohbet penceresinin arka planındaki bulanıklaştırma (backdrop-blur) kaldırıldı — bazı ekran kartlarında sol 'KANALLAR' panelini boş/görünmez bırakan tarayıcı katman hatasını gideriyor. Pencereye ayrı bir katman izolasyonu da eklendi.",
      "✨ Yeni güncelleme penceresi: eski üst şerit yerine ortada beliren bir modal. Sürüm geçişi (eski → yeni), öne çıkanlar ve 'Tüm değişiklikler' bağlantısı; masaüstünde canlı indirme yüzdesi + 'Yeniden başlat', web'de 'Şimdi güncelle'. Dil uygulamadan gelir; kritik sürümlerde 'Sonra' gizlenir.",
      "🔧 Bağımsız Telemetri ekranı (Ana Menü → Telemetri) artık yüklenen stint'leri hatırlıyor: box plot, SEANS paneli ve çözülen turlar sayfa yenilense de kayıtlı kalır (cihaz-yerel). Ayrıca yarış içi telemetri yazımı geçici bir bağlantı hatasında sessizce kaybolmuyordu — artık otomatik tekrar deneniyor.",
      "🧹 Telemetride CSV/MoTeC metin desteği kaldırıldı — telemetri artık yalnızca .duckdb (LMU yerel kaydı) kabul ediyor. Yapıştırma alanı ve sütun eşleme arayüzü kaldırıldı.",
      "🔧 Setup Havuzu kartlarında dar ekranda alt satırdaki butonların (İçerik/İndir/✕) taşıp kırpılması giderildi — footer artık gerektiğinde alt satıra kayıyor ve kartlar biraz genişledi.",
      "✨ Canlı timing: SECTOR sütun başlığına tıklayarak sütunu daraltıp (·) tekrar tıklayarak açabilirsiniz — dar ekranda tabloya yer açar.",
      "✨ Canlı timing SECTOR sütunu artık ANLIK: araç bu turda sektör çizgisini geçtiği an S1, sonra S2 canlı görünüyor (henüz geçilmeyen sektör '—', S3 tur bitince). Tur tamamlanınca son turun tam S1·S2·S3'üne düşüyor. (Gerçek yarışta köprünün güncel sürümü gerekir; eski köprüde eskisi gibi son tur gösterilir.)",
      "🔧 Ana menüden bir sekmeye (Dash/Stint/Canlı…) tıklayınca yarış bazen açılmıyordu: yarış açılışı, uzak durumu çeken ağ çağrısı geçici hata verince (özellikle canlı timing sonrası) yarışa hiç girmiyordu. Artık çağrı düşse de yarışa giriliyor, durum abonelikten geliyor.",
    ],
    en: [
      "🔧 The top-bar 'not connected' chip no longer shows the elapsed duration next to it while disconnected — it now reads just 'not connected'.",
      "🔧 Removed the backdrop-blur behind the chat window — it fixes a browser GPU-compositing bug that left the left 'CHANNELS' panel blank on some graphics cards. The window now also gets its own isolated layer.",
      "✨ New update window: a centered modal replaces the old top strip. Shows the version transition (old → new), highlights and an 'All changes' link; on desktop a live download percentage + 'Restart', on web 'Update now'. Language follows the app; on critical releases 'Later' is hidden.",
      "🔧 The standalone Telemetry screen (Main Menu → Telemetry) now remembers loaded stints: the box plot, SESSION panel and resolved laps survive a page reload (device-local). Also, in-race telemetry writes no longer vanish silently on a transient connection error — they now retry automatically.",
      "🧹 Removed CSV/MoTeC text support from telemetry — it now accepts only .duckdb (LMU local recording). The paste box and column-mapping UI are gone.",
      "🔧 Setup Library cards no longer clip their footer buttons (Contents/Download/✕) on narrow widths — the footer now wraps to a second line when needed and the cards are a touch wider.",
      "✨ Live timing: click the SECTOR column header to collapse it (·) and click again to expand — frees up space on narrow screens.",
      "✨ Live timing SECTOR column is now LIVE: it shows S1 the instant a car crosses the sector line this lap, then S2 ('—' for a sector not yet crossed; S3 once the lap completes). When the lap finishes it falls back to the last lap's full S1·S2·S3. (Needs the updated bridge in a real race; an old bridge still shows the last lap as before.)",
      "🔧 Clicking a tab (Dash/Stint/Live…) from the main menu sometimes failed to open the race: race entry aborted whenever the network fetch of the remote state hit a transient error (notably right after live timing). It now enters the race regardless — state arrives via the live subscription.",
    ],
  },
  {
    v: "v2.2.0",
    date: "2026-08-27",
    tr: [
      "🏎 Araç görselleri yenilendi: 32 araç için yeni yandan (webp) görsellerin yanı sıra artık her araca ÖZEL üstten görsel var (eskiden tek jenerik üstten görsel vardı) — pick ekranı, Dashboard, Canlı 'Kendi Araç' ve telemetride görünür. Yeni araçlar: GT3 Lamborghini Huracán GT3 EVO2 ve LMP3 Ginetta G61-LT-P3.",
      "🌐 İngilizce mod elden geçti: EN'de Türkçe kalan ~328 metin çevrildi (kart başlıkları, tab etiketleri, tooltip'ler, mesajlar). İlk açılışta 'EN seçili ama Türkçe görünüyor' parlaması giderildi — sözlük inene dek dile nötr yükleme ekranı gösteriliyor.",
      "📊 Telemetri SEANS paneli: yüklenen dosyaya göre bayrak + araç + pist şekli ve pist/araç/pilot/sıcaklık satırları. .duckdb'de pilot ve sıcaklık verisi varsa artık gösteriliyor; eksikse pist/araç yarış bağlamından türetiliyor.",
      "🏁 Resmi Yarışlar: her yarışın 'hafta sonu' detayları artık SEANSLAR / FORMAT / KURALLAR sütunları hâlinde kategorize gösteriliyor.",
      "🖼 Ana sayfadaki takım çipi artık takımın yüklediği özel logoyu gösteriyor (varsayılan Caspian logosu yerine).",
      "🪶 Caspian Live Bridge (hafif köprü) arayüzü yeniden tasarlandı: kartlı kurulum akışı (Hesap → Yayın Hedefi → Gönderim), canlı yayın görünümü (durum şeridi + araç/yakıt-VE/tur/gecikme metrikleri), varsayılan İngilizce + EN/TR geçişi. Tüm işlevler korundu.",
    ],
    en: [
      "🏎 Car artwork refreshed: new side images (webp) for 32 cars plus a PER-CAR top-down image for each (previously a single generic top image) — shown on the pick screen, Dashboard, Live 'Own Car' and telemetry. New cars: GT3 Lamborghini Huracán GT3 EVO2 and LMP3 Ginetta G61-LT-P3.",
      "🌐 English mode overhaul: translated ~328 strings that stayed Turkish in EN (card titles, tab labels, tooltips, messages). Fixed the first-load 'EN selected but showing Turkish' flash — a language-neutral loading screen shows until the dictionary arrives.",
      "📊 Telemetry SESSION panel: flag + car + track silhouette plus track/car/driver/temperature rows based on the loaded file. Driver and temperature now show when the .duckdb contains them; when missing, track/car are derived from the race context.",
      "🏁 Official Races: each race's 'weekend' details are now grouped into SESSIONS / FORMAT / RULES columns.",
      "🖼 The team chip on the home page now shows the team's uploaded logo (instead of the default Caspian logo).",
      "🪶 Caspian Live Bridge redesigned: a carded setup flow (Account → Broadcast target → Transmission), a live view (status strip + cars/fuel-VE/laps/latency metrics), English by default with an EN/TR toggle. All functionality preserved.",
    ],
  },
  {
    v: "v2.1.2",
    date: "2026-08-27",
    tr: [
      "⛽ Virtual Energy artık yalnız Hypercar ve GT3 sınıflarında. LMP2/LMP3/GTE için race data formunda VE tüketimi + fuel ratio yerine 'Yakıt tüketim (L/tur)' ve 'Depo (L)' girişi geldi (oran yok — bu sınıflarda VE yok). Stint planı, Yakıt sekmesi, Dashboard ve canlı/PDF özetleri bu sınıflarda VE % yerine litre gösterir. Hypercar/GT3 düzeni aynen korundu.",
      "🔧 Ana menüdeki 'Setup Havuzu' hızlı erişim butonu artık küçük pencere yerine doğrudan sol menüdeki Setup bölümünü açıyor.",
      "🔧 Setup İçeriği penceresinde bir bölüme (Aero, Lastik…) tıklayınca ~3 sn sonra 'Tümü'ye geri dönme sorunu düzeltildi; seçilen bölüm artık kalıcı.",
      "🔧 Ana menüde 'Profil & Rozetler' penceresi açılmıyordu — düzeltildi.",
      "🔧 Ana menüde 'Üyeler' modalı açılmıyordu — düzeltildi.",
    ],
    en: [
      "⛽ Virtual Energy now applies only to the Hypercar and GT3 classes. For LMP2/LMP3/GTE the race-data form takes plain 'Fuel use (L/lap)' and 'Tank (L)' instead of VE consumption + fuel ratio (no ratio — these classes have no VE). The stint plan, Fuel tab, Dashboard and live/PDF summaries show litres instead of VE % for these classes. The Hypercar/GT3 flow is unchanged.",
      "🔧 The main-menu 'Setup Library' quick button now opens the Setup section in the left menu directly, instead of a small pop-up window.",
      "🔧 Fixed the Setup Content window reverting to 'All' ~3 s after picking a section (Aero, Tyres…); the selected section now stays.",
      "🔧 Fixed the 'Profile & Badges' window not opening from the main menu.",
      "🔧 Fixed the 'Members' modal not opening from the main menu.",
    ],
  },
  {
    v: "v2.1.1",
    date: "2026-08-26",
    tr: [
      "🎨 68 parçalık çizgi-SVG ikon seti: nav rayı, üst çubuk, komut paleti, eylem düğmeleri ve durum bantlarındaki emoji/dingbat ikonları tema-uyumlu vektörlerle değiştirildi (renk daima kapsayıcıdan gelir, her boyutta net). Nav ve komut paleti artık aynı ekran ikonunu gösteriyor.",
      "🌡 Track temp (asfalt sıcaklığı) için tema-uyumlu termometre vektör ikonu: cıva sıcaklığa göre dolar, ısıya göre renklenir (soğuk mavi · ılık amber · sıcak kırmızı) — canlı tur geçmişi ve pist haritası kondisyon barında.",
      "🗺 Pist haritasında pit GİRİŞ çizgisi artık görünüyor: araç pite girerken doğrudan garaja atladığında giriş kaçıyordu; giriş/çıkış artık pit alanına göre saptanır. Giriş de 'PIT IN' çizgisiyle işaretlenir.",
      "🏁 POZİSYON kartına sınıf-içi sıra eklendi (ör. 'P7 · GT3 1'): genel klasmanın yanında sınıf sıran ve rengi görünür.",
      "🕑 Üye yönetimi: 'son görülme' göreli zaman gösterir (şimdi · N dk · N sa · dün · 14 Ağu); arama Türkçe karakter duyarsız (Şen ↔ sen); 'Beklemede' filtre çipi hep vurgulu.",
      "🚦 Yarışı açınca artık doğrudan STINT planına iniliyor (önceki sekme yerine).",
      "🔧 Stint planı: elle tur override'lı son stint bayrağa çok yakın bitince ortaya çıkan hayalet son pit ve yanlış 'plan tamamlanamadı' uyarısı düzeltildi; plan bayrakta biter.",
      "✨ Eksik sekme geçiş animasyonları tamamlandı (Stint, Dashboard, Pilotlar, Telemetri, Yarış Sohbeti) — tüm sol menü bölüm geçişleri tutarlı.",
    ],
    en: [
      "🎨 A 68-piece line-SVG icon set: emoji/dingbat icons in the nav rail, top bar, command palette, action buttons and status strips replaced with theme-aware vectors (colour always inherits, crisp at every size). Nav and command palette now show the same screen icon.",
      "🌡 A theme-aware thermometer vector for track temp: the mercury fills with temperature and colours by heat (cold blue · warm amber · hot red) — in the live lap history and track-map condition bar.",
      "🗺 The pit ENTRY line now shows on the track map: when a car jumped straight to the garage on pit entry the entry was missed; entry/exit is now detected by pit area and entry is marked with a 'PIT IN' line.",
      "🏁 Class position added to the POSITION card (e.g. 'P7 · GT3 1'): your in-class rank and its colour show next to the overall standing.",
      "🕑 Member management: 'last seen' shows relative time (now · N min · N h · yesterday · 14 Aug); search is Turkish-diacritic-insensitive (Şen ↔ sen); the 'Pending' filter chip stays highlighted.",
      "🚦 Opening a race now lands directly on the STINT plan (instead of the previous tab).",
      "🔧 Stint plan: fixed a phantom final pit and a false 'plan incomplete' warning when a manual lap-override last stint ended just short of the flag; the plan now ends on the flag.",
      "✨ Completed the missing tab-transition animations (Stint, Dashboard, Drivers, Telemetry, Race Chat) — all left-menu section transitions are consistent.",
    ],
  },
  {
    v: "v2.1.0",
    date: "2026-08-26",
    tr: [
      "🎨 Büyük v2.0 arayüz yenilemesi: yatay sekme çubuğu yerine sol dikey menü rayı, yeni yarış üst çubuğu, ve tüm ekranlar (Menü, Dashboard, Stint, Yakıt, Lastik, Pilot, Telemetri, Setup, Takım, Sohbet, Yarış Datası) fişteki tasarıma göre yeniden çizildi.",
      "🔧 Setup: liste görünümü ızgara satırlara geçti, içerik/karşılaştırma/havuz pencereleri ve 'Setup yükle' modalı yenilendi; kıyaslama çubuğu tokenli tray oldu.",
      "📊 Telemetri: stint yuva kartları, Seans yan paneli, özet kutucukları ve 'Telemetri yükle' penceresi eklendi; .ld desteği kaldırıldı, yalnız .duckdb (+ CSV).",
      "💬 Sohbet: Kanallar kenar çubuğu + iki sütunlu düzen. Profil, Üye yönetimi, Komut paleti ve Pit Board pencereleri v2.0'a taşındı.",
      "🏅 Rol/rozet emojileri çizgi SVG ikon setiyle değiştirildi (sürücü/mühendis/sahip/podyum/setup/24H).",
      "🎓 Yeni koçmark rehber turu: yarış üst barındaki '?' düğmesiyle bulunduğun ekranın adımından açılır, spot ışığı + 11 adımlı animasyonlu panel; eski rehber sistemi kaldırıldı.",
      "⚡ Stint plan tablosuna 'VE %/tur' sütunu: her stint için ayrı yakıt tüketimi girilebilir (boş → yarış datasındaki tüketim), stintler arası strateji planlanabilir.",
      "🔗 Üst bar artık köprüyü kim açtıysa onun Firebase'e akan verisini gösterir — izleyici kendi köprüsü olmasa da canlı durumu, pozisyon/enerji ve bayrağa kalanı görür.",
      "🕑 Pilot uygunluğu: uygun olmayan pilot stint açılır listesinde seçilemez, atanmışsa otomatik kaldırılır.",
    ],
    en: [
      "🎨 Major v2.0 UI redesign: a left vertical nav rail replaces the horizontal tab bar, a new race top bar, and every screen (Menu, Dashboard, Stint, Fuel, Tyre, Drivers, Telemetry, Setup, Team, Chat, Race Data) redrawn to the handoff design.",
      "🔧 Setup: list view moved to grid rows; content/compare/pool windows and the 'Upload setup' modal redesigned; compare tray is now a tokenised bar.",
      "📊 Telemetry: stint slot cards, a Session side panel, summary tiles and an 'Upload telemetry' window; .ld support removed, .duckdb only (+ CSV).",
      "💬 Chat: a Channels sidebar with a two-column layout. Profile, Member management, Command palette and Pit Board windows moved to v2.0.",
      "🏅 Role/badge emojis replaced with a line-SVG icon set (driver/engineer/owner/podium/setup/24H).",
      "🎓 New coachmark guided tour: opened from the '?' button in the race top bar at the current screen's step, with a spotlight + an 11-step animated panel; the old guide system was removed.",
      "⚡ A 'VE %/lap' column in the stint plan table: per-stint fuel consumption can be entered (blank → race-data consumption), enabling per-stint strategy.",
      "🔗 The top bar now shows the live feed from whoever is running the bridge (relayed via Firebase) — a viewer without their own bridge still sees the live status, position/energy and time to flag.",
      "🕑 Driver availability: an unavailable driver can't be picked in the stint dropdown and is auto-cleared if already assigned.",
    ],
  },
  {
    v: "v1.8.20",
    date: "2026-08-15",
    tr: [
      "🏁 Canlı Timing saha tablosunda Gap ve Aralık sütunları tek sütunda birleşti; başlığa tıklayarak (diğer başlık geçişleri gibi) lidere Gap ile öndekine Aralık arasında geçersin. Tablo bir sütun daha sadeleşti.",
    ],
    en: [
      "🏁 In the Live Timing field table, Gap and Interval merged into one column; click the header (like the other header toggles) to switch between Gap to the leader and Interval to the car ahead. One less column, cleaner table.",
    ],
  },
  {
    v: "v1.8.19",
    date: "2026-08-15",
    tr: [
      "🏁 Canlı Timing saha tablosu sadeleştirildi: (1) 'Kendi sınıfım' düğmesi kalktı — artık Sınıf sütun başlığına tıklayınca kendi sınıfını süzersin (aktifken başlık teal olur), Pilot↔Takım başlığı gibi. (2) Son ve En İyi tek sütunda birleşti; başlığa tıklayarak aralarında geçersin. (3) AVG5 ve AVG de tek sütunda birleşti, başlığa tıklayarak değişir. (4) Δ (delta) sütunu kaldırıldı. (5) Gap ve Aralık sütunları öne alındı (Tur'dan hemen sonra, soldan 5. ve 6. sıra).",
    ],
    en: [
      "🏁 Live Timing field table streamlined: (1) the 'My class' button is gone — click the Class column header to filter to your own class (header turns teal when active), like the Driver↔Team header. (2) Last and Best merged into one column; click the header to toggle between them. (3) AVG5 and AVG also merged into one column, toggled from the header. (4) The Δ (delta) column was removed. (5) Gap and Interval moved forward (right after Laps — 5th and 6th columns from the left).",
    ],
  },
  {
    v: "v1.8.18",
    date: "2026-08-15",
    tr: [
      "➕ Tur geçmişi ('+') penceresindeki satırlar biraz daha ferah: v1.8.15'teki tek satır kompakt tasarım çok sıkışıktı, satır yüksekliği azıcık artırıldı (yine tek satır, ekrana hâlâ çok tur sığıyor).",
    ],
    en: [
      "➕ Lap history ('+') popup rows are a bit roomier: the single-line compact layout from v1.8.15 was too tight, so the row height was nudged up slightly (still single-line, and plenty of laps still fit on screen).",
    ],
  },
  {
    v: "v1.8.17",
    date: "2026-08-15",
    tr: [
      "🏁 'Sonraki Yarış' artık bitmiş yarışı takılıp göstermiyor. Eskiden bir yarış, gerçek uzunluğu ne olursa olsun, BAŞLANGICINDAN 6 saat geçene kadar 'Sonraki/Yaklaşan'da kalıyordu → 4 saatlik bir yarış bittikten ~2 saat sonra hâlâ orada duruyordu (24 saatlik bir yarış ise sürerken yanlışlıkla 'Geçmiş'e düşüyordu). Artık eşik yarışın SÜRESİNE bağlı: bir yarış, planlı bitişinden ~30 dk sonra otomatik olarak 'Geçmiş Yarışlar'a geçer; süren uzun yarışlar da yanlışlıkla kaybolmaz.",
    ],
    en: [
      "🏁 'Next Race' no longer keeps showing a race that has already finished. Previously a race stayed in 'Next/Upcoming' until 6 hours after its START — regardless of its actual length — so a 4-hour race lingered there for ~2 hours after it ended (and a 24-hour race wrongly dropped to 'Past' while still running). The threshold is now based on the race's DURATION: a race moves to 'Past Races' automatically ~30 min after its scheduled finish, and long ongoing races no longer disappear by mistake.",
    ],
  },
  {
    v: "v1.8.16",
    date: "2026-08-15",
    tr: [
      "📈 Pozisyon Grafiği daha okunur: (1) Saha tablosunda 'Kendi sınıfım' açıkken grafik de yalnız kendi sınıfını gösterir ve Y ekseni sınıf-içi pozisyona (1, 2, 3…) döner — kalabalık grid dağılmaz. (2) Çizgiler artık SINIF yerine TAKIM rengiyle çizilir (aynı sınıftaki araçlar artık ayırt edilir; kendi aracın kalın bordo kalır). (3) Her çizginin sağ ucunda pilot kodu (ör. HAR) — bir sınıfta 7'den fazla araç olduğunda renkler tekrar etse bile araç net ayırt edilir. Takım rengi araca sabittir (bir araç çekilse/süzgeçlense diğerlerinin rengi değişmez).",
    ],
    en: [
      "📈 Position Chart is more readable: (1) when 'My class' is on in the standings table, the chart also shows only your class and the Y axis switches to class position (1, 2, 3…) — a crowded grid no longer overwhelms it. (2) Lines are now colored by TEAM instead of class (cars in the same class are now distinguishable; your own car stays the thick maroon line). (3) A driver code (e.g. HAR) sits at the right end of each line — so even when a class has more than 7 cars and colors repeat, each car stays identifiable. A team's color is fixed to the car (a car retiring or being filtered never repaints the others).",
    ],
  },
  {
    v: "v1.8.15",
    date: "2026-08-15",
    tr: [
      "📋 Tur geçmişi ('+' popup) satırları artık TEK SATIR, daha kompakt bir tasarımda: her tur için süre, fark, sektörler (S1·S2·S3) ve pist koşulu (asfalt sıcaklığı · tutuş · zemin) yan yana tek satırda görünür — böylece ekrana belirgin biçimde daha fazla tur sığar. Bilgi kaybı yok: sektör/koşul etiketleri fare ile üzerine gelince ipucunda görünür; en hızlı tur mor, out/pit turu sarı, pilot değişimi teal kalır. Pilot adı yalnız değişim turunda gösterilir (yer kazanır).",
    ],
    en: [
      "📋 Lap-history rows (the '+' popup) are now a SINGLE-LINE, more compact design: each lap's time, delta, sectors (S1·S2·S3) and track conditions (asphalt temp · grip · wetness) sit inline on one row — so noticeably more laps fit on screen. No information lost: sector/condition labels appear in the tooltip on hover; the fastest lap stays purple, out/pit laps yellow, driver changes teal. The driver name is shown only on the change lap (saves space).",
    ],
  },
  {
    v: "v1.8.14",
    date: "2026-08-15",
    tr: [
      "🛞 Tur geçmişindeki ('+' popup) tutuş (grip) yüzdesi düzeltildi: web tarafı kayıt, tutuşu yanlışlıkla TEK aracın tur sayısından hesaplıyordu (ör. %52) — oysa canlı ekrandaki 'Tutuş' göstergesi bunu SAHADAKİ TÜM araçların tur toplamından okuyor. Kayıt artık o göstergeyle AYNI parametreyi kullanıyor → '+' popup'ındaki tutuş, üstteki canlı 'Tutuş' değeriyle birebir eşleşir. (Not: bu düzeltmeden ÖNCE kaydedilmiş turlar eski değeri gösterir; yeni turlar doğru.)",
    ],
    en: [
      "🛞 Fixed the grip percentage in lap history (the '+' popup): the web-side recorder was computing grip from a SINGLE car's lap count (e.g. 52%) — but the live 'Grip' indicator reads it from the total laps of ALL cars on track. The record now uses the SAME parameter as that indicator → the grip in the '+' popup matches the live 'Grip' value at the top exactly. (Note: laps recorded BEFORE this fix keep the old value; new laps are correct.)",
    ],
  },
  {
    v: "v1.8.13",
    date: "2026-08-15",
    tr: [
      "🛰 Köprü kaydı artık GÖRÜNÜR: Canlı ekranda köprünün sürümü ve kaç tur kaydettiği yazıyor ('Köprü v1.8.13 · N tur kaydetti'). Köprü, web açık olsun olmasın kendi başına kaydeder — bu satır onu gözle doğrular. Köprü sürümü eskiyse (bu alanı yazamayan) ekranda 'Köprü eski sürüm — güncelle' uyarısı çıkar; 5 sürümdür göremediğimiz 'sürüş PC'sinde eski köprü' durumu artık anında belli olur.",
      "📼 Köprü artık kaydettiği her turu log dosyasına yazıyor ('tur geçmişi: +N tur (toplam M)') ve köprü penceresinin durum satırında toplam kaydedilen tur sayısı görünüyor.",
      "Not: köprü sürüm/tur göstergesi için sürüş PC'sinin güncel köprüyü (v1.8.13) kurması gerekir; kurulunca kalıcı olarak görünür. Web tarafı kayıt (v1.8.12) köprü eski olsa da çalışmaya devam eder.",
    ],
    en: [
      "🛰 Bridge recording is now VISIBLE: the live screen shows the bridge version and how many laps it has recorded ('Bridge v1.8.13 · N laps recorded'). The bridge records on its own whether or not the web is open — this line confirms it at a glance. If the bridge is out of date (can't report this), the screen shows 'Bridge out of date — update it'; the 'stale bridge on the driving PC' condition we couldn't see for 5 versions is now revealed instantly.",
      "📼 The bridge now logs each recorded lap to its log file ('lap history: +N laps (total M)') and shows the total recorded-lap count in the bridge window's status line.",
      "Note: the bridge version/lap indicator needs the driving PC to install the current bridge (v1.8.13); once installed it stays visible. Web-side recording (v1.8.12) keeps working even if the bridge is old.",
    ],
  },
  {
    v: "v1.8.12",
    date: "2026-08-15",
    tr: [
      "📼 Tur geçmişi ('+' popup) artık WEB tarafında kaydediliyor — köprü sürümünden BAĞIMSIZ. Sorunun kökü: kayıt yalnız köprü tarafında yapılıyordu; sürüş PC'sindeki köprü eskiyse (hafif köprüde sürüm göstergesi/otomatik güncelleme yok) hiçbir tur kaydolmuyor, üstelik bunu kimse göremiyordu. Artık canlı ekranı izleyen editör tarayıcısı, her aracın tur sayısı artınca o turun süresini/sektörlerini/koşulunu doğrudan yazıyor. Köprü kaydı idempotent YEDEK olarak kalır (aynı veri, çakışma yok).",
      "🔴 Yeni görünür gösterge: Canlı ekranda tur kaydı çalışırken 'Tur geçmişi kaydediliyor · N araç · N tur' satırı çıkar — kaydın gerçekten yürüdüğü artık gözle doğrulanır (eski köprü bunu bastıramaz).",
      "🐞 '+' popup 'anlık 0 tur' hatası: bir aracın tur sayısı bir kare için 0 geldiğinde (yırtık kare / araç sahaya yeni girdi) gerçek 18 tur gizleniyordu — artık yalnız geçerli pozitif tur sayısında filtre uygulanır.",
      "Dürüst kısıt: turlar yalnız bir editör tarayıcısı (ya da köprü) yarışı izlerken tamamlandıkça kaydolur; izlemeye başlamadan önceki turlar (paylaşımlı bellek geçmiş vermez) kaydedilemez. Yarış başından web'i açık tutmak en sağlamı.",
    ],
    en: [
      "📼 Lap history (the '+' popup) is now recorded on the WEB side — INDEPENDENT of the bridge version. Root cause: recording only happened bridge-side; if the driving PC's bridge was old (the lightweight bridge has no version display or auto-update) no laps were ever recorded, and nobody could tell. Now the editor's browser watching the live screen writes each lap's time/sectors/conditions the moment a car's lap count increments. The bridge recording stays as an idempotent BACKUP (same data, no conflict).",
      "🔴 New visible indicator: while lap recording is active the live screen shows 'Recording lap history · N cars · N laps' — you can now confirm at a glance that recording actually runs (an old bridge can't suppress it).",
      "🐞 '+' popup 'transient 0 laps' bug: when a car's lap count arrived as 0 for a single frame (torn frame / car just entered) the real 18 laps were hidden — the filter now only applies for a valid positive lap count.",
      "Honest limit: laps are only recorded as they complete while an editor browser (or the bridge) is watching; laps completed before watching started (shared memory has no history) cannot be recovered. Keeping the web open from the green flag is most reliable.",
    ],
  },
  {
    v: "v1.8.11",
    date: "2026-08-15",
    tr: [
      "🛠 Stint kendi kendine atlama düzeltildi: stint tablosundaki AVG LAP alanına Avrupa nokta yazımıyla girilen süre (ör. '2.21.0') 2.21 SANİYE sanılıyor, 21 turluk 1. stint 46 saniyeye inip plan daha yarışın başında 2. stinte geçiyordu. Artık 'd.ss.s' biçimi dakika olarak tanınıyor (2.21.0 = 2:21.0); ayrıca 30 saniyenin altındaki imkânsız tur süreleri (yazım hatası) yok sayılıyor — geçersiz giriş alanda kırmızı gösterilir, stint yarış ortalamasıyla hesaplanmaya devam eder.",
      "⚠ Cut/puan cezaları artık Ceza sütununda görünüyor: LMU'nun pist-limiti (cut) cezaları paylaşımlı bellekteki sayaca yansımıyordu — köprü artık oyunun kendi standings verisindeki (REST) yetkili ceza sayısını okuyup gösteriyor. Not: bu düzeltme köprü tarafında — sürüş PC'sinin yeni köprü/masaüstü sürümünü kurması gerekir.",
    ],
    en: [
      "🛠 Fixed self-jumping stints: a lap time typed into the stint table's AVG LAP field in European dot notation (e.g. '2.21.0') was read as 2.21 SECONDS, shrinking a 21-lap stint to 46 seconds so the plan skipped to stint 2 right after the start. 'm.ss.f' is now recognised as minutes (2.21.0 = 2:21.0); additionally, impossible lap times under 30 seconds (typos) are ignored — invalid input shows in red and the stint keeps using the race average.",
      "⚠ Cut/points penalties now show in the Penalty column: LMU's track-limit (cut) penalties never reached the shared-memory counter — the bridge now reads the authoritative penalty count from the game's own standings (REST) data. Note: this fix is bridge-side — the driving PC must install the new bridge/desktop build.",
    ],
  },
  {
    v: "v1.8.10",
    date: "2026-08-15",
    tr: [
      "🛞 Tutuş (GRIP) göstergesi artık emoji değil, temaya uygun bir SVG ikonu: lastik alttan grip yüzdesine kadar dolar ve seviyeye göre renklenir (düşük=kırmızı → orta=amber → yüksek=yeşil). Canlı 'Tutuş' KPI'sında ve '+' tur geçmişi pist-koşulu satırında kullanılıyor; her boyutta net, çevrimdışı (Tauri) da çalışır.",
    ],
    en: [
      "🛞 The Grip indicator is no longer an emoji but a theme-matched SVG icon: the tyre fills from the bottom up to the grip percentage and is colour-coded by level (low=red → medium=amber → high=green). Used in the live 'Grip' KPI and the '+' lap-history track-condition row; crisp at any size and works offline (Tauri) too.",
    ],
  },
  {
    v: "v1.8.9",
    date: "2026-08-14",
    tr: [
      "⏱ Yarış öncesi geri sayım artık planı bozmuyor: yarış başlamadan önceki grid/formasyon/geri sayım (ör. 1:30) sırasında otomatik saat hizalama, bu kısa süreyi 'yarış bitişine kalan süre' sanıp Stint planını yarış bitmiş gibi geçmişe kaydırıyordu. Sebep — köprü bayrağı bu fazlarda da 'Green' gösteriyordu (yalnız FCY'yi ayırıyor); hizalama artık yalnız gerçek YEŞİL FAZI'nda (ışıklar sönüp yarış saati işlerken) çalışıyor. Grid/formasyon/geri sayım/ısınmada saat senkronu tetiklenmez.",
    ],
    en: [
      "⏱ Pre-race countdown no longer breaks the plan: during the grid/formation/countdown before the race (e.g. 1:30), auto clock-alignment mistook that short timer for 'time left until race end' and shifted the Stint plan into the past as if the race were over. Cause — the bridge flag reads 'Green' in those phases too (it only distinguishes FCY); alignment now runs only during the actual GREEN phase (lights out, race clock running). No clock sync fires during grid/formation/countdown/warmup.",
    ],
  },
  {
    v: "v1.8.8",
    date: "2026-08-14",
    tr: [
      "📡 Çift-yazıcı düzeltmesi: takım arkadaşın hafif köprüyle yayın yaparken, uygulaması açık başka bir üyenin oto-köprüsü de kendini yayıncı sanıp aynı anda yazabiliyordu (hafif köprü yazıcı-kira seçimine katılmadığı için görünmezdi; aynı hesabın iki penceresi de kirayı ikisi birden 'benim' sayıyordu) → Canlı ekran kare kare yanıp sönüyor, 'Canlı kaynak' yanlış kişiyi gösteriyordu. Artık başka bir yazıcının taze karesi varken uygulama otomatik olarak '⏸ Beklemede — X yayınlıyor' moduna geçer; yayıncı susarsa ~7 sn içinde otomatik devralır.",
    ],
    en: [
      "📡 Dual-writer fix: while a teammate broadcast via the lightweight bridge, another member's auto-bridge (app merely open) could also think it was the broadcaster and write at the same time (the lightweight bridge doesn't join the writer-lease election so it was invisible to it; two windows of the same account also both counted the lease as 'mine') → the Live screen flickered frame by frame and 'Live source' showed the wrong person. The app now automatically drops to '⏸ Standby — X broadcasting' whenever another writer's fresh frame exists; if the broadcaster goes silent it takes over within ~7s.",
    ],
  },
  {
    v: "v1.8.7",
    date: "2026-08-14",
    tr: [
      "🅿 Sürüş Modu kaldırıldı: masaüstü pencere arka planda/gizliyken arayüzü duraklatıp \"Driving Mode\" ekranı gösteren özellik (v1.4.99) devreden çıkarıldı. Sürüş PC'si artık tarayıcısız hafif köprüyü kullandığından bu koruma amacını yitirmişti — izleyen mühendisin pencereye dönmesinde gereksiz duraklama ekranı çıkarıyordu. Uygulama arka planda da normal render etmeye devam eder.",
    ],
    en: [
      "🅿 Driving Mode removed: the feature (v1.4.99) that paused the interface and showed a \"Driving Mode\" screen while the desktop window was hidden/in the background has been retired. Driving PCs now use the browserless lightweight bridge, so this safeguard had lost its purpose — it only produced an unnecessary pause screen for engineers switching back to the window. The app now keeps rendering normally in the background.",
    ],
  },
  {
    v: "v1.8.6",
    date: "2026-08-14",
    tr: [
      "🏁 ASIL kök neden bulundu — hafif köprü (Caspian Live Bridge) tur geçmişini HİÇ yazmıyordu. Tur listesi \"+\" penceresi kalıcı livelaps düğümünden okur; bu düğümü bugüne dek yalnız masaüstü uygulamasının kendi köprü modu yazıyordu. Oyun donması düzeltmeleriyle sürüş PC'si hafif köprüye geçince canlı tablo çalışmaya devam etti ama tur geçmişi (turlar, sektörler, pilot değişimi, pit lastikleri, pist koşulu, pozisyon grafiği) hiç kaydedilmedi → popup her araçta boş kaldı. Hafif köprü artık tüm bu geçmişi masaüstüyle birebir aynı biçimde yazıyor.",
      "📉 Bonus: hafif köprünün her karesi artık tur listelerini taşımıyor (geçmiş kalıcı düğüme taşınıp kareden çıkarılıyor) → Firebase trafiği belirgin azaldı. ⚠ Köprüyü çalıştıran PC'nin yeni sürümü kurması gerekir (masaüstü kurulumu hafif köprüyü de günceller).",
    ],
    en: [
      "🏁 TRUE root cause found — the lightweight bridge (Caspian Live Bridge) never wrote lap history. The \"+\" lap-list popup reads from the persistent livelaps node, which until now only the desktop app's own bridge mode wrote. When driving PCs switched to the lightweight bridge (game-freeze fixes), the live table kept working but lap history (laps, sectors, driver swaps, pit tyres, track condition, position chart) was never recorded → the popup stayed empty for every car. The lightweight bridge now writes all of this history exactly like the desktop app.",
      "📉 Bonus: lightweight-bridge frames no longer carry lap arrays (history moves to the persistent node and is stripped from the frame) → noticeably less Firebase traffic. ⚠ The PC running the bridge must install the new build (the desktop installer also updates the lightweight bridge).",
    ],
  },
  {
    v: "v1.8.5",
    date: "2026-08-14",
    tr: [
      "🏁 Canlı Timing tur geçmişi düzeltmesi: bir pilot turunu tamamladığı halde \"+\" penceresinde tur kaydedilmiyordu. Sebep — oyun bitiş çizgisinde tur SAYACINI, o turun SÜRESİNDEN birkaç kare önce güncelliyor; süre henüz 0 iken tur kaydı atlanıyor ve bir daha yazılmıyordu. Artık tur bir kenara alınıp süresi geldiğinde kaydediliyor; hiçbir tur kaybolmuyor. (Köprüyü çalıştıran PC'nin yeni masaüstü sürümünü kurması gerekir.)",
    ],
    en: [
      "🏁 Live Timing lap-history fix: a driver could complete a lap yet nothing appeared in the \"+\" popup. Cause — at the finish line the game bumps the lap COUNTER a few frames before that lap's TIME; while the time was still 0 the lap was skipped and never written afterward. Laps are now held and recorded once their time arrives, so none are lost. (The PC running the bridge needs the new desktop build.)",
    ],
  },
  {
    v: "v1.8.4",
    date: "2026-08-14",
    tr: [
      "🟣🟢 Canlı Timing: bir pilot en iyi turunu geçtiğinde satırda yanan renk (mor = sınıf rekoru, yeşil = kişisel rekor) artık ~1,5 sn yerine 5 saniye kalıyor — vurgu ~3,5 sn tam parlar, son 1,5 sn'de söner. (Hareket azaltma açık kullanıcılarda yanıp sönme yine devre dışı.)",
    ],
    en: [
      "🟣🟢 Live Timing: when a driver beats their best lap, the row highlight (purple = class record, green = personal best) now lasts 5 seconds instead of ~1.5s — it holds full color for ~3.5s and fades over the last 1.5s. (Still disabled for reduced-motion users.)",
    ],
  },
  {
    v: "v1.8.3",
    date: "2026-08-14",
    tr: [
      "🏳️ Resmi Yarışlar: pist adının yanında emoji bayrak yerine bayrak görseli (PNG) gösteriliyor. Emoji bayraklar Windows'ta \"BE / ES / IT / FR\" gibi harf kısaltmalarına düşüyordu; artık ana menüdeki gibi gerçek bayrak resmi görünür (yarış kartları + \"Sıradaki Resmi Yarış\" özeti).",
    ],
    en: [
      "🏳️ Official Races: the flag next to the track name is now a flag image (PNG) instead of an emoji flag. Emoji flags fell back to letter codes like \"BE / ES / IT / FR\" on Windows; now a real flag image shows, matching the main menu (race cards + the \"Next Official Race\" summary).",
    ],
  },
  {
    v: "v1.8.2",
    date: "2026-08-14",
    tr: [
      "🎨 Lastik sekmesi ikonu artık diğer sekmelerle uyumlu — renkli lastik görseli yerine, çubuktaki diğer ikonlarla aynı ince çizgi stilinde (tread halkası + jant) monokrom bir ikon kullanılıyor. Sekme çubuğu ikon boyutları da eşitlendi.",
    ],
    en: [
      "🎨 The Tyres tab icon now matches the rest — instead of a colored tyre image it uses a thin monochrome line icon (tread ring + rim) in the same style as the other tab icons. Tab-bar icon sizes were also evened out.",
    ],
  },
  {
    v: "v1.8.1",
    date: "2026-08-14",
    tr: [
      "🗑 Ana menüden yarış silme: Takım Sahibi/Mühendis artık planlanan bir yarışı ana menüdeki kartından doğrudan silebilir (🗑 düğmesi) — önce Yönet penceresini açmaya gerek yok. Kazara silmeyi önlemek için 'Bu yarışı silmek istediğinize emin misiniz?' onayı çıkar. Görüntüleyicilerde düğme görünmez.",
    ],
    en: [
      "🗑 Delete a race from the main menu: the Team Owner/Engineer can now delete a planned race straight from its card in the main menu (🗑 button) — no need to open the Manage panel first. A 'Are you sure you want to delete this race?' confirmation prevents accidental deletes. The button is hidden for viewers.",
    ],
  },
  {
    v: "v1.8.0",
    date: "2026-08-14",
    tr: [
      "⚡ Büyük performans sürümü — uygulama baştan sona hızlandırıldı. Açılış: başlangıçta indirilen kod yarıdan fazla küçüldü (sürüm notları, İngilizce sözlük, telemetri çözümleyicileri ve masaüstü köprü kodu artık yalnız gerektiğinde yüklenir); yazı tipleri sayfayla birlikte anında istenir; tema stilleri ekran geçişlerinde tekrar tekrar işlenmez. Girişten ana ekrana geçiş belirgin şekilde daha çabuk.",
      "🏁 Canlı yarış akıcılığı: arayüz artık her saniye 8-10 kez değil, yalnız veri gerçekten değişince tazelenir. Pozisyon grafiği kare başına değil tur başına kurulur, zaman tablosu satırları geçişlerde sökülüp yeniden kurulmaz (görseller titremez), pist haritası hesapları önbelleklenir ve strateji hesabı tuş başına 3 yerine 1 kez koşar — uzun yarışlarda ısınma/yavaşlama hissi giderildi.",
      "📈 Telemetri ekranı: oynatma (play) artık 7 grafiği saniyede 25 kez yeniden çizmiyor — yalnız oynatma çizgisi kayar, grafikler sabit durur; harita sürüklemeleri takılmaz, yapıştırılan MoTeC metni yazarken değil yazma bitince çözümlenir. .duckdb dosyalarında motor açılışlar arasında sıcak tutulur: ikinci ve sonraki dosyalar saniyeler yerine anında açılır.",
    ],
    en: [
      "⚡ Big performance release — the app got faster end to end. Startup: the code downloaded at launch shrank by more than half (release notes, the English dictionary, telemetry parsers and the desktop bridge now load only when needed); fonts are requested with the page immediately; theme styles are no longer re-parsed on every screen transition. Login-to-app feels notably snappier.",
      "🏁 Live race smoothness: the UI now refreshes only when data actually changes instead of 8-10 times per second. The position chart rebuilds once per lap rather than per frame, timing rows are no longer torn down on overtakes (no image flicker), track-map math is cached, and the strategy calculation runs once per keystroke instead of three times — the slow-down feel in long races is gone.",
      "📈 Telemetry screen: playback no longer redraws all 7 charts 25 times a second — only the playhead moves while charts stay put; map dragging doesn't stutter, and pasted MoTeC text is parsed when you stop typing, not on every keystroke. For .duckdb files the engine stays warm between opens: the second and later files open instantly instead of taking seconds.",
    ],
  },
  {
    v: "v1.7.7",
    date: "2026-08-14",
    tr: [
      "🛞 Resmi Yarış ön ayarı lastik seti sınırını da otomatik dolduruyor: lmugarage yarış sayfasındaki 'Tyre sets' değeri (ör. 8) çekiliyor; 📋 formunda 'Lastik seti' alanı dolu gelir ve Kaydet'te lastik bütçesine (Lastik sekmesindeki set sınırı) uygulanır. Değer düzenlenebilir; site vermezse mevcut varsayılan kalır.",
    ],
    en: [
      "🛞 Official-race preset now also auto-fills the tyre-set limit: the 'Tyre sets' value on the lmugarage race page (e.g. 8) is captured; the 📋 form's 'Tyre sets' field comes pre-filled and, on Save, is applied to the tyre budget (the set limit on the Tyres tab). Editable; if the site doesn't provide it, the existing default stays.",
    ],
  },
  {
    v: "v1.7.6",
    date: "2026-08-14",
    tr: [
      "⏱ Resmi Yarış ön ayarında sıralama süresi artık lmugarage'ın kendi yarış sayfasından OTOMATİK okunuyor: takvim toplayıcısı her yarışın 'Race weekend' panelinden Practice/Qualifying/Race sürelerini çekiyor. 📋 ile açılan formda 'Sıralama süresi' o etkinliğin gerçek değeriyle (ör. 8 dk) dolu gelir → 'Yarış başı' doğru hesaplanır (seans + sıralama + 5 dk). Süre bilgisi çekilemezse tahmini varsayılana düşer; her durumda elle düzenlenebilir.",
      "🏁 Bonus: yarış süresi liste sayfasında olmayan Özel/Şampiyona etkinliklerinin süresi de aynı 'Race weekend' panelinden dolduruluyor → ön ayarda yarış süresi de doğru gelir.",
    ],
    en: [
      "⏱ Official-race preset now reads the qualifying length AUTOMATICALLY from lmugarage's own race page: the schedule scraper pulls Practice/Qualifying/Race durations from each race's 'Race weekend' panel. The 📋 form's 'Qualifying length' comes pre-filled with that event's real value (e.g. 8 min) → 'Race start' is computed correctly (session + qualifying + 5 min). If the length can't be fetched it falls back to an estimate; either way it stays editable.",
      "🏁 Bonus: Special/Championship events (whose race length isn't on the list page) now get their duration from the same 'Race weekend' panel → the preset's race length is correct too.",
    ],
  },
  {
    v: "v1.7.5",
    date: "2026-08-14",
    tr: [
      "⏱ Resmi Yarış ön ayarında yarış başı otomatik hesaplanıyor: LMU'da listelenen saat SEANS (sıralama) başıdır; gerçek yarış (yeşil bayrak) sıralama + 5 dk formasyon kadar sonra başlar. 📋 ile açılan formda 'Sıralama süresi (dk)' alanı çıkar — değeri girince 'Yarış başı' anında güncellenir (ör. seans 14:00, sıralama 20 dk → yarış 14:25) ve strateji geri sayımı buna göre kurulur.",
      "ℹ️ Not: sıralama süresi LMU takviminde yer almadığından tahmini bir varsayılan (15 dk) gelir — kendi etkinliğine göre düzeltmen için alan görünür ve düzenlenebilir; istersen başlangıç saatini elle de değiştirebilirsin.",
    ],
    en: [
      "⏱ Official-race preset now auto-computes the race start: the time listed on LMU is the SESSION (qualifying) start; the actual race (green flag) begins after qualifying + a 5-min formation. The 📋 form now shows a 'Qualifying length (min)' field — enter it and 'Race start' updates instantly (e.g. session 14:00, qualifying 20 min → race 14:25), and the strategy countdown anchors to that.",
      "ℹ️ Note: qualifying length isn't in the LMU schedule, so an estimated default (15 min) is used — the field is visible and editable so you can set your event's value; you can also adjust the start time manually.",
    ],
  },
  {
    v: "v1.7.4",
    date: "2026-08-14",
    tr: [
      "🔗 Masaüstü uygulamasında dış bağlantılar artık çalışıyor: Resmi Yarışlar'daki ↗ (lmugarage'da aç) ve kaynak linki ile 'ℹ Neler değişti' penceresindeki GitHub linki, tıklayınca varsayılan sistem tarayıcısında açılır. Önceden masaüstünde (gömülü tarayıcı yeni sekme açmadığı için) tepki vermiyordu. Web tarafı zaten çalışıyordu; değişiklik masaüstüne yeni sürümle gelir.",
    ],
    en: [
      "🔗 External links now work in the desktop app: the ↗ (open on lmugarage) and source link in Official Races, plus the GitHub link in the 'ℹ What's new' window, now open in your default system browser when clicked. Previously they did nothing on desktop (the embedded browser doesn't open new tabs). The web build already worked; the fix reaches desktop with the new version.",
    ],
  },
  {
    v: "v1.7.3",
    date: "2026-08-14",
    tr: [
      "📋 Resmi Yarışlar → ön ayar: bir resmi yarış kartındaki 📋 düğmesine basınca o yarışın pisti, sınıfı, süresi ve başlangıç saati otomatik dolu bir 'Yarış Ekle' formu açılır — aracı seçip Kaydet dediğinde takım takviminde yarış + strateji verisi oluşur. Kaydetme adımı (pit yolu, yakıt vb.) mevcut yarış oluşturma akışıyla aynı.",
      "ℹ️ Not: LMU takvimi belirli bir ARAÇ taşımaz (yalnız sınıf listesi) → aracı formdan sen seçersin; çok sınıflı etkinlikte ilk sınıf ön-seçilir, değiştirebilirsin. Süre yalnız günlük/haftalık yarışlarda gelir (özel/şampiyona kayıtlarında varsayılan süreye düşer). Bu düğme yalnız bir takımın varken görünür.",
    ],
    en: [
      "📋 Official Races → preset: click the 📋 button on an official race card and an 'Add Race' form opens pre-filled with that race's track, class, duration and start time — pick a car, hit Save, and it creates the race + strategy data in the team calendar. Saving (pit lane, fuel, etc.) uses the same existing race-creation flow.",
      "ℹ️ Note: the LMU schedule carries no specific CAR (only a class list) → you pick the car in the form; for multi-class events the first class is pre-selected and you can change it. Duration is only present for daily/weekly races (special/championship entries fall back to the default duration). The button only shows when you have a team.",
    ],
  },
  {
    v: "v1.7.2",
    date: "2026-08-13",
    tr: [
      "🎞 Telemetri oynatma artık AKICI: playhead (kanallardaki yeşil çizgi) ve haritadaki daire, veri noktaları ARASINDA interpole edilerek 25 kare/sn kayar — eski ~7 kare/sn'lik zıplama bitti (.ld ve .duckdb ikisinde de).",
      "🗺 GPS kanalı olmayan .duckdb kayıtlarında pist haritası artık hız + yanal-G'den yeniden kurulur (.ld ile aynı yöntem) → harita, tekerlek zoom/pan/sürükle, sektör işaretleri ve ⛶ Büyüt düğmesi bu dosyalarda da gelir.",
      "📐 GPS'li .duckdb haritasında enlem/boylam oranı düzeltildi (boylam cos(enlem) ile ölçeklenir) — pist artık dikeyde uzamış görünmez.",
    ],
    en: [
      "🎞 Telemetry playback is now SMOOTH: the playhead (green line on channels) and the map dot glide at 25 fps by interpolating between data points — the old ~7 fps stepping is gone (both .ld and .duckdb).",
      "🗺 For .duckdb logs without GPS channels the track map is now reconstructed from speed + lateral-G (same method as .ld) → the map, wheel zoom/pan/scrub, sector marks and the ⛶ Expand button appear for these files too.",
      "📐 Fixed the latitude/longitude aspect on GPS-based .duckdb maps (longitude scaled by cos(latitude)) — the track no longer looks vertically stretched.",
    ],
  },
  {
    v: "v1.7.1",
    date: "2026-08-13",
    tr: [
      "👥 Pilotlar sekmesinde baş-harf rozetleri yerine artık kullanıcı avatarı gösteriliyor: yüklenmiş özel avatar → yoksa Google hesabı profil fotoğrafı → yoksa (elle yazılan/takım dışı pilotlar için) renkli baş-harf rozeti. Kadro çipleri, sürüş dağılımı kartları ve stint atama satırlarının hepsinde geçerli.",
      "🔗 Takım üyelerinin Google profil fotoğrafı takım düğümünde saklanır (ad kopyasıyla aynı desen) — üye bir sonraki girişinde otomatik güncellenir; diğer üyeler pilot listesinde avatarını görür.",
    ],
    en: [
      "👥 The Drivers tab now shows user avatars instead of initial badges: uploaded custom avatar → else the Google account profile photo → else (for manually-typed / non-team pilots) a colored initial badge. Applies to the roster chips, driving-distribution cards and stint assignment rows.",
      "🔗 Team members' Google profile photo is stored on the team node (same pattern as the name copy) — auto-synced on the member's next login; other members see the avatar in the pilot list.",
    ],
  },
  {
    v: "v1.7.0",
    date: "2026-08-13",
    tr: [
      "🖼 Kapsamlı görsel asset sistemi: kullanıcı avatarı, takım logosu ve takım başına araç TOP/SIDE görselleri. Tüm görseller yüklenirken doğrulanır (PNG/JPEG/WebP + içerik kontrolü, ≤10 MB), otomatik ölçeklenip WebP'ye sıkıştırılır ve statik görsellerle birebir aynı tuval boyutuna (SIDE 1000×400, TOP 400×1000) normalize edilir — her araç her ekranda aynı boyda/hizada durur.",
      "👤 Avatar: Profil penceresinden yükle/kaldır — başlıktaki kullanıcı çipinde, takım üye listesinde, sohbette ve admin üye yönetiminde görünür. Görsel yoksa ada göre renkli baş harf rozeti.",
      "🏷 Takım logosu: Takım Yönetimi → Takım Kimliği'nden yüklenir (owner/editor) — ana menü takım kartında, başlıktaki takım düğmesinde ve yarış çubuğunda görünür.",
      "🏎 Araç görselleri: Takım Yönetimi → Araç Görselleri kartından sınıf+araç seçip SIDE ve TOP yüklenir (owner/editor). SIDE: araç seçimi, Dashboard, başlık ve PDF'te; TOP: Canlı Timing 'Kendi Araç' panosunda kullanılır. Yüklenmeyen araçlar mevcut varsayılan görsellerle kalır.",
      "🔒 Yetki: görselleri yalnız takım sahibi/mühendis değiştirir (avatar yalnız sahibinin); Firebase kuralları sunucu tarafında da doğrular (tür/boyut sınırları dahil).",
    ],
    en: [
      "🖼 Comprehensive visual asset system: user avatars, team logo and per-team car TOP/SIDE images. Every upload is validated (PNG/JPEG/WebP + content sniffing, ≤10 MB), auto-scaled, compressed to WebP and normalized to the exact canvas of the bundled assets (SIDE 1000×400, TOP 400×1000) — every car renders at the same size and alignment on every screen.",
      "👤 Avatar: upload/remove from the Profile window — shown in the header user chip, team member list, chat and the admin user manager. Without an image, a colored initial badge is shown.",
      "🏷 Team logo: uploaded from Team Management → Team Identity (owner/editor) — shown on the main-menu team card, the header team button and the race bar.",
      "🏎 Car images: from the Team Management → Car Images card pick class+car and upload SIDE and TOP (owner/editor). SIDE is used in car selection, Dashboard, header and PDF; TOP on the Live Timing 'Own Car' board. Cars without uploads keep the default images.",
      "🔒 Permissions: only team owner/engineer can change team images (avatars only by their owner); Firebase rules also enforce this server-side (including type/size limits).",
    ],
  },
  {
    v: "v1.6.3",
    date: "2026-08-12",
    tr: [
      "🛡 '+' tur geçmişi hayalet verisi KÖKTEN çözüldü: popup artık yalnız aracın o an tamamladığı tur sayısına kadar olan turları gösteriyor. Önceki koşudan kalan turlar/pilotlar ('Vanthoor' hayaleti) — köprüyü çalıştıran PC'nin sürümünden BAĞIMSIZ olarak — tüm izleyicilerde anında gizlenir. 0 turdaki araçta popup boş görünür.",
      "🔁 Yarış, köprü çalışırken yeniden başlatılırsa (lobby restart) eski geçmiş artık otomatik temizleniyor (sahadaki tur sayısının sıfıra düştüğü iki ardışık kare = restart).",
      "🗑 'Tur geçmişini temizle' düğmesi artık '+' penceresinin altında ve WEB'de de var (owner/editor) — masaüstü şart değil.",
      "📦 Masaüstü sürümlerinin yayınlanmasını engelleyen kronik derleme hatası (NSIS araç indirmesi kopması) giderildi — paketleme adımı geçici hatada bir kez otomatik yeniden denenir. (v1.6.2 bu yüzden hiç yayınlanamamıştı; v1.6.3 hepsini içerir.)",
    ],
    en: [
      "🛡 '+' lap-history phantom data fixed at the ROOT: the popup now only shows laps up to the car's current completed-lap count. Leftover laps/drivers from a previous run (the 'Vanthoor' ghost) are hidden instantly for every viewer — regardless of which version the bridge PC runs. A car with 0 laps shows an empty popup.",
      "🔁 If the race is restarted while the bridge keeps running (lobby restart), old history is now auto-cleared (two consecutive frames with the field's lap count back at zero = restart).",
      "🗑 The 'Clear lap history' button now also lives at the bottom of the '+' window and works on WEB too (owner/editor) — desktop not required.",
      "📦 Fixed the chronic build failure (NSIS tool download drop) that blocked desktop releases — the bundling step now retries once on transient errors. (v1.6.2 never shipped because of it; v1.6.3 includes everything.)",
    ],
  },
  {
    v: "v1.6.2",
    date: "2026-08-12",
    tr: [
      "🏳 Canlı Timing bayrağı: oyunda yerel/sektör sarısı yandığında artık doğru gösteriliyor (eskiden yeşil kalıyordu). Sektör bayrağı çözümlemesi genişletildi — LMU'nun 'yellow' kelimesi yerine sayısal kod/farklı sözcük gönderdiği durumlar da yakalanıyor; FCY olmadan üç sektörün birden sarı gelmesi ise (güvenilmez 'yanlış full-yellow' deseni) yeşil sayılıyor.",
      "🗑 '+' tur geçmişi: aynı takvim yarışını TEKRAR koştuğunda önceki koşunun turları/pilotları artık sızmıyor. Köprü yarış başında açıldığında eski geçmiş otomatik temizleniyor; yarış ortasında açtıysan Canlı Köprü kartındaki yeni 'Tur geçmişini temizle' düğmesiyle (owner/editor) elle sıfırlayabilirsin.",
    ],
    en: [
      "🏳 Live Timing flag: local/sector yellows in game are now shown correctly (they used to stay green). Sector-flag parsing was widened — cases where LMU sends a numeric code or a different word instead of literally 'yellow' are now caught; and three sectors all yellow without FCY (the unreliable 'false full-yellow' pattern) is treated as green.",
      "🗑 '+' lap history: running the same calendar race AGAIN no longer leaks the previous run's laps/drivers. Old history is auto-cleared when the bridge starts at the race start; if you start it mid-run, use the new 'Clear lap history' button on the Live Bridge card (owner/editor).",
    ],
  },
  {
    v: "v1.6.1",
    date: "2026-08-12",
    tr: [
      "🏳 Ana Menü \"Sıradaki Yarış\" kartı: emoji bayrak (bazı sistemlerde \"FR\" harflerine düşüyordu) yerine artık mevcut bayrak görseli (assets/flags) + hemen sağında pistin görseli (assets/tracks) gösteriliyor. Le Mans → Fransa bayrağı + Le Mans pist görseli; aynı mekanizma tüm ülke/pistlerde çalışır.",
    ],
    en: [
      "🏳 Main Menu \"Next Race\" card: the emoji flag (which fell back to \"FR\" letters on some systems) is replaced by the existing flag image (assets/flags) plus the track image (assets/tracks) right beside it. Le Mans → French flag + Le Mans track image; the same mechanism works for every country/track.",
    ],
  },
  {
    v: "v1.6.0",
    date: "2026-08-12",
    tr: [
      "🎨 Ana Menü: Telemetri kartının sürekli kırmızı görünümü kaldırıldı — artık diğer hızlı-erişim kartlarıyla aynı renk/hover davranışında (işlevi aynı).",
      "🔤 Setup penceresi: dosya adı, tur zamanı ve karşılaştırma değerlerindeki daktilo (Roboto Mono) görünümü kaldırıldı — uygulamanın gövde fontuna (rakamlar yine hizalı) geçti.",
      "🧩 Takım Yönetimi penceresi yeniden düzenlendi: Takım Kimliği · Sezonlar & Takvim · Üyeler & Yetkiler · Takım Erişimi kart bölümleri; üye satırları hizalı (rozet · ad · rol · eylem), daha kompakt ve okunur.",
      "🏢 \"Kur & Katıl\": Ana Menü'deki takım ekle butonu artık yönetim penceresinin tamamını değil, yalnızca Takım Kur + Katılım Kodu içeren sade bir ekran açıyor. Yönetim akışı (sezon/takvim/üye/izin) ayrı kaldı.",
      "🌐 Varsayılan dil artık İngilizce (ilk açılış). Kayıtlı bir dil tercihin varsa o korunur; istediğin zaman TR/EN geçebilirsin.",
    ],
    en: [
      "🎨 Main Menu: removed the always-red look of the Telemetry card — it now matches the other quick-access cards' color/hover behavior (function unchanged).",
      "🔤 Setup window: dropped the typewriter (Roboto Mono) look from file names, lap times and comparison values — now uses the app's body font (numbers still aligned).",
      "🧩 Team Management redesigned into clear card sections: Team Identity · Seasons & Calendar · Members & Permissions · Team Access; member rows aligned (badge · name · role · action), more compact and readable.",
      "🏢 \"Create & Join\": the add-team button in the Main Menu now opens a simple screen with just Create Team + Join Code, instead of the whole management window. The management flow (seasons/calendar/members/permissions) stays separate.",
      "🌐 Default language is now English (first launch). A saved language preference is preserved; switch TR/EN anytime.",
    ],
  },
  {
    v: "v1.5.3",
    date: "2026-08-12",
    tr: [
      "🛰 Ana Menü → Telemetre artık Race Solo'dan TAMAMEN bağımsız. Telemetre butonu kendi başına bir telemetri ekranı açıyor — pist/araç seçim sihirbazına ya da Race Solo kurulumuna girmiyor; .ld / .duckdb yükle, analiz et, 🏠 Ana Menü ile geri dön.",
      "🔒 İki taraf birbirine sızmıyor: bağımsız telemetri ekranı kendi durumunu tutar; Race Solo'nun telemetri sekmesi (Takımsız solo akışı) eskisi gibi çalışır. Birini kapatmak diğerini etkilemez.",
    ],
    en: [
      "🛰 Main Menu → Telemetry is now FULLY independent of Race Solo. The Telemetry button opens a standalone telemetry screen — no track/car pick wizard or Race Solo setup; load .ld / .duckdb, analyze, return with 🏠 Main Menu.",
      "🔒 The two sides don't leak into each other: the standalone telemetry screen keeps its own state; Race Solo's telemetry tab still works as before. Closing one doesn't affect the other.",
    ],
  },
  {
    v: "v1.5.2",
    date: "2026-08-12",
    tr: [
      "🔧 Telemetri: .duckdb dosyasına GÖMÜLÜ setup artık Telemetri sekmesinde görünüyor. Yeni \"Bu Seansın Setup'ı\" kutusu — özet çipleri (fren dengesi, kanat, ABS/TC, basınç…) + \"Detay\" ile kategorili tam liste (Setup İçerik penceresiyle aynı düzen: Aero · Fren · Lastik · Hizalama · Süspansiyon · Diferansiyel · Elektronik · Motor) + arama.",
      "⬆ \"Havuza Kaydet\": telemetriyle gelen setup tek tıkla Setup Havuzuna eklenir — ayrı .svm dosyası yüklemeye gerek yok; pist/sınıf telemetri bilgisinden otomatik etiketlenir.",
      "ℹ️ Değerler dosyanın kendi okunabilir etiketlerinden gelir (ör. \"120 kgf (%100)\", \"P7 (hard)\"). Pist adı tanınmazsa setup havuzda etiketsiz kalır (elle düzeltilebilir).",
    ],
    en: [
      "🔧 Telemetry: the setup EMBEDDED in the .duckdb file now shows on the Telemetry tab. A new \"This Session's Setup\" box — summary chips (brake bias, wing, ABS/TC, pressure…) + \"Detail\" for the full categorized list (same layout as the Setup Content window: Aero · Brakes · Tyres · Alignment · Suspension · Differential · Electronics · Engine) + search.",
      "⬆ \"Save to Pool\": the setup that came with the telemetry is added to the Setup Pool in one click — no need to upload a separate .svm; track/class are auto-tagged from the telemetry.",
      "ℹ️ Values come from the file's own readable labels (e.g. \"120 kgf (100%)\", \"P7 (hard)\"). If the track name isn't recognized the setup stays untagged in the pool (editable).",
    ],
  },
  {
    v: "v1.5.1",
    date: "2026-08-12",
    tr: [
      "📊 Telemetri: LMU'nun yeni yerel kayıt formatı .duckdb artık DOĞRUDAN yüklenebiliyor (MoTeC → CSV export adımı gerekmez; .ld de çalışmaya devam eder). Aynı tur tablosu, %105, stint kaydı, iz karşılaştırması ve pist haritası .duckdb ile de çalışır.",
      "🗺 .duckdb'de pist haritası GERÇEK GPS'ten çizilir (yaklaşık yerine kesin devre şekli); vites/gaz/fren/hız/RPM/direksiyon izleri ve tur-tur yakıt/lastik aşınması dosyadan okunur.",
      "ℹ️ İlk .duckdb açılışında telemetri motoru (WebAssembly, ~35 MB) bir kez indirilir — yalnız telemetri kullanınca; site/ana uygulama etkilenmez. Dosya yalnız kendi aracının verisini içerir (saha yok); köşe sırası varsayımı ileride oyun HUD'u ile doğrulanacak.",
    ],
    en: [
      "📊 Telemetry: LMU's new native recording format .duckdb can now be loaded DIRECTLY (no MoTeC → CSV export step; .ld still works). The same lap table, 105% rule, stint save, trace comparison and track map all work with .duckdb.",
      "🗺 For .duckdb the track map is drawn from REAL GPS (exact circuit shape instead of an estimate); gear/throttle/brake/speed/RPM/steering traces and per-lap fuel/tyre wear are read from the file.",
      "ℹ️ On the first .duckdb open the telemetry engine (WebAssembly, ~35 MB) downloads once — only when you use telemetry; the site/main app is unaffected. The file contains only your own car's data (no field); the corner order assumption will be verified against the game HUD later.",
    ],
  },
  {
    v: "v1.5.0",
    date: "2026-08-12",
    tr: [
      "🎉 1.5.0 — Ana Menü yeniden düzenlendi: dikey uzayan yığın yerine kompakt bir dashboard. Takımlar artık yatay kaydırılan kartlar (10+ takımda bozulmaz); üstte belirgin 📊 Telemetri hızlı erişim + Setup Havuzu · Sohbet · Yönet (okunmamış/adet rozetleriyle); sıradaki yarış vurgulu bir hero kart olarak; geçmiş yarışlar artık aranabilir + sezon-filtreli + 'Daha fazla' ile sayfalı (yalnız son 5 değil → 100+ yarışta aradığın bulunur).",
      "📊 Telemetri'ye lobiden tek tıkla girilir (.ld yükle · analiz) — yarış açmaya gerek yok.",
      "ℹ️ Renk/tipografi mevcut kimlik; tüm veriler (takımlar, takvim, sezonlar) aynı kaynaklardan gelir, işlev korunur.",
    ],
    en: [
      "🎉 1.5.0 — Main Menu redesigned: a compact dashboard instead of a vertically sprawling stack. Teams are now horizontally scrolling cards (holds up at 10+ teams); a prominent 📊 Telemetry quick access up top + Setup Pool · Chat · Manage (with unread/count badges); the next race as a highlighted hero card; past races are now searchable + season-filtered + paginated with 'Show more' (not just the last 5 → find what you're looking for across 100+ races).",
      "📊 Telemetry is one click from the lobby (load .ld · analyze) — no need to open a race.",
      "ℹ️ Colors/typography follow the existing identity; all data (teams, calendar, seasons) comes from the same sources, functionality preserved.",
    ],
  },
  {
    v: "v1.4.146",
    date: "2026-08-12",
    tr: [
      "🏎 Pilotlar sekmesi yeniden düzenlendi: düz tablo yerine pilot kartları — renkli baş-harf rozeti (süre-dağılımı grafiğiyle aynı renk), toplam sürüş süresi, stint sayısı, % pay çubuğu ve atandığı stint numaraları → kimin ne kadar sürdüğü tek bakışta. Stint→pilot ataması artık daha temiz bir program listesi (numara · zaman penceresi · pilot seçici). Süre dağılımı grafiği (Donut) ve tüm işlevler (ekle/çıkar, atama, temizle) korunuyor.",
      "ℹ️ Yalnız mevcut veriler kullanıldı (fotoğraf/canlı-durum gibi uydurma alan yok — baş-harf rozeti addan türer).",
    ],
    en: [
      "🏎 Redesigned the Drivers tab: instead of a flat table, driver cards — colored initials badge (same color as the time-share chart), total stint time, stint count, % share bar, and the stint numbers assigned → who drove how much, at a glance. The stint→driver assignment is now a cleaner schedule list (number · time window · driver picker). The time-share chart (donut) and all functions (add/remove, assign, clear) are preserved.",
      "ℹ️ Only existing data is used (no invented fields like photos or live status — the initials badge derives from the name).",
    ],
  },
  {
    v: "v1.4.145",
    date: "2026-08-12",
    tr: [
      "🔧 Setup İçeriği penceresi yeniden düzenlendi: ham bölüm adları (REARWING, FRONTLEFT…) yerine dostça kategoriler (Aero · Lastik · Süspansiyon · Hizalama · Fren · Diferansiyel · Elektronik · Motor & Yakıt) altında, net etiket · değer · birim hiyerarşisiyle iki kolon. Ön/arka eş alanlar (basınç, kamber, yükseklik…) tek satırda ÖN·ARKA olarak birleşir → liste yarı yarıya kısalır.",
      "🔧 Setup İçeriğine alan araması ve 'Anlamlı alanlar / Tümünü göster' anahtarı eklendi. Değerler yine dosyanın kendi etiketlerinden gelir (uydurma yok); yalnız veride bulunan kategoriler çizilir.",
    ],
    en: [
      "🔧 Redesigned the Setup Contents window: instead of raw section names (REARWING, FRONTLEFT…), fields are grouped under friendly categories (Aero · Tyres · Suspension · Alignment · Brakes · Differential · Electronics · Engine & Fuel) with a clear label · value · unit hierarchy in two columns. Matching front/rear fields (pressure, camber, ride height…) merge into a single FRONT·REAR row → the list is roughly half as long.",
      "🔧 Added field search and a 'Key fields / Show all' toggle to Setup Contents. Values still come from the file's own labels (nothing invented); only categories present in the data are drawn.",
    ],
  },
  {
    v: "v1.4.144",
    date: "2026-08-12",
    tr: [
      "🔤 Typography merkezileştirildi: font aileleri artık tek yerde (CSS değişkenleri --font-ui / --font-disp / --font-mono) tanımlı; kod içine dağılmış sabit font-family değerleri bunlara çekildi. Font seçimi tek noktadan değişebiliyor.",
      "🔤 Setup bölümündeki daktilo (monospace) görünümü kaldırıldı — Setup içeriği özet çipleri ve değer satırları artık uygulamanın gövde fontuyla (sayılar yine hizalı) görünüyor. Canlı timing tabloları ve sayaçlar bilinçli olarak monospace kalıyor (rakam hizası).",
    ],
    en: [
      "🔤 Typography centralized: font families are now defined in one place (CSS variables --font-ui / --font-disp / --font-mono); hardcoded font-family values scattered across the code were pulled into them. The font choice can be changed from a single point.",
      "🔤 Removed the typewriter (monospace) look from the Setup section — Setup content summary chips and value rows now use the app's body font (numbers still aligned). Live timing tables and counters intentionally stay monospace (digit alignment).",
    ],
  },
  {
    v: "v1.4.143",
    date: "2026-08-12",
    tr: [
      "🧹 Lastik Stratejisi sekmesinden 'Kullanılan kuru lastik no' satırı kaldırıldı (hangi lastik numaralarının kullanıldığı zaten hücre renkleri ve 'Kullanılan / Kalan Lastik' sayaçlarında görünüyordu). Sayaçlar ve köşe kuralı denetimi aynen çalışıyor.",
      "🔍 Lastik ↔ Stint durum akışı yeniden gözden geçirildi (bileşim, kullanılmış/yeni, stint değişimi, pit, sürücü değişimi, seans sıfırlama): önceki sıkılaştırmalar (pit bayrakları tablodan türetilir, kullanılan-set sayımı her seferinde yeniden hesaplanır) sağlam; yeni bir hata bulunmadı.",
    ],
    en: [
      "🧹 Removed the 'Used dry tyre no' line from the Tyre Strategy tab (which tyre numbers are in use was already visible from the cell colors and the 'Used / Remaining Tyres' counters). The counters and corner-rule validation keep working unchanged.",
      "🔍 Re-audited the Tyre ↔ Stint state flow (compound, used/new, stint change, pit, driver swap, session reset): the prior hardening (pit flags derived from the table, used-set count recomputed every time) holds; no new bug found.",
    ],
  },
  {
    v: "v1.4.142",
    date: "2026-08-12",
    tr: [
      "🔧 Stint plan tablosunda her pit için, FUEL'in yanına 'Hasar' (tamir süresi, sn) alanı eklendi. Girilen süre plana +Ns olarak yansır (bitiş saati ve kalan süre yeniden hesaplanır) ve canlı Pit Board'daki tamir alanıyla AYNI değeri paylaşır — iki yerde ayrı tutulmaz. Önceden tamir süresi yalnız pit atıldıktan sonra Pit Board'dan girilebiliyordu; artık planlarken de önden girilebilir.",
    ],
    en: [
      "🔧 In the Stint plan table, a 'Damage' field (repair time, s) was added next to FUEL for each pit. The value flows into the plan as +Ns (end time and time-left recompute) and shares the SAME value as the repair field on the live Pit Board — it isn't stored twice. Previously repair time could only be entered from the Pit Board after a pit was marked; now it can be pre-entered while planning too.",
    ],
  },
  {
    v: "v1.4.141",
    date: "2026-08-12",
    tr: [
      "🪶 Caspian Live Bridge sadeleştirildi: 'REST aç' ve 'Mock veri' kutuları kaldırıldı. REST (VE% + takım/numara) artık HEP açık ve arka planda 3 saniyede bir çalışır (oyunu dondurmadan — v1.4.140 ile kökten çözüldü).",
      "🪶 'Kaydet & Başlat' başarıyla bağlanınca köprü penceresi otomatik olarak sistem tepsisine iner (yayın sürer). Başlatma başarısız olursa pencere görünür kalır ki hatayı görebilesin.",
      "🏎 Köprü penceresine 'Race Engineer'a Dön' butonu eklendi (yalnız masaüstü uygulamasından açıldıysa görünür): köprüyü kapatır ve Race Monitor'ı geri açar.",
    ],
    en: [
      "🪶 Caspian Live Bridge simplified: the 'Enable REST' and 'Mock data' checkboxes were removed. REST (VE% + team/number) is now ALWAYS on and runs in the background every 3 seconds (without stuttering the game — fixed at the root in v1.4.140).",
      "🪶 On a successful 'Save & Start', the bridge window now auto-minimizes to the system tray (streaming continues). If start fails, the window stays visible so you can see the error.",
      "🏎 Added a 'Back to Race Engineer' button to the bridge window (shown only when it was opened from the desktop app): it closes the bridge and reopens Race Monitor.",
    ],
  },
  {
    v: "v1.4.140",
    date: "2026-08-09",
    tr: [
      "❄️ Oyun donması kalıntısı düzeltmesi: köprü, VE/takım/bayrak için LMU REST'i açık kullanırken iki STATİK veriyi (486 araçlık araç kataloğu ve hava kelime sözlüğü) her 10 dakikada bir gereksizce yeniden çekiyordu. Bu ağır çağrılar seans ortasında oyunu mikro-dondurmaya yol açıyordu (25 dakikada ~2 donma). Artık bu iki statik kaynak seans başında YALNIZCA BİR KEZ çekiliyor — periyodik ağır tikler ortadan kalktı, donma bitmeli/çok azalmalı.",
      "ℹ️ Not: canlı hava değişimi ETKİLENMEZ — gerçek yağmur/ıslaklık paylaşımlı bellekten her karede, bayrak ise ~3 sn'de bir okunmaya devam eder; yalnızca değişmeyen statik sözlük/katalog bir kez yüklenir. Ayrıca gizli bir hata da düzeldi: ilk çekim başarısız olursa (oyunun REST'i henüz hazır değilse) katalog artık 10 dakika boş kalmıyor, bir sonraki turda yeniden deneniyor. Sürüş PC'sinin yeni masaüstü sürümünü kurması gerekir.",
    ],
    en: [
      "❄️ Residual game-freeze fix: while using LMU REST (for VE/team/flag), the bridge was needlessly re-fetching two STATIC datasets (the 486-car vehicle catalog and the weather-label dictionary) every 10 minutes. These heavy calls caused the game to micro-freeze mid-session (~2 freezes per 25 minutes). Those two static sources are now fetched ONLY ONCE at session start — the periodic heavy hitches are gone, so freezing should stop or drop sharply.",
      "ℹ️ Note: live weather changes are UNAFFECTED — real rain/wetness is still read from shared memory every frame and the flag every ~3s; only the unchanging static dictionary/catalog is loaded once. Also fixes a latent bug: if the first fetch fails (game REST not ready yet), the catalog no longer stays empty for 10 minutes — it retries on the next cycle. The driving PC needs to install the new desktop build.",
    ],
  },
  {
    v: "v1.4.139",
    date: "2026-08-09",
    tr: [
      "🐛 ÖNEMLİ düzeltme: '+' tur geçmişi bazen 0 tur gösteriyordu (araç 9 tur atmış olsa da). İki köprü aynı anda yayın yaparken (v1.4.137) seans belirteci PC'ye özel bir alan içerdiğinden, yazıcı el değiştirdikçe canlı-geçmiş yanlışlıkla siliniyordu. Belirteç artık tüm PC'lerde aynı olan seans indeksini kullanıyor — tur geçmişi silinmiyor.",
      "🏁 Pist Haritası: pit ÇIKIŞI artık 'P' dairesi yerine yolu kesen BEYAZ çizgi + 'PIT OUT' yazısı ile gösteriliyor (pit girişi yeşil 'P' olarak kalır).",
      "📊 Canlı Timing standings zenginleşti: Ceza sayısı (⚠), son turun S1·S2·S3 sektör süreleri, tur başına VE tüketimi (VE/tur) sütunları eklendi; Lastik hücresi artık 4 köşe aşınma yüzdesini (ÖnSol/ÖnSağ/ArkaSol/ArkaSağ, renk kodlu) gösteriyor. Not: oyun rakip araçlar için lastik HAMURUNU yalnız ön/arka verir (köşe-köşe hamur oyunda yok); güvenlik derecesi (safety rank) ne paylaşımlı bellekte ne REST'te olduğundan gösterilemiyor.",
      "🧹 Canlı Köprü kartından 'Hava Kalibrasyonu' ve 'REST'i kapat (test)' butonları kaldırıldı (teşhis araçlarıydı).",
    ],
    en: [
      "🐛 IMPORTANT fix: the '+' lap history sometimes showed 0 laps (even after a car ran 9 laps). With two bridges broadcasting at once (v1.4.137), the session token included a PC-specific field, so every writer handover accidentally wiped the live history. The token now uses the session index (identical on all PCs) — lap history is no longer erased.",
      "🏁 Track Map: the pit EXIT is now shown as a WHITE line crossing the track + a 'PIT OUT' label (instead of a 'P' circle); pit entry stays a green 'P'.",
      "📊 Live Timing standings enriched: added Penalty count (⚠), last-lap S1·S2·S3 sector times, and per-lap VE consumption (VE/lap) columns; the Tyre cell now shows all 4 corner wear percentages (FL/FR/RL/RR, color-coded). Note: the game only exposes front/rear tyre COMPOUND for rivals (no per-corner compound), and driver safety rank isn't available in shared memory or REST, so it can't be shown.",
      "🧹 Removed the 'Weather Calibration' and 'Turn off REST (test)' buttons from the Live Bridge card (they were diagnostic tools).",
    ],
  },
  {
    v: "v1.4.138",
    date: "2026-08-08",
    tr: [
      "🛠 Açılış çökmesi düzeltmesi: v1.4.137'den sonra uygulama açılırken 'Bir şeyler ters gitti' hatası veriyordu (ReferenceError: canEditTeam is not defined). Canlı köprü hook'unda kalan eski bir değişken referansı düzeltildi; uygulama artık normal açılıyor.",
    ],
    en: [
      "🛠 Startup crash fix: after v1.4.137 the app showed a 'Something went wrong' error on launch (ReferenceError: canEditTeam is not defined). A leftover stale variable reference in the live-bridge hook was fixed; the app now loads normally again.",
    ],
  },
  {
    v: "v1.4.137",
    date: "2026-08-08",
    tr: [
      "🛰 Canlı Köprü artık takımın HERHANGİ bir üyesinde çalışır (yalnız Sahip/Mühendis değil). Endurance'ta koltuğa geçecek co-sürücü 'izleyici' rolünde olsa da kendi PC'sinden canlı timing'i yayınlayabilir.",
      "🔒 Güvenlik: strateji/plan düzenleme yine yalnız Sahip/Mühendis'e açık — değişen tek şey canlı yayın (live timing) yetkisi. Tek-yazıcı kirası aynı anda birden çok köprüyü zaten yönetir; iki köprü aynı anda açık olsa da veri çakışmaz.",
    ],
    en: [
      "🛰 The Live Bridge now runs for ANY team member (not just Owner/Engineer). In endurance, an incoming co-driver in the 'viewer' role can broadcast live timing from their own PC.",
      "🔒 Security: editing the strategy/plan is still limited to Owner/Engineer — only live-timing broadcast permission changed. The single-writer lease already coordinates multiple bridges, so two bridges open at once do not clash.",
    ],
  },
  {
    v: "v1.4.136",
    date: "2026-08-08",
    tr: [
      "🏷 Canlı Timing: bazı araçlarda marka logosu görünmüyordu. Artık takım/üretici adı çok kelimeli olsa da (ör. 'Chevrolet Corvette', 'Ford Mustang') logo doğru eşleniyor.",
      "📈 Pozisyon Grafiği artık yalnızca YARIŞ seansında görünüyor (antrenman/sıralamada anlamsız olduğu için gizli).",
      "🔗 Stint ↔ Canlı Timing senkronu (oto-PIT, saat hizalama, hava ve AVG5 önerileri, pit sayısı uyarısı) artık yalnızca YARIŞ seansında çalışıyor.",
      "🌧 Pist Haritası 'Büyüt' penceresinde zemin ıslaklığı ikonu kocaman görünüyordu — düzeltildi (ikon artık normal boyutta).",
    ],
    en: [
      "🏷 Live Timing: some cars were missing their brand logo. Multi-word team/manufacturer names (e.g. 'Chevrolet Corvette', 'Ford Mustang') now resolve to the correct logo.",
      "📈 The Position Chart is now shown only during the RACE session (hidden in practice/qualifying where it isn't meaningful).",
      "🔗 Stint ↔ Live Timing sync (auto-PIT, clock alignment, weather & AVG5 suggestions, pit-count warning) now runs only during the RACE session.",
      "🌧 In the Track Map 'Expand' window the track-wetness icon appeared oversized — fixed (icon is now normal size).",
    ],
  },
  {
    v: "v1.4.135",
    date: "2026-08-08",
    tr: [
      "🧹 Canlı Timing '+' tur geçmişi düzeltmesi: bir araç satırında '+' ile açılan tur listesi bazen O SEANSLA ALAKASIZ (önceki antrenman/deneme seansının, hatta başka pilotun) turlarını gösteriyordu. Köprü artık oyundan kararlı bir seans belirteci alıyor; yeni bir seans başlayınca (antrenman → yarış) o yarışın tüm canlı-geçmişi bir kez otomatik temizleniyor, eski turlar yeni seansa sızmıyor.",
      "🔒 Köprü yarış ORTASINDA yeniden başlatılırsa seans belirteci aynı kaldığı için geçmiş KORUNUR (yanlış temizleme yok). Not: bu yarışın mevcut eski verisi bir sonraki seans başında otomatik temizlenir. (Yayın yapan sürüş PC'sinin yeni masaüstü sürümünü kurması gerekir.)",
    ],
    en: [
      "🧹 Live Timing '+' lap-history fix: the lap list opened from a car's '+' sometimes showed laps UNRELATED to the current session (from an earlier practice/test session, even a different driver). The bridge now reads a stable session token from the game; when a new session begins (practice → race) that race's entire live-history is cleared once, so old laps no longer bleed into the new session.",
      "🔒 If the bridge is restarted mid-race the session token stays the same, so history is PRESERVED (no wrong clear). Note: this race's existing old data clears automatically at the start of the next session. (The broadcasting PC needs the new desktop build.)",
    ],
  },
  {
    v: "v1.4.134",
    date: "2026-08-08",
    tr: [
      "🟣 Canlı Timing: bir araç kendi SINIFININ en hızlı turunu atınca satırı kısa bir MOR animasyonla yanıp söner (yeni sınıf rekoru).",
      "🟢 Canlı Timing: bir araç kendi turunu geliştirince (kişisel rekor, ama sınıf en hızlısı değil) satırı YEŞİL animasyonla yanıp söner. Klasik timing-tower renk konvansiyonu; sahadaki tüm araçlar için çalışır.",
    ],
    en: [
      "🟣 Live Timing: when a car sets the fastest lap of its CLASS, its row briefly flashes PURPLE (new class record).",
      "🟢 Live Timing: when a car improves its own lap (personal best, but not the class fastest) its row flashes GREEN. Classic timing-tower color convention; works for every car in the field.",
    ],
  },
  {
    v: "v1.4.133",
    date: "2026-08-08",
    tr: [
      "🏎 Masaüstü ana menüsündeki buton artık 'Driver Moduna Geç' yazıyor (eski 'Köprü moduna geç').",
      "🔧 Ana menüye (takım takvimi) 'Setup Havuzu' butonu her zaman görünür oldu. Önceden yalnız havuz zaten yüklüyken çıkıyordu; havuz ise ancak açınca yüklendiği için buton hiç görünmüyordu. Artık butona basınca havuz açılıp yüklenir (dolu değilse de görünür).",
    ],
    en: [
      "🏎 The desktop main-menu button now reads 'Switch to Driver Mode' (was 'Switch to bridge mode').",
      "🔧 The 'Setup Pool' button is now always visible in the main menu (team calendar). It used to appear only when the pool was already loaded — but the pool only loads once opened, so the button never showed. Now pressing it opens and loads the pool (visible even when empty).",
    ],
  },
  {
    v: "v1.4.132",
    date: "2026-08-08",
    tr: [
      "🪟 Hafif köprü artık siyah komut (cmd) penceresi AÇMADAN çalışır ve sistem TEPSİSİNDE kalır: pencereyi (X) kapatınca uygulama kapanmaz, tepsiye küçülür ve yayına devam eder. Tepsi ikonuna çift tıkla → pencere geri gelir; tepsi menüsünden 'Çıkış' ile tamamen kapanır.",
      "🪶 Masaüstü uygulamasının ana menüsüne '🪶 Köprü moduna geç' butonu eklendi: basınca Race Monitor kapanır ve tarayıcısız Hafif Köprü açılır. Sürüş PC'sinde ağır arayüzü otomatik kapattığı için oyunun donmasını kökten önler; mühendisler canlıyı web'den izlemeye devam eder.",
    ],
    en: [
      "🪟 The lightweight bridge now runs WITHOUT opening a black command (cmd) window and stays in the system TRAY: closing the window (X) no longer quits it — it minimizes to the tray and keeps streaming. Double-click the tray icon to bring it back; use 'Quit' in the tray menu to close it fully.",
      "🪶 Added a '🪶 Switch to bridge mode' button to the desktop app's main menu: pressing it closes Race Monitor and opens the browserless Lightweight Bridge. On the driving PC it auto-closes the heavy UI, preventing game stutter at the source; engineers keep watching live from the web.",
    ],
  },
  {
    v: "v1.4.131",
    date: "2026-08-08",
    tr: [
      "🧊 Oyun donması — ASIL ÇÖZÜM. 'REST açınca donuyor, kapalıyken donmuyor' kesin bulgusuna göre, LMU REST istekleri artık oyunu okuma döngüsünün İÇİNDE değil, AYRI BİR ARKA PLAN İŞ PARÇACIĞINDA yapılıyor (TinyPedal gibi). Böylece VE% + gerçek takım adı/numara + yetkili bayrak DONMADAN geri geldi: okuma döngüsü yalnız önbelleği okur, hiç beklemez.",
      "⚡ Köprüye 'REST yenileme (sn)' alanı eklendi (varsayılan 3). İstekler arka planda 3 sn'de bir yapıldığından oyuna binen yük çok azaldı. Çok nadir bir takılma kalırsa bu değeri 5-10 yapabilirsin (VE yavaş değişir, seyrek tazeleme yeter). REST'i 'aç' kutusuyla açıp VE/takım adını dondurmadan görebilirsin.",
    ],
    en: [
      "🧊 Game stutter — THE REAL FIX. Per the definitive finding 'stutters when REST is on, not when off', LMU REST requests now run in a SEPARATE BACKGROUND THREAD instead of inside the game-reading loop (like TinyPedal). This brings back VE% + real team names/numbers + authoritative flags WITHOUT freezing: the read loop only reads a cache and never waits.",
      "⚡ Added a 'REST refresh (s)' field to the bridge (default 3). Because requests now happen in the background every 3s, the load on the game dropped dramatically. If a very rare hitch remains, raise it to 5-10 (VE changes slowly, infrequent refresh is enough). Turn REST on with the checkbox to see VE/team names without freezing.",
    ],
  },
  {
    v: "v1.4.130",
    date: "2026-08-08",
    tr: [
      "🧊 Oyun donması — TEŞHİS DÜZELTİLDİ. 'Sadece köprü açıkken (uygulama yokken) 2 PC'de de donuyor' bulgusu, sorunun tarayıcıda (WebView2) değil KÖPRÜNÜN kendisinde olduğunu gösterdi. İki gerçek sebep düzeltildi: (1) köprü artık DÜŞÜK ÖNCELİKTE çalışır (çekişmede oyun kazanır); (2) oyunun localhost REST sunucusuna istek atan LMU REST varsayılan olarak KAPATILDI — bu, donmanın en güçlü sebebiydi.",
      "⚡ Köprüye 'REST aç' onay kutusu eklendi (varsayılan kapalı). Kapalıyken pozisyon/tur/gap/lastik yine gelir; yalnız VE% ve gerçek takım adı gelmez. Donma yoksa açıp VE/takımı görebilirsin; donma geri gelirse REST sebep demektir, kapalı bırak. Köprü log dosyasına da 'REST: kapalı/açık · öncelik: düşük' yazılır.",
    ],
    en: [
      "🧊 Game stutter — DIAGNOSIS CORRECTED. The finding 'freezes on 2 PCs with only the bridge open (no app)' showed the cause is the BRIDGE itself, not the browser (WebView2). Two real causes fixed: (1) the bridge now runs at BELOW-NORMAL priority (the game wins contention); (2) the LMU REST calls into the game's own localhost server are now OFF by default — that was the strongest stutter cause.",
      "⚡ Added a 'REST on' checkbox to the bridge (off by default). With it off, positions/laps/gaps/tyres still work; only VE% and real team names are missing. If you don't stutter you can turn it on for VE/teams; if stutter returns, REST is the cause — leave it off. The bridge log also records 'REST: on/off · priority: low'.",
    ],
  },
  {
    v: "v1.4.129",
    date: "2026-08-08",
    tr: [
      "🔧 Hafif köprü Google girişi düzeltildi: tarayıcıda giriş tamamlandığı halde köprü 'onay bekleniyor' diye takılı kalıyordu. Sebep, tarayıcının favicon isteği yakalanan giriş kodunu eziyordu; artık yalnız gerçek giriş yanıtı yakalanıyor. Giriş anında tamamlanır.",
    ],
    en: [
      "🔧 Fixed the lightweight bridge's Google sign-in getting stuck on 'waiting for approval' even after you finished in the browser. The browser's favicon request was overwriting the captured auth code; now only the real sign-in response is captured, so login completes immediately.",
    ],
  },
  {
    v: "v1.4.128",
    date: "2026-08-08",
    tr: [
      "📦 Masaüstü kurulumu (setup.exe) artık tarayıcısız hafif köprüyü de kurar: kurulunca Başlat menüsüne 'Caspian Hafif Kopru' kısayolu eklenir. Sürüş PC'sinde ayrıca indirmeye gerek yok — kurup kısayoldan aç, Google ile giriş yap, sür. (Lobiden tek başına indirme de duruyor.)",
      "🗂 Hafif köprü ayar dosyası (config.ini) artık yazılabilir bir klasöre kaydediliyor (%LOCALAPPDATA%\\CaspianLiveBridge) — köprü Program Files gibi salt-okunur bir yerden çalışsa da ayarlar kaydedilebilir.",
    ],
    en: [
      "📦 The desktop installer (setup.exe) now also installs the browser-less lightweight bridge and adds a 'Caspian Hafif Kopru' Start-menu shortcut. On the driving PC you no longer need a separate download — install, open from the shortcut, sign in with Google, and drive. (The standalone lobby download still exists.)",
      "🗂 The lightweight bridge's config.ini is now saved to a writable folder (%LOCALAPPDATA%\\CaspianLiveBridge) — settings persist even when the bridge runs from a read-only location like Program Files.",
    ],
  },
  {
    v: "v1.4.127",
    date: "2026-08-08",
    tr: [
      "🔐 Hafif köprüde artık BOT GEREKMEZ — kendi Google hesabınla giriş yaparsın (uygulamadaki gibi). Köprü senin hesabınla yayınlar (takımda Mühendis/Sahip olman yeter); bir kez giriş, sonra tekrar sormaz.",
      "🎯 team_id/race_id otomatik: Google girişinden sonra köprü takımlarını ve yarışlarını okur → Takım ve Yarış'ı açılır listeden seçersin, kriptik kod kopyalamak yok. (Bot e-posta/parola + elle ID girişi isteğe bağlı, 'Gelişmiş' altında kalır.)",
    ],
    en: [
      "🔐 The lightweight bridge no longer needs a bot — you sign in with your own Google account (just like the app). It publishes as you (Engineer/Owner on the team is enough); log in once, no re-prompt after.",
      "🎯 Automatic team_id/race_id: after Google login the bridge reads your teams and races → pick Team and Race from dropdowns, no cryptic ID copying. (Bot email/password + manual IDs remain optional, under 'Advanced'.)",
    ],
  },
  {
    v: "v1.4.126",
    date: "2026-08-08",
    tr: [
      "🪶 Sürüş PC'si için TARAYICISIZ hafif köprü. Oyun donması yaşayan sürüş bilgisayarı, ağır masaüstü uygulaması (içinde tarayıcı motoru var) yerine bu küçük köprü .exe'sini çalıştırabilir — TinyPedal gibi hafif, oyunu yormaz. Aynı canlı timing'i yayınlar; mühendisler web'den izler. İndirme linki lobide ve Canlı sekmesinde geri geldi. (Bir defalık config.ini kurulumu; Self-Test eklenecek UID'yi gösterir.)",
      "📄 Köprüye kalıcı log dosyası eklendi (%LOCALAPPDATA%\\CaspianLiveBridge\\caspian-bridge.log): giriş/UID, kare gönderim sayısı, okuma/yazma gecikmesi ve hatalar yazılır. Köprü penceresindeki '📄 Logu aç' ile açılır — bir sorunda paylaşmak için.",
    ],
    en: [
      "🪶 Browser-less lightweight bridge for the driving PC. A driving computer that suffers game stutter can run this small bridge .exe instead of the heavy desktop app (which embeds a browser engine) — light like TinyPedal, no game stutter. It publishes the same live timing; engineers watch from the web. The download link is back in the lobby and the Live tab. (One-time config.ini setup; Self-Test shows the UID to add.)",
      "📄 Added a persistent log file to the bridge (%LOCALAPPDATA%\\CaspianLiveBridge\\caspian-bridge.log): sign-in/UID, frames sent, read/write latency and errors. Open it via '📄 Open log' in the bridge window — handy to share when something goes wrong.",
    ],
  },
  {
    v: "v1.4.125",
    date: "2026-08-08",
    tr: [
      "🧊 Oyun donması (sürüş PC'si): DLL/veri çekerken oluşan takılmaya karşı yeni bir önlem. Uygulamanın WebView2 alt süreçleri artık bir 'gözcü' iş parçacığıyla sürekli belirli çekirdeklere sabitleniyor (Job Object'ten kopanlar dahil) ve düşük önceliğe alınıyor → oyunun çekirdek çekişmesi azalır. (Yalnız masaüstü; sürüş PC'sinin yeni sürümü kurması gerekir. Web/tarayıcı etkilenmez.)",
    ],
    en: [
      "🧊 Game stutter (driving PC): another mitigation for the freezes while the DLL/data bridge runs. The app's WebView2 child processes are now continuously pinned to specific cores by a watchdog thread (including any that break away from the Job Object) and set to below-normal priority → less core contention with the game. (Desktop only; the driving PC must install the new version. Web/browser unaffected.)",
    ],
  },
  {
    v: "v1.4.124",
    date: "2026-08-08",
    tr: [
      "🗺 Pist krokisinde S/F ve S2/S3 sektör işaretleri artık daire değil, yolu kesen kısa bir ayırıcı çizgi (etiket yanında). Sektör sınırları bir bakışta belli.",
    ],
    en: [
      "🗺 On the track sketch, the S/F and S2/S3 sector markers are now a short divider line crossing the track (with the label) instead of a circle — sector boundaries read at a glance.",
    ],
  },
  {
    v: "v1.4.123",
    date: "2026-08-08",
    tr: [
      "🏁 Pist krokisinde viraj işaretleri sadeleşti: apex noktalarındaki sarı daireler kaldırıldı, yalnız viraj numarası kaldı (siyah dış hatla okunur).",
    ],
    en: [
      "🏁 Cleaner corner markers on the track sketch: removed the yellow dots at the apexes, leaving just the corner number (with a black outline for legibility).",
    ],
  },
  {
    v: "v1.4.122",
    date: "2026-08-08",
    tr: [
      "🏁 Viraj Analizi: telemetriden her virajın A/B için viraj-ortası (apex) hızı + viraja gelirken fren mesafesi çıkarılır. Yeni tablo (viraj no · mesafe · A/B apex km/h · Δ · A/B fren mesafesi), pist krokisinde numaralı apex işaretleri ve hız izinde apex noktaları. 'Hangi virajda daha yavaş döndüm / daha geç frenledim' bir bakışta. (Sezgisel tespit: apex = hız minimumu, fren = frenin başladığı nokta; gerçek beacon değil, hız+fren kanalı gerekir.)",
    ],
    en: [
      "🏁 Corner Analysis: telemetry now derives each corner's mid-corner (apex) speed + braking distance into the corner for A/B. New table (corner no · distance · A/B apex km/h · Δ · A/B braking distance), numbered apex markers on the track sketch, and apex dots on the speed trace. See at a glance where you cornered slower / braked later. (Heuristic: apex = speed minimum, brake = brake-on point; not a real beacon, needs speed+brake channels.)",
    ],
  },
  {
    v: "v1.4.121",
    date: "2026-08-08",
    tr: [
      "🔢 İmleç değer paneli: karşılaştırma kartında ize gelince / oynatınca / daireyi sürükleyince o noktadaki tüm kanalların A ve B değerleri sayısal olarak görünür — hız (+ fark), gaz, fren, vites, RPM, direksiyon + o noktadaki zaman-delta. 'Şu virajda A 198, B 205 km/h' gibi.",
    ],
    en: [
      "🔢 Cursor values panel: in the comparison card, hovering / playing / dragging the dot shows the numeric A and B value of every channel at that point — speed (+ diff), throttle, brake, gear, RPM, steering + the time-delta there. E.g. 'at this corner A 198, B 205 km/h'.",
    ],
  },
  {
    v: "v1.4.120",
    date: "2026-08-08",
    tr: [
      "📄 Telemetri PDF raporu: karşılaştırma kartındaki '📄 PDF' düğmesi pist haritası + tüm iz grafiklerini (hız/gaz/fren/vites/RPM/direksiyon + zaman-delta) + koşul başlığı + sektör tablosunu yazdırılabilir bir rapora döker (yazdır → PDF olarak kaydet). Not: rapor o an ekranda görünen grafikleri basar — tam tur için önce '⟳' ile yakınlaştırmayı sıfırla.",
    ],
    en: [
      "📄 Telemetry PDF report: the '📄 PDF' button in the comparison card exports the track map + all trace charts (speed/throttle/brake/gear/RPM/steering + time-delta) + conditions header + sector table into a printable report (print → save as PDF). Note: it captures the charts as currently shown — reset zoom with '⟳' first for the full lap.",
    ],
  },
  {
    v: "v1.4.119",
    date: "2026-08-08",
    tr: [
      "🎯 Pist haritasında imleç dairesini fareyle tutup sürükle: daire pist boyunca kayar ve kanallardaki dikey imleç + sektör çipi + delta o konuma gider (oynatmanın elle sürülen hâli). Pist çizgisi üstünde sürükle = konum; boş alanda sürükle = harita gezinme (yakınlaştırınca). ⛶ Büyüt penceresinde de çalışır.",
    ],
    en: [
      "🎯 Grab the cursor dot on the track map and drag it: the dot slides along the track and the channel playhead + sector chip + delta follow (a manual-scrub version of playback). Drag on the track line = position; drag empty space = pan the map (when zoomed). Works in the ⛶ Expand window too.",
    ],
  },
  {
    v: "v1.4.118",
    date: "2026-08-08",
    tr: [
      "🔀 Çapraz-stint karşılaştırma: iki .ld dosyasını ayrı Stint slotlarına kaydedince (A/B/C/D), Tur Karşılaştırma'da A tarafını bir stint'ten, B tarafını başka bir stint'ten seçip karşılaştırabilirsin (ör. A stintinden 1 tur ↔ B stintinden 1 tur). Kaynak seçici birden çok stint olunca çıkar. Farklı pistte '⚠ farklı pist' uyarısı gösterilir.",
      "Not: ham iz verisi yalnız oturum-içidir (sayfayı yenileyince gider); her iki stint de bu oturumda .ld'den yüklenmiş olmalıdır. Pist haritası ve mesafe ekseni A tarafındandır.",
    ],
    en: [
      "🔀 Cross-stint comparison: save two .ld files into separate Stint slots (A/B/C/D), then in Lap Comparison pick the A side from one stint and the B side from another (e.g. 1 lap from stint A ↔ 1 lap from stint B). The source picker appears once you have more than one stint. A '⚠ different track' warning shows if the tracks differ.",
      "Note: raw trace data is session-only (lost on page refresh); both stints must have been loaded from a .ld this session. The track map and distance axis come from side A.",
    ],
  },
  {
    v: "v1.4.117",
    date: "2026-08-08",
    tr: [
      "▶ Telemetri oynatma: karşılaştırma kartında ▶/⏸ ile turu oynat; harita noktası + tüm kanallarda dikey imleç (playhead) birlikte kayar → virajı adım adım izle. Hız 0.5× / 1× / 2×; kaydırıcı ile elle gez. (Oynatma tur A'nın süresine göre gerçek-zamana yakın akar.)",
    ],
    en: [
      "▶ Telemetry playback: in the comparison card use ▶/⏸ to play the lap; the track-map dot and a vertical playhead on all channels move together — step through a corner. Speed 0.5× / 1× / 2×; scrub manually with the slider. (Playback runs near real-time based on lap A's duration.)",
    ],
  },
  {
    v: "v1.4.116",
    date: "2026-08-08",
    tr: [
      "🐞 Düzeltme: Tur Karşılaştırma kartı (izler + pist haritası + yakınlaştırma) bir önceki sürümde yanlışlıkla görünmüyordu; artık .ld yükleyince yeniden görünür.",
      "📍 Sektör göstergesi: kanallarda (dikey S2/S3 ayırıcıları) ve pist krokisinde (sektör tik'leri) hangi sektörde olduğun görünür; ize gelince/oynatınca başlıkta '📍 Sektör S2' çipi güncellenir. (Sektörler tur-kesri üçlüsüdür — .ld gerçek beacon vermez.)",
      "🌡 Koşul şeridi: yüklenen .ld dosyasının kendi pist adı + pist °C / hava °C bilgisi karşılaştırma kartında görünür (kaydettikten sonra da kalır).",
    ],
    en: [
      "🐞 Fix: the Lap Comparison card (traces + track map + zoom) was accidentally hidden in the previous release; it now reappears when you load a .ld.",
      "📍 Sector indicator: channels show vertical S2/S3 dividers and the track sketch shows sector ticks so you can tell which sector you're in; hovering/playing updates a '📍 Sector S2' chip in the header. (Sectors are lap-fraction thirds — .ld has no reliable beacon.)",
      "🌡 Conditions strip: the loaded .ld's own venue + track °C / air °C now shows in the comparison card (stays after saving).",
    ],
  },
  {
    v: "v1.4.115",
    date: "2026-08-08",
    tr: [
      "🔍 Telemetri karşılaştırması artık yakınlaştırılabilir: pist krokisinde fare tekerleğiyle yaklaştır/uzaklaştır, sürükleyerek gez, çift-tıkla sıfırla — bir virajı detaylı incele. Haritaya '⛶ Büyüt' düğmesi eklendi (tam pencerede açılır, orada da tekerlekle yakınlaştırılır).",
      "🔍 Kanal grafikleri (hız/gaz/fren/vites/RPM/direksiyon/delta) de fare tekerleğiyle birlikte yakınlaşır — imlecin olduğu mesafe penceresi tüm grafiklerde eşzamanlı daralır; '⟳ Yakınlaştırmayı sıfırla' ile tam tura döner.",
    ],
    en: [
      "🔍 Telemetry comparison is now zoomable: use the mouse wheel to zoom the track sketch in/out, drag to pan, double-click to reset — inspect a corner in detail. Added an '⛶ Expand' button (opens the map full-window, also wheel-zoomable there).",
      "🔍 Channel charts (speed/throttle/brake/gear/RPM/steering/delta) zoom together with the mouse wheel — the distance window under the cursor narrows across all charts in sync; '⟳ Reset zoom' returns to the full lap.",
    ],
  },
  {
    v: "v1.4.114",
    date: "2026-08-08",
    tr: [
      "🔧 Telemetri düzeni: 'Stint olarak kaydet'e basınca üstteki içe-aktar özeti (dosya seç + tur tablosu) artık kapanıyor; '✓ Stint kaydedildi' onayı dosya seçimin altında kalıcı görünüyor. Tur Karşılaştırma kartı (izler + pist haritası) artık Stint Analizi kartının ALTINDA duruyor ve kaydettikten sonra da çalışmaya devam ediyor.",
    ],
    en: [
      "🔧 Telemetry layout: clicking 'Save as Stint' now closes the import summary above (file picker + lap table); a '✓ Stint saved' confirmation stays under the file picker. The Lap Comparison card (traces + track map) now sits BELOW the Stint Analysis card and keeps working after saving.",
    ],
  },
  {
    v: "v1.4.113",
    date: "2026-08-07",
    tr: [
      "🔧 Telemetri düzeltmesi: 'Stint A olarak kaydet'e basınca Tur Karşılaştırma kutusu (izler + pist haritası) kayboluyordu; artık yerinde kalıyor. Stint aşağıdaki analize eklenir, üstte '✓ Stint A kaydedildi' onayı çıkar ve karşılaştırmaya devam edebilirsin (aynı dosyayı farklı slota da kaydedebilirsin).",
    ],
    en: [
      "🔧 Telemetry fix: clicking 'Save as Stint A' used to close the Lap Comparison box (traces + track map); it now stays in place. The stint is added to the analysis below, a '✓ Stint A saved' confirmation appears, and you can keep comparing (you can also save the same file to another slot).",
    ],
  },
  {
    v: "v1.4.112",
    date: "2026-08-07",
    tr: [
      "🗺 Telemetri Tur Karşılaştırma'ya PİST HARİTASI eklendi: yüklediğin .ld'den devrenin şekli çıkarılır (varsa konum kanalından, yoksa hız + yanal-G ile tahmin) ve karşılaştırmanın en üstünde çizilir.",
      "İz grafiklerinden birine gelince (hız/gaz/fren/delta…) haritada o nokta işaretlenir → hangi virajda olduğun net görünür. Harita, kırmızı (A hızlı) / mavi (B hızlı) renkli → hangi virajda kim kazandı bir bakışta belli.",
      "Konum ya da yanal-G kanalı olmayan dosyalarda harita çizilmez (net not gösterilir). G'den üretilen şekil yaklaşıktır. Web-only.",
    ],
    en: [
      "🗺 Added a TRACK MAP to the Telemetry Lap Comparison: the circuit shape is derived from your .ld (from a position channel if present, otherwise estimated from speed + lateral-G) and drawn at the top of the comparison.",
      "Hovering any trace (speed/throttle/brake/delta…) marks that spot on the map → you can see exactly which corner it is. The map is colored red (A faster) / blue (B faster) so you see at a glance who won each corner.",
      "Files without a position or lateral-G channel don't get a map (a clear note is shown). The G-derived shape is approximate. Web-only.",
    ],
  },
  {
    v: "v1.4.111",
    date: "2026-08-07",
    tr: [
      "📊 Telemetri: Tur Karşılaştırma — yüklediğin .ld dosyasında iki turu MESAFE ekseninde üst üste bindir. Hız, gaz, fren, vites, RPM ve direksiyon izleri yan yana; senkron imleçle aynı noktadaki tüm değerler görünür.",
      "⏱ Zaman-Delta izi: iki tur arasında mesafe boyunca kümülatif kazanç/kayıp — 'nerede zaman kaybediyorum' sorusunun cevabı. Ayrıca sektör (tur-kesri üçlüsü) bazında fark tablosu.",
      "Varsayılan en hızlı iki turu karşılaştırır; turları elle seçebilirsin. Yalnız .ld (ikili) dosyada çalışır; görünüm amaçlıdır, takım havuzuna kaydedilmez. Sonraki adım: iki farklı dosya/sürücü karşılaştırması.",
      "Web-only: sayfa yenilemesi yeterli.",
    ],
    en: [
      "📊 Telemetry: Lap Comparison — overlay two laps from your loaded .ld on a DISTANCE axis. Speed, throttle, brake, gear, RPM and steering traces stacked; a synced cursor shows every value at the same point.",
      "⏱ Time-Delta trace: cumulative gain/loss between the two laps along distance — the answer to 'where am I losing time'. Plus a per-sector (lap-fraction thirds) difference table.",
      "Defaults to the two fastest laps; pick laps manually too. Works on .ld (binary) files only; view-only, not saved to the team pool. Next: comparing two different files/drivers.",
      "Web-only: a page refresh is enough.",
    ],
  },
  {
    v: "v1.4.110",
    date: "2026-08-07",
    tr: [
      "🖨 PDF çıktısı düzeltmesi: Masaüstü uygulamasında Stint/Pilot Programı PDF'i alınamıyordu (WebView2 açılır pencereyi engelliyordu). Artık yeni pencere yerine gizli çerçeveye yazdırılıyor → yazdır/PDF-kaydet penceresi doğrudan açılır. Web tarayıcıda da daha güvenilir (popup engeli sorunu biter).",
      "🎮 CPU affinity (v1.4.109) bu sürümde ilk kez gerçekten geliyor: önceki masaüstü derlemesi eksik bir Windows kütüphane ayarı yüzünden başarısız olmuştu, düzeltildi. GPU-kapatma (v1.4.108) + CPU-affinity artık birlikte sürüş donmasını hedefler.",
      "Masaüstü güncellemesi gerekir: sürüş PC'sinde en son sürümü kurun (PDF fix + GPU-off + CPU-affinity hepsi dahil).",
    ],
    en: [
      "🖨 PDF export fix: on the Desktop app, the Stint/Driver Program PDF couldn't be produced (WebView2 blocked the popup window). It now prints into a hidden frame instead of a new window → the print / Save-as-PDF dialog opens directly. More reliable in the web browser too (no popup-blocker issue).",
      "🎮 CPU affinity (v1.4.109) actually ships for the first time in this version: the previous desktop build failed due to a missing Windows library setting, now fixed. GPU-off (v1.4.108) + CPU-affinity now target in-race stutter together.",
      "Requires a desktop update: install the latest version on the driving PC (PDF fix + GPU-off + CPU-affinity all included).",
    ],
  },
  {
    v: "v1.4.109",
    date: "2026-08-07",
    tr: [
      "🎮 Oyun donması (CPU): Masaüstü uygulaması artık CPU çekirdeklerini oyunla PAYLAŞMIYOR — uygulama süreç ağacı (arayüz + köprü) en yüksek numaralı birkaç çekirdeğe hapsedilir (Windows Job Object affinity), böylece oyun alttaki çoğunluk çekirdeği çekişmesiz kullanır. v1.4.108'deki GPU-kapatma ile birlikte, sürüş sırasındaki takılmayı kökten hedefler.",
      "Zaten düşük öncelikte çalışıyorduk (v1.4.98); bu ek olarak fiziksel çekirdek ayrımı getirir. İzleyici/mühendis PC'lerinde (oyun yok) hiçbir etkisi yoktur.",
      "Masaüstü güncellemesi gerekir: sürüş PC'sinde en son sürümü kurun (GPU-kapatma da bu sürümde dahildir). Web/tarayıcı kullanıcıları etkilenmez.",
    ],
    en: [
      "🎮 Game stutter (CPU): the Desktop app no longer SHARES CPU cores with the game — the app's process tree (UI + bridge) is pinned to the few highest-numbered cores (Windows Job Object affinity), so the game gets the bottom majority of cores uncontended. Together with the GPU-off change in v1.4.108, this directly targets in-race stutter.",
      "We already ran at lower priority (v1.4.98); this adds physical core separation on top. No effect on viewer/engineer PCs (no game running).",
      "Requires a desktop update: install the latest version on the driving PC (it also includes the GPU-off change). Web/browser users are unaffected.",
    ],
  },
  {
    v: "v1.4.108",
    date: "2026-08-07",
    tr: [
      "🎮 Oyun donması: Masaüstü uygulaması artık GPU'yu KULLANMIYOR (arayüz yazılımla çizilir). Teşhis sonuçları REST'i ve arayüz çizimini eledi (tepsiye gizliyken ve REST kapalıyken de donuyordu); geriye kalan tek sebep WebView2'nin GPU'yu oyunla paylaşmasıydı. Artık GPU tamamen oyuna kalır → sürüş sırasındaki mikro-donmanın bitmesi/belirgin azalması beklenir.",
      "Sürücü ekranında canlı timing görünmediği (yalnız mühendisler başka PC'den izlediği) için bu değişikliğin sürüş deneyimine maliyeti yok. Mühendis PC'lerinde arayüz yine akıcı çalışır.",
      "Masaüstü güncellemesi gerekir: sürüş PC'sinde yeni sürümü kurun. Web/tarayıcı kullanıcıları etkilenmez.",
    ],
    en: [
      "🎮 Game stutter: the Desktop app no longer uses the GPU (the UI renders in software). Diagnostics ruled out REST and UI rendering (it froze even minimized to the tray and with REST off); the only remaining cause was WebView2 sharing the GPU with the game. The GPU is now left entirely to the game → in-race micro-stutter should stop or drop significantly.",
      "Since the driver doesn't watch live timing on their own screen (only engineers watch from other PCs), this has no cost to the driving experience. On engineer PCs the UI stays smooth.",
      "Requires a desktop update: install the new version on the driving PC. Web/browser users are unaffected.",
    ],
  },
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
