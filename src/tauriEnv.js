/* Tauri masaüstü kabuğu içinde mi çalışıyoruz? Web'de (tarayıcı) bu global
   hiç var olmaz — senkron, bağımlılıksız tespit. */
export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/* Dış bağlantıyı kullanıcının VARSAYILAN sistem tarayıcısında aç.
   Masaüstü (Tauri/WebView2) düz `<a target="_blank">` bağlantılarını sistem
   tarayıcısında AÇMAZ (gömülü webview gezinmeyi engeller → link "tepki vermez")
   → mevcut open_external_url komutunu çağır (Google OAuth ile aynı yol; app
   komutu olduğundan ekstra izin gerekmez). Web'de normal window.open. */
export async function openExternal(url) {
  if (!url) return;
  if (isTauri) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_external_url", { url });
      return;
    } catch { /* köprü/izin yoksa web yedeğine düş */ }
  }
  try { window.open(url, "_blank", "noopener,noreferrer"); } catch { /* yoksay */ }
}

/* <a> için yayılabilir prop seti: web'de normal anchor (href + yeni sekme; sağ
   tık "bağlantıyı kopyala" çalışır), masaüstünde tıklamada preventDefault +
   sistem tarayıcısı. Kullanım: <a {...extHref(url)} className=… title=…>…</a> */
export function extHref(url) {
  return {
    href: url || undefined,
    target: "_blank",
    rel: "noopener noreferrer",
    onClick: (e) => { if (isTauri && url) { e.preventDefault(); openExternal(url); } },
  };
}
