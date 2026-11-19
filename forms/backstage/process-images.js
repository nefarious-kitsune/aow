import url from 'url';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

import {getHash} from './hash-table.js';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const currDir = path.dirname(url.fileURLToPath(import.meta.url));

const imageFiles =
  fs
    .readdirSync(currDir, {withFileTypes: true})
    .filter((entry) => (
      (!entry.name.startsWith('--')) &&
      (!entry.name.startsWith('__')) &&
      (entry.isFile()) &&
      (path.extname(entry.name) === '.png')
    ))
    .map((entry) => entry.name);

function getLabelBuffer(label) {
  // 380 x 72
  // 90
  const inputTemplate = `<svg width="380" height="72">'
    <style>
      .label {
        fill: white; stroke: black; stroke-width: 1;
        font-family: "Fira Sans", sans-serif;
        font-size: 58; font-weight: 500; font-style: normal;
      }
    </style>
    <text x="90" y="50%" dominant-baseline="central" text-anchor="start"
      class="label">${label}</text>
    </svg>`;

  return Buffer.from(inputTemplate);
}

function processFormImg(fPath, hash, defId, atkId) {
  const w = 1204;
  const h = 1505;
  const cropOption = {
    left: (1206-w),
    width: w,
    height: h,
    top: (1979+25-h)
  };
  const image = sharp(fPath).extract(cropOption)
  if (defId === '') {
    return image.composite([
      {input: './templates/blue.png', left: 60, top: 60},
      {input: getLabelBuffer(atkId), left: 60, top: 60},
    ]);
  } else if (atkId === '') {
    return image.composite([
      {input: './templates/red.png', left: 60, top: 60},
      {input: getLabelBuffer(defId), left: 60, top: 60},
    ]);
  } else {
    return image
      .composite([
        {input: './templates/blue-vs-red.png', left: 60, top: 60},
        {input: getLabelBuffer(atkId), left: 60, top: 60},
        {input: getLabelBuffer(defId), left: 60, top: 60+(200-72)},
      ]);
  }
  // return image;
}

function processReportImg(fPath, hash, formId, reportId) {
  const cropLeft = 19;
  const cropTop = 473;
  const cropBottom = 2359;
  const cropOption = {
    left: cropLeft,
    width: 1206 - (cropLeft * 2),
    height: cropBottom - cropTop,
    top: cropTop
  };
  // if (!fs.existsSync(srcFPath)) break;
  return sharp(fPath).extract(cropOption);
}

async function processImages() {
  for (let i = 0; i < imageFiles.length; i++) {
    const fName = imageFiles[i];
    const fPath = path.join(currDir, fName);
    const fBaseName = fName.slice(0, -'.png'.length);

    let formId = parseInt(fBaseName.slice(0, 7));

    if (Number.isNaN(formId)) {
      console.log(`${fBaseName.slice(0, 7)} is not a number`);
      continue;
    }

    const formCategory = parseInt(fBaseName.slice(0, 3));
    const hash = (formCategory>0)?getHash(formId):'000';

    if ((formCategory >= 300) && (formCategory < 400)) {
      if (fBaseName.length > 7) {
        const reportId = fBaseName.slice(8);
        const expFPath = path.join(currDir, '../ss', `${hash}-${reportId}.png`);
        const image = processReportImg(fPath, hash, formId, reportId);
        await image.toFile(expFPath);
      } else {
        const expFPath = path.join(currDir, '../ss', `${hash}.png`);
        const image = processFormImg(fPath, hash, '', formId);
        await image.toFile(expFPath);
      }
    } else if (formCategory === 0) {
      const formName = fBaseName.slice(8);
      const expFName = formName.replaceAll(' ', '-').toLowerCase();
      const expFPath = path.join(currDir, `../ss/sos-${expFName}.png`);
      const image = processFormImg(fPath, hash, formName, '');
      await image.toFile(expFPath);
    } else {
      if (fBaseName.length > 7) {
        const formId2 = fBaseName.slice(8);
        const expFPath = path.join(currDir, '../ss', `${hash}v${formId2}.png`);
        const image = processFormImg(fPath, hash, formId2, formId);
        await image.toFile(expFPath);
      } else {
        const expFPath = path.join(currDir, '../ss', `${hash}.png`);
        const image = processFormImg(fPath, hash, formId, '');
        await image.toFile(expFPath);
      }
    }
    fs.renameSync(fPath, path.join(currDir, 'ss-archive', fName));
    await delay(Math.floor(Math.random()*5189 + 800));
  }
}

processImages();
