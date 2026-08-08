import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    // Railway fronts the app with its own domain — accept any host.
    allowedHosts: true,
  },
});
