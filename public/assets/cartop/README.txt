TOP-DOWN ARAÇ GÖRSELLERİ — Canlı Timing "Kendi Araç" lastik/hasar diyagramı için.

CarDiagram.jsx bu klasördeki üstten-görünüş (top-down) araç PNG'lerini kullanır:
ortada gerçek araç, çevresinde 4 lastik kutusu.

Dosyalar:
  default.png        → varsayılan (aracı çözemezsek/görsel yoksa). ZORUNLU.
  <key>.png          → araç başına (ileride). key = marka/model anahtarı.

Notlar:
  * PNG, saydam (transparent) arka planlı, portre (dikey, burun yukarı) olmalı.
  * Şeffaf kenarlar iyidir; kutu içinde "meet" ile ortalanıp ölçeklenir.
  * Görsel yoksa CarDiagram şematik gövdeye düşer (ekran bozulmaz).
  * Önbellek: constants.js AV (?v=N) ile sürümlenir; görsel güncellenince AV artır.

Kullanıcı defaulttop.png dosyasını buraya default.png olarak koyacak; ardından
tüm araçların top fotolarını içeren zip <key>.png olarak eklenip CarDiagram'a
per-araç src geçilecek (marka/model → key eşlemesi).
