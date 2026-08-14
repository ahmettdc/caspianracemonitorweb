import { StrictMode, Component } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { isTauri } from "./tauriEnv";
import { css } from "./styles";

/* Tema CSS'i boot'ta BİR KEZ <head>'e basılır. Eskiden her gate dalı kendi
   <style>{css}</style>'ını taşıyordu → her ekran geçişinde ~80 KB CSS'in
   CSSOM'da yeniden parse'ı + geçici stilsiz kare. Tek kalıcı düğümle ikisi de yok. */
const themeStyle = document.createElement("style");
themeStyle.textContent = css;
document.head.appendChild(themeStyle);

/* Hata sınırı: bir render hatası tüm uygulamayı karartmasın.
   Fallback yine kendi inline stilini taşır — tema CSS'ine bağımlı kalmasın. */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("Caspian Race Control — yakalanan hata:", error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    const en = (() => {
      try { return localStorage.getItem("crm-lang") === "en"; } catch { return false; }
    })();
    const S = {
      wrap: { minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "#120C0E", color: "#F2E9EB",
        fontFamily: "system-ui, sans-serif", padding: 20 },
      box: { maxWidth: 460, width: "100%", background: "#1C1315",
        border: "1px solid #3D242B", borderRadius: 14, padding: 28,
        textAlign: "center" },
      h: { margin: "0 0 8px", fontSize: 22, color: "#D24357" },
      p: { margin: "0 0 18px", fontSize: 13, color: "#A78F95", lineHeight: 1.5 },
      btn: { padding: "10px 18px", margin: "0 5px", borderRadius: 8,
        border: "1px solid #960018", background: "#960018", color: "#FFE9ED",
        cursor: "pointer", fontSize: 14, fontWeight: 600 },
      ghost: { background: "transparent", color: "#D24357",
        borderColor: "#D24357" },
      det: { marginTop: 16, textAlign: "left", fontSize: 11, color: "#A78F95" },
      pre: { whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#120C0E",
        padding: 10, borderRadius: 8, maxHeight: 140, overflow: "auto" },
    };
    return (
      <div style={S.wrap}>
        <div style={S.box}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏁</div>
          <h1 style={S.h}>{en ? "Something went wrong" : "Bir şeyler ters gitti"}</h1>
          <p style={S.p}>
            {en
              ? "The app hit an unexpected error. Your room data is safe on the server — try again or reload the page."
              : "Uygulama beklenmedik bir hatayla karşılaştı. Oda verilerin sunucuda güvende — tekrar dene veya sayfayı yenile."}
          </p>
          <button style={S.btn} onClick={() => this.setState({ error: null })}>
            {en ? "Try Again" : "Tekrar Dene"}
          </button>
          <button style={{ ...S.btn, ...S.ghost }} onClick={() => location.reload()}>
            {en ? "Reload Page" : "Sayfayı Yenile"}
          </button>
          <details style={S.det}>
            <summary style={{ cursor: "pointer" }}>
              {en ? "Technical details" : "Teknik detay"}
            </summary>
            <pre style={S.pre}>{String(this.state.error?.stack || this.state.error)}</pre>
          </details>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

/* PWA: service worker'ı yalnız üretimde kaydet (çevrimdışı app-shell).
   Dev'de kayıt yapılmaz — HMR'ı bozmamak için. Tauri kabuğu içinde de
   atlanır — "yüklü uygulama" deneyimini zaten kabuk veriyor, SW gereksiz. */
if (!isTauri && "serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(import.meta.env.BASE_URL + "sw.js")
      .catch((err) => console.warn("SW kaydı başarısız:", err?.message));
  });
}
