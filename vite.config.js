import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" → GitHub Pages'te repo adından bağımsız çalışır
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    // recharts zaten TeleTab lazy chunk'ında; burada seyrek değişen
    // vendor'ları (react, firebase) ayırıp tarayıcı önbelleğini iyileştiriyoruz.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // rolldown (Vite 8) manualChunks'ı fonksiyon olarak ister.
        // recharts'a DOKUNMA — TeleTab lazy chunk'ında kalsın.
        manualChunks(id) {
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/")
            || id.includes("node_modules/scheduler")) return "react";
          if (id.includes("node_modules/firebase") || id.includes("node_modules/@firebase")) return "firebase";
          return undefined;
        },
      },
    },
  },
});
