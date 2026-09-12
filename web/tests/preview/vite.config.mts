import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";
const local = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig(({ mode }) => ({
  define: { "process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY": JSON.stringify(loadEnv(mode, local("../../"), "NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY").NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY ?? "") },
  server: { host: "127.0.0.1", port: 4317, strictPort: true },
  esbuild: { jsx: "automatic" },
  plugins: [{ name: "isolated-fixture-services", enforce: "pre", resolveId(source) {
    if (source.endsWith("auth-provider")) return local("./auth.ts");
    if (source.endsWith("lib/firebase/client")) return local("./firebase.ts");
    if (source.endsWith("services/meetup-repository") || source.endsWith("services/social-repository")) return local("./fixtures.ts");
  } }],
  resolve: { alias: {
    "@": local("../../src"), "next/link": local("./link.tsx"), "next/navigation": local("./navigation.ts"), "next/dynamic": local("./dynamic.tsx"),
  } },
}));
