/* Tauri masaüstü kabuğu içinde mi çalışıyoruz? Web'de (tarayıcı) bu global
   hiç var olmaz — senkron, bağımlılıksız tespit. */
export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
