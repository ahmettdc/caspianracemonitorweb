# i18n — Yeni ve değişen metinlerin EN karşılıkları

Kaynak: `Yeni Tasarım.dc.html`. Bu dosya `src/i18n.js` EN sözlüğüne girilecek karşılıkların
tamamıdır. **Kural: burada olmayan bir metin ürettiysen çeviri uydurma — sor.**

Biçim: TR anahtar → EN değer. Anahtar, TR metnin `t()` içine yazılan haliyle birebir aynıdır
(noktalama ve `·` ayraçları dahil). Emoji anahtarın parçası değildir; kod tarafında sabit kalır.

---

## 1. Rehber kutuları (GUIDES sözlüğü)

| ekran | TR başlık → EN | TR metin → EN |
| --- | --- | --- |
| home | Ana menü → **Main menu** | Sıradaki yarışı buradan aç, hızlı eylemlerle setup havuzuna, telemetriye ve takım takvimine geç. → **Open your next race here, and jump to the setup pool, telemetry and team calendar from the quick actions.** |
| dash | Dashboard → **Dashboard** | Yarışın özeti: pozisyon, enerji, lastik ve stint dağılımı. Araç ve pist görseline tıklayınca tempo referansı açılır. → **The race at a glance: position, energy, tyres and stint split. Click the car or track image to open the pace reference.** |
| stint | Stint planı → **Stint plan** | Stintleri süre ve pilotla planla; pit satırında lastik seçimini işaretle. PIT düğmesi gerçek pit anını kaydeder. → **Plan stints by duration and driver, and mark the tyre choice on the pit row. The PIT button records the actual stop.** |
| fuel | Son stint yakıtı → **Final stint fuel** | Kalan süreye göre gereken enerji yüzdesi. 📋 Plan açıkken geri sayım stint planından gelir; canlı veriyle tüketimi güncelleyebilirsin. → **The energy percentage you need for the time remaining. With 📋 Plan on, the countdown comes from the stint plan; you can refresh consumption from live data.** |
| live | Canlı timing → **Live timing** | Sütun başlıklarına tıklayınca değer değişir (Gap ⇄ Aralık, Son ⇄ En iyi). Bir rakip satırına tıkla, altta karşılaştırma açılır. → **Click a column header to switch what it shows (Gap ⇄ Interval, Last ⇄ Best). Click a rival's row and a comparison opens below.** |
| tyre | Lastik stratejisi → **Tyre strategy** | Her hücreye tıklayarak set ata; bir lastik ilk takıldığı köşeye kilitlenir. Hızlı atama penceresi tüm kombinasyonları verir. → **Click a cell to assign a set; a tyre locks to the corner it was first fitted on. The quick-assign window lists every combination.** |
| drivers | Pilotlar → **Drivers** | Stintlere pilot ata, sürüş süresi dağılımını izle. Uygunluk penceresinde kapattığın saatlere atama yapılamaz. → **Assign drivers to stints and watch the driving-time split. Hours you close in the availability window can't be assigned.** |
| tele | Telemetri → **Telemetry** | Stint yuvalarına dosya yükle, iki turu A/B karşılaştır. Grafiklerde imleçle gez, tekerlekle yakınlaştır, Space ile oynat. → **Load a file into a stint slot and compare two laps A/B. Scrub the charts with the cursor, zoom with the wheel, play with Space.** |
| setup | Setup havuzu → **Setup pool** | Setupları pist bazında gör, ⚖ ile iki tanesini karşılaştır. Yıldızladıkların listenin başında durur. → **Browse setups by track and compare two with ⚖. The ones you star stay at the top of the list.** |
| team | Takım → **Team** | Üye yetkilerini, sezon takvimini ve takım kimliğini buradan yönet. Katılım kodunu paylaşarak yeni üye davet edebilirsin. → **Manage member permissions, the season calendar and team identity here. Share the join code to invite new members.** |
| chat | Sohbet → **Chat** | Genel, takım ve yarışa özel kanallar. Yarış kanalı yalnız o yarışın katılımcılarına açıktır. → **General, team and race-specific channels. A race channel is open only to that race's participants.** |
| official | Resmi yarışlar → **Official races** | lmugarage listesinden günlük ve haftalık yarışlar. Planla düğmesiyle takvimine ekleyebilirsin. → **Daily and weekly races from the lmugarage listing. Use Plan to add one to your calendar.** |

