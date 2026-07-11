// Regenerate the Windows app icon (assets/icon.ico) from the brand SVG
// (assets/icon.svg) at multiple resolutions.
//
//   npm run generate-icon
//
// Dev-only deps: @resvg/resvg-js (SVG -> PNG) and png-to-ico (PNGs -> .ico).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resvg } from '@resvg/resvg-js';
import pngToIco from 'png-to-ico';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = fs.readFileSync(path.join(root, 'assets/icon.svg'));
const sizes = [16, 24, 32, 48, 64, 128, 256];

const pngBuffers = sizes.map((size) => {
    const r = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
    return Buffer.from(r.render().asPng());
});

// A 256px PNG alongside the .ico (handy for docs / other platforms).
fs.writeFileSync(path.join(root, 'assets/icon.png'), pngBuffers[pngBuffers.length - 1]);

const ico = await pngToIco(pngBuffers);
fs.writeFileSync(path.join(root, 'assets/icon.ico'), ico);
console.log(`wrote assets/icon.ico (${ico.length} bytes, sizes: ${sizes.join(', ')}) + assets/icon.png`);
