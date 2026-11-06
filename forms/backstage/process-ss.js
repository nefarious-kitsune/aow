import url from 'url';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

import {getHash} from './hash-table.js';

const currDir = path.dirname(url.fileURLToPath(import.meta.url));

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const imageFiles =
  fs
    .readdirSync(currDir, {withFileTypes: true})
    .filter((entry) => (
      (!entry.name.startsWith('--')) &&
      (!entry.name.startsWith('__')) &&
      (entry.isFile()) &&
      (path.extname(entry.name) == '.png')
    ))
    .map((entry) => entry.name);

const idLabelSvgTemplate =
`<svg width="380" height="100">'
<style>
    .title {
      fill: black;
      font-size: 68px;
      font-family: "Fira Sans", sans-serif;
      font-weight: 500;
      font-style: normal;
    }
</style>
<rect width="100%" height="100%" fill="#f0f0f0A0" />
<text x="5%" y="50%"
  dominant-baseline="central"
  text-anchor="start"
  class="title">{{LABEL}}</text>
</svg>`;

async function processImages() {
  for (let i = 0; i < imageFiles.length; i++) {
    const fName = imageFiles[i];

    let id = parseInt(fName.slice(0, 7));
    let label = '';

    if (Number.isNaN(id)) {
      id = 999;
      label = path.basename(fName);
    } else {
      label = id.toString();
    }

    const hash = getHash(id);

    const fPath = path.join(currDir, fName);
    const exportedFPath =
      path.join(currDir, '../ss', `${hash}${path.extname(fName)}`);
    const archivedFPath =
      path.join(currDir, 'ss-archive', fName);

    const image = sharp(fPath);
    const {width, height} = await image.metadata();

    if ((width === 1206) && (height === 2622)) {
      const w = 1204;
      const h = 1505;
      const svgText = idLabelSvgTemplate.replace('{{LABEL}}', label);
      const svgBuffer = Buffer.from(svgText);
      await image
        .extract({left: (1206-w), width: w, height: h, top: (1979+25-h)})
        .composite([{input: svgBuffer, left: 40, top: 100}])
        .toFile(exportedFPath);

      fs.renameSync(fPath, archivedFPath);
      await delay(Math.floor(Math.random()*5189 + 800));
    } else {
      console.log(`${id} (${width} x ${height}) skipped`)
    }
  }
}

await processImages();
console.log('all image files processed')
