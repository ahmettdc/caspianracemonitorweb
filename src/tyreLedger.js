/* ============================================================
   LASTİK DEFTERİ — saf (v2.3.0, adım 1: "GERÇEK" tarafı)
   ------------------------------------------------------------
   Lastik sekmesindeki plan tablosu ELLE doldurulur: stint × köşe, dört açılır
   kutu. İki sorunu var:
     1) Köşe başına HAMUR oyunda YOK — paylaşımlı bellek yalnız ön/arka verir
        (`mFrontTireCompoundName` / `mRearTireCompoundName`). Yani tablo,
        hiçbir yerde var olmayan bir ayrıntıyı kullanıcıdan istiyor.
     2) Hücredeki `N×` rozeti planın TOPLAMI olduğu için bir lastiğin BİRİNCİ ve
        İKİNCİ kullanımı birebir aynı görünüyor → "yeni lastiği hangi stint
        kullandı" okunamıyor (kullanıcı bildirimi).

   Oysa gerçek kayıt ZATEN tutuluyor: köprü her pit değişimini
   `livetyre/{rid}/{araç}/{tur} = "adet|hamur"` olarak yazıyor
   (bridge/harvest.py). Bu modül o kaydı okunur bir DEFTERE çevirir — elle giriş
   yok, tahmin yok.

   ---- MODEL: "lastik dönemi" ----
   Set kimliği (A/B/C) oyundan GELMEZ; uydurmak yerine dönem tutulur: iki değişim
   arasındaki tur aralığı. Her dönem, BAŞINDA ne takıldığını söyler:
     n=4 → tam set (YENİ)   n=2 → aks (2 lastik)   n=0 → yakıt-only (dönem AÇMAZ)
   Yarış başındaki ilk dönemin `n`'i bilinmez (`null`) — "Başlangıç" olarak
   etiketlenir, "4 yeni" diye UYDURULMAZ.

   React/Firebase bağımsız → tyreLedger.test.js doğrudan test eder.
   ============================================================ */
import { parseTyreLog } from "./tyreCompound";

/* {tur: "adet|hamur"} → artan tur sırasında [{lap, n, comp}].
   Bozuk kayıtlar ve geçersiz tur numaraları atlanır. */
export function tyreEvents(tyreLog) {
  if (!tyreLog || typeof tyreLog !== "object") return [];
  const out = [];
  for (const k of Object.keys(tyreLog)) {
    const lap = Number(k);
    if (!Number.isInteger(lap) || lap <= 0) continue;
    const p = parseTyreLog(tyreLog[k]);
    if (!p) continue;
    out.push({ lap, n: p.n, comp: p.comp });
  }
  return out.sort((a, b) => a.lap - b.lap);
}

/* En yüksek tamamlanmış tur ({tur: süre} haritasından). Yoksa 0. */
export function lastLap(lapMap) {
  if (!lapMap || typeof lapMap !== "object") return 0;
  let m = 0;
  for (const k of Object.keys(lapMap)) {
    const n = Number(k);
    if (Number.isInteger(n) && n > m) m = n;
  }
  return m;
}

/* Defter satırları — her satır bir LASTİK DÖNEMİ.
   { idx, fromLap, toLap, laps, comp, n, fresh, partial, open, fuelOnly }
     toLap  : dönemin son turu (açık dönemde son görülen tur)
     open   : dönem hâlâ sürüyor (sonrasında değişim yok)
     n      : dönem başında takılan lastik sayısı (ilk dönemde null = bilinmiyor)
     fresh  : n === 4 → tam yeni set
     partial: n === 2 → aks değişimi (iki lastik devam ediyor)
     fuelOnly: bu dönemin BAŞINDA ayrıca yakıt-only duraklar oldu (bilgi amaçlı)
   Veri yoksa boş dizi döner — uydurma satır üretilmez. */
