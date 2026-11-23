import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Deployed under a project subpath on GitHub Pages, so the base is injected by
// the deploy job (`VITE_BASE=/mamapdf/`). Local dev and custom domains keep "/".
export default defineConfig(({ mode }) => ({
  base: loadEnv(mode, ".", "VITE_").VITE_BASE || "/",
  plugins: [react()],
}));
