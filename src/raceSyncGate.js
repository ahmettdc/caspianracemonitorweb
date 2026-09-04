/* ============================================================
   raceSyncGate — bekleyen yarış-durumu yazımı GÖNDERİLMELİ Mİ?
   ------------------------------------------------------------
   Saf karar (React/Firebase bağımsız) — `useRaceSync.pushState` bunu kullanır.

   NEDEN AYRI MODÜL: kararın kendisi tek satırlık görünüyor ama yanlış olduğunda
   bedeli bir yarışın planının HER CİHAZDAN silinmesi. Saf tutulunca doğrudan
   testlenebiliyor; hook'un içinde kalsaydı bu projede DOM test koşumu
   olmadığı için hiç test edilemezdi.

   KÖK-NEDEN (v2.4.1): `schedulePush` 800 ms'lik bir zamanlayıcı kurar.
   Zamanlayıcı hedef odayı (`rid`) KURULURKEN yakalar, ama yazılacak state'i
   (`stRef.current`) ATEŞLENDİĞİNDE okur. Arada başka bir yarışa geçilirse
   YENİ odanın state'i ESKİ odanın yoluna yazılıyordu. Yazım rev'i artırdığı
   için eski odadaki diğer editörlerin dinleyicisi bunu "yeni sürüm" sanıp
   UYGULUYOR → o yarışın planı herkeste kayboluyordu.

   İki kapı gerekiyor, biri yetmiyor:
   - `applying`: uzak state uygulanırken (ve `openRace`'in await penceresinde)
     yazma. O pencerede `curRace` HENÜZ eski odadır ama `stRef` çoktan
     yenisidir — yani `rid` karşılaştırması tek başına bu anı yakalayamaz.
   - `rid === curRid`: oda değiştikten sonraki her şeyi kapatır.
   ============================================================ */

/* @param applying  uzak state şu an uygulanıyor mu (yankı koruması)
   @param targetRid zamanlayıcının kurulduğu andaki oda
   @param curRid    şu an açık olan oda
   @returns bekleyen yazım gönderilmeli mi */
export function shouldPush(applying, targetRid, curRid) {
  if (applying) return false;
  if (!targetRid) return false;          // hedefsiz yazım yok
  return targetRid === curRid;
}

/* ------------------------------------------------------------
   Uzak durum UYGULANMALI MI?

   KÖK-NEDEN (v2.4.1): rev sunucuda transaction ile değil, İSTEMCİDE
   `rev + 1` olarak üretiliyor ve düz `set` ile yazılıyor. İki editör aynı
   rev'ten yazınca İKİSİ DE aynı numarayı üretir; sunucuda biri kalır.
   Dinleyicideki koşul `remote.rev > localRev` olduğu için KAYBEDEN taraf
   kazananın yazımını HİÇ UYGULAMAZ: ekranında kendi state'i kalır, üstte
   "senkron" yazar, ve bir sonraki düzenlemesi rev+1 ile diğerinin işini
   sessizce siler.

   Ayırt edici: kendi yazımımızın `updatedAt` damgası. Aynı rev'te GERİ GELEN
   damga bizimkinden farklıysa o rev'i başkası kazanmış demektir → uygula.

   `mineAt` null iken (henüz hiç yazmadık, ör. odayı yeni açtık ve ilk anlık
   görüntü aynı rev ile geliyor) eşit rev'te UYGULAMAYIZ — yoksa açılıştan
   hemen sonra yapılan düzenleme geri alınırdı.
   ------------------------------------------------------------ */

/* @param remoteRev gelen sürüm · @param remoteAt gelen updatedAt
   @param localRev  bizdeki sürüm · @param mineAt  kendi son yazımımızın damgası
                                                   (yazmadıysak null)
   @returns uzak durum uygulanmalı mı */
export function shouldApplyRemote(remoteRev, remoteAt, localRev, mineAt) {
  const rr = Number(remoteRev);
  const lr = Number(localRev);
  if (!Number.isFinite(rr) || !Number.isFinite(lr)) return false;
  if (rr > lr) return true;
  if (rr < lr) return false;
  /* Eşit rev: yalnız BİZ o rev'te yazmayı denediysek ve dönen damga bizim
     değilse — yani yarışı kaybettiysek. */
  if (mineAt == null) return false;
  return remoteAt != null && remoteAt !== mineAt;
}
