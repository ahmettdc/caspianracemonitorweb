/* ============================================================
   guides.js — ekran üstü tek satırlık rehber kutuları (README §17)
   ------------------------------------------------------------
   Her ekranın üstünde başlık + tek satır açıklama. İKON VE KAPATMA DÜĞMESİ YOK
   (tasarım kararı). Metinler ekran kimliğine göre burada tutulur; İngilizce
   karşılıkları docs/design-handoff/i18n-EN.md §1'den src/i18n.js'e girildi.

   Ekran kimlikleri src/nav.js'teki `screen` değerleriyle birebir aynıdır.
   Statik ipuçları HEP AÇIK; opsiyonel interaktif tur (tourSteps.js) ayrı durur.
   ============================================================ */
export const GUIDES = {
  home: {
    title: "Ana menü",
    text: "Sıradaki yarışı buradan aç, hızlı eylemlerle setup havuzuna, telemetriye ve takım takvimine geç.",
  },
  dash: {
    title: "Dashboard",
    text: "Yarışın özeti: pozisyon, enerji, lastik ve stint dağılımı. Araç ve pist görseline tıklayınca tempo referansı açılır.",
  },
  stint: {
    title: "Stint planı",
    text: "Stintleri süre ve pilotla planla; pit satırında lastik seçimini işaretle. PIT düğmesi gerçek pit anını kaydeder.",
  },
  fuel: {
    title: "Son stint yakıtı",
    text: "Kalan süreye göre gereken enerji yüzdesi. 📋 Plan açıkken geri sayım stint planından gelir; canlı veriyle tüketimi güncelleyebilirsin.",
  },
  live: {
    title: "Canlı timing",
    text: "Sütun başlıklarına tıklayınca değer değişir (Gap ⇄ Aralık, Son ⇄ En iyi). Bir rakip satırına tıkla, altta karşılaştırma açılır.",
  },
  tyre: {
    title: "Lastik stratejisi",
    text: "Her hücreye tıklayarak set ata; bir lastik ilk takıldığı köşeye kilitlenir. Hızlı atama penceresi tüm kombinasyonları verir.",
  },
  drivers: {
    title: "Pilotlar",
    text: "Stintlere pilot ata, sürüş süresi dağılımını izle. Uygunluk penceresinde kapattığın saatlere atama yapılamaz.",
  },
  tele: {
    title: "Telemetri",
    text: "Stint yuvalarına dosya yükle, iki turu A/B karşılaştır. Grafiklerde imleçle gez, tekerlekle yakınlaştır, Space ile oynat.",
  },
  setup: {
    title: "Setup havuzu",
    text: "Setupları pist bazında gör, ⚖ ile iki tanesini karşılaştır. Yıldızladıkların listenin başında durur.",
  },
  team: {
    title: "Takım",
    text: "Üye yetkilerini, sezon takvimini ve takım kimliğini buradan yönet. Katılım kodunu paylaşarak yeni üye davet edebilirsin.",
  },
  chat: {
    title: "Sohbet",
    text: "Genel, takım ve yarışa özel kanallar. Yarış kanalı yalnız o yarışın katılımcılarına açıktır.",
  },
  official: {
    title: "Resmi yarışlar",
    text: "lmugarage listesinden günlük ve haftalık yarışlar. Planla düğmesiyle takvimine ekleyebilirsin.",
  },
};

/* Ekran kimliğinden çevrilmiş rehber metni. `t` verilmezse TR kaynak döner.
   code80, Stint ekranının ikinci modudur → aynı rehberi kullanır. */
export function guideFor(screen, t = (s) => s) {
  const g = GUIDES[screen === "code80" ? "stint" : screen];
  return g ? { title: t(g.title), text: t(g.text) } : null;
}