export function buildLedger(tyreLog, lapMap) {
  const evs = tyreEvents(tyreLog);
  const end = lastLap(lapMap);
  /* Hiç değişim yoksa VE tur da yoksa gösterilecek bir şey yok. Tur varsa tek bir
     "Başlangıç" dönemi anlamlıdır (henüz pite girilmemiş). */
  if (!evs.length && end <= 0) return [];

  /* n=0 (yakıt-only) dönem AÇMAZ: lastik değişmediği için aynı lastikler devam
     eder. Yeni bir satır açsaydık defter "lastik değişti" diye yanlış okunurdu. */
  const changes = evs.filter((e) => e.n > 0);
  const fuelStops = evs.filter((e) => e.n === 0).map((e) => e.lap);

  const starts = [{ lap: 1, n: null, comp: null }, ...changes];
  const rows = [];
  for (let i = 0; i < starts.length; i += 1) {
    const s = starts[i];
    const next = starts[i + 1];
    const open = !next;
    /* Kapalı dönem bir sonraki değişimin turunda biter (o tur eski lastikle
       koşulmuştur — değişim pit'te, turun sonunda olur). Açık dönem son
       görülen tura kadar. */
    const toLap = open ? Math.max(end, s.lap) : next.lap;
    rows.push({
      idx: i,
      fromLap: s.lap,
      toLap,
      laps: Math.max(0, toLap - s.lap + (open ? 1 : 0)),
      comp: s.comp,
      n: s.n,
      fresh: s.n === 4,
      partial: s.n === 2,
      open,
      fuelOnly: fuelStops.filter((l) => l >= s.lap && (open || l < next.lap)).length,
    });
  }
  return rows;
}

/* Defterden özet: kaç tam set, kaç aks değişimi, kaç yakıt-only durak.
   "Kaç FARKLI set kullanıldı" sorusu oyunun verisiyle CEVAPLANAMAZ (set kimliği
   yok) — bu yüzden yalnız DEĞİŞİM sayıları raporlanır, set sayısı uydurulmaz. */
export function ledgerSummary(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return {
    periods: list.length,
    fullSets: list.filter((r) => r.fresh).length,
    axleChanges: list.filter((r) => r.partial).length,
    fuelOnly: list.reduce((n, r) => n + (r.fuelOnly || 0), 0),
    totalLaps: list.reduce((n, r) => n + r.laps, 0),
  };
}

/* ============================================================
   ADIM 2 — PLAN ↔ GERÇEK
   ------------------------------------------------------------
   Plan için YENİ bir veri modeli EKLENMEDİ. Mevcut grid zaten "hangi stintte
   hangi köşe değişiyor"u kodluyor (state.js: boş hücre = taşı, dolu hücre = o
   köşede pit işlemi — v1.4.60 kullanıcı kararı). Planı oradan TÜRETMEK:
     · mevcut planı olduğu gibi kullanır (göç yok, veri kaybı yok),
     · iki ayrı plan modelinin yan yana yaşamasını önler,
     · defterle AYNI şekli (kaç lastik takıldı) üretir → karşılaştırılabilir.

   EŞLEME (bilinçli sadeleştirme): plan STINT numarasıyla, defter TUR numarasıyla
   çalışır ve planda tur numarası YOKTUR — bu yüzden tur-hassas hizalama mümkün
   değil. Eşleme SIRAYLA yapılır: 1. planlanan değişim ↔ 1. gerçekleşen değişim.
   Pit duvarının sorduğu soru da budur ("plana uyuyor muyuz").
   ============================================================ */

