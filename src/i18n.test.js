import { describe, it, expect } from "vitest";
import { EN } from "./i18n";

/* v2.0 arayüz yenilemesinde ortaya çıkan ve i18n-EN.md'de karşılığı OLMAYAN
   metinler ayrıca onaylanıp sözlüğe girildi (süreç: docs/i18n-gaps.md).
   Bu anahtarlar sessizce silinirse İngilizce arayüzde Türkçe metin belirir —
   t() karşılık bulamayınca kaynak metne düşer ve hata vermez. Kapsam burada
   kilitli. */
const APPROVED = {
  "Senaryolar": "Scenarios",
  "Planlanan": "Planned",
  "Tasarruflu": "Saving",
  "Agresif": "Aggressive",
  "Senaryolar yalnız gösterim — plan verisine yazılmaz.":
    "Scenarios are preview only — nothing is written to the plan.",
  "Satır yoğunluğu": "Row density",
  "Pist ve araç paneli": "Track & car panel",
  "Köprü durumu ve kaydı": "Bridge status and recording",
  "Menü": "Menu",
  "Menüyü aç": "Show menu",
  "Menüyü gizle": "Hide menu",
  "Dash": "Dash",
  "Tele": "Tele",
  "Ana içerik": "Main content",
  "Canlı senkron": "Live sync",
  "Oto saat": "Auto clock",
  "PIT YOLUNDA": "PITTING",
  "Kullanım": "Uses",
  "kilitli köşe": "locked corner",
  "Yazdır": "Print",
};

/* i18n-EN.md'den birebir alınan, v2.0'da kullanılan karşılıklardan bir kesit —
   teslim paketiyle uyumun bozulmadığını doğrular. */
const FROM_HANDOFF = {
  "Ana menü": "Main menu",
  "Canlı veri gelmiyor": "No live data",
  "Pilot uygunluğu": "Driver availability",
  "Yarış datası": "Race data",
  "Uygula": "Apply",
  "Geri al": "Discard",
  "Poz · Sınıf": "Pos · Class",
  "◱ Pit duvarı": "◱ Pit wall",
  "◰ Mühendis": "◰ Engineer",
  "İzleyici modu": "Viewer mode",
  "Yarış raporu": "Race report",
  "Set envanteri": "Set inventory",
  // yama 2.0.2 giriş ekranı
  "Google ile devam et": "Continue with Google",
  "Bağlanılıyor…": "Connecting…",
  "Giriş yap": "Sign in",
  " kabul edersin.": ".",
};

describe("i18n — v2.0 kapsamı", () => {
  it("onaylanan 20 karşılık sözlükte ve beklenen değerde", () => {
    for (const [tr, en] of Object.entries(APPROVED)) {
      expect(EN[tr], `eksik/yanlış: ${tr}`).toBe(en);
    }
  });

  it("teslim paketinden gelen karşılıklar birebir korunuyor", () => {
    for (const [tr, en] of Object.entries(FROM_HANDOFF)) {
      expect(EN[tr], `eksik/yanlış: ${tr}`).toBe(en);
    }
  });

  it("hiçbir karşılık boş değil", () => {
    const blank = Object.entries(EN).filter(([, v]) => typeof v !== "string" || !v.trim());
    expect(blank.map(([k]) => k)).toEqual([]);
  });
});
