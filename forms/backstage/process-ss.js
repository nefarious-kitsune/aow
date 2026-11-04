import url from 'url';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

const currDir = path.dirname(url.fileURLToPath(import.meta.url));

const primes = [
  232753, 312583, 195497, 830339, 420221, 144539, 280297, 260461,
  683257, 709201, 362393, 516233, 16253,  477539, 946177, 636319
];

function findImageFiles() {
  const files = [];

  fs
    .readdirSync(currDir, {withFileTypes: true})
    .forEach((entry) => {
      const entryUrl = path.join(currDir, entry.name);
      if (entry.name.startsWith('--')) return;
      if (entry.name.startsWith('__')) return;
      if (entry.isFile()) {
        if (path.extname(entry.name) == '.png') files.push(entryUrl);
      }
    });

  return files;
}

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

// console.log(files);

const promises = imageFiles.map(async (fName) => {
  // const fName = path.basename(fPath);
  const formId = parseInt(fName.slice(0, 7));
  const formIdExt = (formId ^ primes[formId % 16]).toString(16).toUpperCase();

  const fPath = path.join(currDir, fName);
  const exportedFName = `${formId}-${formIdExt}${path.extname(fName)}`;
  const exportedFPath = path.join(currDir, '../ss', exportedFName);
  const archivedFPath = path.join(currDir, 'ss-archive', fName);

  const image = sharp(fPath);
  const metadata = await image.metadata();

  if ((metadata.width === 1206) && (metadata.height === 2622)) {
    const w = 1204;
    const h = 1505;
    const svgText = `
    <svg width="380" height="100">
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
        class="title">${formId}</text>
    </svg>`;

    const svgBuffer = Buffer.from(svgText);

    await image
      .extract({left: (1206-w), width: w, height: h, top: (1979+25-h)})
      .composite([{input: svgBuffer, left: 40, top: 100}])
      .toFile(exportedFPath);

    fs.renameSync(fPath, archivedFPath);

    // console.log(`${exportedFName} processed`)
  } else {
    console.log(`${exportedFName} (${metadata.width} x ${metadata.height}skipped`)
  }
});

await Promise.all(promises);
console.log('all image files processed')
