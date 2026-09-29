import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative assets allow the same build to be uploaded to /demo/ or any subdirectory.
  base: "./",
  server: { port: 5186, strictPort: true },
  preview: { port: 4186, strictPort: true },
});