/* Plandaki lastik DEĞİŞİMLERİ — `st.pits[i].tyres` bayraklarından türetilir.
   Dönüş: [{ stint, n, corners }] — stint 1-tabanlı (o lastiklerle KOŞULAN stint).

   NEDEN GRID'DEN DEĞİL, BAYRAKLARDAN (v2.4.1): eskiden `tyreStints` ızgarasının
   her DOLU hücresi bir değişim sayılıyordu. Üç ayrı hata çıkıyordu:

   1) S1 SATIRI YARIŞ ÖNCESİ TAKMA. `tyreStints[0]` yarışa çıkış setidir,
      öncesinde PİT YOKTUR — `syncPitTyres` de `pits[i] ← tyreStints[i+1]`
      diyerek onu hiçbir pite bağlamaz. Değişim sayılınca (a) "Plandaki lastik
      değişimi +Xs" KPI'sı yarış öncesi takmayı da ücretlendiriyor, (b) 1.
      planlanan değişim 1. GERÇEK pit durağıyla eşleşiyor → TÜM eşleme bir
      kayıyor (defterin "Başlangıç" dönemi zaten `n > 0` ile elendiği için
      karşı taraf kaymıyor). Plana tam uyulan bir yarışta ekran "1 sapma"
      gösteriyordu.
   2) PLAN DIŞI STİNTLER. Izgara 14 satır sabittir; strateji/yarış süresi
      değişip plan kısalınca S7/S8 hücreleri state'te kalıyor ve KPI'ya
      giriyordu (ölçüldü: +40.5 s yerine gerçek +24.0 s). Aynı state'te set
      bütçesi (`computeTyreInfo`) plan uzunluğuyla sınırlı olduğu için iki
      hesap aynı ızgaradan farklı sonuç veriyordu.
   3) "AYNI SETİ TEKRAR YAZ" DEĞİŞİM DEĞİLDİR. Seçici S2'ye S1'dekiyle aynı
      numarayı yazmaya izin veriyor; `pitTyreFlag` bunu 0 (taşı) sayıyor ve
      engine plana 0 sn koyuyor, ama grid'e bakan KPI 12 sn yazıyordu — aynı
      satırda iki çelişen bilgi.

   `pits[i].tyres` bu üç kuralı ZATEN uyguluyor ve engine lastik süresini de
   ondan alıyor. Aynı kaynağı kullanmak ikisinin bir daha ayrışmasını imkânsız
   kılar (CLAUDE.md §1: tek doğruluk kaynağı).

   @param st       oda durumu ({ pits: [{ tyres: [f,f,f,f] }] })
   @param planLen  plandaki stint sayısı (racePlan.rows.length) — verilmezse
                   `pits` uzunluğuyla sınırlanır */
export function planChanges(st, planLen) {
  const pits = Array.isArray(st?.pits) ? st.pits : [];
  /* Son stintin arkasında pit yoktur → en fazla planLen - 1 durak. */
  const lim = Number(planLen) > 0
    ? Math.min(pits.length, Math.max(0, Math.floor(planLen) - 1))
    : pits.length;
  const out = [];
  for (let i = 0; i < lim; i += 1) {
    const flags = Array.isArray(pits[i]?.tyres) ? pits[i].tyres : [];
    const corners = [];
    flags.forEach((f, ci) => { if (Number(f) > 0) corners.push(ci); });
    /* pits[i] = stint i+1'den SONRAKİ durak → takılan lastikler stint i+2'de
       koşulur. Etiket o stintin numarasıdır (1-tabanlı). */
    if (corners.length) out.push({ stint: i + 2, n: corners.length, corners });
  }
  return out;
}

/* Plan ile defteri SIRAYLA eşle.
   Dönüş: [{ i, plan, actual, state }]
     state: "match"   plan ve gerçek aynı sayıda lastik
            "diff"    ikisi de var ama sayı farklı
            "pending" planlandı, henüz gerçekleşmedi
            "extra"   gerçekleşti ama planda yok
   Defterin ilk dönemi (n == null, "Başlangıç") bir DEĞİŞİM değildir — eşlemeye
   girmez, yoksa her şey bir kayar. */
export function comparePlan(plan, ledger) {
  const p = Array.isArray(plan) ? plan : [];
  const a = (Array.isArray(ledger) ? ledger : []).filter((r) => r.n > 0);
  const rows = [];
  for (let i = 0; i < Math.max(p.length, a.length); i += 1) {
    const pl = p[i] || null;
    const ac = a[i] || null;
    let state;
    if (pl && ac) state = pl.n === ac.n ? "match" : "diff";
    else if (pl) state = "pending";
    else state = "extra";
    rows.push({ i, plan: pl, actual: ac, state });
  }
  return rows;
}
