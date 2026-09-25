import { mkdir, writeFile } from 'node:fs/promises';

const outputPath = new URL('../src/assets/runtime-config.js', import.meta.url);
const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? '';

await mkdir(new URL('../src/assets/', import.meta.url), { recursive: true });
await writeFile(
  outputPath,
  `window.__appConfig = ${JSON.stringify({ googleMapsApiKey: apiKey })};\n`,
);

if (!apiKey) {
  console.warn('GOOGLE_MAPS_API_KEY is not set; Google Maps will remain unavailable.');
}
