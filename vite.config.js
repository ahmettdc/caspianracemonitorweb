import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" → GitHub Pages'te repo adından bağımsız çalışır
export default defineConfig({
  plugins: [react()],
  base: "./",
});