Rehber kutusu kontrolü: `Gizle` → **Hide** · `Rehberi başlat` → **Start the tour** (mevcut).

## 2. Boş durumlar

**Saha verisi yok (LiveTab)**
- Canlı veri gelmiyor → **No live data**
- Köprü çalışmıyor ya da oyun seansta değil. Sürüş PC'sinde köprüyü başlat; bağlanınca saha tablosu kendiliğinden dolar. → **The bridge isn't running, or the game isn't in a session. Start the bridge on the driving PC; the field table fills by itself once it connects.**
- Yeniden bağlan → **Reconnect** · Köprü durumu → **Bridge status**
- son paket → **last packet** · dk önce → **min ago**

**Takvim boş (Ana menü)**
- Bu sezonda yarış yok → **No races this season**
- Takvime yarış ekle ya da resmi yarışlar listesinden planla — eklediğin yarışlar takımdaki herkeste görünür. → **Add a race to the calendar or plan one from the official races list — races you add appear for everyone in the team.**
- ＋ Yarış ekle → **＋ Add race** · Resmi yarışlar → **Official races**

**Kadro boş (DriversTab)**
- Kadroda pilot yok → **No drivers in the roster**
- Takım üyelerini kadroya ekle ya da yeni üye davet et; stint ataması için en az bir pilot gerekir. → **Add team members to the roster or invite someone new; stint assignment needs at least one driver.**
- ＋ Üye davet et → **＋ Invite member**

**Telemetri boş (TeleTab)**
- Henüz telemetri yok → **No telemetry yet**
- Stint yuvalarına .ld veya .duckdb dosyası yükle; iki turu karşılaştırmak için en az bir dosya gerekir. → **Load an .ld or .duckdb file into a stint slot; comparing two laps needs at least one file.**
- ⬆ Telemetri yükle → **⬆ Load telemetry**

**Sohbet boş**
- Henüz mesaj yok → **No messages yet**
- İlk yazan sen ol — bu kanaldaki mesajlar yarış boyunca takımda kalır. → **Be the first to write — messages in this channel stay with the team for the whole race.**
- Bugün → **Today**

**Setup havuzu sonuç yok**
- Yağmur setupu yok → **No wet setups**
- Senin yüklediğin setup yok → **You haven't uploaded a setup**
- Bu filtreyle eşleşen setup bulunamadı. Islak zemin için bir setup yükle — takımdaki herkes görebilir. → **No setup matches this filter. Upload one for wet conditions — everyone in the team can see it.**
- Havuza henüz setup eklemedin. Yüklediğin dosyalar takımdaki herkese açık olur. → **You haven't added a setup to the pool yet. Files you upload are visible to everyone in the team.**
- ⬆ İlk setupu yükle → **⬆ Upload your first setup**

## 3. Pilot uygunluk ızgarası (yeni)

- Pilot uygunluğu → **Driver availability**
- Stinte tıkla · o pilot o saatte uygun değil işaretlenir → **Click a stint to mark that driver unavailable for that slot**
- Uygunluk → **Availability**
- uygun → **available** · uygun değil → **unavailable**
- Varsayılan tüm stintlerde uygun → **Available for every stint by default**
- Uygun değil işaretlenen pilot o stinte atanamaz → **A driver marked unavailable can't be assigned to that stint**
- Tümünü sıfırla → **Reset all**
- 🕑 Uygunluk → **🕑 Availability**
- ⚠ {n} stint atanmadı → **⚠ {n} stints unassigned**
- ⚠ Bu stint için uygun pilot kalmadı → **⚠ No available driver left for this stint**
- Atama kaldırıldı — pilot bu stintte uygun değil → **Assignment removed — the driver is unavailable for this stint**

## 4. Yarış datası paneli (sahnele + uygula)

- Yarış datası → **Race data**
- Bu değişiklik neyi etkiler → **What this change affects**
- 📋 Stint planı süreleri ve pit pencereleri → **📋 Stint plan durations and pit windows**
- ⛽ Son stint yakıtı hesabı → **⛽ Final-stint fuel calculation**
- 🛞 Lastik limiti uyarıları → **🛞 Tyre limit warnings**
- {n} alan değişti → **{n} fields changed**
- Değişiklik yok → **No changes**
- Uygula → **Apply** · Geri al → **Discard**
- Kaydedilmemiş değişiklikler var — kapatılsın mı? → **You have unsaved changes — close anyway?**
- Yakıt oranı (L / %1) → **Fuel ratio (L per 1%)**
- ⛽ %100 = taşınan yakıt → **⛽ 100% = fuel carried**
- Ortalama tur · m:ss.00 → **Average lap · m:ss.00**
- Canlıdan al → **Take from live**
- Yakıt modeline uygula → **Apply to fuel model**

