import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig(() => {
  const base = process.env.VITE_BASE_PATH ?? "/";
  if (!/^\/(?:[\w-]+\/)*$/.test(base)) {
    throw new Error(
      "VITE_BASE_PATH must be / or an absolute path like /tactibellum/.",
    );
  }

  return {
    base,
    plugins: [react(), tailwindcss()],
    test: { environment: "jsdom" },
  };
});
