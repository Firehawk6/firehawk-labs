// @ts-check

import { defineConfig } from "astro/config";

export default defineConfig({
  redirects: {
    "/experiments": "/projects",
    "/projects/web-experiments": "/projects",
    "/projects/homelab": "/homelab",
    "/projects/minecraft-network": "/status",
  },
  vite: {
    build: {
      chunkSizeWarningLimit: 550,
    },
  },
});