## 5. Rakip karşılaştırma tepsisi (yeni)

- Karşılaştırma → **Comparison**
- Sen → **You** · Rakip → **Rival**
- Son tur → **Last lap** · AVG5 → **AVG5** (değişmez)
- Fark → **Delta**
- daha hızlı → **faster** · daha yavaş → **slower**
- Karşılaştırmayı kapat → **Close comparison**
- Kendi satırın karşılaştırılamaz → **You can't compare your own row**

## 6. İzleyici modu

- İzleyici modu → **Viewer mode**
- İzleyici → **Viewer** · Mühendis → **Engineer** (mevcut)
- 👁 İzleyici modu · düzenleme kapalı → **👁 Viewer mode · editing disabled**
- 👁 İzleyici modunda pasif → **👁 Disabled in viewer mode**
- Bu işlem için düzenleme yetkisi gerekir → **This action needs edit permission**

## 7. Canlı timing — sütun ve süzgeç

- Poz · Sınıf → **Pos · Class**
- Kendi sınıfım süzgeci → **My class filter**
- · kendi sınıfım → **· my class**
- Lidere Gap ↔ öndekine Aralık → **Gap to leader ↔ Interval to car ahead**
- Son ↔ En iyi → **Last ↔ Best** · AVG5 ↔ AVG → **AVG5 ↔ AVG**
- Sektör sütununu gizle → **Hide the sector column**
- 👁 Sektör sütununu göster → **👁 Show the sector column**
- ◱ Pit duvarı → **◱ Pit wall** · ◰ Mühendis → **◰ Engineer**
- Veri kesildi (önizleme) → **Feed cut (preview)** · Veriyi geri getir → **Restore the feed**
- Oyun/köprü olmadan sahte veriyle doldur → **Fill with mock data, no game or bridge needed**

## 8. Stint · lastik · yakıt

- ⚠ Başlangıç lastiği seçilmedi — önce buradan başla, pit seçimleri buna zincirlenir → **⚠ No starting tyre selected — start here; pit choices chain from it**
- Temizle → **Clear**
- Hızlı atama → **Quick assign**
- Köşe kilidi ihlali → **Corner lock violation**
- Set envanteri → **Set inventory**
- Data'ya uygula → **Apply to data** · %105 filtre → **105% filter** · Stinti sil → **Delete stint**

## 9. Takım · tam sayfa geçişi

- Takımı sil → **Delete team**
- Sezonlar, yarışlar ve takım setupları kalıcı olarak silinir. Geri alınamaz. → **Seasons, races and team setups are deleted permanently. This can't be undone.**
- Katılım kodu → **Join code** (mevcut) · Kur & katıl → **Create & join** (mevcut)
- Masaüstü uygulaması → **Desktop app**
- Tarayıcısız, kendi penceresinde açılır — canlı timing köprüsü dahil. Sonraki sürümler uygulama içinden gelir. → **Runs in its own window without a browser — live timing bridge included. Future updates arrive inside the app.**
- İndir → **Download**

## 10. PDF raporu

- Yarış raporu → **Race report**
- Pist koşulları → **Track conditions**
- Pilot dağılımı → **Driver split**
- Mühendis notu → **Engineer's note**
- PDF olarak indir → **Download as PDF**
- {tarih} tarihinde oluşturuldu → **Generated on {date}**

---

## Çeviri kararları (tutarlılık için)

| TR | EN | not |
| --- | --- | --- |
| stint | stint | çevrilmez |
| saha (tablosu) | field (table) | standings değil — mevcut EN sözlüğüyle uyumlu |
| Aralık | Interval | v1.8.19 EN notlarıyla aynı |
| Tutuş | Grip · Zemin ıslaklığı | Wetness (mevcut) |
| Sanal Enerji / VE | Virtual Energy / VE | kısaltma çevrilmez |
| köprü | bridge | mevcut |
| kadro | roster | mevcut |
| uygunluk | availability | yeni |
| sahnele / uygula | stage / apply | yeni; buton metni "Apply" |
| izleyici | viewer | mevcut rol adı |
