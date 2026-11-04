import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { defineConfig } from 'vitest/config';
import { mockDevice } from './dev/mockDevice';

// The app is built into one self-contained index.html (all JS and CSS
// inlined) because the Pico serves it from flash over its own Wi-Fi network,
// where there is no internet and every extra file costs flash and requests.
export default defineConfig({
  // mockDevice only runs in the dev server; see dev/mockDevice.ts.
  plugins: [preact(), viteSingleFile(), mockDevice()],
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
