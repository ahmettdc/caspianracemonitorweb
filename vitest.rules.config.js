import { defineConfig } from "vitest/config";

/* Firebase RTDB güvenlik kuralı testleri — emülatör GEREKİR.
   Çalıştırma: `npm run test:rules` →
     firebase emulators:exec --only database "vitest run --config vitest.rules.config.js"
   Varsayılan `npm test` bunları HARİÇ tutar (vite.config.js test.exclude). */
export default defineConfig({
  test: {
    include: ["**/*.rules.test.js"],
    environment: "node",
    testTimeout: 20000,
    hookTimeout: 40000,
    fileParallelism: false,
  },
});
